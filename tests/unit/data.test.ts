// Content checks: the data in src/data fits together (every encounter's enemies exist, every scene and event
// exists, story boxes fit their text box) and the tuning panel can see it.
import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { EVENTS } from '../../src/data/events';
import { GREENMARCH } from '../../src/data/greenmarch';
import { SPEAKER_NAME, STORY } from '../../src/data/story';
import { BANTER } from '../../src/data/banter';
import { HEROES } from '../../src/data/heroes';
import { kitColW } from '../../src/engine/view/heroes';
import { cloneTuning, DEFAULT_TUNING, getPath, mergeKnown, setPath, sliderGroups, tuningDiff } from '../../src/core/tuning';
import { redSpeedFor } from '../../src/core/combat';
import { textWidth } from '../../src/engine/font';

/** Width (game px) of the story text box's text area (engine/view/story.ts uses the same number). */
export const STORY_TEXT_W = 256;
/** Event and outcome text sits in a slightly wider panel. */
const EVENT_TEXT_W = 250;

describe('region data', () => {
  it('three acts: the first two end in a mini-boss, the last in the boss', () => {
    expect(GREENMARCH.acts.map((a) => a.name)).toEqual(['Meadow Road', 'Old Ruins', "Boar King's Hollow"]);
    expect(GREENMARCH.acts.map((a) => a.theme)).toEqual(['forest', 'ruins', 'hollow']);
    expect(GREENMARCH.acts.map((a) => a.boss)).toEqual([['captain'], ['golem'], ['boarKing']]);
    for (const a of GREENMARCH.acts) {
      expect(a.rows + 1, 'about 8 rows deep').toBeGreaterThanOrEqual(7);
      expect(a.rows + 1).toBeLessThanOrEqual(9);
    }
  });

  it('every encounter names real enemies; elites are elites, bosses are bosses', () => {
    for (const a of GREENMARCH.acts) {
      for (const group of [...a.fights.early, ...a.fights.late, ...a.elites, a.boss]) for (const k of group) expect(ENEMIES[k], `${a.name}: ${k}`).toBeDefined();
      for (const group of a.elites) expect(group.some((k) => ENEMIES[k].elite), a.name).toBe(true);
      expect(a.boss.every((k) => ENEMIES[k].boss)).toBe(true);
      for (const group of [...a.fights.early, ...a.fights.late]) expect(group.some((k) => ENEMIES[k].elite || ENEMIES[k].boss)).toBe(false);
    }
  });

  it("each act has wandering packs of its own kind of foes (no elites or bosses), a wave or two each", () => {
    for (const a of GREENMARCH.acts) {
      expect(a.packs?.length ?? 0, a.name).toBeGreaterThanOrEqual(2);
      for (const pack of a.packs ?? []) {
        expect(pack.length).toBeGreaterThanOrEqual(1);
        expect(pack.length).toBeLessThanOrEqual(3);
        for (const wave of pack)
          for (const k of wave) {
            expect(ENEMIES[k], `${a.name}: ${k}`).toBeDefined();
            expect(!!ENEMIES[k].elite || !!ENEMIES[k].boss, k).toBe(false);
          }
      }
    }
  });

  it('the Coin Rush sack never attacks: yellows only, no attack, no specials, no coins of its own', () => {
    const e = ENEMIES.coinSack;
    expect(e.pattern).toMatch(/^[YG]+$/);
    expect(e.atk).toBe(0);
    expect(e.specials).toEqual([]);
    expect(e.coins).toBe(0);
  });

  it('wolves come in pairs', () => {
    for (const a of GREENMARCH.acts) for (const group of [...a.fights.early, ...a.fights.late, ...a.elites]) if (group.includes('wolf')) expect(group.filter((k) => k === 'wolf').length, a.name).toBeGreaterThanOrEqual(1);
    const fights = GREENMARCH.acts[2].fights;
    expect([...fights.early, ...fights.late].filter((g) => g.includes('wolf')).every((g) => g.filter((k) => k === 'wolf').length === 2)).toBe(true);
  });

  it('every summon, split and scene the enemies name exists', () => {
    for (const [key, e] of Object.entries(ENEMIES)) {
      for (const s of e.specials)
        for (const a of s.actions) {
          if (a.type === 'summon') for (const k of a.enemies) expect(ENEMIES[k], `${key}.${s.id} summons ${k}`).toBeDefined();
          if (a.type === 'split') expect(ENEMIES[a.into], `${key}.${s.id} splits into ${a.into}`).toBeDefined();
        }
      for (const id of Object.values(e.phaseScenes ?? {})) expect(STORY[id], id).toBeDefined();
    }
  });

  it("every red attack is fair to a thumb: never thin, a wide enough window even at 1.5x cursor speed in the fastest act (Sable's bar too), waves spaced so each red can be blocked on its own", () => {
    const T = DEFAULT_TUNING;
    const v = 1.5 / T.cursor.basePassSec; // the cursor at 1.5x, heading into the reds
    const actSpeed = Math.max(...T.acts.map((a) => a.redSpeed)); // later acts' reds cross the bar faster...
    const twinSpeed = redSpeedFor(T, 2, actSpeed); // ...and faster still on Sable's bar
    expect(actSpeed).toBeLessThanOrEqual(1.5);
    const RED = ['red', 'shield', 'bomb', 'speed'];
    for (const [key, e] of Object.entries(ENEMIES))
      for (const s of e.specials)
        for (const a of s.actions) {
          if (a.type !== 'formation') continue;
          const reds = a.blocks.filter((b) => RED.includes(b.kind));
          const at = (b: (typeof reds)[number]) => {
            const w = T.blocks.redWidth * (b.width ?? 1) * T.blocks.redWidthMin;
            const vel = ((1 - w) / T.blocks.redTravelSec) * (b.speed ?? 1) * actSpeed;
            return { w, vel, closing: v + vel };
          };
          for (const b of reds) {
            const name = `${key}.${s.id}`;
            expect(b.width ?? 1, `${name}: never thinner than a normal red`).toBeGreaterThanOrEqual(1);
            if ((b.speed ?? 1) > 1) expect(b.width ?? 1, `${name}: a fast red is wider`).toBeGreaterThan(1);
            expect(b.pair, `${name}: no back-to-back reds`).toBeFalsy();
            const { w, vel, closing } = at(b);
            const windowSec = (w + T.cursor.widthFrac) / closing + (2 * T.judge.redGraceMs) / 1000;
            expect(windowSec, `${name}: blocking window`).toBeGreaterThanOrEqual(0.12);
            // Sable: her reds are narrower (sable.redWidthMult), her cursors sweep half the bar at the same pass time
            const ws = w * T.sable.redWidthMult;
            const twinVel = (vel / actSpeed) * twinSpeed;
            const twinWindow = (ws + T.cursor.widthFrac * 0.5) / (v * 0.5 + twinVel) + (2 * T.judge.redGraceMs) / 1000;
            expect(twinWindow, `${name}: Sable's blocking window`).toBeGreaterThanOrEqual(0.12);
          }
          // in a wave, the cursor meets one red at a time: at least 0.16 s apart (a thumb taps about every 0.14 s)
          for (let i = 0; i < reds.length; i++)
            for (let j = i + 1; j < reds.length; j++) {
              const [p, q] = [reds[i], reds[j]];
              const gap = p.at !== undefined && q.at !== undefined ? Math.abs(p.at - q.at) : Math.abs((q.delay ?? 0) - (p.delay ?? 0)) * Math.min(at(p).vel, at(q).vel);
              expect(gap / Math.max(at(p).closing, at(q).closing), `${key}.${s.id}: reds ${i} and ${j} too close`).toBeGreaterThanOrEqual(0.16);
            }
        }
  });

  it('every scene the region names exists', () => {
    const ids = [GREENMARCH.introScene, GREENMARCH.victoryScene, ...GREENMARCH.acts.flatMap((a) => [a.startScene, a.bossScene])];
    for (const id of ids) expect(STORY[id ?? ''], id).toBeDefined();
  });
});

describe('story', () => {
  it('has every beat: intro, Pip joins, the three bosses, the boss phases, victory', () => {
    for (const id of ['intro', 'act1', 'captain', 'golem', 'boarKing', 'boarKing2', 'boarKing3', 'victory']) expect(STORY[id], id).toBeDefined();
    expect(STORY.act1.some((b) => b.who === 'pip' && b.text.includes("I'm not a pet. I'm a consultant."))).toBe(true);
    expect(STORY.intro.map((b) => b.text).join(' ')).toMatch(/Great Pendulum/);
    expect(STORY.intro.map((b) => b.text).join(' ')).toMatch(/12 weights/);
    expect(STORY.victory.map((b) => b.text).join(' ')).toMatch(/ticked/);
  });

  it('at most 6 boxes per scene and 2 lines per box, and every line fits the text box', () => {
    for (const [id, boxes] of Object.entries(STORY)) {
      expect(boxes.length, id).toBeGreaterThan(0);
      expect(boxes.length, id).toBeLessThanOrEqual(6);
      for (const b of boxes) {
        const lines = b.text.split('\n');
        expect(lines.length, `${id}: ${b.text}`).toBeLessThanOrEqual(2);
        for (const l of lines) expect(textWidth(l, 1, false), `${id}: "${l}"`).toBeLessThanOrEqual(STORY_TEXT_W);
        expect(SPEAKER_NAME[b.who]).toBeDefined();
      }
    }
  });
});

describe('camp banter', () => {
  /** The camp's speech bubble wraps a line at this width (camp.ts drawBanter), in two lines at most. */
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

  it('about twenty lines, each one fitting the bubble in two short lines', () => {
    expect(BANTER.length).toBeGreaterThanOrEqual(18);
    expect(new Set(BANTER.map((l) => l.text)).size).toBe(BANTER.length);
    for (const l of BANTER) {
      const lines = wrap(l.text);
      expect(lines.length, l.text).toBeLessThanOrEqual(2);
      for (const x of lines) expect(textWidth(x, 1, false), l.text).toBeLessThanOrEqual(BUBBLE_W);
    }
  });

  it('lines that need Sable say so; Rowan and Pip have plenty without them', () => {
    for (const l of BANTER) if (/sable/i.test(l.text)) expect(l.sable || l.who === 'sable', l.text).toBe(true);
    expect(BANTER.filter((l) => l.who !== 'sable' && !l.sable).length).toBeGreaterThanOrEqual(10);
  });
});

describe('hero kit lines', () => {
  it("every hero's kit fits the hero select's three columns at the narrowest layout (iPhone safe areas)", () => {
    // the card's inner width with 23 px safe areas each side: 327 - 46 - 6 - 12
    const KW = 263;
    for (const h of Object.values(HEROES)) {
      const parts = [h.ability, h.passive, h.finisher].filter((p): p is NonNullable<typeof p> => !!p);
      for (const p of parts) expect(p.short.length, p.name).toBeGreaterThan(0);
      const plain = parts.reduce((a, p) => a + kitColW(p, false), 0) + 6 * (parts.length - 1);
      expect(plain, h.name).toBeLessThanOrEqual(KW);
    }
  });

  it("every hero's bio is one line on the hero select", () => {
    // (the card's text column is 214 px with the iPhone's safe areas)
    for (const h of Object.values(HEROES)) expect(textWidth(h.bio, 1, false), h.bio).toBeLessThanOrEqual(210);
  });
});

describe('events', () => {
  it('each has two choices and texts that fit their panel', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(5);
    for (const e of EVENTS) {
      expect(e.choices, e.id).toHaveLength(2);
      const lines = e.text.split('\n');
      expect(lines.length).toBeLessThanOrEqual(2);
      for (const l of lines) expect(textWidth(l, 1, false), `${e.id}: "${l}"`).toBeLessThanOrEqual(EVENT_TEXT_W);
      for (const c of e.choices) {
        expect(textWidth(c.label, 1, true), c.label).toBeLessThanOrEqual(110);
        expect(c.outcomes.length).toBeGreaterThan(0);
        for (const o of c.outcomes) for (const l of o.text.split('\n')) expect(textWidth(l, 1, false), `${e.id}: "${l}"`).toBeLessThanOrEqual(EVENT_TEXT_W);
      }
      // a small risk or reward: something changes in at least one outcome
      expect(e.choices.some((c) => c.outcomes.some((o) => o.coins || o.hp || o.heal || o.maxHp || o.atk || o.pet || o.boost))).toBe(true);
    }
  });
});

describe('tuning sees the content', () => {
  it('enemies and act scaling come from src/data and stay editable', () => {
    expect(Object.keys(DEFAULT_TUNING.enemies)).toEqual(Object.keys(ENEMIES));
    expect(DEFAULT_TUNING.enemies.boar).toEqual(ENEMIES.boar);
    expect(DEFAULT_TUNING.enemies.boar).not.toBe(ENEMIES.boar); // a copy: the panel never edits the data
    expect(DEFAULT_TUNING.acts.map((a) => a.hpMult)).toEqual(GREENMARCH.acts.map((a) => a.hpMult));
  });

  it("every slider path points at a number, including the specials' timings", () => {
    const t = cloneTuning();
    const paths = sliderGroups(t).flatMap((g) => g.sliders.map((s) => s.path));
    for (const p of paths) expect(typeof getPath(t, p), p).toBe('number');
    expect(paths).toContain('enemies.boar.specials.0.every');
    expect(paths).toContain('enemies.slime.specials.0.hpBelow');
    expect(paths).toContain('acts.2.hpMult');
    expect(paths).toContain('map.restHeal');
  });

  it('a saved special timing survives the round trip through storage (diff + merge)', () => {
    const t = cloneTuning();
    setPath(t, 'enemies.boar.specials.0.every', 3.5);
    setPath(t, 'acts.1.hpMult', 2.2);
    const saved = JSON.parse(JSON.stringify(tuningDiff(t, DEFAULT_TUNING)));
    const back = cloneTuning();
    mergeKnown(back, saved);
    expect(back.enemies.boar.specials[0].every).toBe(3.5);
    expect(back.acts[1].hpMult).toBe(2.2);
    expect(back.acts[0]).toEqual(DEFAULT_TUNING.acts[0]);
  });
});
