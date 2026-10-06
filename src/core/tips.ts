// "Teach it slowly" (pure; no DOM): which tip shows, and when. One short tip, shown once, the moment a system first
// matters (src/data/tips.ts has the tips, in priority order). The engine feeds the coach a fight's events (the first
// red, purple and green on the bar, a special's telegraph, a full meter, a combo break that costs stacks) and asks it
// every frame for the tip due on the screen it shows (the run's phase, the camp's screen), saying whether a tip can
// go up right now (no scene, screen wipe, card, toast or panel in the way). At most one at a time, never one seen
// (profile.tips), none while tips are off (profile.tipsOff); paced so it never piles up: one per screen, and in a
// fight a few seconds apart and only a couple per fight. A fight's event tip that can't show at once stays due for a
// moment (holdSec of fight time), then waits for the next time it happens.
//
// Also the welcome back: a returning player's first launch of this version plays a short scene (welcomeScene).

import { TIPS, WELCOME_ID, type TipDef, type TipId } from '../data/tips';
import type { CombatEvent } from './combat';
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
  /** ...and at most this many tips that stop a fight, per fight. */
  perFight: number;
  /** A fight event's tip stays due this long (fight time, s) while it can't show (a tip just went up). */
  holdSec: number;
  /** A combo break gets its tip when it costs at least this many banked stacks. */
  breakStacks: number;
}

export const COACH_DEFAULTS: CoachOptions = { gapSec: 4, perFight: 2, holdSec: 1.5, breakStacks: 2 };

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

  constructor(
    readonly profile: Profile,
    o: Partial<CoachOptions> = {},
  ) {
    this.o = { ...COACH_DEFAULTS, ...o };
  }

  seen(id: TipId): boolean {
    return this.profile.tips.includes(id);
  }

  /** A fight's events (each flush): the moments its tips are about. */
  feed(events: readonly CombatEvent[], combat: { time: number }): void {
    if (this.profile.tipsOff) return;
    this.prune(combat);
    const due = (cue: TipCue) => {
      if (this.seen(cue.id) || this.pending.some((p) => p.cue.id === cue.id && p.combat === combat)) return;
      this.pending.push({ cue, combat, until: combat.time + this.o.holdSec });
    };
    for (const e of events) {
      if (e.type === 'spawn') {
        if (e.kind === 'red') due({ id: 'blockRed', block: e.id });
        else if (e.kind === 'purple') due({ id: 'purple', block: e.id });
        else if (e.kind === 'green') due({ id: 'green', block: e.id });
      } else if (e.type === 'telegraph') due({ id: 'special', enemy: e.enemyId });
      else if (e.type === 'meterFull') due({ id: 'finisher' });
      else if (e.type === 'comboBreak' && e.lostStacks >= this.o.breakStacks) due({ id: 'comboBreak' });
    }
  }

  /** The tip to show now (null: none), by priority. Call every frame: it also keeps track of the screen. */
  next(m: TipMoment): TipCue | null {
    this.observe(m);
    if (!m.safe || this.profile.tipsOff) return null;
    for (const def of TIPS) {
      if (this.seen(def.id) || !this.paced(def, m)) continue;
      const cue = this.due(def, m);
      if (cue) return cue;
    }
    return null;
  }

  /** The tip went up: it's seen (the caller saves the profile), and the next one waits its turn. */
  shown(cue: TipCue, m: TipMoment): void {
    if (!this.seen(cue.id)) this.profile.tips.push(cue.id);
    this.pending = this.pending.filter((p) => p.cue.id !== cue.id);
    this.shownOn = this.screens;
    const c = m.run.combat;
    if (m.run.phase === 'fight' && c) {
      if (this.fightTip.combat !== c) this.fightTip = { combat: c, at: -1e9, count: 0 };
      this.fightTip.at = c.time;
      if (!m.preFight) this.fightTip.count++;
    }
  }

  /** "Show tips again": every tip shows once more (the welcome back stays played), and tips are on. */
  reset(): void {
    this.profile.tips = this.profile.tips.filter((id) => id === WELCOME_ID);
    this.profile.tipsOff = false;
    this.pending = [];
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

  /** Fight tips whose moment has passed (or whose fight is over) are dropped. */
  private prune(c: { time: number } | null): void {
    this.pending = this.pending.filter((p) => p.combat === c && !!c && c.time <= p.until && !this.seen(p.cue.id));
  }

  /** Pacing: one tip per screen; in a fight, one before it begins, then a few seconds apart and a couple at most. */
  private paced(def: TipDef, m: TipMoment): boolean {
    if (def.fight !== 'pause') return this.shownOn !== this.screens;
    const c = m.run.combat;
    if (!c || this.fightTip.combat !== c) return true;
    return c.time - this.fightTip.at >= this.o.gapSec && this.fightTip.count < this.o.perFight;
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
        return { id };
      }
      if (m.preFight || run.combat.result) return null;
      const p = this.pending.find((q) => q.cue.id === id);
      return p ? { ...p.cue } : null;
    }
    const camp = ph === 'camp' ? (m.campMode ?? '') : null;
    switch (id) {
      case 'defeat':
      case 'actClear':
      case 'map':
      case 'shop':
      case 'rest':
        return ph === id ? { id } : null;
      case 'loot':
        return ph === 'loot' && run.loot.length > 0 ? { id } : null;
      case 'event':
        return ph === 'event' && !!run.event && run.event.outcome < 0 ? { id } : null;
      case 'relicPick': {
        const i = ph === 'boost' ? run.boostChoices.findIndex(isRelicOffer) : -1;
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
