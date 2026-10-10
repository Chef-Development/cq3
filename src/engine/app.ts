// Glue between browser time/input and the deterministic core. No rendering here.
import { STORY } from '../data/story';
import { SimClock, tapSimTime } from '../core/clock';
import type { CombatEvent, TapResult } from '../core/combat';
import { Run, type Phase } from '../core/run';
import { labBaseProfile } from '../core/lab';
import { readAccuracyLog, RECENT_MAX, type AccuracyLog } from '../core/accuracy';
import { anythingToErase, type Profile } from '../core/profile';
import { restoreRun, snapshotRun, type RunSave } from '../core/save';
import { markWelcomed, TipCoach, welcomeScene } from '../core/tips';
import type { Settings, Tuning } from '../core/tuning';
import { AMBIENCES, Synth, TELL_SOUNDS, type Ambience, type MusicTrack, type TellSound } from './audio';
import { computeLayout, sameGameLayout, sameLayout, type ScreenLayout } from './layout';
import { clearRunSave, eraseProgress, loadLabAcc, loadProfile, loadRunSave, saveSoon, setStorageSlot, writeLabAcc, writeProfile, writeRunSave } from './storage';

export interface View {
  /** Returns how long (ms) the next phase change should wait so a kill / finisher animation can play out. */
  onEvents(events: CombatEvent[]): number;
  onPhase(prev: Phase, next: Phase): void;
  onLayout(): void;
  /** The later regions' art (region-art.ts), now: asked on every screen change past the title. */
  ensureRegionArt(): void;
  /** The tip card (view/tips.ts): TAP TO BEGIN asks it first (a pre-fight tip still due comes up instead). */
  readonly tips: { beforeBegin(now: number): boolean };
}

const MAX_CATCHUP_S = 0.25;
/** Bosses with a theme of their own (by enemy key; the enemy must also be a boss in the data). Region 3's
 *  (rumbleback, hobnob, bellows) wait for its enemies to join the data. */
const BOSS_THEMES: Record<string, MusicTrack> = {
  captain: 'captain',
  golem: 'golem',
  boarKing: 'boarKing',
  rimehorn: 'rimehorn',
  matron: 'matron',
  glacia: 'glacia',
  rumbleback: 'rumbleback',
  hobnob: 'hobnob',
  bellows: 'bellows',
};
/** Bosses whose theme follows their phase (layers join, and a key change for the region bosses). */
const PHASED_BOSSES = ['boarKing', 'glacia', 'hobnob', 'bellows'];
/** Each act's theme by its global index: Greenmarch is acts 0-2, the next region acts 3-5, the third 6-8 (not in
 *  play yet: until those acts exist nothing asks for theirs). */
const ACT_THEMES: MusicTrack[] = ['act1', 'act2', 'act3', 'frost1', 'frost2', 'frost3', 'ash1', 'ash2', 'ash3'];
/** Acts with their own ambience bed (on their map too); Greenmarch's come from each act's theme. */
const ACT_AMBIENCE: Partial<Record<number, Ambience>> = { 3: 'pass', 4: 'caves', 5: 'glacier', 6: 'cinder', 7: 'glass', 8: 'forge' };
export const INTRO_MS = 800;

/** The real game as the Test lab found it (put back exactly when the lab closes). */
interface RealGame {
  run: Run;
  profile: Profile;
  tips: TipCoach;
  savedRun: RunSave | null;
  storyOverlay: string | null;
  storyBox: number;
  userPaused: boolean;
  awaitingBegin: boolean;
}

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
  /** The profile, kept across runs: progress (the world map shows it), the bag and gear, coins, scrap. (In the Test
   *  lab: the lab's own profile; the real one waits in `real`.) */
  profile: Profile;
  /** The run saved by an earlier session (offered as Continue on the title screen). */
  savedRun: RunSave | null = null;
  /** "Teach it slowly": which tip shows when (core/tips.ts; the view draws it, view/tips.ts). */
  tips: TipCoach;
  /** A tip card is up: the next tap only dismisses it, and a fight waits for it. */
  tipUp = false;
  /** The Test lab's Finisher gallery holds its fight's clock between shows (view/finisher-gallery.ts). */
  galleryHold = false;
  /** A moment the view holds the fight's clock for until then (performance.now ms; taps do nothing meanwhile): the
   *  first finisher's reveal (view/finisher-reveal.ts). */
  holdUntil = 0;
  private begunCombat: unknown = null;
  private syncHoldUntil = 0; // performance.now() until which phase changes wait (kill animations)
  phaseSince = 0;
  /** The fight whose boss theme is playing: it stays on until that fight ends (a mop-up after the boss falls). */
  private bossTheme: { combat: unknown; track: MusicTrack } | null = null;
  /** After a finisher spends the combo, the fight music keeps its layers up to this combo until then. */
  private comboHold = { combo: 0, until: 0 };
  /** Called after every phase change, once the view has seen it (the Test lab watches its scenarios end). */
  readonly phaseListeners: Array<(prev: Phase, next: Phase) => void> = [];
  /** The Test lab is open: the real game set aside exactly as it was (its run, profile, tips, save), while the lab
   *  plays on its own profile, run and storage keys (engine/lab.ts). Null: the real game is on. */
  private real: RealGame | null = null;
  /** The Test lab fights' timing samples (their own key: every lab profile shares this log, so a scenario's taps
   *  are kept across scenarios and reloads; the lab report counts them with the real game's). */
  private labAcc: AccuracyLog | null = null;

  constructor(
    readonly tuning: Tuning,
    readonly settings: Settings,
  ) {
    this.profile = loadProfile(tuning);
    this.tips = new TipCoach(this.profile);
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

  /** Progress across runs (acts cleared, regions restored): part of the profile. */
  get progress(): Profile {
    return this.profile;
  }

  /** Start over: erase all progress (the profile and the run; tuning and settings stay) and reload fresh. */
  startOver(): void {
    this.leaveLab(); // (the real game's save, never the lab's)
    eraseProgress();
    window.location.reload();
  }

  /** The title offers Continue / New game: a run in progress, or anything earned that a New game would erase. */
  get canContinue(): boolean {
    return !!this.savedRun || anythingToErase(this.profile);
  }

  /** The title's New game (tapped twice): wipes everything (the profile and the run; settings stay), from the top. */
  newGame(): void {
    this.startOver();
  }

  /** Write the profile (after camp actions: equipping, the forge). */
  saveProfile(): void {
    writeProfile(this.profile);
  }

  /** The gear panel's "Tips: on/off". */
  setTipsOff(off: boolean): void {
    this.profile.tipsOff = off;
    this.saveProfile();
  }

  /** The gear panel's "Show tips again": every tip shows once more (and tips are on). */
  showTipsAgain(): void {
    this.tips.reset();
    this.saveProfile();
  }

  /**
   * A returning player's first launch of this version: Pip's welcome back plays over the title (once; it's marked
   * played the moment it starts). Never over another scene. Returns whether it started.
   */
  welcome(): boolean {
    if (this.run.phase !== 'title' || this.storyOverlay) return false;
    const id = welcomeScene(this.profile);
    if (!id || !STORY[id]) return false;
    markWelcomed(this.profile);
    this.saveProfile();
    this.storyOverlay = id;
    this.storyBox = 0;
    return true;
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
      !this.tipUp &&
      !this.galleryHold &&
      performance.now() >= this.introUntil &&
      performance.now() >= this.holdUntil &&
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

  /** A bar tap. `wallTs` is the pointer event's timeStamp (same clock as performance.now()). Returns the outcome
   *  ('hold': a hold block was pressed; input then waits for the finger to lift). */
  barTap(wallTs: number): TapResult | null {
    const now = performance.now();
    this.update(now);
    const c = this.run.combat;
    if (!c || !this.clock.running) return null;
    // Some browsers have shipped epoch-based event timestamps: fall back to "now" if it's not plausible.
    const ts = Math.abs(now - wallTs) < 1000 ? wallTs : now;
    this.lastTap = c.tap(tapSimTime(this.clock, ts, this.settings.calibrationMs));
    this.flush();
    return this.lastTap;
  }

  /** The finger holding a hold block came off (judged at the pointer event's timestamp). */
  barRelease(wallTs: number): void {
    const now = performance.now();
    this.update(now);
    const c = this.run.combat;
    if (!c || !c.holding) return;
    const ts = Math.abs(now - wallTs) < 1000 ? wallTs : now;
    c.release(tapSimTime(this.clock, ts, this.settings.calibrationMs));
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

  /** Title screen: pick the saved run back up (no run in progress: the world map, everything earned kept). */
  continueRun(): void {
    const save = this.savedRun;
    if (!save) return this.newRun();
    this.storyBox = 0;
    this.setPhase(() => {
      if (!restoreRun(this.run, save)) this.run.newRun();
    });
  }

  /** To the world map with everything earned kept (pick Greenmarch to start a run). The title's New game is newGame(). */
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

  /** The camp's Training Dummy: a practice fight (no risk, no rewards), back to the camp when it ends. */
  startPractice(): void {
    this.storyOverlay = null;
    this.setPhase(() => this.run.startPractice());
  }

  /** Walk away from a practice fight (its pause panel's "Back to camp"). */
  leavePractice(): void {
    if (!this.run.practice) return;
    this.setPhase(() => this.run.endPractice(false));
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
    // a pre-fight tip still to show (tap yellow, a hero's how-to) comes first: a TAP TO BEGIN before it came up brings
    // it up instead, and the fight keeps waiting (the playtester tapped at once and met "tap yellow" three fights in)
    if (this.view?.tips.beforeBegin(performance.now())) return;
    this.awaitingBegin = false;
    this.syncClock(performance.now());
  }

  private afterPhaseChange(prev: Phase): void {
    const now = performance.now();
    // past the title, every later region's art is in (region-art.ts: painted in idle slices until now)
    if (this.run.phase !== 'title') this.view?.ensureRegionArt();
    if (this.run.phase === 'fight' && this.run.combat && this.run.combat !== this.begunCombat) {
      // every fight from the map waits for TAP TO BEGIN (resumed ones too)
      this.begunCombat = this.run.combat;
      this.awaitingBegin = true;
      this.introUntil = 0;
    }
    if (this.run.phase !== 'fight' && this.run.phase !== 'camp') this.storyOverlay = null;
    if (this.run.phase !== prev) {
      this.phaseSince = now;
      this.tipUp = false; // a tip goes with its screen
      if (this.run.phase === 'scene' || prev === 'scene') this.storyBox = 0;
      this.view?.onPhase(prev, this.run.phase);
    }
    this.syncClock(now);
    this.cueAudio();
    // the profile (progress, loot, coins, accuracy) changes as the run goes: save it at every step
    writeProfile(this.profile);
    if (this.labAcc && this.real) writeLabAcc(this.labAcc);
    if (this.run.phase === 'victory') {
      clearRunSave();
      this.savedRun = null;
    } else this.saveRun();
    for (const fn of this.phaseListeners) fn(prev, this.run.phase);
  }

  // ------------------------------------------------------------------ the Test lab (engine/lab.ts draws it)

  get inLab(): boolean {
    return !!this.real;
  }

  /** The real game's profile, also while the lab is open (the gear panel's accuracy, the lab's report). */
  get realProfile(): Profile {
    return this.real?.profile ?? this.profile;
  }

  /** The lab fights' accuracy log (loaded from its own key the first time it's asked for). */
  labAccuracy(): AccuracyLog {
    if (!this.labAcc) this.labAcc = readAccuracyLog(loadLabAcc());
    return this.labAcc;
  }

  /**
   * The accuracy as the lab report reads it: the real game's samples and the lab fights' together (the newest
   * RECENT_MAX), with the real game's per-act history. The real save itself is never changed by the lab.
   */
  combinedAccuracy(): AccuracyLog {
    const real = this.realProfile.acc;
    const lab = this.labAccuracy();
    return { recent: [...real.recent, ...lab.recent].slice(-RECENT_MAX), history: real.history };
  }

  /**
   * Open the Test lab: the real game is saved as it stands (its own keys) and set aside untouched; storage switches
   * to the lab's keys and a lab run starts at the lab's camp. Nothing the lab does reaches the real profile or run.
   */
  enterLab(): void {
    if (this.real) return;
    this.saveRun();
    this.real = {
      run: this.run,
      profile: this.profile,
      tips: this.tips,
      savedRun: this.savedRun,
      storyOverlay: this.storyOverlay,
      storyBox: this.storyBox,
      userPaused: this.userPaused,
      awaitingBegin: this.awaitingBegin,
    };
    setStorageSlot('lab');
    this.labRun(labBaseProfile());
  }

  /** A fresh lab run on `profile` (a scenario's, from core/lab.ts labProfile), standing at the lab's camp; `setup`
   *  then takes it where the scenario plays (a practice fight, story scenes). */
  labRun(profile: Profile, setup?: (run: Run) => void): void {
    if (!this.real) return;
    const prev = this.run.phase;
    // the lab's fights add their taps to the lab's own accuracy log (shared by every lab profile)
    profile.acc = this.labAccuracy();
    this.profile = profile;
    this.tips = new TipCoach(profile);
    this.run = new Run(this.tuning, this.settings, (Date.now() & 0xffffff) | 1, profile);
    this.run.phase = 'camp';
    this.savedRun = null;
    this.storyOverlay = null;
    this.storyBox = 0;
    this.userPaused = false;
    this.awaitingBegin = false;
    this.galleryHold = false;
    this.clock.reset(0);
    this.showRun(prev);
    if (setup) this.setPhase(() => setup(this.run));
  }

  /** Leave the Test lab: storage back on the real game's keys, and the real game exactly as it was set aside (a fight
   *  comes back paused). */
  leaveLab(): void {
    const r = this.real;
    if (!r) return;
    const prev = this.run.phase;
    this.real = null;
    this.galleryHold = false;
    setStorageSlot('main');
    this.run = r.run;
    this.profile = r.profile;
    this.tips = r.tips;
    this.savedRun = r.savedRun;
    this.storyOverlay = r.storyOverlay;
    this.storyBox = r.storyBox;
    this.awaitingBegin = r.awaitingBegin;
    this.userPaused = r.userPaused || (this.run.phase === 'fight' && !r.awaitingBegin);
    this.begunCombat = this.run.combat;
    this.introUntil = 0;
    this.syncHoldUntil = 0;
    const c = this.run.combat;
    this.clock.reset(c ? c.time * 1000 : 0);
    this.showRun(prev);
  }

  /** Another run was swapped in (the lab's or the real one): the view and the music catch up, nothing is saved. */
  private showRun(prev: Phase): void {
    this.phaseSince = performance.now();
    this.tipUp = false;
    this.view?.onPhase(prev, this.run.phase);
    this.syncClock(performance.now());
    this.cueAudio();
  }

  /** The music and the place's ambience under it, for the phase we're in. */
  private cueAudio(): void {
    this.cueMusic();
    this.audio.setAmbience(this.ambience());
  }

  /** The piece for the phase we're in; in a fight it also follows the live combo (its layers) and a phased boss's
   *  phase (the Boar King, the later regions' bosses, the third region's two-headed mini-boss). Called at every phase
   *  change and every flush (the music only acts on a change, on its next beat). */
  private cueMusic(): void {
    const { track, intense } = this.music();
    this.audio.setMusic(track, intense);
    const c = this.run.combat;
    const fight = this.run.phase === 'fight' && !!c;
    const hold = performance.now() < this.comboHold.until ? this.comboHold.combo : 0;
    this.audio.setCombo(fight ? Math.max(c.combo, hold) : 0);
    this.audio.setBossPhase((fight && c.enemies.find((e) => PHASED_BOSSES.includes(e.key))?.phase) || 1);
  }

  /** The sea and gulls on the title and the world map, a breeze over the act map, the campfire and crickets at the
   *  camp, and the act's own place (forest, ruins, hollow) in its fights, nodes and scenes. The later regions' acts
   *  (pass, caves, glacier; cinder, glass, forge) keep their own bed on their map too. */
  private ambience(): Ambience {
    const p = this.run.phase;
    if (p === 'title' || p === 'world') return 'world';
    if (p === 'camp') return 'camp';
    const own = ACT_AMBIENCE[this.run.actIndex];
    if (own) return own;
    const place = this.run.theme as string;
    return p === 'map' ? 'map' : (AMBIENCES as string[]).includes(place) ? (place as Ambience) : 'map';
  }

  /** The title theme on the title and the world map, the camp's own, and each act's theme (by the global act
   *  index): calm on its map, nodes and scenes, intense in its fights; a mini-boss or a region's boss brings their
   *  own theme while alive (it plays to the end of that fight). */
  private music(): { track: MusicTrack; intense: boolean } {
    const r = this.run;
    const p = r.phase;
    if (p === 'title' || p === 'world' || p === 'victory') return { track: 'title', intense: false };
    if (p === 'camp') return { track: 'camp', intense: false };
    const act = ACT_THEMES[Math.max(0, Math.min(ACT_THEMES.length - 1, r.actIndex))];
    const c = r.combat;
    if (p !== 'fight' || !c) {
      this.bossTheme = null;
      return { track: act, intense: false };
    }
    const boss = c.enemies.find((e) => e.alive && this.tuning.enemies[e.key]?.boss && BOSS_THEMES[e.key]);
    if (boss) this.bossTheme = { combat: c, track: BOSS_THEMES[boss.key] };
    else if (this.bossTheme?.combat !== c) this.bossTheme = null;
    return { track: this.bossTheme?.track ?? act, intense: true };
  }

  flush(): void {
    const c = this.run.combat;
    if (!c) return;
    const events = c.drainEvents();
    const now = performance.now();
    // every flush, events or not: the coach counts what the player did and places a first-fight lesson's block on time
    this.tips.feed(events, c);
    if (events.length) {
      this.sounds(events);
      const hold = this.view?.onEvents(events) ?? 0;
      if (hold > 0) this.syncHoldUntil = Math.max(this.syncHoldUntil, now + hold);
    }
    this.cueMusic();
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
          // the music keeps its layers through the finisher's show before they drop with the spent combo
          this.comboHold = { combo: e.combo, until: performance.now() + this.tuning.music.finisherHold * 1000 };
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
          // (a sound not built yet, as the fourth region's until its sounds land, borrows a generic wind-up)
          a.telegraph((TELL_SOUNDS as string[]).includes(e.sound) ? (e.sound as TellSound) : 'charge', e.sec);
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
    // (only the canvas's place or scale changed, e.g. a desktop window resized: no scene rebuild, main.ts moves it)
    const rebuild = force || !sameGameLayout(l, this.layout);
    this.layout = l;
    if (this.sceneReady && rebuild) this.view?.onLayout(); // before that, the scene's create() lays out with this.layout
    return true;
  }
}
