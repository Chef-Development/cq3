// Tiny Web Audio synth for placeholder sounds. Unlocked on the first user gesture.

type Ctx = AudioContext;

interface ToneOpts {
  type?: OscillatorType;
  f0: number;
  f1?: number;
  dur: number;
  gain?: number;
  delay?: number;
  attack?: number;
}

export class Synth {
  ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;
  ignoreSilentSwitch = true;

  private ensure(): Ctx | null {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      this.ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      return null;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    const len = Math.floor(this.ctx.sampleRate * 0.5);
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < len; i++) d[i] = ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
    return this.ctx;
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
      src.start(0);
    }
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

  private tone(o: ToneOpts): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    const peak = o.gain ?? 0.2;
    const a = o.attack ?? 0.002;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + o.dur + 0.02);
  }

  private noise(dur: number, gain: number, freq: number, type: BiquadFilterType = 'lowpass', delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  hit(combo: number, crit: boolean): void {
    if (!this.ready) return;
    const steps = Math.min(combo, 36) * 0.5; // half a semitone per combo hit
    const f = 330 * Math.pow(2, steps / 12);
    this.tone({ type: 'square', f0: f, f1: f * 0.7, dur: 0.07, gain: 0.12 });
    this.noise(0.04, 0.25, 3000, 'highpass');
    if (crit) this.tone({ type: 'sawtooth', f0: f * 2, f1: f, dur: 0.12, gain: 0.08 });
  }

  perfect(): void {
    if (!this.ready) return;
    this.tone({ type: 'sine', f0: 1320, dur: 0.12, gain: 0.12, delay: 0.01 });
    this.tone({ type: 'sine', f0: 1980, dur: 0.16, gain: 0.08, delay: 0.04 });
  }

  block(cracked: boolean): void {
    if (!this.ready) return;
    this.tone({ type: 'square', f0: cracked ? 700 : 1100, f1: cracked ? 500 : 800, dur: 0.08, gain: 0.1 });
    this.tone({ type: 'triangle', f0: 2400, f1: 2200, dur: 0.15, gain: 0.06 });
    this.noise(0.05, 0.3, 2500, 'bandpass');
  }

  miss(): void {
    if (!this.ready) return;
    this.tone({ type: 'sawtooth', f0: 150, f1: 80, dur: 0.14, gain: 0.12 });
  }

  hurt(): void {
    if (!this.ready) return;
    this.tone({ type: 'sine', f0: 160, f1: 50, dur: 0.18, gain: 0.3 });
    this.noise(0.12, 0.35, 600);
  }

  finisher(): void {
    if (!this.ready) return;
    this.tone({ type: 'sawtooth', f0: 180, f1: 1400, dur: 0.25, gain: 0.12 });
    this.tone({ type: 'square', f0: 90, f1: 40, dur: 0.4, gain: 0.2, delay: 0.05 });
    this.noise(0.45, 0.5, 1200, 'lowpass', 0.05);
  }

  windup(): void {
    if (!this.ready) return;
    this.tone({ type: 'triangle', f0: 260, f1: 520, dur: 0.16, gain: 0.07 });
  }

  explode(): void {
    if (!this.ready) return;
    this.noise(0.35, 0.6, 900);
    this.tone({ type: 'sine', f0: 120, f1: 40, dur: 0.3, gain: 0.3 });
  }

  ready2(): void {
    if (!this.ready) return;
    [660, 880, 1320].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: 0.07, gain: 0.07, delay: i * 0.05 }));
  }

  kill(): void {
    if (!this.ready) return;
    [523, 659, 784, 1046].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: 0.09, gain: 0.08, delay: i * 0.06 }));
  }

  /** Metronome click scheduled at an absolute AudioContext time. */
  clickAt(ctxTime: number, accent: boolean): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = accent ? 1600 : 1000;
    g.gain.setValueAtTime(0.0001, ctxTime);
    g.gain.exponentialRampToValueAtTime(0.35, ctxTime + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, ctxTime + 0.05);
    osc.connect(g).connect(this.master!);
    osc.start(ctxTime);
    osc.stop(ctxTime + 0.07);
  }
}
