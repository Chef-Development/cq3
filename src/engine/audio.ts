// Web Audio synth: every sound effect and all the music (battle, boss and map themes) are generated in code (no
// samples).
// Unlocked on the first user gesture. Also runs on an OfflineAudioContext (tests render every sound).
//
// Graph:
//   sfx voices ----------------------------> master -> compressor -> limiter -> soft clip -> destination
//   impact sub layer ---------------------------------------------> limiter (so it never pumps the compressor)
//   bell/finisher/kill voices -> reverb sends -> highpass -> convolver -> return -> master
//   crunchy voices -> drive -> waveshaper (soft clip + bit steps) -> lowpass -> master
//   music voices -> music bus (one per run, tuning.impact.music, ducked under big impacts) -> master
//   metronome -> click out -> destination (dry and uncompressed, so calibration timing stays exact)
//
// Impacts are layered (see core/impact.ts): a 0-5 ms crack, a saturated 120-600 Hz body whose harmonics carry
// the weight on phone speakers, a noise/debris tail, and a sub sine that only adds on headphones. The combo's
// climbing note is a quieter musical layer on top.
//
// Enemy special moves each have a telegraph (Synth.telegraph): a distinct wind-up per TellSound that lasts about
// as long as the enemy's wind-up pose and builds toward the moment the action fires. Every one keeps its character
// in the 300 Hz - 6 kHz range, so it reads over the music on a phone speaker.

import {
  FINISHER_BLOW_AT,
  finisherShowMs,
  finisherStrikeAt,
  finisherStrikes,
  hurtWeight,
  impactVoice,
  impactWeight,
  type ImpactColor,
  type ImpactTier,
  type ImpactVoice,
} from '../core/impact';
import { DEFAULT_TUNING, type Tuning } from '../core/tuning';

type Ctx = BaseAudioContext;
type Wave = Exclude<OscillatorType, 'custom'> | 'pulse25' | 'pulse12';

interface ToneOpts {
  type?: Wave;
  f: number; // start frequency (Hz)
  f1?: number; // exponential glide target (Hz)
  glide?: number; // glide time (s), defaults to dur
  at?: number; // absolute ctx start time, defaults to now
  delay?: number; // added to the start time
  dur: number; // time from start until silent (s)
  gain: number; // peak gain
  attack?: number;
  hold?: number; // time held at peak before the decay
  out?: AudioNode; // defaults to master
  rev?: number; // reverb send level
  detune?: number; // cents
  scoop?: number; // cents offset at the start that slides to `detune` in 30 ms
  minTail?: number; // shortest decay after attack + hold (s), default 10 ms
}

interface NoiseOpts {
  at?: number;
  delay?: number;
  dur: number;
  gain: number;
  attack?: number;
  hold?: number;
  filter?: BiquadFilterType; // omit for no per-voice filter
  f?: number;
  f1?: number; // exponential sweep target
  sweep?: number; // sweep time, defaults to dur
  q?: number;
  rate?: number; // playback rate (<1 = darker, boomier)
  out?: AudioNode;
  rev?: number;
  minTail?: number;
}

interface Graph {
  master: GainNode;
  limiter: AudioNode; // input of the final limiter (the sub layer joins here)
  revIn: AudioNode;
  crunch: GainNode;
  click: GainNode;
  noise: AudioBuffer;
  pulse25: PeriodicWave;
  pulse12: PeriodicWave;
  sends: Map<number, GainNode>;
}

interface MusicRig {
  bus: GainNode;
  bass: BiquadFilterNode;
  hats: BiquadFilterNode;
  snare: BiquadFilterNode;
}

const MASTER_LEVEL = 0.8;

// Hit melody: major pentatonic, wrapping up an octave every 5 combo steps.
const PENTA = [0, 2, 4, 7, 9];
const HIT_BASE = 523.25; // C5
const HIT_TOP = 13; // G7, ~2.6 octaves up; past it the blip trills between the top two notes

// ---- Music: three original 8-bar loops on a 16th-note grid. The battle theme, a boss theme that takes over when a
// boss is on screen, and a calm map theme for the node map and story scenes. ----
const LOOKAHEAD = 0.12;
const TICK_MS = 25;

type Note = [number, number] | null; // [semitones above root (bass) or midi (lead), length in steps]
export type MusicTrack = 'battle' | 'boss' | 'map';

interface Track {
  step: number; // seconds per 16th
  song: { root: number; arp: number[] }[]; // one chord per bar
  arp: number[]; // which chord tone each 16th of the arpeggio plays
  bass: (bar: number) => Note[];
  lead: Note[]; // per step: [midi, length]
}

const leadSteps = (bars: [number, number, number][][]): Note[] => {
  const at = new Array<Note>(bars.length * 16).fill(null);
  bars.forEach((bar, b) => bar.forEach(([st, m, len]) => (at[b * 16 + st] = [m, len])));
  return at;
};

// Battle: A minor, 130 BPM.
const BATTLE_BASS: Note[] = [[0, 2], null, [0, 1], [12, 1], null, [0, 1], [12, 2], null, [0, 2], null, [0, 1], [12, 1], null, [0, 1], [12, 1], [7, 1]];
const BATTLE_TURN: Note[] = [...BATTLE_BASS.slice(0, 12), [0, 1], [2, 1], [4, 1], [7, 1]];
const BATTLE: Track = {
  step: 60 / 130 / 4,
  song: [
    { root: 45, arp: [57, 60, 64, 69] }, // Am
    { root: 41, arp: [57, 60, 65, 69] }, // F
    { root: 48, arp: [55, 60, 64, 67] }, // C
    { root: 43, arp: [55, 59, 62, 67] }, // G
    { root: 45, arp: [57, 60, 64, 69] }, // Am
    { root: 41, arp: [57, 60, 65, 69] }, // F
    { root: 38, arp: [57, 62, 65, 69] }, // Dm
    { root: 40, arp: [56, 59, 64, 68] }, // E
  ],
  arp: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2],
  bass: (bar) => (bar === 7 ? BATTLE_TURN : BATTLE_BASS),
  // per bar: [step, midi, length in steps]
  lead: leadSteps([
    [[0, 69, 3], [3, 72, 3], [6, 76, 2], [8, 81, 4], [12, 79, 2], [14, 76, 2]],
    [[0, 77, 3], [3, 76, 3], [6, 72, 2], [8, 69, 6], [14, 72, 2]],
    [[0, 79, 3], [3, 76, 3], [6, 72, 2], [8, 76, 2], [10, 79, 2], [12, 84, 4]],
    [[0, 83, 3], [3, 81, 3], [6, 79, 2], [8, 74, 6]],
    [[0, 69, 3], [3, 72, 3], [6, 76, 2], [8, 81, 2], [10, 83, 2], [12, 84, 4]],
    [[0, 81, 3], [3, 79, 3], [6, 77, 2], [8, 72, 4], [12, 77, 2], [14, 81, 2]],
    [[0, 81, 3], [3, 77, 3], [6, 74, 2], [8, 77, 2], [10, 81, 2], [12, 86, 4]],
    [[0, 83, 3], [3, 80, 3], [6, 76, 2], [8, 74, 2], [10, 76, 2], [12, 71, 2], [14, 68, 2]],
  ]),
};

// Boss: D minor, 150 BPM, a galloping bass and a darker, climbing lead.
const GALLOP: Note[] = [[0, 1], null, [0, 1], [0, 1], [0, 1], null, [0, 1], [0, 1], [0, 1], null, [0, 1], [0, 1], [0, 1], [12, 1], [10, 1], [7, 1]];
const GALLOP_TURN: Note[] = [...GALLOP.slice(0, 8), [0, 1], [3, 1], [5, 1], [7, 1], [8, 1], [7, 1], [5, 1], [4, 1]];
const BOSS: Track = {
  step: 60 / 150 / 4,
  song: [
    { root: 38, arp: [62, 65, 69, 74] }, // Dm
    { root: 34, arp: [62, 65, 70, 74] }, // Bb
    { root: 36, arp: [64, 67, 72, 76] }, // C
    { root: 33, arp: [61, 64, 69, 73] }, // A
    { root: 38, arp: [62, 65, 69, 74] }, // Dm
    { root: 34, arp: [62, 65, 70, 74] }, // Bb
    { root: 31, arp: [62, 67, 70, 74] }, // Gm
    { root: 33, arp: [61, 64, 67, 73] }, // A7
  ],
  arp: [0, 1, 2, 1, 0, 1, 2, 3, 0, 1, 2, 1, 3, 2, 1, 0],
  bass: (bar) => (bar === 7 ? GALLOP_TURN : GALLOP),
  lead: leadSteps([
    [[0, 74, 4], [4, 77, 2], [6, 76, 2], [8, 74, 4], [12, 69, 4]],
    [[0, 70, 4], [4, 74, 2], [6, 72, 2], [8, 70, 6], [14, 69, 2]],
    [[0, 72, 3], [3, 76, 3], [6, 79, 2], [8, 77, 4], [12, 76, 4]],
    [[0, 73, 4], [4, 76, 4], [8, 81, 6], [14, 79, 2]],
    [[0, 74, 2], [2, 77, 2], [4, 81, 4], [8, 82, 2], [10, 81, 2], [12, 77, 4]],
    [[0, 82, 4], [4, 81, 2], [6, 77, 2], [8, 74, 6], [14, 77, 2]],
    [[0, 79, 3], [3, 77, 3], [6, 74, 2], [8, 70, 4], [12, 74, 4]],
    [[0, 73, 2], [2, 76, 2], [4, 79, 2], [6, 81, 2], [8, 85, 8]],
  ]),
};
// Map: F major, 100 BPM. Calm and adventurous: a music-box arpeggio in 8ths, a walking bass in quarters, a soft
// flute-like lead and light percussion (see mapStep).
const walk = (notes: number[]): Note[] => {
  const at = new Array<Note>(16).fill(null);
  notes.forEach((st, i) => (at[i * 4] = [st, 3]));
  return at;
};
const MAP_WALK: Note[][] = [
  walk([0, 4, 7, 2]), // F A C G -> A
  walk([0, 3, 7, 0]), // A C E A -> Bb
  walk([0, 4, 7, 1]), // Bb D F B -> C
  walk([0, -1, -3, -5]), // C B A G -> F
  walk([0, 2, 4, 7]), // F G A C -> D
  walk([0, -2, -4, -5]), // D C Bb A -> G
  walk([0, 3, 7, 4]), // G Bb D B -> C
  walk([0, -2, -3, -5]), // C Bb A G -> F
];
const MAP: Track = {
  step: 60 / 100 / 4,
  song: [
    { root: 41, arp: [60, 65, 69, 72] }, // F
    { root: 45, arp: [60, 64, 69, 72] }, // Am
    { root: 46, arp: [58, 62, 65, 70] }, // Bb
    { root: 48, arp: [60, 64, 67, 72] }, // C
    { root: 41, arp: [60, 65, 69, 72] }, // F
    { root: 50, arp: [57, 62, 65, 69] }, // Dm
    { root: 43, arp: [58, 62, 67, 70] }, // Gm
    { root: 48, arp: [58, 64, 67, 72] }, // C7
  ],
  arp: [0, 0, 1, 1, 2, 2, 3, 3, 2, 2, 1, 1, 2, 2, 3, 3], // read on the 8ths (even steps)
  bass: (bar) => MAP_WALK[bar],
  lead: leadSteps([
    [[0, 72, 4], [4, 77, 2], [6, 79, 2], [8, 81, 6], [14, 79, 2]],
    [[0, 76, 6], [6, 74, 2], [8, 72, 4], [12, 69, 4]],
    [[0, 70, 4], [4, 74, 2], [6, 77, 2], [8, 79, 4], [12, 77, 2], [14, 74, 2]],
    [[0, 76, 6], [6, 74, 2], [8, 72, 8]],
    [[0, 72, 4], [4, 77, 2], [6, 79, 2], [8, 81, 4], [12, 84, 4]],
    [[0, 81, 6], [6, 79, 2], [8, 77, 4], [12, 74, 4]],
    [[0, 70, 4], [4, 74, 2], [6, 79, 2], [8, 77, 4], [12, 76, 4]],
    [[0, 79, 6], [6, 77, 2], [8, 76, 4], [12, 74, 2], [14, 76, 2]],
  ]),
};
const TRACKS: Record<MusicTrack, Track> = { battle: BATTLE, boss: BOSS, map: MAP };
const LOOP_STEPS = 8 * 16;

const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** Enemy special-move telegraphs: each has its own wind-up sound (Synth.telegraph). */
export type TellSound =
  | 'split'
  | 'charge'
  | 'smoke'
  | 'dive'
  | 'volley'
  | 'spores'
  | 'shell'
  | 'howl'
  | 'guard'
  | 'bombs'
  | 'call'
  | 'hugeShield'
  | 'stomp'
  | 'summon'
  | 'phase'
  | 'enrage';
export const TELL_SOUNDS: TellSound[] = ['split', 'charge', 'smoke', 'dive', 'volley', 'spores', 'shell', 'howl', 'guard', 'bombs', 'call', 'hugeShield', 'stomp', 'summon', 'phase', 'enrage'];

/** Mix level per telegraph (scales every voice in it), balanced by ear-by-numbers so they all land at about the
 *  same phone-speaker loudness: well over the music, under the heavy impacts (tests/unit/audio.test.ts). */
const TELL_MIX: Record<TellSound, number> = {
  split: 0.54,
  charge: 0.64,
  smoke: 0.76,
  dive: 0.71,
  volley: 0.77,
  spores: 1.15,
  shell: 0.92,
  howl: 0.3,
  guard: 0.92,
  bombs: 1,
  call: 0.27,
  hugeShield: 0.72,
  stomp: 0.85,
  summon: 0.5,
  phase: 0.48,
  enrage: 0.76,
};

/** [seconds after a voice starts, value] breakpoints (see Synth.voice). */
type Pts = [number, number][];
const scalePts = (p: Pts, k: number): Pts => p.map(([d, v]): [number, number] => [d, v * k]);

interface VoiceOpts {
  at: number; // absolute ctx start time
  type?: Wave | 'noise';
  f?: Pts; // oscillator pitch (Hz), exponential ramps between the points
  amp: Pts; // gain, linear ramps up from silence at `at`; the voice ends at the last point
  filter?: BiquadFilterType;
  ff?: Pts; // filter frequency (Hz), exponential ramps
  q?: number;
  vib?: { rate: number; cents: number; rate1?: number; cents1?: number }; // pitch LFO, ramping to rate1/cents1
  trem?: { rate: number; depth: number; rate1?: number; wave?: OscillatorType }; // amplitude LFO (depth 0..1)
  rate?: number; // noise playback rate (<1 = darker)
  out?: AudioNode; // defaults to master
  rev?: number; // reverb send level
}

function crunchCurve() {
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = Math.tanh(((i / (n - 1)) * 2 - 1) * 3.5);
    c[i] = 0.65 * s + (0.35 * Math.round(s * 7)) / 7; // partly bit-stepped for a chunky retro edge
  }
  return c;
}

/** Final safety: transparent up to 0.85, then a smooth knee that never passes 0.98 (input is pre-scaled by 0.5). */
function softClipCurve() {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 2;
    const a = Math.abs(x);
    const y = a <= 0.85 ? a : 0.85 + 0.13 * Math.tanh((a - 0.85) / 0.13);
    c[i] = Math.sign(x) * y;
  }
  return c;
}

function impulse(ctx: Ctx, seconds: number, rand: () => number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const fadeIn = Math.floor(rate * 0.003);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (rand() * 2 - 1) * Math.pow(1 - i / len, 3) * (i < fadeIn ? i / fadeIn : 1);
  }
  return buf;
}

function pulseWave(ctx: Ctx, duty: number): PeriodicWave {
  const n = 40;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

function buildGraph(ctx: Ctx, muted: boolean, rand: () => number): Graph {
  const pre = ctx.createGain();
  pre.gain.value = 0.5;
  const clip = ctx.createWaveShaper();
  clip.curve = softClipCurve();
  clip.oversample = '2x';
  pre.connect(clip);
  clip.connect(ctx.destination);

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1.5;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;
  limiter.connect(pre);

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -8; // gentle, so heavy impacts stay louder than light ones
  comp.knee.value = 6;
  comp.ratio.value = 3;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  comp.connect(limiter);

  const master = ctx.createGain();
  master.gain.value = muted ? 0 : MASTER_LEVEL;
  master.connect(comp);

  const revIn = ctx.createBiquadFilter();
  revIn.type = 'highpass';
  revIn.frequency.value = 280;
  const conv = ctx.createConvolver();
  conv.buffer = impulse(ctx, 0.6, rand);
  const revOut = ctx.createGain();
  revOut.gain.value = 0.6;
  revIn.connect(conv);
  conv.connect(revOut);
  revOut.connect(master);

  const crunch = ctx.createGain();
  crunch.gain.value = 1.5;
  const shaper = ctx.createWaveShaper();
  shaper.curve = crunchCurve();
  shaper.oversample = 'none';
  const crunchLp = ctx.createBiquadFilter();
  crunchLp.type = 'lowpass';
  crunchLp.frequency.value = 4800;
  const crunchOut = ctx.createGain();
  crunchOut.gain.value = 0.42;
  crunch.connect(shaper);
  shaper.connect(crunchLp);
  crunchLp.connect(crunchOut);
  crunchOut.connect(master);

  const click = ctx.createGain();
  click.gain.value = 0.5;
  click.connect(ctx.destination);

  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = rand() * 2 - 1;

  return { master, limiter, revIn, crunch, click, noise, pulse25: pulseWave(ctx, 0.25), pulse12: pulseWave(ctx, 0.125), sends: new Map() };
}

export interface SynthOptions {
  /** Render into this context (an OfflineAudioContext in tests) instead of creating one on unlock. */
  ctx?: BaseAudioContext;
  tuning?: Tuning;
  /** 0..1 random source (noise, variation); seed it for repeatable renders. */
  rand?: () => number;
}

export class Synth {
  ctx: Ctx | null = null;
  ignoreSilentSwitch = true;
  musicOn = true;
  /** Live tuning (the impact group drives the layered hits and the music level). */
  tuning: Tuning;
  private readonly offline: boolean;
  private readonly rand: () => number;
  private graph: Graph | null = null;
  private _muted = false;
  private curves = new Map<number, Float32Array>();
  private trim = 1; // scales every voice's gain while a telegraph schedules its voices (TELL_MIX)

  private rig: MusicRig | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicManaged = false; // startMusic/stopMusic was called: unlock() no longer auto-starts
  private musicStep = 0;
  private track: MusicTrack = 'battle';
  private nextTrack: MusicTrack = 'battle'; // switches on the next beat
  private musicNext = 0;
  private musicResync = true;
  private musicDucked = false;
  private duckUntil = 0; // music stays silent while metronome clicks are scheduled
  private impactDuckUntil = 0; // an impact dipped the music until this ctx time
  private musicLevelSet = -1;

  constructor(o: SynthOptions = {}) {
    this.tuning = o.tuning ?? DEFAULT_TUNING;
    this.rand = o.rand ?? Math.random;
    this.offline = !!o.ctx;
    if (o.ctx) {
      this.ctx = o.ctx;
      this.graph = buildGraph(o.ctx, false, this.rand);
    }
  }

  get muted(): boolean {
    return this._muted;
  }

  set muted(v: boolean) {
    this._muted = v;
    const ctx = this.ctx;
    if (ctx && this.graph) this.graph.master.gain.setTargetAtTime(v ? 0 : MASTER_LEVEL, ctx.currentTime, 0.01);
  }

  private get musicLevel(): number {
    return Math.max(0, this.tuning.impact.music);
  }

  private ensure(): Ctx | null {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    let ctx: AudioContext;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      return null;
    }
    this.ctx = ctx;
    this.graph = buildGraph(ctx, this._muted, this.rand);
    return ctx;
  }

  /** Call from user-gesture handlers (pointerdown/pointerup/touchend/keydown). Safe to call repeatedly. */
  unlock(): void {
    if (this.offline) return;
    this.applySession();
    const ctx = this.ensure() as AudioContext | null;
    if (!ctx) return;
    if (ctx.state !== 'running') {
      ctx.resume().catch(() => undefined);
      // A silent buffer played inside the gesture fully unlocks older iOS versions.
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.onended = () => src.disconnect();
      src.start(0);
    }
    if (this.musicOn && !this.musicManaged) this.startMusic();
  }

  applySession(): void {
    const nav = (typeof navigator !== 'undefined' ? navigator : {}) as unknown as { audioSession?: { type: string } };
    try {
      if (nav.audioSession) nav.audioSession.type = this.ignoreSilentSwitch ? 'playback' : 'ambient';
    } catch {
      /* not supported */
    }
  }

  get ready(): boolean {
    return !!this.ctx && (this.offline || this.ctx.state === 'running') && !this.muted;
  }

  /** Output latency estimate in seconds (used by calibration to line clicks up with visuals). */
  get latency(): number {
    const c = this.ctx as (AudioContext & { outputLatency?: number }) | null;
    return c ? (c.outputLatency || 0) + (c.baseLatency || 0) : 0;
  }

  private now(at?: number): number {
    return at ?? this.ctx!.currentTime;
  }

  // ---------------------------------------------------------------- voices

  private env(peak: number, t: number, attack: number, hold: number, dur: number, minTail = 0.01): { g: GainNode; end: number } {
    const g = this.ctx!.createGain();
    const a = Math.max(0.0002, attack);
    const end = Math.max(t + dur, t + a + hold + minTail);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (hold > 0) g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    return { g, end };
  }

  /** Persistent reverb send per (quantised) level, so voices add no extra nodes for it. */
  private send(level: number): GainNode {
    const gr = this.graph!;
    const k = Math.round(level * 20) / 20;
    let s = gr.sends.get(k);
    if (!s) {
      s = this.ctx!.createGain();
      s.gain.value = k;
      s.connect(gr.revIn);
      gr.sends.set(k, s);
    }
    return s;
  }

  private tone(o: ToneOpts): void {
    const ctx = this.ctx!;
    const gr = this.graph!;
    const t = (o.at ?? ctx.currentTime) + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    if (o.type === 'pulse25') osc.setPeriodicWave(gr.pulse25);
    else if (o.type === 'pulse12') osc.setPeriodicWave(gr.pulse12);
    else osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + (o.glide ?? o.dur));
    const det = o.detune ?? 0;
    if (o.scoop) {
      osc.detune.setValueAtTime(det + o.scoop, t);
      osc.detune.linearRampToValueAtTime(det, t + 0.03);
    } else if (det) osc.detune.value = det;
    const { g, end } = this.env(o.gain * this.trim, t, o.attack ?? 0.002, o.hold ?? 0, o.dur, o.minTail);
    osc.connect(g);
    g.connect(o.out ?? gr.master);
    if (o.rev) g.connect(this.send(o.rev));
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
    osc.start(t);
    osc.stop(end + 0.02);
  }

  private noise(o: NoiseOpts): void {
    const ctx = this.ctx!;
    const gr = this.graph!;
    const t = (o.at ?? ctx.currentTime) + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = gr.noise;
    src.loop = true;
    if (o.rate) src.playbackRate.value = o.rate;
    const { g, end } = this.env(o.gain * this.trim, t, o.attack ?? 0.001, o.hold ?? 0, o.dur, o.minTail);
    let filt: BiquadFilterNode | null = null;
    if (o.filter) {
      filt = ctx.createBiquadFilter();
      filt.type = o.filter;
      filt.Q.value = o.q ?? 1;
      filt.frequency.setValueAtTime(o.f ?? 1000, t);
      if (o.f1) filt.frequency.exponentialRampToValueAtTime(o.f1, t + (o.sweep ?? o.dur));
      src.connect(filt);
      filt.connect(g);
    } else src.connect(g);
    g.connect(o.out ?? gr.master);
    if (o.rev) g.connect(this.send(o.rev));
    src.onended = () => {
      src.disconnect();
      filt?.disconnect();
      g.disconnect();
    };
    src.start(t, this.rand() * 0.9);
    src.stop(end + 0.02);
  }

  /** Inharmonic sine partials (glockenspiel-like) with reverb. */
  private bell(f: number, at: number, gain: number, rev: number): void {
    this.tone({ type: 'sine', f, at, dur: 0.5, gain, rev });
    this.tone({ type: 'sine', f: f * 2.76, at, dur: 0.22, gain: gain * 0.5, rev });
    this.tone({ type: 'sine', f: f * 5.4, at, dur: 0.09, gain: gain * 0.3, rev });
  }

  /** Sets an AudioParam to the first point at `t`, then ramps through the rest. */
  private automate(p: AudioParam, pts: Pts, t: number, exp: boolean): void {
    p.setValueAtTime(pts[0][1], t);
    if (pts[0][0] > 0) p.setValueAtTime(pts[0][1], t + pts[0][0]);
    for (let i = 1; i < pts.length; i++) {
      const [dt, v] = pts[i];
      if (exp) p.exponentialRampToValueAtTime(Math.max(1e-4, v), t + dt);
      else p.linearRampToValueAtTime(v, t + dt);
    }
  }

  /** A shaped voice (oscillator or noise) with breakpoint pitch, gain and filter curves, plus optional vibrato
   *  and tremolo. The building block of the telegraphs, whose sounds change shape over their whole length. */
  private voice(o: VoiceOpts): void {
    const ctx = this.ctx!;
    const gr = this.graph!;
    const t = o.at;
    const end = t + o.amp[o.amp.length - 1][0];
    const nodes: AudioNode[] = [];
    const lfo = (rate: number, rate1: number | undefined, depth: number, depth1: number | undefined, wave: OscillatorType, target: AudioParam) => {
      const l = ctx.createOscillator();
      l.type = wave;
      l.frequency.setValueAtTime(rate, t);
      if (rate1 !== undefined) l.frequency.linearRampToValueAtTime(rate1, end);
      const d = ctx.createGain();
      d.gain.setValueAtTime(depth, t);
      if (depth1 !== undefined) d.gain.linearRampToValueAtTime(depth1, end);
      l.connect(d);
      d.connect(target);
      l.start(t);
      l.stop(end + 0.02);
      nodes.push(l, d);
    };
    let src: AudioScheduledSourceNode;
    if (o.type === 'noise') {
      const b = ctx.createBufferSource();
      b.buffer = gr.noise;
      b.loop = true;
      if (o.rate) b.playbackRate.value = o.rate;
      src = b;
    } else {
      const osc = ctx.createOscillator();
      if (o.type === 'pulse25') osc.setPeriodicWave(gr.pulse25);
      else if (o.type === 'pulse12') osc.setPeriodicWave(gr.pulse12);
      else osc.type = o.type ?? 'square';
      this.automate(osc.frequency, o.f ?? [[0, 440]], t, true);
      if (o.vib) lfo(o.vib.rate, o.vib.rate1, o.vib.cents, o.vib.cents1, 'sine', osc.detune);
      src = osc;
    }
    let head: AudioNode = src;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter;
      f.Q.value = o.q ?? 1;
      this.automate(f.frequency, o.ff ?? [[0, 1000]], t, true);
      head.connect(f);
      head = f;
      nodes.push(f);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    for (const [dt, v] of o.amp) g.gain.linearRampToValueAtTime(v * this.trim, t + dt);
    head.connect(g);
    nodes.push(g);
    let tail: AudioNode = g;
    if (o.trem) {
      const tg = ctx.createGain();
      tg.gain.value = 1 - o.trem.depth / 2;
      lfo(o.trem.rate, o.trem.rate1, o.trem.depth / 2, undefined, o.trem.wave ?? 'sine', tg.gain);
      g.connect(tg);
      tail = tg;
      nodes.push(tg);
    }
    tail.connect(o.out ?? gr.master);
    if (o.rev) tail.connect(this.send(o.rev));
    src.onended = () => {
      src.disconnect();
      for (const n of nodes) n.disconnect();
    };
    if (o.type === 'noise') (src as AudioBufferSourceNode).start(t, this.rand() * 0.9);
    else src.start(t);
    src.stop(end + 0.02);
  }

  /** Short clicks at the given ctx times: one noise voice through a resonant bandpass, its gain spiking at each. */
  private ticks(at: number[], o: { gain: number; f: number; q?: number; ms?: number; out?: AudioNode; rev?: number }): void {
    if (!at.length) return;
    const ctx = this.ctx!;
    const gr = this.graph!;
    const times = [...at].sort((a, b) => a - b);
    const len = (o.ms ?? 6) / 1000;
    const src = ctx.createBufferSource();
    src.buffer = gr.noise;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = o.f;
    filt.Q.value = o.q ?? 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, times[0]);
    let last = times[0];
    for (const ti of times) {
      if (ti < last) continue;
      g.gain.setValueAtTime(0, ti);
      g.gain.linearRampToValueAtTime(o.gain * this.trim * (0.75 + 0.5 * this.rand()), ti + 0.0008);
      g.gain.linearRampToValueAtTime(0, ti + len);
      last = ti + len;
    }
    src.connect(filt);
    filt.connect(g);
    g.connect(o.out ?? gr.master);
    if (o.rev) g.connect(this.send(o.rev));
    src.onended = () => {
      src.disconnect();
      filt.disconnect();
      g.disconnect();
    };
    src.start(times[0], this.rand() * 0.9);
    src.stop(last + 0.02);
  }

  /** tanh saturation curve for drive k, normalised so full scale stays full scale (cached per quarter step). */
  private driveCurve(k: number): Float32Array {
    const key = Math.max(0.25, Math.round(k * 4) / 4);
    let c = this.curves.get(key);
    if (!c) {
      const n = 1024;
      c = new Float32Array(n);
      const norm = Math.tanh(key);
      for (let i = 0; i < n; i++) c[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * key) / norm;
      this.curves.set(key, c);
    }
    return c;
  }

  // ---------------------------------------------------------------- impacts

  /** One layered impact of weight w (0..1) at ctx time t. */
  impact(w: number, color: ImpactColor = 'flesh', at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.renderImpact(impactVoice(this.tuning, w, color, this.rand), t);
  }

  private renderImpact(v: ImpactVoice, t: number): void {
    const gr = this.graph!;
    // (a) crack: a 0-5 ms snap of bright noise plus a click
    if (v.crack.gain > 0) {
      const d = v.crack.ms / 1000;
      this.noise({ at: t, dur: d, attack: 0.0003, gain: v.crack.gain, filter: 'highpass', f: v.crack.hz, q: 0.7, minTail: 0.002 });
      this.tone({ type: 'square', f: v.crack.hz * 0.3, at: t, dur: d, attack: 0.0002, gain: v.crack.gain * 0.35, minTail: 0.002 });
    }
    // (b) body: a pitch-dropping triangle into a tanh saturator; the envelope sits before the saturator, so the
    // hit is dense and loud at first and cleans up as it decays
    if (v.body.gain > 0) this.bodyVoice(t, v.body);
    if (v.thud.gain > 0) this.noise({ at: t, dur: v.thud.ms / 1000, attack: 0.0008, gain: v.thud.gain, filter: 'bandpass', f: v.thud.hz, f1: v.thud.hz * 0.6, q: 1.3 });
    // (c) tail: band-swept noise, gritty for heavier hits, plus scattered debris ticks
    const tj = t + 0.004 + v.jitterMs / 1000;
    const td = v.tail.ms / 1000;
    if (v.tail.gain > 0) {
      this.noise({ at: tj, dur: td, attack: 0.004, gain: v.tail.gain * (1 - 0.45 * v.tail.grit), filter: 'bandpass', f: v.tail.hz0, f1: v.tail.hz1, sweep: td * 0.8, q: 0.9, rev: v.tail.rev });
      if (v.tail.grit > 0) this.noise({ at: tj, dur: td * 0.7, gain: v.tail.gain * v.tail.grit * 0.9, filter: 'lowpass', f: v.tail.hz0 * 1.2, f1: Math.max(80, v.tail.hz1), out: gr.crunch, rate: 0.7 });
      if (v.debris > 0) this.debrisTicks(tj, v.debris, td, v.tail.gain);
    }
    // (d) sub: deep sine straight into the limiter (phone speakers can't play it; headphones get the thump)
    if (v.sub.gain > 0) {
      const d = v.sub.ms / 1000;
      this.tone({ type: 'sine', f: v.sub.hz * 1.8, f1: v.sub.hz, glide: Math.min(0.08, d * 0.3), at: t, dur: d, attack: 0.003, hold: d * 0.15, gain: v.sub.gain, out: gr.limiter });
    }
  }

  private bodyVoice(t: number, b: ImpactVoice['body']): void {
    const ctx = this.ctx!;
    const dur = Math.max(0.02, b.ms / 1000);
    const glide = t + Math.min(dur * 0.5, 0.09);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(b.hz0, t);
    osc.frequency.exponentialRampToValueAtTime(b.hz1, glide);
    // a sine an octave up feeds the saturator too: their intermodulation fills in the whole harmonic series,
    // so a phone speaker that can't play the fundamental still conveys the pitch and the weight
    const oct = ctx.createOscillator();
    oct.type = 'sine';
    oct.frequency.setValueAtTime(b.hz0 * 2, t);
    oct.frequency.exponentialRampToValueAtTime(b.hz1 * 2, glide);
    const octLevel = ctx.createGain();
    octLevel.gain.value = 0.55;
    oct.connect(octLevel);
    const pre = ctx.createGain();
    pre.gain.setValueAtTime(0, t);
    pre.gain.linearRampToValueAtTime(1, t + 0.0015);
    pre.gain.setValueAtTime(1, t + 0.0015 + dur * 0.12);
    pre.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const sh = ctx.createWaveShaper();
    sh.curve = this.driveCurve(b.drive) as Float32Array<ArrayBuffer>;
    sh.oversample = '2x';
    const post = ctx.createGain();
    post.gain.setValueAtTime(b.gain, t);
    post.gain.setValueAtTime(b.gain, t + dur * 0.7);
    post.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(pre);
    octLevel.connect(pre);
    pre.connect(sh);
    sh.connect(post);
    post.connect(this.graph!.master);
    osc.onended = () => {
      osc.disconnect();
      oct.disconnect();
      octLevel.disconnect();
      pre.disconnect();
      sh.disconnect();
      post.disconnect();
    };
    osc.start(t);
    oct.start(t);
    osc.stop(t + dur + 0.02);
    oct.stop(t + dur + 0.02);
  }

  /** n tiny gritty ticks scattered over the tail (one noise voice, its gain spiking n times). */
  private debrisTicks(t0: number, n: number, span: number, gain: number): void {
    const ctx = this.ctx!;
    const times: number[] = [];
    for (let i = 0; i < n; i++) times.push(t0 + 0.015 + this.rand() * span * 0.75);
    times.sort((a, b) => a - b);
    const src = ctx.createBufferSource();
    src.buffer = this.graph!.noise;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 2400 + this.rand() * 1600;
    filt.Q.value = 1.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    let last = t0;
    for (const ti of times) {
      if (ti < last + 0.008) continue;
      const p = gain * (0.7 + 0.5 * this.rand()) * (1 - ((ti - t0) / span) * 0.6);
      g.gain.setValueAtTime(0, ti);
      g.gain.linearRampToValueAtTime(p, ti + 0.0008);
      g.gain.linearRampToValueAtTime(0, ti + 0.006);
      last = ti + 0.006;
    }
    src.connect(filt);
    filt.connect(g);
    g.connect(this.graph!.master);
    src.onended = () => {
      src.disconnect();
      filt.disconnect();
      g.disconnect();
    };
    src.start(t0, this.rand() * 0.9);
    src.stop(last + 0.02);
  }

  /** The combo's climbing note (major pentatonic), the musical layer on top of a hit. */
  private comboNote(combo: number, t: number): void {
    const level = this.tuning.impact.combo;
    if (level <= 0 || combo < 1) return;
    const n = Math.max(0, Math.floor(combo) - 1);
    const idx = n <= HIT_TOP ? n : HIT_TOP - ((n - HIT_TOP) % 2);
    const f = HIT_BASE * Math.pow(2, (12 * Math.floor(idx / 5) + PENTA[idx % 5]) / 12);
    this.tone({ type: 'pulse25', f, at: t, delay: 0.003, dur: 0.09, gain: 0.085 * (1 - idx / 32) * level });
    this.tone({ type: 'triangle', f, at: t, delay: 0.003, dur: 0.14, gain: 0.2 * level });
  }

  /** Dip the music under a big impact; it swells back over `ms`. */
  duckMusic(depth: number, ms: number, at?: number): void {
    const rig = this.rig;
    if (!rig || !this.ctx || depth <= 0 || this.musicDucked) return;
    const t = this.now(at);
    const level = this.musicLevel;
    const p = rig.bus.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(level * (1 - Math.min(1, depth)), t + 0.012);
    p.setTargetAtTime(level, t + 0.04 + (ms / 1000) * 0.25, Math.max(0.01, ms / 3000));
    this.impactDuckUntil = t + ms / 1000;
  }

  // ---------------------------------------------------------------- sfx

  /** A blow of the given tier lands (stacks: finisher size). Adds the tier's musical layer. */
  strike(tier: ImpactTier, o: { stacks?: number; combo?: number; at?: number } = {}): void {
    if (!this.ready) return;
    const t = this.now(o.at);
    const w = impactWeight(this.tuning, tier, o.stacks ?? 1);
    switch (tier) {
      case 'hit':
      case 'perfect':
      case 'crit':
        this.impact(w, 'flesh', t);
        this.comboNote(o.combo ?? 1, t);
        if (tier === 'perfect') this.perfect(t);
        break;
      case 'block':
        this.block(false, false, t);
        break;
      case 'bomb':
        this.explode(t);
        break;
      case 'finisher':
        this.finisherBoom(o.stacks ?? 1, t);
        break;
      case 'kill':
      case 'bossKill':
        this.enemyPop(tier === 'bossKill', t);
        break;
    }
  }

  /** An attack hit (crit and perfect are heavier tiers). */
  hit(combo: number, crit: boolean, perfect = false, at?: number): void {
    this.strike(crit ? 'crit' : perfect ? 'perfect' : 'hit', { combo, at });
  }

  /** Quiet swish of the sword starting its swing (the tap's instant feedback before the hero's dash lands). */
  swish(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.noise({ at: t, dur: 0.06, attack: 0.012, gain: 0.16, filter: 'bandpass', f: 1800, f1: 5200, sweep: 0.05, q: 1.6 });
  }

  perfect(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const lvl = Math.min(1.5, this.tuning.impact.combo * 0.9);
    this.bell(1567.98, t + 0.008, 0.13 * lvl, 0.4); // G6
    this.bell(2349.32, t + 0.055, 0.08 * lvl, 0.5); // D7
    this.noise({ at: t, dur: 0.05, gain: 0.08, filter: 'highpass', f: 7000 });
  }

  /** A parry. A shield's first (cracking) tap is a little lighter and crunchier. */
  block(cracked: boolean, perfect = false, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const w = impactWeight(this.tuning, 'block') * (cracked ? 0.9 : 1);
    this.impact(w, 'metal', t);
    // the ringing clang on top
    const lvl = Math.min(1.5, this.tuning.impact.combo * 1.6);
    const f = (cracked ? 400 : 640) * (1 + (this.rand() - 0.5) * 0.03);
    if (!cracked) {
      this.tone({ type: 'square', f, at: t, dur: 0.26, gain: 0.06 * lvl, rev: 0.2 });
      this.tone({ type: 'triangle', f: f * 2.4, at: t, dur: 0.18, gain: 0.11 * lvl, rev: 0.2 });
      this.tone({ type: 'triangle', f: f * 3.9, at: t, dur: 0.11, gain: 0.08 * lvl, rev: 0.2 });
    } else {
      this.tone({ type: 'square', f, f1: f * 0.94, at: t, dur: 0.14, gain: 0.06 * lvl, out: this.graph!.crunch });
      this.tone({ type: 'triangle', f: f * 2.4, at: t, dur: 0.09, gain: 0.1 * lvl });
    }
    if (perfect) this.perfect(t);
  }

  miss(at?: number): void {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = this.now(at);
    // Two slightly detuned squares through a closing resonant lowpass: a short, sour "bwomp".
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 7;
    lp.frequency.setValueAtTime(1500, t);
    lp.frequency.exponentialRampToValueAtTime(240, t + 0.16);
    const { g, end } = this.env(0.2, t, 0.006, 0.02, 0.2);
    const a = ctx.createOscillator();
    const b = ctx.createOscillator();
    a.type = b.type = 'square';
    a.frequency.setValueAtTime(220, t);
    a.frequency.exponentialRampToValueAtTime(140, t + 0.18);
    b.frequency.setValueAtTime(220 * 1.04, t);
    b.frequency.exponentialRampToValueAtTime(140 * 1.04, t + 0.18);
    a.connect(lp);
    b.connect(lp);
    lp.connect(g);
    g.connect(this.graph!.master);
    a.onended = () => {
      a.disconnect();
      b.disconnect();
      lp.disconnect();
      g.disconnect();
    };
    a.start(t);
    b.start(t);
    a.stop(end + 0.02);
    b.stop(end + 0.02);
    this.noise({ at: t, dur: 0.04, gain: 0.18, filter: 'lowpass', f: 600 });
  }

  /** The hero takes a hit: a dark, crunchy impact with a falling growl. */
  hurt(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const crunch = this.graph!.crunch;
    this.impact(hurtWeight(this.tuning), 'hurt', t);
    this.tone({ type: 'square', f: 164, f1: 68, glide: 0.22, at: t, dur: 0.22, gain: 0.12, out: crunch });
  }

  /** Finisher wind-up: a rising whoosh that gets longer and brighter with more stacks. */
  finisherStart(stacks: number, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const n = Math.max(1, Math.min(5, stacks));
    const d = 0.18 + 0.05 * n;
    this.noise({ at: t, dur: d + 0.02, attack: d * 0.9, gain: 0.45, filter: 'bandpass', f: 260, f1: 4000 + 800 * n, sweep: d, q: 2.2 });
    this.tone({ type: 'sawtooth', f: 110, f1: 660 + 110 * n, glide: d, at: t, attack: d * 0.8, dur: d + 0.02, gain: 0.06 });
    for (let i = 0; i < n; i++) this.tone({ type: 'sine', f: hz(72 + 4 * i), at: t + i * 0.05, dur: 0.18, gain: 0.05, rev: 0.4 });
  }

  /** One strike of the finisher's flurry (i of n): a swish plus a light impact whose note climbs. */
  finisherStrike(i: number, n: number, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const k = n > 1 ? i / (n - 1) : 0;
    this.noise({ at: t, dur: 0.07, gain: 0.32, filter: 'bandpass', f: 5200, f1: 900, sweep: 0.06, q: 1.4 });
    this.impact(impactWeight(this.tuning, 'hit') * (0.9 + 0.6 * k), 'flesh', t);
    this.tone({ type: 'triangle', f: hz(67 + Math.round(k * 12)), at: t, delay: 0.004, dur: 0.1, gain: 0.16 * this.tuning.impact.combo * 1.4 });
  }

  /** The finisher's last blow: a heavy blast that grows with the stacks, and a major stab on top. */
  finisherBoom(stacks: number, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const n = Math.max(1, Math.min(5, stacks));
    this.impact(impactWeight(this.tuning, 'finisher', n), 'blast', t);
    const lvl = this.tuning.impact.combo * 1.4;
    // the chord climbs a step per stack
    const root = 60 + [0, 2, 4, 7, 9][n - 1];
    [0, 4, 7, 12].forEach((iv, i) =>
      this.tone({ type: 'square', f: hz(root + 12 + iv), at: t, delay: 0.01, dur: 0.6 + 0.1 * n, hold: 0.05, gain: 0.05 * lvl, rev: 0.5, detune: i % 2 ? 6 : -6 }),
    );
    this.tone({ type: 'triangle', f: hz(root), at: t, dur: 0.7, hold: 0.05, gain: 0.22 * lvl, rev: 0.3 });
    if (n >= 3) this.tone({ type: 'square', f: hz(root + 24), at: t, delay: 0.12, dur: 0.6, gain: 0.035 * lvl, rev: 0.6 });
    this.bell(hz(root + 36), t + 0.04, 0.07 * lvl, 0.6);
    if (n >= 2) this.bell(hz(root + 43), t + 0.12, 0.05 * lvl, 0.6);
  }

  /** A finisher stack was banked: a rising arpeggio that starts higher for every stack. */
  stackUp(stacks: number, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const base = 72 + 2 * Math.min(6, stacks - 1);
    [0, 4, 7, 12].forEach((iv, i) => {
      const s = t + i * 0.045;
      this.tone({ type: 'square', f: hz(base + iv), at: s, dur: 0.07, gain: 0.035 });
      this.tone({ type: 'sine', f: hz(base + iv), at: s, dur: i === 3 ? 0.5 : 0.22, gain: 0.12, rev: 0.35 });
    });
    this.bell(hz(base + 24), t + 0.18, 0.05, 0.5);
  }

  /** A rare (or epic) boost card is on offer: a bright rising run that sparkles, longer and higher for epic. */
  rareSting(epic = false, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const notes = epic ? [76, 79, 84, 88, 91, 96] : [79, 83, 86, 91];
    notes.forEach((m, i) => {
      const s = t + i * 0.055;
      this.tone({ type: 'square', f: hz(m), at: s, dur: 0.08, gain: 0.035 });
      this.tone({ type: 'sine', f: hz(m), at: s, dur: i === notes.length - 1 ? 0.6 : 0.25, gain: 0.11, rev: 0.45 });
    });
    const end = t + notes.length * 0.055;
    this.bell(hz(notes[notes.length - 1] + 12), end, epic ? 0.08 : 0.06, 0.6);
    if (epic) this.bell(hz(notes[notes.length - 1] + 19), end + 0.08, 0.05, 0.6);
    this.noise({ at: t, dur: 0.35, attack: 0.15, gain: 0.05, filter: 'highpass', f: 6000 });
  }

  /** Banked stacks were lost to a combo break: a glassy shatter falling in pitch. */
  stackLost(stacks: number, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.noise({ at: t, dur: 0.25, gain: 0.35, filter: 'highpass', f: 3500, f1: 1500, sweep: 0.2 });
    for (let i = 0; i < 3 + Math.min(3, stacks); i++) this.bell(hz(96 - i * 3 - Math.floor(this.rand() * 2)), t + i * 0.035, 0.05, 0.3);
    this.tone({ type: 'triangle', f: hz(67), f1: hz(55), glide: 0.3, at: t + 0.05, dur: 0.35, gain: 0.12 });
  }

  windup(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.tone({ type: 'triangle', f: 400, f1: 1200, glide: 0.11, at: t, attack: 0.025, dur: 0.13, gain: 0.1 });
    this.noise({ at: t, dur: 0.12, attack: 0.06, gain: 0.05, filter: 'bandpass', f: 1600, f1: 5000, q: 3 });
  }

  /** A bomb goes off. */
  explode(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.impact(impactWeight(this.tuning, 'bomb'), 'blast', t);
    this.noise({ at: t, dur: 0.6, gain: 0.3, filter: 'lowpass', f: 2000, f1: 140, sweep: 0.5, rate: 0.6, rev: 0.25 });
  }

  /** A combo milestone. */
  ready2(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    [1046.5, 1318.51, 1567.98].forEach((f, i) => {
      const s = t + i * 0.06;
      this.tone({ type: 'square', f, at: s, dur: 0.08, gain: 0.04 });
      this.tone({ type: 'sine', f, at: s, dur: i === 2 ? 0.5 : 0.25, gain: 0.12, rev: 0.35 });
    });
    this.tone({ type: 'sine', f: 3135.96, at: t + 0.15, dur: 0.3, gain: 0.04, rev: 0.5 });
  }

  /** The victory jingle after a kill. */
  kill(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const seq: [number, number, number][] = [
      [0, 67, 0.1],
      [0.075, 72, 0.1],
      [0.15, 76, 0.1],
      [0.225, 79, 0.14],
      [0.33, 76, 0.09],
      [0.42, 84, 0.6],
    ];
    for (const [dt, m, d] of seq) {
      const f = hz(m);
      this.tone({ type: 'pulse25', f, at: t + dt, dur: d, hold: d * 0.3, gain: 0.08, rev: 0.35 });
      this.tone({ type: 'triangle', f: f / 2, at: t + dt, dur: d, gain: 0.14, rev: 0.2 });
    }
    for (const m of [76, 79]) this.tone({ type: 'square', f: hz(m), at: t + 0.42, dur: 0.55, hold: 0.05, gain: 0.035, rev: 0.4 });
    this.bell(2093, t + 0.42, 0.05, 0.5);
  }

  /** An enemy bursts apart: the kill (or boss kill) impact, with a twinkle of falling notes. */
  enemyPop(boss: boolean, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const w = impactWeight(this.tuning, boss ? 'bossKill' : 'kill');
    this.impact(w, 'blast', t);
    // the body bursts: a crackle right after the boom; a boss keeps exploding (in step with its shock rings)
    this.impact(w * 0.5, 'blast', t + 0.07);
    if (boss) {
      this.impact(w * 0.75, 'blast', t + 0.18);
      this.impact(w * 0.6, 'blast', t + 0.27);
      this.noise({ at: t + 0.05, dur: 1.4, gain: 0.22, filter: 'bandpass', f: 1200, f1: 320, sweep: 1.2, q: 0.7, rate: 0.5, rev: 0.5 });
    }
    const lvl = Math.min(1.5, this.tuning.impact.combo * 1.6);
    for (let i = 0; i < 4; i++) this.tone({ type: 'square', f: hz(84 - i * 5), at: t + 0.02 + i * 0.025, dur: 0.05, gain: 0.03 * lvl });
  }

  /** A stat icon reached the HUD: a quick rising blip (higher for each one in a row). */
  statUp(i: number, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const f = hz(79 + Math.min(12, i * 2));
    this.tone({ type: 'square', f, f1: f * 1.5, glide: 0.06, at: t, dur: 0.07, gain: 0.03 });
    this.tone({ type: 'sine', f: f * 2, at: t + 0.03, dur: 0.14, gain: 0.05, rev: 0.3 });
  }

  /** Coin pickup: a bright two-note ding. */
  coin(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.tone({ type: 'square', f: 1975.53, at: t, dur: 0.05, gain: 0.035 });
    this.tone({ type: 'square', f: 2637.02, at: t + 0.05, dur: 0.12, gain: 0.035 });
    this.tone({ type: 'sine', f: 2637.02, at: t + 0.05, dur: 0.18, gain: 0.05, rev: 0.25 });
  }

  /** Companion peck: a quick chirp. */
  pet(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.tone({ type: 'triangle', f: 1400, f1: 2400, at: t, dur: 0.06, gain: 0.08 });
    this.tone({ type: 'triangle', f: 1800, f1: 2800, at: t + 0.06, dur: 0.05, gain: 0.06 });
  }

  /** Heal: a soft rising sparkle. */
  heal(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    [784, 987.77, 1318.51].forEach((f, i) => this.tone({ type: 'sine', f, at: t + i * 0.05, dur: 0.22, gain: 0.07, rev: 0.4 }));
  }

  /** Cursor got faster. */
  speedUp(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.tone({ type: 'pulse25', f: 300, f1: 1800, glide: 0.13, at: t, attack: 0.005, hold: 0.06, dur: 0.16, gain: 0.07 });
    this.tone({ type: 'triangle', f: 600, f1: 3600, glide: 0.13, at: t, hold: 0.06, dur: 0.16, gain: 0.07 });
    this.noise({ at: t, dur: 0.14, attack: 0.08, gain: 0.08, filter: 'bandpass', f: 1200, f1: 6000, q: 2 });
    this.tone({ type: 'sine', f: 1760, at: t, delay: 0.13, dur: 0.2, gain: 0.06, rev: 0.3 });
  }

  /** Soft UI tick. */
  uiClick(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.tone({ type: 'triangle', f: 2000, f1: 1300, glide: 0.025, at: t, dur: 0.035, gain: 0.07 });
    this.noise({ at: t, dur: 0.012, gain: 0.04, filter: 'highpass', f: 5000 });
  }

  // ---------------------------------------------------------------- telegraphs

  /** A special move's wind-up: a distinct sound per move that lasts about `sec` (the enemy's wind-up pose, 0.6-1.0 s)
   *  and builds toward the moment the action fires (at + sec). Each one has its own spectral shape and rhythm, and
   *  keeps its character in the mids and highs so it reads over the music on a phone speaker. */
  telegraph(sound: TellSound, sec: number, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const T = Math.max(0.3, Math.min(1.6, sec));
    this.trim = TELL_MIX[sound];
    try {
      this.tell(sound, t, T);
    } finally {
      this.trim = 1;
    }
  }

  private tell(sound: TellSound, t: number, T: number): void {
    switch (sound) {
      case 'split':
        return this.tellSplit(t, T);
      case 'charge':
        return this.tellCharge(t, T);
      case 'smoke':
        return this.tellSmoke(t, T);
      case 'dive':
        return this.tellDive(t, T);
      case 'volley':
        return this.tellVolley(t, T);
      case 'spores':
        return this.tellSpores(t, T);
      case 'shell':
        return this.tellShell(t, T);
      case 'howl':
        return this.tellHowl(t, T);
      case 'guard':
        return this.tellGuard(t, T);
      case 'bombs':
        return this.tellBombs(t, T);
      case 'call':
        return this.tellCall(t, T);
      case 'hugeShield':
        return this.tellHugeShield(t, T);
      case 'stomp':
        return this.tellStomp(t, T);
      case 'summon':
        return this.tellSummon(t, T);
      case 'phase':
        return this.tellPhase(t, T);
      case 'enrage':
        return this.tellEnrage(t, T);
    }
  }

  /** A slime about to divide: a wet, wobbling gloop rising in pitch, bubbles popping faster and faster, and a
   *  stretching squelch right before it tears in two. */
  private tellSplit(t: number, T: number): void {
    const end = T + 0.06;
    const vib = { rate: 6, rate1: 15, cents: 260, cents1: 120 };
    this.voice({ at: t, type: 'triangle', f: [[0, 150], [T, 470]], vib, filter: 'lowpass', ff: [[0, 600], [T, 2200]], q: 7, amp: [[0.06, 0.2], [T * 0.7, 0.32], [T * 0.95, 0.42], [end, 0]] });
    this.voice({ at: t, type: 'sine', f: [[0, 300], [T, 940]], vib, amp: [[0.06, 0.06], [T * 0.9, 0.16], [end, 0]] });
    [0.12, 0.3, 0.45, 0.57, 0.67, 0.75, 0.82, 0.88, 0.93].forEach((k, i) => {
      const f = 320 + i * 70 + this.rand() * 60;
      this.tone({ type: 'sine', f, f1: f * 2.5, glide: 0.035, at: t + k * T, dur: 0.06, gain: 0.12 + 0.012 * i });
    });
    this.voice({ at: t + T - 0.14, type: 'noise', filter: 'bandpass', ff: [[0, 500], [0.14, 2600]], q: 3, amp: [[0.11, 0.3], [0.17, 0]] });
  }

  /** A boar about to charge: two hoof scrapes in the dirt, a snort, then a rumble that rises as it gathers speed. */
  private tellCharge(t: number, T: number): void {
    const crunch = this.graph!.crunch;
    [0, 0.24].forEach((k, i) => {
      const s = t + k * T;
      const hi = 1 + 0.15 * i;
      this.voice({ at: s, type: 'noise', filter: 'bandpass', ff: [[0, 2800 * hi], [0.17, 900 * hi]], q: 1.3, amp: [[0.015, 0.26], [0.11, 0.18], [0.18, 0]] });
      this.voice({ at: s, type: 'noise', rate: 0.6, filter: 'lowpass', ff: [[0, 2000], [0.16, 500]], amp: [[0.01, 0.16], [0.16, 0]], out: crunch });
      this.tone({ type: 'triangle', f: 520 * hi, f1: 260, glide: 0.03, at: s, dur: 0.04, gain: 0.15 });
    });
    const sn = t + 0.5 * T;
    [0, 0.11].forEach((d, i) => {
      const g = i ? 0.6 : 1;
      this.voice({ at: sn + d, type: 'noise', filter: 'bandpass', ff: [[0, 1300], [0.09, 800]], q: 2.2, amp: [[0.008, 0.45 * g], [0.06, 0.15 * g], [0.1, 0]] });
      this.voice({ at: sn + d, type: 'sawtooth', f: [[0, 190], [0.09, 150]], trem: { rate: 55, depth: 0.8 }, filter: 'bandpass', ff: [[0, 1100]], q: 3, amp: [[0.01, 0.4 * g], [0.09, 0]] });
    });
    const r = t + 0.62 * T;
    const d = 0.38 * T + 0.05;
    this.voice({ at: r, type: 'sawtooth', f: [[0, 55], [d, 98]], amp: [[d * 0.9, 0.3], [d, 0]], out: crunch });
    this.voice({ at: r, type: 'noise', rate: 0.7, filter: 'bandpass', ff: [[0, 500], [d, 2200]], q: 0.9, trem: { rate: 13, rate1: 20, depth: 0.6 }, amp: [[d * 0.92, 0.95], [d + 0.03, 0]] });
  }

  /** A thief about to throw smoke: a pouch of pellets shaken three times, a cheeky climbing giggle, and an airy
   *  hiss that swells up to the throw. */
  private tellSmoke(t: number, T: number): void {
    for (let k = 0; k < 3; k++) {
      const s = t + k * 0.12 * T;
      this.ticks(
        Array.from({ length: 6 }, () => s + this.rand() * 0.07),
        { gain: 0.5, f: 3600, q: 2.5 },
      );
      this.voice({ at: s, type: 'noise', filter: 'bandpass', ff: [[0, 4000]], q: 1, amp: [[0.02, 0.12], [0.08, 0]] });
    }
    for (let i = 0; i < 3; i++) {
      const s = t + (0.36 + i * 0.085) * T;
      const f = 1250 + i * 160;
      this.tone({ type: 'pulse25', f, f1: f * 0.78, glide: 0.05, at: s, dur: 0.06, gain: 0.1 });
      this.tone({ type: 'sine', f: f * 2, f1: f * 1.56, glide: 0.05, at: s, dur: 0.06, gain: 0.06 });
    }
    const h = t + 0.4 * T;
    const d = 0.6 * T + 0.04;
    this.voice({ at: h, type: 'noise', filter: 'bandpass', ff: [[0, 1100], [d, 4200]], q: 0.7, amp: [[d * 0.92, 0.42], [d + 0.04, 0]] });
    this.voice({ at: h, type: 'noise', filter: 'highpass', ff: [[0, 6000]], amp: [[d, 0.12], [d + 0.04, 0]] });
  }

  /** A bird about to dive: a harsh caw, a higher second caw, then a whoosh that swells under a falling whistle. */
  private tellDive(t: number, T: number): void {
    for (let i = 0; i < 2; i++) {
      const s = t + i * 0.24 * T;
      const f = 640 * (1 + 0.28 * i);
      const d = 0.16 + 0.05 * i;
      this.voice({ at: s, type: 'sawtooth', f: [[0, f * 0.85], [0.035, f * 1.25], [d, f * 0.9]], trem: { rate: 48, depth: 0.7 }, filter: 'bandpass', ff: [[0, 1500]], q: 1.6, amp: [[0.012, 0.5], [d * 0.7, 0.4], [d, 0]] });
      this.voice({ at: s, type: 'noise', filter: 'bandpass', ff: [[0, 2200]], q: 1.5, amp: [[0.012, 0.14], [d, 0]] });
    }
    const w = t + 0.48 * T;
    const d = 0.52 * T + 0.04;
    this.voice({ at: w, type: 'noise', filter: 'bandpass', ff: [[0, 600], [d, 3000]], q: 1.4, amp: [[d * 0.93, 0.55], [d + 0.03, 0]] });
    this.voice({ at: w, type: 'sine', f: [[0, 2800], [d, 1000]], amp: [[d * 0.9, 0.2], [d + 0.03, 0]] });
  }

  /** Archers drawing: three bowstrings creak one after another, each tighter than the last, then they let loose. */
  private tellVolley(t: number, T: number): void {
    for (let i = 0; i < 3; i++) {
      const s = t + i * 0.22 * T;
      const d = 0.17;
      this.voice({ at: s, type: 'sawtooth', f: [[0, 34 + 8 * i], [d, 62 + 14 * i]], filter: 'bandpass', ff: [[0, 1500 + 260 * i], [d, 1900 + 260 * i]], q: 6, amp: [[0.03, 2.2], [d * 0.85, 2], [d, 0]] });
      this.voice({ at: s, type: 'noise', filter: 'bandpass', ff: [[0, 900 + 150 * i]], q: 4, amp: [[0.03, 0.08], [d, 0]] });
    }
    const tw = t + T - 0.07;
    this.voice({ at: tw, type: 'sawtooth', f: [[0, 230], [0.02, 205], [0.35, 200]], filter: 'lowpass', ff: [[0, 5000], [0.3, 700]], q: 3, amp: [[0.002, 0.42], [0.38, 0]] });
    this.tone({ type: 'triangle', f: 410, at: tw, dur: 0.25, gain: 0.15 });
    this.voice({ at: tw, type: 'noise', filter: 'bandpass', ff: [[0, 3200], [0.07, 1200]], q: 1.2, amp: [[0.003, 0.35], [0.08, 0]] });
  }

  /** A mushroom about to spore: the cap puffs three times and the air fills with fizzing, glittering spores. */
  private tellSpores(t: number, T: number): void {
    [0, 0.3, 0.56].forEach((k, i) => {
      const s = t + k * T;
      this.voice({ at: s, type: 'noise', rate: 0.8, filter: 'lowpass', ff: [[0, 2600], [0.14, 700]], amp: [[0.015, 0.28 + 0.05 * i], [0.15, 0]], rev: 0.25 });
      this.tone({ type: 'sine', f: 420 + 90 * i, f1: 900 + 180 * i, glide: 0.06, at: s + 0.01, dur: 0.09, gain: 0.1 + 0.02 * i });
    });
    const b = t + 0.25 * T;
    const d = 0.75 * T;
    this.voice({ at: b, type: 'noise', filter: 'bandpass', ff: [[0, 1400], [d, 3000]], q: 2.5, trem: { rate: 9, rate1: 18, depth: 0.8 }, amp: [[d * 0.9, 0.55], [d + 0.04, 0]] });
    const notes = [88, 91, 93, 95, 96, 98, 100, 103];
    for (let i = 0; i < 12; i++) {
      const k = 0.15 + 0.85 * Math.sqrt((i + this.rand()) / 12);
      this.bell(hz(notes[Math.floor(this.rand() * notes.length)]), t + k * T, 0.04 + 0.05 * (i / 12), 0.45);
    }
  }

  /** A beetle shelling up: chitin plates clicking faster and faster, then a hollow knock-KNOCK as it clamps shut. */
  private tellShell(t: number, T: number): void {
    const times: number[] = [];
    for (let s = 0, gap = 0.1; s < 0.76 * T && times.length < 16; s += gap * (T / 0.8), gap *= 0.84) times.push(t + s);
    times.forEach((ti, i) => {
      const k = i / Math.max(1, times.length - 1);
      this.ticks([ti], { gain: 0.45 + 0.3 * k, f: i % 2 ? 3500 : 2700, q: 4, ms: 9 });
      this.tone({ type: 'triangle', f: i % 2 ? 1900 : 1600, f1: 1100, glide: 0.012, at: ti, dur: 0.02, gain: 0.16 + 0.12 * k });
    });
    const c = t + 0.88 * T;
    this.voice({ at: c - 0.07, type: 'noise', filter: 'bandpass', ff: [[0, 1300]], q: 7, amp: [[0.003, 0.7], [0.05, 0]] });
    this.tone({ type: 'triangle', f: 980, f1: 620, glide: 0.04, at: c - 0.07, dur: 0.06, gain: 0.25 });
    this.voice({ at: c, type: 'noise', filter: 'bandpass', ff: [[0, 1000]], q: 7, amp: [[0.003, 1], [0.12, 0]] });
    this.tone({ type: 'triangle', f: 760, f1: 430, glide: 0.06, at: c, dur: 0.14, hold: 0.02, gain: 0.45 });
    this.tone({ type: 'square', f: 260, f1: 180, glide: 0.05, at: c, dur: 0.08, gain: 0.1, out: this.graph!.crunch });
    this.voice({ at: c, type: 'noise', filter: 'highpass', ff: [[0, 4000]], amp: [[0.002, 0.15], [0.02, 0]] });
  }

  /** A wolf howl: a sine that glides up and holds with a widening vibrato over breath, dipping as it ends. */
  private tellHowl(t: number, T: number): void {
    const f: Pts = [[0, 360], [0.35 * T, 700], [0.82 * T, 770], [T + 0.05, 560]];
    const vib = { rate: 5, rate1: 6.5, cents: 5, cents1: 50 };
    const amp: Pts = [[0.12 * T, 0.32], [0.6 * T, 0.42], [0.9 * T, 0.46], [T + 0.1, 0]];
    this.voice({ at: t, type: 'sine', f, vib, amp, rev: 0.3 });
    this.voice({ at: t, type: 'triangle', f, vib, amp: scalePts(amp, 0.4), rev: 0.3 });
    this.voice({ at: t, type: 'sine', f: scalePts(f, 2), vib, amp: scalePts(amp, 0.12) });
    this.voice({ at: t, type: 'noise', filter: 'bandpass', ff: scalePts(f, 2.3), q: 1.4, amp: [[0.1 * T, 0.12], [0.85 * T, 0.2], [T + 0.08, 0]] });
  }

  /** A knight raising its guard: a gritty metal scrape sliding up, then a heavy clank as the shield locks in. */
  private tellGuard(t: number, T: number): void {
    const d = 0.86 * T;
    this.voice({ at: t, type: 'noise', filter: 'bandpass', ff: [[0, 1300], [d, 4500]], q: 10, trem: { rate: 40, depth: 0.5, wave: 'sawtooth' }, amp: [[0.04, 0.3], [d * 0.97, 1.1], [d + 0.01, 0]] });
    this.voice({ at: t, type: 'noise', filter: 'bandpass', ff: [[0, 2400], [d, 7000]], q: 6, amp: [[0.04, 0.1], [d, 0.35], [d + 0.01, 0]] });
    this.voice({ at: t, type: 'triangle', f: [[0, 700], [d, 1250]], amp: [[0.05, 0.03], [d, 0.1], [d + 0.01, 0]] });
    this.voice({ at: t, type: 'triangle', f: [[0, 700 * 2.76], [d, 1250 * 2.76]], amp: [[0.05, 0.02], [d, 0.07], [d + 0.01, 0]] });
    const c = t + 0.88 * T;
    const f = 290;
    this.tone({ type: 'square', f, at: c, dur: 0.4, gain: 0.08, rev: 0.25 });
    this.tone({ type: 'triangle', f: f * 2.4, at: c, dur: 0.3, gain: 0.2, rev: 0.25 });
    this.tone({ type: 'triangle', f: f * 3.9, at: c, dur: 0.2, gain: 0.15, rev: 0.25 });
    this.tone({ type: 'sine', f: f * 5.7, at: c, dur: 0.12, gain: 0.08, rev: 0.25 });
    this.tone({ type: 'triangle', f: 200, f1: 110, glide: 0.06, at: c, dur: 0.12, gain: 0.3 });
    this.voice({ at: c, type: 'noise', filter: 'bandpass', ff: [[0, 2600]], q: 1.2, amp: [[0.001, 0.6], [0.035, 0]] });
  }

  /** A bomber lighting up: a match strike, fuses sizzling and spitting sparks, a low wicked "heh-heh-heh", and a
   *  ticking that closes in on the throw. */
  private tellBombs(t: number, T: number): void {
    const crunch = this.graph!.crunch;
    this.voice({ at: t, type: 'noise', filter: 'bandpass', ff: [[0, 1800], [0.07, 5200]], q: 1.2, amp: [[0.01, 0.22], [0.08, 0]] });
    this.voice({ at: t, type: 'noise', filter: 'highpass', ff: [[0, 2500]], amp: [[0.005, 0.1], [0.05, 0]], out: crunch });
    const fz = t + 0.06;
    const fd = T - 0.02;
    this.voice({ at: fz, type: 'noise', filter: 'bandpass', ff: [[0, 5200], [fd, 7000]], q: 1.5, trem: { rate: 23, depth: 0.5, wave: 'sawtooth' }, amp: [[0.03, 0.1], [fd, 0.34], [fd + 0.03, 0]] });
    this.ticks(
      Array.from({ length: 16 }, (_, i) => fz + fd * Math.sqrt((i + this.rand()) / 16)),
      { gain: 0.45, f: 4200, q: 1.5, out: crunch },
    );
    for (let i = 0; i < 3; i++) {
      const s = t + (0.2 + i * 0.13) * T;
      const f = 300 - i * 30;
      this.voice({ at: s, type: 'sawtooth', f: [[0, f * 1.12], [0.03, f], [0.09, f * 0.85]], trem: { rate: 34, depth: 0.6, wave: 'square' }, filter: 'bandpass', ff: [[0, 900]], q: 2, amp: [[0.008, 0.5], [0.07, 0.35], [0.1, 0]] });
    }
    [0.62, 0.74, 0.83, 0.9, 0.95, 0.99].forEach((k, i) => {
      this.tone({ type: 'square', f: 1900, at: t + k * T, dur: 0.02, gain: 0.08 + 0.016 * i });
      this.tone({ type: 'triangle', f: 3800, at: t + k * T, dur: 0.02, gain: 0.06 + 0.012 * i });
    });
  }

  /** Calling for help: a two-note finger whistle, a short "wheet" and a long rising "wheee-oo". */
  private tellCall(t: number, T: number): void {
    const n1 = t + 0.08 * T;
    const d1 = 0.2 * T;
    this.voice({ at: n1, type: 'sine', f: [[0, 1450], [0.035, 2050], [d1, 2100]], amp: [[0.015, 0.36], [d1 * 0.8, 0.3], [d1, 0]] });
    this.voice({ at: n1, type: 'noise', filter: 'bandpass', ff: [[0, 2100]], q: 3, amp: [[0.015, 0.06], [d1, 0]] });
    const n2 = t + 0.42 * T;
    const d2 = 0.56 * T;
    this.voice({ at: n2, type: 'sine', f: [[0, 1600], [0.05, 2500], [d2 * 0.8, 2650], [d2, 2200]], vib: { rate: 7, cents: 10, cents1: 35 }, amp: [[0.02, 0.36], [d2 * 0.85, 0.45], [d2, 0]] });
    this.voice({ at: n2, type: 'noise', filter: 'bandpass', ff: [[0, 2500]], q: 3, amp: [[0.02, 0.07], [d2, 0]] });
  }

  /** A slab of stone dragged into place: a juddering grind (low rumble to gritty hiss) shedding chips, locking in
   *  with a deep "thoom". */
  private tellHugeShield(t: number, T: number): void {
    const crunch = this.graph!.crunch;
    const d = 0.86 * T;
    const judder = { rate: 14, rate1: 19, depth: 0.85, wave: 'sawtooth' as OscillatorType };
    this.voice({ at: t, type: 'noise', rate: 0.5, filter: 'bandpass', ff: [[0, 480], [d, 900]], q: 1.6, trem: judder, amp: [[0.06, 0.35], [d, 0.85], [d + 0.03, 0]] });
    this.voice({ at: t, type: 'noise', filter: 'bandpass', ff: [[0, 1500], [d, 2200]], q: 1.8, trem: judder, amp: [[0.06, 0.12], [d, 0.35], [d + 0.03, 0]] });
    this.voice({ at: t, type: 'noise', filter: 'highpass', ff: [[0, 3500], [d, 5000]], trem: judder, amp: [[0.06, 0.1], [d, 0.3], [d + 0.03, 0]], out: this.graph!.crunch });
    this.voice({ at: t, type: 'noise', rate: 0.4, filter: 'lowpass', ff: [[0, 900], [d, 1400]], trem: { ...judder, depth: 0.6 }, amp: [[0.06, 0.15], [d, 0.3], [d + 0.03, 0]], out: crunch });
    this.voice({ at: t, type: 'sawtooth', f: [[0, 46], [d, 60]], amp: [[0.08, 0.08], [d, 0.18], [d + 0.03, 0]], out: crunch });
    this.ticks(
      Array.from({ length: 18 }, () => t + this.rand() * d),
      { gain: 0.4, f: 2600, q: 2 },
    );
    const c = t + d;
    this.voice({ at: c, type: 'noise', rate: 0.5, filter: 'lowpass', ff: [[0, 1500], [0.25, 200]], amp: [[0.004, 0.6], [0.28, 0]] });
    this.tone({ type: 'triangle', f: 170, f1: 70, glide: 0.1, at: c, dur: 0.25, gain: 0.35, out: crunch });
  }

  /** A giant lifting its foot: the ground trembles more and more, the leg creaks as it rises, a hush while it hangs
   *  in the air, and a falling whoosh as it comes down. */
  private tellStomp(t: number, T: number): void {
    const crunch = this.graph!.crunch;
    this.voice({ at: t, type: 'noise', rate: 0.5, filter: 'lowpass', ff: [[0, 260], [T, 900]], trem: { rate: 7, rate1: 12, depth: 0.5 }, amp: [[0.1, 0.06], [T, 0.4], [T + 0.04, 0]] });
    this.voice({ at: t, type: 'sawtooth', f: [[0, 38], [T, 66]], amp: [[0.1, 0.04], [T, 0.2], [T + 0.04, 0]], out: crunch });
    const c = t + 0.1 * T;
    const cd = 0.45 * T;
    this.voice({ at: c, type: 'sawtooth', f: [[0, 60], [cd, 115]], filter: 'bandpass', ff: [[0, 650], [cd, 950]], q: 6, trem: { rate: 9, depth: 0.5 }, amp: [[0.05, 1.6], [cd * 0.8, 2.2], [cd, 0]] });
    const w = t + 0.68 * T;
    const wd = 0.32 * T + 0.03;
    this.voice({ at: w, type: 'noise', filter: 'bandpass', ff: [[0, 3400], [wd, 500]], q: 1.2, amp: [[wd * 0.3, 0.2], [wd * 0.85, 1.25], [wd, 0]] });
    this.voice({ at: w, type: 'sine', f: [[0, 1500], [wd, 380]], amp: [[wd * 0.3, 0.03], [wd * 0.85, 0.15], [wd, 0]] });
  }

  /** A horn call: a rising fifth and octave, the last note held and swelling with vibrato. */
  private tellSummon(t: number, T: number): void {
    const notes: [number, number, number][] = [
      [0, 62, 0.13],
      [0.21, 69, 0.13],
      [0.42, 74, 0.56],
    ];
    notes.forEach(([k, m, l], i) => {
      const s = t + k * T;
      const d = l * T;
      const f = hz(m);
      const last = i === notes.length - 1;
      const vib = last ? { rate: 5.5, cents: 0, cents1: 22 } : undefined;
      const amp: Pts = last ? [[0.03, 0.34], [d - 0.02, 0.42], [d + 0.05, 0]] : [[0.025, 0.36], [d * 0.6, 0.24], [d + 0.02, 0]];
      this.voice({ at: s, type: 'sawtooth', f: [[0, f * 0.94], [0.04, f]], vib, filter: 'lowpass', ff: [[0, 500], [0.05, 2600], [d, last ? 3000 : 1500]], q: 1.4, amp, rev: 0.3 });
      this.voice({ at: s, type: 'square', f: [[0, f * 0.47], [0.04, f / 2]], vib, filter: 'lowpass', ff: [[0, 1200]], amp: scalePts(amp, 0.25) });
    });
  }

  /** A boss entering its next phase: a sharp breath in, then a low growl that swells into a full-throated roar and
   *  a burst of breath. */
  private tellPhase(t: number, T: number): void {
    const crunch = this.graph!.crunch;
    const end = T + 0.15;
    this.voice({ at: t, type: 'noise', filter: 'bandpass', ff: [[0, 2500], [0.28 * T, 4500]], q: 1.2, amp: [[0.25 * T, 0.35], [0.3 * T, 0]] });
    const r = t + 0.3 * T;
    const rd = 0.7 * T + 0.15;
    this.voice({ at: r, type: 'sawtooth', f: [[0, 78], [0.45 * T, 118], [rd, 96]], trem: { rate: 30, depth: 0.7, wave: 'square' }, amp: [[0.05, 0.12], [0.45 * T, 0.28], [0.7 * T, 0.3], [rd, 0]], out: crunch });
    this.voice({ at: r, type: 'sawtooth', f: [[0, 150], [0.45 * T, 250], [rd, 200]], trem: { rate: 26, depth: 0.5 }, filter: 'bandpass', ff: [[0, 750], [0.45 * T, 1200]], q: 1.4, amp: [[0.05, 0.35], [0.55 * T, 0.9], [rd, 0]] });
    this.voice({ at: r, type: 'noise', rate: 0.7, filter: 'bandpass', ff: [[0, 550], [0.45 * T, 1400], [rd, 1000]], q: 1.8, amp: [[0.05, 0.15], [0.55 * T, 0.95], [rd, 0]] });
    this.voice({ at: t + 0.45 * T, type: 'noise', filter: 'bandpass', ff: [[0, 2000], [0.55 * T, 3000]], q: 2.5, amp: [[0.35 * T, 0.5], [0.55 * T + 0.15, 0]] });
    this.voice({ at: t + 0.72 * T, type: 'noise', rate: 0.6, filter: 'lowpass', ff: [[0, 3200], [0.4, 500]], amp: [[0.01, 0.35], [0.45, 0]], rev: 0.3 });
  }

  /** Enraged: a heartbeat that races faster and faster, then a snarling roar. */
  private tellEnrage(t: number, T: number): void {
    for (let s = 0, gap = 0.3 * T, n = 0; s < 0.62 * T && n < 8; s += gap, gap *= 0.8, n++) {
      this.heartbeat(t + s, 1);
      this.heartbeat(t + s + gap * 0.35, 0.7);
    }
    const crunch = this.graph!.crunch;
    const r = t + 0.45 * T;
    const d = 0.55 * T + 0.08;
    this.voice({ at: r, type: 'sawtooth', f: [[0, 170], [d * 0.8, 330], [d, 290]], trem: { rate: 38, depth: 0.6, wave: 'square' }, filter: 'bandpass', ff: [[0, 1100], [d, 1500]], q: 1.3, amp: [[d * 0.3, 0.3], [d * 0.85, 0.6], [d, 0]] });
    this.voice({ at: r, type: 'sawtooth', f: [[0, 105], [d, 150]], trem: { rate: 34, depth: 0.7, wave: 'square' }, amp: [[d * 0.3, 0.2], [d * 0.85, 0.4], [d, 0]], out: crunch });
    this.voice({ at: r, type: 'noise', filter: 'bandpass', ff: [[0, 900], [d, 1900]], q: 2, amp: [[d * 0.4, 0.2], [d * 0.85, 0.6], [d + 0.03, 0]] });
  }

  /** One heartbeat thump: a saturated low knock (its harmonics reach a phone speaker) over a sub for headphones. */
  private heartbeat(at: number, g: number): void {
    const gr = this.graph!;
    this.tone({ type: 'triangle', f: 150, f1: 60, glide: 0.06, at, dur: 0.11, gain: 0.5 * g, out: gr.crunch });
    this.tone({ type: 'sine', f: 75, f1: 45, glide: 0.06, at, dur: 0.14, gain: 0.4 * g, out: gr.limiter });
    this.voice({ at, type: 'noise', filter: 'lowpass', ff: [[0, 700]], amp: [[0.003, 0.35 * g], [0.05, 0]] });
  }

  // ---------------------------------------------------------------- special-move actions

  /** A giant's foot slams down: a heavy blast impact, the ground cracking and a long rumble. */
  stompLand(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const gr = this.graph!;
    this.impact(impactWeight(this.tuning, 'kill') * 0.9, 'blast', t);
    this.voice({ at: t + 0.01, type: 'noise', rate: 0.6, filter: 'lowpass', ff: [[0, 1800], [0.5, 220]], amp: [[0.005, 0.4], [0.55, 0]], out: gr.crunch });
    this.voice({ at: t, type: 'noise', rate: 0.5, filter: 'lowpass', ff: [[0, 700], [1, 160]], trem: { rate: 11, depth: 0.4 }, amp: [[0.03, 0.4], [1.1, 0]], rev: 0.3 });
    this.ticks(
      Array.from({ length: 10 }, () => t + 0.03 + this.rand() * 0.45),
      { gain: 0.3, f: 2000, q: 1.6 },
    );
  }

  /** The timing cursor freezes: an icy crunch and a crystalline shimmer falling into a frosty hiss. */
  freeze(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const gr = this.graph!;
    this.noise({ at: t, dur: 0.06, gain: 0.35, filter: 'bandpass', f: 3000, q: 1, out: gr.crunch });
    this.ticks(
      Array.from({ length: 7 }, () => t + this.rand() * 0.09),
      { gain: 0.35, f: 4500, q: 2 },
    );
    [4186, 3520, 3136, 2637].forEach((f, i) => this.bell(f, t + 0.02 + i * 0.03, 0.07, 0.6));
    this.voice({ at: t, type: 'sine', f: [[0, 2093]], trem: { rate: 18, depth: 0.6 }, amp: [[0.01, 0.1], [0.6, 0]], rev: 0.5 });
    this.voice({ at: t, type: 'noise', filter: 'highpass', ff: [[0, 7000], [0.4, 3000]], amp: [[0.02, 0.12], [0.45, 0]] });
  }

  /** An enemy's raised guard counters the attack: a hard, bright clang, then the hero takes a thud. Includes the
   *  hurt thud, so don't also play hurt() for the same blow. */
  counter(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const gr = this.graph!;
    this.impact(impactWeight(this.tuning, 'block'), 'metal', t);
    const f = 880;
    this.tone({ type: 'square', f, at: t, dur: 0.3, gain: 0.07, rev: 0.3 });
    this.tone({ type: 'triangle', f: f * 2.4, at: t, dur: 0.22, gain: 0.12, rev: 0.3 });
    this.tone({ type: 'triangle', f: f * 3.9, at: t, dur: 0.14, gain: 0.09, rev: 0.3 });
    this.tone({ type: 'sine', f: f * 5.6, at: t, dur: 0.1, gain: 0.06, rev: 0.3 });
    this.noise({ at: t, dur: 0.15, gain: 0.1, filter: 'highpass', f: 6000 });
    const h = t + 0.1;
    this.impact(hurtWeight(this.tuning) * 0.85, 'hurt', h);
    this.tone({ type: 'square', f: 150, f1: 70, glide: 0.18, at: h, dur: 0.18, gain: 0.1, out: gr.crunch });
  }

  /** A shell (ward) block cracks: a chitin crack and a hollow knock; `last` = the whole shell shatters. */
  wardBreak(last: boolean, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const gr = this.graph!;
    if (!last) {
      this.impact(impactWeight(this.tuning, 'block') * 0.8, 'flesh', t);
      this.noise({ at: t, dur: 0.05, gain: 0.5, filter: 'bandpass', f: 1800, q: 1.5, out: gr.crunch });
      this.ticks(
        Array.from({ length: 5 }, () => t + this.rand() * 0.12),
        { gain: 0.35, f: 3000, q: 2 },
      );
      this.voice({ at: t, type: 'noise', filter: 'bandpass', ff: [[0, 1100]], q: 8, amp: [[0.002, 1.4], [0.07, 0]] });
      return;
    }
    this.impact(impactWeight(this.tuning, 'crit'), 'blast', t);
    this.noise({ at: t, dur: 0.35, gain: 0.35, filter: 'highpass', f: 2500, f1: 1200, sweep: 0.3 });
    this.ticks(
      Array.from({ length: 14 }, () => t + this.rand() * 0.35),
      { gain: 0.35, f: 3200, q: 2 },
    );
    for (let i = 0; i < 5; i++) {
      const s = t + 0.02 + this.rand() * 0.3;
      this.voice({ at: s, type: 'noise', filter: 'bandpass', ff: [[0, 1400 - i * 140]], q: 8, amp: [[0.002, 1 - i * 0.12], [0.06, 0]] });
    }
    this.tone({ type: 'triangle', f: 700, f1: 250, glide: 0.3, at: t, dur: 0.3, gain: 0.12 });
  }

  /** Tapping a spore: a soft pop. */
  sporePop(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.tone({ type: 'sine', f: 900, f1: 280, glide: 0.05, at: t, dur: 0.08, gain: 0.4 });
    this.tone({ type: 'triangle', f: 900, f1: 280, glide: 0.05, at: t, dur: 0.06, gain: 0.12 });
    this.noise({ at: t, dur: 0.06, gain: 0.3, filter: 'lowpass', f: 2400, f1: 600 });
    this.tone({ type: 'sine', f: 3000, at: t + 0.01, dur: 0.12, gain: 0.05, rev: 0.3 });
  }

  /** Spores left unbroken heal the enemies: bubbles rising faster and higher over a queasy swell. */
  sporeHeal(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    for (let i = 0; i < 10; i++) {
      const f = 380 + i * 90 + this.rand() * 60;
      this.tone({ type: 'sine', f, f1: f * 2.2, glide: 0.04, at: t + 0.75 * Math.sqrt(i / 10), dur: 0.07, gain: 0.12 });
    }
    this.voice({ at: t, type: 'triangle', f: [[0, 330], [0.8, 660]], vib: { rate: 5, cents: 18 }, amp: [[0.6, 0.18], [0.95, 0]], rev: 0.3 });
    this.voice({ at: t, type: 'triangle', f: [[0, 392], [0.8, 784]], vib: { rate: 5.5, cents: 22 }, amp: [[0.6, 0.12], [0.95, 0]], rev: 0.3 });
    this.voice({ at: t, type: 'noise', filter: 'bandpass', ff: [[0, 900], [0.8, 2200]], q: 3, trem: { rate: 13, depth: 0.8 }, amp: [[0.65, 0.2], [0.9, 0]] });
    [784, 932.33, 1174.66].forEach((f, i) => this.tone({ type: 'sine', f, at: t + 0.7 + i * 0.05, dur: 0.3, gain: 0.08, rev: 0.4 }));
  }

  /** A slime splits in two: a wet splat and two bloops. */
  split(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const gr = this.graph!;
    this.noise({ at: t, dur: 0.18, gain: 0.6, filter: 'lowpass', f: 3200, f1: 400 });
    this.noise({ at: t, dur: 0.1, gain: 0.4, filter: 'bandpass', f: 1100, out: gr.crunch });
    this.tone({ type: 'triangle', f: 360, f1: 110, glide: 0.12, at: t, dur: 0.12, gain: 0.35 });
    [
      [0.12, 300],
      [0.24, 400],
    ].forEach(([d, f]) => {
      this.tone({ type: 'sine', f, f1: f * 2.7, glide: 0.06, at: t + d, dur: 0.1, gain: 0.42 });
      this.tone({ type: 'triangle', f, f1: f * 2.7, glide: 0.06, at: t + d, dur: 0.1, gain: 0.18 });
    });
  }

  /** Enemies appear: a poof of smoke, a soft whump and a sparkle. */
  summonArrive(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.noise({ at: t, dur: 0.4, gain: 0.65, filter: 'bandpass', f: 3500, f1: 700, sweep: 0.3, q: 0.8, rev: 0.35 });
    this.tone({ type: 'sine', f: 260, f1: 90, glide: 0.2, at: t, dur: 0.2, gain: 0.35 });
    this.bell(2637.02, t + 0.05, 0.07, 0.5);
    this.bell(3520, t + 0.1, 0.05, 0.5);
  }

  // ---------------------------------------------------------------- map, shop, rest, events, story

  /** Choosing a map node: the map's paper rustles and two soft footsteps set off. */
  mapSelect(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    for (let i = 0; i < 4; i++) {
      const s = t + i * 0.03 + this.rand() * 0.02;
      this.voice({ at: s, type: 'noise', filter: 'bandpass', ff: [[0, 3000 + this.rand() * 3000]], q: 1.5, amp: [[0.004, 0.16 + 0.08 * this.rand()], [0.025 + 0.02 * this.rand(), 0]] });
    }
    [0.16, 0.3].forEach((d, i) => {
      this.voice({ at: t + d, type: 'noise', filter: 'lowpass', ff: [[0, 1400]], amp: [[0.004, 0.3], [0.05, 0]] });
      this.tone({ type: 'triangle', f: 320 - 40 * i, f1: 200, glide: 0.04, at: t + d, dur: 0.05, gain: 0.18 });
    });
    this.tone({ type: 'triangle', f: 1046.5, at: t, delay: 0.005, dur: 0.07, gain: 0.1 });
    this.tone({ type: 'sine', f: 1567.98, at: t + 0.06, dur: 0.12, gain: 0.07, rev: 0.25 });
  }

  /** Buying in the shop: coins clink, then a ding. */
  shopBuy(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    [0, 0.05, 0.09, 0.14].forEach((d) => {
      const f = 2400 + this.rand() * 1000;
      this.tone({ type: 'sine', f, at: t + d, dur: 0.1, gain: 0.07 });
      this.tone({ type: 'sine', f: f * 2.76, at: t + d, dur: 0.05, gain: 0.04 });
      this.noise({ at: t + d, dur: 0.01, gain: 0.05, filter: 'highpass', f: 6000 });
    });
    this.tone({ type: 'square', f: 2093, at: t + 0.2, dur: 0.08, gain: 0.03 });
    this.bell(2093, t + 0.2, 0.12, 0.4);
    this.tone({ type: 'sine', f: 3135.96, at: t + 0.28, dur: 0.3, gain: 0.06, rev: 0.4 });
  }

  /** Resting at a campfire: a whoosh as it flares, crackling, and a warm F major chord. */
  restHeal(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.noise({ at: t, dur: 0.6, attack: 0.25, gain: 0.3, filter: 'lowpass', f: 300, f1: 1600, sweep: 0.35, rate: 0.7 });
    this.ticks(
      Array.from({ length: 14 }, (_, i) => t + 0.1 + 1.1 * ((i + this.rand()) / 14) ** 1.5),
      { gain: 0.2, f: 2500, q: 1.5 },
    );
    [65, 69, 72, 77].forEach((m, i) => {
      this.tone({ type: 'triangle', f: hz(m), at: t + 0.12 + i * 0.06, attack: 0.15, hold: 0.4, dur: 1.4, gain: 0.09, rev: 0.4 });
      this.tone({ type: 'sine', f: hz(m + 12), at: t + 0.12 + i * 0.06, attack: 0.2, hold: 0.3, dur: 1.2, gain: 0.03, rev: 0.4 });
    });
    this.bell(hz(89), t + 0.6, 0.04, 0.5);
  }

  /** An event node: a mysterious little sting, a diminished climb into a hanging note over a low drone. */
  eventSting(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const notes = [64, 67, 70, 75];
    notes.forEach((m, i) => {
      const s = t + i * 0.1;
      const last = i === notes.length - 1;
      this.voice({ at: s, type: 'triangle', f: [[0, hz(m)]], vib: last ? { rate: 6, cents: 0, cents1: 25 } : undefined, amp: [[0.01, 0.16], [last ? 0.8 : 0.25, 0]], rev: 0.5 });
      this.tone({ type: 'sine', f: hz(m + 12), at: s, dur: last ? 0.7 : 0.2, gain: 0.05, rev: 0.6 });
    });
    this.bell(hz(87), t + 0.3, 0.05, 0.6);
    this.tone({ type: 'sine', f: hz(52), at: t, attack: 0.1, hold: 0.3, dur: 0.9, gain: 0.12 });
    this.voice({ at: t, type: 'noise', filter: 'highpass', ff: [[0, 5000]], amp: [[0.4, 0.05], [1, 0]] });
  }

  /** A tiny blip when a dialogue box advances. */
  textBlip(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const f = 880 * (1 + (this.rand() - 0.5) * 0.06);
    this.tone({ type: 'pulse25', f, at: t, dur: 0.028, gain: 0.045 });
    this.tone({ type: 'triangle', f: f * 2, at: t, dur: 0.02, gain: 0.04 });
  }

  /** Region cleared: a ~2.5 s fanfare (original melody). A drum roll, a climbing C - F - G - C line, and a held
   *  major chord with a crash and bells. */
  victory(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const E = 0.12; // one 8th
    const mel: [number, number, number][] = [
      [0, 67, 1],
      [1, 72, 1],
      [2, 76, 1],
      [3, 79, 3],
      [6, 77, 1],
      [7, 81, 1],
      [8, 84, 3],
      [11, 83, 1],
      [12, 86, 1],
      [13, 83, 1],
      [14, 84, 8],
    ];
    for (const [k, m, l] of mel) {
      const s = t + k * E;
      const d = l * E;
      const f = hz(m);
      const last = k === 14;
      this.tone({ type: 'pulse25', f, at: s, dur: d, hold: d * 0.5, gain: 0.08, rev: 0.35 });
      this.tone({ type: 'triangle', f, at: s, dur: d * 1.1, hold: d * 0.4, gain: 0.13, rev: 0.25 });
      if (last) this.voice({ at: s, type: 'pulse25', f: [[0, f]], vib: { rate: 6, cents: 0, cents1: 18 }, amp: [[0.02, 0.05], [d * 0.6, 0.05], [d + 0.3, 0]], rev: 0.5 });
    }
    // harmony a third or sixth under the held notes
    for (const [k, m, l] of [
      [3, 76, 3],
      [8, 81, 3],
      [14, 79, 8],
      [14, 76, 8],
    ]) this.tone({ type: 'square', f: hz(m), at: t + k * E, dur: l * E, hold: l * E * 0.4, gain: 0.035, rev: 0.4, detune: 5 });
    // bass on the chord changes: C, F, G, C
    for (const [k, m, l] of [
      [0, 48, 6],
      [6, 41, 5],
      [11, 43, 3],
      [14, 36, 8],
    ]) {
      this.tone({ type: 'triangle', f: hz(m), at: t + k * E, dur: l * E, hold: l * E * 0.6, gain: 0.25 });
      this.tone({ type: 'square', f: hz(m + 12), at: t + k * E, dur: l * E * 0.8, gain: 0.03 });
    }
    // drums: a roll into the first chord, kicks on the changes, a fill and a crash on the last chord
    for (let i = 0; i < 16; i++) this.noise({ at: t + i * 0.0225, dur: 0.03, gain: 0.08 + 0.12 * (i / 15), filter: 'bandpass', f: 2200, q: 0.6 });
    for (const k of [3, 6, 8, 11, 14]) this.tone({ type: 'sine', f: 160, f1: 50, glide: 0.08, at: t + k * E, dur: 0.18, gain: 0.5 });
    for (const k of [6, 11, 12, 12.5, 13, 13.5]) this.noise({ at: t + k * E, dur: 0.1, gain: k >= 12 ? 0.18 : 0.25, filter: 'bandpass', f: 2200, q: 0.6 });
    this.noise({ at: t + 14 * E, dur: 1.1, gain: 0.18, filter: 'highpass', f: 6000, rev: 0.3 });
    this.bell(hz(96), t + 14 * E + 0.05, 0.07, 0.6);
    this.bell(hz(103), t + 14 * E + 0.15, 0.05, 0.6);
  }

  /** The whole finisher as heard in a fight (wind-up, flurry, last blow), scheduled from `at`. For the Sound lab. */
  finisherSequence(stacks: number, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const n = Math.max(1, Math.min(5, stacks));
    const ms = finisherShowMs(n) / 1000;
    const strikes = finisherStrikes(n);
    this.finisherStart(n, t);
    for (let i = 0; i < strikes; i++) this.finisherStrike(i, strikes, t + ms * finisherStrikeAt(i, strikes));
    this.finisherBoom(n, t + ms * FINISHER_BLOW_AT);
  }

  /** Metronome click scheduled at an absolute AudioContext time. Dry, and bypasses the compressor. */
  clickAt(ctxTime: number, accent: boolean): void {
    const ctx = this.ctx;
    const gr = this.graph;
    if (!ctx || !gr || this.muted) return;
    this.duckUntil = Math.max(this.duckUntil, ctxTime + 0.4);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = accent ? 1600 : 1000;
    g.gain.setValueAtTime(0.0001, ctxTime);
    g.gain.exponentialRampToValueAtTime(0.35, ctxTime + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, ctxTime + 0.05);
    osc.connect(g).connect(gr.click);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
    osc.start(ctxTime);
    osc.stop(ctxTime + 0.07);
  }

  // ---------------------------------------------------------------- music

  /** Starts the looping battle track (idempotent; does nothing while musicOn is false).
   *  Notes are only scheduled while the context is running, unmuted and the page is visible. */
  startMusic(): void {
    this.musicManaged = true;
    if (!this.musicOn || this.musicTimer !== null || this.offline) return;
    this.musicStep = 0;
    this.musicResync = true;
    this.musicDucked = false;
    this.musicTimer = setInterval(this.tick, TICK_MS);
    this.tick();
  }

  /** Quick fade-out, then the music graph is torn down. */
  stopMusic(): void {
    this.musicManaged = true;
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    const rig = this.rig;
    this.rig = null;
    if (!rig) return;
    if (this.ctx) this.fade(rig.bus, 0, 0.12);
    setTimeout(() => {
      rig.bus.disconnect();
      rig.bass.disconnect();
      rig.hats.disconnect();
      rig.snare.disconnect();
    }, 300);
  }

  setMusicOn(on: boolean): void {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  /** Battle theme, the boss theme while a boss is on screen, or the map theme (node map, shops, rests, events and
   *  story scenes). Takes over on the next beat. */
  setTrack(name: MusicTrack): void {
    this.nextTrack = name;
    if (this.musicTimer === null) this.track = name;
  }

  get currentTrack(): MusicTrack {
    return this.track;
  }

  /** Schedule `steps` 16th notes of a track from ctx time `at` (tests render the music this way). */
  scheduleMusic(at: number, steps: number, name: MusicTrack = 'battle'): void {
    if (!this.ctx || !this.graph) return;
    if (!this.rig) this.rig = this.buildRig(this.ctx, at);
    const tr = TRACKS[name];
    for (let i = 0; i < steps; i++) this.playStep(this.rig, tr, name, i % LOOP_STEPS, at + i * tr.step);
  }

  private fade(bus: GainNode, target: number, time: number): void {
    const t = this.ctx!.currentTime;
    const p = bus.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(target, t + time);
  }

  private buildRig(ctx: Ctx, at?: number): MusicRig {
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(this.graph!.master);
    const filter = (type: BiquadFilterType, f: number, q: number): BiquadFilterNode => {
      const n = ctx.createBiquadFilter();
      n.type = type;
      n.frequency.value = f;
      n.Q.value = q;
      n.connect(bus);
      return n;
    };
    const rig = { bus, bass: filter('lowpass', 1000, 0), hats: filter('highpass', 7500, 0), snare: filter('bandpass', 2200, 0.6) };
    this.musicLevelSet = this.musicLevel;
    if (at !== undefined) bus.gain.setValueAtTime(this.musicLevel, at);
    else this.fade(bus, this.musicLevel, 0.06);
    return rig;
  }

  private readonly tick = (): void => {
    const ctx = this.ctx;
    if (!ctx || !this.graph || ctx.state !== 'running' || this._muted || (typeof document !== 'undefined' && document.hidden)) {
      this.musicResync = true;
      return;
    }
    if (!this.rig) this.rig = this.buildRig(ctx);
    const rig = this.rig;
    const now = ctx.currentTime;
    if (now < this.duckUntil) {
      if (!this.musicDucked) this.fade(rig.bus, 0, 0.08);
      this.musicDucked = true;
      this.musicResync = true;
      return;
    }
    if (this.musicDucked) {
      this.fade(rig.bus, this.musicLevel, 0.3);
      this.musicDucked = false;
      this.musicLevelSet = this.musicLevel;
    } else if (this.musicLevel !== this.musicLevelSet && now > this.impactDuckUntil) {
      // the music volume slider moved
      this.fade(rig.bus, this.musicLevel, 0.1);
      this.musicLevelSet = this.musicLevel;
    }
    if (this.musicResync || this.musicNext < now) {
      this.musicNext = now + 0.03;
      this.musicResync = false;
    }
    while (this.musicNext < now + LOOKAHEAD) {
      if (this.nextTrack !== this.track && this.musicStep % 4 === 0) {
        // the boss arrives (or leaves), or we go to or from the map: the other theme starts from its top, on the beat
        this.track = this.nextTrack;
        this.musicStep = 0;
      }
      const tr = TRACKS[this.track];
      this.playStep(rig, tr, this.track, this.musicStep, this.musicNext);
      this.musicNext += tr.step;
      this.musicStep = (this.musicStep + 1) % LOOP_STEPS;
    }
  };

  private playStep(rig: MusicRig, tr: Track, name: MusicTrack, step: number, t: number): void {
    if (name === 'map') return this.mapStep(rig, tr, step, t);
    const bar = step >> 4;
    const s = step & 15;
    const chord = tr.song[bar];
    const STEP = tr.step;

    const b = tr.bass(bar)[s];
    if (b) this.bassNote(rig, hz(chord.root + b[0]), t, b[1] * STEP * 0.92);

    this.tone({ type: 'pulse12', f: hz(chord.arp[tr.arp[s]]), at: t, dur: STEP * 0.85, gain: 0.3, out: rig.bus });

    const l = tr.lead[step];
    if (l) {
      const len = l[1] * STEP;
      this.tone({ type: 'pulse25', f: hz(l[0]), at: t, attack: 0.005, hold: len * 0.45, dur: len * 0.95, gain: 0.42, scoop: -30, out: rig.bus });
      // the boss lead is doubled an octave down for weight
      if (name === 'boss') this.tone({ type: 'square', f: hz(l[0] - 12), at: t, attack: 0.005, hold: len * 0.4, dur: len * 0.9, gain: 0.12, out: rig.bus });
    }

    if (name === 'boss') this.bossDrums(rig, bar, s, t);
    else this.battleDrums(rig, bar, s, t);
  }

  private battleDrums(rig: MusicRig, bar: number, s: number, t: number): void {
    const fill = bar === 7 && s >= 12;
    if (s === 0 || s === 8 || s === 10 || (s === 3 && bar % 2 === 1)) {
      this.tone({ type: 'sine', f: 165, f1: 48, glide: 0.08, at: t, dur: 0.18, gain: 0.7, out: rig.bus });
    }
    const snare = s === 4 || s === 12 ? 1 : fill ? 0.35 + (s - 12) * 0.2 : 0;
    if (snare) {
      this.noise({ at: t, dur: 0.13, gain: 0.8 * snare, out: rig.snare });
      this.tone({ type: 'triangle', f: 230, f1: 160, glide: 0.05, at: t, dur: 0.07, gain: 0.35 * snare, out: rig.bus });
    }
    if (bar === 0 && s === 0) this.noise({ at: t, dur: 0.45, gain: 0.45, out: rig.hats }); // crash at the top of the loop
    else if (!fill) {
      const open = s === 14 && bar % 2 === 1;
      const vel = s % 4 === 2 ? 0.9 : s % 2 === 0 ? 0.55 : 0.28;
      this.noise({ at: t, dur: open ? 0.11 : 0.035, gain: 0.3 * (open ? 0.8 : vel), out: rig.hats });
    }
  }

  /** Boss drums: driving kicks (double-time in the second half), a rolling snare fill, crashes every 4 bars. */
  private bossDrums(rig: MusicRig, bar: number, s: number, t: number): void {
    const fill = bar === 7 && s >= 8;
    const kick = bar >= 4 ? s % 2 === 0 && !fill : s === 0 || s === 3 || s === 6 || s === 8 || s === 10 || s === 14;
    if (kick || (fill && s % 4 === 0)) this.tone({ type: 'sine', f: 170, f1: 46, glide: 0.07, at: t, dur: 0.15, gain: 0.62, out: rig.bus });
    const snare = s === 4 || s === 12 ? 1 : fill ? 0.3 + (s - 8) * 0.09 : 0;
    if (snare) {
      this.noise({ at: t, dur: 0.12, gain: 0.8 * snare, out: rig.snare });
      this.tone({ type: 'triangle', f: 240, f1: 150, glide: 0.05, at: t, dur: 0.07, gain: 0.35 * snare, out: rig.bus });
    }
    if ((bar === 0 || bar === 4) && s === 0) this.noise({ at: t, dur: 0.5, gain: 0.45, out: rig.hats });
    else if (!fill && s % 2 === 0) this.noise({ at: t, dur: 0.035, gain: 0.3 * (s % 4 === 2 ? 0.9 : 0.5), out: rig.hats });
  }

  /** The map theme's voices: walking bass, a music-box arpeggio on the 8ths, and a soft flute-like lead whose
   *  longer notes bloom into a gentle vibrato. */
  private mapStep(rig: MusicRig, tr: Track, step: number, t: number): void {
    const bar = step >> 4;
    const s = step & 15;
    const chord = tr.song[bar];
    const STEP = tr.step;

    const b = tr.bass(bar)[s];
    if (b) this.bassNote(rig, hz(chord.root + b[0]), t, b[1] * STEP * 0.85, 0.36);

    if (s % 2 === 0) {
      const f = hz(chord.arp[tr.arp[s]]);
      this.tone({ type: 'triangle', f, at: t, dur: STEP * 2.2, gain: 0.3, out: rig.bus });
      this.tone({ type: 'sine', f: f * 2, at: t, dur: STEP * 1.4, gain: 0.11, out: rig.bus });
    }

    const l = tr.lead[step];
    if (l) {
      const len = l[1] * STEP;
      const f = hz(l[0]);
      const vib = l[1] >= 4 ? { rate: 5.2, cents: 0, cents1: 16 } : undefined;
      const amp: Pts = [[0.025, 0.36], [len * 0.55, 0.29], [len * 0.97, 0]];
      this.voice({ at: t, type: 'triangle', f: [[0, f]], vib, amp, out: rig.bus });
      this.voice({ at: t, type: 'pulse25', f: [[0, f]], vib, amp: scalePts(amp, 0.16), out: rig.bus });
    }

    this.mapDrums(rig, bar, s, t);
  }

  /** Map percussion, light: a soft kick on 1 and 3, a woodblock on 2 and 4, a shaker on the 8ths, a small fill
   *  into the loop and a chime at its top. */
  private mapDrums(rig: MusicRig, bar: number, s: number, t: number): void {
    const fill = bar === 7 && s >= 10;
    if (s === 0 || s === 8 || (s === 14 && bar % 2 === 1 && !fill)) this.tone({ type: 'sine', f: 120, f1: 50, glide: 0.08, at: t, dur: 0.16, gain: s === 14 ? 0.2 : 0.32, out: rig.bus });
    const block = s === 4 || s === 12 ? 1 : fill && (s === 10 || s >= 13) ? 0.7 : 0;
    if (block) {
      const f = fill ? 760 + (s - 10) * 60 : 820;
      this.tone({ type: 'triangle', f, f1: f * 0.92, glide: 0.04, at: t, dur: 0.05, gain: 0.22 * block, out: rig.bus });
      this.noise({ at: t, dur: 0.03, gain: 0.18 * block, out: rig.snare });
    }
    if (s % 2 === 0 && !fill) this.noise({ at: t, attack: 0.01, dur: 0.045, gain: s % 4 === 2 ? 0.14 : 0.07, out: rig.hats });
    if (bar === 0 && s === 0) this.bell(hz(89), t, 0.025, 0.5);
  }

  /** Triangle bass with a quiet square layer (so it reads on phone speakers), through the bass lowpass. */
  private bassNote(rig: MusicRig, f: number, t: number, dur: number, level = 0.55): void {
    const ctx = this.ctx!;
    const tri = ctx.createOscillator();
    tri.type = 'triangle';
    tri.frequency.value = f;
    const sq = ctx.createOscillator();
    sq.type = 'square';
    sq.frequency.value = f;
    const sqLevel = ctx.createGain();
    sqLevel.gain.value = 0.35;
    const { g, end } = this.env(level, t, 0.004, dur * 0.5, dur);
    tri.connect(g);
    sq.connect(sqLevel);
    sqLevel.connect(g);
    g.connect(rig.bass);
    tri.onended = () => {
      tri.disconnect();
      sq.disconnect();
      sqLevel.disconnect();
      g.disconnect();
    };
    tri.start(t);
    sq.start(t);
    tri.stop(end + 0.02);
    sq.stop(end + 0.02);
  }
}

/** Every sound effect, for the Sound lab and the loudness tests. `tier` marks the impacts (lightest first). */
export interface SfxEntry {
  id: string;
  label: string;
  tier?: ImpactTier;
  stacks?: number;
  len: number; // seconds to render
  play(s: Synth, at: number): void;
}

export const SFX: SfxEntry[] = [
  { id: 'hit', label: 'Hit', tier: 'hit', len: 0.6, play: (s, at) => s.hit(1, false, false, at) },
  { id: 'hit-combo', label: 'Hit, combo 12', tier: 'hit', len: 0.6, play: (s, at) => s.hit(12, false, false, at) },
  { id: 'perfect', label: 'Perfect hit', tier: 'perfect', len: 0.8, play: (s, at) => s.hit(5, false, true, at) },
  { id: 'block', label: 'Block', tier: 'block', len: 0.8, play: (s, at) => s.block(false, false, at) },
  { id: 'shield', label: 'Shield crack', len: 0.8, play: (s, at) => s.block(true, false, at) },
  { id: 'crit', label: 'Crit', tier: 'crit', len: 1, play: (s, at) => s.hit(8, true, false, at) },
  { id: 'bomb', label: 'Bomb', tier: 'bomb', len: 1.5, play: (s, at) => s.explode(at) },
  ...[1, 2, 3, 4, 5].map((n): SfxEntry => ({ id: `finisher${n}`, label: `Finisher x${n} (last blow)`, tier: 'finisher', stacks: n, len: 2, play: (s, at) => s.finisherBoom(n, at) })),
  { id: 'kill', label: 'Kill', tier: 'kill', len: 2, play: (s, at) => s.enemyPop(false, at) },
  { id: 'bossKill', label: 'Boss kill', tier: 'bossKill', len: 2.5, play: (s, at) => s.enemyPop(true, at) },
  { id: 'finisher-show3', label: 'Finisher x3 (whole show)', len: 3, play: (s, at) => s.finisherSequence(3, at) },
  { id: 'finisher-show5', label: 'Finisher x5 (whole show)', len: 3.5, play: (s, at) => s.finisherSequence(5, at) },
  { id: 'hurt', label: 'Hurt', len: 1, play: (s, at) => s.hurt(at) },
  { id: 'miss', label: 'Miss', len: 0.5, play: (s, at) => s.miss(at) },
  { id: 'swish', label: 'Swing', len: 0.3, play: (s, at) => s.swish(at) },
  { id: 'windup', label: 'Enemy wind-up', len: 0.4, play: (s, at) => s.windup(at) },
  { id: 'stackUp', label: 'Stack banked', len: 0.9, play: (s, at) => s.stackUp(2, at) },
  { id: 'stackLost', label: 'Stacks lost', len: 0.9, play: (s, at) => s.stackLost(3, at) },
  { id: 'speedUp', label: 'Speed up', len: 0.6, play: (s, at) => s.speedUp(at) },
  { id: 'milestone', label: 'Combo milestone', len: 0.8, play: (s, at) => s.ready2(at) },
  { id: 'rare', label: 'Rare boost card', len: 1, play: (s, at) => s.rareSting(false, at) },
  { id: 'epic', label: 'Epic boost card', len: 1.2, play: (s, at) => s.rareSting(true, at) },
  { id: 'jingle', label: 'Kill jingle', len: 1.5, play: (s, at) => s.kill(at) },
  { id: 'coin', label: 'Coin', len: 0.5, play: (s, at) => s.coin(at) },
  { id: 'statUp', label: 'Stat up', len: 0.4, play: (s, at) => s.statUp(0, at) },
  { id: 'heal', label: 'Heal', len: 0.7, play: (s, at) => s.heal(at) },
  { id: 'pet', label: 'Pip peck', len: 0.3, play: (s, at) => s.pet(at) },
  { id: 'ui', label: 'UI click', len: 0.2, play: (s, at) => s.uiClick(at) },
  // enemy special moves: the telegraphs (at a 0.8 s wind-up), then the actions
  ...TELL_SOUNDS.map((k): SfxEntry => ({ id: `tell-${k}`, label: `Tell: ${k.replace(/[A-Z]/g, (c) => ' ' + c.toLowerCase())}`, len: 1.2, play: (s, at) => s.telegraph(k, 0.8, at) })),
  { id: 'stompLand', label: 'Stomp lands', len: 1.4, play: (s, at) => s.stompLand(at) },
  { id: 'freeze', label: 'Cursor freeze', len: 0.8, play: (s, at) => s.freeze(at) },
  { id: 'counter', label: 'Guard counter', len: 1, play: (s, at) => s.counter(at) },
  { id: 'wardCrack', label: 'Shell block cracks', len: 0.6, play: (s, at) => s.wardBreak(false, at) },
  { id: 'wardShatter', label: 'Shell shatters', len: 1, play: (s, at) => s.wardBreak(true, at) },
  { id: 'sporePop', label: 'Spore pop', len: 0.3, play: (s, at) => s.sporePop(at) },
  { id: 'sporeHeal', label: 'Spores heal', len: 1.3, play: (s, at) => s.sporeHeal(at) },
  { id: 'split', label: 'Slime splits', len: 0.6, play: (s, at) => s.split(at) },
  { id: 'summonArrive', label: 'Summoned arrive', len: 0.8, play: (s, at) => s.summonArrive(at) },
  // map, shop, rest, events and story
  { id: 'mapSelect', label: 'Map: choose node', len: 0.5, play: (s, at) => s.mapSelect(at) },
  { id: 'shopBuy', label: 'Shop: buy', len: 0.9, play: (s, at) => s.shopBuy(at) },
  { id: 'restHeal', label: 'Rest: campfire', len: 1.8, play: (s, at) => s.restHeal(at) },
  { id: 'eventSting', label: 'Event sting', len: 1.3, play: (s, at) => s.eventSting(at) },
  { id: 'textBlip', label: 'Dialogue blip', len: 0.15, play: (s, at) => s.textBlip(at) },
  { id: 'victory', label: 'Region cleared', len: 3.2, play: (s, at) => s.victory(at) },
];
