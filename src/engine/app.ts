// Glue between browser time/input and the deterministic core. No rendering here.
import { STORY } from '../data/story';
import { SimClock, tapSimTime } from '../core/clock';
import type { CombatEvent, TapResult } from '../core/combat';
import { Run, type Phase } from '../core/run';
import type { Profile } from '../core/profile';
import { restoreRun, snapshotRun, type RunSave } from '../core/save';
import type { Settings, Tuning } from '../core/tuning';
import { Synth, type Ambience, type MusicTrack, type TellSound } from './audio';
import { computeLayout, sameLayout, type ScreenLayout } from './layout';
import { clearRunSave, loadProfile, loadRunSave, saveSoon, writeProfile, writeRunSave } from './storage';

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
  /** The clock waits while enemies walk in (performance.now ms; a tap skips it). */
  introUntil = 0;
  /** A story scene shown in the middle of a fight (a boss changing phase): the fight waits for it. */
  storyOverlay: string | null = null;
  /** Which box of the current story scene is on screen. */
  storyBox = 0;
  /** The profile, kept across runs: progress (the world map shows it), the bag and gear, coins, scrap. */
  readonly profile: Profile;
  /** The run saved by an earlier session (offered as Continue on the title screen). */
  savedRun: RunSave | null = null;
  private begunCombat: unknown = null;
  private syncHoldUntil = 0; // performance.now() until which phase changes wait (kill animations)
  phaseSince = 0;

  constructor(
    readonly tuning: Tuning,
    readonly settings: Settings,
  ) {
    this.profile = loadProfile(tuning);
    this.run = new Run(tuning, settings, (Date.now() & 0xffffff) | 1, this.profile);
    this.audio.tuning = tuning; // live: the impact sliders apply to the next sound
    this.savedRun = loadRunSave(tuning, this.profile);
    this.layout = computeLayout();
    this.applyAudioSettings();
    this.cueAudio();
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

  /** Progress across runs (acts cleared, weights home): part of the profile. */
  get progress(): Profile {
    return this.profile;
  }

  /** Write the profile (after camp actions: equipping, the forge). */
  saveProfile(): void {
    writeProfile(this.profile);
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
      !this.storyOverlay &&
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

  /** Title screen: pick the saved run back up (or start fresh if it can't be resumed). */
  continueRun(): void {
    const save = this.savedRun;
    if (!save) return this.newRun();
    this.storyBox = 0;
    this.setPhase(() => {
      if (!restoreRun(this.run, save)) this.run.newRun();
    });
  }

  /** New run: the world map first (pick Greenmarch to start). */
  newRun(): void {
    clearRunSave();
    this.savedRun = null;
    this.storyBox = 0;
    this.setPhase(() => this.run.toWorld());
  }

  /** From the world map: start a run in Greenmarch (the intro, then Act 1). */
  startRegion(): void {
    this.storyBox = 0;
    this.setPhase(() => this.run.newRun());
  }

  /** From the world map: a run from act `act` (a cleared act replayed for its drops, or the next one). */
  startAct(act: number): void {
    this.storyBox = 0;
    clearRunSave();
    this.savedRun = null;
    this.setPhase(() => this.run.startAct(act));
  }

  /** Open the camp (from the world map, an act clear or a defeat). */
  openCamp(): void {
    this.setPhase(() => this.run.toCamp());
  }

  /** Leave the camp: back where it was opened from. */
  leaveCamp(): void {
    this.storyOverlay = null;
    this.setPhase(() => this.run.leaveCamp());
  }

  /** Back to the world map (after the victory). */
  toWorld(): void {
    this.storyOverlay = null;
    this.setPhase(() => this.run.toWorld());
  }

  /** The story scene on screen: a mid-fight one, or the run's (null when there is none). */
  get storyId(): string | null {
    if (this.storyOverlay) return this.storyOverlay;
    return this.run.phase === 'scene' ? (this.run.sceneQueue[0] ?? null) : null;
  }

  /** Tap on a story box: the next box, or the end of the scene. */
  storyNext(): void {
    const id = this.storyId;
    if (!id) return;
    this.storyBox++;
    this.audio.textBlip();
    if (this.storyBox < (STORY[id]?.length ?? 0)) return;
    this.storyBox = 0;
    if (this.storyOverlay) {
      this.storyOverlay = null;
      this.syncClock(performance.now());
    } else this.setPhase(() => this.run.advanceScene());
  }

  storySkip(): void {
    this.storyBox = 0;
    this.audio.uiClick();
    if (this.storyOverlay) {
      this.storyOverlay = null;
      this.syncClock(performance.now());
    } else this.setPhase(() => this.run.advanceScene()); // ends this scene (the next queued one still plays)
  }

  /** Save the run in progress (after every stage, and whenever the page is hidden). */
  saveRun(): void {
    const s = snapshotRun(this.run);
    writeProfile(this.profile);
    if (!s) return;
    writeRunSave(s);
    this.savedRun = s;
  }

  begin(): void {
    this.awaitingBegin = false;
    this.syncClock(performance.now());
  }

  private afterPhaseChange(prev: Phase): void {
    const now = performance.now();
    if (this.run.phase === 'fight' && this.run.combat && this.run.combat !== this.begunCombat) {
      // every fight from the map waits for TAP TO BEGIN (resumed ones too)
      this.begunCombat = this.run.combat;
      this.awaitingBegin = true;
      this.introUntil = 0;
    }
    if (this.run.phase !== 'fight' && this.run.phase !== 'camp') this.storyOverlay = null;
    if (this.run.phase !== prev) {
      this.phaseSince = now;
      if (this.run.phase === 'scene' || prev === 'scene') this.storyBox = 0;
      this.view?.onPhase(prev, this.run.phase);
    }
    this.syncClock(now);
    this.cueAudio();
    // the profile (progress, loot, coins, accuracy) changes as the run goes: save it at every step
    writeProfile(this.profile);
    if (this.run.phase === 'victory') {
      clearRunSave();
      this.savedRun = null;
    } else this.saveRun();
  }

  /** The music and the place's ambience under it, for the phase we're in. */
  private cueAudio(): void {
    this.audio.setTrack(this.track());
    this.audio.setAmbience(this.ambience());
  }

  /** The sea and gulls on the title and the world map, a breeze over the act map, the campfire and crickets at the
   *  camp, and the act's own place (forest, ruins, hollow) in its fights, nodes and scenes. */
  private ambience(): Ambience {
    const p = this.run.phase;
    if (p === 'title' || p === 'world') return 'world';
    if (p === 'camp') return 'camp';
    return p === 'map' ? 'map' : this.run.theme;
  }

  /** Battle theme in fights, the boss theme while a boss is alive, the map theme everywhere else. */
  private track(): MusicTrack {
    const r = this.run;
    if (r.phase !== 'fight') return 'map';
    return r.bossFight ? 'boss' : 'battle';
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
        case 'telegraph':
          a.telegraph(e.sound as TellSound, e.sec);
          break;
        case 'freeze':
          a.freeze();
          break;
        case 'phase': {
          // a boss changes phase: its scene plays while the fight waits
          const def = this.tuning.enemies[this.run.combat?.enemyById(e.enemyId)?.key ?? ''];
          const scene = def?.phaseScenes?.[e.phase];
          if (scene && STORY[scene]) {
            this.storyOverlay = scene;
            this.storyBox = 0;
            this.syncClock(performance.now());
          }
          break;
        }
        // 'kill' sounds play from the scene when the enemy actually bursts (after the finisher's last blow)
      }
    }
  }

  /** Re-measure the screen; redo the layout if anything moved (or when forced). True when it was redone. */
  relayout(force = false): boolean {
    const l = computeLayout();
    if (!force && sameLayout(l, this.layout)) return false;
    this.layout = l;
    if (this.sceneReady) this.view?.onLayout(); // before that, the scene's create() lays out with this.layout
    return true;
  }
}
