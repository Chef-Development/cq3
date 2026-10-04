// Web Audio synth: every sound effect and the battle music are generated in code (no samples).
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

// ---- Music: two original 8-bar loops on a 16th-note grid. The battle theme, and a boss theme that takes over
// when a boss is on screen. ----
const LOOKAHEAD = 0.12;
const TICK_MS = 25;

type Note = [number, number] | null; // [semitones above root (bass) or midi (lead), length in steps]
export type MusicTrack = 'battle' | 'boss';

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
const TRACKS: Record<MusicTrack, Track> = { battle: BATTLE, boss: BOSS };
const LOOP_STEPS = 8 * 16;

const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

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
    const { g, end } = this.env(o.gain, t, o.attack ?? 0.002, o.hold ?? 0, o.dur, o.minTail);
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
    const { g, end } = this.env(o.gain, t, o.attack ?? 0.001, o.hold ?? 0, o.dur, o.minTail);
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

  /** Battle theme, or the boss theme while a boss is on screen. Takes over on the next beat. */
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
        // the boss arrives (or leaves): the other theme starts from its top, on the beat
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

  /** Triangle bass with a quiet square layer (so it reads on phone speakers), through the bass lowpass. */
  private bassNote(rig: MusicRig, f: number, t: number, dur: number): void {
    const ctx = this.ctx!;
    const tri = ctx.createOscillator();
    tri.type = 'triangle';
    tri.frequency.value = f;
    const sq = ctx.createOscillator();
    sq.type = 'square';
    sq.frequency.value = f;
    const sqLevel = ctx.createGain();
    sqLevel.gain.value = 0.35;
    const { g, end } = this.env(0.55, t, 0.004, dur * 0.5, dur);
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
  { id: 'jingle', label: 'Kill jingle', len: 1.5, play: (s, at) => s.kill(at) },
  { id: 'coin', label: 'Coin', len: 0.5, play: (s, at) => s.coin(at) },
  { id: 'statUp', label: 'Stat up', len: 0.4, play: (s, at) => s.statUp(0, at) },
  { id: 'heal', label: 'Heal', len: 0.7, play: (s, at) => s.heal(at) },
  { id: 'pet', label: 'Pip peck', len: 0.3, play: (s, at) => s.pet(at) },
  { id: 'ui', label: 'UI click', len: 0.2, play: (s, at) => s.uiClick(at) },
];
