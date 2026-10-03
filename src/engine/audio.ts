// Web Audio synth: every sound effect and the battle music are generated in code (no samples).
// Unlocked on the first user gesture.
//
// Graph:
//   sfx voices ----------------------------> master -> compressor -> destination
//   bell/finisher/kill voices -> reverb sends -> highpass -> convolver -> return -> master
//   crunchy voices -> drive -> waveshaper (soft clip + bit steps) -> lowpass -> master
//   music voices -> music bus (one per run, ~0.18) -> master
//   metronome -> click out -> destination (dry and uncompressed, so calibration timing stays exact)

type Ctx = AudioContext;
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
}

interface Graph {
  master: GainNode;
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
const MUSIC_LEVEL = 0.18;

// Hit melody: major pentatonic, wrapping up an octave every 5 combo steps.
const PENTA = [0, 2, 4, 7, 9];
const HIT_BASE = 523.25; // C5
const HIT_TOP = 13; // G7, ~2.6 octaves up; past it the blip trills between the top two notes

// ---- Music: original 8-bar loop in A minor, 130 BPM, 16th-note grid ----
const BPM = 130;
const STEP = 60 / BPM / 4;
const LOOP_STEPS = 8 * 16;
const LOOKAHEAD = 0.12;
const TICK_MS = 25;

const SONG: { root: number; arp: number[] }[] = [
  { root: 45, arp: [57, 60, 64, 69] }, // Am
  { root: 41, arp: [57, 60, 65, 69] }, // F
  { root: 48, arp: [55, 60, 64, 67] }, // C
  { root: 43, arp: [55, 59, 62, 67] }, // G
  { root: 45, arp: [57, 60, 64, 69] }, // Am
  { root: 41, arp: [57, 60, 65, 69] }, // F
  { root: 38, arp: [57, 62, 65, 69] }, // Dm
  { root: 40, arp: [56, 59, 64, 68] }, // E
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2];
type Note = [number, number] | null; // [semitones above root, length in steps]
const BASS: Note[] = [[0, 2], null, [0, 1], [12, 1], null, [0, 1], [12, 2], null, [0, 2], null, [0, 1], [12, 1], null, [0, 1], [12, 1], [7, 1]];
const BASS_TURN: Note[] = [...BASS.slice(0, 12), [0, 1], [2, 1], [4, 1], [7, 1]];
// Lead per bar: [step, midi, length in steps].
const LEAD: [number, number, number][][] = [
  [[0, 69, 3], [3, 72, 3], [6, 76, 2], [8, 81, 4], [12, 79, 2], [14, 76, 2]],
  [[0, 77, 3], [3, 76, 3], [6, 72, 2], [8, 69, 6], [14, 72, 2]],
  [[0, 79, 3], [3, 76, 3], [6, 72, 2], [8, 76, 2], [10, 79, 2], [12, 84, 4]],
  [[0, 83, 3], [3, 81, 3], [6, 79, 2], [8, 74, 6]],
  [[0, 69, 3], [3, 72, 3], [6, 76, 2], [8, 81, 2], [10, 83, 2], [12, 84, 4]],
  [[0, 81, 3], [3, 79, 3], [6, 77, 2], [8, 72, 4], [12, 77, 2], [14, 81, 2]],
  [[0, 81, 3], [3, 77, 3], [6, 74, 2], [8, 77, 2], [10, 81, 2], [12, 86, 4]],
  [[0, 83, 3], [3, 80, 3], [6, 76, 2], [8, 74, 2], [10, 76, 2], [12, 71, 2], [14, 68, 2]],
];
const LEAD_AT: Note[] = new Array<Note>(LOOP_STEPS).fill(null);
LEAD.forEach((bar, b) => bar.forEach(([s, m, len]) => (LEAD_AT[b * 16 + s] = [m, len])));

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

function impulse(ctx: Ctx, seconds: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const fadeIn = Math.floor(rate * 0.003);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3) * (i < fadeIn ? i / fadeIn : 1);
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

function buildGraph(ctx: Ctx, muted: boolean): Graph {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 6;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  comp.connect(ctx.destination);

  const master = ctx.createGain();
  master.gain.value = muted ? 0 : MASTER_LEVEL;
  master.connect(comp);

  const revIn = ctx.createBiquadFilter();
  revIn.type = 'highpass';
  revIn.frequency.value = 280;
  const conv = ctx.createConvolver();
  conv.buffer = impulse(ctx, 0.6);
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
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  return { master, revIn, crunch, click, noise, pulse25: pulseWave(ctx, 0.25), pulse12: pulseWave(ctx, 0.125), sends: new Map() };
}

export class Synth {
  ctx: Ctx | null = null;
  ignoreSilentSwitch = true;
  musicOn = true;
  private graph: Graph | null = null;
  private _muted = false;

  private rig: MusicRig | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicManaged = false; // startMusic/stopMusic was called: unlock() no longer auto-starts
  private musicStep = 0;
  private musicNext = 0;
  private musicResync = true;
  private musicDucked = false;
  private duckUntil = 0; // music stays silent while metronome clicks are scheduled

  get muted(): boolean {
    return this._muted;
  }

  set muted(v: boolean) {
    this._muted = v;
    const ctx = this.ctx;
    if (ctx && this.graph) this.graph.master.gain.setTargetAtTime(v ? 0 : MASTER_LEVEL, ctx.currentTime, 0.01);
  }

  private ensure(): Ctx | null {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    let ctx: Ctx;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      return null;
    }
    this.ctx = ctx;
    this.graph = buildGraph(ctx, this._muted);
    return ctx;
  }

  /** Call from user-gesture handlers (pointerdown/pointerup/touchend/keydown). Safe to call repeatedly. */
  unlock(): void {
    this.applySession();
    const ctx = this.ensure();
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
    const nav = navigator as unknown as { audioSession?: { type: string } };
    try {
      if (nav.audioSession) nav.audioSession.type = this.ignoreSilentSwitch ? 'playback' : 'ambient';
    } catch {
      /* not supported */
    }
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running' && !this.muted;
  }

  /** Output latency estimate in seconds (used by calibration to line clicks up with visuals). */
  get latency(): number {
    const c = this.ctx as (AudioContext & { outputLatency?: number }) | null;
    return c ? (c.outputLatency || 0) + (c.baseLatency || 0) : 0;
  }

  // ---------------------------------------------------------------- voices

  private env(peak: number, t: number, attack: number, hold: number, dur: number): { g: GainNode; end: number } {
    const g = this.ctx!.createGain();
    const a = Math.max(0.001, attack);
    const end = Math.max(t + dur, t + a + hold + 0.01);
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
    const { g, end } = this.env(o.gain, t, o.attack ?? 0.002, o.hold ?? 0, o.dur);
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
    const { g, end } = this.env(o.gain, t, o.attack ?? 0.001, o.hold ?? 0, o.dur);
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
    src.start(t, Math.random() * 0.9);
    src.stop(end + 0.02);
  }

  /** Inharmonic sine partials (glockenspiel-like) with reverb. */
  private bell(f: number, at: number, gain: number, rev: number): void {
    this.tone({ type: 'sine', f, at, dur: 0.5, gain, rev });
    this.tone({ type: 'sine', f: f * 2.76, at, dur: 0.22, gain: gain * 0.5, rev });
    this.tone({ type: 'sine', f: f * 5.4, at, dur: 0.09, gain: gain * 0.3, rev });
  }

  // ---------------------------------------------------------------- sfx

  hit(combo: number, crit: boolean): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    const crunch = this.graph!.crunch;
    const n = Math.max(0, Math.floor(combo) - 1);
    const idx = n <= HIT_TOP ? n : HIT_TOP - ((n - HIT_TOP) % 2);
    const f = HIT_BASE * Math.pow(2, (12 * Math.floor(idx / 5) + PENTA[idx % 5]) / 12);
    // Thwack: noise transient with the band sweeping down.
    this.noise({ at: t, dur: 0.08, gain: crit ? 0.72 : 0.62, filter: 'bandpass', f: 4200, f1: 650, sweep: 0.06, q: 1.3 });
    // Tonal blip climbing the scale with the combo (pulse is pulled back as it gets higher).
    this.tone({ type: 'pulse25', f, at: t, delay: 0.003, dur: 0.09, gain: 0.085 * (1 - idx / 32) });
    this.tone({ type: 'triangle', f, at: t, delay: 0.003, dur: 0.14, gain: 0.2 });
    if (crit) {
      this.tone({ type: 'sine', f: 170, f1: 36, glide: 0.15, at: t, dur: 0.22, gain: 0.75 });
      this.tone({ type: 'sawtooth', f: f / 2, f1: f / 4, glide: 0.12, at: t, dur: 0.15, gain: 0.3, out: crunch });
      this.noise({ at: t, dur: 0.12, gain: 0.4, filter: 'lowpass', f: 3000, f1: 700, out: crunch });
    } else {
      this.tone({ type: 'sine', f: 220, f1: 55, glide: 0.07, at: t, dur: 0.12, gain: 0.42 });
    }
  }

  perfect(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.bell(1567.98, t + 0.008, 0.13, 0.4); // G6
    this.bell(2349.32, t + 0.055, 0.08, 0.5); // D7
    this.noise({ at: t, dur: 0.05, gain: 0.08, filter: 'highpass', f: 7000 });
  }

  block(cracked: boolean): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    const v = 1 + (Math.random() - 0.5) * 0.03;
    if (!cracked) {
      const f = 640 * v;
      this.tone({ type: 'square', f, at: t, dur: 0.26, gain: 0.08, rev: 0.2 });
      this.tone({ type: 'triangle', f: f * 2.4, at: t, dur: 0.18, gain: 0.14, rev: 0.2 });
      this.tone({ type: 'triangle', f: f * 3.9, at: t, dur: 0.11, gain: 0.1, rev: 0.2 });
      this.tone({ type: 'square', f: f * 6.3, at: t, dur: 0.04, gain: 0.03 });
      this.noise({ at: t, dur: 0.06, gain: 0.4, filter: 'bandpass', f: 3400, q: 2.5 });
      this.tone({ type: 'sine', f: 260, f1: 110, glide: 0.06, at: t, dur: 0.08, gain: 0.35 });
    } else {
      const f = 400 * v;
      const crunch = this.graph!.crunch;
      this.tone({ type: 'square', f, f1: f * 0.94, at: t, dur: 0.14, gain: 0.07, out: crunch });
      this.tone({ type: 'triangle', f: f * 2.4, at: t, dur: 0.09, gain: 0.12 });
      this.tone({ type: 'triangle', f: f * 3.9, at: t, dur: 0.05, gain: 0.07 });
      this.noise({ at: t, dur: 0.1, gain: 0.45, filter: 'bandpass', f: 1300, f1: 700, q: 1.2 });
      this.noise({ at: t, dur: 0.07, gain: 0.25, filter: 'lowpass', f: 2200, out: crunch });
      this.tone({ type: 'sine', f: 200, f1: 70, glide: 0.08, at: t, dur: 0.11, gain: 0.45 });
    }
  }

  miss(): void {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
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

  hurt(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    const crunch = this.graph!.crunch;
    this.tone({ type: 'sine', f: 200, f1: 40, glide: 0.24, at: t, dur: 0.34, gain: 0.85 });
    this.tone({ type: 'square', f: 116, f1: 48, glide: 0.22, at: t, dur: 0.26, gain: 0.22, out: crunch });
    this.tone({ type: 'square', f: 164, f1: 68, glide: 0.22, at: t, dur: 0.22, gain: 0.14, out: crunch });
    this.noise({ at: t, dur: 0.26, gain: 0.55, filter: 'lowpass', f: 2600, f1: 280, sweep: 0.22, out: crunch });
    this.noise({ at: t, dur: 0.05, gain: 0.45, filter: 'bandpass', f: 1100, q: 0.9 });
  }

  finisher(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    const T = t + 0.25; // impact
    const crunch = this.graph!.crunch;
    // Rising whoosh.
    this.noise({ at: t, dur: 0.27, attack: 0.23, gain: 0.5, filter: 'bandpass', f: 260, f1: 5200, sweep: 0.25, q: 2.2 });
    this.tone({ type: 'sawtooth', f: 110, f1: 880, glide: 0.25, at: t, attack: 0.2, dur: 0.26, gain: 0.07 });
    // Boom.
    this.tone({ type: 'sine', f: 150, f1: 30, glide: 0.5, at: T, dur: 0.75, gain: 0.95 });
    this.noise({ at: T, dur: 0.5, gain: 0.7, filter: 'lowpass', f: 4500, f1: 300, sweep: 0.4, out: crunch });
    this.noise({ at: T, dur: 0.06, gain: 0.35, filter: 'highpass', f: 2500 });
    this.noise({ at: T, dur: 0.9, gain: 0.3, filter: 'lowpass', f: 900, f1: 120, rate: 0.5, rev: 0.4 });
    // Bright C major stab with reverb.
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone({ type: 'square', f, at: T, delay: 0.01, dur: 0.6, hold: 0.05, gain: 0.05, rev: 0.5, detune: i % 2 ? 6 : -6 }),
    );
    this.tone({ type: 'triangle', f: 261.63, at: T, dur: 0.6, hold: 0.05, gain: 0.2, rev: 0.3 });
    this.bell(2093, T + 0.04, 0.07, 0.6);
  }

  windup(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone({ type: 'triangle', f: 400, f1: 1200, glide: 0.11, at: t, attack: 0.025, dur: 0.13, gain: 0.1 });
    this.noise({ at: t, dur: 0.12, attack: 0.06, gain: 0.05, filter: 'bandpass', f: 1600, f1: 5000, q: 3 });
  }

  explode(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone({ type: 'sine', f: 120, f1: 28, glide: 0.45, at: t, dur: 0.6, gain: 0.85 });
    this.noise({ at: t, dur: 0.75, gain: 0.7, filter: 'lowpass', f: 2000, f1: 140, sweep: 0.6, rate: 0.6, rev: 0.25 });
    this.noise({ at: t, dur: 0.22, gain: 0.4, filter: 'lowpass', f: 4000, f1: 600, out: this.graph!.crunch });
    this.noise({ at: t, dur: 0.03, gain: 0.3, filter: 'highpass', f: 3000 });
  }

  /** Finisher meter just became full. */
  ready2(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    [1046.5, 1318.51, 1567.98].forEach((f, i) => {
      const at = t + i * 0.06;
      this.tone({ type: 'square', f, at, dur: 0.08, gain: 0.04 });
      this.tone({ type: 'sine', f, at, dur: i === 2 ? 0.5 : 0.25, gain: 0.12, rev: 0.35 });
    });
    this.tone({ type: 'sine', f: 3135.96, at: t + 0.15, dur: 0.3, gain: 0.04, rev: 0.5 });
  }

  kill(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
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

  /** Cursor got faster. */
  /** Coin pickup: a bright two-note ding. */
  coin(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone({ type: 'square', f: 1975.53, at: t, dur: 0.05, gain: 0.035 });
    this.tone({ type: 'square', f: 2637.02, at: t + 0.05, dur: 0.12, gain: 0.035 });
    this.tone({ type: 'sine', f: 2637.02, at: t + 0.05, dur: 0.18, gain: 0.05, rev: 0.25 });
  }

  /** Companion peck: a quick chirp. */
  pet(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone({ type: 'triangle', f: 1400, f1: 2400, at: t, dur: 0.06, gain: 0.08 });
    this.tone({ type: 'triangle', f: 1800, f1: 2800, at: t + 0.06, dur: 0.05, gain: 0.06 });
  }

  /** Heal: a soft rising sparkle. */
  heal(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    [784, 987.77, 1318.51].forEach((f, i) => this.tone({ type: 'sine', f, at: t + i * 0.05, dur: 0.22, gain: 0.07, rev: 0.4 }));
  }

  speedUp(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone({ type: 'pulse25', f: 300, f1: 1800, glide: 0.13, at: t, attack: 0.005, hold: 0.06, dur: 0.16, gain: 0.07 });
    this.tone({ type: 'triangle', f: 600, f1: 3600, glide: 0.13, at: t, hold: 0.06, dur: 0.16, gain: 0.07 });
    this.noise({ at: t, dur: 0.14, attack: 0.08, gain: 0.08, filter: 'bandpass', f: 1200, f1: 6000, q: 2 });
    this.tone({ type: 'sine', f: 1760, at: t, delay: 0.13, dur: 0.2, gain: 0.06, rev: 0.3 });
  }

  /** Soft UI tick. */
  uiClick(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone({ type: 'triangle', f: 2000, f1: 1300, glide: 0.025, at: t, dur: 0.035, gain: 0.07 });
    this.noise({ at: t, dur: 0.012, gain: 0.04, filter: 'highpass', f: 5000 });
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
    if (!this.musicOn || this.musicTimer !== null) return;
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

  private fade(bus: GainNode, target: number, time: number): void {
    const t = this.ctx!.currentTime;
    const p = bus.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(target, t + time);
  }

  private buildRig(ctx: Ctx): MusicRig {
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
    this.fade(bus, MUSIC_LEVEL, 0.06);
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
      this.fade(rig.bus, MUSIC_LEVEL, 0.3);
      this.musicDucked = false;
    }
    if (this.musicResync || this.musicNext < now) {
      this.musicNext = now + 0.03;
      this.musicResync = false;
    }
    while (this.musicNext < now + LOOKAHEAD) {
      this.playStep(rig, this.musicStep, this.musicNext);
      this.musicNext += STEP;
      this.musicStep = (this.musicStep + 1) % LOOP_STEPS;
    }
  };

  private playStep(rig: MusicRig, step: number, t: number): void {
    const bar = step >> 4;
    const s = step & 15;
    const chord = SONG[bar];

    const b = (bar === 7 ? BASS_TURN : BASS)[s];
    if (b) this.bassNote(rig, hz(chord.root + b[0]), t, b[1] * STEP * 0.92);

    this.tone({ type: 'pulse12', f: hz(chord.arp[ARP[s]]), at: t, dur: STEP * 0.85, gain: 0.3, out: rig.bus });

    const l = LEAD_AT[step];
    if (l) {
      const len = l[1] * STEP;
      this.tone({ type: 'pulse25', f: hz(l[0]), at: t, attack: 0.005, hold: len * 0.45, dur: len * 0.95, gain: 0.42, scoop: -30, out: rig.bus });
    }

    // Drums.
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
