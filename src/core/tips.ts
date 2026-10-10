// "Teach it slowly" (pure; no DOM): which tip shows, and when. One short tip, shown once, the moment a system first
// matters (src/data/tips.ts has the tips, in teaching order, each with the tips it waits for). The engine feeds the
// coach a fight's events and asks it every frame for the tip due on the screen it shows (the run's phase, the camp's
// screen), saying whether a tip can go up right now (no scene, screen wipe, card, toast or panel in the way). At most
// one at a time, never one seen (profile.tips) or known (the player has done what it teaches often enough:
// profile.tipsDone, counted here from the fight's events), never before the tips it waits for, none while tips are
// off (profile.tipsOff).
//
// In a fight a tip is due while what it's about is on the bar (a red, a green, a purple, a hold, an ice patch, a full
// meter, a special winding up), so a tip that has to wait its turn still comes while it's there; a moment that passes
// (a combo break, an icicle's mark) stays due briefly (holdSec of fight time). Pacing: one tip per screen; in a fight a
// few seconds apart and only a couple per fight, except the first fight's five lessons (FIRST_FIGHT: they come a
// little closer, lessonGapSec, and are never capped, so all five fit in the first fight) and a bar rule's first
// meeting (never capped). When a lesson's turn comes and the fight hasn't put its block on the bar for a moment
// (lessonSec), the coach places one (TipDef.lesson: Act 1's first foes never bring a purple). A pre-fight tip (tap
// yellow, a hero's how-to) holds TAP TO BEGIN: a quick tap brings it up instead of starting the fight (holdBegin).
//
// Also the welcome back: a returning player's first launch of this version plays a short scene (welcomeScene).

import { FIRST_FIGHT, TIPS, WELCOME_ID, type TipDef, type TipId } from '../data/tips';
import type { FormationEntry } from '../data/types';
import { isRed, type Block, type Combat, type CombatEvent } from './combat';
import { pointsLeft } from './heroes';
import { hasProgress, type Profile } from './profile';
import { isSynergy } from './relics';
import { isRelicOffer, type Run } from './run';

/** Where the game is, as the coach needs it. */
export interface TipMoment {
  run: Run;
  /** A tip could go up right now: nothing else is on screen (a scene, a wipe, a card or toast, a panel). */
  safe: boolean;
  /** The fight is waiting for TAP TO BEGIN. */
  preFight?: boolean;
  /** At the camp: its screen ('home', 'bag', 'forge', 'skills', 'relics', 'heroes', 'stats'). */
  campMode?: string;
  /** A sparkle is glinting on the act map (view/map-life.ts). */
  sparkle?: boolean;
}

/** A tip to show, and what it's about (the block that came in, the enemy winding up, the card on offer). */
export interface TipCue {
  id: TipId;
  block?: number;
  enemy?: number;
  card?: number;
}

export interface CoachOptions {
  /** In a fight: at least this much fight time (s) between two tips... */
  gapSec: number;
  /** ...and at most this many tips that stop a fight, per fight (the first fight's lessons and bar rules aside). */
  perFight: number;
  /** A passing moment's tip (a combo break, an icicle's mark) stays due this long (fight time, s) while it can't show. */
  holdSec: number;
  /** A combo break gets its tip when it costs at least this many banked stacks. */
  breakStacks: number;
  /** The first fight's lessons come at least this far apart (fight time, s): all five fit in a short first fight. */
  lessonGapSec: number;
  /** A lesson whose turn has come places its block after this long (fight time, s) without one on the bar. */
  lessonSec: number;
  /** At most this many lesson blocks per lesson per fight (one that's let go by unseen gets another). */
  lessonsPerFight: number;
  /** The first finisher finishes: its lesson (the tip, and the stack when the meter isn't full by itself) waits for
   *  the foe in front to be low enough for it to kill, for at most this long (fight time, s) into its turn... */
  finWaitSec: number;
  /** ...and not so low that a tap or two would beat it there (the foe's HP above this share of one stack's blow). */
  finFloor: number;
}

export const COACH_DEFAULTS: CoachOptions = { gapSec: 4, perFight: 2, holdSec: 1.5, breakStacks: 2, lessonGapSec: 2.5, lessonSec: 1.5, lessonsPerFight: 3, finWaitSec: 15, finFloor: 0.3 };

/** What counts as doing what a tip teaches (its `known` count): a yellow hit, a red blocked, a green hit, a purple let
 *  pass (it ran out untouched), a finisher fired. */
const DOES: Partial<Record<TipId, (e: CombatEvent) => boolean>> = {
  tapYellow: (e) => e.type === 'hit' && e.kind === 'yellow' && !e.echo,
  blockRed: (e) => e.type === 'block' && !e.echo,
  green: (e) => e.type === 'hit' && e.kind === 'green' && !e.echo,
  purple: (e) => e.type === 'remove' && e.kind === 'purple' && e.reason === 'expire',
  finisher: (e) => e.type === 'finisher',
};

/** The block (or patch, or state) a fight tip is about, if it's on the bar now (null: not there). */
function onBar(id: TipId, c: Combat): TipCue | null {
  const first = (pred: (b: Block) => boolean): TipCue | null => {
    let best: Block | null = null;
    for (const b of c.blocks) if (pred(b) && (!best || b.pos < best.pos)) best = b;
    return best ? { id, block: best.id } : null;
  };
  switch (id) {
    case 'blockRed':
      return first((b) => isRed(b.kind));
    case 'green':
    case 'purple':
    case 'hold':
    case 'mirror':
    case 'keg':
    case 'frozen':
      return first((b) => b.kind === id);
    case 'drift':
      return first((b) => !isRed(b.kind) && b.vel !== 0);
    case 'pair':
      return first((b) => b.link !== 0);
    case 'dark':
      return first((b) => b.dark && b.litAt === Infinity);
    case 'tide':
      return c.waterL > 0 || c.waterR > 0 ? { id } : null;
    case 'mirage':
      return first((b) => b.hopAt !== Infinity);
    case 'heat':
      return first((b) => b.blaze);
    case 'ice':
    case 'snow':
      return c.zones.some((z) => z.kind === id) ? { id } : null;
    case 'finisher':
      return c.finisherReady ? { id } : null;
    case 'special':
      return c.telegraph ? { id, enemy: c.telegraph.enemyId } : null;
  }
  return null;
}

const FIRST: ReadonlySet<TipId> = new Set(FIRST_FIGHT);

interface Pending {
  cue: TipCue;
  combat: unknown;
  until: number;
}

export class TipCoach {
  readonly o: CoachOptions;
  private pending: Pending[] = [];
  /** The screen on view (a key), how many screens have come up, and the screen the last tip went up on. */
  private screen = '';
  private screens = 0;
  private shownOn = -1;
  /** Fights: a serial per combat (a new one is a new screen), and the last tip shown in one. */
  private combat: unknown = null;
  private combatN = 0;
  private fightTip = { combat: null as unknown, at: -1e9, count: 0 };
  /** The first fight's lessons: whose turn it is (since when, fight time), the block placed for it (still waiting
   *  in the fight's queue), and how many were placed in this fight. */
  private turn: { combat: unknown; id: TipId; at: number } | null = null;
  /** The finisher's lesson: since when (fight time) its turn has run in this fight (finisherMoment). */
  private finTurn: { combat: unknown; at: number } = { combat: null, at: 0 };
  private placed: { combat: unknown; entry: FormationEntry | null; n: Partial<Record<TipId, number>> } = { combat: null, entry: null, n: {} };

  constructor(
    readonly profile: Profile,
    o: Partial<CoachOptions> = {},
  ) {
    this.o = { ...COACH_DEFAULTS, ...o };
  }

  seen(id: TipId): boolean {
    return this.profile.tips.includes(id);
  }

  /** The player has shown they know what `id` teaches (done it `known` times): it's skipped. */
  known(id: TipId): boolean {
    const def = TIPS.find((d) => d.id === id);
    return !!def?.known && (this.profile.tipsDone[id] ?? 0) >= def.known;
  }

  /** Seen or known: what waits for it may come. */
  learned(id: TipId): boolean {
    return this.seen(id) || this.known(id);
  }

  /** Its turn may come: not learned yet, every tip it waits for is, and (the quiet start) a new player has won the
   *  fights it waits for. */
  ready(def: TipDef): boolean {
    return !this.learned(def.id) && (def.after ?? []).every((a) => this.learned(a)) && this.quietOver(def);
  }

  /** The quiet start is over for `def`: it waits for no wins, an act has been cleared, or enough fights were won.
   *  Then its tips come one per fight won (all five at once made a burst of tips over the four screens before the
   *  first boss): each one seen moves the next one win further. */
  quietOver(def: TipDef): boolean {
    if (!def.wins || this.profile.actsCleared > 0) return true;
    const met = TIPS.filter((d) => d.wins && this.seen(d.id)).length;
    return (this.profile.counts.wins ?? 0) >= def.wins + met;
  }

  /** A fight's events (each flush): what the player did (tipsDone, counted even while tips are off), the passing
   *  moments its tips are about, and (tips on) a lesson's block placed when its turn has come. */
  feed(events: readonly CombatEvent[], combat: Combat): void {
    this.count(events);
    if (this.profile.tipsOff) return;
    this.prune(combat);
    const due = (cue: TipCue) => {
      if (this.seen(cue.id) || this.pending.some((p) => p.cue.id === cue.id && p.combat === combat)) return;
      this.pending.push({ cue, combat, until: combat.time + this.o.holdSec });
    };
    for (const e of events) {
      if (e.type === 'chip' && e.left > 1) due({ id: 'iced', block: e.id });
      else if (e.type === 'mark') due({ id: 'icicle' });
      else if (e.type === 'comboBreak' && e.lostStacks >= this.o.breakStacks) due({ id: 'comboBreak' });
    }
    this.teach(combat);
  }

  /** The tip to show now (null: none), in teaching order. Call every frame: it also keeps track of the screen. */
  next(m: TipMoment): TipCue | null {
    this.observe(m);
    if (!m.safe || this.profile.tipsOff) return null;
    for (const def of TIPS) {
      if (!this.ready(def) || !this.paced(def, m)) continue;
      const cue = this.due(def, m);
      if (cue) return cue;
    }
    return null;
  }

  /**
   * TAP TO BEGIN was tapped: a pre-fight tip still due (tap yellow, a hero's how-to, the relic belt) comes up first,
   * whatever the screen's settling (the caller shows it and the fight keeps waiting; null: begin). A player who taps
   * at once never skips it.
   */
  holdBegin(m: TipMoment): TipCue | null {
    if (m.run.phase !== 'fight' || !m.run.combat) return null;
    return this.next({ ...m, safe: true, preFight: true });
  }

  /** The tip went up: it's seen (the caller saves the profile), and the next one waits its turn. */
  shown(cue: TipCue, m: TipMoment): void {
    if (!this.seen(cue.id)) this.profile.tips.push(cue.id);
    this.pending = this.pending.filter((p) => p.cue.id !== cue.id);
    this.shownOn = this.screens;
    const c = m.run.combat;
    if (m.run.phase === 'fight' && c) {
      if (this.fightTip.combat !== c) this.fightTip = { combat: c, at: -1e9, count: 0 };
      // a pre-fight tip goes up before the fight runs: it doesn't hold back the first red's
      if (!m.preFight) {
        this.fightTip.at = c.time;
        this.fightTip.count++;
      }
    }
  }

  /** "Show tips again": every tip shows once more (the welcome back stays played, what was learned is forgotten),
   *  and tips are on. */
  reset(): void {
    this.profile.tips = this.profile.tips.filter((id) => id === WELCOME_ID);
    this.profile.tipsDone = {};
    this.profile.tipsOff = false;
    this.pending = [];
    this.turn = null;
  }

  /** What the player did, for the tips' `known` counts (each kept up to its tip's count). */
  private count(events: readonly CombatEvent[]): void {
    const done = this.profile.tipsDone;
    const counts = this.profile.counts;
    for (const e of events) {
      // fights won (the quiet start: QUIET_WINS)
      if (e.type === 'won') counts.wins = Math.min(1e6, (counts.wins ?? 0) + 1);
      for (const id of Object.keys(DOES) as TipId[]) {
        if (!DOES[id]!(e)) continue;
        const def = TIPS.find((d) => d.id === id);
        const cap = def?.known ?? 0;
        if ((done[id] ?? 0) < cap) done[id] = (done[id] ?? 0) + 1;
      }
    }
  }

  /**
   * The first fight's lessons: the first lesson whose turn has come (its tips learned, the fight running) and whose
   * block the fight hasn't put on the bar for lessonSec gets one placed (for the foe at the front), or for the finisher
   * a stack filled, timed to be there when the gap since the last tip ends (at most lessonsPerFight per lesson per
   * fight; never in a Coin Rush).
   */
  private teach(c: Combat): void {
    if (this.placed.combat !== c) this.placed = { combat: c, entry: null, n: {} };
    const lesson = TIPS.find((d) => d.lesson && FIRST.has(d.id) && this.ready(d));
    if (!lesson?.lesson || c.rush || c.result || !(c.time > 0)) {
      this.turn = null;
      return;
    }
    if (lesson.id === 'finisher' && this.finTurn.combat !== c) this.finTurn = { combat: c, at: c.time };
    // its block is on the bar (the tip comes with it), or one placed is still on its way
    const waiting = !!this.placed.entry && c.queue.some((q) => q.entry === this.placed.entry);
    if (onBar(lesson.id, c) || waiting || (this.placed.n[lesson.id] ?? 0) >= this.o.lessonsPerFight) {
      this.turn = null;
      return;
    }
    if (!this.turn || this.turn.combat !== c || this.turn.id !== lesson.id) {
      this.turn = { combat: c, id: lesson.id, at: c.time };
      return;
    }
    // lessonSec into its turn, once the gap since the last tip has run out (its tip comes up as it lands: placed any
    // sooner, a green would often be hit before its tip could show)
    const gapEnds = this.fightTip.combat === c ? this.fightTip.at + this.o.lessonGapSec : 0;
    if (c.time - this.turn.at < this.o.lessonSec || c.time < gapEnds) return;
    const owner = c.enemies.find((e) => e.alive);
    if (!owner) return;
    if (lesson.lesson === 'stack' && !this.finisherMoment(c, 1)) return;
    if (lesson.lesson === 'stack') c.fillMeter(Math.max(0.01, 1 - c.meter), 'perk');
    else {
      const entry: FormationEntry = { ...lesson.lesson };
      c.enqueue(owner.id, entry, 0);
      this.placed.entry = entry;
    }
    this.placed.n[lesson.id] = (this.placed.n[lesson.id] ?? 0) + 1;
    this.turn = null;
  }

  /**
   * The first finisher should finish: it's the moment the game names it (view/finisher-reveal.ts), and a foe left
   * standing after it was a let-down. Its lesson comes when the foe in front is low enough for the finisher (with
   * `stacks` banked) to kill it, but not so low that a tap or two would first (finFloor), or once its turn has run
   * finWaitSec (a fight that never gets there still teaches it).
   */
  finisherMoment(c: Combat, stacks = Math.max(1, c.stacks)): boolean {
    if (this.finTurn.combat === c && c.time - this.finTurn.at >= this.o.finWaitSec) return true;
    const front = c.frontEnemy();
    if (!front) return false;
    // (the floor is a tap or two of the hero's: a share of one stack's blow, whatever is banked)
    return front.hp <= c.finisherDamage(stacks) * 0.9 && front.hp > c.finisherDamage(1) * 0.9 * this.o.finFloor;
  }

  /** Keep track of the screen (a new phase, camp screen or fight is a new one), and drop fight tips gone stale. */
  private observe(m: TipMoment): void {
    const run = m.run;
    if (run.combat !== this.combat) {
      this.combat = run.combat;
      this.combatN++;
    }
    const key = `${run.phase}|${run.phase === 'camp' ? (m.campMode ?? '') : ''}|${run.phase === 'fight' ? this.combatN : 0}`;
    if (key !== this.screen) {
      this.screen = key;
      this.screens++;
    }
    this.prune(run.combat);
  }

  /** Passing moments whose time has gone (or whose fight is over) are dropped. */
  private prune(c: { time: number } | null): void {
    this.pending = this.pending.filter((p) => p.combat === c && !!c && c.time <= p.until && !this.seen(p.cue.id));
  }

  /** Pacing: one tip per screen; in a fight, one before it begins, then (from the first, as soon as it's due) a few
   *  seconds apart and a couple at most (the first fight's lessons a little closer and never capped; a bar rule's
   *  first meeting never capped). */
  private paced(def: TipDef, m: TipMoment): boolean {
    if (def.fight !== 'pause') return this.shownOn !== this.screens;
    const c = m.run.combat;
    return !c || this.fightPaced(def, c);
  }

  private fightPaced(def: TipDef, c: { time: number }): boolean {
    if (this.fightTip.combat !== c) return true;
    const lesson = FIRST.has(def.id);
    if (c.time - this.fightTip.at < (lesson ? this.o.lessonGapSec : this.o.gapSec)) return false;
    return lesson || !!def.rule || this.fightTip.count < this.o.perFight;
  }

  /** Whether `def` is due on this screen, and what it points at. */
  private due(def: TipDef, m: TipMoment): TipCue | null {
    const run = m.run;
    const ph = run.phase;
    const id = def.id;
    if (def.fight) {
      if (ph !== 'fight' || !run.combat) return null;
      if (def.fight === 'pre') {
        if (!m.preFight) return null;
        // (a Coin Rush is pure aim: its relics sleep)
        if (id === 'relicBelt' && (!run.hero.relics.length || run.combat.rush)) return null;
        if (id === 'rush' && !run.combat.rush) return null;
        if (def.hero && (run.combat.heroId !== def.hero || run.combat.rush)) return null;
        return { id };
      }
      if (m.preFight || run.combat.result) return null;
      const p = this.pending.find((q) => q.cue.id === id);
      if (p) return { ...p.cue };
      // (the meter filled by itself: the finisher's tip still waits for the blow that finishes the foe in front)
      if (id === 'finisher' && !this.finisherMoment(run.combat)) return null;
      return onBar(id, run.combat);
    }
    const camp = ph === 'camp' ? (m.campMode ?? '') : null;
    switch (id) {
      case 'defeat':
      case 'actClear':
      case 'map':
      case 'rest':
        return ph === id ? { id } : null;
      case 'shop':
        // (the travelling trader's stall is a shop too: it gets her own tip, and the shop's waits for a shop)
        return ph === 'shop' && !run.merchant ? { id } : null;
      case 'loot':
        return ph === 'loot' && run.loot.length > 0 ? { id } : null;
      case 'event':
        return ph === 'event' && !!run.event && run.event.outcome < 0 ? { id } : null;
      case 'relicPick': {
        // (not over a new player's first pick: its two plain cards say what they do, and the card would hide the
        // second one; the tip comes with the next pick, where tags and rarity show)
        const i = ph === 'boost' && !run.simplePick ? run.boostChoices.findIndex(isRelicOffer) : -1;
        return i >= 0 ? { id, card: i } : null;
      }
      case 'synergy': {
        const i = ph === 'boost' ? run.boostChoices.findIndex((o) => isRelicOffer(o) && isSynergy(o.relic, run.hero.relics)) : -1;
        return i >= 0 ? { id, card: i } : null;
      }
      case 'elite':
        return ph === 'map' && run.choices().some((n) => run.map.nodes[n]?.type === 'elite') ? { id } : null;
      case 'sparkle':
        return ph === 'map' && m.sparkle ? { id } : null;
      case 'roamer':
        return ph === 'map' && run.roamFor().roamers.some((r) => r.kind === 'pack') ? { id } : null;
      case 'secret':
        return ph === 'map' && run.secretHere ? { id } : null;
      case 'bounty':
        return ph === 'bounty' ? { id } : null;
      case 'merchant':
        return ph === 'shop' && run.merchant ? { id } : null;
      case 'skirmish':
        return ph === 'world' && !!run.wanderer ? { id } : null;
      case 'levelUp': {
        const where = ph === 'map' || ph === 'actClear' || ph === 'defeat' || camp === 'home';
        return where && this.pointsToSpend(run) ? { id } : null;
      }
      case 'camp':
        return camp === 'home' ? { id } : null;
      case 'heroes':
        return camp === 'heroes' && this.profile.sableMet ? { id } : null;
      case 'skills':
        return camp === 'skills' ? { id } : null;
      case 'relicLog':
        return camp === 'relics' ? { id } : null;
      case 'chest':
        return camp === 'home' && this.profile.chests.hero + this.profile.chests.rare + this.profile.chests.region > 0 ? { id } : null;
      case 'shrine':
        return camp === 'shrine' ? { id } : null;
      case 'companions':
        return camp === 'pets' ? { id } : null;
    }
    return null;
  }

  /** A hero (one who has joined) has skill points to spend. */
  private pointsToSpend(run: Run): boolean {
    return Object.values(this.profile.heroes).some((h) => h.unlocked && pointsLeft(run.tuning, h) > 0);
  }
}

// ---------------------------------------------------------------- the welcome back

/**
 * The welcome back scene a returning player gets on their first launch of this version (null: none due). Pip says
 * what's new; the last box is about Sable: at the camp already, sneaking round it (Act 1 cleared, not met yet), or
 * still to come (Act 1 not cleared). A new player never gets it (newProfile marks it played).
 */
export function welcomeScene(p: Profile): string | null {
  if (p.tips.includes(WELCOME_ID) || !hasProgress(p)) return null;
  return p.sableMet ? 'welcomeBack' : p.actsCleared >= 1 ? 'welcomeBackVisitor' : 'welcomeBackSoon';
}

/** The welcome back played (once: the caller saves the profile). */
export function markWelcomed(p: Profile): void {
  if (!p.tips.includes(WELCOME_ID)) p.tips.push(WELCOME_ID);
}
