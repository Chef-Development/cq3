// "Teach it slowly": the tips (src/data/tips.ts) and the coach that picks one (src/core/tips.ts): each tip fires at
// its moment and only once, by priority and one at a time, never while tips are off; seen tips live in the profile
// (a returning player has the basics marked seen); the welcome back plays once, only for a returning player.
import { describe, expect, it } from 'vitest';
import { STORY } from '../../src/data/story';
import { BASIC_TIPS, TIP_IDS, TIP_TEXT_W, TIPS, WELCOME_ID, type TipId } from '../../src/data/tips';
import { DT, type CombatEvent } from '../../src/core/combat';
import { newProfile, readProfile, type Profile } from '../../src/core/profile';
import { Run } from '../../src/core/run';
import { markWelcomed, TipCoach, welcomeScene, type TipMoment } from '../../src/core/tips';
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

const spawn = (id: number, kind: 'red' | 'purple' | 'green' | 'yellow'): CombatEvent => ({ type: 'spawn', id, kind, ownerId: 1, special: false });
const setTime = (run: Run, s: number) => (run.combat!.tick = Math.round(s / DT));

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
    // a red spawned while still waiting to begin is not shown before the fight runs
    coach.feed([spawn(41, 'red')], run.combat!);
    expect(take({ preFight: true })).toBeNull();
    // the fight runs: the first red's tip comes up at once, about that block (the pre-fight tip doesn't hold it back)
    setTime(run, 2);
    coach.feed([spawn(43, 'red')], run.combat!);
    const cue = coach.next({ run, safe: true });
    expect(cue).toMatchObject({ id: 'blockRed', block: 43 });
    coach.shown(cue!, { run, safe: true });
    expect(p.tips).toContain('blockRed');
    // only once
    setTime(run, 20);
    coach.feed([spawn(44, 'red')], run.combat!);
    expect(coach.next({ run, safe: true })).toBeNull();
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
    // nearly always at the very first red (a special's tip just before it can push it to the next one)
    expect(late).toBeLessThanOrEqual(6);
  });

  it('each fight event fires its tip: purple, green, a telegraph, a full meter, a combo break costing 2+ stacks', () => {
    const cases: Array<[CombatEvent, TipId]> = [
      [spawn(5, 'purple'), 'purple'],
      [spawn(6, 'green'), 'green'],
      [{ type: 'telegraph', enemyId: 1, special: 'x', name: 'X', sound: 'growl', sec: 0.8 }, 'special'],
      [{ type: 'meterFull', stacks: 1 }, 'finisher'],
      [{ type: 'comboBreak', lost: 9, lostStacks: 2 }, 'comboBreak'],
    ];
    for (const [ev, id] of cases) {
      const { run, coach } = setup();
      goTo(run, 'fight');
      coach.feed([spawn(1, 'yellow'), ev], run.combat!);
      const cue = coach.next({ run, safe: true });
      expect(cue?.id, id).toBe(id);
      if (id === 'special') expect(cue?.enemy).toBe(1);
    }
    // a combo break that costs one stack (or none) is not worth stopping the fight for
    const { run, coach } = setup();
    goTo(run, 'fight');
    coach.feed([{ type: 'comboBreak', lost: 12, lostStacks: 1 }], run.combat!);
    expect(coach.next({ run, safe: true })).toBeNull();
  });

  it('one at a time, by priority; a fight event that cannot show at once waits briefly, then for next time', () => {
    const { run, coach } = setup();
    goTo(run, 'fight');
    // a telegraph and a red at once: the red goes first (blocking is the first lesson); the special waits for the
    // gap, by then it's stale
    const telegraph: CombatEvent = { type: 'telegraph', enemyId: 1, special: 'x', name: 'X', sound: 'growl', sec: 0.8 };
    coach.feed([spawn(2, 'red'), telegraph], run.combat!);
    const first = coach.next({ run, safe: true })!;
    expect(first.id).toBe('blockRed');
    coach.shown(first, { run, safe: true });
    expect(coach.next({ run, safe: true })).toBeNull(); // one at a time: the gap
    setTime(run, 4.5);
    expect(coach.next({ run, safe: true })).toBeNull(); // the special's moment passed
    coach.feed([telegraph], run.combat!);
    const second = coach.next({ run, safe: true })!;
    expect(second.id).toBe('special');
    coach.shown(second, { run, safe: true });
    // at most two tips stop one fight
    setTime(run, 30);
    coach.feed([spawn(4, 'purple')], run.combat!);
    expect(coach.next({ run, safe: true })).toBeNull();
    // the next fight is a new one
    run.startFight();
    coach.feed([spawn(5, 'purple')], run.combat!);
    expect(coach.next({ run, safe: true })?.id).toBe('purple');
  });

  it('nothing while it is not safe (a scene, a wipe, a card in the way), and the moment waits for a safe one', () => {
    const { run, coach } = setup();
    expect(coach.next({ run, safe: false })).toBeNull();
    expect(coach.next({ run, safe: true })?.id).toBe('map');
    goTo(run, 'fight');
    coach.feed([spawn(9, 'red')], run.combat!);
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
    coach.feed([spawn(9, 'red')], run.combat!);
    expect(take({ preFight: true })).toBeNull();
    expect(take()).toBeNull();
    p.tipsOff = false;
    p.tips = [...TIP_IDS];
    coach.reset();
    expect(p.tipsOff).toBe(false);
    expect(p.tips).toEqual([]);
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
    coach.feed([spawn(1, 'red')], run.combat!);
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
