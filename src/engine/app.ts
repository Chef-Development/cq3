// Glue between browser time/input and the deterministic core. No rendering here.
import { SimClock, tapSimTime } from '../core/clock';
import type { CombatEvent, TapResult } from '../core/combat';
import { Run, type Phase } from '../core/run';
import type { Settings, Tuning } from '../core/tuning';
import { Synth } from './audio';
import { computeLayout, type ScreenLayout } from './layout';
import { saveSoon } from './storage';

export interface View {
  onEvents(events: CombatEvent[]): void;
  onPhase(prev: Phase, next: Phase): void;
  onLayout(): void;
}

const MAX_CATCHUP_S = 0.25;

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
  phaseSince = 0;

  constructor(
    readonly tuning: Tuning,
    readonly settings: Settings,
  ) {
    this.run = new Run(tuning, settings, (Date.now() & 0xffffff) | 1);
    this.layout = computeLayout();
    this.applyAudioSettings();
  }

  applyAudioSettings(): void {
    this.audio.muted = this.settings.muted;
    this.audio.ignoreSilentSwitch = this.settings.audioIgnoresSilentSwitch;
    this.audio.applySession();
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
    const prev = this.run.phase;
    fn();
    this.afterPhaseChange(prev);
  }

  private afterPhaseChange(prev: Phase): void {
    const now = performance.now();
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
    if (events.length) {
      this.sounds(events);
      this.view?.onEvents(events);
    }
    const prev = this.run.phase;
    this.run.sync();
    if (this.run.phase !== prev) this.afterPhaseChange(prev);
  }

  private sounds(events: CombatEvent[]): void {
    const a = this.audio;
    for (const e of events) {
      switch (e.type) {
        case 'hit':
          a.hit(e.combo, e.crit);
          if (e.perfect) a.perfect();
          break;
        case 'block':
          a.block(e.cracked);
          if (e.perfect) a.perfect();
          break;
        case 'miss':
          a.miss();
          break;
        case 'heroHurt':
          if (e.source !== 'miss') a.hurt();
          break;
        case 'finisher':
          a.finisher();
          break;
        case 'windup':
          a.windup();
          break;
        case 'explode':
          a.explode();
          break;
        case 'meterFull':
          a.ready2();
          break;
        case 'kill':
          a.kill();
          break;
      }
    }
  }

  relayout(): void {
    this.layout = computeLayout();
    this.view?.onLayout();
  }
}
