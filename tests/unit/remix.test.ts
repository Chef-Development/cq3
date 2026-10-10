// The Mapmaker's revisions (New Game+, SPOILERS: docs/content-bible.md section 9): a restored region's boss comes
// back redrawn, with one more phase that brings a later region's bar rule. Offered only once the region is restored,
// fought from the world map like a skirmish (in the boss's lair, at the numbers of the furthest act reached), the
// first win pays gems and a hero chest; and for a typical player who has just restored the region it is a real step
// up from the boss they beat, and the masher doesn't beat it.
import { describe, expect, it } from 'vitest';
import { fight, playRun, TYPICAL_ACCURACY } from '../../src/core/bot';
import { newProfile } from '../../src/core/profile';
import { Rng } from '../../src/core/rng';
import { Run } from '../../src/core/run';
import { cloneTuning, DEFAULT_SETTINGS } from '../../src/core/tuning';
import { ENEMIES } from '../../src/data/enemies';
import { REGIONS, regionStart } from '../../src/data/regions';
import { REMIXES } from '../../src/data/remixes';

const t = cloneTuning();
const phasesOf = (key: string) => Math.max(1, ...ENEMIES[key].specials.flatMap((s) => s.actions.filter((a) => a.type === 'phase').map((a) => (a as { phase: number }).phase)));
const LATER = ['darken', 'snuff', 'tide', 'toDrift', 'toLink', 'driftShift'];

describe("the Mapmaker's revisions: data", () => {
  it("each revises its region's boss: a boss with the same moves and one more phase, which brings a later region's bar rule", () => {
    expect(REMIXES.length).toBeGreaterThan(0);
    for (const rx of REMIXES) {
      const r = REGIONS.findIndex((x) => x.id === rx.region);
      expect(r, rx.id).toBeGreaterThanOrEqual(0);
      const boss = REGIONS[r].acts.at(-1)!.boss;
      expect(boss, rx.id).toContain(rx.of);
      const e = ENEMIES[rx.id];
      expect(e?.boss, rx.id).toBe(true);
      expect(phasesOf(rx.id), rx.id).toBe(phasesOf(rx.of) + 1);
      const last = e.specials.filter((s) => s.actions.some((a) => a.type === 'phase' && a.phase === phasesOf(rx.id)));
      const acts = last.flatMap((s) => s.actions.map((a) => a.type));
      const rules = last.flatMap((s) => s.actions).some((a) => LATER.includes(a.type) || (a.type === 'barRule' && !!(a.darkEvery || a.driftEvery || a.linkEvery)));
      expect(acts.length > 1 && rules, `${rx.id}: its last phase brings a later rule`).toBe(true);
      // the original's moves are all still there
      for (const s of ENEMIES[rx.of].specials) expect(e.specials.some((x) => x.id === s.id), `${rx.id} keeps ${s.id}`).toBe(true);
    }
  });
});

describe("the Mapmaker's revisions: the run", () => {
  const atWorld = (actsCleared: number, weights: number) => {
    const p = newProfile();
    p.actsCleared = actsCleared;
    p.weights = weights;
    const run = new Run(t, { ...DEFAULT_SETTINGS }, 7, p);
    run.phase = 'world';
    return run;
  };

  it('is offered only once its region is restored, and fights the revised boss in its lair at the furthest act', () => {
    const before = atWorld(3, 0);
    expect(before.remixFor(0)).toBe(null);
    expect(before.startRemix(0)).toBe(false);
    const run = atWorld(5, 1);
    const rx = run.remixFor(0)!;
    expect(rx.id).toBe('boarKingRevised');
    expect(run.startRemix(0)).toBe(true);
    expect(run.phase).toBe('fight');
    expect(run.combat!.enemies.map((e) => e.key)).toEqual([rx.id]);
    expect(run.actIndex).toBe(4); // the furthest act reached (5 cleared: act 5, index 4)
    expect(run.theme).toBe(REGIONS[0].acts[2].theme); // the Boar King's own lair
    const scale = t.acts[4];
    expect(run.combat!.enemies[0].maxHp).toBe(Math.round(ENEMIES[rx.id].hp * scale.hpMult * t.remix.hpMult));
  });

  it('a win pays gems and a hero chest the first time, gear and XP every time; a loss goes back to the world map', () => {
    const run = atWorld(3, 1);
    const gems = run.profile.gems;
    const chests = run.profile.chests.hero;
    run.startRemix(0);
    const c = run.combat!;
    for (const e of c.enemies) e.hp = 0;
    c.result = 'won';
    run.sync();
    expect(run.profile.gems).toBeGreaterThan(gems);
    expect(run.profile.chests.hero).toBe(chests + 1);
    expect(run.remixBeaten('boarKingRevised')).toBe(true);
    expect(run.loot.length).toBe(t.remix.items);
    for (const it of run.loot) expect(['rare', 'epic', 'legendary', 'mythic']).toContain(it.rarity);
    // again: no more gems or chest
    run.phase = 'world';
    run.skirmish && (run.skirmish = null);
    const g2 = run.profile.gems;
    run.startRemix(0);
    run.combat!.result = 'won';
    run.sync();
    expect(run.profile.gems).toBe(g2);
    expect(run.profile.chests.hero).toBe(chests + 1);
    // lost: back to the world map, the run as it was
    const lost = atWorld(3, 1);
    lost.startRemix(0);
    lost.combat!.result = 'lost';
    lost.sync();
    expect(lost.phase).toBe('world');
    expect(lost.skirmish).toBe(null);
  });
});

describe("the Mapmaker's revisions: a real step up (a typical 75% player who has just restored the first region)", () => {
  const N = 12;
  const rows = Array.from({ length: N }, (_, k) => {
    const seed = (9100 + k * 7919) >>> 0;
    const p = newProfile();
    const st = playRun(t, { accuracy: TYPICAL_ACCURACY, seed }, 6, regionStart(1), p);
    const boss = st.acts[2]?.attempts[0]?.fights.find((f) => f.type === 'boss');
    if (!st.acts[2]?.cleared) return null;
    p.weights = Math.max(p.weights, 1);
    const play = (mash: boolean) => {
      const run = new Run(t, { ...DEFAULT_SETTINGS }, seed + 1, JSON.parse(JSON.stringify(p)));
      run.phase = 'world';
      run.startRemix(0);
      return fight(run, run.combat!, new Rng(seed + 2), { accuracy: TYPICAL_ACCURACY, seed: seed + 2, mashFrom: mash ? 0 : undefined });
    };
    return { boss: !!boss?.won, aimed: play(false), mashed: play(true) };
  }).filter((x) => !!x);

  it('most runs restore the region first', () => {
    expect(rows.length).toBeGreaterThanOrEqual(Math.ceil(N * 0.6));
  });

  it("is won less often than the boss's first fight was, but it can be won", () => {
    const won = rows.filter((x) => x.aimed.won).length / rows.length;
    const orig = rows.filter((x) => x.boss).length / rows.length;
    expect(won).toBeGreaterThanOrEqual(0.15);
    expect(won).toBeLessThan(orig);
    expect(won).toBeLessThanOrEqual(0.75);
  });

  it('the masher never beats it', () => {
    expect(rows.filter((x) => x.mashed.won).length).toBe(0);
  });
});
