// The finisher show's plan (core/finisher-show.ts; playtest round 7: every hero's finisher their own): every hero has a
// style kit and a signature moment (their own, or their style's default), the rarity scaler grows with the tier, and
// every show fits the envelope the core holds the cursor for. Plus the Test lab's Finisher gallery (core/lab.ts):
// every hero, on demand, and nothing ever dies, hurts or is saved.
import { describe, expect, it } from 'vitest';
import {
  FLURRY_END,
  HERO_SIGNATURE,
  moveOf,
  rarityOf,
  showScale,
  showTimeline,
  signatureOf,
  SIGNATURES,
  STYLE_DEFAULT,
  STYLE_SHOW,
  styleOf,
  type ShowMove,
  type SignatureId,
} from '../../src/core/finisher-show';
import { FINISHER_BLOW_AT, finisherShowMs, finisherStrikeAt, finisherStrikes } from '../../src/core/impact';
import { galleryArm, galleryFight, galleryHeroes, galleryRest, labHomePhase, labProfile, startLabScenario } from '../../src/core/lab';
import { Run } from '../../src/core/run';
import { cloneTuning, DEFAULT_SETTINGS } from '../../src/core/tuning';
import { ENEMIES } from '../../src/data/enemies';
import { HERO_IDS, HEROES, STYLE_IDS } from '../../src/data/heroes';
import { LAB_SCENARIOS as LAB_NEW, type LabScenario } from '../../src/data/lab';
import { TIERS, type Tier } from '../../src/data/rarity';

const MOVES: ShowMove[] = ['dash', 'leap', 'blink', 'guard', 'stand'];
/** The tiers a hero can be, in order. */
const HERO_TIERS: Tier[] = ['rare', 'epic', 'legendary', 'mythic', 'celestial', 'divine'];

describe('finisher shows: a style kit and a signature moment for every hero', () => {
  it('every style has a kit (a way to move, its pieces) and a default moment of its own', () => {
    for (const st of STYLE_IDS) {
      expect(MOVES, st).toContain(STYLE_SHOW[st].move);
      expect(STYLE_SHOW[st].pieces.length, st).toBeGreaterThan(10);
      const d = STYLE_DEFAULT[st];
      expect(SIGNATURES[d].styleDefault, st).toBe(st);
    }
    expect(new Set(Object.values(STYLE_DEFAULT)).size).toBe(STYLE_IDS.length);
  });

  it('every hero has a style kit and a signature moment that is theirs alone (never another hero\'s or a default)', () => {
    const seen = new Map<SignatureId, string>();
    for (const id of HERO_IDS) {
      expect(styleOf(id), id).toBe(HEROES[id].style);
      expect(STYLE_SHOW[styleOf(id)], id).toBeDefined();
      const sig = signatureOf(id);
      expect(SIGNATURES[sig], id).toBeDefined();
      expect(HERO_SIGNATURE[id], `${id} has a moment of their own`).toBe(sig);
      expect(SIGNATURES[sig].styleDefault, id).toBeUndefined();
      expect(seen.has(sig), `${id} shares ${sig} with ${seen.get(sig)}`).toBe(false);
      seen.set(sig, id);
      expect(MOVES, id).toContain(moveOf(id));
    }
    // (every hero named there is real)
    for (const id of Object.keys(HERO_SIGNATURE)) expect(HERO_IDS as string[], id).toContain(id);
  });

  it("a hero without a moment of their own yet plays their style's default, and nothing breaks for an unknown one", () => {
    // (a later hero of each style, before their moment is written)
    for (const st of STYLE_IDS) expect(SIGNATURES[STYLE_DEFAULT[st]].styleDefault).toBe(st);
    expect(signatureOf('someNewHero')).toBe(STYLE_DEFAULT.blade);
    expect(styleOf('someNewHero')).toBe('blade');
    expect(rarityOf('someNewHero')).toBe('rare');
    expect(MOVES).toContain(moveOf('someNewHero'));
    expect(showTimeline(rarityOf('someNewHero'), 3).strikes.length).toBe(finisherStrikes(3));
  });
});

describe('finisher shows: the rarity scaler', () => {
  it('grows with the tier: a longer build-up, more layers, a bigger flash, shake, vignette and sky', () => {
    for (let i = 1; i < TIERS.length; i++) {
      const a = showScale(TIERS[i - 1]);
      const b = showScale(TIERS[i]);
      for (const k of ['buildUp', 'layers', 'flashMs', 'shake', 'vignette', 'sky', 'skyFx'] as const) expect(b[k], `${TIERS[i]} ${k}`).toBeGreaterThanOrEqual(a[k]);
      expect(b.rank).toBe(a.rank + 1);
    }
    // a hero's tiers: each step adds build-up, a layer and flash
    for (let i = 1; i < HERO_TIERS.length; i++) {
      const a = showScale(HERO_TIERS[i - 1]);
      const b = showScale(HERO_TIERS[i]);
      expect(b.buildUp, HERO_TIERS[i]).toBeGreaterThan(a.buildUp);
      expect(b.layers, HERO_TIERS[i]).toBeGreaterThan(a.layers);
      expect(b.flashMs, HERO_TIERS[i]).toBeGreaterThan(a.flashMs);
    }
    // the top two tiers bring their own sparkle (stars, a prism); Mythic and below none
    expect(showScale('celestial').sparkle).toBe('stars');
    expect(showScale('divine').sparkle).toBe('prism');
    for (const t of ['rare', 'epic', 'legendary', 'mythic'] as Tier[]) expect(showScale(t).sparkle).toBe('none');
  });
});

describe('finisher shows: inside the envelope', () => {
  it('every show lasts finisherShowMs(stacks) (under 1.5 s at max), its strikes inside it, the last blow at FINISHER_BLOW_AT', () => {
    expect(finisherShowMs(5)).toBeLessThanOrEqual(1500);
    for (const tier of TIERS)
      for (let stacks = 1; stacks <= 7; stacks++) {
        const tl = showTimeline(tier, stacks);
        const n = Math.min(5, stacks);
        expect(tl.n).toBe(n);
        expect(tl.ms, `${tier} x${stacks}`).toBe(finisherShowMs(stacks));
        expect(tl.ms).toBeLessThanOrEqual(1500);
        expect(tl.strikes.length, `${tier} x${stacks}`).toBe(finisherStrikes(n));
        expect(tl.build).toBeCloseTo(showScale(tier).buildUp);
        expect(tl.strikes[0]).toBeCloseTo(tl.build);
        expect(tl.strikes.at(-1)!).toBeCloseTo(FLURRY_END);
        for (let i = 1; i < tl.strikes.length; i++) expect(tl.strikes[i]).toBeGreaterThan(tl.strikes[i - 1]);
        expect(tl.blow).toBe(FINISHER_BLOW_AT);
        expect(tl.blow).toBeGreaterThan(tl.strikes.at(-1)!);
        expect(tl.back).toBeGreaterThan(tl.blow);
        expect(tl.back).toBeLessThan(1);
      }
  });

  it("an Epic show strikes exactly on the core's own strike times; a rarer one builds up longer and strikes faster", () => {
    for (let stacks = 1; stacks <= 5; stacks++) {
      const tl = showTimeline('epic', stacks);
      tl.strikes.forEach((k, i) => expect(k).toBeCloseTo(finisherStrikeAt(i, tl.strikes.length)));
      const rare = showTimeline('rare', stacks);
      const divine = showTimeline('divine', stacks);
      expect(divine.build).toBeGreaterThan(rare.build);
      expect(divine.strikes[1] - divine.strikes[0]).toBeLessThan(rare.strikes[1] - rare.strikes[0]);
    }
  });
});

describe('the Test lab: Finisher gallery', () => {
  const t = cloneTuning();
  const gallery = LAB_NEW.find((s) => s.setup.kind === 'gallery') as LabScenario;

  it('is in the New section, with the heroes, offering every hero there is (a new hero shows up by itself)', () => {
    expect(gallery).toBeDefined();
    expect(gallery.group).toBe('heroes');
    expect(galleryHeroes()).toEqual(HERO_IDS);
    expect(labHomePhase(gallery)).toBe('fight');
    if (gallery.setup.kind !== 'gallery') return;
    expect(gallery.setup.foes.length).toBeGreaterThanOrEqual(2);
    for (const k of gallery.setup.foes) expect(ENEMIES[k], k).toBeDefined();
    const p = labProfile(t, gallery);
    for (const id of HERO_IDS) expect(p.heroes[id].unlocked, id).toBe(true);
  });

  it('plays every hero at every stack count: the real finisher fires, nobody dies, nothing hurts, no coins, healed after', () => {
    const p = labProfile(t, gallery);
    const coins = p.coins;
    const run = new Run(t, { ...DEFAULT_SETTINGS }, 5, p);
    startLabScenario(run, gallery, 7);
    expect(run.phase).toBe('fight');
    expect(run.practice).not.toBeNull();
    for (const id of galleryHeroes()) {
      galleryFight(run, gallery, id, 9);
      const c = run.combat!;
      expect(run.hero.build?.id, id).toBe(id);
      expect(c.practice, id).toBe(true);
      expect(c.spawning, id).toBe(false);
      expect(c.blocks.length, id).toBe(0);
      const hp0 = run.hero.hp;
      for (let stacks = 1; stacks <= c.maxStacks(); stacks++) {
        expect(galleryArm(c, stacks), `${id} x${stacks}`).toBe(true);
        expect(c.blocks.filter((b) => b.kind === 'red').length).toBe(2);
        expect(c.finisher(), `${id} x${stacks}`).toBe(true);
        c.drainEvents();
        expect(
          c.enemies.every((e) => e.alive),
          `${id} x${stacks}: nobody dies`,
        ).toBe(true);
        for (let k = 0; k < 3; k++) c.advanceTo(c.time + 1);
        galleryRest(c);
        expect(c.enemies.every((e) => e.hp === e.maxHp)).toBe(true);
      }
      run.sync();
      expect(run.phase, id).toBe('fight');
      expect(run.hero.hp, id).toBe(hp0);
    }
    expect(p.coins).toBe(coins);
    run.endPractice(false);
    expect(run.phase).toBe('camp');
  });
});
