import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LAB_EARLIER, LAB_GROUPS, LAB_NEW, LAB_SCENARIOS, type LabScenario } from '../../src/data/lab';
import { HERO_IDS } from '../../src/data/heroes';
import { COMPANION_IDS } from '../../src/data/companions';
import { ENEMIES } from '../../src/data/enemies';
import { FROST_ENEMIES } from '../../src/data/enemies-frost';
import { FROSTPEAKS } from '../../src/data/frostpeaks';
import { GREENMARCH } from '../../src/data/greenmarch';
import { TIPS } from '../../src/data/tips';
import { ALL_ACTS, REGIONS } from '../../src/data/regions';
import { regionOpen, unveilPending } from '../../src/core/world-plan';
import { STORY } from '../../src/data/story';
import { CAMP_UPGRADES, CAMP_UPGRADE_IDS } from '../../src/data/meta';
import { buyRareChest, pityLeft } from '../../src/core/chests';
import { claimRegionReward, regionCompletion } from '../../src/core/completion';
import { campAvailable } from '../../src/core/meta';
import { labFight, labMinutes, labProfile, labReport, labVisible, rateScenario, ratingOf, readLabState, staleRating, startLabScenario, newLabState, labHomePhase } from '../../src/core/lab';
import { equippedItems, newProfile, readProfile } from '../../src/core/profile';
import { ownedHeroes, petBuilds } from '../../src/core/roster';
import { fight } from '../../src/core/bot';
import { Rng } from '../../src/core/rng';
import { Run } from '../../src/core/run';
import { snapshotRun } from '../../src/core/save';
import { cloneTuning, DEFAULT_SETTINGS } from '../../src/core/tuning';
import { LAB_STATE_KEY, loadLabState, loadProfile, loadRunSave, setStorageSlot, storageKeys, storageSlot, writeLabState, writeProfile, writeRunSave, clearRunSave } from '../../src/engine/storage';

const t = cloneTuning();
const byId = (id: string): LabScenario => {
  const s = LAB_SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`no lab scenario ${id}`);
  return s;
};
const fights = LAB_SCENARIOS.filter((s) => s.setup.kind === 'fight');
const enemiesOf = (s: LabScenario): string[] => (s.setup.kind === 'fight' ? s.setup.waves.flat() : []);
// what the playtester must not read outside the spoiler group: the next region's name, its acts, its foes, its story speakers
const SECRET_WORDS = [FROSTPEAKS.name, ...FROSTPEAKS.acts.map((a) => a.name), ...Object.values(FROST_ENEMIES).map((e) => e.name), 'Glacia', 'Rimehorn', 'Matron', 'wyrm', 'Ashfell'];

describe('Test lab scenarios (data)', () => {
  it('every scenario has a group, a short label and line, a duration of 30-90 s and a unique id', () => {
    const ids = new Set<string>();
    for (const s of LAB_SCENARIOS) {
      expect(ids.has(s.id), s.id).toBe(false);
      ids.add(s.id);
      expect(LAB_GROUPS.some((g) => g.id === s.group), s.id).toBe(true);
      expect(s.label.length, s.id).toBeGreaterThan(0);
      expect(s.label.length, s.id).toBeLessThanOrEqual(20);
      expect(s.try.length, s.id).toBeGreaterThan(0);
      expect(s.try.length, `${s.id}: "what to try" is one short line`).toBeLessThanOrEqual(52);
      expect(s.secs, s.id).toBeGreaterThanOrEqual(30);
      expect(s.secs, s.id).toBeLessThanOrEqual(90);
    }
  });

  it('heroes, companions, foes, acts and scenes are all real', () => {
    for (const s of LAB_SCENARIOS) {
      const st = s.setup;
      if (st.kind === 'fight') {
        expect(HERO_IDS, s.id).toContain(st.hero);
        expect(st.act, s.id).toBeGreaterThanOrEqual(0);
        expect(st.act, s.id).toBeLessThan(ALL_ACTS.length);
        expect(st.waves.length, s.id).toBeGreaterThan(0);
        for (const k of st.waves.flat()) expect(ENEMIES[k], `${s.id}: ${k}`).toBeDefined();
        for (const id of st.pets ?? []) expect(COMPANION_IDS, s.id).toContain(id);
        if (st.stars !== undefined) expect(st.stars).toBeGreaterThanOrEqual(1), expect(st.stars).toBeLessThanOrEqual(5);
      } else if (st.kind === 'story') {
        expect(st.scenes.length, s.id).toBeGreaterThan(0);
        for (const id of st.scenes) expect(STORY[id], `${s.id}: ${id}`).toBeDefined();
      } else {
        if (st.hero) expect(HERO_IDS).toContain(st.hero);
      }
      const p = s.profile ?? {};
      for (const id of Object.keys(p.heroes ?? {})) expect(HERO_IDS, s.id).toContain(id);
      for (const id of [...(p.pets ?? []), ...(p.petsOn ?? [])]) expect(COMPANION_IDS, s.id).toContain(id);
      for (const id of p.camp ?? []) expect(CAMP_UPGRADE_IDS, s.id).toContain(id);
    }
  });

  it('region foes, bosses and story are spoilers: flagged, in the spoiler group, hidden by default', () => {
    const frost = new Set(Object.keys(FROST_ENEMIES));
    for (const s of LAB_SCENARIOS) {
      const secret = enemiesOf(s).some((k) => frost.has(k)) || s.setup.kind === 'story';
      if (secret) expect(s.spoiler, s.id).toBe(true);
      expect(!!s.spoiler, s.id).toBe(s.group === 'spoiler');
    }
    expect(LAB_GROUPS.find((g) => g.id === 'spoiler')?.spoiler).toBe(true);
    expect(readLabState(null).spoilers).toBe(false);
    expect(newLabState().spoilers).toBe(false);
    expect(labVisible(false).some((s) => s.spoiler)).toBe(false);
    expect(labVisible(true).filter((s) => s.spoiler).length).toBeGreaterThan(0);
  });

  it('no label or line names the next region, its acts, foes or story (spoiler items say act numbers only)', () => {
    for (const s of LAB_SCENARIOS)
      for (const w of SECRET_WORDS) {
        expect(s.label.toLowerCase(), s.id).not.toContain(w.toLowerCase());
        expect(s.try.toLowerCase(), s.id).not.toContain(w.toLowerCase());
      }
    for (const g of LAB_GROUPS) for (const w of SECRET_WORDS) expect(g.name.toLowerCase()).not.toContain(w.toLowerCase());
  });

  it("covers this round's new content in the New section, about ten minutes without the spoilers", () => {
    const fresh = LAB_NEW;
    const r1 = new Set(GREENMARCH.acts.flatMap((a) => [...a.fights.early.flat(), ...a.fights.late.flat(), ...a.elites.flat()]));
    // each hero but the starter, reworked (a new rev asks for a new rating): a real fight long enough to feel the kit
    // (six waves of Region 1 foes at Act 2's numbers, the last with an elite), the finisher banked, the how-to first
    for (const id of ['sable', 'neve', 'moss', 'tam', 'hollis', 'vesper', 'torva']) {
      const s = fresh.find((x) => x.group === 'heroes' && x.setup.kind === 'fight' && x.setup.hero === id);
      expect(s, id).toBeDefined();
      expect(s!.rev ?? 0, id).toBeGreaterThanOrEqual(1);
      const f = labFight(s!)!;
      expect(f.safe, id).toBe(false);
      expect(f.act, id).toBe(1);
      expect(f.waves.length, id).toBeGreaterThanOrEqual(6);
      expect(f.waves.flat().length, id).toBeGreaterThanOrEqual(12);
      expect(GREENMARCH.acts.flatMap((a) => a.elites.flat()).some((e) => f.waves.at(-1)!.includes(e)), id).toBe(true);
      expect(f.stacks, id).toBeGreaterThanOrEqual(1);
      expect(f.stars ?? 1, id).toBeGreaterThanOrEqual(2);
      for (const k of f.waves.flat()) expect(r1.has(k), `${id}: ${k}`).toBe(true);
      const tip = TIPS.find((d) => d.hero === id);
      expect(tip, id).toBeDefined();
      expect(s!.profile?.tips, id).toEqual([tip!.id]);
    }
    // every companion, in pairs with the Perch, in four waves or more
    const petItems = fresh.filter((s) => s.group === 'companions');
    const pets = new Set(petItems.flatMap((s) => (s.setup.kind === 'fight' ? (s.setup.pets ?? []) : [])));
    for (const id of COMPANION_IDS) expect(pets.has(id), id).toBe(true);
    for (const s of petItems) {
      expect(labFight(s)!.waves.length, s.id).toBeGreaterThanOrEqual(4);
      expect(s.rev ?? 0, s.id).toBeGreaterThanOrEqual(1);
    }
    // a late fight of Act 1 and of Act 2 with as many waves as the map deals them now
    for (const act of [0, 1]) {
      const s = fresh.find((x) => x.group === 'fights' && x.setup.kind === 'fight' && x.setup.act === act);
      expect(s, `act ${act + 1}`).toBeDefined();
      expect(labFight(s!)!.waves.length).toBe(GREENMARCH.acts[act].waves.last);
      for (const k of labFight(s!)!.waves.flat()) expect(r1.has(k), k).toBe(true);
    }
    const m = labMinutes();
    expect(m).toBeGreaterThanOrEqual(8);
    expect(m).toBeLessThanOrEqual(14);
    expect(LAB_EARLIER.every((s) => !LAB_NEW.includes(s))).toBe(true);
  });

  it("still holds M5's content (Earlier): the bar rules, the camp's screens, the later regions behind spoilers", () => {
    const all = LAB_SCENARIOS;
    // each bar rule alone against the Training Dummy, nothing hurting
    const bars = all.filter((s) => s.group === 'bar').map((s) => labFight(s)!);
    for (const rule of ['ice', 'holds', 'snow'] as const) expect(bars.some((f) => !!f.bar?.[rule]), rule).toBe(true);
    for (const f of bars) {
      expect(f.waves).toEqual([['dummy']]);
      expect(f.safe).toBe(true);
    }
    for (const id of ['chestHero', 'chestRare', 'shrine', 'completionNear', 'completionDone', 'campUpgrades', 'heroSelect']) expect(all.some((s) => s.id === id), id).toBe(true);
    // spoilers: each act of the next region, each mini-boss, the boss, the story
    for (const act of [3, 4, 5]) {
      expect(all.some((s) => s.spoiler && s.setup.kind === 'fight' && s.setup.act === act && !s.setup.safe), `act ${act} foes`).toBe(true);
      expect(all.some((s) => s.spoiler && s.setup.kind === 'story' && s.setup.act === act), `act ${act} story`).toBe(true);
    }
    for (const boss of FROSTPEAKS.acts.flatMap((a) => a.boss)) expect(all.some((s) => enemiesOf(s).includes(boss)), boss).toBe(true);
    const scenes = new Set(all.flatMap((s) => (s.setup.kind === 'story' ? s.setup.scenes : [])));
    for (const a of FROSTPEAKS.acts) for (const id of [a.startScene, a.bossScene]) expect(scenes.has(id!), id).toBe(true);
    expect(scenes.has(FROSTPEAKS.victoryScene)).toBe(true);
  });
});

describe('Test lab profiles (the lab save, built per scenario)', () => {
  it('outside the spoiler group, no lab profile opens a later region on the world map (and none ever glides over one)', () => {
    for (const s of LAB_SCENARIOS) {
      const p = labProfile(t, s);
      expect(unveilPending(p), s.id).toBeNull();
      expect(REGIONS.length).toBeGreaterThan(1);
      if (s.spoiler) continue;
      expect(regionOpen(p, 1), s.id).toBe(false);
    }
  });

  it("every scenario's profile is a fresh, valid profile with a Rare kit worn and the right hero picked", () => {
    const seen = new Set<object>();
    for (const s of LAB_SCENARIOS) {
      const p = labProfile(t, s);
      expect(seen.has(p)).toBe(false);
      seen.add(p);
      // it survives a save and a load unchanged (a valid v4 profile)
      expect(readProfile(JSON.parse(JSON.stringify(p)), t)).toEqual(p);
      expect(equippedItems(p).length, s.id).toBe(6);
      // tips are off, except a hero's how-to card before their fight (every other tip seen)
      if (s.profile?.tips?.length) {
        expect(p.tipsOff, s.id).toBe(false);
        expect(TIPS.filter((d) => !p.tips.includes(d.id)).map((d) => d.id), s.id).toEqual(s.profile.tips);
      } else expect(p.tipsOff).toBe(true);
      if (s.setup.kind === 'fight') {
        expect(p.hero, s.id).toBe(s.setup.hero);
        expect(p.heroes[s.setup.hero].unlocked).toBe(true);
      }
      // the camp never plays a story hero's arrival over the lab
      expect(p.sableMet).toBe(true);
      if (p.actsCleared >= 4) expect(p.neveMet).toBe(true);
    }
  });

  it('chests, the shrine and its pity', () => {
    expect(labProfile(t, byId('chestHero')).chests.hero).toBe(1);
    expect(labProfile(t, byId('chestRare')).chests.rare).toBe(1);
    const p = labProfile(t, byId('shrine'));
    expect(pityLeft(p, t).legendary).toBe(3);
    expect(buyRareChest(p, t)).toBe(true);
    expect(buyRareChest(p, t)).toBe(true);
    expect(buyRareChest(p, t)).toBe(false); // gems for exactly two
    expect(p.chests.rare).toBe(2);
  });

  it('region completion: one near 100%, one at 100% with its reward to claim', () => {
    const near = labProfile(t, byId('completionNear'));
    const c = regionCompletion(near, 0);
    expect(c.done).toBe(false);
    expect(c.pct).toBeGreaterThanOrEqual(85);
    // (its boss still to beat: the next region isn't reached, so the progress screen keeps its name a surprise)
    expect(regionOpen(near, 1)).toBe(false);
    expect(claimRegionReward(near, t, 0)).toBe(false);
    const done = labProfile(t, byId('completionDone'));
    expect(regionCompletion(done, 0).done).toBe(true);
    expect(claimRegionReward(done, t, 0)).toBe(true);
    expect(done.chests.region).toBe(1);
    // the next region is reached on that profile (the progress screen names it): it waits behind "Show spoilers"
    expect(regionOpen(done, 1)).toBe(true);
    expect(byId('completionDone').spoiler).toBe(true);
  });

  it('camp upgrades: coins enough, a couple available, some locked', () => {
    const p = labProfile(t, byId('campUpgrades'));
    const av = campAvailable(p);
    expect(av.length).toBeGreaterThanOrEqual(2);
    expect(CAMP_UPGRADE_IDS.filter((id) => !av.includes(id)).length).toBeGreaterThanOrEqual(1);
    expect(p.coins).toBeGreaterThanOrEqual(av.reduce((a, id) => a + CAMP_UPGRADES[id].cost, 0));
  });

  it('hero select: several heroes at different stars, some locked', () => {
    const p = labProfile(t, byId('heroSelect'));
    const owned = ownedHeroes(p);
    expect(owned.length).toBeGreaterThanOrEqual(4);
    expect(new Set(owned.map((id) => p.heroes[id].stars)).size).toBeGreaterThanOrEqual(3);
    expect(HERO_IDS.length - owned.length).toBeGreaterThanOrEqual(2);
  });

  it('companion pairs come along together (the Perch)', () => {
    for (const s of LAB_SCENARIOS.filter((x) => x.group === 'companions')) {
      const p = labProfile(t, s);
      expect(p.camp).toContain('perch');
      expect(petBuilds(p, t).map((b) => b.id), s.id).toEqual(s.setup.kind === 'fight' ? s.setup.pets : []);
    }
    const p = labProfile(t, byId('companions'));
    expect(p.camp).toContain('perch');
    expect(COMPANION_IDS.filter((id) => p.pets[id].owned).length).toBeGreaterThanOrEqual(4);
  });
});

describe('Test lab scenarios play', () => {
  it('every fight starts as a practice fight with its hero, foes, rules and banked stacks, pays nothing, and ends at the lab camp', () => {
    for (const s of fights) {
      const p = labProfile(t, s);
      const coins = p.coins;
      const r = new Run(t, { ...DEFAULT_SETTINGS }, 5, p);
      startLabScenario(r, s, 11);
      const f = labFight(s)!;
      expect(r.phase, s.id).toBe('fight');
      expect(labHomePhase(s)).toBe('fight');
      expect(r.practice, s.id).not.toBeNull();
      const c = r.combat!;
      expect(r.hero.build?.id, s.id).toBe(f.hero);
      if (f.stars) expect(r.hero.build?.stars, s.id).toBe(f.stars);
      expect(c.waves.map((w) => w.slice()), s.id).toEqual(f.waves);
      expect(c.stacks, s.id).toBe(Math.min(f.stacks, c.maxStacks()));
      expect(c.practice, s.id).toBe(f.safe);
      const hp0 = r.hero.hp;
      for (let k = 0; k < 8; k++) c.advanceTo(c.time + 1);
      r.sync();
      if (f.safe) expect(r.hero.hp, s.id).toBe(hp0);
      expect(p.coins, s.id).toBe(coins);
      r.endPractice(false);
      expect(r.phase, s.id).toBe('camp');
    }
  });

  it('story scenarios play their scenes in order; camp scenarios stand at the camp', () => {
    for (const s of LAB_SCENARIOS) {
      if (s.setup.kind === 'fight') continue;
      const r = new Run(t, { ...DEFAULT_SETTINGS }, 5, labProfile(t, s));
      startLabScenario(r, s, 3);
      if (s.setup.kind === 'story') {
        expect(r.phase, s.id).toBe('scene');
        expect(r.sceneQueue, s.id).toEqual(s.setup.scenes);
        expect(r.actIndex).toBe(s.setup.act);
      } else expect(r.phase, s.id).toBe('camp');
      expect(labHomePhase(s)).toBe(r.phase);
    }
  });
});

describe("Test lab hero fights are long enough to feel the kit (playtest round 5: the old ones were over too fast)", () => {
  // the 85% bot plays each hero's lab fight: it lasts a good while and is nearly always won (a practice, not a test)
  for (const s of LAB_NEW.filter((x) => x.group === 'heroes' && x.setup.kind === 'fight')) {
    it(s.id, () => {
      let won = 0;
      let sec = 0;
      const N = 10;
      for (let r = 0; r < N; r++) {
        const run = new Run(t, { ...DEFAULT_SETTINGS }, 100 + r, labProfile(t, s));
        startLabScenario(run, s, 1000 + r);
        const st = fight(run, run.combat!, new Rng(5000 + r), { accuracy: 0.85, seed: 5000 + r });
        if (st.won) won++;
        sec += st.seconds;
      }
      expect(sec / N, 'seconds').toBeGreaterThanOrEqual(22);
      expect(won / N, 'won').toBeGreaterThanOrEqual(0.8);
    });
  }
});

describe('Test lab ratings and report', () => {
  it('ratings: rated, read back, junk dropped', () => {
    const st = newLabState();
    rateScenario(st, 'sable', 'good', '  felt   great ', 5);
    rateScenario(st, 'barIce', 'broken', '', 6);
    rateScenario(st, 'sable', 'work', 'dash too fast', 7);
    const back = readLabState(JSON.parse(JSON.stringify({ ...st, ratings: { ...st.ratings, junk: { rating: 'meh' } } })));
    expect(back.ratings.sable).toEqual({ rating: 'work', note: 'dash too fast', at: 7 });
    expect(back.ratings.barIce.rating).toBe('broken');
    expect(back.ratings.junk).toBeUndefined();
    expect(readLabState({ spoilers: true }).spoilers).toBe(true);
  });

  it('the report has every rating and note, the accuracy line and the build; hidden spoilers stay out unless rated', () => {
    const st = newLabState();
    rateScenario(st, 'sable', 'good', 'dash feels great', 1, byId('sable').rev ?? 0);
    rateScenario(st, 'barHolds', 'work', 'release is strict', 2, byId('barHolds').rev ?? 0);
    const out = labReport({ state: st, accuracy: 'CQ3 accuracy Oct 6: 84% from 200 taps', build: 'abc1234 10-06 07:00' });
    expect(out).toContain('Version abc1234 10-06 07:00');
    expect(out).toContain('- Sable: Good - "dash feels great"');
    expect(out).toContain('- Hold blocks: Needs work - "release is strict"');
    expect(out).toContain('- Neve: not tried');
    expect(out).toContain('CQ3 accuracy Oct 6: 84% from 200 taps');
    expect(out).toContain('Rated 2 of');
    for (const s of LAB_SCENARIOS.filter((x) => x.spoiler)) expect(out).not.toContain(`[spoiler] ${s.label}`);
    expect(out).toMatch(/spoiler items hidden/);
    rateScenario(st, 'spBoss6', 'broken', 'phase 3 too long');
    expect(labReport({ state: st, accuracy: '', build: 'x' })).toContain('- [spoiler] Act 6 boss: Broken - "phase 3 too long"');
    st.spoilers = true;
    const all = labReport({ state: st, accuracy: '', build: 'x' });
    for (const s of LAB_SCENARIOS) expect(all).toContain(s.label);
  });

  it('a reworked scenario asks again: a rating given to its earlier rev shows as before, not as now', () => {
    const st = newLabState();
    // rated in the last round (no rev), then the fight was reworked (rev 1)
    rateScenario(st, 'moss', 'work', "couldn't tell if the allies helped", 1);
    const moss = byId('moss');
    expect(moss.rev).toBeGreaterThanOrEqual(1);
    expect(ratingOf(st, moss)).toBeUndefined();
    expect(staleRating(st, moss)?.rating).toBe('work');
    const out = labReport({ state: st, accuracy: '', build: 'x' });
    expect(out).toContain(`- Moss: not tried since the rework (before: Needs work - "couldn't tell if the allies helped")`);
    expect(out).toContain('Rated 0 of');
    // rated again now: it counts, and the rev survives a save and a load
    rateScenario(st, 'moss', 'good', 'allies show', 2, moss.rev);
    const back = readLabState(JSON.parse(JSON.stringify(st)));
    expect(ratingOf(back, moss)?.rating).toBe('good');
    expect(staleRating(back, moss)).toBeUndefined();
    expect(labReport({ state: back, accuracy: '', build: 'x' })).toContain('- Moss: Good - "allies show"');
    // an unreworked scenario rated with no rev still counts
    const plain = LAB_SCENARIOS.find((x) => !x.rev && !x.spoiler)!;
    rateScenario(back, plain.id, 'good', '', 3);
    expect(ratingOf(back, plain)?.rating).toBe('good');
  });
});

describe('Test lab storage: its own keys, never the real ones', () => {
  let store: Map<string, string>;
  const g = globalThis as unknown as { window?: unknown };
  beforeEach(() => {
    store = new Map();
    g.window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
      },
    };
  });
  afterEach(() => {
    setStorageSlot('main');
    delete g.window;
  });

  it('the lab and the real game use separate profile and run keys, and the ratings a third', () => {
    const main = storageKeys('main');
    const lab = storageKeys('lab');
    expect(new Set([main.profile, main.run, lab.profile, lab.run, LAB_STATE_KEY]).size).toBe(5);
    expect(lab.profile.startsWith('cq3.lab.')).toBe(true);
    expect(lab.run.startsWith('cq3.lab.')).toBe(true);
    expect(storageSlot()).toBe('main');
  });

  it('while the lab is on, writes and reads go to the lab keys only; switching back finds the real save untouched', () => {
    // the real game: a profile and a run in progress
    const real = newProfile();
    real.coins = 1234;
    real.actsCleared = 2;
    const realRun = new Run(t, { ...DEFAULT_SETTINGS }, 9, real);
    realRun.startAct(1);
    writeProfile(real);
    writeRunSave(snapshotRun(realRun)!);
    const before = new Map(store);

    setStorageSlot('lab');
    expect(storageSlot()).toBe('lab');
    // nothing of the real game shows through: a lab without a save reads as new
    expect(loadProfile(t).coins).toBe(0);
    expect(loadRunSave(t, newProfile())).toBeNull();
    const s = byId('shrine');
    const lp = labProfile(t, s);
    const lr = new Run(t, { ...DEFAULT_SETTINGS }, 4, lp);
    startLabScenario(lr, byId('sable'), 2);
    writeProfile(lp);
    writeRunSave(snapshotRun(lr)!);
    expect(loadProfile(t).gems).toBe(lp.gems);
    clearRunSave();
    writeLabState({ ratings: { sable: { rating: 'good', note: '', at: 1 } }, spoilers: false });
    // the real keys hold exactly what they held
    for (const [k, v] of before) expect(store.get(k), k).toBe(v);
    expect(store.has(storageKeys('lab').profile)).toBe(true);
    expect(store.has(storageKeys('lab').run)).toBe(false); // cleared, and only the lab's
    expect(store.has(storageKeys('main').run)).toBe(true);

    setStorageSlot('main');
    expect(loadProfile(t).coins).toBe(1234);
    expect(loadRunSave(t, loadProfile(t))).not.toBeNull();
    // the ratings live apart from both saves and survive the switch
    expect(readLabState(loadLabState()).ratings.sable.rating).toBe('good');
  });
});
