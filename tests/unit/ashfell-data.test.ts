// Region 3's content (not in play yet; SPOILERS: docs/content-bible.md section 6) is well formed: every foe the acts
// name exists and is the right kind, specials follow the house rules (and their reds are fair to a thumb), story boxes
// and banter fit their boxes, relic and gear ids are unique and don't clash with the earlier regions'.
import { describe, expect, it } from 'vitest';
import { ASHFELL, ASH_THEMES } from '../../src/data/ashfell';
import { ASH_BANTER } from '../../src/data/banter-ash';
import { ASH_ENEMIES, ASH_NEW_SOUNDS } from '../../src/data/enemies-ash';
import { ASH_BASE_ITEMS, ASH_EFFECTS, ASH_SETS, ASH_SIGNATURES } from '../../src/data/gear-ash';
import { ASH_FIRST_ACT, ASH_PAIR_NAME, ASH_RELICS, ASH_RELIC_TAGS } from '../../src/data/relics-ash';
import { ASH_STORY } from '../../src/data/story-ash';
import { BANTER, HERO_BANTER, type CampSpeaker } from '../../src/data/banter';
import { ENEMIES } from '../../src/data/enemies';
import { BASE_ITEMS, EFFECTS, SETS, SLOTS } from '../../src/data/gear';
import { RELICS, RELIC_TAGS } from '../../src/data/relics';
import { SPEAKER_NAME, STORY } from '../../src/data/story';
import type { ActionDef, EnemyDef } from '../../src/data/types';
import { DEFAULT_TUNING } from '../../src/core/tuning';
import { TELL_SOUNDS } from '../../src/engine/audio';
import { textWidth } from '../../src/engine/font';

/** The story text box's text width (engine/view/story.ts; tests/unit/data.test.ts checks Regions 1-2 against it). */
const STORY_TEXT_W = 256;
/** The camp's speech bubble wraps at this width, in two lines at most (tests/unit/data.test.ts). */
const BUBBLE_W = 104;

const acts = ASHFELL.acts;
const actIds = acts.map((_, i) => ASH_FIRST_ACT + i);
/** A foe's key is the Region 3 table's own (the core owner may merge it into ENEMIES later: the same object). */
const ownKey = (k: string) => !(k in ENEMIES) || ENEMIES[k] === ASH_ENEMIES[k];

describe('Region 3: the region', () => {
  it('three acts of about 8 rows: the first two end in a mini-boss, the last in the boss; each has its own look', () => {
    expect(ASHFELL.id).toBe('ashfell');
    expect(acts).toHaveLength(3);
    expect(acts.map((a) => a.boss)).toEqual([['rumbleback'], ['hobnob'], ['bellows']]);
    expect(acts.map((a) => a.theme)).toEqual(ASH_THEMES);
    for (const a of acts) {
      expect(a.rows + 1, a.name).toBeGreaterThanOrEqual(7);
      expect(a.rows + 1, a.name).toBeLessThanOrEqual(9);
    }
  });

  it('acts get harder: HP, attack, pace and red speed step up act by act, and above the matching Frostpeaks act', () => {
    const frost = DEFAULT_TUNING.acts.slice(3, 6);
    for (let i = 0; i < 3; i++) {
      expect(acts[i].hpMult).toBeGreaterThan(frost[i].hpMult);
      expect(acts[i].atkMult).toBeGreaterThan(frost[i].atkMult);
      expect(acts[i].redSpeed).toBeGreaterThan(frost[i].redSpeed);
      expect(acts[i].redSpeed).toBeLessThanOrEqual(1.5);
      if (i > 0) {
        expect(acts[i].hpMult).toBeGreaterThan(acts[i - 1].hpMult);
        expect(acts[i].atkMult).toBeGreaterThan(acts[i - 1].atkMult);
        expect(acts[i].pace).toBeLessThan(acts[i - 1].pace);
      }
    }
  });

  it('the bar rules come in gradually: drift in Act 1 (from row 2), pairs in Act 2 (from row 1, some drift), both in Act 3', () => {
    const [a1, a2, a3] = acts.map((a) => a.bar ?? {});
    expect(a1.drift?.fromRow).toBe(2);
    expect(a1.links).toBeUndefined();
    expect(a2.links?.fromRow).toBe(1);
    expect(a2.drift).toBeDefined();
    expect(a2.drift!.share).toBeLessThan(a1.drift!.share);
    expect(a3.drift?.fromRow).toBe(0);
    expect(a3.links?.fromRow).toBe(0);
    for (const b of [a1, a2, a3]) {
      expect(b.ice ?? b.snow ?? b.holds, 'no Frostpeaks rules').toBeUndefined();
      if (b.drift) {
        expect(b.drift.speed).toBeGreaterThanOrEqual(0.04);
        expect(b.drift.speed).toBeLessThanOrEqual(0.1);
        expect(b.drift.share).toBeGreaterThan(0);
        expect(b.drift.share).toBeLessThanOrEqual(0.3);
      }
      if (b.links) {
        expect(b.links.share).toBeGreaterThan(0);
        expect(b.links.share).toBeLessThanOrEqual(0.3);
      }
    }
  });

  it("every encounter names a Region 3 foe; elites are elites, bosses are bosses, fights and packs have neither", () => {
    for (const a of acts) {
      const groups = [...a.fights.early, ...a.fights.late, ...a.elites, a.boss, ...(a.packs ?? []).flat()];
      for (const g of groups) for (const k of g) expect(ASH_ENEMIES[k], `${a.name}: ${k}`).toBeDefined();
      for (const g of a.elites) expect(g.some((k) => ASH_ENEMIES[k].elite), a.name).toBe(true);
      expect(a.boss.every((k) => ASH_ENEMIES[k].boss)).toBe(true);
      for (const g of [...a.fights.early, ...a.fights.late, ...(a.packs ?? []).flat()]) expect(g.some((k) => ASH_ENEMIES[k].elite || ASH_ENEMIES[k].boss), a.name).toBe(false);
      expect(a.packs?.length ?? 0, a.name).toBeGreaterThanOrEqual(2);
      for (const pack of a.packs ?? []) {
        expect(pack.length).toBeGreaterThanOrEqual(1);
        expect(pack.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('every scene the region names exists, and no scene id clashes with an earlier one', () => {
    const ids = [ASHFELL.victoryScene, 'magsTale', ...acts.flatMap((a) => [a.startScene, a.bossScene])];
    for (const id of ids) expect(ASH_STORY[id ?? ''], id).toBeDefined();
    for (const e of Object.values(ASH_ENEMIES)) for (const id of Object.values(e.phaseScenes ?? {})) expect(ASH_STORY[id], id).toBeDefined();
    for (const id of Object.keys(ASH_STORY)) expect(!(id in STORY) || STORY[id] === ASH_STORY[id], id).toBe(true);
  });
});

describe('Region 3: the foes', () => {
  const all = Object.entries(ASH_ENEMIES);

  it('about ten foes and three elites, two mini-bosses and a boss; no key clashes with an earlier region', () => {
    expect(all.filter(([, e]) => !e.boss && !e.elite).length).toBeGreaterThanOrEqual(8);
    expect(all.filter(([, e]) => e.elite).length).toBe(3);
    expect(all.filter(([, e]) => e.boss).length).toBe(3);
    for (const [k] of all) expect(ownKey(k), k).toBe(true);
    // every hero's soft strength has someone to bite on
    for (const tag of ['folk', 'caster', 'beast', 'swarm', 'armored', 'brute', 'flyer', 'construct'] as const) expect(all.some(([, e]) => e.tags?.includes(tag)), tag).toBe(true);
  });

  it('every special has a 0.6-1.0 s telegraph, a name, a known or listed sound, something to do; 0-2 moves at a time', () => {
    const sounds = new Set<string>([...TELL_SOUNDS, ...ASH_NEW_SOUNDS]);
    for (const n of ASH_NEW_SOUNDS) expect((TELL_SOUNDS as readonly string[]).includes(n), `${n} is new`).toBe(false);
    for (const [key, e] of all) {
      expect(e.specials.length, `${key} changes how the bar plays`).toBeGreaterThan(0);
      for (const ph of [1, 2, 3]) expect(e.specials.filter((s) => !(e.boss && s.gate) && (!s.phases || s.phases.includes(ph))).length, `${key} phase ${ph}`).toBeLessThanOrEqual(2);
      for (const s of e.specials) {
        const name = `${key}.${s.id}`;
        expect(s.tell, name).toBeGreaterThanOrEqual(0.6);
        expect(s.tell, name).toBeLessThanOrEqual(1.0);
        expect(s.name.length, name).toBeGreaterThan(0);
        expect(sounds.has(s.sound), `${name}: ${s.sound}`).toBe(true);
        expect(s.actions.length, name).toBeGreaterThan(0);
        expect(s.every !== undefined || s.hpBelow !== undefined, `${name} is timed or HP-triggered`).toBe(true);
      }
    }
  });

  it('drifting stays slow (about 0.04-0.10 of the bar a second, a short burst a little faster); pairs come two by two', () => {
    const speeds: number[] = [];
    for (const [key, e] of all)
      for (const s of e.specials)
        for (const a of s.actions as ActionDef[]) {
          const name = `${key}.${s.id}`;
          if (a.type === 'toDrift') speeds.push(a.speed);
          if (a.type === 'toLink') {
            expect(a.count, name).toBeGreaterThan(0);
            if (a.drift !== undefined) speeds.push(a.drift);
          }
          if (a.type === 'driftShift') {
            expect(a.mult ?? 1, name).toBeLessThanOrEqual(1.6);
            if ((a.mult ?? 1) > 1) expect(a.sec ?? 0, `${name}: a burst, not for good`).toBeGreaterThan(0);
          }
          if (a.type === 'formation') {
            for (const b of a.blocks) if (b.drift !== undefined) speeds.push(b.drift);
            const links = a.blocks.filter((b) => b.link);
            expect(links.length % 2, `${name}: linked entries come in twos`).toBe(0);
            for (const b of links) expect(b.kind, name).toBe('yellow');
          }
        }
    expect(speeds.length).toBeGreaterThan(0);
    for (const v of speeds) {
      expect(v).toBeGreaterThanOrEqual(0.04);
      expect(v).toBeLessThanOrEqual(0.1);
    }
  });

  it('the boss rewrites the bar in each phase; mini-bosses and the boss have gates a finisher cannot skip', () => {
    // what starts each phase: the gate that enters it, or (phase 1) a move of phase 1 alone
    const opens = (e: EnemyDef, ph: number) =>
      e.specials.filter((s) => (s.gate ? s.actions.some((a) => a.type === 'phase' && a.phase === ph) : ph === 1 && s.phases?.join() === '1')).flatMap((s) => s.actions);
    const boss = ASH_ENEMIES.bellows;
    expect(boss.phaseScenes).toEqual({ 2: 'bellows2', 3: 'bellows3' });
    for (const ph of [1, 2, 3]) expect(opens(boss, ph).some((a) => a.type === 'barRule'), `phase ${ph} sets a bar rule`).toBe(true);
    for (const k of ['rumbleback', 'hobnob', 'bellows']) expect(ASH_ENEMIES[k].specials.some((s) => s.gate && s.hpBelow), k).toBe(true);
  });

  it('every summon and split names a real foe', () => {
    for (const [key, e] of all)
      for (const s of e.specials)
        for (const a of s.actions) {
          if (a.type === 'summon') for (const k of a.enemies) expect(ASH_ENEMIES[k] ?? ENEMIES[k], `${key}.${s.id} summons ${k}`).toBeDefined();
          if (a.type === 'split') expect(ASH_ENEMIES[a.into] ?? ENEMIES[a.into], `${key}.${s.id} splits into ${a.into}`).toBeDefined();
        }
  });

  it('every red attack is fair to a thumb (the same rules as tests/unit/data.test.ts, at Region 3 red speeds)', () => {
    const T = DEFAULT_TUNING;
    const v = 1.5 / T.cursor.basePassSec;
    const actSpeed = Math.max(...T.acts.map((a) => a.redSpeed), ...acts.map((a) => a.redSpeed));
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
            if ((b.speed ?? 1) > 1) expect(b.width ?? 1, `${name}: a fast red is wider`).toBeGreaterThan(1);
            expect(b.pair, `${name}: no back-to-back reds`).toBeFalsy();
            const { w, closing } = at(b);
            expect((w + T.cursor.widthFrac) / closing + (2 * T.judge.redGraceMs) / 1000, `${name}: blocking window`).toBeGreaterThanOrEqual(0.12);
            if (b.still) expect(b.fuse ?? 0, `${name}: a still red's fuse`).toBeGreaterThanOrEqual(1.4);
          }
          for (let i = 0; i < reds.length; i++)
            for (let j = i + 1; j < reds.length; j++) {
              const [p, q] = [reds[i], reds[j]];
              if (p.still && q.still) continue;
              const gap = p.at !== undefined && q.at !== undefined ? Math.abs(p.at - q.at) : Math.abs((q.delay ?? 0) - (p.delay ?? 0)) * Math.min(at(p).vel, at(q).vel);
              expect(gap / Math.max(at(p).closing, at(q).closing), `${name}: reds ${i} and ${j} too close`).toBeGreaterThanOrEqual(0.16);
            }
        }
  });
});

describe('Region 3: story and banter', () => {
  it('every beat is there; at most 6 boxes per scene and 2 lines per box, every line fits the text box', () => {
    for (const id of ['ash1', 'rumbleback', 'magsTale', 'ash2', 'hobnob', 'ash3', 'bellows', 'bellows2', 'bellows3', 'ashVictory']) expect(ASH_STORY[id], id).toBeDefined();
    expect(ASH_STORY.ashVictory.map((b) => b.text).join(' ')).toMatch(/THREE/);
    expect(ASH_STORY.ashVictory.map((b) => b.text).join(' ')).toMatch(/Duskmire/);
    for (const [id, boxes] of Object.entries(ASH_STORY)) {
      expect(boxes.length, id).toBeGreaterThan(0);
      expect(boxes.length, id).toBeLessThanOrEqual(6);
      for (const b of boxes) {
        const lines = b.text.split('\n');
        expect(lines.length, `${id}: ${b.text}`).toBeLessThanOrEqual(2);
        for (const l of lines) expect(textWidth(l, 1, false), `${id}: "${l}"`).toBeLessThanOrEqual(STORY_TEXT_W);
        expect(SPEAKER_NAME[b.who], `${id}: ${b.who}`).toBeDefined();
      }
    }
  });

  it('banter lines fit the bubble, are new, wait for a Region 3 scene, and need whoever they name', () => {
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
    const everyone: CampSpeaker[] = ['rowan', 'pip', 'sable', 'smith', 'neve', 'moss', 'tam', 'hollis', 'vesper', 'torva'];
    expect(new Set(ASH_BANTER.map((l) => l.text)).size).toBe(ASH_BANTER.length);
    for (const l of ASH_BANTER) {
      expect(old.has(l.text), l.text).toBe(false);
      expect(ASH_STORY[l.after], `${l.text}: after ${l.after}`).toBeDefined();
      const lines = wrap(l.text);
      expect(lines.length, l.text).toBeLessThanOrEqual(2);
      for (const x of lines) expect(textWidth(x, 1, false), l.text).toBeLessThanOrEqual(BUBBLE_W);
      const needs = [l.who, ...(l.with ?? [])];
      for (const k of everyone) if (new RegExp(`\\b${SPEAKER_NAME[k]}\\b`).test(l.text)) expect(needs, l.text).toContain(k);
    }
  });
});

describe('Region 3: relics and gear', () => {
  const sub = (text: string, n?: number) => text.replace('{n}', String(n ?? ''));

  it('about fifteen Drift and Link relics: unique ids and names, one rule, at most one number, offered from the region on', () => {
    expect(ASH_RELICS.length).toBeGreaterThanOrEqual(14);
    const ids = ASH_RELICS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const oldIds = new Set<string>(RELICS.filter((r) => (r.from ?? 0) < ASH_FIRST_ACT).map((r) => r.id));
    const oldNames = new Set(RELICS.filter((r) => (r.from ?? 0) < ASH_FIRST_ACT).map((r) => r.name));
    const widest = Math.max(...RELICS.map((r) => textWidth(sub(r.text, r.n), 1, false)));
    for (const r of ASH_RELICS) {
      expect(oldIds.has(r.id), r.id).toBe(false);
      expect(oldNames.has(r.name), r.name).toBe(false);
      expect(r.tags.length, r.id).toBeGreaterThanOrEqual(1);
      expect(r.tags.length, r.id).toBeLessThanOrEqual(2);
      expect(ASH_RELIC_TAGS.includes(r.tags[0] as (typeof ASH_RELIC_TAGS)[number]), `${r.id}: led by Drift or Link`).toBe(true);
      for (const t of r.tags.slice(1)) expect([...RELIC_TAGS, ...ASH_RELIC_TAGS] as string[]).toContain(t);
      expect(r.text.includes('{n}'), `${r.id}: '{n}' iff it has a number`).toBe(r.n !== undefined);
      expect((r.text.match(/\{n\}/g) ?? []).length).toBeLessThanOrEqual(1);
      expect(r.from).toBe(ASH_FIRST_ACT);
      if (r.unlock && (r.unlock.kind === 'act' || r.unlock.kind === 'elite')) expect(actIds).toContain(r.unlock.act);
      expect(textWidth(sub(r.text, r.n), 1, false), `${r.id}: fits a card like the others`).toBeLessThanOrEqual(widest);
    }
    for (const tag of ASH_RELIC_TAGS) expect(ASH_RELICS.filter((r) => r.tags.includes(tag)).length, tag).toBeGreaterThanOrEqual(6);
    for (const [a, b] of ASH_PAIR_NAME) expect([a, b].some((t) => (ASH_RELIC_TAGS as string[]).includes(t))).toBe(true);
  });

  it("gear: unique ids that don't clash, every slot covered, set pieces and signature drops that exist", () => {
    const ids = ASH_BASE_ITEMS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    const old = BASE_ITEMS.filter((b) => b.act < ASH_FIRST_ACT);
    const oldIds = new Set(old.map((b) => b.id));
    const oldNames = new Set(old.map((b) => b.name));
    const widestName = Math.max(...BASE_ITEMS.map((b) => textWidth(b.name, 1, true)));
    for (const b of ASH_BASE_ITEMS) {
      expect(oldIds.has(b.id), b.id).toBe(false);
      expect(oldNames.has(b.name), b.name).toBe(false);
      expect(actIds, b.id).toContain(b.act);
      expect(b.icon.length).toBeGreaterThan(0);
      expect(b.base.length).toBeGreaterThan(0);
      expect(textWidth(b.name, 1, true), b.name).toBeLessThanOrEqual(widestName);
    }
    const plain = ASH_BASE_ITEMS.filter((b) => !b.set && !b.signature);
    expect(plain.length).toBeGreaterThanOrEqual(10);
    for (const slot of SLOTS) expect(plain.some((b) => b.slot === slot), slot).toBe(true);
    // the set: its pieces exist, each its own slot
    for (const [id, set] of Object.entries(ASH_SETS)) {
      expect(SETS[id as keyof typeof SETS], id).toBe(set); // merged into the game's sets, no clash
      const pieces = set.pieces.map((p) => ASH_BASE_ITEMS.find((b) => b.id === p));
      for (const [i, p] of pieces.entries()) expect(p?.set, set.pieces[i]).toBe(id);
      expect(new Set(pieces.map((p) => p?.slot)).size).toBe(pieces.length);
    }
    // the boss's two signature Legendaries
    const widestEffect = Math.max(...Object.values(EFFECTS).map((e) => textWidth(e.text, 1, false)));
    for (const [id, e] of Object.entries(ASH_EFFECTS)) {
      expect(EFFECTS[id as keyof typeof EFFECTS], id).toBe(e); // merged into the game's effects, no clash
      expect(textWidth(e.text, 1, false), e.text).toBeLessThanOrEqual(widestEffect);
    }
    for (const [boss, items] of Object.entries(ASH_SIGNATURES)) {
      expect(ASH_ENEMIES[boss]?.boss, boss).toBe(true);
      expect(items).toHaveLength(2);
      for (const it of items) {
        const b = ASH_BASE_ITEMS.find((x) => x.id === it);
        expect(b?.signature?.boss, it).toBe(boss);
        expect(b?.signature?.rarity).toBe('legendary');
        expect(ASH_EFFECTS[b!.signature!.effect]).toBeDefined();
      }
    }
  });
});
