// Side quests (core/quests.ts): the goal's number, progress from the fights won (Combat.log), done once, and what the
// board on a node posts (only a quest that can still be done from there).
import { describe, expect, it } from 'vitest';
import { setup, timeAt } from './helpers';
import { QUESTS } from '../../src/data/quests';
import { GREENMARCH } from '../../src/data/greenmarch';
import { buildActMap } from '../../src/core/map';
import { newQuest, questFor, questGoal, questProgress, questText, readQuest } from '../../src/core/quests';
import { cloneTuning } from '../../src/core/tuning';
import type { FightLog } from '../../src/core/combat';
import { textWidth } from '../../src/engine/font';

const T = cloneTuning();
const log = (o: Partial<FightLog> = {}): FightLog => ({ blocks: 0, bestCombo: 0, breaks: 0, cleanWaves: 0, kills: 0, hits: 0, holds: 0, bestFinisher: 0, ...o });
const won = (o: Partial<FightLog> = {}, elite = false, hpShare = 0.5) => ({ log: log(o), elite, hpShare });

describe('quests', () => {
  it('each goal reads its number from tuning, in short words', () => {
    expect(questGoal(T, 'blocks')).toBe(T.quests.blocks);
    expect(questGoal(T, 'elite')).toBe(1);
    expect(questText(T, QUESTS.find((q) => q.id === 'blocks')!)).toBe(`Block ${T.quests.blocks} reds`);
    expect(questText(T, QUESTS.find((q) => q.id === 'healthy')!)).toBe(`Win a fight above ${Math.round(T.quests.healthy * 100)}% HP`);
    // the board's notice fits each goal on one bold line beside the big icon (view/stops.ts), and its heading
    for (const q of QUESTS) {
      expect(textWidth(questText(T, q), 1, true), q.id).toBeLessThanOrEqual(190);
      expect(textWidth(q.title, 1, true), q.id).toBeLessThanOrEqual(150);
    }
  });

  it('blocks and kills add up over the fights; the combo counts the best fight; done once, capped', () => {
    const b = newQuest(T, 'blocks');
    expect(questProgress(T, b, won({ blocks: 10 }))).toBe(false);
    expect(b.n).toBe(10);
    expect(questProgress(T, b, won({ blocks: 30 }))).toBe(true);
    expect(b).toMatchObject({ n: b.goal, done: true });
    expect(questProgress(T, b, won({ blocks: 5 }))).toBe(false); // paid once
    const c = newQuest(T, 'combo');
    questProgress(T, c, won({ bestCombo: 12 }));
    questProgress(T, c, won({ bestCombo: 8 }));
    expect(c.n).toBe(12);
    expect(questProgress(T, c, won({ bestCombo: T.quests.combo }))).toBe(true);
    const k = newQuest(T, 'kills');
    questProgress(T, k, won({ kills: 4 }));
    expect(k.n).toBe(4);
  });

  it('an elite won, a fight won with HP to spare, waves cleared without a break', () => {
    const e = newQuest(T, 'elite');
    expect(questProgress(T, e, won({ kills: 3 }))).toBe(false);
    expect(questProgress(T, e, won({}, true))).toBe(true);
    const h = newQuest(T, 'healthy');
    expect(questProgress(T, h, won({}, false, T.quests.healthy - 0.05))).toBe(false);
    expect(questProgress(T, h, won({}, false, T.quests.healthy))).toBe(true);
    const f = newQuest(T, 'flawless');
    questProgress(T, f, won({ cleanWaves: 1 }));
    expect(f.n).toBe(1);
  });

  it('the fight log counts reds blocked, the best combo, breaks, clean waves and kills', () => {
    const { c, t } = setup({ tune: (t) => (t.blocks.redTravelSec = 10000) });
    c.spawnBlock('yellow', 0.2);
    c.spawnBlock('red', 0.5);
    c.advanceTo(0.35);
    c.tap(timeAt(t, 0.2));
    c.advanceTo(0.72);
    c.tap(c.time); // the red: blocked
    expect(c.log).toMatchObject({ blocks: 1, bestCombo: 2, breaks: 0 });
    c.advanceTo(0.9);
    c.tap(c.time); // empty bar: a miss breaks the combo
    expect(c.log).toMatchObject({ bestCombo: 2, breaks: 1 });
    // the wave falls: a break happened in it, so it isn't clean
    c.enemies[0].hp = 1;
    c.stacks = 1;
    c.finisher();
    expect(c.log).toMatchObject({ kills: 1, cleanWaves: 0 });
    const clean = setup();
    clean.c.enemies[0].hp = 1;
    clean.c.stacks = 1;
    clean.c.finisher();
    expect(clean.c.log.cleanWaves).toBe(1);
  });

  it("a board posts a quest that can still be done from its node (no elite quest with no elite ahead)", () => {
    for (let seed = 1; seed < 40; seed++) {
      const map = buildActMap(GREENMARCH.acts[0], seed);
      for (const n of map.nodes) {
        const id = questFor(map, n.id, seed);
        expect(questFor(map, n.id, seed)).toBe(id); // the same board posts the same quest
        if (id !== 'elite') continue;
        const ahead = (x: number): boolean => map.nodes[x].next.some((y) => map.nodes[y].type === 'elite' || ahead(y));
        expect(ahead(n.id)).toBe(true);
      }
    }
  });

  it('reads a saved quest back (an unknown one is dropped; the goal follows the tuning)', () => {
    expect(readQuest(T, { id: 'blocks', n: 7, goal: 99, done: false })).toEqual({ id: 'blocks', n: 7, goal: T.quests.blocks, done: false });
    expect(readQuest(T, { id: 'nope', n: 1 })).toBeNull();
    expect(readQuest(T, null)).toBeNull();
  });
});
