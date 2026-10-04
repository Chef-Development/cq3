// Renders every sound effect (and the music, and the ambience beds) on an OfflineAudioContext and checks levels: no
// clipping, impacts at least as loud as all three themes (on phone speakers too, and with the ambience under them),
// every impact tier heavier than the last, every enemy telegraph clearly audible over the music, building toward its
// action and unlike the others, a band that is full (stereo, with low end) and ambience that sits under it all.
import { OfflineAudioContext } from 'node-web-audio-api';
import { beforeAll, describe, expect, it } from 'vitest';
import { cloneTuning, type Tuning } from '../../src/core/tuning';
import { AMBIENCES, SFX, Synth, TELL_SOUNDS, type Ambience, type MusicTrack, type TellSound } from '../../src/engine/audio';
import { BANDS, envelope, measure, seeded, spectralDistance, spectrogram, type Measure } from './loudness';

const FS = 44100;
const AT = 0.05;
const TELL_SEC = 0.8; // the SFX catalog plays every telegraph with this wind-up
const ENV_WIN = 0.05; // envelope window (s)

type Play = (s: Synth, at: number) => void;

async function renderRaw(play: Play, len: number, tune?: (t: Tuning) => void): Promise<Float32Array[]> {
  const t = cloneTuning();
  t.impact.variation = 0; // repeatable levels (variation is checked in impact.test.ts)
  tune?.(t);
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil((len + AT + 0.1) * FS), sampleRate: FS });
  const synth = new Synth({ ctx: ctx as unknown as BaseAudioContext, tuning: t, rand: seeded(7) });
  play(synth, AT);
  const buf = await ctx.startRendering();
  // copies: the renderer's buffers can be freed under a view that is kept past this point
  return [buf.getChannelData(0).slice(), buf.getChannelData(1).slice()];
}

async function render(play: Play, len: number, tune?: (t: Tuning) => void): Promise<Measure> {
  return measure(await renderRaw(play, len, tune), FS);
}

/** Seconds from the telegraph's start to the middle of its loudest (phone) window. */
const peakTime = (env: number[]) => (env.indexOf(Math.max(...env)) + 0.5) * ENV_WIN - AT;

/** Stereo width: side energy relative to mid energy (dB); -inf for mono. */
function width([l, r]: Float32Array[]): number {
  let mid = 0;
  let side = 0;
  for (let i = 0; i < l.length; i++) {
    mid += (l[i] + r[i]) ** 2;
    side += (l[i] - r[i]) ** 2;
  }
  return 10 * Math.log10(Math.max(side, 1e-12) / Math.max(mid, 1e-12));
}

/** Unweighted RMS level (dB) of consecutive `win`-second windows. */
function rmsEnvelope(channels: Float32Array[], win: number): number[] {
  const n = Math.round(FS * win);
  const out: number[] = [];
  for (let s = 0; s + n <= channels[0].length; s += n) {
    let e = 0;
    for (const ch of channels) for (let i = s; i < s + n; i++) e += ch[i] * ch[i];
    out.push(10 * Math.log10(Math.max(e / (n * channels.length), 1e-12)));
  }
  return out;
}

const THEMES: Record<MusicTrack, { steps: number; bpm: number }> = {
  battle: { steps: 48, bpm: 130 },
  boss: { steps: 128, bpm: 150 },
  map: { steps: 128, bpm: 100 },
};
const THEME_NAMES = Object.keys(THEMES) as MusicTrack[];

const results = new Map<string, Measure>();
const themes = {} as Record<MusicTrack, Measure>;
const themeWidth = {} as Record<MusicTrack, number>;
const ambRaw = new Map<Ambience, Float32Array[]>();
const tells = new Map<TellSound, { env: number[]; spec: number[][] }>();

beforeAll(async () => {
  for (const e of SFX) {
    const ch = await renderRaw(e.play, e.len);
    results.set(e.id, measure(ch, FS));
    if (e.id.startsWith('amb-')) ambRaw.set(e.id.slice(4) as Ambience, ch);
    if (e.id.startsWith('tell-')) tells.set(e.id.slice(5) as TellSound, { env: envelope(ch, FS, ENV_WIN), spec: spectrogram(ch, FS, AT, AT + TELL_SEC + 0.2, 10, true) });
  }
  for (const name of THEME_NAMES) {
    const { steps, bpm } = THEMES[name];
    const ch = await renderRaw((s, at) => s.scheduleMusic(at, steps, name), steps * (60 / bpm / 4));
    themes[name] = measure(ch, FS);
    themeWidth[name] = width(ch);
  }
  if (process.env.AUDIO_REPORT) {
    const row = (m: Measure) => [m.peak, m.loud, m.mean, m.energy, m.phoneLoud, m.phoneMean, m.phoneEnergy, m.lowEnergy].map((v) => v.toFixed(2).padStart(7)).join(' ');
    console.log(`${'sound'.padEnd(18)}    peak    loud    mean  energy  phLoud  phMean phEnerg   lowEn`);
    for (const e of SFX) console.log(`${e.id.padEnd(18)} ${row(results.get(e.id)!)}`);
    for (const name of THEME_NAMES) console.log(`${`${name} music`.padEnd(18)} ${row(themes[name])}  width ${themeWidth[name].toFixed(1)}`);
    // listen by numbers: each telegraph's spectrum on a phone speaker (dB per octave band, relative to its loudest
    // band), its phone envelope (one character per 50 ms, the action fires at |) and its nearest neighbour
    const spark = ' .:-=+*#%@';
    console.log(`\n${'telegraph'.padEnd(12)} ${BANDS.map((b) => `${b >= 1000 ? `${b / 1000}k` : b}`.padStart(5)).join('')}  peak@  envelope (50 ms steps)        nearest`);
    for (const k of TELL_SOUNDS) {
      const { env, spec } = tells.get(k)!;
      const bands = spec.map((r) => 10 * Math.log10(r.reduce((a, v) => a + 10 ** (v / 10), 0)));
      const top = Math.max(...bands);
      const max = Math.max(...env);
      const fire = Math.round((AT + TELL_SEC) / ENV_WIN);
      const line = env
        .slice(0, fire + 8)
        .map((v, i) => (i === fire ? '|' : spark[Math.max(0, Math.min(9, Math.round(9 + (v - max) / 3)))]))
        .join('');
      let near = '';
      let best = Infinity;
      for (const o of TELL_SOUNDS) {
        if (o === k) continue;
        const d = spectralDistance(spec, tells.get(o)!.spec);
        if (d < best) [best, near] = [d, o];
      }
      console.log(`${k.padEnd(12)} ${bands.map((b) => (b - top).toFixed(0).padStart(5)).join('')}  ${peakTime(env).toFixed(2)}  ${line.padEnd(28)}  ${near} ${best.toFixed(1)}`);
    }
  }
}, 180_000);

describe('rendered sound levels', () => {
  it('no sound clips, and every sound is audible', () => {
    for (const e of SFX) {
      const m = results.get(e.id)!;
      expect(m.peak, `${e.id} peak`).toBeLessThan(0.99);
      expect(m.peak, `${e.id} peak`).toBeGreaterThan(0.02);
    }
    for (const name of THEME_NAMES) {
      expect(themes[name].peak, `${name} music peak`).toBeLessThan(0.99);
      expect(themes[name].peak, `${name} music peak`).toBeGreaterThan(0.05);
    }
  });

  it('impacts are not quieter than any of the music themes, on phone speakers too', () => {
    for (const e of SFX.filter((x) => x.tier)) {
      const m = results.get(e.id)!;
      for (const name of THEME_NAMES) {
        expect(m.loud, `${e.id} loudness vs ${name} music`).toBeGreaterThanOrEqual(themes[name].loud);
        expect(m.phoneLoud, `${e.id} phone loudness vs ${name} music`).toBeGreaterThanOrEqual(themes[name].phoneLoud);
      }
    }
  });

  it('the map theme is calmer than the battle theme but still audible on phone speakers', () => {
    const map = themes.map;
    expect(map.loud).toBeLessThanOrEqual(themes.battle.loud - 1.5);
    expect(map.phoneMean).toBeGreaterThan(themes.battle.phoneMean - 6);
    expect(map.phoneLoud).toBeGreaterThan(-30);
  });

  it('impact loudness stays in a sane range (LUFS-style dB over 100 ms)', () => {
    for (const e of SFX.filter((x) => x.tier)) {
      const m = results.get(e.id)!;
      expect(m.loud, e.id).toBeGreaterThan(-24);
      expect(m.loud, e.id).toBeLessThan(-2);
    }
  });

  it('each tier is heavier than the last: hit < perfect < block < crit < bomb < finisher x1..x5 < kill < boss kill', () => {
    const order = ['hit', 'perfect', 'block', 'crit', 'bomb', 'finisher1', 'finisher2', 'finisher3', 'finisher4', 'finisher5', 'kill', 'bossKill'];
    for (let i = 1; i < order.length; i++) {
      const a = results.get(order[i - 1])!;
      const b = results.get(order[i])!;
      expect(b.energy, `${order[i]} > ${order[i - 1]} (energy)`).toBeGreaterThan(a.energy);
      expect(b.phoneEnergy, `${order[i]} > ${order[i - 1]} (phone energy)`).toBeGreaterThan(a.phoneEnergy);
    }
  });
});

describe('impact layers', () => {
  const crit = SFX.find((e) => e.id === 'crit')!;

  it('the saturated body carries the hit on phone speakers', async () => {
    const without = await render(crit.play, crit.len, (t) => (t.impact.body = 0));
    expect(results.get('crit')!.phoneEnergy - without.phoneEnergy).toBeGreaterThan(3);
  });

  it('the sub layer adds weight on headphones but almost nothing on phone speakers', async () => {
    const kill = SFX.find((e) => e.id === 'kill')!;
    const noSub = await render(kill.play, kill.len, (t) => (t.impact.sub = 0));
    const fullSub = results.get('kill')!; // default sub level
    expect(Math.abs(fullSub.phoneEnergy - noSub.phoneEnergy)).toBeLessThan(1);
    expect(fullSub.lowEnergy - noSub.lowEnergy).toBeGreaterThan(3);
  });

  it('layer sliders change the sound', async () => {
    const quiet = await render(crit.play, crit.len, (t) => {
      t.impact.crack = 0;
      t.impact.tail = 0;
    });
    expect(results.get('crit')!.energy).toBeGreaterThan(quiet.energy);
  });
});

describe('telegraphs', () => {
  it('every TellSound is in the Sound lab catalog (and no tell is an impact tier)', () => {
    expect(new Set(TELL_SOUNDS).size).toBe(16);
    for (const k of TELL_SOUNDS) {
      const e = SFX.find((x) => x.id === `tell-${k}`);
      expect(e, k).toBeDefined();
      expect(e!.tier, k).toBeUndefined();
    }
  });

  it('every telegraph is clearly audible over the music on phone speakers, and never clips', () => {
    for (const k of TELL_SOUNDS) {
      const m = results.get(`tell-${k}`)!;
      expect(m.peak, `${k} peak`).toBeLessThan(0.99);
      for (const name of ['battle', 'boss'] as const) {
        const mus = themes[name];
        // its loudest moment rises well above the music, and on average it sits above the music too
        expect(m.phoneLoud, `${k} phone loudness vs ${name} music`).toBeGreaterThanOrEqual(mus.phoneLoud + 3);
        expect(m.phoneMean, `${k} phone mean vs ${name} music`).toBeGreaterThanOrEqual(mus.phoneMean + 1);
      }
    }
  });

  it('telegraphs warn without drowning out the hits: under the heavy impacts', () => {
    for (const k of TELL_SOUNDS) {
      const m = results.get(`tell-${k}`)!;
      expect(m.loud, `${k} loudness vs kill`).toBeLessThan(results.get('kill')!.loud);
      expect(m.phoneLoud, `${k} phone loudness vs crit`).toBeLessThan(results.get('crit')!.phoneLoud + 2);
    }
  });

  it('every telegraph builds toward the moment the action fires, and is over soon after', () => {
    for (const k of TELL_SOUNDS) {
      const { env } = tells.get(k)!;
      const peak = peakTime(env);
      expect(peak, `${k} loudest moment (s)`).toBeGreaterThanOrEqual(0.45 * TELL_SEC);
      expect(peak, `${k} loudest moment (s)`).toBeLessThanOrEqual(TELL_SEC + 0.15);
      const after = env.slice(Math.ceil((AT + TELL_SEC + 0.45) / ENV_WIN));
      expect(Math.max(...after), `${k} 0.45 s after the action`).toBeLessThan(Math.max(...env) - 20);
    }
  });

  it('a telegraph stretches with its wind-up (0.6 s and 1.0 s)', async () => {
    for (const sec of [0.6, 1]) {
      for (const k of TELL_SOUNDS) {
        const env = envelope(await renderRaw((s, at) => s.telegraph(k, sec, at), sec + 0.6), FS, ENV_WIN);
        const peak = peakTime(env);
        expect(peak, `${k} at ${sec} s: loudest moment`).toBeGreaterThanOrEqual(0.45 * sec);
        expect(peak, `${k} at ${sec} s: loudest moment`).toBeLessThanOrEqual(sec + 0.15);
      }
    }
  });

  it('every telegraph sounds different from every other on a phone speaker (spectral shape and rhythm)', () => {
    for (let i = 0; i < TELL_SOUNDS.length; i++) {
      for (let j = i + 1; j < TELL_SOUNDS.length; j++) {
        const [a, b] = [TELL_SOUNDS[i], TELL_SOUNDS[j]];
        expect(spectralDistance(tells.get(a)!.spec, tells.get(b)!.spec), `${a} vs ${b}`).toBeGreaterThan(MIN_TELL_DISTANCE);
      }
    }
  });
});

describe('a fuller band', () => {
  it('every theme is in stereo (pad pairs, the arpeggio and hats to the sides, the ping-pong echo, the hall)', () => {
    for (const name of THEME_NAMES) expect(themeWidth[name], `${name} side vs mid (dB)`).toBeGreaterThan(-16);
  });

  it('every theme has weight: the sub bass and the kick carry real energy below 100 Hz', () => {
    for (const name of THEME_NAMES) expect(themes[name].lowEnergy - themes[name].energy, `${name} low-end share (dB)`).toBeGreaterThan(-5);
  });
});

describe('ambience', () => {
  /** The places, each with the music it plays under (fights, the map, the world map). */
  const UNDER: [Ambience, MusicTrack][] = [
    ['forest', 'battle'],
    ['ruins', 'battle'],
    ['hollow', 'boss'],
    ['map', 'map'],
    ['world', 'map'],
  ];

  it('every place has an ambience in the Sound lab catalog (and none is an impact tier)', () => {
    expect(AMBIENCES.length).toBe(5);
    for (const a of AMBIENCES) {
      const e = SFX.find((x) => x.id === `amb-${a}`);
      expect(e, a).toBeDefined();
      expect(e!.tier, a).toBeUndefined();
    }
  });

  it('each ambience sits well under every music theme, and far under the impacts', () => {
    for (const a of AMBIENCES) {
      const m = results.get(`amb-${a}`)!;
      for (const name of THEME_NAMES) {
        expect(m.loud, `${a} loudness vs ${name} music`).toBeLessThanOrEqual(themes[name].loud - 6);
        expect(m.mean, `${a} mean vs ${name} music`).toBeLessThanOrEqual(themes[name].mean - 8);
        expect(m.phoneLoud, `${a} phone loudness vs ${name} music`).toBeLessThanOrEqual(themes[name].phoneLoud - 4);
      }
      for (const e of SFX.filter((x) => x.tier)) {
        expect(results.get(e.id)!.loud, `${e.id} vs ${a}`).toBeGreaterThanOrEqual(m.loud + 10);
        expect(results.get(e.id)!.phoneLoud, `${e.id} phone vs ${a}`).toBeGreaterThanOrEqual(m.phoneLoud + 10);
      }
    }
  });

  it('is never empty: a continuous bed (no gaps), with events (birds, drips, crickets, waves) standing out of it', () => {
    for (const a of AMBIENCES) {
      const env = rmsEnvelope(ambRaw.get(a)!, 0.25).slice(2, -3); // past the fade-in, before the fade-out
      const sorted = [...env].sort((x, y) => x - y);
      const median = sorted[Math.floor(sorted.length / 2)];
      expect(Math.min(...env), `${a} quietest 250 ms vs its median (dB)`).toBeGreaterThan(median - 12);
      const m = results.get(`amb-${a}`)!;
      expect(m.loud - m.mean, `${a} events over the bed (dB)`).toBeGreaterThan(3);
      expect(width(ambRaw.get(a)!), `${a} stereo width (dB)`).toBeGreaterThan(-10);
    }
  });

  it('is seeded: the same place renders the same way every time', async () => {
    const play = (s: Synth, at: number) => s.scheduleAmbience(at, 3, 'forest');
    const [a, b] = [await renderRaw(play, 3), await renderRaw(play, 3)];
    expect(a[0].length).toBe(b[0].length);
    let diff = 0;
    for (let i = 0; i < a[0].length; i++) diff = Math.max(diff, Math.abs(a[0][i] - b[0][i]));
    expect(diff).toBe(0);
  });

  it('music and ambience together still sit under every impact, and the telegraphs still read over them', async () => {
    for (const [a, name] of UNDER) {
      const { steps, bpm } = THEMES[name];
      const len = steps * (60 / bpm / 4);
      const both = await render((s, at) => {
        s.scheduleMusic(at, steps, name);
        s.scheduleAmbience(at, len, a);
      }, len);
      expect(both.peak, `${name} + ${a} peak`).toBeLessThan(0.99);
      for (const e of SFX.filter((x) => x.tier)) {
        const m = results.get(e.id)!;
        expect(m.loud, `${e.id} vs ${name} music + ${a}`).toBeGreaterThanOrEqual(both.loud);
        expect(m.phoneLoud, `${e.id} phone vs ${name} music + ${a}`).toBeGreaterThanOrEqual(both.phoneLoud);
      }
      if (name === 'map') continue;
      for (const k of TELL_SOUNDS) {
        const m = results.get(`tell-${k}`)!;
        expect(m.phoneLoud, `${k} phone vs ${name} music + ${a}`).toBeGreaterThanOrEqual(both.phoneLoud + 3);
        expect(m.phoneMean, `${k} phone mean vs ${name} music + ${a}`).toBeGreaterThanOrEqual(both.phoneMean + 1);
      }
    }
  }, 60_000);
});

describe('UI and transition sounds', () => {
  it('are soft: audible, but well under the lightest impact', () => {
    for (const id of ['whoosh', 'whooshBack', 'panelOpen', 'panelClose', 'coinTick', 'footstep', 'footsteps']) {
      const m = results.get(id);
      expect(m, id).toBeDefined();
      expect(m!.loud, `${id} vs hit`).toBeLessThan(results.get('hit')!.loud - 3);
      expect(m!.phoneLoud, `${id} on a phone`).toBeGreaterThan(-45);
    }
  });

  it('footsteps vary: two steps of the same foot are never identical', async () => {
    const [ch] = await renderRaw((s, at) => {
      s.footstep(0, at);
      s.footstep(2, at + 0.5);
    }, 0.8);
    const n = Math.round(0.2 * FS);
    const a = ch.subarray(Math.round(AT * FS), Math.round(AT * FS) + n);
    const b = ch.subarray(Math.round((AT + 0.5) * FS), Math.round((AT + 0.5) * FS) + n);
    let diff = 0;
    for (let i = 0; i < n; i++) diff = Math.max(diff, Math.abs(a[i] - b[i]));
    expect(diff).toBeGreaterThan(0.01);
  });
});

const MIN_TELL_DISTANCE = 6.5; // RMS dB over the phone spectrogram's cells (closest pair today: ~7.2)
