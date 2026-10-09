// Region 4's content (not in play yet; SPOILERS: docs/content-bible.md section 7) is well formed: every foe the acts
// name exists and is the right kind, specials follow the house rules (their reds are fair to a thumb, the dark and the
// water stay inside the thumb rules), the scenes it needs exist (placeholders until the story team's), keys don't
// clash with the earlier regions'. The two bar rules themselves are tested in bar-rules.test.ts.
import { describe, expect, it } from 'vitest';
import { DUSKMIRE, DUSK_FIRST_ACT, DUSK_STAND_IN, DUSK_THEMES } from '../../src/data/duskmire';
import { DUSK_ENEMIES, DUSK_NEW_SOUNDS } from '../../src/data/enemies-dusk';
import { DUSK_STORY } from '../../src/data/story-dusk';
import { DUSK_BANTER, DUSK_SCENE_ACT } from '../../src/data/banter-dusk';
import { DUSK_BASE_ITEMS, DUSK_EFFECTS, DUSK_SETS, DUSK_SIGNATURES } from '../../src/data/gear-dusk';
import { BANTER, HERO_BANTER, type CampSpeaker } from '../../src/data/banter';
import { BASE_ITEMS, EFFECTS, SETS, SLOTS } from '../../src/data/gear';
import { ASHFELL } from '../../src/data/ashfell';
import { ENEMIES } from '../../src/data/enemies';
import { ALL_ACTS } from '../../src/data/regions';
import { SPEAKER_NAME, STORY } from '../../src/data/story';
import type { EnemyDef } from '../../src/data/types';
import { DEFAULT_TUNING } from '../../src/core/tuning';
import { TELL_SOUNDS } from '../../src/engine/audio';
import { textWidth } from '../../src/engine/font';

const STORY_TEXT_W = 256;
const acts = DUSKMIRE.acts;
const all = Object.entries(DUSK_ENEMIES);
const ownKey = (k: string) => !(k in ENEMIES) || ENEMIES[k] === DUSK_ENEMIES[k];

describe('Region 4: the region', () => {
  it('three acts of about 8 rows, after the last region (global acts 9-11): mini-boss, mini-boss, boss', () => {
    expect(DUSKMIRE.id).toBe('duskmire');
    expect(DUSK_FIRST_ACT).toBeGreaterThanOrEqual(ALL_ACTS.length);
    expect(acts.map((a) => a.boss)).toEqual([['bellybog'], ['sluiceKeeper'], ['lighthouse']]);
    expect(acts.map((a) => a.theme)).toEqual(DUSK_THEMES.map((t) => DUSK_STAND_IN[t]));
    for (const a of acts) {
      expect(a.rows + 1, a.name).toBeGreaterThanOrEqual(7);
      expect(a.rows + 1, a.name).toBeLessThanOrEqual(9);
    }
  });

  it('acts get harder act by act, and each above the matching Ashfell act', () => {
    for (let i = 0; i < 3; i++) {
      const ash = ASHFELL.acts[i];
      expect(acts[i].hpMult).toBeGreaterThan(ash.hpMult);
      expect(acts[i].atkMult).toBeGreaterThan(ash.atkMult);
      expect(acts[i].redSpeed).toBeGreaterThan(ash.redSpeed);
      expect(acts[i].redSpeed).toBeLessThanOrEqual(1.5);
      if (i > 0) {
        expect(acts[i].hpMult).toBeGreaterThan(acts[i - 1].hpMult);
        expect(acts[i].atkMult).toBeGreaterThan(acts[i - 1].atkMult);
        expect(acts[i].pace).toBeLessThan(acts[i - 1].pace);
      }
    }
  });

  it('the bar rules come in gradually: dark in Act 1 (row 2), the tide in Act 2 (row 1, a little dark), both in Act 3', () => {
    const [a1, a2, a3] = acts.map((a) => a.bar ?? {});
    expect(a1.dark?.fromRow).toBe(2);
    expect(a1.tide).toBeUndefined();
    expect(a2.tide?.fromRow).toBe(1);
    expect(a2.dark!.share).toBeLessThan(a1.dark!.share);
    expect(a3.dark?.fromRow).toBe(0);
    expect(a3.tide?.fromRow).toBe(0);
    for (const b of [a1, a2, a3]) {
      expect(b.ice ?? b.snow ?? b.holds ?? b.drift ?? b.links, 'no earlier regions\' rules').toBeUndefined();
      if (b.dark) {
        expect(b.dark.share).toBeGreaterThan(0);
        expect(b.dark.share).toBeLessThanOrEqual(0.35);
        expect(b.dark.traps).toBeLessThanOrEqual(0.3);
      }
      if (b.tide) {
        // the water never covers half the bar on its own, and swells slowly enough to see a block about to sink
        expect(b.tide.high).toBeLessThanOrEqual(0.45);
        expect(b.tide.low).toBeLessThan(b.tide.high);
        expect(((b.tide.high - b.tide.low) * Math.PI) / b.tide.period).toBeLessThanOrEqual(DEFAULT_TUNING.tide.swellSpeed + 1e-9);
      }
    }
  });

  it('every encounter names a Region 4 foe (or an earlier act of it); elites are elites, bosses are bosses', () => {
    for (const a of acts) {
      const groups = [...a.fights.early, ...a.fights.late, ...a.elites, a.boss, ...(a.packs ?? []).flat()];
      for (const g of groups) for (const k of g) expect(DUSK_ENEMIES[k], `${a.name}: ${k}`).toBeDefined();
      for (const g of a.elites) expect(g.some((k) => DUSK_ENEMIES[k].elite), a.name).toBe(true);
      expect(a.boss.every((k) => DUSK_ENEMIES[k].boss)).toBe(true);
      for (const g of [...a.fights.early, ...a.fights.late, ...(a.packs ?? []).flat()]) expect(g.some((k) => DUSK_ENEMIES[k].elite || DUSK_ENEMIES[k].boss), a.name).toBe(false);
      expect(a.packs?.length ?? 0, a.name).toBeGreaterThanOrEqual(2);
    }
  });

  it('every scene the region names exists (placeholders until the story team writes them), and none clashes', () => {
    const ids = [DUSKMIRE.victoryScene, 'duskCamp', ...acts.flatMap((a) => [a.startScene, a.bossScene])];
    for (const id of ids) expect(DUSK_STORY[id ?? ''], id).toBeDefined();
    for (const e of Object.values(DUSK_ENEMIES)) for (const id of Object.values(e.phaseScenes ?? {})) expect(DUSK_STORY[id], id).toBeDefined();
    for (const id of Object.keys(DUSK_STORY)) expect(!(id in STORY) || STORY[id] === DUSK_STORY[id], id).toBe(true);
    for (const [id, boxes] of Object.entries(DUSK_STORY)) {
      expect(boxes.length, id).toBeLessThanOrEqual(6);
      for (const b of boxes) {
        expect(b.text.split('\n').length, id).toBeLessThanOrEqual(2);
        for (const l of b.text.split('\n')) expect(textWidth(l, 1, false), `${id}: "${l}"`).toBeLessThanOrEqual(STORY_TEXT_W);
        expect(SPEAKER_NAME[b.who], `${id}: ${b.who}`).toBeDefined();
      }
    }
  });
});

describe('Region 4: the foes', () => {
  it('about ten foes and three elites, two mini-bosses and a boss; no key clashes with an earlier region', () => {
    expect(all.filter(([, e]) => !e.boss && !e.elite).length).toBeGreaterThanOrEqual(8);
    expect(all.filter(([, e]) => e.elite).length).toBe(3);
    expect(all.filter(([, e]) => e.boss).length).toBe(3);
    for (const [k] of all) expect(ownKey(k), k).toBe(true);
    for (const tag of ['folk', 'caster', 'beast', 'swarm', 'armored', 'brute', 'flyer', 'construct'] as const) expect(all.some(([, e]) => e.tags?.includes(tag)), tag).toBe(true);
  });

  it('every special has a 0.6-1.0 s telegraph, a name, a sound (an existing one or a new one to build), something to do; 0-2 moves at a time', () => {
    const sounds = new Set<string>([...TELL_SOUNDS, ...DUSK_NEW_SOUNDS]);
    for (const [key, e] of all) {
      expect(e.specials.length, `${key} changes how the bar plays`).toBeGreaterThan(0);
      for (const ph of [1, 2, 3]) expect(e.specials.filter((s) => !(e.boss && s.gate) && (!s.phases || s.phases.includes(ph))).length, `${key} phase ${ph}`).toBeLessThanOrEqual(2);
      for (const s of e.specials) {
        const name = `${key}.${s.id}`;
        expect(s.tell, name).toBeGreaterThanOrEqual(0.6);
        expect(s.tell, name).toBeLessThanOrEqual(1.0);
        expect(textWidth(s.name, 1, false), name).toBeLessThanOrEqual(90);
        expect(sounds.has(s.sound), `${name}: ${s.sound}`).toBe(true);
        expect(s.actions.length, name).toBeGreaterThan(0);
        expect(s.every !== undefined || s.hpBelow !== undefined, `${name} is timed or HP-triggered`).toBe(true);
      }
    }
  });

  it('the dark and the water stay inside the thumb rules: a dimmed lantern still reaches, a surge is short or a phase\'s, never over half the bar', () => {
    let darks = 0;
    let tides = 0;
    for (const [key, e] of all)
      for (const s of e.specials)
        for (const a of s.actions) {
          const name = `${key}.${s.id}`;
          if (a.type === 'snuff') {
            darks++;
            expect(a.mult, name).toBeGreaterThanOrEqual(0.5);
            if (a.sec === 0) expect(s.gate, `${name}: a lantern dimmed for good is a boss phase's`).toBe(true);
            else expect(a.sec, name).toBeLessThanOrEqual(5);
          }
          if (a.type === 'darken' || (a.type === 'formation' && a.blocks.some((b) => b.dark))) darks++;
          if (a.type === 'formation') for (const b of a.blocks) if (b.dark) expect(['yellow', 'green', 'purple'], name).toContain(b.kind);
          if (a.type === 'tide') {
            tides++;
            expect(a.level, name).toBeLessThanOrEqual(0.5);
            if (a.from === 'both') expect(a.level, `${name}: both ends`).toBeLessThanOrEqual(0.3);
            if (a.sec === 0) expect(s.gate, `${name}: a flood for good is a boss phase's`).toBe(true);
            else expect(a.sec, name).toBeLessThanOrEqual(5);
          }
        }
    expect(darks).toBeGreaterThanOrEqual(6);
    expect(tides).toBeGreaterThanOrEqual(5);
  });

  it('the boss changes the bar in each phase (the mapmaker\'s edits); the mini-bosses and the boss have gates', () => {
    const opens = (e: EnemyDef, ph: number) =>
      e.specials.filter((s) => (s.gate ? s.actions.some((a) => a.type === 'phase' && a.phase === ph) : ph === 1 && !!s.phases?.includes(1))).flatMap((s) => s.actions);
    const boss = DUSK_ENEMIES.lighthouse;
    expect(boss.phaseScenes).toEqual({ 2: 'lighthouse2', 3: 'lighthouse3' });
    for (const ph of [1, 2, 3]) expect(opens(boss, ph).some((a) => ['darken', 'snuff', 'tide', 'barRule'].includes(a.type)), `phase ${ph}`).toBe(true);
    for (const k of ['bellybog', 'sluiceKeeper', 'lighthouse']) expect(DUSK_ENEMIES[k].specials.some((s) => s.gate && s.hpBelow), k).toBe(true);
  });

  it('every red attack is fair to a thumb (the same rules as tests/unit/data.test.ts, at Region 4 red speeds)', () => {
    const T = DEFAULT_TUNING;
    const v = 1.5 / T.cursor.basePassSec;
    const actSpeed = Math.max(...acts.map((a) => a.redSpeed));
    const RED = ['red', 'shield', 'bomb', 'speed'];
    for (const [key, e] of all)
      for (const s of e.specials)
        for (const a of s.actions) {
          if (a.type !== 'formation') continue;
          const reds = a.blocks.filter((b) => RED.includes(b.kind));
          const at = (b: (typeof reds)[number]) => {
            const w = T.blocks.redWidth * (b.width ?? 1) * T.blocks.redWidthMin;
            const vel = ((1 - w) / T.blocks.redTravelSec) * (b.speed ?? 1) * actSpeed;
            return { w, vel, closing: v + vel };
          };
          const name = `${key}.${s.id}`;
          for (const b of reds) {
            expect(b.width ?? 1, `${name}: never thinner than a normal red`).toBeGreaterThanOrEqual(1);
            if ((b.speed ?? 1) > 1.2) expect(b.width ?? 1, `${name}: a fast red is wider`).toBeGreaterThan(1);
            const { w, closing } = at(b);
            expect((w + T.cursor.widthFrac) / closing + (2 * T.judge.redGraceMs) / 1000, `${name}: blocking window`).toBeGreaterThanOrEqual(0.12);
            if (b.still) expect(b.fuse ?? 0, `${name}: a still red's fuse`).toBeGreaterThanOrEqual(1.4);
          }
          for (let i = 0; i < reds.length; i++)
            for (let j = i + 1; j < reds.length; j++) {
              const [p, q] = [reds[i], reds[j]];
              if (p.still || q.still) continue;
              const gap = Math.abs((q.delay ?? 0) - (p.delay ?? 0)) * Math.min(at(p).vel, at(q).vel);
              expect(gap / Math.max(at(p).closing, at(q).closing), `${name}: reds ${i} and ${j} too close`).toBeGreaterThanOrEqual(0.16);
            }
        }
  });
});

describe('Region 4: gear and banter', () => {
  it("gear: unique ids and names new to the game, every slot covered, a set and the boss's two signature Legendaries", () => {
    const ids = DUSK_BASE_ITEMS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    const oldIds = new Set(BASE_ITEMS.map((b) => b.id));
    const oldNames = new Set(BASE_ITEMS.map((b) => b.name));
    const widestName = Math.max(...BASE_ITEMS.map((b) => textWidth(b.name, 1, true)));
    for (const b of DUSK_BASE_ITEMS) {
      expect(oldIds.has(b.id), b.id).toBe(false);
      expect(oldNames.has(b.name), b.name).toBe(false);
      expect([9, 10, 11], b.id).toContain(b.act);
      expect(textWidth(b.name, 1, true), b.name).toBeLessThanOrEqual(widestName);
    }
    const plain = DUSK_BASE_ITEMS.filter((b) => !b.set && !b.signature);
    expect(plain.length).toBeGreaterThanOrEqual(10);
    for (const slot of SLOTS) expect(plain.some((b) => b.slot === slot), slot).toBe(true);
    for (const [id, set] of Object.entries(DUSK_SETS)) {
      expect(id in SETS, id).toBe(false);
      const pieces = set.pieces.map((p) => DUSK_BASE_ITEMS.find((b) => b.id === p));
      for (const [i, p] of pieces.entries()) expect(p?.set, set.pieces[i]).toBe(id);
      expect(new Set(pieces.map((p) => p?.slot)).size).toBe(pieces.length);
    }
    const widestEffect = Math.max(...Object.values(EFFECTS).map((e) => textWidth(e.text, 1, false)));
    for (const [id, e] of Object.entries(DUSK_EFFECTS)) {
      expect(id in EFFECTS, id).toBe(false);
      expect(textWidth(e.text, 1, false), e.text).toBeLessThanOrEqual(widestEffect);
    }
    for (const [boss, items] of Object.entries(DUSK_SIGNATURES)) {
      expect(DUSK_ENEMIES[boss]?.boss, boss).toBe(true);
      expect(items).toHaveLength(2);
      for (const it of items) {
        const b = DUSK_BASE_ITEMS.find((x) => x.id === it);
        expect(b?.signature?.boss, it).toBe(boss);
        expect(DUSK_EFFECTS[b!.signature!.effect]).toBeDefined();
      }
    }
  });

  it('banter lines fit the bubble, are new, wait for a Region 4 scene, and need whoever they name', () => {
    const BUBBLE_W = 104;
    const wrap = (s: string): string[] => {
      const out: string[] = [];
      let cur = '';
      for (const w of s.split(' ')) {
        const t = cur ? `${cur} ${w}` : w;
        if (!cur || textWidth(t, 1, false) <= BUBBLE_W) cur = t;
        else {
          out.push(cur);
          cur = w;
        }
      }
      return [...out, cur];
    };
    const old = new Set([...BANTER, ...HERO_BANTER].map((l) => l.text));
    const everyone: CampSpeaker[] = ['rowan', 'pip', 'sable', 'smith', 'neve', 'moss', 'tam', 'hollis', 'vesper', 'torva', 'solenne', 'wren'];
    for (const l of DUSK_BANTER) {
      expect(old.has(l.text), l.text).toBe(false);
      expect(DUSK_STORY[l.after], `${l.text}: after ${l.after}`).toBeDefined();
      expect(DUSK_SCENE_ACT[l.after], l.after).toBeDefined();
      const lines = wrap(l.text);
      expect(lines.length, l.text).toBeLessThanOrEqual(2);
      for (const x of lines) expect(textWidth(x, 1, false), l.text).toBeLessThanOrEqual(BUBBLE_W);
      const needs = [l.who, ...(l.with ?? [])];
      for (const k of everyone) if (new RegExp(`\\b${SPEAKER_NAME[k]}\\b`).test(l.text)) expect(needs, l.text).toContain(k);
    }
    for (const id of Object.keys(DUSK_STORY)) expect(DUSK_SCENE_ACT[id], id).toBeDefined();
  });
});
