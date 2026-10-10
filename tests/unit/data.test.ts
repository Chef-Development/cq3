// Content checks: the data in src/data fits together (every encounter's enemies exist, every scene and event
// exists, story boxes fit their text box) and the tuning panel can see it.
import { ALL_ACTS } from '../../src/data/regions';
import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { EVENTS } from '../../src/data/events';
import { GREENMARCH } from '../../src/data/greenmarch';
import { SPEAKER_NAME, STORY } from '../../src/data/story';
import { DUSK_STORY } from '../../src/data/story-dusk';
import { STORY_BANTER, STORY_SCENE_ACT } from '../../src/data/banter-story';
import { NOON_BANTER, NOON_SCENE_ACT } from '../../src/data/banter-noon';
import { ISLES_BANTER, ISLES_SCENE_ACT } from '../../src/data/banter-isles';
import { NOON_STORY } from '../../src/data/story-noon';
import { HUSH_STORY } from '../../src/data/story-hush';
import { REACH_STORY } from '../../src/data/story-reach';
import { WICK_STORY } from '../../src/data/story-wick';
import { SALT_STORY } from '../../src/data/story-salt';
import { FAR_STORY } from '../../src/data/story-far';
import { END_STORY } from '../../src/data/story-end';
import { BANTER, HERO_BANTER, type CampSpeaker } from '../../src/data/banter';
import { HEROES } from '../../src/data/heroes';
import { TIER_INFO } from '../../src/data/rarity';
import { STYLES } from '../../src/data/styles';
import { heroColW, KIT_CARD_W, KIT_LABELS } from '../../src/engine/view/heroes';
import { cloneTuning, DEFAULT_TUNING, getPath, mergeKnown, setPath, sliderGroups, tuningDiff } from '../../src/core/tuning';
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

  it('every red attack is fair to a thumb: never thin, a wide enough window even at 1.5x cursor speed in the fastest act, waves spaced so each red can be blocked on its own', () => {
    const T = DEFAULT_TUNING;
    const v = 1.5 / T.cursor.basePassSec; // the cursor at 1.5x, heading into the reds
    const fastest = Math.max(...T.acts.map((a) => a.redSpeed)); // later acts' reds cross the bar faster...
    expect(fastest).toBeLessThanOrEqual(1.5);
    // ...so each foe is checked at the fastest act it appears in (a foe in no act's lists, a summon: the fastest)
    const speedOf: Record<string, number> = {};
    ALL_ACTS.forEach((act, i) => {
      const keys = [...act.fights.early.flat(), ...act.fights.late.flat(), ...act.elites.flat(), ...act.boss, ...(act.packs ?? []).flat(2)];
      for (const k of keys) speedOf[k] = Math.max(speedOf[k] ?? 0, T.acts[i].redSpeed);
    });
    const RED = ['red', 'shield', 'bomb', 'speed'];
    for (const [key, e] of Object.entries(ENEMIES)) {
      const actSpeed = speedOf[key] ?? fastest;
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
            const { w, closing } = at(b);
            const windowSec = (w + T.cursor.widthFrac) / closing + (2 * T.judge.redGraceMs) / 1000;
            expect(windowSec, `${name}: blocking window`).toBeGreaterThanOrEqual(0.12);
          }
          // icicles (still reds) sit at spots picked a quarter of the bar apart (specials.ts spotFor), and give the
          // cursor more than a full pass to reach them before they strike
          for (const b of reds) if (b.still) expect(b.fuse ?? 0, `${key}.${s.id}: an icicle's fuse`).toBeGreaterThanOrEqual(1.4);
          // in a wave, the cursor meets one red at a time: at least 0.16 s apart (a thumb taps about every 0.14 s)
          for (let i = 0; i < reds.length; i++)
            for (let j = i + 1; j < reds.length; j++) {
              const [p, q] = [reds[i], reds[j]];
              if (p.still && q.still) continue;
              const gap = p.at !== undefined && q.at !== undefined ? Math.abs(p.at - q.at) : Math.abs((q.delay ?? 0) - (p.delay ?? 0)) * Math.min(at(p).vel, at(q).vel);
              expect(gap / Math.max(at(p).closing, at(q).closing), `${key}.${s.id}: reds ${i} and ${j} too close`).toBeGreaterThanOrEqual(0.16);
            }
        }
    }
  });

  it('every scene the region names exists', () => {
    const ids = [GREENMARCH.introScene, GREENMARCH.victoryScene, ...GREENMARCH.acts.flatMap((a) => [a.startScene, a.bossScene, ...(a.winScene ? [a.winScene] : [])])];
    for (const id of ids) expect(STORY[id ?? ''], id).toBeDefined();
  });
});

describe('story', () => {
  it('has every beat: intro, Pip joins, the three bosses, the boss phases, victory', () => {
    for (const id of ['intro', 'act1', 'captain', 'golem', 'boarKing', 'boarKing2', 'boarKing3', 'victory']) expect(STORY[id], id).toBeDefined();
    expect(STORY.act1.some((b) => b.who === 'pip')).toBe(true);
    expect(STORY.intro.map((b) => b.text).join(' ')).toMatch(/Great Atlas/);
    // the boss's phases are the Mapmaker's edits, and the region ends with him failing to erase Rowan
    for (const id of ['boarKing', 'boarKing2', 'boarKing3', 'victory']) expect(STORY[id].some((b) => b.who === 'mapmaker'), id).toBe(true);
    expect(STORY.victory.map((b) => b.text).join(' ')).toMatch(/Who drew you/);
  });

  it('gets a new player to the first fight fast: at most 4 boxes before it (the intro and Act 1\'s opening)', () => {
    expect(STORY[GREENMARCH.introScene].length + STORY[GREENMARCH.acts[0].startScene ?? ''].length).toBeLessThanOrEqual(4);
  });

  it("drafts the fifth region's scenes to the same rules (not in play yet: story-noon.ts); the fourth's are written", () => {
    for (const id of ['noon1', 'sphinx', 'noon2', 'brassLion', 'noon3', 'noonBoss', 'noonBoss2', 'noonBoss3', 'noonVictory']) expect(NOON_STORY[id], id).toBeDefined();
    for (const id of ['noonBoss2', 'noonBoss3']) expect(NOON_STORY[id].some((b) => b.who === 'mapmaker'), id).toBe(true);
    for (const [id, boxes] of Object.entries(NOON_STORY)) expect(boxes.some((b) => b.text.includes('(Scene to come)')), id).toBe(false);
    // the fourth region's scenes are the story's, not stand-ins; its boss's phases are his edits
    for (const [id, boxes] of Object.entries(DUSK_STORY)) expect(boxes.some((b) => b.text.includes('(Scene to come)')), id).toBe(false);
    for (const id of ['lighthouse2', 'lighthouse3', 'duskVictory']) expect(DUSK_STORY[id].some((b) => b.who === 'mapmaker'), id).toBe(true);
    // once a region is wired in, STORY takes these very scenes (Object.assign), never a second copy
    for (const [id, boxes] of Object.entries(NOON_STORY)) expect(!(id in STORY) || STORY[id] === boxes, id).toBe(true);
    // the sixth region's, drafted ahead of its data: the same rules; its boss's phases are his edits
    for (const id of ['hush1', 'shears', 'hushCamp', 'hush2', 'hollowfang', 'hush3', 'yew', 'yew2', 'yew3', 'hushVictory']) expect(HUSH_STORY[id], id).toBeDefined();
    for (const id of ['yew2', 'yew3', 'hushVictory']) expect(HUSH_STORY[id].some((b) => b.who === 'mapmaker'), id).toBe(true);
    // the seventh's and eighth's too (the eighth's Act 2 opening is the river twist: he never names his son)
    for (const id of ['reach1', 'ropewright', 'reachCamp', 'reach2', 'squall', 'reach3', 'kestrel', 'kestrel2', 'kestrel3', 'reachVictory']) expect(REACH_STORY[id], id).toBeDefined();
    for (const id of ['wick1', 'polisher', 'wickCamp', 'wick2', 'press', 'wick3', 'mender', 'mender2', 'mender3', 'wickVictory']) expect(WICK_STORY[id], id).toBeDefined();
    for (const id of ['kestrel2', 'kestrel3', 'mender2', 'mender3']) expect({ ...REACH_STORY, ...WICK_STORY }[id].some((b) => b.who === 'mapmaker'), id).toBe(true);
    for (const id of ['salt1', 'saltworks', 'saltCamp', 'salt2', 'gale', 'salt3', 'brine', 'brine2', 'brine3', 'saltVictory']) expect(SALT_STORY[id], id).toBeDefined();
    for (const id of ['farVictory', 'hallWakes']) expect(FAR_STORY[id], id).toBeDefined();
    // the end: he is named only once, at the end of lowTruth (the first 'ambrose' box), and never before it
    const named = END_STORY.lowTruth;
    expect(named[named.length - 1]).toEqual({ who: 'ambrose', text: '...Rowan.' });
    for (const [id, boxes] of Object.entries({ ...STORY, ...DUSK_STORY, ...NOON_STORY, ...HUSH_STORY, ...REACH_STORY, ...WICK_STORY, ...SALT_STORY, ...FAR_STORY })) for (const b of boxes) expect(b.who, id).not.toBe('ambrose');
    const drafts = [NOON_STORY, HUSH_STORY, REACH_STORY, WICK_STORY, SALT_STORY, FAR_STORY, END_STORY];
    for (const [id, boxes] of Object.entries({ ...NOON_STORY, ...HUSH_STORY, ...REACH_STORY, ...WICK_STORY, ...SALT_STORY, ...FAR_STORY, ...END_STORY })) {
      expect(!(id in STORY) || STORY[id] === boxes, id).toBe(true);
      expect(drafts.filter((d) => id in d).length, `${id}: one region's id`).toBe(1);
      for (const b of boxes) if (b.who === 'mapmaker') expect(b.text, id).not.toMatch(/\bRowan\b/);
      expect(boxes.length, id).toBeLessThanOrEqual(6);
      for (const b of boxes) {
        const lines = b.text.split('\n');
        expect(lines.length, `${id}: ${b.text}`).toBeLessThanOrEqual(2);
        for (const l of lines) expect(textWidth(l, 1, false), `${id}: "${l}"`).toBeLessThanOrEqual(STORY_TEXT_W);
        expect(SPEAKER_NAME[b.who]).toBeDefined();
      }
    }
  });

  it('keeps the narrator calm: no exclamation marks (docs/story-bible.md, Voices)', () => {
    const all = { ...STORY, ...DUSK_STORY, ...NOON_STORY, ...HUSH_STORY, ...REACH_STORY, ...WICK_STORY, ...SALT_STORY, ...FAR_STORY, ...END_STORY };
    for (const [id, boxes] of Object.entries(all)) for (const b of boxes) if (b.who === 'narrator') expect(b.text, id).not.toContain('!');
  });

  it("keeps the Mapmaker's and the High Keeper's voices: no contractions (docs/story-bible.md, Voices)", () => {
    const all = { ...STORY, ...DUSK_STORY, ...NOON_STORY, ...HUSH_STORY, ...REACH_STORY, ...WICK_STORY, ...SALT_STORY, ...FAR_STORY, ...END_STORY };
    for (const [id, boxes] of Object.entries(all)) {
      for (const b of boxes) if (b.who === 'mapmaker' || b.who === 'keeper') expect(b.text, `${id}: ${b.text}`).not.toMatch(/\b(it|that|he|she|there|what|who|here|let)'s\b|n't\b|'(re|ll|ve|d|m)\b/i); // a possessive is fine
    }
  });

  it('keeps the old story out: no pendulum, no weights to bring home', () => {
    for (const [id, boxes] of Object.entries(STORY)) {
      for (const b of boxes) expect(b.text, id).not.toMatch(/pendulum|(first|second|third|next|\d+) weights?\b|weights? home/i);
    }
  });

  it("has the second region's beats, and an arrival for every chest hero (2-4 boxes, in their own voice)", () => {
    for (const id of ['frost1', 'rimehorn', 'neveJoin', 'frost2', 'matron', 'frost3', 'glacia', 'glacia2', 'glacia3', 'frostVictory']) expect(STORY[id], id).toBeDefined();
    expect(STORY.neveJoin.some((b) => b.who === 'neve')).toBe(true);
    for (const id of ['glacia2', 'glacia3', 'frostVictory']) expect(STORY[id].some((b) => b.who === 'mapmaker'), id).toBe(true);
    expect(STORY.frostVictory.map((b) => b.text).join(' ')).toMatch(/Ashfell/);
    const met = Object.values(HEROES)
      .filter((h) => h.joins === 'chest')
      .map((h) => [h.meetScene ?? '', h.id] as const);
    for (const id of ['meetMoss', 'meetTam', 'meetHollis', 'meetVesper', 'meetTorva']) expect(met.some(([s]) => s === id), id).toBe(true);
    for (const [id, who] of met) {
      expect(STORY[id], id).toBeDefined();
      expect(STORY[id].length, id).toBeGreaterThanOrEqual(2);
      expect(STORY[id].length, id).toBeLessThanOrEqual(4);
      expect(STORY[id].some((b) => b.who === who), id).toBe(true);
    }
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
    const all = [...BANTER, ...HERO_BANTER];
    expect(new Set(all.map((l) => l.text)).size).toBe(all.length);
    for (const l of all) {
      const lines = wrap(l.text);
      expect(lines.length, l.text).toBeLessThanOrEqual(2);
      for (const x of lines) expect(textWidth(x, 1, false), l.text).toBeLessThanOrEqual(BUBBLE_W);
    }
  });

  it("the story's banter waits for a scene that exists, and fits the bubble like the rest", () => {
    for (const l of STORY_BANTER) {
      expect(STORY[l.after], `${l.text}: after ${l.after}`).toBeDefined();
      const lines = wrap(l.text);
      expect(lines.length, l.text).toBeLessThanOrEqual(2);
      for (const x of lines) expect(textWidth(x, 1, false), l.text).toBeLessThanOrEqual(BUBBLE_W);
    }
    for (const id of Object.keys(STORY_SCENE_ACT)) expect(STORY[id], id).toBeDefined();
    const all = [...BANTER, ...HERO_BANTER, ...STORY_BANTER];
    expect(new Set(all.map((l) => l.text)).size).toBe(all.length);
  });

  it("the fifth region's banter waits for its own scenes (story-noon.ts) and fits the bubble", () => {
    for (const l of NOON_BANTER) {
      expect(NOON_STORY[l.after], `${l.text}: after ${l.after}`).toBeDefined();
      const lines = wrap(l.text);
      expect(lines.length, l.text).toBeLessThanOrEqual(2);
      for (const x of lines) expect(textWidth(x, 1, false), l.text).toBeLessThanOrEqual(BUBBLE_W);
    }
    for (const id of Object.keys(NOON_STORY)) expect(NOON_SCENE_ACT[id], id).toBeDefined();
    const all = [...BANTER, ...HERO_BANTER, ...STORY_BANTER, ...NOON_BANTER];
    expect(new Set(all.map((l) => l.text)).size).toBe(all.length);
  });

  it('grown-up wit (L8): at most one exclamation mark a line', () => {
    for (const l of [...BANTER, ...HERO_BANTER, ...STORY_BANTER, ...NOON_BANTER, ...ISLES_BANTER]) expect((l.text.match(/!/g) ?? []).length, l.text).toBeLessThanOrEqual(1);
  });

  it("the first isles' banter waits for their drafted scenes and fits the bubble", () => {
    const drafts = { ...HUSH_STORY, ...REACH_STORY, ...WICK_STORY, ...SALT_STORY };
    for (const l of ISLES_BANTER) {
      expect(drafts[l.after], `${l.text}: after ${l.after}`).toBeDefined();
      const lines = wrap(l.text);
      expect(lines.length, l.text).toBeLessThanOrEqual(2);
      for (const x of lines) expect(textWidth(x, 1, false), l.text).toBeLessThanOrEqual(BUBBLE_W);
    }
    for (const id of Object.keys(drafts)) expect(ISLES_SCENE_ACT[id], id).toBeDefined();
    const all = [...BANTER, ...HERO_BANTER, ...STORY_BANTER, ...NOON_BANTER, ...ISLES_BANTER];
    expect(new Set(all.map((l) => l.text)).size).toBe(all.length);
  });

  it('lines that need Sable say so; Rowan and Pip have plenty without them', () => {
    for (const l of BANTER) if (/sable/i.test(l.text)) expect(l.sable || l.who === 'sable', l.text).toBe(true);
    expect(BANTER.filter((l) => l.who !== 'sable' && !l.sable).length).toBeGreaterThanOrEqual(10);
  });

  it("the new heroes' lines need whoever they name; each new hero has a few of their own", () => {
    const NEW: CampSpeaker[] = ['neve', 'moss', 'tam', 'hollis', 'vesper', 'torva', 'solenne', 'wren', 'yara', 'dell', 'fizz', 'brann', 'gorm', 'tess'];
    const everyone: CampSpeaker[] = ['rowan', 'pip', 'sable', 'smith', ...NEW];
    for (const l of HERO_BANTER) {
      const needs = [l.who, ...(l.with ?? [])];
      for (const k of everyone) if (new RegExp(`\\b${SPEAKER_NAME[k]}\\b`).test(l.text)) expect(needs, l.text).toContain(k);
      expect(needs.some((k) => NEW.includes(k)), `${l.text}: belongs in BANTER`).toBe(true);
    }
    for (const h of NEW) expect(HERO_BANTER.filter((l) => l.who === h).length, h).toBeGreaterThanOrEqual(4);
  });
});

describe('hero select lines', () => {
  // the narrowest layout: the iPhone's safe areas (22 px each side)
  const COL = heroColW(22, 305);

  it("every hero's name (bold 2) and title share a line in the hero select's column", () => {
    for (const h of Object.values(HEROES)) expect(textWidth(h.name, 2, true) + 5 + textWidth(h.title, 1, false), h.name).toBeLessThanOrEqual(COL);
  });

  it("every hero's rarity and style chips share a row; the kit cards' one-word labels fit their cards (bold, never cut)", () => {
    for (const h of Object.values(HEROES)) {
      const chips = textWidth(TIER_INFO[h.rarity].name, 1, true) + 8 + 4 + 9 + 5 + textWidth(STYLES[h.style].name, 1, true) + 4;
      expect(chips, h.name).toBeLessThanOrEqual(COL);
    }
    // each label is centred under its card: what two neighbours hang past their cards must leave 2 px between them,
    // and the last one stays inside the safe area
    const gap = Math.floor((COL - 4 * KIT_CARD_W) / 3);
    const over = KIT_LABELS.map((l) => Math.max(0, textWidth(l, 1, true) - KIT_CARD_W) / 2);
    for (let i = 0; i + 1 < over.length; i++) expect(over[i] + over[i + 1], `${KIT_LABELS[i]} / ${KIT_LABELS[i + 1]}`).toBeLessThanOrEqual(gap - 2);
    expect(over[over.length - 1]).toBeLessThanOrEqual(3);
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
    expect(DEFAULT_TUNING.acts.map((a) => a.hpMult)).toEqual(ALL_ACTS.map((a) => a.hpMult)); // every region's acts, in order
    expect(ALL_ACTS.slice(0, 3)).toEqual(GREENMARCH.acts);
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

describe("the regions' own events", () => {
  it('each region has two of its own, and an act map only ever holds its region’s and the ones for anywhere', async () => {
    const { eventIdsFor } = await import('../../src/data/events');
    const { REGIONS } = await import('../../src/data/regions');
    for (const r of REGIONS) {
      expect(EVENTS.filter((e) => e.region === r.id).length, r.id).toBeGreaterThanOrEqual(2);
      for (const act of r.acts) {
        const ids = eventIdsFor(act);
        for (const id of ids) {
          const e = EVENTS.find((x) => x.id === id)!;
          expect(!e.region || e.region === r.id, `${act.name}: ${id}`).toBe(true);
        }
        expect(ids.length).toBeGreaterThan(EVENTS.filter((e) => !e.region).length);
      }
    }
    // a region's events may be written ahead of it (the world plan's next region), never for a land that isn't planned
    const { WORLD_PLAN } = await import('../../src/core/world-plan');
    for (const e of EVENTS) if (e.region) expect(WORLD_PLAN.some((r) => r.id === e.region), e.id).toBe(true);
  });
});

describe("the regions' story bounties", () => {
  it('one per region, on a real bounty, each line fitting the board and the tracker', async () => {
    const { QUEST_STORIES, questById, questStory } = await import('../../src/data/quests');
    const { REGIONS } = await import('../../src/data/regions');
    for (const r of REGIONS) expect(QUEST_STORIES.filter((s) => s.region === r.id).length, r.id).toBe(1);
    const { WORLD_PLAN } = await import('../../src/core/world-plan');
    for (const s of QUEST_STORIES) expect(WORLD_PLAN.some((r) => r.id === s.region), s.region).toBe(true);
    expect(new Set(QUEST_STORIES.map((s) => s.region)).size).toBe(QUEST_STORIES.length);
    for (const s of QUEST_STORIES) {
      expect(questById(s.quest), s.quest).toBeDefined();
      expect(questById(s.quest)?.style, s.quest).toBeUndefined(); // a board posts it (style calls come another way)
      expect(textWidth(s.frame, 1, false), s.frame).toBeLessThanOrEqual(230);
      expect(textWidth(s.payoff, 1, false), s.payoff).toBeLessThanOrEqual(240);
      expect(questStory(s.region, s.quest)).toBe(s);
    }
    expect(questStory('greenmarch', 'combo')).toBeUndefined();
  });
});
