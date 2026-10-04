// Glue between browser time/input and the deterministic core. No rendering here.
import { SimClock, tapSimTime } from '../core/clock';
import type { CombatEvent, TapResult } from '../core/combat';
import { Run, type Phase } from '../core/run';
import type { Settings, Tuning } from '../core/tuning';
import { Synth } from './audio';
import { computeLayout, type ScreenLayout } from './layout';
import { saveSoon } from './storage';

export interface View {
  /** Returns how long (ms) the next phase change should wait so a kill / finisher animation can play out. */
  onEvents(events: CombatEvent[]): number;
  onPhase(prev: Phase, next: Phase): void;
  onLayout(): void;
}

const MAX_CATCHUP_S = 0.25;
export const INTRO_MS = 800;

export class App {
  readonly clock = new SimClock();
  readonly audio = new Synth();
  run: Run;
  layout: ScreenLayout;
  view: View | null = null;
  userPaused = false;
  panelOpen = false;
  playWhilePanelOpen = false;
  calibrating = false;
  hidden = false;
  lastTap: TapResult | null = null;
  sceneReady = false;
  /** Each new fight waits for a "TAP TO BEGIN!" tap before the clock runs. */
  awaitingBegin = false;
  /** Later stages of a level: the clock waits while the next enemy walks in (performance.now ms). */
  introUntil = 0;
  private begunCombat: unknown = null;
  private syncHoldUntil = 0; // performance.now() until which phase changes wait (kill animations)
  phaseSince = 0;

  constructor(
    readonly tuning: Tuning,
    readonly settings: Settings,
  ) {
    this.run = new Run(tuning, settings, (Date.now() & 0xffffff) | 1);
    this.audio.tuning = tuning; // live: the impact sliders apply to the next sound
    this.layout = computeLayout();
    this.applyAudioSettings();
  }

  applyAudioSettings(): void {
    this.audio.muted = this.settings.muted;
    this.audio.ignoreSilentSwitch = this.settings.audioIgnoresSilentSwitch;
    this.audio.applySession();
    this.audio.setMusicOn(this.settings.music);
  }

  save(): void {
    saveSoon(this.tuning, this.settings);
  }

  get combat() {
    return this.run.combat;
  }

  /** Whether simulation time should be flowing right now. */
  active(): boolean {
    return (
      this.run.phase === 'fight' &&
      !this.userPaused &&
      !this.hidden &&
      !this.calibrating &&
      !this.awaitingBegin &&
      performance.now() >= this.introUntil &&
      (!this.panelOpen || this.playWhilePanelOpen)
    );
  }

  syncClock(now: number): void {
    if (this.active()) this.clock.resume(now);
    else this.clock.pause(now);
  }

  /** Advance the simulation up to wall time `now`. */
  update(now: number): void {
    this.syncClock(now);
    this.trySync(now);
    const c = this.run.combat;
    if (!c || !this.clock.running) return;
    let target = this.clock.now(now) / 1000;
    if (target - c.time > MAX_CATCHUP_S) {
      // Long hitch (backgrounded tab, debugger): drop the time instead of fast-forwarding into damage.
      target = c.time + MAX_CATCHUP_S;
      this.clock.rebase(now, target * 1000);
    }
    c.advanceTo(target);
    this.flush();
  }

  /** Sim time to render at (extrapolates smoothly between 120 Hz ticks). */
  renderTime(now: number): number {
    const c = this.run.combat;
    if (!c) return 0;
    return Math.max(c.time, this.clock.now(now) / 1000);
  }

  /** A bar tap. `wallTs` is the pointer event's timeStamp (same clock as performance.now()). */
  barTap(wallTs: number): void {
    const now = performance.now();
    this.update(now);
    const c = this.run.combat;
    if (!c || !this.clock.running) return;
    // Some browsers have shipped epoch-based event timestamps: fall back to "now" if it's not plausible.
    const ts = Math.abs(now - wallTs) < 1000 ? wallTs : now;
    this.lastTap = c.tap(tapSimTime(this.clock, ts, this.settings.calibrationMs));
    this.flush();
  }

  /** Whether a tap with this pointer timestamp would land on nothing (see input's swipe handling). */
  wouldMiss(wallTs: number): boolean {
    const now = performance.now();
    this.update(now);
    const c = this.run.combat;
    if (!c || !this.clock.running) return false;
    const ts = Math.abs(now - wallTs) < 1000 ? wallTs : now;
    return c.wouldMiss(tapSimTime(this.clock, ts, this.settings.calibrationMs));
  }

  /** Start the fight now instead of waiting for the enemy's walk-in to finish. */
  skipIntro(): void {
    this.introUntil = 0;
    this.syncClock(performance.now());
  }

  finisher(): boolean {
    const now = performance.now();
    this.update(now);
    const c = this.run.combat;
    if (!c || !this.clock.running) return false;
    const ok = c.finisher();
    this.flush();
    return ok;
  }

  setTarget(enemyId: number): void {
    this.run.combat?.setTarget(enemyId);
  }

  setPhase(fn: () => void): void {
    this.syncHoldUntil = 0;
    const prev = this.run.phase;
    fn();
    this.afterPhaseChange(prev);
  }

  begin(): void {
    this.awaitingBegin = false;
    this.syncClock(performance.now());
  }

  private afterPhaseChange(prev: Phase): void {
    const now = performance.now();
    if (this.run.phase === 'fight' && this.run.combat && this.run.combat !== this.begunCombat) {
      this.begunCombat = this.run.combat;
      this.awaitingBegin = this.run.stageIndex === 0;
      this.introUntil = this.awaitingBegin ? 0 : now + INTRO_MS;
    }
    if (this.run.phase !== prev) {
      this.phaseSince = now;
      this.view?.onPhase(prev, this.run.phase);
    }
    this.syncClock(now);
  }

  flush(): void {
    const c = this.run.combat;
    if (!c) return;
    const events = c.drainEvents();
    const now = performance.now();
    if (events.length) {
      this.sounds(events);
      const hold = this.view?.onEvents(events) ?? 0;
      if (hold > 0) this.syncHoldUntil = Math.max(this.syncHoldUntil, now + hold);
    }
    this.trySync(now);
  }

  /** Apply pending phase changes (boost choice, defeat) once the view's kill animation has played out. */
  private trySync(now: number): void {
    if (now < this.syncHoldUntil) return;
    const prev = this.run.phase;
    this.run.sync();
    if (this.run.phase !== prev) this.afterPhaseChange(prev);
  }

  private sounds(events: CombatEvent[]): void {
    const a = this.audio;
    for (const e of events) {
      // Impacts (hits, blocks, bombs, the finisher's blows, kills, taking a hit) play from the scene, the moment
      // the blow lands on screen, together with their hit-stop and shake.
      switch (e.type) {
        case 'miss':
          a.miss();
          break;
        case 'finisher':
          a.finisherStart(e.stacks);
          break;
        case 'windup':
          a.windup();
          break;
        case 'meterFull':
          a.stackUp(e.stacks);
          break;
        case 'comboBreak':
          if (e.lostStacks > 0) a.stackLost(e.lostStacks);
          break;
        case 'speedUp':
          a.speedUp();
          break;
        // 'kill' sounds play from the scene when the enemy actually bursts (after the finisher's last blow)
      }
    }
  }

  relayout(): void {
    this.layout = computeLayout();
    this.view?.onLayout();
  }
}
