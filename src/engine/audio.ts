// Web Audio synth: every sound effect, all the music (a theme per act, per boss, the camp and the title: see
// music.ts) and the ambience beds (forest, ruins, hollow, act map, world map, camp; Region 2's pass, caves and
// glacier) are generated in code (no samples).
// Unlocked on the first user gesture. Also runs on an OfflineAudioContext (tests render every sound).
//
// Graph:
//   sfx voices ----------------------------> master -> compressor -> limiter -> soft clip -> destination
//   impact sub layer ---------------------------------------------> limiter (so it never pumps the compressor)
//   bell/finisher/kill voices -> reverb sends -> highpass -> convolver -> return -> master
//   crunchy voices -> drive -> waveshaper (soft clip + bit steps) -> lowpass -> master
//   music parts (pad, arp, bell, lead, bass, drums, perc, fx: music.ts) -> layer gates -> arrangement fades
//     (+ ping-pong echo, hall reverb) -> music bus (one per run, tuning.impact.music, ducked under big impacts) -> master
//   ambience beds and events -> stereo spots -> fade (crossfades places) -> ambience out (ducked too) -> master
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
import { Band, type MusicRender, type MusicTrack } from './music';

export { MUSIC_PIECES, MUSIC_TRACKS, type MusicPiece, type MusicTrack } from './music';

type Ctx = BaseAudioContext;
export type Wave = Exclude<OscillatorType, 'custom'> | 'pulse25' | 'pulse12';

export interface ToneOpts {
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

export interface NoiseOpts {
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
  buf?: AudioBuffer; // noise source (defaults to the 1 s white noise)
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
  hall?: AudioBuffer; // the music reverb's impulse (made on first use)
  pink?: AudioBuffer; // 6 s of stereo pink noise for the ambience beds (made on first use)
}

/** Places with their own sound bed under the music (Region 2's acts: 'pass', 'caves', 'glacier'). */
export type Ambience = 'forest' | 'ruins' | 'hollow' | 'map' | 'world' | 'camp' | 'pass' | 'caves' | 'glacier';
export const AMBIENCES: Ambience[] = ['forest', 'ruins', 'hollow', 'map', 'world', 'camp', 'pass', 'caves', 'glacier'];

/** A looping filtered-noise layer of an ambience (wind, rain, fire, surf), nudged at random by gusts. */
interface Bed {
  filter: BiquadFilterNode;
  gain: GainNode;
  g: number; // resting level
  f: number; // resting filter frequency
  gust: [number, number]; // level multiplier range a gust moves to
  sway: [number, number]; // filter frequency multiplier range
  tau: number; // how long a gust's glide takes (s)
  at: [number, number]; // level and filter frequency the last glide ended on
}

/** An ambience playing: its beds, its stereo spots (events play from one), and the events' next times. */
interface AmbRig {
  name: Ambience;
  fade: GainNode;
  spots: AudioNode[]; // inputs at fixed places in the stereo field, near (bright) to far (dull)
  echo: AudioNode | null; // the ruins' (and the caves') echo
  beds: Bed[];
  nodes: AudioNode[];
  srcs: AudioScheduledSourceNode[];
  events: Record<string, AmbEvent>;
  next: Map<string, number>; // ctx time of each event kind's next occurrence
  rand: () => number; // seeded, so a place's sequence of events repeats exactly (tests, screenshots)
}

interface AmbEvent {
  every: [number, number]; // seconds between occurrences (uniform)
  /** Plays at t; may return how long it lasts (added before the next one). */
  play: (r: AmbRig, t: number) => number | void;
}

const MASTER_LEVEL = 0.8;

// ---- Ambience: looping filtered-noise beds (wind, rain, fire, surf) that drift with random gusts, and synthesized
// events (birds, drips, crickets, an owl, gulls, waves) at seeded random times, scheduled ahead like the music. ----
/** Ambience level at the default music volume (it follows the music volume slider). */
const AMB_LEVEL = 1;
const AMB_TICK_MS = 120;
const AMB_LOOKAHEAD = 0.6;
const AMB_FADE_IN = 1.6;
const AMB_FADE_OUT = 1.2;
/** Where ambience events come from: [pan, lowpass Hz] (duller reads as further away). */
const SPOTS: [number, number][] = [
  [-0.75, 4200], // far left
  [-0.35, 9000], // near left
  [0.05, 3000], // far, middle
  [0.4, 8000], // near right
  [0.8, 5000], // far right
];
const ALL_SPOTS = [0, 1, 2, 3, 4] as const;
const FAR_SPOTS = [0, 2, 4] as const;
/** How much of each ambience goes to the reverb. */
const AMB_WET: Record<Ambience, number> = { forest: 0.18, ruins: 0.55, hollow: 0.25, map: 0.12, world: 0.15, camp: 0.2, pass: 0.2, caves: 0.6, glacier: 0.25 };

// Hit melody: major pentatonic, wrapping up an octave every 5 combo steps.
const PENTA = [0, 2, 4, 7, 9];
const HIT_BASE = 523.25; // C5
const HIT_TOP = 13; // G7, ~2.6 octaves up; past it the blip trills between the top two notes

// ---- Music (music.ts): scheduled ahead on a timer, like the ambience. ----
const LOOKAHEAD = 0.12;
const TICK_MS = 25;

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
export type Pts = [number, number][];
const scalePts = (p: Pts, k: number): Pts => p.map(([d, v]): [number, number] => [d, v * k]);

export interface VoiceOpts {
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
  buf?: AudioBuffer; // noise source (defaults to the 1 s white noise)
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

/** Seeded 0..1 random (mulberry32): the ambience's timing and the generated buffers repeat exactly. */
function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    let t = (s = (s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The music's hall: decorrelated stereo noise after a 12 ms pre-delay, decaying 60 dB over `seconds` and losing
 *  its highs as it goes (a one-pole lowpass closing over the tail), so it blooms without fizz. */
function hallImpulse(ctx: Ctx, seconds: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const pre = Math.floor(rate * 0.012);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const rand = mulberry(0x5eed + ch * 977);
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const k = (i - pre) / (len - pre);
      lp += (0.8 - 0.7 * k) * (rand() * 2 - 1 - lp);
      d[i] = lp * Math.exp(-6.9 * k) * Math.min(1, (i - pre) / (rate * 0.004));
    }
  }
  return buf;
}

/** Stereo pink noise (Paul Kellet's filter), decorrelated channels, looping without a seam: wind, rain, surf. */
function pinkNoise(ctx: Ctx, seconds: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const xf = Math.floor(rate * 0.05);
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const rand = mulberry(0x9a1e + ch * 131);
    const raw = new Float32Array(len + xf);
    let [b0, b1, b2, b3, b4, b5, b6] = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < raw.length; i++) {
      const w = rand() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    // the tail past `len` fades into the head, so sample len-1 runs straight on into sample 0
    for (let i = 0; i < xf; i++) raw[i] = raw[i] * (i / xf) + raw[len + i] * (1 - i / xf);
    buf.getChannelData(ch).set(raw.subarray(0, len));
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

/** The music asked for: the piece, calm or fight arrangement, the combo (fight layers) and the boss phase. */
interface MusicState {
  track: MusicTrack;
  intense: boolean;
  combo: number;
  phase: number;
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

  /** The music (music.ts): the pieces, their arrangements and layers, scheduled ahead on the music timer. */
  private readonly band: Band;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicManaged = false; // startMusic/stopMusic was called: unlock() no longer auto-starts
  private musicResync = true;
  private musicDucked = false;
  private duckUntil = 0; // music stays silent while metronome clicks are scheduled
  private impactDuckUntil = 0; // an impact dipped the music until this ctx time
  private musicLevelSet = -1;
  /** What the game asks the music for; the Sound lab can pin something else meanwhile (audition). */
  private game: MusicState = { track: 'title', intense: false, combo: 0, phase: 1 };
  private lab: MusicState | null = null;

  private amb: AmbRig | null = null; // the ambience playing
  private ambWant: Ambience | null = null; // the ambience the game asked for
  private ambTimer: ReturnType<typeof setInterval> | null = null;
  private ambOut: GainNode | null = null; // every ambience goes through here (level, impact ducks)
  private ambRev: GainNode | null = null; // ambience -> the reverb
  private ambLevelSet = -1;
  private ambStarts = 0; // seeds each ambience start

  constructor(o: SynthOptions = {}) {
    this.tuning = o.tuning ?? DEFAULT_TUNING;
    this.rand = o.rand ?? Math.random;
    this.offline = !!o.ctx;
    this.band = new Band({
      offline: this.offline,
      ctx: () => this.ctx!,
      out: () => this.graph!.master,
      hall: () => (this.graph!.hall ??= hallImpulse(this.ctx!, 2.2)),
      drive: (k) => this.driveCurve(k),
      tone: (v) => this.tone(v),
      noise: (v) => this.noise(v),
      voice: (v) => this.voice(v),
      ticks: (at, v) => this.ticks(at, v),
      osc: (type, f) => this.osc(type, f),
      env: (peak, t, attack, hold, dur, minTail) => this.env(peak, t, attack, hold, dur, minTail),
      tuning: () => this.tuning,
    });
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

  /** The ambience follows the music volume slider, so it stays under the music at any setting. It doesn't follow
   *  the music on/off switch: with the music off, the places still sound alive. */
  private get ambLevel(): number {
    return (AMB_LEVEL * this.musicLevel) / Math.max(0.01, DEFAULT_TUNING.impact.music);
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
    if (this.ambTimer === null) this.startAmbience();
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
    src.buffer = o.buf ?? gr.noise;
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
   *  and tremolo. The building block of the telegraphs, whose sounds change shape over their whole length. Returns
   *  its envelope gain (to cut it short). */
  private voice(o: VoiceOpts): GainNode {
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
      b.buffer = o.buf ?? gr.noise;
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
    return g;
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

  /** Dip the music (and the ambience under it) under a big impact; they swell back over `ms`. */
  duckMusic(depth: number, ms: number, at?: number): void {
    if (!this.ctx || depth <= 0) return;
    const t = this.now(at);
    const dip = (p: AudioParam, level: number) => {
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
      p.linearRampToValueAtTime(level * (1 - Math.min(1, depth)), t + 0.012);
      p.setTargetAtTime(level, t + 0.04 + (ms / 1000) * 0.25, Math.max(0.01, ms / 3000));
    };
    this.impactDuckUntil = t + ms / 1000;
    if (this.ambOut) dip(this.ambOut.gain, this.ambLevel);
    const bus = this.band.bus;
    if (bus && !this.musicDucked) dip(bus.gain, this.musicLevel);
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

  /** A screen transition: a soft swoosh of air sweeping across the stereo field, left to right and rising (`back`:
   *  right to left, falling), with a faint low swell under it. */
  whoosh(back = false, at?: number): void {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = this.now(at);
    const d = 0.36;
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(back ? 0.7 : -0.7, t);
    pan.pan.linearRampToValueAtTime(back ? -0.7 : 0.7, t + d);
    pan.connect(this.graph!.master);
    const [f0, f1] = back ? [2600, 380] : [380, 2600];
    this.voice({ at: t, type: 'noise', filter: 'bandpass', ff: [[0, f0], [d, f1]], q: 1.1, amp: [[d * 0.55, 0.3], [d, 0]], out: pan, rev: 0.25 });
    this.voice({ at: t, type: 'noise', filter: 'highpass', ff: [[0, back ? 5000 : 2500], [d, back ? 2500 : 6000]], amp: [[d * 0.5, 0.05], [d * 0.9, 0]], out: pan });
    this.tone({ type: 'sine', f: back ? 150 : 95, f1: back ? 85 : 150, glide: d, at: t, attack: d * 0.5, dur: d, gain: 0.08 });
    this.disposeAt(t + d + 0.1, pan);
  }

  /** A panel or menu opens: a quick, soft rising "bloop" with a breath of air. */
  panelOpen(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.tone({ type: 'sine', f: 520, f1: 900, glide: 0.05, at: t, attack: 0.004, dur: 0.09, gain: 0.13 });
    this.tone({ type: 'triangle', f: 1320, at: t + 0.045, attack: 0.003, dur: 0.12, gain: 0.05, rev: 0.25 });
    this.voice({ at: t, type: 'noise', filter: 'bandpass', ff: [[0, 1200], [0.08, 4000]], q: 1.2, amp: [[0.04, 0.05], [0.09, 0]] });
  }

  /** A panel or menu closes: the open sound turned around, falling and a touch softer. */
  panelClose(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.tone({ type: 'sine', f: 880, f1: 480, glide: 0.06, at: t, attack: 0.003, dur: 0.1, gain: 0.12 });
    this.tone({ type: 'triangle', f: 990, at: t, attack: 0.002, dur: 0.06, gain: 0.035 });
    this.voice({ at: t, type: 'noise', filter: 'bandpass', ff: [[0, 3500], [0.08, 1000]], q: 1.2, amp: [[0.02, 0.05], [0.09, 0]] });
  }

  /** A soft footstep on a dirt road (the act map's walk): a muffled thud with a little grit, quiet. Odd `i` is the
   *  other foot (a touch lighter); every step's pitch varies a little so a walk never repeats exactly. */
  footstep(i = 0, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const k = (i % 2 ? 0.94 : 1.04) * (1 + (this.rand() - 0.5) * 0.16);
    const v = i % 2 ? 0.8 : 1;
    this.noise({ at: t, dur: 0.07, attack: 0.003, gain: 0.32 * v, filter: 'lowpass', f: 650 * k, f1: 260 * k, rate: 0.7 });
    this.tone({ type: 'triangle', f: 170 * k, f1: 90 * k, glide: 0.04, at: t, attack: 0.002, dur: 0.06, gain: 0.1 * v });
    this.noise({ at: t + 0.006, dur: 0.045, attack: 0.002, gain: 0.07 * v, filter: 'bandpass', f: 2000 * k, q: 1.1 });
    this.ticks(
      Array.from({ length: 3 }, () => t + 0.004 + this.rand() * 0.04),
      { gain: 0.05 * v, f: 3200 * k, q: 1.5, ms: 3 },
    );
  }

  /** One tick of a coin counter rolling up: a tiny metallic tick, a little higher for each `i` (up to 12). */
  coinTick(i = 0, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const f = 2800 * Math.pow(2, Math.min(12, Math.max(0, i)) / 24);
    this.tone({ type: 'sine', f, at: t, attack: 0.001, dur: 0.045, gain: 0.07 });
    this.tone({ type: 'sine', f: f * 2.76, at: t, attack: 0.001, dur: 0.02, gain: 0.03 });
    this.noise({ at: t, dur: 0.008, gain: 0.03, filter: 'highpass', f: 7000 });
  }

  /** A critter startled on the map (birds scattering, a rabbit diving into its bush): a few soft wingbeats of
   *  filtered air (`low`: a duller rustle of leaves). Quiet: life stays at the edge of attention. */
  critterFlutter(low = false, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const f = low ? 1300 : 2500;
    for (let i = 0; i < 5; i++) {
      const dt = i * 0.055 + this.rand() * 0.012;
      this.noise({ at: t + dt, dur: 0.045, attack: 0.004, gain: 0.08 * (1 - i * 0.12), filter: 'bandpass', f: f * (0.9 + this.rand() * 0.2), q: 1.4 });
    }
    this.noise({ at: t, dur: 0.3, attack: 0.03, gain: 0.025, filter: 'highpass', f: low ? 1800 : 3500 });
  }

  /** Pip chirps (at a critter on the map): two quick, soft, rising peeps. */
  critterChirp(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.tone({ type: 'sine', f: 2300, f1: 3300, glide: 0.05, at: t, attack: 0.004, dur: 0.07, gain: 0.05 });
    this.tone({ type: 'sine', f: 2600, f1: 3700, glide: 0.04, at: t + 0.09, attack: 0.004, dur: 0.06, gain: 0.045, rev: 0.2 });
  }

  /** A map sparkle picked up: a soft pop, then a little coin shimmer (quieter than a fight's coin). */
  sparklePop(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.tone({ type: 'sine', f: 520, f1: 1400, glide: 0.04, at: t, attack: 0.002, dur: 0.06, gain: 0.09 });
    this.noise({ at: t, dur: 0.02, gain: 0.03, filter: 'highpass', f: 4000 });
    this.tone({ type: 'triangle', f: 1975.53, at: t + 0.05, dur: 0.08, gain: 0.04 });
    this.tone({ type: 'sine', f: 2637.02, at: t + 0.11, dur: 0.25, gain: 0.045, rev: 0.3 });
    this.tone({ type: 'sine', f: 3951.07, at: t + 0.16, dur: 0.2, gain: 0.02, rev: 0.3 });
  }

  /** Disconnect `nodes` once ctx time passes `at` (a real context; an offline graph ends with its render). */
  private disposeAt(at: number, ...nodes: AudioNode[]): void {
    const ctx = this.ctx;
    if (this.offline || !ctx) return;
    setTimeout(() => nodes.forEach((n) => n.disconnect()), Math.max(0, at - ctx.currentTime) * 1000 + 100);
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

  // ---- gear and the camp: loot drops and reveals, the forge, the bag, gear effects in a fight

  /** An item bursts out of a fallen foe: a bright pop and a note that climbs with `rarity` 0 (Common) to 5 (Mythic);
   *  the rarer it is, the more it sparkles (a fifth, then bells, then a shower of high twinkles). */
  lootDrop(rarity: number, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const r = Math.max(0, Math.min(5, Math.round(rarity)));
    // the pop: a quick upward bloop with a puff of air
    this.tone({ type: 'sine', f: 260 + 50 * r, f1: 880 + 160 * r, glide: 0.05, at: t, attack: 0.002, dur: 0.09, gain: 0.2 });
    this.tone({ type: 'triangle', f: 520 + 100 * r, f1: 1500 + 300 * r, glide: 0.04, at: t, attack: 0.002, dur: 0.06, gain: 0.05 });
    this.noise({ at: t, dur: 0.05, attack: 0.003, gain: 0.07, filter: 'bandpass', f: 1400, f1: 4200, q: 1.2 });
    // the note: up the pentatonic with each rarity
    const m = 79 + [0, 2, 4, 7, 9, 12][r];
    const s = t + 0.035;
    this.tone({ type: 'square', f: hz(m), at: s, dur: 0.06, gain: 0.025 + 0.004 * r });
    this.tone({ type: 'sine', f: hz(m), at: s, dur: 0.22 + 0.06 * r, gain: 0.09, rev: 0.3 });
    if (r >= 1) this.tone({ type: 'sine', f: hz(m + 7), at: s + 0.05, dur: 0.2 + 0.05 * r, gain: 0.06, rev: 0.35 });
    if (r >= 2) this.bell(hz(m + 12), s + 0.09, 0.035 + 0.008 * r, 0.45);
    if (r >= 3) {
      // a shower of twinkles, more of them for rarer drops
      for (let i = 0; i < r + 1; i++) this.bell(hz(m + 12 + PENTA[(i * 2 + r) % 5] + (i > 2 ? 12 : 0)), s + 0.12 + i * 0.045 + this.rand() * 0.02, 0.02 + 0.004 * r, 0.5);
      this.noise({ at: s, dur: 0.3 + 0.05 * r, attack: 0.1, gain: 0.025 + 0.006 * r, filter: 'highpass', f: 7000 });
    }
    if (r >= 5) this.tone({ type: 'sine', f: 110, f1: 55, glide: 0.25, at: t, dur: 0.3, gain: 0.22 }); // a Mythic lands with weight
  }

  /** An Epic or better lands: a shimmering sting. Epic: a quick major-seventh run into a glittering shimmer;
   *  Legendary: a longer, brighter run with bells over a held chord; Mythic: a minor run over a low swell. */
  lootSting(rarity: number, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const r = Math.max(3, Math.min(5, Math.round(rarity)));
    const notes = r === 3 ? [72, 76, 79, 83, 86] : r === 4 ? [72, 76, 79, 84, 88, 91, 96] : [69, 72, 76, 81, 84, 88, 93];
    const step = r === 3 ? 0.05 : 0.045;
    notes.forEach((n, i) => {
      const s = t + i * step;
      const last = i === notes.length - 1;
      this.tone({ type: r === 5 ? 'sawtooth' : 'square', f: hz(n), at: s, dur: 0.07, gain: r === 5 ? 0.02 : 0.03 });
      this.tone({ type: 'sine', f: hz(n), at: s, dur: last ? 0.9 : 0.3, gain: 0.09, rev: 0.45, detune: i % 2 ? 4 : -4 });
    });
    const end = t + notes.length * step;
    // the shimmer: airy noise trembling fast, and twinkles scattered over it
    this.voice({ at: t, type: 'noise', filter: 'highpass', ff: [[0, 5000], [0.9, 8000]], trem: { rate: 17, depth: 0.7 }, amp: [[0.25, 0.05 + 0.01 * r], [0.95, 0]] });
    for (let i = 0; i < 3 + r; i++) this.bell(hz(notes[notes.length - 1] + [0, 4, 7, 12, 16, 19][i % 6]), end + i * 0.06 + this.rand() * 0.03, 0.03, 0.55);
    if (r >= 4) {
      // a held chord under the top note
      const root = notes[0];
      const chord = r === 4 ? [0, 4, 7, 12] : [0, 3, 7, 12];
      chord.forEach((iv, i) => this.tone({ type: 'triangle', f: hz(root + iv), at: end - 0.05, attack: 0.04, hold: 0.2, dur: 0.9, gain: 0.05, rev: 0.5, detune: i % 2 ? 6 : -6 }));
    }
    if (r === 5) {
      this.voice({ at: t, type: 'sawtooth', f: [[0, hz(33)], [0.6, hz(33)]], filter: 'lowpass', ff: [[0, 200], [0.4, 900], [0.9, 300]], q: 3, amp: [[0.3, 0.12], [0.9, 0]] });
      this.tone({ type: 'sine', f: 90, f1: 45, glide: 0.4, at: end - 0.1, dur: 0.6, gain: 0.25 });
    }
  }

  /** The full-screen reveal card of a Legendary: a riser into a bright fanfare (brassy saws opening up, a timpani
   *  hit, a cymbal wash, bells), held on a major chord. A Mythic's is darker and grander: a low drone swelling up, a
   *  minor motif climbing over a gong and a deep boom, and a high choir on the minor chord. */
  legendaryReveal(mythic: boolean, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const gr = this.graph!;
    const rise = 0.28;
    // the riser
    this.voice({ at: t, type: 'noise', filter: 'bandpass', ff: [[0, 400], [rise, mythic ? 3000 : 6000]], q: 1.6, amp: [[rise * 0.95, 0.22], [rise + 0.05, 0]], rev: 0.3 });
    this.voice({ at: t, type: 'sawtooth', f: [[0, mythic ? 55 : 110], [rise, mythic ? 220 : 440]], filter: 'lowpass', ff: [[0, 400], [rise, 2400]], amp: [[rise * 0.9, 0.05], [rise + 0.02, 0]] });
    const s = t + rise;
    // the hit: a timpani boom, a thump of air and a cymbal wash
    this.tone({ type: 'sine', f: mythic ? 70 : 110, f1: mythic ? 36 : 55, glide: 0.35, at: s, dur: 0.6, gain: 0.45 });
    this.noise({ at: s, dur: 0.25, gain: 0.25, filter: 'lowpass', f: 1800, f1: 200, rate: 0.6, rev: 0.3 });
    this.noise({ at: s, dur: 1.4, attack: 0.01, gain: 0.07, filter: 'highpass', f: 6000, rev: 0.5 });
    const root = mythic ? 57 : 60; // A minor / C major
    const third = mythic ? 3 : 4;
    if (!mythic) {
      // fanfare: ta-ta-taaa on the fifth, then up to the octave
      const fan: [number, number, number][] = [
        [0, 67, 0.1],
        [0.11, 67, 0.08],
        [0.2, 72, 1.1],
      ];
      for (const [d, m, len] of fan) {
        for (const det of [-7, 7])
          this.voice({ at: s + d, type: 'sawtooth', f: [[0, hz(m) * Math.pow(2, det / 1200)]], vib: d > 0.15 ? { rate: 5.5, cents: 0, cents1: 14 } : undefined, filter: 'lowpass', ff: [[0, 700], [0.06, 3200], [len, 1400]], q: 1.5, amp: [[0.015, 0.045], [len * 0.7, 0.035], [len + 0.25, 0]], rev: 0.35 });
        this.tone({ type: 'square', f: hz(m + 12), at: s + d, dur: len * 0.6, gain: 0.02, rev: 0.4 });
      }
    } else {
      // a dark motif climbing out of the drone
      const mot: [number, number, number][] = [
        [0, 69, 0.18],
        [0.18, 72, 0.18],
        [0.36, 76, 0.18],
        [0.54, 81, 1.2],
      ];
      for (const [d, m, len] of mot) {
        this.voice({ at: s + d, type: 'sawtooth', f: [[0, hz(m - 12)]], filter: 'lowpass', ff: [[0, 500], [0.08, 2200], [len, 900]], q: 2, amp: [[0.02, 0.06], [len * 0.8, 0.04], [len + 0.3, 0]], rev: 0.5 });
        this.tone({ type: 'triangle', f: hz(m), at: s + d, dur: len + 0.2, hold: len * 0.4, gain: 0.08, rev: 0.5 });
      }
      // the gong: low inharmonic partials ringing on
      for (const [k, g, d] of [
        [1, 0.12, 2],
        [1.48, 0.07, 1.6],
        [2.13, 0.05, 1.2],
        [2.9, 0.035, 0.9],
      ] as const)
        this.tone({ type: 'sine', f: 98 * k, at: s, attack: 0.01, dur: d, gain: g, rev: 0.5 });
      // the drone under it all, gritty
      this.voice({ at: t, type: 'sawtooth', f: [[0, hz(33)]], filter: 'lowpass', ff: [[0, 150], [rise + 0.4, 700], [2, 200]], q: 4, amp: [[rise, 0.08], [1.6, 0.06], [2.1, 0]], out: gr.crunch });
    }
    // the chord, held (detuned triangles), with a choir-ish top that swells in
    const hold = mythic ? 0.75 : 0.35;
    [0, third, 7, 12].forEach((iv, i) => {
      this.tone({ type: 'triangle', f: hz(root + iv), at: s + 0.02, attack: 0.05, hold, dur: 1.6, gain: 0.07, rev: 0.45, detune: i % 2 ? 7 : -7 });
      this.tone({ type: 'sine', f: hz(root - 12 + iv), at: s + 0.02, attack: 0.03, hold: hold * 0.7, dur: 1.2, gain: i === 0 ? 0.16 : 0.04 });
    });
    this.voice({ at: s + 0.15, type: 'sine', f: [[0, hz(root + 24 + third)]], vib: { rate: 5, cents: 8, cents1: 20 }, amp: [[0.4, 0.05], [1.2, 0.04], [1.7, 0]], rev: 0.6 });
    // bells cascading down over the chord
    const top = root + 36;
    [0, -5, -8 - (mythic ? 1 : 0), -12, -17].forEach((d, i) => this.bell(hz(top + d), s + 0.05 + i * 0.07, 0.05 - i * 0.006, 0.6));
  }

  /** The smith's hammer on the anvil: a sharp strike, a short thud, and the anvil ringing on (inharmonic partials). */
  forgeHammer(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const k = 1 + (this.rand() - 0.5) * 0.04;
    this.noise({ at: t, dur: 0.012, attack: 0.0004, gain: 0.45, filter: 'highpass', f: 2500, minTail: 0.003 });
    this.tone({ type: 'square', f: 900 * k, at: t, dur: 0.01, attack: 0.0003, gain: 0.08, minTail: 0.003 });
    this.tone({ type: 'triangle', f: 210 * k, f1: 95 * k, glide: 0.05, at: t, dur: 0.08, gain: 0.3 });
    this.noise({ at: t, dur: 0.06, gain: 0.14, filter: 'bandpass', f: 900, f1: 500, q: 1.5, out: this.graph!.crunch });
    // the ring: a steel block's partials, the high ones dying first
    for (const [r, g, d] of [
      [1, 0.09, 1],
      [2.76, 0.07, 0.7],
      [4.07, 0.05, 0.45],
      [5.4, 0.035, 0.3],
      [6.9, 0.025, 0.2],
    ] as const)
      this.tone({ type: 'sine', f: 1040 * k * r, at: t, attack: 0.001, dur: d, gain: g, rev: 0.3 });
    this.ticks([t + 0.004, t + 0.011], { gain: 0.12, f: 6000, q: 1, ms: 3 }); // a little scale flying off
  }

  /** An upgrade lands (+1): a quick rising sweep of sparkles that ends on a bright chime. */
  forgeUpgrade(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.voice({ at: t, type: 'noise', filter: 'bandpass', ff: [[0, 800], [0.35, 7000]], q: 2.5, amp: [[0.3, 0.12], [0.4, 0]] });
    this.voice({ at: t, type: 'triangle', f: [[0, 400], [0.35, 1600]], amp: [[0.3, 0.05], [0.38, 0]] });
    [72, 76, 79, 84, 88, 91].forEach((m, i) => {
      const s = t + i * 0.045;
      this.tone({ type: 'sine', f: hz(m), at: s, dur: 0.18, gain: 0.08, rev: 0.35 });
      this.tone({ type: 'square', f: hz(m + 12), at: s, dur: 0.04, gain: 0.018 });
    });
    const s = t + 0.3;
    this.bell(hz(96), s, 0.08, 0.5);
    this.bell(hz(103), s + 0.07, 0.05, 0.55);
    [84, 88, 91].forEach((m) => this.tone({ type: 'sine', f: hz(m), at: s, attack: 0.01, hold: 0.1, dur: 0.6, gain: 0.05, rev: 0.45 }));
    this.voice({ at: s, type: 'noise', filter: 'highpass', ff: [[0, 7000]], trem: { rate: 18, depth: 0.6 }, amp: [[0.05, 0.04], [0.5, 0]] });
  }

  /** An item melts into scrap: a metal crunch, then a hiss of hot metal sizzling out. */
  salvage(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const gr = this.graph!;
    // the crunch: a few chunky bites through the drive, pitch falling
    for (let i = 0; i < 3; i++) {
      const s = t + i * 0.045 + this.rand() * 0.01;
      this.noise({ at: s, dur: 0.05, gain: 0.32 - i * 0.06, filter: 'bandpass', f: 1300 - i * 250, q: 1.4, out: gr.crunch });
      this.tone({ type: 'square', f: 260 - i * 50, f1: 140 - i * 25, glide: 0.04, at: s, dur: 0.05, gain: 0.07, out: gr.crunch });
    }
    this.ticks(
      Array.from({ length: 8 }, () => t + this.rand() * 0.14),
      { gain: 0.16, f: 3600, q: 2, ms: 4 },
    );
    // the sizzle: bright, trembling noise fading out, and a soft low fwump
    this.voice({ at: t + 0.1, type: 'noise', filter: 'highpass', ff: [[0, 3500], [0.6, 6000]], trem: { rate: 24, depth: 0.7, rate1: 9 }, amp: [[0.04, 0.12], [0.25, 0.07], [0.65, 0]] });
    this.voice({ at: t + 0.1, type: 'noise', filter: 'bandpass', ff: [[0, 2200], [0.5, 1400]], q: 3, trem: { rate: 31, depth: 0.8 }, amp: [[0.05, 0.05], [0.5, 0]] });
    this.tone({ type: 'sine', f: 140, f1: 70, glide: 0.15, at: t, dur: 0.18, gain: 0.18 });
    this.tone({ type: 'sine', f: hz(79), at: t + 0.32, dur: 0.18, gain: 0.04, rev: 0.4 }); // a tiny ting: scrap gained
  }

  /** Gear goes on: a leathery clunk (a thump, a buckle and a creak of straps), then a bright little chime. */
  equip(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.noise({ at: t, dur: 0.07, attack: 0.002, gain: 0.3, filter: 'lowpass', f: 900, f1: 300, rate: 0.7 });
    this.tone({ type: 'triangle', f: 150, f1: 85, glide: 0.05, at: t, dur: 0.08, gain: 0.22 });
    this.noise({ at: t + 0.004, dur: 0.03, gain: 0.08, filter: 'bandpass', f: 2600, q: 2 });
    this.voice({ at: t + 0.05, type: 'noise', filter: 'bandpass', ff: [[0, 700], [0.09, 1000]], q: 5, trem: { rate: 55, depth: 0.9, wave: 'sawtooth' }, amp: [[0.03, 0.18], [0.1, 0]] });
    this.tone({ type: 'sine', f: hz(88), at: t + 0.1, dur: 0.25, gain: 0.08, rev: 0.4 });
    this.tone({ type: 'sine', f: hz(95), at: t + 0.16, dur: 0.4, gain: 0.07, rev: 0.45 });
    this.tone({ type: 'square', f: hz(95), at: t + 0.16, dur: 0.04, gain: 0.015 });
  }

  /** An item is locked or unlocked: the small double click of a latch. */
  lockToggle(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    this.ticks([t], { gain: 0.32, f: 3200, q: 3, ms: 5 });
    this.ticks([t + 0.035], { gain: 0.26, f: 1900, q: 3, ms: 7 });
    this.tone({ type: 'triangle', f: 1800, f1: 1500, glide: 0.02, at: t + 0.035, dur: 0.04, gain: 0.05 });
    this.tone({ type: 'sine', f: 4200, at: t + 0.035, dur: 0.05, gain: 0.02 });
  }

  /** A bonus stat is rerolled: a slot-machine whirr (a ratchet spinning fast and slowing down over a buzzing reel),
   *  ending on a ding. */
  reroll(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const len = 0.55;
    const times: number[] = [];
    for (let x = 0; x < len; ) {
      times.push(t + x);
      const k = x / len;
      x += 0.022 + 0.07 * k * k;
    }
    this.ticks(times, { gain: 0.2, f: 2600, q: 4, ms: 5 });
    this.voice({ at: t, type: 'sawtooth', f: [[0, 260], [len, 150]], vib: { rate: 22, cents: 60, rate1: 8 }, filter: 'bandpass', ff: [[0, 1400], [len, 700]], q: 2, amp: [[0.05, 0.07], [len * 0.7, 0.05], [len, 0]] });
    this.voice({ at: t, type: 'noise', filter: 'bandpass', ff: [[0, 3000], [len, 1500]], q: 1.2, trem: { rate: 30, depth: 0.6, rate1: 10 }, amp: [[0.05, 0.05], [len, 0]] });
    const s = t + len + 0.02;
    this.tone({ type: 'square', f: hz(84), at: s, dur: 0.06, gain: 0.03 });
    this.bell(hz(84), s, 0.09, 0.4);
    this.tone({ type: 'sine', f: hz(91), at: s + 0.06, dur: 0.3, gain: 0.06, rev: 0.4 });
  }

  /** A piece of gear's unique effect kicks in mid-fight: a short magical glint (a rising fifth over a trembling
   *  shimmer; `k` 0..1 makes it brighter for the big ones). Quiet, so it never covers the hits. */
  gearProc(k = 0.5, at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    const m = 88 + Math.round(k * 4);
    this.tone({ type: 'sine', f: hz(m), at: t, dur: 0.16, gain: 0.07, rev: 0.4 });
    this.tone({ type: 'sine', f: hz(m + 7), at: t + 0.05, dur: 0.24, gain: 0.06, rev: 0.45 });
    this.tone({ type: 'square', f: hz(m + 7), at: t + 0.05, dur: 0.03, gain: 0.012 });
    this.voice({ at: t, type: 'noise', filter: 'highpass', ff: [[0, 6500]], trem: { rate: 20, depth: 0.6 }, amp: [[0.05, 0.03 + 0.03 * k], [0.3, 0]] });
  }

  /** The Pendulum Shard spawns a green block: a brass tick and tock. */
  tickTock(at?: number): void {
    if (!this.ready) return;
    const t = this.now(at);
    for (const [d, f] of [
      [0, 2400],
      [0.16, 1800],
    ] as const) {
      this.ticks([t + d], { gain: 0.3, f, q: 6, ms: 10 });
      this.tone({ type: 'sine', f: f * 0.5, at: t + d, attack: 0.001, dur: 0.12, gain: 0.06, rev: 0.3 });
      this.tone({ type: 'sine', f: f * 1.38, at: t + d, attack: 0.001, dur: 0.06, gain: 0.03 });
    }
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

  /** Starts the music (idempotent; does nothing while musicOn is false, unless the Sound lab is auditioning).
   *  Notes are only scheduled while the context is running, unmuted and the page is visible. */
  startMusic(): void {
    this.musicManaged = true;
    if ((!this.musicOn && !this.lab) || this.musicTimer !== null || this.offline) return;
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
    const bus = this.band.bus;
    if (!bus) return;
    if (this.ctx) this.fade(bus, 0, 0.12);
    this.band.stop(300);
  }

  setMusicOn(on: boolean): void {
    this.musicOn = on;
    if (on) this.startMusic();
    else if (!this.lab) this.stopMusic();
  }

  /** The piece to play: the title, the camp, an act's theme (calm, or intense in its fights) or a boss's theme.
   *  An act's theme moves between its arrangements from the next beat, crossfading (tuning.music.crossfade);
   *  another piece starts from its top on the next beat while the last one rings out. */
  setMusic(track: MusicTrack, intense: boolean): void {
    this.game.track = track;
    this.game.intense = intense;
    if (!this.lab) this.band.setMusic(track, intense);
  }

  /** The combo now: in a fight, the drums, bass and lead join as it climbs (tuning.music) and drop on a break. */
  setCombo(combo: number): void {
    this.game.combo = combo;
    if (!this.lab) this.band.setCombo(combo);
  }

  /** Ms until the music's next beat (a layer asked for now joins there); 0 when the music isn't playing. */
  msToNextBeat(): number {
    const ctx = this.ctx;
    if (!ctx || !this.musicOn || this._muted || ctx.state !== 'running') return 0;
    const at = this.band.nextBeatAt();
    return at === null ? 0 : Math.max(0, (at - ctx.currentTime) * 1000);
  }

  /** The Boar King's phase (1-3): his theme adds layers, and goes up a key in phase 3 (from the next bar). */
  setBossPhase(phase: number): void {
    this.game.phase = phase;
    if (!this.lab) this.band.setBossPhase(phase);
  }

  /** Sound lab: play this piece (at this combo and boss phase) instead of the game's, until `audition(null)` hands
   *  the music back. Plays even with the music switched off. */
  audition(track: MusicTrack | null, o: { intense?: boolean; combo?: number; phase?: number } = {}): void {
    if (!track) {
      if (!this.lab) return;
      this.lab = null;
      this.applyMusic(this.game);
      if (!this.musicOn) this.stopMusic();
      return;
    }
    this.lab = { track, intense: o.intense ?? false, combo: o.combo ?? 0, phase: o.phase ?? 1 };
    this.applyMusic(this.lab);
    this.startMusic();
  }

  get auditioning(): boolean {
    return !!this.lab;
  }

  private applyMusic(m: MusicState): void {
    this.band.setMusic(m.track, m.intense);
    this.band.setCombo(m.combo);
    this.band.setBossPhase(m.phase);
  }

  /** The piece playing (or about to). */
  get currentTrack(): MusicTrack {
    return this.band.track;
  }

  /** The piece, calm or intense, the fight layers sounding now and its key (semitones up; debug readouts, tests). */
  get currentMusic(): { track: MusicTrack; arrangement: string; layers: string[]; key: number } {
    return { track: this.band.track, arrangement: this.band.arrangement, layers: this.band.layers, key: this.band.key };
  }

  /** Schedule `steps` 16th notes of a piece from ctx time `at` (tests render the music this way), optionally at a
   *  combo and boss phase, from a step of the loop, with scripted changes on the way (`o.cues`). */
  scheduleMusic(at: number, steps: number, track: MusicTrack = 'title', o: MusicRender = {}): void {
    if (!this.ctx || !this.graph) return;
    this.band.render(at, steps, track, o, this.musicLevel);
  }

  private fade(bus: GainNode, target: number, time: number): void {
    const t = this.ctx!.currentTime;
    const p = bus.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(target, t + time);
  }

  private readonly tick = (): void => {
    const ctx = this.ctx;
    if (!ctx || !this.graph || ctx.state !== 'running' || this._muted || (typeof document !== 'undefined' && document.hidden)) {
      this.musicResync = true;
      return;
    }
    const band = this.band;
    if (!band.rig) {
      band.start(this.musicLevel);
      this.musicLevelSet = this.musicLevel;
    }
    const bus = band.rig!.bus;
    const now = ctx.currentTime;
    if (now < this.duckUntil) {
      if (!this.musicDucked) this.fade(bus, 0, 0.08);
      this.musicDucked = true;
      this.musicResync = true;
      return;
    }
    if (this.musicDucked) {
      this.fade(bus, this.musicLevel, 0.3);
      this.musicDucked = false;
      this.musicLevelSet = this.musicLevel;
    } else if (this.musicLevel !== this.musicLevelSet && now > this.impactDuckUntil) {
      // the music volume slider moved
      this.fade(bus, this.musicLevel, 0.1);
      this.musicLevelSet = this.musicLevel;
    }
    if (this.musicResync || band.next < now) {
      band.next = now + 0.03;
      this.musicResync = false;
    }
    band.advance(now + LOOKAHEAD);
  };

  /** An oscillator of any of the synth's waves (pulses come from the precomputed periodic waves). */
  private osc(type: Wave, f: number): OscillatorNode {
    const o = this.ctx!.createOscillator();
    if (type === 'pulse25') o.setPeriodicWave(this.graph!.pulse25);
    else if (type === 'pulse12') o.setPeriodicWave(this.graph!.pulse12);
    else o.type = type;
    o.frequency.value = f;
    return o;
  }

  // ---------------------------------------------------------------- ambience

  /** The place's sound bed under the music; crossfades from the last one (null: none). It plays while the sound is
   *  on, the page is visible and the context runs (the music switch doesn't stop it). */
  setAmbience(name: Ambience | null): void {
    this.ambWant = name;
    this.startAmbience();
  }

  /** The ambience timer runs once there is a (real) context: from the first unlock on. */
  private startAmbience(): void {
    if (this.offline || !this.ctx) return;
    if (this.ambTimer === null) this.ambTimer = setInterval(this.ambTick, AMB_TICK_MS);
    this.ambTick();
  }

  get currentAmbience(): Ambience | null {
    return this.ambWant;
  }

  /** Schedule `seconds` of an ambience from ctx time `at`, fading out at the end (tests and the Sound lab). */
  scheduleAmbience(at: number, seconds: number, name: Ambience): void {
    if (!this.ctx || !this.graph) return;
    const r = this.buildAmb(name, at, 0.15);
    this.ambSchedule(r, at, at + seconds);
    this.endAmb(r, at + seconds - 0.4, 0.4);
  }

  private ensureAmbOut(): GainNode {
    if (!this.ambOut) {
      const ctx = this.ctx!;
      const gr = this.graph!;
      const out = ctx.createGain();
      out.gain.value = this.ambLevel;
      out.connect(gr.master);
      const rev = ctx.createGain();
      rev.gain.value = 0;
      out.connect(rev);
      rev.connect(gr.revIn);
      this.ambOut = out;
      this.ambRev = rev;
      this.ambLevelSet = this.ambLevel;
    }
    return this.ambOut;
  }

  private readonly ambTick = (): void => {
    const ctx = this.ctx;
    if (!ctx || !this.graph) return;
    const now = ctx.currentTime;
    // fade out while muted, hidden or calibrating (and before the context is unlocked)
    const live = ctx.state === 'running' && !this._muted && !(typeof document !== 'undefined' && document.hidden) && now >= this.duckUntil;
    const want = live ? this.ambWant : null;
    if (this.amb && this.amb.name !== want) {
      this.endAmb(this.amb, now, AMB_FADE_OUT);
      this.amb = null;
    }
    if (!want) return;
    const out = this.ensureAmbOut();
    if (this.ambLevel !== this.ambLevelSet && now > this.impactDuckUntil) {
      // the music volume slider moved
      out.gain.setTargetAtTime(this.ambLevel, now, 0.1);
      this.ambLevelSet = this.ambLevel;
    }
    this.amb ??= this.buildAmb(want, now + 0.02, AMB_FADE_IN);
    this.ambSchedule(this.amb, now, now + AMB_LOOKAHEAD);
  };

  /** Build an ambience's beds and stereo spots, fading in from `t`. */
  private buildAmb(name: Ambience, t: number, fadeIn: number): AmbRig {
    const ctx = this.ctx!;
    const gr = this.graph!;
    gr.pink ??= pinkNoise(ctx, 6);
    const out = this.ensureAmbOut();
    const wet = this.ambRev!.gain;
    const v = wet.value;
    wet.cancelScheduledValues(t);
    wet.setValueAtTime(v, t);
    wet.linearRampToValueAtTime(AMB_WET[name], t + 0.5);
    const nodes: AudioNode[] = [];
    const fade = ctx.createGain();
    fade.gain.setValueAtTime(0, t);
    fade.gain.linearRampToValueAtTime(1, t + fadeIn);
    fade.connect(out);
    nodes.push(fade);
    const spots = SPOTS.map(([p, f]) => {
      const pan = ctx.createStereoPanner();
      pan.pan.value = p;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = f;
      lp.Q.value = 0.5;
      pan.connect(lp);
      lp.connect(fade);
      nodes.push(pan, lp);
      return pan;
    });
    const r: AmbRig = {
      name,
      fade,
      spots,
      echo: null,
      beds: [],
      nodes,
      srcs: [],
      events: this.ambEvents(name),
      next: new Map(),
      rand: mulberry(0xa3b1 + 7919 * this.ambStarts++ + 31 * AMBIENCES.indexOf(name)),
    };
    this.ambBeds(r, t);
    for (const [k, e] of Object.entries(r.events)) r.next.set(k, t + 0.2 + r.rand() * e.every[1] * 0.5);
    return r;
  }

  /** Play every event of the ambience that falls before `until` (ones that slipped before `from` are skipped). */
  private ambSchedule(r: AmbRig, from: number, until: number): void {
    for (const [k, e] of Object.entries(r.events)) {
      let at = r.next.get(k)!;
      while (at < until) {
        const extra = at >= from - 0.05 ? (e.play(r, at) ?? 0) : 0;
        at += extra + e.every[0] + r.rand() * (e.every[1] - e.every[0]);
      }
      r.next.set(k, at);
    }
  }

  /** Fade an ambience out from `t` over `time`, then stop its beds and tear it down. */
  private endAmb(r: AmbRig, t: number, time: number): void {
    const p = r.fade.gain;
    const v = this.offline ? 1 : p.value;
    p.cancelScheduledValues(t);
    p.setValueAtTime(v, t);
    p.linearRampToValueAtTime(0, t + time);
    for (const s of r.srcs) s.stop(t + time + 0.05);
    if (!this.offline) setTimeout(() => r.nodes.forEach((n) => n.disconnect()), (t + time - this.ctx!.currentTime) * 1000 + 600);
  }

  /** A looping layer of pink noise through a filter: wind, rain, fire, surf. Stereo (the noise's channels differ). */
  private bed(r: AmbRig, t: number, o: { type: BiquadFilterType; f: number; q?: number; g: number; gust?: [number, number]; sway?: [number, number]; tau?: number; rate?: number }): Bed {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.graph!.pink!;
    src.loop = true;
    src.playbackRate.value = o.rate ?? 1;
    const filter = ctx.createBiquadFilter();
    filter.type = o.type;
    filter.frequency.value = o.f;
    filter.Q.value = o.q ?? 0.7;
    const gain = ctx.createGain();
    gain.gain.value = o.g;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(r.fade);
    src.start(t, r.rand() * 5);
    r.srcs.push(src);
    r.nodes.push(src, filter, gain);
    const b: Bed = { filter, gain, g: o.g, f: o.f, gust: o.gust ?? [1, 1], sway: o.sway ?? [1, 1], tau: o.tau ?? 1, at: [o.g, o.f] };
    r.beds.push(b);
    return b;
  }

  /** Gusts: every bed (or just `only`) glides to a new level and brightness over its `tau` (at most 1.1 s, shorter
   *  than the time to the next gust, so each glide starts from where the last one ended). */
  private gust(r: AmbRig, t: number, only?: Bed): void {
    for (const b of only ? [only] : r.beds) {
      if (!only && b.tau < 0.1) continue; // a flickering bed has its own event (two would interleave their glides)
      const [g0, g1] = b.gust;
      const [s0, s1] = b.sway;
      const d = Math.min(b.tau, 1.1);
      if (g0 !== g1) {
        const g = b.g * (g0 + r.rand() * (g1 - g0));
        b.gain.gain.setValueAtTime(b.at[0], t);
        b.gain.gain.linearRampToValueAtTime(g, t + d);
        b.at[0] = g;
      }
      if (s0 !== s1) {
        const f = b.f * (s0 + r.rand() * (s1 - s0));
        b.filter.frequency.setValueAtTime(b.at[1], t);
        b.filter.frequency.exponentialRampToValueAtTime(f, t + d);
        b.at[1] = f;
      }
    }
  }

  private spot(r: AmbRig, from: readonly number[] = ALL_SPOTS): AudioNode {
    return r.spots[from[Math.floor(r.rand() * from.length)]];
  }

  private ambBeds(r: AmbRig, t: number): void {
    switch (r.name) {
      case 'forest':
        this.bed(r, t, { type: 'bandpass', f: 1300, q: 0.5, g: 0.05, gust: [0.35, 1.6], sway: [0.7, 1.5], tau: 0.9 }); // wind in the grass
        this.bed(r, t, { type: 'lowpass', f: 320, q: 0.5, g: 0.1, gust: [0.5, 1.4], sway: [0.8, 1.3], tau: 1.5 }); // the wind's body
        this.bed(r, t, { type: 'highpass', f: 5000, q: 0.5, g: 0.012, gust: [0.3, 1.8], tau: 0.7 }); // leaves high in the canopy
        break;
      case 'ruins':
        this.bed(r, t, { type: 'bandpass', f: 430, q: 5, g: 0.16, gust: [0.35, 1.5], sway: [0.75, 1.35], tau: 2.2 }); // wind moaning in the arches
        this.bed(r, t, { type: 'bandpass', f: 1150, q: 9, g: 0.08, gust: [0.1, 1.4], sway: [0.85, 1.2], tau: 1.6 }); // a whistle through a crack
        this.bed(r, t, { type: 'bandpass', f: 4200, q: 0.6, g: 0.02, gust: [0.8, 1.2], tau: 2 }); // soft rain on stone
        this.bed(r, t, { type: 'lowpass', f: 150, q: 0.5, g: 0.1, gust: [0.7, 1.3], tau: 3 }); // the hall's low room tone
        r.echo = this.caveEcho(r);
        break;
      case 'hollow':
        this.bed(r, t, { type: 'lowpass', f: 260, q: 0.5, g: 0.09, gust: [0.5, 1.5], sway: [0.8, 1.3], tau: 1.8 }); // low wind
        this.bed(r, t, { type: 'bandpass', f: 380, q: 0.8, g: 0.03, gust: [0.55, 1.4], tau: 0.07 }); // the torches' roar (flickers)
        this.bed(r, t, { type: 'highpass', f: 3000, q: 0.5, g: 0.006, gust: [0.5, 1.5], tau: 1 }); // air in the leaves
        break;
      case 'map':
        this.bed(r, t, { type: 'bandpass', f: 850, q: 0.5, g: 0.035, gust: [0.3, 1.7], sway: [0.7, 1.4], tau: 1.2 }); // a breeze
        this.bed(r, t, { type: 'lowpass', f: 300, q: 0.5, g: 0.05, gust: [0.6, 1.4], tau: 2 });
        break;
      case 'world':
        this.bed(r, t, { type: 'lowpass', f: 420, q: 0.5, g: 0.06, gust: [0.7, 1.3], tau: 2.5 }); // the sea's low roar
        this.bed(r, t, { type: 'bandpass', f: 1100, q: 0.4, g: 0.025, gust: [0.3, 1.7], sway: [0.7, 1.4], tau: 1.2 }); // breeze off the sea
        break;
      case 'camp':
        this.bed(r, t, { type: 'bandpass', f: 320, q: 0.9, g: 0.05, gust: [0.6, 1.35], sway: [0.85, 1.25], tau: 0.06 }); // the campfire's roar (flickers)
        this.bed(r, t, { type: 'lowpass', f: 180, q: 0.5, g: 0.06, gust: [0.7, 1.3], tau: 2.4 }); // the night's low hush
        this.bed(r, t, { type: 'bandpass', f: 900, q: 0.45, g: 0.022, gust: [0.25, 1.6], sway: [0.75, 1.4], tau: 1.4 }); // a soft breeze in the trees
        break;
      case 'pass':
        this.bed(r, t, { type: 'bandpass', f: 650, q: 0.7, g: 0.05, gust: [0.3, 1.7], sway: [0.7, 1.6], tau: 1 }); // wind down the pass
        this.bed(r, t, { type: 'bandpass', f: 1700, q: 7, g: 0.03, gust: [0.1, 1.5], sway: [0.8, 1.3], tau: 0.9 }); // whistling over the ridge
        this.bed(r, t, { type: 'lowpass', f: 220, q: 0.5, g: 0.08, gust: [0.6, 1.4], tau: 2 }); // the wind's low body
        this.bed(r, t, { type: 'highpass', f: 6000, q: 0.5, g: 0.008, gust: [0.4, 1.8], tau: 0.8 }); // snow hissing past
        break;
      case 'caves':
        this.bed(r, t, { type: 'lowpass', f: 110, q: 0.7, g: 0.042, gust: [0.8, 1.2], tau: 3 }); // the depths breathing
        this.bed(r, t, { type: 'bandpass', f: 160, q: 9, g: 0.038, gust: [0.6, 1.3], sway: [0.96, 1.04], tau: 3 }); // the cave's resonance
        this.bed(r, t, { type: 'highpass', f: 3500, q: 0.5, g: 0.005, gust: [0.6, 1.4], tau: 2 }); // cold air
        this.hum(r, t, 55, 0.018); // a deep hum, beating slowly against its octave
        r.echo = this.caveEcho(r);
        break;
      case 'glacier':
        this.bed(r, t, { type: 'bandpass', f: 520, q: 6, g: 0.11, gust: [0.25, 1.6], sway: [0.6, 1.8], tau: 1.1 }); // the gale moaning over the ice
        this.bed(r, t, { type: 'bandpass', f: 900, q: 0.6, g: 0.04, gust: [0.4, 1.6], sway: [0.7, 1.4], tau: 0.9 }); // its breadth
        this.bed(r, t, { type: 'lowpass', f: 180, q: 0.5, g: 0.065, gust: [0.6, 1.5], tau: 1.8 }); // its low roar
        this.bed(r, t, { type: 'highpass', f: 5000, q: 0.5, g: 0.01, gust: [0.3, 1.9], tau: 0.7 }); // blowing snow
        break;
    }
  }

  /** A held low hum (the caves): a sine and its octave a little sharp (so they beat slowly), one to each side; it
   *  stops with the beds. */
  private hum(r: AmbRig, t: number, f: number, g: number): void {
    const ctx = this.ctx!;
    for (const [k, v, p] of [
      [1, 1, -0.5],
      [2.006, 0.45, 0.5],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = f * k;
      const lv = ctx.createGain();
      lv.gain.value = g * v;
      const pan = ctx.createStereoPanner();
      pan.pan.value = p;
      o.connect(lv);
      lv.connect(pan);
      pan.connect(r.fade);
      o.start(t);
      r.srcs.push(o);
      r.nodes.push(o, lv, pan);
    }
  }

  /** The ruins' drips: dry from one leak on the right, and through a dark cave echo answering from the left. */
  private caveEcho(r: AmbRig): AudioNode {
    const ctx = this.ctx!;
    const input = ctx.createGain();
    input.connect(r.spots[3]);
    const dl = ctx.createDelay(1);
    dl.delayTime.value = 0.29;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    const fb = ctx.createGain();
    fb.gain.value = 0.45;
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    input.connect(dl);
    dl.connect(lp);
    lp.connect(fb);
    fb.connect(dl);
    lp.connect(wet);
    wet.connect(r.spots[0]);
    r.nodes.push(input, dl, lp, fb, wet);
    return input;
  }

  private ambEvents(name: Ambience): Record<string, AmbEvent> {
    const gust: AmbEvent = { every: [1.2, 3.5], play: (r, t) => this.gust(r, t) };
    switch (name) {
      case 'forest':
        return {
          gust,
          bird: { every: [1.2, 4.5], play: (r, t) => this.birdCall(r, t, 1) },
          rustle: { every: [3, 8], play: (r, t) => this.rustle(r, t, 1) },
          peck: { every: [16, 36], play: (r, t) => this.woodpecker(r, t) },
        };
      case 'ruins':
        return {
          gust,
          drip: { every: [0.6, 2.4], play: (r, t) => this.drip(r, t) },
          patter: { every: [0.2, 0.6], play: (r, t) => this.patter(r, t) },
          creak: { every: [9, 20], play: (r, t) => this.creak(r, t) },
          pebbles: { every: [14, 30], play: (r, t) => this.pebbles(r, t) },
        };
      case 'hollow':
        return {
          gust,
          flicker: { every: [0.08, 0.25], play: (r, t) => this.gust(r, t, r.beds[1]) },
          cricket1: { every: [0.4, 2.5], play: (r, t) => this.cricket(r, t, 0) },
          cricket2: { every: [0.8, 3.5], play: (r, t) => this.cricket(r, t, 1) },
          cricket3: { every: [2, 6], play: (r, t) => this.cricket(r, t, 2) },
          crackle: { every: [0.2, 0.8], play: (r, t) => this.crackle(r, t) },
          pop: { every: [3, 9], play: (r, t) => this.firePop(r, t) },
          owl: { every: [12, 26], play: (r, t) => this.owl(r, t) },
        };
      case 'map':
        return {
          gust,
          bird: { every: [5, 12], play: (r, t) => this.birdCall(r, t, 0.85) },
          rustle: { every: [6, 14], play: (r, t) => this.rustle(r, t, 0.5) },
        };
      case 'world':
        return {
          gust,
          wave: { every: [3.2, 5.8], play: (r, t) => this.wave(r, t) },
          gull: { every: [4, 11], play: (r, t) => this.gulls(r, t) },
        };
      case 'camp':
        return {
          gust,
          flicker: { every: [0.07, 0.22], play: (r, t) => this.gust(r, t, r.beds[0]) },
          crackle: { every: [0.15, 0.6], play: (r, t) => this.campCrackle(r, t) },
          pop: { every: [2.5, 7], play: (r, t) => this.firePop(r, t) },
          settle: { every: [12, 26], play: (r, t) => this.logSettle(r, t) },
          cricket1: { every: [0.5, 2.8], play: (r, t) => this.cricket(r, t, 0) },
          cricket2: { every: [1, 4], play: (r, t) => this.cricket(r, t, 1) },
          cricket3: { every: [2.5, 7], play: (r, t) => this.cricket(r, t, 2) },
          rustle: { every: [7, 16], play: (r, t) => this.rustle(r, t, 0.45) },
          owl: { every: [16, 34], play: (r, t) => this.owl(r, t) },
        };
      case 'pass':
        return {
          gust,
          creak: { every: [2.5, 7], play: (r, t) => this.iceCreak(r, t) },
          flags: { every: [4, 10], play: (r, t) => this.flags(r, t) },
          flump: { every: [8, 18], play: (r, t) => this.snowFlump(r, t) },
        };
      case 'caves':
        return {
          gust: { every: [2.5, 6], play: (r, t) => this.gust(r, t) },
          drip: { every: [0.5, 2], play: (r, t) => this.drip(r, t, 0.75) },
          crystal: { every: [3, 8], play: (r, t) => this.crystal(r, t) },
          trickle: { every: [6, 14], play: (r, t) => this.trickle(r, t) },
          settle: { every: [10, 24], play: (r, t) => this.iceSettle(r, t) },
        };
      case 'glacier':
        return {
          gust: { every: [0.9, 2.5], play: (r, t) => this.gust(r, t) },
          howl: { every: [3.5, 8], play: (r, t) => this.howl(r, t) },
          crack: { every: [6, 14], play: (r, t) => this.iceCrack(r, t) },
          groan: { every: [9, 20], play: (r, t) => this.glacierGroan(r, t) },
        };
    }
  }

  /** Ice under strain (a frozen waterfall): a stick-slip creak sliding up, glassy and rasping, and a few sharp
   *  ticks as it gives a little. */
  private iceCreak(r: AmbRig, t: number): number {
    const d = 0.4 + r.rand() * 0.7;
    const out = this.spot(r, FAR_SPOTS);
    const f = 140 + r.rand() * 120;
    this.voice({ at: t, type: 'sawtooth', f: [[0, f], [d * 0.7, f * (1.3 + r.rand() * 0.5)], [d, f * 1.1]], trem: { rate: 22 + r.rand() * 18, depth: 0.9, wave: 'square' }, filter: 'bandpass', ff: [[0, 1400], [d, 2200]], q: 4, amp: [[d * 0.25, 0.05], [d * 0.8, 0.08], [d, 0]], out });
    this.ticks(
      Array.from({ length: 2 + Math.floor(r.rand() * 3) }, () => t + r.rand() * d),
      { gain: 0.08, f: 3200 + r.rand() * 1500, q: 2, ms: 5, out },
    );
    return d;
  }

  /** Prayer flags on a rope snapping in the wind: a burst of flapping cloth. */
  private flags(r: AmbRig, t: number): number {
    const d = 0.8 + r.rand() * 1.2;
    this.voice({ at: t, type: 'noise', buf: this.graph!.pink, filter: 'bandpass', ff: [[0, 900], [d, 1300]], q: 0.8, trem: { rate: 9 + r.rand() * 6, depth: 0.85, wave: 'square' }, amp: [[d * 0.3, 0.07], [d * 0.7, 0.05], [d, 0]], out: this.spot(r) });
    return d;
  }

  /** A load of snow slides off a pine bough and lands: a soft hiss, then a muffled thump. */
  private snowFlump(r: AmbRig, t: number): number {
    const out = this.spot(r, FAR_SPOTS);
    const d = 0.35 + r.rand() * 0.3;
    this.voice({ at: t, type: 'noise', buf: this.graph!.pink, filter: 'bandpass', ff: [[0, 2500], [d, 1200]], q: 0.7, amp: [[d * 0.6, 0.05], [d, 0]], out });
    this.tone({ type: 'sine', f: 90, f1: 55, glide: 0.12, at: t + d * 0.85, attack: 0.004, dur: 0.25, gain: 0.035, out });
    this.noise({ at: t + d * 0.85, dur: 0.18, gain: 0.03, filter: 'lowpass', f: 600, rate: 0.5, out });
    return d + 0.3;
  }

  /** Crystals in the cave walls ringing faintly: high glassy partials beating against each other, in the echo. */
  private crystal(r: AmbRig, t: number): number {
    const out = r.echo ?? this.spot(r, FAR_SPOTS);
    const f = 1800 + r.rand() * 1600;
    for (const [k, v] of [
      [1, 1],
      [1.0035, 0.8],
      [2.71, 0.3],
    ])
      this.tone({ type: 'sine', f: f * k, at: t, attack: 0.04, dur: 1.4, gain: 0.02 * v, out });
    return 1.4;
  }

  /** A trickle somewhere in the dark: a quick run of drops, falling in pitch. */
  private trickle(r: AmbRig, t: number): number {
    const out = r.echo ?? this.spot(r);
    const n = 4 + Math.floor(r.rand() * 5);
    let at = t;
    let f = 1600 + r.rand() * 800;
    for (let i = 0; i < n; i++) {
      this.tone({ type: 'sine', f, f1: f * 1.6, glide: 0.015, at, attack: 0.001, dur: 0.04, gain: 0.04, out });
      at += 0.06 + r.rand() * 0.07;
      f *= 0.9 + r.rand() * 0.06;
    }
    return at - t;
  }

  /** Far down a tunnel the ice settles: a soft crack and a dull knock, answering in the echo. */
  private iceSettle(r: AmbRig, t: number): number {
    const out = r.echo ?? this.spot(r, FAR_SPOTS);
    this.ticks([t, t + 0.015], { gain: 0.12, f: 1900 + r.rand() * 800, q: 1.5, ms: 9, out });
    this.tone({ type: 'triangle', f: 130, f1: 70, glide: 0.08, at: t + 0.01, dur: 0.16, gain: 0.08, out });
    return 0.3;
  }

  /** The wind howling over the ice: a long moan rising and falling (pink noise through a narrow band that slides). */
  private howl(r: AmbRig, t: number): number {
    const d = 1.6 + r.rand() * 1.6;
    const f = 380 + r.rand() * 260;
    this.voice({ at: t, type: 'noise', buf: this.graph!.pink, filter: 'bandpass', ff: [[0, f], [d * 0.45, f * 1.7], [d, f * 0.8]], q: 12, amp: [[d * 0.4, 0.32], [d * 0.7, 0.25], [d, 0]], out: this.spot(r, FAR_SPOTS) });
    return d;
  }

  /** Far off, the glacier cracks: a sharp report, a deep boom rolling after it, a scatter of falling ice. */
  private iceCrack(r: AmbRig, t: number): number {
    const out = this.spot(r, FAR_SPOTS);
    this.ticks([t, t + 0.012, t + 0.03], { gain: 0.07, f: 2400, q: 1, ms: 10, out });
    this.noise({ at: t, dur: 0.08, attack: 0.001, gain: 0.03, filter: 'highpass', f: 1800, out });
    this.tone({ type: 'sine', f: 70, f1: 38, glide: 0.5, at: t + 0.02, attack: 0.01, dur: 1.2, gain: 0.025, out });
    this.voice({ at: t + 0.05, type: 'noise', buf: this.graph!.pink, rate: 0.5, filter: 'lowpass', ff: [[0, 400], [1.4, 120]], q: 0.7, amp: [[0.15, 0.035], [1.4, 0]], out });
    this.ticks(
      Array.from({ length: 5 }, () => t + 0.25 + r.rand() * 0.8),
      { gain: 0.03, f: 3000 + r.rand() * 1500, q: 2, ms: 6, out },
    );
    return 1.4;
  }

  /** Deep in the glacier, ice grinds on rock: a very low, slow groan. */
  private glacierGroan(r: AmbRig, t: number): number {
    const d = 1.2 + r.rand() * 1.2;
    const out = this.spot(r, FAR_SPOTS);
    const f = 38 + r.rand() * 18;
    this.voice({ at: t, type: 'sawtooth', f: [[0, f], [d * 0.5, f * 1.25], [d, f * 0.85]], trem: { rate: 9 + r.rand() * 6, depth: 0.8, wave: 'sawtooth' }, filter: 'bandpass', ff: [[0, 380], [d, 520]], q: 4, amp: [[d * 0.35, 0.09], [d * 0.8, 0.1], [d, 0]], out });
    return d;
  }

  /** A run of short notes on one oscillator (birdsong, crickets, an owl): [start offset, length, from Hz, to Hz,
   *  level], one oscillator and one gain for the whole call. Returns how long it lasts. */
  private whistle(out: AudioNode, t: number, notes: [number, number, number, number, number][], attack = 0.012): number {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    osc.frequency.setValueAtTime(notes[0][2], t);
    let end = t;
    for (const [dt, len, f0, f1, v] of notes) {
      const s = Math.max(end, t + dt);
      osc.frequency.setValueAtTime(f0, s);
      osc.frequency.exponentialRampToValueAtTime(f1, s + len);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(v, s + Math.min(attack, len * 0.3));
      g.gain.linearRampToValueAtTime(v * 0.7, s + len * 0.6);
      g.gain.linearRampToValueAtTime(0, s + len);
      end = s + len;
    }
    osc.connect(g);
    g.connect(out);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
    osc.start(t);
    osc.stop(end + 0.02);
    return end - t;
  }

  /** A bird in the trees: a trill, a slow sliding whistle, a few quick chips or a soft dove further off; sometimes
   *  another answers from a different tree. `k` < 1: fewer, quieter and further away (the act map). */
  private birdCall(r: AmbRig, t: number, k: number): number {
    const rnd = r.rand;
    const out = this.spot(r, k < 1 ? FAR_SPOTS : ALL_SPOTS);
    const kind = Math.floor(rnd() * 4);
    const g = 0.03 * k;
    const notes: [number, number, number, number, number][] = [];
    if (kind === 0) {
      const f = 3200 + rnd() * 1500;
      const n = 5 + Math.floor(rnd() * 5);
      const st = 0.055 + rnd() * 0.02;
      for (let i = 0; i < n; i++) {
        const fi = f * (i % 2 ? 1.12 : 1);
        notes.push([i * st, st * 0.7, fi, fi * 1.18, g * (1 - i / (n * 1.6))]);
      }
    } else if (kind === 1) {
      const base = 1900 + rnd() * 900;
      let at = 0;
      for (let i = 0, n = 2 + Math.floor(rnd() * 3); i < n; i++) {
        const d = 0.12 + rnd() * 0.16;
        const f0 = base * (1 + (rnd() - 0.4) * 0.35);
        notes.push([at, d, f0, f0 * (0.8 + rnd() * 0.45), g * 0.9]);
        at += d + 0.06 + rnd() * 0.08;
      }
    } else if (kind === 2) {
      for (let i = 0, n = 2 + Math.floor(rnd() * 3); i < n; i++) notes.push([i * (0.09 + rnd() * 0.04), 0.04, 5200 - rnd() * 600, 2900, g]);
    } else {
      const f = 520 + rnd() * 90;
      for (const [dt, d, m, v] of [
        [0, 0.22, 1, 0.6],
        [0.32, 0.36, 1.08, 1],
        [0.78, 0.26, 0.96, 0.7],
      ])
        notes.push([dt, d, f * m, f * m * 0.94, g * 1.4 * v]);
    }
    const len = this.whistle(out, t, notes, kind === 3 ? 0.05 : 0.012);
    if (kind < 3 && rnd() < 0.3) {
      const k2 = 1.04 + rnd() * 0.08;
      this.whistle(this.spot(r, FAR_SPOTS), t + len + 0.3 + rnd() * 0.6, notes.map(([dt, d, f0, f1, v]): [number, number, number, number, number] => [dt, d, f0 * k2, f1 * k2, v * 0.7]));
    }
    return len;
  }

  /** Leaves stirred by the wind: a swell of airy noise and a few leaf crackles. */
  private rustle(r: AmbRig, t: number, k: number): number {
    const d = 0.5 + r.rand() * 0.9;
    const out = this.spot(r);
    this.voice({ at: t, type: 'noise', buf: this.graph!.pink, filter: 'bandpass', ff: [[0, 2600 + r.rand() * 1500], [d, 1800]], q: 0.9, trem: { rate: 7 + r.rand() * 6, depth: 0.6 }, amp: [[d * 0.35, 0.1 * k], [d, 0]], out });
    this.ticks(
      Array.from({ length: 4 + Math.floor(r.rand() * 6) }, () => t + r.rand() * d),
      { gain: 0.07 * k, f: 4500, q: 1.2, ms: 5, out },
    );
    return d;
  }

  private woodpecker(r: AmbRig, t: number): number {
    const n = 8 + Math.floor(r.rand() * 7);
    const gap = 1 / (14 + r.rand() * 5);
    this.ticks(
      Array.from({ length: n }, (_, i) => t + i * gap),
      { gain: 0.15, f: 1100 + r.rand() * 400, q: 5, ms: 9, out: this.spot(r, FAR_SPOTS) },
    );
    return n * gap;
  }

  /** A drop of water: a sine whose pitch flicks up as the bubble closes, ringing on in the cave echo (k: its level). */
  private drip(r: AmbRig, t: number, k = 1): void {
    const out = r.echo ?? this.spot(r);
    const drop = (at: number, f: number, v: number) => this.tone({ type: 'sine', f, f1: f * 1.9, glide: 0.02, at, attack: 0.0015, dur: 0.06, gain: v, out });
    const f = 900 + r.rand() * 1400;
    drop(t, f, (0.07 + r.rand() * 0.05) * k);
    if (r.rand() < 0.25) drop(t + 0.12 + r.rand() * 0.2, f * (0.85 + r.rand() * 0.3), 0.05 * k);
  }

  /** Rain spattering on the stones nearby: a handful of tiny ticks. */
  private patter(r: AmbRig, t: number): number {
    const d = 0.5;
    this.ticks(
      Array.from({ length: 3 + Math.floor(r.rand() * 6) }, () => t + r.rand() * d),
      { gain: 0.08, f: 3000 + r.rand() * 3000, q: 0.8, ms: 3, out: this.spot(r) },
    );
    return d;
  }

  /** Somewhere in the ruins a stone shifts: a slow grinding creak, far off. */
  private creak(r: AmbRig, t: number): number {
    const d = 0.8 + r.rand() * 0.9;
    const out = this.spot(r, FAR_SPOTS);
    const f = 55 + r.rand() * 30;
    this.voice({ at: t, type: 'sawtooth', f: [[0, f], [d * 0.6, f * 1.35], [d, f * 0.9]], trem: { rate: 16 + r.rand() * 10, depth: 0.85, wave: 'sawtooth' }, filter: 'bandpass', ff: [[0, 650], [d, 900]], q: 5, amp: [[d * 0.3, 0.14], [d * 0.8, 0.18], [d, 0]], out });
    this.voice({ at: t, type: 'noise', buf: this.graph!.pink, rate: 0.5, filter: 'bandpass', ff: [[0, 300], [d, 500]], q: 1.5, trem: { rate: 11, depth: 0.6 }, amp: [[d * 0.4, 0.07], [d, 0]], out });
    return d;
  }

  /** A few pebbles skittering down a wall, bouncing faster as they settle. */
  private pebbles(r: AmbRig, t: number): number {
    const times: number[] = [];
    let at = t;
    let gap = 0.13 + r.rand() * 0.05;
    for (let i = 0, n = 6 + Math.floor(r.rand() * 4); i < n; i++, gap *= 0.72) {
      times.push(at);
      at += gap;
    }
    this.ticks(times, { gain: 0.18, f: 2200 + r.rand() * 800, q: 3, ms: 8, out: this.spot(r, FAR_SPOTS) });
    return at - t;
  }

  /** One cricket's phrase: chirps of three or four quick pulses a few times a second, then it rests. */
  private cricket(r: AmbRig, t: number, i: number): number {
    const f = [4400, 4900, 5600][i];
    const pulses = 3 + (i % 2);
    const gap = 0.32 + 0.1 * i + r.rand() * 0.05;
    const v = i === 2 ? 0.022 : 0.036;
    const notes: [number, number, number, number, number][] = [];
    for (let c = 0, n = 3 + Math.floor(r.rand() * 6); c < n; c++) for (let p = 0; p < pulses; p++) notes.push([c * gap + p * 0.034, 0.02, f, f * 0.985, v]);
    return this.whistle(r.spots[[1, 4, 0][i]], t, notes, 0.005);
  }

  /** The torches crackling: a few sharp ticks from one of the two flames. */
  private crackle(r: AmbRig, t: number): number {
    const d = 0.6;
    this.ticks(
      Array.from({ length: 1 + Math.floor(r.rand() * 5) }, () => t + r.rand() * d),
      { gain: 0.18, f: 1800 + r.rand() * 2200, q: 1.2, ms: 4 + r.rand() * 4, out: r.spots[r.rand() < 0.5 ? 1 : 3] },
    );
    return d * 0.5;
  }

  /** A knot in the torch wood pops, throwing sparks. */
  private firePop(r: AmbRig, t: number): void {
    const out = r.spots[r.rand() < 0.5 ? 1 : 3];
    this.tone({ type: 'triangle', f: 240, f1: 110, glide: 0.03, at: t, dur: 0.05, gain: 0.12, out });
    this.noise({ at: t, dur: 0.035, gain: 0.2, filter: 'bandpass', f: 1600, q: 0.9, out });
    this.ticks(
      Array.from({ length: 3 }, (_, i) => t + 0.03 + i * 0.04 + r.rand() * 0.03),
      { gain: 0.1, f: 5000, q: 1.5, ms: 3, out },
    );
  }

  /** The campfire crackling, close by and in front: bursts of sharp and softer ticks spread across the flames. */
  private campCrackle(r: AmbRig, t: number): number {
    const d = 0.5;
    const out = r.spots[[1, 2, 3][Math.floor(r.rand() * 3)]];
    this.ticks(
      Array.from({ length: 1 + Math.floor(r.rand() * 6) }, () => t + r.rand() * d),
      { gain: 0.14 + r.rand() * 0.08, f: 1500 + r.rand() * 2800, q: 1.1, ms: 3 + r.rand() * 5, out },
    );
    return d * 0.4;
  }

  /** A log shifts in the fire: a soft wooden thump, a hiss of embers and a flurry of crackles. */
  private logSettle(r: AmbRig, t: number): number {
    const out = r.spots[2];
    this.tone({ type: 'triangle', f: 150, f1: 80, glide: 0.06, at: t, dur: 0.1, gain: 0.08, out });
    this.noise({ at: t, dur: 0.08, gain: 0.08, filter: 'lowpass', f: 700, rate: 0.6, out });
    this.voice({ at: t + 0.04, type: 'noise', buf: this.graph!.pink, filter: 'highpass', ff: [[0, 2500], [0.6, 4000]], amp: [[0.1, 0.05], [0.7, 0]], out });
    this.ticks(
      Array.from({ length: 6 + Math.floor(r.rand() * 5) }, () => t + 0.05 + r.rand() * 0.7),
      { gain: 0.12, f: 2400 + r.rand() * 2000, q: 1.3, ms: 4, out: r.spots[r.rand() < 0.5 ? 1 : 3] },
    );
    return 0.8;
  }

  /** An owl in the dark: "hoo ... hu-hu-hoooo", soft and far off. */
  private owl(r: AmbRig, t: number): number {
    const f = 360 + r.rand() * 50;
    const g = 0.045;
    return this.whistle(
      this.spot(r, FAR_SPOTS),
      t,
      [
        [0, 0.42, f, f * 0.93, g],
        [0.95, 0.14, f * 0.97, f * 0.95, g * 0.6],
        [1.2, 0.18, f, f * 0.96, g * 0.7],
        [1.5, 0.7, f * 1.02, f * 0.9, g],
      ],
      0.06,
    );
  }

  /** A wave rolls in, breaks and draws back, its foam fizzing (wide, not from one spot). */
  private wave(r: AmbRig, t: number): number {
    const pink = this.graph!.pink;
    const up = 1.4 + r.rand() * 0.8;
    const back = 2.2 + r.rand() * 1.2;
    const k = 0.7 + r.rand() * 0.5;
    this.voice({ at: t, type: 'noise', buf: pink, filter: 'lowpass', ff: [[0, 260], [up, 1300], [up + back, 300]], q: 0.4, amp: [[up * 0.7, 0.07 * k], [up, 0.11 * k], [up + back, 0]], out: r.fade });
    this.voice({ at: t + up * 0.85, type: 'noise', buf: pink, filter: 'highpass', ff: [[0, 2200], [back, 4500]], q: 0.5, amp: [[0.25, 0.035 * k], [back, 0]], out: r.fade });
    return up;
  }

  /** Gulls over the coast: one to four rough "kee-ow" cries, or a laughing run of short ones. */
  private gulls(r: AmbRig, t: number): number {
    const out = this.spot(r);
    const f = 1050 + r.rand() * 300;
    const laugh = r.rand() < 0.4;
    let at = t;
    for (let i = 0, n = 1 + Math.floor(r.rand() * 4); i < n; i++) {
      const d = laugh ? 0.12 : 0.28 + r.rand() * 0.12;
      const fi = f * (laugh ? 1 - i * 0.04 : 1 + (r.rand() - 0.5) * 0.1);
      this.voice({ at, type: 'sawtooth', f: [[0, fi * 0.8], [d * 0.25, fi * 1.45], [d, fi * 0.95]], vib: { rate: 28, cents: 30 }, filter: 'bandpass', ff: [[0, 1900]], q: 1.4, amp: [[d * 0.2, 0.045], [d * 0.7, 0.03], [d, 0]], out });
      at += d + (laugh ? 0.05 : 0.15 + r.rand() * 0.3);
    }
    return at - t;
  }
}

const AMB_PREVIEW = 8;
// (Region 2's places are named by act: the playtester opens the Sound lab)
const AMB_LABEL: Record<Ambience, string> = { forest: 'forest', ruins: 'ruins', hollow: 'hollow', map: 'act map', world: 'world map', camp: 'camp', pass: 'act 4', caves: 'act 5', glacier: 'act 6' };

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
  { id: 'whoosh', label: 'Screen whoosh', len: 0.6, play: (s, at) => s.whoosh(false, at) },
  { id: 'whooshBack', label: 'Screen whoosh (back)', len: 0.6, play: (s, at) => s.whoosh(true, at) },
  { id: 'panelOpen', label: 'Panel opens', len: 0.3, play: (s, at) => s.panelOpen(at) },
  { id: 'panelClose', label: 'Panel closes', len: 0.3, play: (s, at) => s.panelClose(at) },
  { id: 'footstep', label: 'Footstep', len: 0.2, play: (s, at) => s.footstep(0, at) },
  { id: 'footsteps', label: 'Footsteps (a walk)', len: 0.8, play: (s, at) => [0, 1, 2, 3].forEach((i) => s.footstep(i, at + i * 0.15)) },
  { id: 'coinTick', label: 'Coin counter', len: 0.8, play: (s, at) => [0, 1, 2, 3, 4, 5, 6, 7].forEach((i) => s.coinTick(i, at + i * 0.07)) },
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
  { id: 'sparklePop', label: 'Map: sparkle picked up', len: 0.6, play: (s, at) => s.sparklePop(at) },
  { id: 'critterFlutter', label: 'Map: critter startled (wings)', len: 0.5, play: (s, at) => s.critterFlutter(false, at) },
  { id: 'critterRustle', label: 'Map: critter startled (rustle)', len: 0.5, play: (s, at) => s.critterFlutter(true, at) },
  { id: 'critterChirp', label: 'Map: Pip chirps', len: 0.3, play: (s, at) => s.critterChirp(at) },
  { id: 'shopBuy', label: 'Shop: buy', len: 0.9, play: (s, at) => s.shopBuy(at) },
  { id: 'restHeal', label: 'Rest: campfire', len: 1.8, play: (s, at) => s.restHeal(at) },
  { id: 'eventSting', label: 'Event sting', len: 1.3, play: (s, at) => s.eventSting(at) },
  { id: 'textBlip', label: 'Dialogue blip', len: 0.15, play: (s, at) => s.textBlip(at) },
  { id: 'victory', label: 'Region cleared', len: 3.2, play: (s, at) => s.victory(at) },
  // gear: loot drops (one per rarity), the stings and reveal cards, the forge and the bag, gear effects in a fight
  ...['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'].map((name, r): SfxEntry => ({ id: `lootDrop${r}`, label: `Loot drop: ${name}`, len: 0.9, play: (s, at) => s.lootDrop(r, at) })),
  ...['Epic', 'Legendary', 'Mythic'].map((name, i): SfxEntry => ({ id: `lootSting${i + 3}`, label: `Loot sting: ${name}`, len: 1.6, play: (s, at) => s.lootSting(i + 3, at) })),
  { id: 'revealLegendary', label: 'Reveal card: Legendary', len: 2.6, play: (s, at) => s.legendaryReveal(false, at) },
  { id: 'revealMythic', label: 'Reveal card: Mythic', len: 3, play: (s, at) => s.legendaryReveal(true, at) },
  { id: 'forgeHammer', label: 'Forge: hammer', len: 1.2, play: (s, at) => s.forgeHammer(at) },
  { id: 'forgeUpgrade', label: 'Forge: upgrade', len: 1, play: (s, at) => s.forgeUpgrade(at) },
  { id: 'salvage', label: 'Salvage', len: 0.9, play: (s, at) => s.salvage(at) },
  { id: 'equip', label: 'Equip', len: 0.7, play: (s, at) => s.equip(at) },
  { id: 'lockToggle', label: 'Lock / unlock', len: 0.2, play: (s, at) => s.lockToggle(at) },
  { id: 'reroll', label: 'Forge: reroll', len: 1, play: (s, at) => s.reroll(at) },
  { id: 'gearProc', label: 'Gear effect kicks in', len: 0.5, play: (s, at) => s.gearProc(0.5, at) },
  { id: 'tickTock', label: 'Pendulum: tick, tock', len: 0.5, play: (s, at) => s.tickTock(at) },
  // the places' ambience beds (8 s of each, as it starts: the first bird, drip or wave comes within a second or two)
  ...AMBIENCES.map((a): SfxEntry => ({ id: `amb-${a}`, label: `Ambience: ${AMB_LABEL[a]} (8 s)`, len: AMB_PREVIEW, play: (s, at) => s.scheduleAmbience(at, AMB_PREVIEW, a) })),
];
