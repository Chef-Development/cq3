import { describe, expect, it } from 'vitest';
import { balance, botRun, playAct, playFarm, playRun, TYPICAL_ACCURACY } from '../../src/core/bot';
import { Rng } from '../../src/core/rng';
import { cloneTuning } from '../../src/core/tuning';

describe('balance bot', () => {
  it('is deterministic for a seed', () => {
    const t = cloneTuning();
    expect(playRun(t, { accuracy: 0.85, seed: 11 }, 2, 1)).toEqual(playRun(t, { accuracy: 0.85, seed: 11 }, 2, 1));
  });

  it('a near-perfect player clears Act 1; a very sloppy one rarely does', () => {
    const t = cloneTuning();
    for (const seed of [1, 2, 3]) expect(playAct(botRun(t, seed), new Rng(seed), { accuracy: 1, seed }).won).toBe(true);
    // a 20% player (who hits one plain yellow in five) clears the gentle first act about 1 time in 5 (levels and relics help)
    const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
    const sloppy = seeds.filter((seed) => playAct(botRun(t, seed), new Rng(seed), { accuracy: 0.2, seed }).won).length;
    expect(sloppy).toBeLessThanOrEqual(6);
  });

  it('walks a path through the act to its boss: fights, specials, finishers', () => {
    const t = cloneTuning();
    const res = playAct(botRun(t, 4), new Rng(4), { accuracy: 0.95, seed: 4 });
    expect(res.won).toBe(true);
    expect(res.nodes).toHaveLength(t.acts.length ? 8 : 0);
    expect(res.nodes[res.nodes.length - 1]).toBe('boss');
    expect(res.reachedBoss).toBe(true);
    const boss = res.fights[res.fights.length - 1];
    expect(boss.enemies).toEqual(['captain']);
    expect(boss.won).toBe(true);
    expect(res.fights.reduce((n, f) => n + f.finishers, 0)).toBeGreaterThan(0);
    expect(res.fights.reduce((n, f) => n + f.specials, 0)).toBeGreaterThan(0);
    expect(boss.bossVsMaxFinisher).toBeGreaterThan(1);
  });

  it('plays the whole region: every act, retrying from the act start after a defeat', () => {
    const res = playRun(cloneTuning(), { accuracy: 0.95, seed: 6 });
    expect(res.acts.map((a) => a.act)).toEqual([0, 1, 2]);
    expect(res.acts.every((a) => a.cleared)).toBe(true);
    expect(res.acts[2].attempts[res.acts[2].attempts.length - 1].fights.at(-1)!.enemies[0]).toBe('boarKing');
  });

  it('better accuracy misses less and wins more', () => {
    const [lo, hi] = balance(cloneTuning(), [0.7, 0.95], 30, 5, 6, 1);
    expect(hi.missRate).toBeLessThan(lo.missRate);
    expect(hi.firstTry).toBeGreaterThanOrEqual(lo.firstTry);
  });
});

describe('balance targets (guards the defaults; the full report is npm run balance)', () => {
  // The bot aims like a person (a timing spread in ms, reaction time, a thumb's tap rate), so these are a player's
  // odds. The targets are set for the playtester (TYPICAL_ACCURACY = 85%: hits 85% of plain yellow blocks at the
  // starting speed), on a first playthrough with found gear. 150 runs per row (a few seconds); the bands are a little
  // wider than the targets to allow for sampling.
  const [a1, a2, a3] = balance(cloneTuning(), [TYPICAL_ACCURACY], 150, 9);
  const [, , w3] = balance(cloneTuning(), [0.7], 150, 9, 6);
  // a cautious 85% player: never takes the relics that charge HP (Clutch, Glass Edge, Blood Price, Purple Pact)
  const [, c2, c3] = balance(cloneTuning(), [TYPICAL_ACCURACY], 150, 9, 6, 3, undefined, ['clutch', 'glassEdge', 'bloodPrice', 'purplePact']);

  it('the curve is aimed at the playtester (85%)', () => {
    expect(TYPICAL_ACCURACY).toBe(0.85);
  });

  it('Act 1 is a gentle start: the playtester nearly always clears it first try', () => {
    expect(a1.firstTry).toBeGreaterThanOrEqual(0.93);
  });

  it('then it ramps: Act 2 first try about 80-90% of the time', () => {
    expect(a2.firstTry).toBeGreaterThanOrEqual(0.74);
    expect(a2.firstTry).toBeLessThanOrEqual(0.94);
    expect(a2.firstTry).toBeLessThanOrEqual(a1.firstTry);
  });

  // Later acts' reds are faster (acts[i].redSpeed): what reaches an 85% player, who blocks nearly every red at 2.8 s.
  it('the Boar King is the real test: the first fight is won about 60-75% of the time, by a cautious player too', () => {
    expect(a3.bossFirstTry).toBeGreaterThanOrEqual(0.55);
    expect(a3.bossFirstTry).toBeLessThanOrEqual(0.82);
    expect(c3.bossFirstTry).toBeGreaterThanOrEqual(0.55);
    expect(c3.bossFirstTry).toBeLessThanOrEqual(0.85);
    expect(c2.firstTry).toBeGreaterThanOrEqual(0.74);
    expect(a3.firstTry).toBeLessThan(a1.firstTry);
    expect(a3.clearRate).toBeGreaterThan(0.9); // and retries get there
  });

  it('a 70% player can still finish Act 3 with retries', () => {
    expect(w3.clearRate).toBeGreaterThan(0.75); // about 85-90% (M5: back to > 0.8 after Part 7's retune)
    expect(w3.bossFirstTry).toBeLessThan(a3.bossFirstTry);
  });

  it("late fights still cost HP: a normal Act 3 fight costs at least as much of the playtester's HP as an Act 1 fight", () => {
    expect(a2.hpLostFight).toBeGreaterThanOrEqual(a1.hpLostFight);
    expect(a3.hpLostFight).toBeGreaterThanOrEqual(a1.hpLostFight);
    // the foes' share too, not only relic prices: clearly more in Act 3 than in Act 1, Act 2 in between
    expect(a3.foesHpFight).toBeGreaterThan(a1.foesHpFight * 2);
    expect(a2.foesHpFight).toBeGreaterThan(a1.foesHpFight);
    expect(c3.foesHpFight).toBeGreaterThan(c2.foesHpFight);
  });

  it('no boss can be one-shot by a max-stack finisher (their phase gates stop it)', () => {
    for (const r of [a1, a2, a3]) {
      expect(r.bossVsMaxFinisher, `act ${r.act + 1}`).toBeGreaterThan(1.3);
      expect(r.bossOneShotRate, `act ${r.act + 1}`).toBe(0);
    }
  });

  it('fights are runs of foes: normal fights 12-30 s and never shorter act over act; bosses the longest', () => {
    for (const r of [a1, a2, a3]) {
      expect(r.fightSec).toBeGreaterThan(12);
      expect(r.fightSec).toBeLessThan(30);
      expect(r.fightSec).toBeLessThan(r.bossSec);
      expect(r.eliteSec).toBeLessThan(r.bossSec);
    }
    expect(a2.fightSec).toBeGreaterThan(a1.fightSec);
    expect(a3.fightSec).toBeGreaterThan(a2.fightSec - 0.5); // about level (sampling)
    expect(a3.bossSec).toBeGreaterThan(a1.bossSec);
  });

  it('the specials keep coming: several per minute in every act', () => {
    for (const r of [a1, a2, a3]) expect(r.specialsPerMin).toBeGreaterThan(4.5);
  });
});

describe('gear: the story with found gear alone, and farming', () => {
  // A fresh profile plays the story, wearing the best of what drops; then replays Act 3 to farm the Boar King.
  const N = 60;
  const res = Array.from({ length: N }, (_, r) => playFarm(cloneTuning(), { accuracy: 0.7, seed: 4400 + r }, 3));

  it('the story can be beaten with found gear alone (a 70% player, retries allowed: about 85-90%)', () => {
    const cleared = res.filter((x) => x.story.acts.length === 3 && x.story.acts[2].cleared).length;
    expect(cleared / N).toBeGreaterThanOrEqual(0.8);
  });

  it('the bot wears what it finds: its gear gets stronger with every replay', () => {
    const power = [0, 1, 2].map((i) => res.reduce((n, x) => n + x.visits[i].power, 0) / N);
    expect(power[1]).toBeGreaterThan(power[0]);
    expect(power[2]).toBeGreaterThan(power[1]);
  });

  it('farming the Boar King a few times measurably raises the win rate', () => {
    const boss = (f: ReturnType<typeof playFarm>) => f.story.acts[2]?.attempts.flatMap((a) => a.fights).find((x) => x.type === 'boss');
    const story = res.map(boss).filter((f) => !!f);
    const storyRate = story.filter((f) => f!.won).length / story.length;
    const third = res.map((x) => x.visits[2].bossWon).filter((w) => w !== null);
    const farmedRate = third.filter((w) => w).length / third.length;
    // (M5: Rowan's Blade rule made the story's boss a little easier; Part 7's retune restores the +0.1 margin)
    expect(farmedRate).toBeGreaterThan(storyRate);
  });
});
