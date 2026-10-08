// "Teach it slowly": the tips (src/data/tips.ts) and the coach that picks one (src/core/tips.ts): each tip fires at
// its moment and only once, in the teaching order (each after the tips it waits for) and one at a time, never while
// tips are off; a tip the player has shown they know is skipped; the first fight teaches the five basics; a bar rule's
// and a hero's tip come on first meeting only; seen tips live in the profile (a returning player has the basics marked
// seen); the welcome back plays once, only for a returning player.
import { describe, expect, it } from 'vitest';
import { STORY } from '../../src/data/story';
import { HERO_IDS } from '../../src/data/heroes';
import { BASIC_TIPS, FIRST_FIGHT, TIP_IDS, TIP_TEXT_W, TIPS, WELCOME_ID, tipById, type TipId } from '../../src/data/tips';
import { DT, isRed, type Combat, type CombatEvent } from '../../src/core/combat';
import { newProfile, readProfile, type Profile } from '../../src/core/profile';
import { Rng } from '../../src/core/rng';
import { Run } from '../../src/core/run';
import { COACH_DEFAULTS, markWelcomed, TipCoach, welcomeScene, type TipMoment } from '../../src/core/tips';
import { REGIONS } from '../../src/data/regions';
import { cloneTuning, DEFAULT_SETTINGS } from '../../src/core/tuning';
import { textWidth } from '../../src/engine/font';

const T = cloneTuning();
const viaJson = <X>(x: X): X => JSON.parse(JSON.stringify(x)) as X;

/** A run on Act 1's map (scenes skipped), with a coach on its profile. */
function setup(p: Profile = newProfile(), seed = 7) {
  const run = new Run(T, { ...DEFAULT_SETTINGS }, seed, p);
  run.newRun();
  run.skipScenes();
  const coach = new TipCoach(p);
  const at = (o: Partial<TipMoment> = {}): TipMoment => ({ run, safe: true, ...o });
  /** The tip due now, shown (marked seen) if there is one. */
  const take = (o: Partial<TipMoment> = {}): TipId | null => {
    const m = at(o);
    const cue = coach.next(m);
    if (cue) coach.shown(cue, m);
    return cue?.id ?? null;
  };
  return { run, coach, p, at, take };
}

/** Walk to the first node of `type` (by any path) and enter it. */
function goTo(run: Run, type: string): void {
  const m = run.map;
  const target = m.nodes.find((n) => n.type === type)!;
  const path = [target.id];
  while (m.nodes[path[0]].row > 0) path.unshift(m.nodes.find((q) => q.next.includes(path[0]))!.id);
  run.path = path.slice(0, -1);
  run.phase = 'map';
  run.chooseNode(target.id);
}

const setTime = (run: Run, s: number) => (run.combat!.tick = Math.round(s / DT));
/** The tips a profile has learned up to (and not including) `id` in the first fight's order. */
const before = (id: TipId): TipId[] => FIRST_FIGHT.slice(0, FIRST_FIGHT.indexOf(id));

// ---------------------------------------------------------------- a new player's first fights, as the app plays them

/** The fight's iris (view/transition.ts) and its settle (view/tips.ts SETTLE.fight): before then the view never
 *  offers a pre-fight tip on its own. */
const IRIS_MS = 330;
const SETTLE_FIGHT_MS = 450;
const FRAME_MS = 1000 / 60;

interface Shown {
  id: TipId;
  fight: number;
  /** Fight time (s) when it went up (0 before the fight began). */
  at: number;
  pre: boolean;
}

/** A new player's thumb: taps a yellow, green or red once it has been on the bar a reaction time (0.3 s), aiming at its
 *  middle, hitting 85% of the time (a miss lets the cursor pass), at most one tap every 0.15 s; never a purple; the
 *  finisher only once taught. */
function playStep(c: Combat, rng: Rng, st: { decided: Map<string, boolean>; busy: number }, knowsFinisher: boolean): void {
  const t = c.time;
  if (knowsFinisher && c.finisherReady && t >= st.busy) {
    c.finisher();
    st.busy = t + 0.3;
    return;
  }
  const u = c.underCursor(t);
  const b = u.red ?? u.attack;
  if (!b || t < st.busy || t - b.bornAt < 0.3 || !(b.kind === 'yellow' || b.kind === 'green' || isRed(b.kind))) return;
  const key = `${b.id}:${Math.floor(c.cursorPhase)}`;
  if (!st.decided.has(key)) st.decided.set(key, rng.next() < 0.85);
  if (st.decided.get(key) && Math.abs(c.cursorPos() - b.pos) < b.width * 0.2) {
    st.decided.set(key, false);
    c.tap(t);
    st.busy = t + 0.15;
  }
}

/**
 * A new player's first fights through the real flow: a fresh profile (or `profile`), Act 1 via Run (the map, then a
 * fight node each step), the coach asked every frame at the safe moments the app gives (any screen once it's up; a
 * fight's pre-fight tip only after the iris and the settle, unless TAP TO BEGIN asks for it: `holdBegin`, as App.begin
 * does), fed every step's events, the fight stepped with the new player's thumb. TAP TO BEGIN comes `beginMs(n)` ms
 * after fight n's screen opens. `oldGame`: as the game was (TAP TO BEGIN never held, nothing counted toward a tip's
 * `known`). Returns every tip shown.
 */
function firstFights(o: { seed: number; fights: number; beginMs: (n: number) => number; profile?: Profile; oldGame?: boolean }): Shown[] {
  const p = o.profile ?? newProfile();
  const run = new Run(T, { ...DEFAULT_SETTINGS }, o.seed, p);
  const coach = new TipCoach(p);
  const rng = new Rng(o.seed * 31 + 7);
  const shown: Shown[] = [];
  let fight = 0;
  const show = (m: TipMoment, cue: ReturnType<TipCoach['next']>, at: number) => {
    if (!cue) return;
    coach.shown(cue, m);
    shown.push({ id: cue.id, fight, at, pre: !!m.preFight });
  };
  run.newRun();
  run.skipScenes();
  for (let guard = 0; guard < 300; guard++) {
    const ph = run.phase;
    if (ph === 'map') {
      const m = { run, safe: true };
      show(m, coach.next(m), 0);
      const ch = run.choices();
      run.chooseNode(ch.find((id) => run.map.nodes[id].type === 'fight') ?? ch[0]);
    } else if (ph === 'fight') {
      fight++;
      if (fight > o.fights) break;
      const c = run.combat!;
      if (o.oldGame) p.tipsDone = {};
      // waiting for TAP TO BEGIN: the view offers a pre-fight tip once the screen has settled
      for (let ms = 0; ms < o.beginMs(fight); ms += FRAME_MS) {
        const m = { run, safe: ms >= IRIS_MS + SETTLE_FIGHT_MS, preFight: true };
        show(m, coach.next(m), 0);
      }
      // the tap (and the taps that dismiss what it brought up, then begin)
      for (let k = 0; !o.oldGame && k < 5; k++) {
        const m = { run, safe: true, preFight: true };
        const cue = coach.holdBegin(m);
        if (!cue) break;
        show(m, cue, 0);
      }
      const st = { decided: new Map<string, boolean>(), busy: 0 };
      for (let i = 0; i < 300 / DT && !c.result; i++) {
        c.step();
        playStep(c, rng, st, coach.learned('finisher'));
        coach.feed(c.drainEvents(), c);
        const m = { run, safe: true };
        show(m, coach.next(m), c.time);
        run.sync();
      }
      run.sync();
    } else if (ph === 'loot') run.collectLoot();
    else if (ph === 'boost') run.pickBoost(0);
    else if (ph === 'treasure') run.openTreasure();
    else if (ph === 'rest') run.rest();
    else if (ph === 'shop') run.leaveShop();
    else if (ph === 'bounty') run.takeQuest();
    else if (ph === 'event') {
      run.chooseEvent(0);
      run.endEvent();
      if (run.phase === 'event') run.phase = 'map';
    } else if (ph === 'scene') run.skipScenes();
    else break;
  }
  return shown;
}

/** The playtester: TAP TO BEGIN at once (0.3 s) in the first two fights, a moment's pause (1.5 s) in the third. */
const QUICK = (n: number) => (n < 3 ? 300 : 1500);

describe('tips data', () => {
  it('has unique ids, one or two lines each, and every line fits the card at 8x', () => {
    expect(new Set(TIP_IDS).size).toBe(TIPS.length);
    for (const t of TIPS)
      for (const lines of [t.lines, t.buttonLines ?? t.lines]) {
        expect(lines.length, t.id).toBeGreaterThan(0);
        expect(lines.length, t.id).toBeLessThanOrEqual(2);
        for (const l of lines) {
          expect(l.length, `${t.id}: "${l}"`).toBeLessThanOrEqual(46);
          expect(textWidth(l, 1, false), `${t.id}: "${l}"`).toBeLessThanOrEqual(TIP_TEXT_W);
          expect(l, t.id).not.toMatch(/\.\.\.$/); // never cut off
        }
      }
  });

  it('the basics are the first-run systems; relics, skills and heroes are not among them', () => {
    for (const id of ['tapYellow', 'blockRed', 'purple', 'green', 'finisher', 'special', 'comboBreak', 'map', 'loot', 'rest', 'shop', 'event', 'defeat', 'actClear', 'camp'])
      expect(BASIC_TIPS, id).toContain(id);
    for (const id of ['relicPick', 'synergy', 'relicBelt', 'levelUp', 'skills', 'heroes', 'relicLog']) expect(BASIC_TIPS, id).not.toContain(id);
  });

  it('the welcome back scenes are short: Pip, at most 3 boxes', () => {
    for (const id of ['welcomeBack', 'welcomeBackVisitor', 'welcomeBackSoon']) {
      expect(STORY[id], id).toBeDefined();
      expect(STORY[id].length).toBeLessThanOrEqual(3);
      expect(STORY[id].every((b) => b.who === 'pip')).toBe(true);
    }
  });
});

describe('the coach', () => {
  it('a first fight: tapYellow before TAP TO BEGIN (once), then the first red when the fight runs', () => {
    const { run, coach, take, p } = setup();
    expect(take()).toBe('map'); // the first map
    run.chooseNode(run.choices()[0]);
    while (run.node!.type !== 'fight') {
      run.phase = 'map';
      run.path = [];
      run.chooseNode(run.choices().find((id) => run.map.nodes[id].type === 'fight')!);
    }
    expect(run.phase).toBe('fight');
    // not before the fight's TAP TO BEGIN unless it's the pre-fight tip; never twice
    expect(take({ preFight: true })).toBe('tapYellow');
    expect(take({ preFight: true })).toBeNull();
    // a red on the bar while still waiting to begin is not shown before the fight runs
    const c = run.combat!;
    const red = c.spawnBlock('red', 0.85);
    expect(take({ preFight: true })).toBeNull();
    // the fight runs: the red's tip comes up at once, about that block (the pre-fight tip doesn't hold it back)
    setTime(run, 2);
    const cue = coach.next({ run, safe: true });
    expect(cue).toMatchObject({ id: 'blockRed', block: red.id });
    coach.shown(cue!, { run, safe: true });
    expect(p.tips).toContain('blockRed');
    // only once
    setTime(run, 20);
    c.spawnBlock('red', 0.6);
    expect(coach.next({ run, safe: true })).toBeNull();
  });

  it("TAP TO BEGIN holds for a pre-fight tip still due (the caller shows it), and only for one", () => {
    const { run, coach, p } = setup();
    goTo(run, 'fight');
    const m = { run, safe: false, preFight: true };
    // not settled yet (the view would wait), but the tap asks: it comes up now
    expect(coach.next(m)).toBeNull();
    const cue = coach.holdBegin(m);
    expect(cue?.id).toBe('tapYellow');
    coach.shown(cue!, m);
    expect(coach.holdBegin(m)).toBeNull(); // then the next tap begins
    // tips off: never held
    const off = setup();
    off.p.tipsOff = true;
    goTo(off.run, 'fight');
    expect(off.coach.holdBegin({ run: off.run, safe: false, preFight: true })).toBeNull();
    expect(p.tips).toContain('tapYellow');
  });

  it("Act 1's first fight teaches blocking: the red's tip comes up in it, soon after the first red", () => {
    let late = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const { run, coach, take } = setup(newProfile(), seed);
      run.chooseNode(run.choices()[0]);
      expect(take({ preFight: true })).toBe('tapYellow');
      const c = run.combat!;
      let firstRed = -1;
      let redTip = -1;
      for (let i = 0; i < 30 / DT && !c.result && redTip < 0; i++) {
        c.step();
        const events = c.drainEvents();
        if (firstRed < 0 && events.some((e) => e.type === 'spawn' && e.kind === 'red')) firstRed = c.time;
        coach.feed(events, c);
        const cue = coach.next({ run, safe: true });
        if (cue) coach.shown(cue, { run, safe: true });
        if (cue?.id === 'blockRed') redTip = c.time;
      }
      expect(firstRed, `seed ${seed}: a red in the first 30 s`).toBeGreaterThanOrEqual(0);
      expect(redTip, `seed ${seed}: the red's tip in the first fight`).toBeGreaterThanOrEqual(0);
      if (redTip - firstRed > 0.1) late++;
    }
    // at the very first red: nothing comes before it any more (a special's tip waits for the basics)
    expect(late).toBe(0);
  });

  it("each basic's tip comes while its thing is on the bar, once the ones before it are learned: a red, a green, a purple, a full meter", () => {
    const put: Record<string, (c: Combat) => number | undefined> = {
      blockRed: (c) => c.spawnBlock('red', 0.85).id,
      green: (c) => c.spawnBlock('green', 0.5).id,
      purple: (c) => c.spawnBlock('purple', 0.3).id,
      finisher: (c) => {
        c.stacks = 1;
        return undefined;
      },
    };
    for (const id of FIRST_FIGHT.slice(1)) {
      // its turn: nothing until its thing is on the bar, then it (about that block)
      const { run, coach, p } = setup();
      p.tips.push(...before(id));
      goTo(run, 'fight');
      setTime(run, 1);
      const c = run.combat!;
      expect(coach.next({ run, safe: true }), `${id}: not on the bar yet`).toBeNull();
      const block = put[id](c);
      expect(coach.next({ run, safe: true }), id).toEqual(block === undefined ? { id } : { id, block });
      // before its turn (the tip before it not learned yet): it waits
      const early = setup();
      early.p.tips.push(...before(id).slice(0, -1));
      goTo(early.run, 'fight');
      setTime(early.run, 1);
      put[id](early.run.combat!);
      expect(early.coach.next({ run: early.run, safe: true })?.id, `${id} waits for ${before(id)[before(id).length - 1]}`).not.toBe(id);
    }
    // after the five basics: a special winding up (about its foe); a combo break that cost 2+ stacks (one stack: not
    // worth stopping the fight for)
    const { run, coach, p } = setup();
    goTo(run, 'fight');
    setTime(run, 1);
    const c = run.combat!;
    const e = c.enemies[0];
    c.telegraph = { enemyId: e.id, index: 0, left: 0.8, total: 0.8 };
    expect(coach.next({ run, safe: true }), 'a special waits for the basics').toBeNull();
    p.tips.push(...FIRST_FIGHT);
    expect(coach.next({ run, safe: true })).toEqual({ id: 'special', enemy: e.id });
    c.telegraph = null;
    coach.feed([{ type: 'comboBreak', lost: 12, lostStacks: 1 }], c);
    expect(coach.next({ run, safe: true })).toBeNull();
    coach.feed([{ type: 'comboBreak', lost: 9, lostStacks: 2 }], c);
    expect(coach.next({ run, safe: true })?.id).toBe('comboBreak');
  });

  it("every bar rule's first meeting fires its tip: holds, ice and snow, mirrors, iced yellows, kegs, frozen reds, drifting and paired blocks, an icicle's mark", () => {
    const cases: Array<[TipId, (c: Combat) => CombatEvent[] | void]> = [
      ['hold', (c) => void c.spawnBlock('hold', 0.5)],
      ['ice', (c) => void c.addZone('ice', 0.5, 0.2, 5)],
      ['snow', (c) => void c.addZone('snow', 0.5, 0.2, 5)],
      ['mirror', (c) => void c.spawnBlock('mirror', 0.5)],
      ['iced', () => [{ type: 'chip', id: 7, pos: 0.5, left: 2 }]],
      ['keg', (c) => void c.spawnBlock('keg', 0.5)],
      ['frozen', (c) => void c.spawnBlock('frozen', 0.5)],
      ['drift', (c) => void c.spawnBlock('yellow', 0.5, undefined, undefined, { drift: 0.1 })],
      [
        'pair',
        (c) => {
          const a = c.spawnBlock('yellow', 0.3);
          const b = c.spawnBlock('yellow', 0.7);
          a.link = b.id;
          b.link = a.id;
        },
      ],
      ['icicle', () => [{ type: 'mark', pos: 0.5, sec: 1 }]],
    ];
    for (const [id, put] of cases) {
      const { run, coach } = setup();
      goTo(run, 'fight');
      for (const d of TIPS) if (d.basic) run.profile.tips.push(d.id); // a veteran: the basics are seen
      setTime(run, 1);
      const c = run.combat!;
      coach.feed([], c);
      expect(coach.next({ run, safe: true }), `${id}: never before it comes`).toBeNull();
      coach.feed(put(c) ?? [], c);
      expect(coach.next({ run, safe: true })?.id, id).toBe(id);
    }
  });

  it("one at a time, in teaching order; a few seconds apart and a couple per fight, but never capping the first fight's lessons or a bar rule", () => {
    const { run, coach, p } = setup();
    p.tips.push('tapYellow');
    goTo(run, 'fight');
    setTime(run, 1);
    const c = run.combat!;
    const take = () => {
      const cue = coach.next({ run, safe: true });
      if (cue) coach.shown(cue, { run, safe: true });
      return cue?.id ?? null;
    };
    // a green and a red at once: the red first (blocking comes before greens), then one at a time
    c.spawnBlock('green', 0.4);
    c.spawnBlock('red', 0.9);
    expect(take()).toBe('blockRed');
    expect(take()).toBeNull();
    // the lessons come lessonGapSec apart, four in one fight (never capped)
    const gap = COACH_DEFAULTS.lessonGapSec;
    setTime(run, 1 + gap - 0.1);
    expect(take()).toBeNull();
    setTime(run, 1 + gap);
    expect(take()).toBe('green');
    setTime(run, 1 + 2 * gap);
    c.spawnBlock('purple', 0.7);
    expect(take()).toBe('purple');
    setTime(run, 1 + 3 * gap);
    c.stacks = 1;
    expect(take()).toBe('finisher');
    // the basics in: a special waits for the next fight (two tips per fight at most, four shown)
    c.stacks = 0;
    setTime(run, 30);
    c.telegraph = { enemyId: c.enemies[0].id, index: 0, left: 0.8, total: 0.8 };
    expect(take()).toBeNull();
    // a bar rule's first meeting is never capped
    c.addZone('ice', 0.5, 0.2, 5);
    expect(take()).toBe('ice');
    // the next fight is a new one
    run.startFight();
    setTime(run, 1);
    const c2 = run.combat!;
    c2.telegraph = { enemyId: c2.enemies[0].id, index: 0, left: 0.8, total: 0.8 };
    expect(take()).toBe('special');
  });

  it('nothing while it is not safe (a scene, a wipe, a card in the way), and the moment waits for a safe one', () => {
    const { run, coach } = setup();
    expect(coach.next({ run, safe: false })).toBeNull();
    expect(coach.next({ run, safe: true })?.id).toBe('map');
    goTo(run, 'fight');
    run.profile.tips.push('tapYellow');
    setTime(run, 1);
    run.combat!.spawnBlock('red', 0.85);
    expect(coach.next({ run, safe: false })).toBeNull();
    expect(coach.next({ run, safe: true })?.id).toBe('blockRed');
    // the fight is over: its tips are gone
    run.combat!.result = 'won';
    expect(coach.next({ run, safe: true })).toBeNull();
  });

  it('nothing while tips are off; "Show tips again" brings them back (and turns them on)', () => {
    const { run, coach, p, take } = setup();
    p.tipsOff = true;
    expect(take()).toBeNull();
    goTo(run, 'fight');
    run.combat!.spawnBlock('red', 0.85);
    coach.feed([], run.combat!);
    expect(take({ preFight: true })).toBeNull();
    expect(take()).toBeNull();
    p.tipsOff = false;
    p.tips = [...TIP_IDS];
    p.tipsDone = { tapYellow: 10, finisher: 1 };
    coach.reset();
    expect(p.tipsOff).toBe(false);
    expect(p.tips).toEqual([]);
    expect(p.tipsDone).toEqual({});
    expect(take({ preFight: true })).toBe('tapYellow');
  });

  it('the run: loot, a relic pick then Synergy!, shop, rest, an event, a defeat, an act clear, an elite, a level up', () => {
    const { run, p, take } = setup();
    expect(take()).toBe('map');
    goTo(run, 'fight');
    run.loot = [{} as never];
    run.phase = 'loot';
    expect(take()).toBe('loot');
    run.phase = 'boost';
    run.boostChoices = [
      { id: 'damage', rarity: 'common' },
      { id: 'relic', rarity: 'common', relic: 'powderKeg' },
      { id: 'relic', rarity: 'common', relic: 'shortFuse' },
    ];
    run.hero.relics = ['sapper'];
    const m: TipMoment = { run, safe: true };
    const cue = new TipCoach(p).next(m);
    expect(cue).toMatchObject({ id: 'relicPick', card: 1 }); // relic pick first, at the first relic card
    expect(take()).toBe('relicPick');
    expect(take()).toBeNull(); // one per screen: Synergy! waits for the next pick
    run.phase = 'map';
    take();
    run.phase = 'boost';
    expect(take()).toBe('synergy');
    for (const ph of ['shop', 'rest', 'defeat', 'actClear'] as const) {
      run.phase = ph;
      expect(take(), ph).toBe(ph);
      run.phase = 'map';
      take();
    }
    run.phase = 'event';
    run.event = { id: 'x', choice: -1, outcome: -1, boost: null };
    expect(take()).toBe('event');
    // an elite in reach
    const elite = run.map.nodes.find((n) => n.type === 'elite')!;
    run.path = [];
    run.map.rows[0] = [elite.id, ...run.map.rows[0]];
    run.phase = 'fight';
    take();
    run.phase = 'map';
    expect(take()).toBe('elite');
    // a skill point to spend
    p.heroes.rowan.xp = 400;
    run.phase = 'fight';
    take();
    run.phase = 'map';
    expect(take()).toBe('levelUp');
  });

  it('the first sparkle on the act map: once, only on the map, only while one is glinting', () => {
    const { run, p, take } = setup();
    expect(take({ sparkle: true })).toBe('map'); // the map's own tip comes first (one per screen)
    expect(take({ sparkle: true })).toBeNull();
    // (every other tip seen: only the sparkle's is left to show)
    p.tips = TIP_IDS.filter((id) => id !== 'sparkle');
    goTo(run, 'fight');
    expect(take({ sparkle: true, preFight: true })).toBeNull(); // not in a fight
    run.phase = 'map';
    expect(take()).toBeNull(); // nothing glinting
    expect(take({ sparkle: true })).toBe('sparkle');
    run.phase = 'shop';
    take();
    run.phase = 'map';
    expect(take({ sparkle: true })).toBeNull(); // only once
  });

  it('the camp: its home, then Skills, the relic log, and the hero select once Sable has joined', () => {
    const { run, p, take } = setup();
    run.toCamp();
    expect(take({ campMode: 'home' })).toBe('camp');
    expect(take({ campMode: 'skills' })).toBe('skills');
    expect(take({ campMode: 'relics' })).toBe('relicLog');
    expect(take({ campMode: 'heroes' })).toBeNull(); // only Rowan so far
    expect(take({ campMode: 'home' })).toBeNull();
    p.sableMet = true;
    expect(take({ campMode: 'heroes' })).toBe('heroes');
    expect(take({ campMode: 'bag' })).toBeNull();
  });

  it('the relic belt: before the first fight that carries a relic', () => {
    const { run, take } = setup();
    goTo(run, 'fight');
    expect(take({ preFight: true })).toBe('tapYellow');
    run.startFight();
    expect(take({ preFight: true })).toBeNull(); // no relic yet
    run.hero.relics = ['powderKeg'];
    run.startFight();
    expect(take({ preFight: true })).toBe('relicBelt');
  });

  it("a hero's how-to: before their first fight only, never for another hero (Rowan's is the basics)", () => {
    const p = newProfile();
    p.tips = [...BASIC_TIPS];
    p.heroes.sable.unlocked = true;
    p.heroes.moss.unlocked = true;
    p.hero = 'sable';
    const { run, take } = setup(p);
    goTo(run, 'fight');
    expect(run.combat?.heroId ?? run.hero.build?.id).toBe('sable');
    expect(take({ preFight: true })).toBe('kitSable');
    run.startFight();
    expect(take({ preFight: true })).toBeNull(); // once
    p.hero = 'moss';
    run.refreshGear();
    run.startFight();
    expect(run.combat!.heroId).toBe('moss');
    expect(take({ preFight: true })).toBe('kitMoss');
    // every hero but Rowan has one, each fits the card, and none shows mid-fight
    for (const d of TIPS.filter((x) => x.hero)) expect(d.fight).toBe('pre');
    // (every hero but Rowan: counted from the data, Part 6's new heroes too)
    expect(new Set(TIPS.filter((x) => x.hero).map((x) => x.hero)).size).toBe(HERO_IDS.length - 1);
    expect(TIPS.some((x) => x.hero === 'rowan')).toBe(false);
  });
});

describe('seen tips in the profile', () => {
  it('survive a round trip; unknown ids and repeats are dropped; tips off is kept', () => {
    const p = newProfile();
    p.tips.push('map', 'blockRed');
    p.tipsOff = true;
    const back = readProfile(viaJson(p));
    expect(back.tips).toEqual([WELCOME_ID, 'map', 'blockRed']);
    expect(back.tipsOff).toBe(true);
    const data = viaJson(p) as unknown as Record<string, unknown>;
    data.tips = ['map', 'laserTip', 7, null, 'map', 'skills'];
    data.tipsOff = 'yes';
    expect(readProfile(data)).toMatchObject({ tips: ['map', 'skills'], tipsOff: false });
  });

  it('a profile from before tips that has cleared an act has the basics marked seen; a new one does not', () => {
    const old = { v: 3, actsCleared: 1, heroes: { rowan: { unlocked: true, xp: 0, skills: [] } } };
    const back = readProfile(viaJson(old));
    expect([...back.tips].sort()).toEqual([...BASIC_TIPS].sort());
    expect(readProfile(viaJson({ v: 3, actsCleared: 0 })).tips).toEqual([WELCOME_ID]);
    expect(newProfile().tips).toEqual([WELCOME_ID]);
    // an emptied list ("Show tips again") is kept as it is
    expect(readProfile(viaJson({ ...old, tips: [] })).tips).toEqual([]);
    // the returning player's coach skips the basics and teaches the new systems
    const { run, coach, take } = setup(back);
    expect(take()).toBe('roamer'); // the map is a basic; the packs roaming it are new
    expect(take()).toBeNull(); // (one tip per screen)
    goTo(run, 'fight');
    expect(take({ preFight: true })).toBeNull();
    run.hero.relics = ['powderKeg'];
    run.startFight();
    expect(take({ preFight: true })).toBe('relicBelt');
    run.combat!.spawnBlock('red', 0.85);
    coach.feed([], run.combat!);
    expect(take()).toBeNull();
  });
});

describe('the welcome back', () => {
  it('plays once, only for a returning player, and says where Sable is', () => {
    expect(welcomeScene(newProfile())).toBeNull();
    // a new player who goes on to clear an act never gets it
    const fresh = readProfile(viaJson(newProfile()));
    fresh.actsCleared = 2;
    fresh.heroes.rowan.xp = 900;
    expect(welcomeScene(readProfile(viaJson(fresh)))).toBeNull();
    // returning players (saved before this version): by what they've seen of Sable
    const met = readProfile({ v: 3, actsCleared: 2, sableMet: true, heroes: { sable: { unlocked: true, xp: 0, skills: [] } } });
    expect(welcomeScene(met)).toBe('welcomeBack');
    expect(welcomeScene(readProfile({ v: 2, actsCleared: 1 }, T))).toBe('welcomeBackVisitor');
    expect(welcomeScene(readProfile({ v: 3, actsCleared: 0, heroes: { rowan: { unlocked: true, xp: 40, skills: [] } } }))).toBe('welcomeBackSoon');
    expect(welcomeScene(readProfile({ v: 3, actsCleared: 0 }))).toBeNull(); // nothing to come back to
    // once
    markWelcomed(met);
    expect(welcomeScene(met)).toBeNull();
    expect(welcomeScene(readProfile(viaJson(met)))).toBeNull();
    // "Show tips again" doesn't replay it
    new TipCoach(met).reset();
    expect(welcomeScene(met)).toBeNull();
  });
});

describe('the map extras each teach once, the moment they matter', () => {
  /** A profile that knows everything but the map extras. */
  const knows = (): Profile => {
    const p = newProfile();
    p.tips = TIP_IDS.filter((id) => !['roamer', 'secret', 'bounty', 'merchant', 'skirmish', 'rush'].includes(id));
    return p;
  };

  it('a pack on the map; the secret beside the node; the bounty board; the merchant; a Coin Rush before it begins', () => {
    const { run, coach, at, take } = setup(knows());
    // one tip per screen: step off this one (a node's screen) and come back
    const away = () => {
      const ph = run.phase;
      run.phase = 'rest';
      coach.next(at({ safe: false }));
      run.phase = ph;
    };
    expect(run.roamFor().roamers.some((r) => r.kind === 'pack')).toBe(true);
    expect(take()).toBe('roamer');
    away();
    // (the roamers off the map from here: the walks below go straight to their stops)
    run.extras!.roamers = [];
    run.retry();
    // the secret: Rowan at its node
    const host = run.extras!.secret;
    const path = [host];
    while (run.map.nodes[path[0]].row > 0) path.unshift(run.map.nodes.find((q) => q.next.includes(path[0]))!.id);
    run.path = path;
    run.phase = 'map';
    run.combat = null;
    expect(run.secretHere).toBe(true);
    expect(take()).toBe('secret');
    away();
    // the bounty board
    run.path = [];
    goTo(run, 'bounty');
    expect(run.phase as string).toBe('bounty');
    expect(take()).toBe('bounty');
    // the merchant's shop
    run.phase = 'shop';
    run.merchant = true;
    expect(take()).toBe('merchant');
    away();
    // Coin Rush, before TAP TO BEGIN
    run.merchant = false;
    run.path = [];
    goTo(run, 'rush');
    expect(run.rushing).toBe(true);
    expect(take({ preFight: true })).toBe('rush');
  });

  it("the world map's wandering foe", () => {
    const p = knows();
    p.actsCleared = 1;
    p.wander.fights = 99;
    const run = new Run(T, { ...DEFAULT_SETTINGS }, 3, p);
    run.toWorld();
    const coach = new TipCoach(p);
    const m: TipMoment = { run, safe: true };
    const cue = coach.next(m);
    expect(cue?.id).toBe('skirmish');
    coach.shown(cue!, m);
    expect(coach.next({ run, safe: true })).toBeNull();
  });
});

describe('the teaching order', () => {
  it("is data: the first fight's five basics in order, each after the one before; a tip only ever waits for tips taught before it", () => {
    expect(FIRST_FIGHT).toEqual(['tapYellow', 'blockRed', 'green', 'purple', 'finisher']);
    FIRST_FIGHT.forEach((id, i) => {
      const d = tipById(id)!;
      expect(d.basic, id).toBe(true);
      expect(d.after ?? [], id).toEqual(i ? [FIRST_FIGHT[i - 1]] : []);
      expect(d.known, `${id}: skipped once the player shows they know it`).toBeGreaterThan(0);
    });
    // TIPS is the teaching order: the five basics first, and a tip only waits for tips listed before it
    expect(TIP_IDS.slice(0, FIRST_FIGHT.length)).toEqual([...FIRST_FIGHT]);
    TIPS.forEach((d, i) => {
      for (const a of d.after ?? []) expect(TIP_IDS.indexOf(a), `${d.id} waits for ${a}`).toBeLessThan(i);
    });
    // every other fight tip waits: the pre-fight ones for tap yellow, the ones that stop a fight for the five basics
    for (const d of TIPS.filter((x) => x.fight && !FIRST_FIGHT.includes(x.id))) {
      if (d.fight === 'pre') expect(d.after, d.id).toEqual(['tapYellow']);
      else expect(d.after, d.id).toEqual(['finisher']);
    }
    // a lesson only for the first fight's basics; every bar rule (and a hero's block) is a first meeting
    for (const d of TIPS.filter((x) => x.lesson)) expect(FIRST_FIGHT, d.id).toContain(d.id);
    for (const id of ['hold', 'ice', 'snow', 'mirror', 'iced', 'keg', 'frozen', 'drift', 'pair', 'icicle'] as TipId[]) expect(tipById(id)!.rule, id).toBe(true);
  });

  it("Act 1's first row never brings a purple (so the purple's lesson places one), but it brings reds and greens", () => {
    const act = REGIONS[0].acts[0];
    const pats = act.fights.early.flat().map((k) => T.enemies[k].pattern);
    expect(pats.some((x) => x.includes('P'))).toBe(false);
    expect(pats.every((x) => x.includes('R') && x.includes('G'))).toBe(true);
  });
});

describe("a new player's first fights (the playtester: \"'yellow blocks are attacks' came 3 fights in\")", () => {
  it('the cause: "tap yellow" waited for the fight screen to settle, and a quick TAP TO BEGIN beat it, fight after fight', () => {
    // the game as it was: TAP TO BEGIN began at once; tapped inside the iris and the settle (~0.8 s), the pre-fight tip
    // was never offered, and it stayed due until the first fight the player lingered on
    for (let seed = 1; seed <= 5; seed++) {
      const shown = firstFights({ seed, fights: 3, beginMs: QUICK, oldGame: true });
      expect(shown.find((x) => x.id === 'tapYellow'), `seed ${seed}`).toMatchObject({ fight: 3, pre: true });
    }
  });

  it('now TAP TO BEGIN brings it up first: "tap yellow" before the first fight begins, however quick the tap, once', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const shown = firstFights({ seed, fights: 3, beginMs: QUICK });
      expect(shown.filter((x) => x.id === 'tapYellow'), `seed ${seed}`).toEqual([{ id: 'tapYellow', fight: 1, at: 0, pre: true }]);
    }
    // (a player who waits gets it from the view, as before)
    expect(firstFights({ seed: 1, fights: 1, beginMs: () => 1500 }).find((x) => x.id === 'tapYellow')).toMatchObject({ fight: 1, pre: true });
  });

  it('all five basics come in the first fight, in the teaching order, each after the tips it waits for; the others wait for fight 2', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const shown = firstFights({ seed, fights: 2, beginMs: QUICK });
      const ids = shown.map((x) => x.id);
      const basics = shown.filter((x) => FIRST_FIGHT.includes(x.id));
      expect(
        basics.map((x) => `${x.id}@${x.fight}`),
        `seed ${seed}`,
      ).toEqual(FIRST_FIGHT.map((id) => `${id}@1`));
      shown.forEach((x, i) => {
        for (const a of tipById(x.id)!.after ?? []) {
          const j = ids.indexOf(a);
          expect(j >= 0 && j < i, `seed ${seed}: ${x.id} came after ${a}`).toBe(true);
        }
      });
      // nothing else stops the first fight (a special, a combo break: the next fight)
      expect(shown.filter((x) => x.fight === 1 && tipById(x.id)!.fight === 'pause' && !FIRST_FIGHT.includes(x.id)), `seed ${seed}`).toEqual([]);
    }
  });
});

describe('a tip the player already knows is skipped', () => {
  it('a profile that has hit 10 yellows never sees "tap yellow": the red is the first lesson', () => {
    for (const seed of [2, 7]) {
      const p = newProfile();
      p.tipsDone.tapYellow = 10;
      const shown = firstFights({ profile: p, seed, fights: 2, beginMs: QUICK });
      expect(shown.map((x) => x.id)).not.toContain('tapYellow');
      expect(shown.filter((x) => x.fight === 1 && FIRST_FIGHT.includes(x.id)).map((x) => x.id)).toEqual(FIRST_FIGHT.slice(1));
    }
    // and nine yellows don't make it known
    const { run, coach, p } = setup();
    p.tipsDone.tapYellow = 9;
    goTo(run, 'fight');
    expect(coach.holdBegin({ run, safe: false, preFight: true })?.id).toBe('tapYellow');
  });

  it("counted from the fight's events (10 yellows hit, 3 reds blocked, 3 greens hit, 3 purples let pass, a finisher), even with tips off; kept in the profile; \"Show tips again\" forgets them", () => {
    const { run, coach, p } = setup();
    goTo(run, 'fight');
    const c = run.combat!;
    const hit = (kind: 'yellow' | 'green', echo = false): CombatEvent => ({ type: 'hit', kind, pos: 0.5, perfect: false, crit: false, damage: 1, enemyId: 1, combo: 1, echo });
    const block: CombatEvent = { type: 'block', kind: 'red', pos: 0.5, perfect: false, cracked: false, ownerId: 1, combo: 1, knock: 0, echo: false };
    const passed: CombatEvent = { type: 'remove', id: 9, kind: 'purple', pos: 0.5, width: 0.05, ownerId: 1, reason: 'expire' };
    const tapped: CombatEvent = { type: 'remove', id: 9, kind: 'purple', pos: 0.5, width: 0.05, ownerId: 1, reason: 'hit' };
    p.tipsOff = true;
    coach.feed(Array.from({ length: 9 }, () => hit('yellow')), c);
    coach.feed([hit('yellow', true)], c); // an echo is no tap of yours
    expect(coach.known('tapYellow')).toBe(false);
    coach.feed([hit('yellow'), hit('yellow')], c);
    expect(coach.known('tapYellow')).toBe(true);
    expect(p.tipsDone.tapYellow).toBe(10); // (counted up to its number, no further)
    coach.feed([block, block, hit('green'), hit('green'), hit('green'), passed, passed, tapped], c);
    expect(FIRST_FIGHT.map((id) => coach.known(id))).toEqual([true, false, true, false, false]);
    coach.feed([block, passed, { type: 'finisher', damage: 50, combo: 8, stacks: 1, targets: [1] }], c);
    expect(FIRST_FIGHT.every((id) => coach.known(id))).toBe(true);
    // everything known: tips back on, nothing of the five comes
    p.tipsOff = false;
    expect(coach.holdBegin({ run, safe: true, preFight: true })).toBeNull();
    setTime(run, 3);
    c.spawnBlock('red', 0.85);
    c.spawnBlock('purple', 0.3);
    expect(coach.next({ run, safe: true })).toBeNull();
    // kept in the profile; unknown ids and junk dropped; missing reads as none
    expect(readProfile(viaJson(p)).tipsDone).toEqual({ tapYellow: 10, blockRed: 3, green: 3, purple: 3, finisher: 1 });
    const data = viaJson(p) as unknown as Record<string, unknown>;
    data.tipsDone = { tapYellow: 4, laser: 3, green: 'x', purple: -2 };
    expect(readProfile(data).tipsDone).toEqual({ tapYellow: 4 });
    delete data.tipsDone;
    expect(readProfile(data).tipsDone).toEqual({});
    // "Show tips again": every tip shows once more
    coach.reset();
    expect(p.tipsDone).toEqual({});
    expect(coach.known('tapYellow')).toBe(false);
  });
});

describe("a bar rule's tip: on first meeting only", () => {
  it('never before the rule shows up, the moment it does (past the per-fight cap), never twice', () => {
    const p = newProfile();
    p.tips = TIP_IDS.filter((id) => !['special', 'comboBreak', 'hold', 'ice'].includes(id));
    const { run, coach } = setup(p);
    goTo(run, 'fight');
    const c = run.combat!;
    const take = () => {
      const cue = coach.next({ run, safe: true });
      if (cue) coach.shown(cue, { run, safe: true });
      return cue?.id ?? null;
    };
    // two tips stop this fight: its cap
    setTime(run, 1);
    c.telegraph = { enemyId: c.enemies[0].id, index: 0, left: 0.8, total: 0.8 };
    expect(take()).toBe('special');
    c.telegraph = null;
    setTime(run, 6);
    coach.feed([{ type: 'comboBreak', lost: 9, lostStacks: 3 }], c);
    expect(take()).toBe('comboBreak');
    // no hold, no ice yet: nothing
    setTime(run, 11);
    expect(take()).toBeNull();
    // a hold comes: its tip, though the fight has had its two
    c.spawnBlock('hold', 0.5);
    expect(take()).toBe('hold');
    // ice comes (a gap later): its tip
    setTime(run, 16);
    c.addZone('ice', 0.3, 0.2, 5);
    expect(take()).toBe('ice');
    // never twice, in this fight or the next
    setTime(run, 30);
    c.spawnBlock('hold', 0.8);
    expect(take()).toBeNull();
    run.startFight();
    setTime(run, 5);
    run.combat!.spawnBlock('hold', 0.5);
    run.combat!.addZone('ice', 0.3, 0.2, 5);
    expect(take()).toBeNull();
  });
});

describe("the first fight's lessons: what the fight doesn't bring is placed in time", () => {
  /** Step the fight (no taps) until a tip is due; the tip and the fight time. */
  const stepToTip = (run: Run, coach: TipCoach, sec = 10) => {
    const c = run.combat!;
    for (let i = 0; i < sec / DT && !c.result; i++) {
      c.step();
      coach.feed(c.drainEvents(), c);
      const cue = coach.next({ run, safe: true });
      if (cue) return { cue, t: c.time };
    }
    return { cue: null, t: c.time };
  };

  it("a purple: Act 1's first foes never bring one, so its lesson places one lessonSec into its turn, and the tip points at it", () => {
    const { run, coach, p } = setup();
    p.tips.push(...before('purple'));
    goTo(run, 'fight');
    const { cue, t } = stepToTip(run, coach);
    expect(cue?.id).toBe('purple');
    expect(run.combat!.blocks.find((b) => b.id === cue!.block)?.kind).toBe('purple');
    expect(t).toBeLessThan(COACH_DEFAULTS.lessonSec + 0.5);
  });

  it('a green and a red when none has come; for the finisher, a stack', () => {
    for (const id of ['blockRed', 'green', 'finisher'] as TipId[]) {
      const { run, coach, p } = setup();
      p.tips.push(...before(id));
      goTo(run, 'fight');
      const c = run.combat!;
      // (none of its own on the bar at the start)
      c.blocks = c.blocks.filter((b) => b.kind === 'yellow');
      const { cue, t } = stepToTip(run, coach);
      expect(cue?.id, id).toBe(id);
      expect(t, id).toBeLessThan(COACH_DEFAULTS.lessonSec + 2);
      if (id === 'finisher') expect(c.stacks).toBeGreaterThanOrEqual(1);
    }
  });

  it('never with tips off, once learned, or in a Coin Rush', () => {
    const purples = (run: Run, coach: TipCoach) => {
      const c = run.combat!;
      for (let i = 0; i < 6 / DT && !c.result; i++) {
        c.step();
        coach.feed(c.drainEvents(), c);
        if (c.blocks.some((b) => b.kind === 'purple') || c.queue.some((q) => q.entry.kind === 'purple')) return true;
      }
      return false;
    };
    const off = setup();
    off.p.tips.push(...before('purple'));
    off.p.tipsOff = true;
    goTo(off.run, 'fight');
    expect(purples(off.run, off.coach)).toBe(false);
    const learned = setup();
    learned.p.tips.push(...FIRST_FIGHT);
    goTo(learned.run, 'fight');
    expect(purples(learned.run, learned.coach)).toBe(false);
    const rush = setup();
    rush.p.tips.push(...before('purple'));
    goTo(rush.run, 'rush');
    expect(rush.run.combat!.rush).toBeGreaterThan(0);
    expect(purples(rush.run, rush.coach)).toBe(false);
  });
});
