// Renders every sound effect (and the music) on an OfflineAudioContext and checks levels: no clipping,
// impacts at least as loud as all three themes (on phone speakers too), every impact tier heavier than the last,
// and every enemy telegraph clearly audible over the music, building toward its action and unlike the others.
import { OfflineAudioContext } from 'node-web-audio-api';
import { beforeAll, describe, expect, it } from 'vitest';
import { cloneTuning, type Tuning } from '../../src/core/tuning';
import { SFX, Synth, TELL_SOUNDS, type MusicTrack, type TellSound } from '../../src/engine/audio';
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
  return [buf.getChannelData(0), buf.getChannelData(1)];
}

async function render(play: Play, len: number, tune?: (t: Tuning) => void): Promise<Measure> {
  return measure(await renderRaw(play, len, tune), FS);
}

/** Seconds from the telegraph's start to the middle of its loudest (phone) window. */
const peakTime = (env: number[]) => (env.indexOf(Math.max(...env)) + 0.5) * ENV_WIN - AT;

const THEMES: Record<MusicTrack, { steps: number; bpm: number }> = {
  battle: { steps: 48, bpm: 130 },
  boss: { steps: 128, bpm: 150 },
  map: { steps: 128, bpm: 100 },
};
const THEME_NAMES = Object.keys(THEMES) as MusicTrack[];

const results = new Map<string, Measure>();
const themes = {} as Record<MusicTrack, Measure>;
const tells = new Map<TellSound, { env: number[]; spec: number[][] }>();

beforeAll(async () => {
  for (const e of SFX) {
    const ch = await renderRaw(e.play, e.len);
    results.set(e.id, measure(ch, FS));
    if (e.id.startsWith('tell-')) tells.set(e.id.slice(5) as TellSound, { env: envelope(ch, FS, ENV_WIN), spec: spectrogram(ch, FS, AT, AT + TELL_SEC + 0.2, 10, true) });
  }
  for (const name of THEME_NAMES) {
    const { steps, bpm } = THEMES[name];
    themes[name] = await render((s, at) => s.scheduleMusic(at, steps, name), steps * (60 / bpm / 4));
  }
  if (process.env.AUDIO_REPORT) {
    const row = (m: Measure) => [m.peak, m.loud, m.mean, m.energy, m.phoneLoud, m.phoneMean, m.phoneEnergy, m.lowEnergy].map((v) => v.toFixed(2).padStart(7)).join(' ');
    console.log(`${'sound'.padEnd(18)}    peak    loud    mean  energy  phLoud  phMean phEnerg   lowEn`);
    for (const e of SFX) console.log(`${e.id.padEnd(18)} ${row(results.get(e.id)!)}`);
    for (const name of THEME_NAMES) console.log(`${`${name} music`.padEnd(18)} ${row(themes[name])}`);
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

const MIN_TELL_DISTANCE = 6.5; // RMS dB over the phone spectrogram's cells (closest pair today: ~7.2)
