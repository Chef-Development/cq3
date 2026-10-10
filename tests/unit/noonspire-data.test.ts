// Region 5's content (not in play yet; SPOILERS: docs/content-bible.md section 8) is well formed: the acts step up
// from Lanternfen's, the rules come in gradually, every foe the acts name exists and is the right kind, specials follow
// the house rules (fair reds, 0-2 moves at a time), the boss changes the bar each phase, the scenes exist (the story
// team's, or a placeholder), and every foe has a map mini. The two bar rules are tested in bar-rules.test.ts.
import { describe, expect, it } from 'vitest';
import { NOONSPIRE, NOON_FIRST_ACT } from '../../src/data/noonspire';
import { NOON_ENEMIES, NOON_NEW_SOUNDS } from '../../src/data/enemies-noon';
import { NOON_STORY } from '../../src/data/story-noon';
import { NOON_MINI_STORY } from '../../src/data/story-noon-minis';
import { DUSKMIRE } from '../../src/data/duskmire';
import { DUSK_ENEMIES } from '../../src/data/enemies-dusk';
import { ENEMIES } from '../../src/data/enemies';
import { STORY } from '../../src/data/story';
import type { ActionDef } from '../../src/data/types';
import { DEFAULT_TUNING } from '../../src/core/tuning';
import { TELL_SOUNDS } from '../../src/engine/audio';
import { textWidth } from '../../src/engine/font';
import { MINIS } from '../../src/engine/art-minis';
import { NOON_BASE_ITEMS, NOON_EFFECTS, NOON_SETS, NOON_SIGNATURES } from '../../src/data/gear-noon';
import { DUSK_BASE_ITEMS } from '../../src/data/gear-dusk';
import { BASE_ITEMS, EFFECTS, SETS, SLOTS } from '../../src/data/gear';
import { NOON_BUILD_NAME, NOON_PAIR_NAME, NOON_RELICS, NOON_RELIC_TAGS } from '../../src/data/relics-noon';
import { DUSK_RELIC_TAGS } from '../../src/data/relics-dusk';
import { BUILD_NAME, PAIR_NAME, RELICS, RELIC_TAGS } from '../../src/data/relics';

const acts = NOONSPIRE.acts;
const all = Object.entries(NOON_ENEMIES);

describe('Region 5: the region', () => {
  it('three acts after Lanternfen (global 12-14): mini-boss, mini-boss, boss; each a step above the matching Lanternfen act', () => {
    expect(NOON_FIRST_ACT).toBe(9 + DUSKMIRE.acts.length);
    expect(acts.map((a) => a.boss)).toEqual([['sphinx'], ['brassLion'], ['gnomon']]);
    for (let i = 0; i < 3; i++) {
      const d = DUSKMIRE.acts[i];
      expect(acts[i].hpMult).toBeGreaterThan(d.hpMult);
      expect(acts[i].atkMult).toBeGreaterThan(d.atkMult);
      expect(acts[i].redSpeed).toBeGreaterThan(d.redSpeed);
      expect(acts[i].redSpeed).toBeLessThanOrEqual(1.5);
      if (i > 0) expect(acts[i].pace).toBeLessThan(acts[i - 1].pace);
    }
  });

  it('the rules come in gradually: mirages in Act 1 (row 2), heat in Act 2 (row 1, a few mirages), both in Act 3', () => {
    const [a1, a2, a3] = acts.map((a) => a.bar ?? {});
    expect(a1.mirage?.fromRow).toBe(2);
    expect(a1.heat).toBeUndefined();
    expect(a2.heat?.fromRow).toBe(1);
    expect(a2.mirage!.share).toBeLessThan(a1.mirage!.share);
    expect(a3.mirage?.fromRow).toBe(0);
    expect(a3.heat?.fromRow).toBe(0);
    for (const b of [a1, a2, a3]) {
      expect(b.ice ?? b.snow ?? b.holds ?? b.drift ?? b.links ?? b.dark ?? b.tide, "no earlier regions' rules").toBeUndefined();
      if (b.mirage) {
        expect(b.mirage.share).toBeLessThanOrEqual(0.3);
        expect(b.mirage.every).toBeGreaterThanOrEqual(2);
      }
      if (b.heat) expect(b.heat.share).toBeLessThanOrEqual(0.3);
    }
  });

  it('every encounter names a Region 5 foe; elites are elites, bosses are bosses; every foe has a map mini', () => {
    for (const a of acts) {
      const groups = [...a.fights.early, ...a.fights.late, ...a.elites, a.boss, ...(a.packs ?? []).flat()];
      for (const g of groups) for (const k of g) expect(NOON_ENEMIES[k], `${a.name}: ${k}`).toBeDefined();
      for (const g of a.elites) expect(g.some((k) => NOON_ENEMIES[k].elite), a.name).toBe(true);
      expect(a.boss.every((k) => NOON_ENEMIES[k].boss)).toBe(true);
      for (const g of [...a.fights.early, ...a.fights.late, ...(a.packs ?? []).flat()]) expect(g.some((k) => NOON_ENEMIES[k].elite || NOON_ENEMIES[k].boss), a.name).toBe(false);
    }
    for (const [k, e] of all) expect(MINIS[e.sprite], `${k} (${e.sprite}) has a map mini`).toBeDefined();
  });

  it("every scene the region names is the story team's (story-noon.ts) or a placeholder, and none clashes", () => {
    const known = new Set([...Object.keys(NOON_STORY), ...Object.keys(NOON_MINI_STORY)]);
    for (const id of [NOONSPIRE.victoryScene, ...acts.flatMap((a) => [a.startScene!, a.bossScene!]), ...Object.values(NOON_ENEMIES.gnomon.phaseScenes ?? {})]) expect(known.has(id), id).toBe(true);
    for (const id of Object.keys(NOON_MINI_STORY)) expect(id in STORY || id in NOON_STORY, id).toBe(false);
    for (const boxes of Object.values(NOON_MINI_STORY)) for (const b of boxes) for (const l of b.text.split('\n')) expect(textWidth(l, 1, false)).toBeLessThanOrEqual(256);
  });
});

describe('Region 5: the foes', () => {
  it('about ten foes and three elites, two mini-bosses and a boss; no key clashes with an earlier region', () => {
    expect(all.filter(([, e]) => !e.boss && !e.elite).length).toBeGreaterThanOrEqual(8);
    expect(all.filter(([, e]) => e.elite).length).toBe(3);
    expect(all.filter(([, e]) => e.boss).length).toBe(3);
    // (merged into ENEMIES for the Test lab's previews: its own entries, no clash with another region's)
    for (const [k, e] of all) expect((k in ENEMIES && ENEMIES[k] !== e) || k in DUSK_ENEMIES, k).toBe(false);
    for (const tag of ['folk', 'caster', 'beast', 'swarm', 'armored', 'brute', 'flyer', 'construct'] as const) expect(all.some(([, e]) => e.tags?.includes(tag)), tag).toBe(true);
  });

  it('every special: a 0.6-1.0 s telegraph, a name that fits, a sound, something to do; 0-2 moves at a time', () => {
    const sounds = new Set<string>([...TELL_SOUNDS, ...NOON_NEW_SOUNDS]);
    for (const [key, e] of all) {
      for (const ph of [1, 2, 3]) expect(e.specials.filter((s) => !(e.boss && s.gate) && (!s.phases || s.phases.includes(ph))).length, `${key} phase ${ph}`).toBeLessThanOrEqual(2);
      for (const s of e.specials) {
        const name = `${key}.${s.id}`;
        expect(s.tell, name).toBeGreaterThanOrEqual(0.6);
        expect(s.tell, name).toBeLessThanOrEqual(1.0);
        expect(textWidth(s.name, 1, false), name).toBeLessThanOrEqual(90);
        expect(sounds.has(s.sound), `${name}: ${s.sound}`).toBe(true);
        expect(s.every !== undefined || s.hpBelow !== undefined, name).toBe(true);
      }
    }
  });

  it('the Gnomon changes the bar in each phase (the Mapmaker\'s edits); the mini-bosses and the boss have gates', () => {
    const boss = NOON_ENEMIES.gnomon;
    expect(boss.phaseScenes).toEqual({ 2: 'noonBoss2', 3: 'noonBoss3' });
    const changes = (a: ActionDef) => ['hop', 'blaze', 'barRule'].includes(a.type) || (a.type === 'formation' && a.blocks.some((b) => b.mirage || b.blaze));
    const opens = (ph: number) => boss.specials.filter((s) => (s.gate ? s.actions.some((a) => a.type === 'phase' && a.phase === ph) : ph === 1 && !!s.phases?.includes(1))).flatMap((s) => s.actions);
    for (const ph of [1, 2, 3]) expect(opens(ph).some(changes), `phase ${ph}`).toBe(true);
    for (const k of ['sphinx', 'brassLion', 'gnomon']) expect(NOON_ENEMIES[k].specials.some((s) => s.gate && s.hpBelow), k).toBe(true);
  });

  it('every red attack is fair to a thumb (as tests/unit/data.test.ts, at Region 5 red speeds)', () => {
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
            expect(b.width ?? 1, name).toBeGreaterThanOrEqual(1);
            if ((b.speed ?? 1) > 1.2) expect(b.width ?? 1, `${name}: a fast red is wider`).toBeGreaterThan(1);
            const { w, closing } = at(b);
            expect((w + T.cursor.widthFrac) / closing + (2 * T.judge.redGraceMs) / 1000, `${name}: blocking window`).toBeGreaterThanOrEqual(0.12);
            if (b.still) expect(b.fuse ?? 0, name).toBeGreaterThanOrEqual(1.4);
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

describe('Region 5: gear (merged once the region is in play)', () => {
  it("unique ids and names new to the game, every slot covered, a set and the boss's two signature Legendaries", () => {
    const ids = NOON_BASE_ITEMS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    const old = [...BASE_ITEMS.filter((b) => b.act < NOON_FIRST_ACT), ...(DUSK_BASE_ITEMS as typeof BASE_ITEMS)];
    const oldIds = new Set(old.map((b) => b.id));
    const oldNames = new Set(old.map((b) => b.name));
    const widestName = Math.max(...BASE_ITEMS.map((b) => textWidth(b.name, 1, true)));
    for (const b of NOON_BASE_ITEMS) {
      expect(oldIds.has(b.id), b.id).toBe(false);
      expect(oldNames.has(b.name), b.name).toBe(false);
      expect([12, 13, 14], b.id).toContain(b.act);
      expect(textWidth(b.name, 1, true), b.name).toBeLessThanOrEqual(widestName);
    }
    const plain = NOON_BASE_ITEMS.filter((b) => !b.set && !b.signature);
    expect(plain.length).toBeGreaterThanOrEqual(10);
    for (const slot of SLOTS) expect(plain.some((b) => b.slot === slot), slot).toBe(true);
    for (const [id, set] of Object.entries(NOON_SETS)) {
      expect(id in SETS && SETS[id as keyof typeof SETS] !== set, id).toBe(false);
      const pieces = set.pieces.map((p) => NOON_BASE_ITEMS.find((b) => b.id === p));
      for (const [i, p] of pieces.entries()) expect(p?.set, set.pieces[i]).toBe(id);
      expect(new Set(pieces.map((p) => p?.slot)).size).toBe(pieces.length);
    }
    const widestEffect = Math.max(...Object.values(EFFECTS).map((e) => textWidth(e.text, 1, false)));
    for (const [id, e] of Object.entries(NOON_EFFECTS)) {
      expect(EFFECTS[id as keyof typeof EFFECTS], id).toBe(e);
      expect(textWidth(e.text, 1, false), e.text).toBeLessThanOrEqual(widestEffect);
    }
    for (const [boss, items] of Object.entries(NOON_SIGNATURES)) {
      expect(NOON_ENEMIES[boss]?.boss, boss).toBe(true);
      expect(items).toHaveLength(2);
      for (const it of items) {
        const b = NOON_BASE_ITEMS.find((x) => x.id === it);
        expect(b?.signature?.boss, it).toBe(boss);
        expect(NOON_EFFECTS[b!.signature!.effect]).toBeDefined();
      }
    }
  });
});

describe('Region 5: relics (in RELICS once the region is in play)', () => {
  const sub = (text: string, n?: number) => text.replace('{n}', String(n ?? ''));
  it('fourteen Mirage and Heat relics: unique ids and names new to the game, one number at most, each fits a card', () => {
    const ids = NOON_RELICS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const older = RELICS.filter((r) => (r.from ?? 0) < NOON_FIRST_ACT);
    const oldIds = new Set<string>(older.map((r) => r.id));
    const oldNames = new Set(older.map((r) => r.name));
    const widest = Math.max(...older.map((r) => textWidth(sub(r.text, r.n), 1, false)));
    for (const r of NOON_RELICS) {
      expect(oldIds.has(r.id), r.id).toBe(false);
      expect(oldNames.has(r.name), r.name).toBe(false);
      expect((NOON_RELIC_TAGS as string[]).includes(r.tags[0]), r.id).toBe(true);
      for (const t of r.tags.slice(1)) expect([...RELIC_TAGS, ...DUSK_RELIC_TAGS, ...NOON_RELIC_TAGS] as string[]).toContain(t);
      expect(r.tags.length).toBeLessThanOrEqual(2);
      expect(r.text.includes('{n}'), r.id).toBe(r.n !== undefined);
      expect(r.from).toBe(NOON_FIRST_ACT);
      if (r.unlock?.kind === 'act' || r.unlock?.kind === 'elite') expect([12, 13, 14], r.id).toContain(r.unlock.act);
      expect(textWidth(sub(r.text, r.n), 1, false), `${r.id}: fits a card like the others`).toBeLessThanOrEqual(widest);
    }
    for (const tag of NOON_RELIC_TAGS) expect(NOON_RELICS.filter((r) => r.tags.includes(tag)).length, tag).toBeGreaterThanOrEqual(6);
    const ours = new Set([...Object.values(NOON_BUILD_NAME), ...NOON_PAIR_NAME.map((p) => p[2])]);
    const others = [...Object.entries(BUILD_NAME).filter(([t]) => !(NOON_RELIC_TAGS as string[]).includes(t)).map(([, v]) => v), ...PAIR_NAME.filter((p) => !p.some((t) => (NOON_RELIC_TAGS as string[]).includes(t))).map((p) => p[2])];
    for (const name of others) expect(ours.has(name), name).toBe(false);
    expect(BUILD_NAME.mirage).toBe(NOON_BUILD_NAME.mirage);
    for (const [a, b] of NOON_PAIR_NAME) expect([a, b].some((t) => (NOON_RELIC_TAGS as string[]).includes(t))).toBe(true);
  });
});
