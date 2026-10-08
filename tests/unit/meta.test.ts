import { describe, expect, it } from 'vitest';
import { COMPANIONS, COMPANION_IDS } from '../../src/data/companions';
import { HERO_IDS, HEROES } from '../../src/data/heroes';
import { CAMP_UPGRADES, MASTERY } from '../../src/data/meta';
import { tierIndex } from '../../src/data/rarity';
import { REGIONS } from '../../src/data/regions';
import { relicById } from '../../src/data/relics';
import { CHEST_HEROES, buyRareChest, chestOdds, openChest, pityLeft, rollChest } from '../../src/core/chests';
import { claimRegionReward, logBounty, logEvent, logTreasure, regionCompletion } from '../../src/core/completion';
import { buyCamp, campAvailable, checkAchievements, checkMastery } from '../../src/core/meta';
import { newProfile, readProfile } from '../../src/core/profile';
import { addShards, equipPet, grantHero, heroOwned, ownedPets, petBuilds, petSlots, setAllUnlocked, shardsToNext } from '../../src/core/roster';
import { Rng } from '../../src/core/rng';
import { Run } from '../../src/core/run';
import { cloneTuning, DEFAULT_SETTINGS } from '../../src/core/tuning';
import { xpForLevel } from '../../src/core/heroes';
import { setup } from './helpers';
import { companionHooks } from '../../src/core/companion-fx';

const t = cloneTuning();
const viaJson = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe('hero chests and the shrine', () => {
  it('odds favour the low tiers; the Rare chest starts at Rare; a region chest at Epic', () => {
    const hero = chestOdds(t, 'hero');
    expect(hero.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(hero[0]).toBeGreaterThan(hero[4]);
    const rare = chestOdds(t, 'rare');
    expect(rare[0] + rare[1]).toBe(0);
    expect(chestOdds(t, 'region').slice(0, 3).reduce((a, b) => a + b, 0)).toBe(0);
    // Celestial and Divine: tiny odds
    expect(hero[6] + hero[7]).toBeLessThan(0.002);
  });

  it('a chest never brings a story hero or the starter as a new hero', () => {
    // (round 7's heroes join from chests too: every chest hero, and only those, is in the pool)
    expect(CHEST_HEROES.sort()).toEqual(expect.arrayContaining(['hollis', 'moss', 'tam', 'torva', 'vesper']));
    expect(CHEST_HEROES.sort()).toEqual(HERO_IDS.filter((id) => HEROES[id].joins === 'chest').sort());
    for (const id of ['rowan', 'sable', 'neve'] as const) expect(CHEST_HEROES).not.toContain(id);
    const rng = new Rng(3);
    for (let i = 0; i < 300; i++) {
      const p = newProfile();
      const prize = rollChest(rng, t, p, 'hero');
      if (prize.kind === 'hero') expect(HEROES[prize.id].joins).toBe('chest');
    }
  });

  it('the shrine guarantees a Legendary or better within its pity, and resets it', () => {
    const p = newProfile();
    const rng = new Rng(11);
    let best = -1;
    for (let i = 0; i < Math.round(t.chests.pity); i++) {
      p.gems = 1e6;
      expect(buyRareChest(p, t)).toBe(true);
      const prize = openChest(rng, t, p, 'rare')!;
      if (tierIndex(prize.tier) >= tierIndex('legendary')) {
        best = i;
        break;
      }
    }
    expect(best).toBeGreaterThanOrEqual(0);
    expect(p.pity.rare).toBe(0);
    expect(pityLeft(p, t).legendary).toBe(Math.round(t.chests.pity));
  });

  it('the top pity tier comes round too, resetting its counter (no Celestial content yet: the best there is)', () => {
    const p = newProfile();
    p.pity.top = Math.round(t.chests.topPity) - 1;
    const prize = rollChest(new Rng(5), t, p, 'rare');
    expect(tierIndex(prize.tier)).toBeGreaterThanOrEqual(tierIndex('legendary'));
    expect(p.pity.top).toBe(0);
  });

  it('a Mythic companion (Nimbus) comes out at tiny odds, and from the top pity when the chest holds a companion', () => {
    const mythic = tierIndex('mythic');
    expect(COMPANIONS.nimbus.rarity).toBe('mythic');
    for (const kind of ['hero', 'rare'] as const) {
      const odds = chestOdds(t, kind)[mythic];
      expect(odds, kind).toBeGreaterThan(0);
      expect(odds, kind).toBeLessThan(0.02);
    }
    // the top pity forces Celestial or better: with nothing there yet, a companion is the best there is (Nimbus)
    const pets = new Set<string>();
    for (let seed = 1; seed < 60 && !pets.size; seed++) {
      const p = newProfile();
      p.pity.top = Math.round(t.chests.topPity) - 1;
      const prize = rollChest(new Rng(seed), t, p, 'rare');
      if (prize.kind === 'pet') {
        pets.add(prize.id);
        expect(prize.tier).toBe('mythic');
      }
    }
    expect([...pets]).toEqual(['nimbus']);
    // and every companion is in the chests' pool: each tier's companions come out of a plain roll now and then
    const seen = new Set<string>();
    const rng = new Rng(9);
    for (let i = 0; i < 4000; i++) {
      const prize = rollChest(rng, t, newProfile(), 'hero');
      if (prize.kind === 'pet') seen.add(prize.id);
    }
    for (const id of ['burr', 'lark', 'gloam']) expect(seen.has(id), id).toBe(true);
  });

  it('gems buy a Rare chest only when there are enough', () => {
    const p = newProfile();
    p.gems = t.chests.rareCost - 1;
    expect(buyRareChest(p, t)).toBe(false);
    p.gems += 1;
    expect(buyRareChest(p, t)).toBe(true);
    expect(p.gems).toBe(0);
    expect(p.chests.rare).toBe(1);
  });

  it('opening needs a waiting chest; duplicates become shards that raise stars', () => {
    const p = newProfile();
    expect(openChest(new Rng(1), t, p, 'hero')).toBeNull();
    const first = grantHero(p, t, 'tam');
    expect(first.fresh).toBe(true);
    const dup = grantHero(p, t, 'tam');
    expect(dup.fresh).toBe(false);
    expect(dup.shards).toBe(t.chests.dupShards);
    expect(p.heroes.tam.stars).toBe(2); // 10 shards: the first star
  });
});

describe('roster: stars, companions, unlock-all', () => {
  it('shards fill star after star up to 5', () => {
    const prog = { stars: 1, shards: 0 };
    expect(shardsToNext(t, 1)).toBe(t.stars.need[0]);
    expect(addShards(t, prog, 1000)).toBe(4);
    expect(prog).toEqual({ stars: 5, shards: 0 });
    expect(shardsToNext(t, 5)).toBeNull();
  });

  it('one companion slot, two with the Companion Perch; Pip from the start', () => {
    const p = newProfile();
    expect(ownedPets(p)).toEqual(['pip']);
    expect(petSlots(p)).toBe(1);
    p.pets.sunny.owned = true;
    expect(equipPet(p, 0, 'sunny')).toBe(true);
    expect(p.petsOn).toEqual(['sunny']);
    expect(equipPet(p, 1, 'pip')).toBe(false);
    p.camp.push('perch');
    expect(equipPet(p, 1, 'pip')).toBe(true);
    expect(petBuilds(p, t).map((b) => b.id)).toEqual(['sunny', 'pip']);
    expect(equipPet(p, 0, 'bun')).toBe(false); // not owned
  });

  it('the debug toggle unlocks every hero and companion, and turning it off puts things back', () => {
    const p = newProfile();
    setAllUnlocked(p, true);
    expect(heroOwned(p, 'vesper')).toBe(true);
    expect(ownedPets(p)).toHaveLength(COMPANION_IDS.length);
    p.hero = 'vesper';
    p.petsOn = ['sunny'];
    setAllUnlocked(p, false);
    expect(p.hero).toBe('rowan');
    expect(p.petsOn).toEqual(['pip']);
  });

  it('the profile keeps gems, chests, pity, companions, camp, logs, mastery and achievements (v4)', () => {
    const p = newProfile();
    Object.assign(p, { gems: 42, neveMet: true, camp: ['perch'], mastery: ['rowanLv5'], achievements: ['combo50'], seen: ['meetTam'], cosmetics: ['bannerRowan'] });
    p.heroes.neve.unlocked = true;
    p.chests = { hero: 2, rare: 1, region: 0 };
    p.pity = { rare: 7, top: 33 };
    p.pets.flurry = { owned: true, xp: 99, stars: 2, shards: 4 };
    p.petsOn = ['flurry', 'pip'];
    p.regions = { greenmarch: { bounties: [0, 2], treasures: [1], events: ['well'], chest: false } };
    p.counts = { holds: 12 };
    expect(readProfile(viaJson(p), t)).toEqual(p);
  });
});

describe('region completion', () => {
  it('Region 1 progress already made counts from the acts cleared; logs count bounties, treasures, events', () => {
    const p = newProfile();
    p.actsCleared = 3;
    let c = regionCompletion(p, 0);
    expect(c.parts.find((x) => x.key === 'acts')!.have).toBe(3);
    expect(c.parts.find((x) => x.key === 'minis')!.have).toBe(2);
    expect(c.parts.find((x) => x.key === 'boss')!.have).toBe(1);
    expect(c.done).toBe(false);
    for (const a of [0, 1, 2]) {
      expect(logBounty(p, a)).toBe(true);
      expect(logTreasure(p, a)).toBe(true);
    }
    expect(logBounty(p, 0)).toBe(false);
    for (const e of ['well', 'shrine', 'merchant']) logEvent(p, 1, e);
    c = regionCompletion(p, 0);
    expect(c.pct).toBe(100);
    expect(claimRegionReward(p, t, 0)).toBe(true);
    expect(p.chests.region).toBe(1);
    expect(claimRegionReward(p, t, 0)).toBe(false); // once
    // the next region's acts are 3-5 and count on their own
    expect(regionCompletion(p, 1).parts[0].have).toBe(0);
    expect(REGIONS[1].acts.length).toBe(3);
  });

  it('a v3 profile counts the Region 1 events whose relics it unlocked', () => {
    const p = readProfile({ v: 3, actsCleared: 2, relics: ['huntingOwl', 'tithe'], heroes: {} }, t);
    expect(p.regions.greenmarch.events.sort()).toEqual(['shiny', 'well']);
  });
});

describe('gems, achievements, mastery, camp upgrades', () => {
  it('achievements pay their gems once', () => {
    const p = newProfile();
    const got = checkAchievements(p, t, { combo: 55 });
    expect(got.map((a) => a.id)).toContain('combo50');
    const gems = p.gems;
    expect(checkAchievements(p, t, { combo: 60 }).map((a) => a.id)).not.toContain('combo50');
    expect(p.gems).toBe(gems);
  });

  it("a hero's mastery unlocks things for everyone: a relic in the pool, a camp upgrade to buy", () => {
    const p = newProfile();
    p.heroes.rowan.xp = xpForLevel(t, 5);
    const got = checkMastery(p, t).map((m) => m.id);
    expect(got).toContain('rowanLv5');
    const relic = MASTERY.find((m) => m.id === 'rowanLv5')!.reward;
    expect(relic.kind === 'relic' && p.relics.includes(relic.relic)).toBe(true);
    expect(relic.kind === 'relic' && relicById(relic.relic)?.from).toBe(3);
    expect(campAvailable(p)).not.toContain('warTable');
    p.heroes.rowan.acts = 3;
    checkMastery(p, t);
    expect(campAvailable(p)).toContain('warTable');
    p.coins = CAMP_UPGRADES.warTable.cost;
    expect(buyCamp(p, 'warTable')).toBe(true);
    expect(buyCamp(p, 'warTable')).toBe(false);
    expect(p.coins).toBe(0);
  });
});

describe('companions in fights', () => {
  const withPets = (ids: Array<keyof typeof COMPANIONS>, tune?: (x: typeof t) => void) => {
    const s = setup({ tune: (x) => ((x.companion.everyHits = 4), (x.blocks.redTravelSec = 10000), tune?.(x)) });
    s.c.hero.build = { ...s.c.hero.build, pets: ids.map((id) => ({ id, level: 1, stars: 1 })) };
    return s;
  };

  it('each companion attacks every few hits; Sunny breathes on every foe', () => {
    const s = withPets(['sunny'], (x) => (x.companion.damage = 10));
    const c = s.c;
    for (let i = 0; i < COMPANIONS.sunny.every; i++) (c as unknown as { companionTick(): void }).companionTick();
    const ev = c.drainEvents().filter((e) => e.type === 'pet');
    expect(ev).toHaveLength(1);
    expect(ev[0].type === 'pet' && ev[0].pet).toBe('sunny');
  });

  it('companion levels and stars raise their damage', () => {
    const s = withPets(['pip'], (x) => (x.companion.damage = 10));
    const c = s.c;
    c.hero.build = { ...c.hero.build, pets: [{ id: 'pip', level: 6, stars: 3 }] };
    for (let i = 0; i < 3; i++) (c as unknown as { companionTick(): void }).companionTick(); // 3 stars: one hit sooner
    const ev = c.drainEvents().find((e) => e.type === 'pet');
    expect(ev && ev.type === 'pet' && ev.damage).toBe(Math.round(10 * (1 + 5 * t.pets.levelDmg) * (1 + 2 * t.pets.starDmg)));
  });
});

describe("every companion's perk (with and without it)", () => {
  type Pet = keyof typeof COMPANIONS;
  const fight = (pet: Pet | null, tune?: (x: typeof t) => void) => {
    const s = setup({ enemies: ['bandit'], tune: (x) => ((x.companion.everyHits = 1), (x.blocks.redTravelSec = 10000), tune?.(x)) });
    const c = s.c;
    if (pet) {
      c.hero.build = { ...c.hero.build, pets: [{ id: pet, level: 1, stars: 1 }] };
      (c.hooks as unknown as unknown[]).push(...companionHooks([{ id: pet, level: 1, stars: 1 }]));
    }
    c.perk.resolve = 1;
    return { ...s, c };
  };
  /** Enough hits (left to right) for the companion to attack once. */
  const hitsFor = (c: ReturnType<typeof fight>['c'], pet: Pet) => {
    for (let i = 0; i < COMPANIONS[pet].every; i++) hitAt(c, 0.1 + 0.12 * i);
  };
  const hitAt = (c: ReturnType<typeof fight>['c'], p: number) => {
    const b = c.spawnBlock('yellow', p);
    const at = c.time + c.travelTime(c.cursorPos(), p, c.cursorDirAt(c.time));
    c.advanceTo(at);
    c.tap(at);
    return b;
  };

  it('Bun: every Nth hit finds a coin', () => {
    for (const pet of ['bun', null] as const) {
      const { c } = fight(pet, (x) => (x.pets.bunEvery = 2));
      hitAt(c, 0.2);
      hitAt(c, 0.4);
      expect(c.coinsEarned).toBe(pet ? 1 : 0);
    }
  });

  it('Pip: the first trap each fight is pecked away', () => {
    for (const pet of ['pip', null] as const) {
      const { c } = fight(pet);
      c.spawnBlock('purple', 0.6);
      c.advanceTo(0.05);
      expect(c.blocks.some((b) => b.kind === 'purple')).toBe(!pet);
    }
  });

  it('Newt: a bite sets its foe burning: a share of the bite every second for a few seconds, ticking as Ember Bite', () => {
    const hp = (pet: Pet | null) => {
      const { c } = fight(pet, (x) => (x.companion.damage = 20));
      hitsFor(c, 'newt');
      const e = c.enemies[0];
      const bite = c.drainEvents().find((x) => x.type === 'pet');
      const T = c.tuning.pets;
      if (pet) {
        expect(e.burn).toBeCloseTo(T.newtSec);
        expect(e.burnDps).toBeCloseTo((bite?.type === 'pet' ? bite.damage : 0) * T.newtBurnShare);
      } else expect(e.burn).toBe(0);
      const before = e.hp;
      c.advanceTo(c.time + T.newtSec + 0.05);
      const ticks = c.drainEvents().filter((x) => x.type === 'enemyHurt' && x.perk === 'emberBite');
      if (pet) {
        expect(ticks).toHaveLength(Math.round(T.newtSec)); // one a second
        const burnt = ticks.reduce((n, x) => n + (x.type === 'enemyHurt' ? x.damage : 0), 0);
        expect(before - e.hp).toBe(burnt);
        expect(burnt).toBeGreaterThanOrEqual(bite?.type === 'pet' ? bite.damage : 99); // the burn deals more than the bite
        expect(e.burn).toBe(0); // and then it's out
      } else expect(ticks).toHaveLength(0);
      return e.hp;
    };
    hp('newt');
    hp(null);
  });

  it('Newt: each foe burns on its own, and a bite on a burning foe refreshes its burn', () => {
    const { c } = fight('newt', (x) => (x.companion.damage = 20));
    /** A yellow right under the cursor, hit now. */
    const hitHere = () => {
      c.spawnBlock('yellow', c.cursorPosAt(c.time));
      c.tap(c.time);
    };
    for (let i = 0; i < COMPANIONS.newt.every; i++) hitHere();
    const e = c.enemies[0];
    c.advanceTo(c.time + 2.5);
    expect(e.burn).toBeCloseTo(c.tuning.pets.newtSec - 2.5, 1);
    for (let i = 0; i < COMPANIONS.newt.every; i++) hitHere();
    expect(e.burn).toBeCloseTo(c.tuning.pets.newtSec, 1);
    const other = c.addEnemy('slime')!;
    expect(other.burn).toBe(0);
  });

  it('Sprocket: every few seconds the next block has a wider Perfect zone', () => {
    for (const pet of ['sprocket', null] as const) {
      const { c } = fight(pet, (x) => ((x.pets.oilEvery = 0.1), (x.companion.everyHits = 0)));
      c.advanceTo(0.3);
      const b = c.spawnBlock('yellow', 0.7);
      // a tap a little off centre: Perfect only with the oil's wider zone
      const off = (b.width * c.tuning.judge.perfectFrac * 0.75) / c.cursorSpeed();
      const at = c.time + c.travelTime(c.cursorPos(), 0.7, 1) + off;
      c.advanceTo(at);
      expect(c.tap(at).perfect).toBe(!!pet);
    }
  });

  it('Brick: every few seconds it blocks a red that reaches you', () => {
    for (const pet of ['brick', null] as const) {
      const { c } = fight(pet, (x) => ((x.pets.rockEvery = 0.5), (x.blocks.redTravelSec = 1)));
      c.advanceTo(0.6);
      c.spawnBlock('red', 0.06);
      c.advanceTo(1);
      expect(c.hero.hp === c.maxHp()).toBe(!!pet);
    }
  });

  it("Flurry: a bite slows the target's reds; a block slows the next red", () => {
    for (const pet of ['flurry', null] as const) {
      const { c } = fight(pet);
      const r = c.spawnBlock('red', 0.95, c.enemies[0].id);
      hitsFor(c, 'flurry');
      expect(r.chill > 0).toBe(!!pet);
    }
  });

  it('Mote: every N combo a green appears; at 10+ combo it heals a little now and then', () => {
    for (const pet of ['mote', null] as const) {
      const { c } = fight(pet, (x) => ((x.pets.starEvery = 2), (x.companion.everyHits = 0)));
      hitAt(c, 0.2);
      hitAt(c, 0.4);
      expect(c.blocks.some((b) => b.kind === 'green')).toBe(!!pet);
      c.combo = 12;
      c.hero.hp = 50;
      c.advanceTo(c.time + c.tuning.pets.mendSec + 0.1);
      expect(c.hero.hp > 50).toBe(!!pet);
    }
  });

  it('Sunny: kills drop more coins; at a high combo its breath burns traps; ice under you melts faster', () => {
    for (const pet of ['sunny', null] as const) {
      const { c } = fight(pet, (x) => (x.pets.burnAt = 0));
      c.spawnBlock('purple', 0.95);
      c.advanceTo(0.02);
      hitsFor(c, 'sunny');
      expect(c.blocks.some((b) => b.kind === 'purple')).toBe(!pet);
      const z = c.addZone('ice', 0.5, 1, 1); // the cursor is on it the whole time
      c.advanceTo(c.time + 0.3);
      expect(z.life < 0.6).toBe(!!pet);
    }
  });

  // ---- Part 6 companions (round 7)
  /** Tap a block already on the bar when the cursor gets there. */
  const tapBlock = (c: ReturnType<typeof fight>['c'], b: { pos: number }) => {
    const at = c.time + c.travelTime(c.cursorPos(), b.pos, c.cursorDirAt(c.time));
    c.advanceTo(at);
    return c.tap(at);
  };

  it('Burr: a red that hits you sends spines back at the foe that threw it (a share of his roll), the tick after', () => {
    for (const pet of ['burr', null] as const) {
      const { c } = fight(pet, (x) => ((x.blocks.redTravelSec = 1), (x.companion.damage = 10), (x.companion.everyHits = 0)));
      const e = c.enemies[0];
      const hp = e.hp;
      c.spawnBlock('red', 0.06, e.id);
      c.advanceTo(1);
      expect(c.hero.hp).toBeLessThan(c.maxHp()); // the red hit
      const spines = c.drainEvents().filter((x) => x.type === 'enemyHurt' && x.perk === 'prickly');
      expect(spines).toHaveLength(pet ? 1 : 0);
      if (pet) expect(hp - e.hp).toBe(Math.max(1, Math.round(10 * COMPANIONS.burr.dmg * c.tuning.pets.prickly)));
      else expect(e.hp).toBe(hp);
    }
  });

  it('Burr: a red a perk stopped (Brick) never pricks; a trap or a miss never does', () => {
    const { c } = fight('burr', (x) => ((x.blocks.redTravelSec = 1), (x.companion.everyHits = 0)));
    (c.hooks as unknown as unknown[]).unshift({ impact: () => true });
    c.spawnBlock('red', 0.06);
    const trap = c.spawnBlock('purple', 0.5);
    c.advanceTo(0.4);
    tapBlock(c, trap);
    c.tap(c.time); // (on nothing: a miss)
    c.advanceTo(c.time + 0.05);
    expect(c.hero.hp).toBeLessThan(c.maxHp()); // the trap went off
    expect(c.drainEvents().some((x) => x.type === 'perk' && x.id === 'prickly')).toBe(false);
  });

  it('Lark: every N combo the next yellow sings (a note on it); hitting it adds more combo', () => {
    for (const pet of ['lark', null] as const) {
      const { c } = fight(pet, (x) => ((x.pets.songEvery = 2), (x.companion.everyHits = 0)));
      hitAt(c, 0.2);
      hitAt(c, 0.4); // combo 2: a song, waiting for a yellow
      const y = c.spawnBlock('yellow', 0.7);
      c.advanceTo(c.time + 0.02);
      expect(c.perk.songNote === y.id).toBe(!!pet);
      expect(c.drainEvents().some((x) => x.type === 'perk' && x.id === 'wakeSong' && x.pos === y.pos)).toBe(!!pet);
      const before = c.combo;
      expect(tapBlock(c, y).outcome).toBe('hit');
      expect(c.combo - before).toBe(pet ? 1 + c.tuning.pets.songCombo : 1);
      expect(c.drainEvents().some((x) => x.type === 'perk' && x.id === 'wakeNote' && x.amount === c.tuning.pets.songCombo)).toBe(!!pet);
      expect(c.perk.songNote ?? 0).toBe(0);
    }
  });

  it('Lark: one song at a time; a noted yellow gone some other way passes its note to the next yellow', () => {
    const { c } = fight('lark', (x) => ((x.pets.songEvery = 5), (x.companion.everyHits = 0)));
    const a = c.spawnBlock('yellow', 0.5);
    const b = c.spawnBlock('yellow', 0.8);
    c.combo = 4;
    hitAt(c, 0.2); // combo 5: a song on the next yellow (a)
    c.advanceTo(c.time + 0.02);
    expect(c.perk.songNote).toBe(a.id);
    c.combo = 9;
    c.perk.songWant = 0;
    hitAt(c, 0.3); // combo 10: the song on a still waits to be hit (no second one)
    c.advanceTo(c.time + 0.02);
    expect(c.perk.songWant ?? 0).toBe(0);
    c.removeBlock(a, 'expire');
    c.advanceTo(c.time + 0.02);
    expect(c.perk.songNote).toBe(b.id);
  });

  it('Gloam: every few seconds the next trap is swatted into a yellow where it stands (nothing added to the bar)', () => {
    for (const pet of ['gloam', null] as const) {
      const { c } = fight(pet, (x) => ((x.pets.nightEvery = 0.5), (x.companion.everyHits = 0)));
      const trap = c.spawnBlock('purple', 0.8);
      const n = c.blocks.length;
      c.advanceTo(0.3);
      expect(trap.kind).toBe('purple'); // not yet
      c.advanceTo(0.6);
      expect(trap.kind).toBe(pet ? 'yellow' : 'purple');
      expect(c.blocks.length).toBe(n);
      const ev = c.drainEvents();
      expect(ev.some((x) => x.type === 'morph' && x.id === trap.id)).toBe(!!pet);
      expect(ev.some((x) => x.type === 'perk' && x.id === 'nightEyes' && x.pos === trap.pos)).toBe(!!pet);
      // the swatted trap is a plain yellow now: a tap hits it
      expect(tapBlock(c, trap).outcome).toBe(pet ? 'hit' : 'trap');
    }
  });

  it('Gloam leaves the trap Pip already picked (Owl Watch pecks it away)', () => {
    const { c } = fight('gloam', (x) => ((x.pets.nightEvery = 0.01), (x.companion.everyHits = 0)));
    (c.hooks as unknown as unknown[]).unshift(...companionHooks([{ id: 'pip', level: 1, stars: 1 }]));
    c.advanceTo(0.05);
    c.spawnBlock('purple', 0.6);
    c.advanceTo(0.1);
    expect(c.blocks.some((b) => b.kind === 'yellow')).toBe(false);
    expect(c.blocks.some((b) => b.kind === 'purple')).toBe(false);
  });

  it("the new perks keep the anti-spam rules: nothing added to the bar's cover, no heals, no forgiven misses", () => {
    // Gloam's swat replaces the trap (same block, same width); Lark's song marks a yellow; the Tide moves reds
    const { c } = fight('gloam', (x) => ((x.pets.nightEvery = 0.2), (x.pets.tideEvery = 0.2), (x.pets.songEvery = 1), (x.companion.everyHits = 0)));
    (c.hooks as unknown as unknown[]).push(...companionHooks(['lark', 'nimbus', 'burr'].map((id) => ({ id: id as Pet, level: 1, stars: 5 }))));
    c.spawnBlock('purple', 0.7);
    c.spawnBlock('yellow', 0.85);
    c.spawnBlock('red', 0.45);
    const cover = c.covered();
    const n = c.blocks.length;
    c.hero.hp = Math.round(c.maxHp() / 2);
    const hp = c.hero.hp;
    c.advanceTo(0.5);
    hitAt(c, 0.3);
    expect(c.blocks.some((b) => b.kind === 'purple')).toBe(false); // swatted
    expect(c.blocks.length).toBe(n); // (the hit's own block came and went)
    expect(c.covered()).toBeCloseTo(cover, 6);
    expect(c.hero.hp).toBe(hp); // nothing healed
    const ev = c.drainEvents();
    expect(ev.some((x) => x.type === 'heal')).toBe(false);
    expect(ev.some((x) => x.type === 'perk' && x.id === 'tide')).toBe(true);
    // a miss still breaks the combo with Burr, Lark and Nimbus along
    c.combo = 12;
    c.tap(c.time);
    expect(c.combo).toBe(0);
  });

  it('Nimbus: every few seconds a wave crosses the bar and pushes every red back (once a red is in the near half)', () => {
    for (const pet of ['nimbus', null] as const) {
      const { c } = fight(pet, (x) => ((x.pets.tideEvery = 0.2), (x.companion.everyHits = 0), (x.blocks.redTravelSec = 4)));
      const near = c.spawnBlock('red', 0.45);
      const far = c.spawnBlock('red', 0.8);
      c.advanceTo(0.15);
      expect(c.perk.tideX ?? 0).toBe(0); // not yet
      c.advanceTo(0.95);
      // each moved left ~0.22 of the bar on its own; the wave carried each back (up to 0.3: a red stops short of the
      // red behind it)
      expect(near.pos > 0.45).toBe(!!pet);
      expect(far.pos > 0.8).toBe(!!pet);
      const tides = c.drainEvents().filter((x) => x.type === 'perk' && x.id === 'tide');
      expect(tides).toHaveLength(pet ? 1 : 0);
    }
  });

  it('Nimbus: the Tide waits for a red in the near half; then each red is pushed once a wave', () => {
    const { c } = fight('nimbus', (x) => ((x.pets.tideEvery = 0.1), (x.companion.everyHits = 0), (x.blocks.redTravelSec = 400)));
    const r = c.spawnBlock('red', 0.9);
    c.advanceTo(0.5);
    expect(c.perk.tideReady).toBe(1); // ready, waiting: the red is still far
    expect(c.perk.tideN ?? 0).toBe(0);
    r.pos = 0.4;
    c.advanceTo(1.5);
    expect(c.perk.tideN).toBe(1); // one wave (the next waits for a red in the near half again)
    expect(c.perk.tideX ?? 0).toBe(0); // it has crossed
    expect(r.pos).toBeCloseTo(0.4 + c.tuning.pets.tidePush, 1);
  });

  it('Nimbus: at a high combo your hits deal more (Calm Seas, called as the combo gets there)', () => {
    const dmg = (pet: Pet | null, combo: number) => {
      const { c } = fight(pet, (x) => (x.companion.everyHits = 0));
      c.combo = combo;
      hitAt(c, 0.5);
      const ev = c.drainEvents();
      const hit = ev.find((x) => x.type === 'hit');
      return { dmg: hit?.type === 'hit' ? hit.damage : 0, calm: ev.some((x) => x.type === 'perk' && x.id === 'calmSeas') };
    };
    const at = t.pets.calmAt;
    expect(dmg('nimbus', at + 5).dmg).toBeGreaterThan(dmg(null, at + 5).dmg);
    expect(dmg('nimbus', at - 5).dmg).toBe(dmg(null, at - 5).dmg);
    expect(dmg('nimbus', at - 1).calm).toBe(true);
    expect(dmg('nimbus', at + 5).calm).toBe(false);
    expect(dmg(null, at - 1).calm).toBe(false);
  });

  it('stars make the new perks a step stronger', () => {
    const [one, five] = [1, 5].map((stars) => {
      const s = setup({ enemies: ['bandit'], tune: (x) => ((x.pets.songEvery = 2), (x.companion.everyHits = 0)) });
      (s.c.hooks as unknown as unknown[]).push(...companionHooks([{ id: 'lark', level: 1, stars }]));
      return s.c;
    });
    for (const c of [one, five]) {
      c.combo = 9;
      c.spawnBlock('yellow', 0.8);
      hitAt(c, 0.3);
      c.advanceTo(c.time + 0.02);
    }
    const y1 = one.blocks.find((b) => b.id === one.perk.songNote)!;
    const y5 = five.blocks.find((b) => b.id === five.perk.songNote)!;
    const [b1, b5] = [one.combo, five.combo];
    tapBlock(one, y1);
    tapBlock(five, y5);
    expect(five.combo - b5).toBeGreaterThan(one.combo - b1);
  });
});

describe('practice fights and the run rewards', () => {
  it('a practice fight hurts nobody, pays nothing, and goes back where it came from', () => {
    const p = newProfile();
    const r = new Run(t, { ...DEFAULT_SETTINGS }, 3, p);
    r.toCamp();
    r.startPractice({ enemies: ['dummy'] });
    expect(r.phase).toBe('fight');
    const c = r.combat!;
    const hp0 = r.hero.hp;
    for (let k = 0; k < 6; k++) c.advanceTo(c.time + 4.9);
    r.sync();
    expect(r.hero.hp).toBe(hp0); // the dummy's reds land, but practice never hurts
    for (const e of c.enemies) (e.hp = 1), (e.uses = e.uses.map(() => 1));
    c.stacks = 1;
    c.finisher();
    r.sync();
    expect(r.phase).toBe('camp');
    expect(r.practiceEnded).toEqual({ won: true });
    expect(p.coins).toBe(0);
    expect(p.heroes.rowan.xp).toBe(0);
  });

  it("a practice fight's taps count toward the accuracy readout (the Training Dummy, the Test lab)", () => {
    const p = newProfile();
    const r = new Run(t, { ...DEFAULT_SETTINGS }, 3, p);
    r.toCamp();
    r.startPractice({ enemies: ['dummy'] });
    const c = r.combat!;
    c.aims.push(12, -30, 4);
    r.sync();
    expect(p.acc.recent).toEqual([12, -30, 4]);
    expect(c.aims).toHaveLength(0);
  });
});
