// Renders every sound effect (and the music) on an OfflineAudioContext and checks levels: no clipping,
// impacts at least as loud as the music (on phone speakers too), and every impact tier heavier than the last.
import { OfflineAudioContext } from 'node-web-audio-api';
import { beforeAll, describe, expect, it } from 'vitest';
import { cloneTuning, type Tuning } from '../../src/core/tuning';
import { SFX, Synth } from '../../src/engine/audio';
import { measure, seeded, type Measure } from './loudness';

const FS = 44100;
const AT = 0.05;

async function render(play: (s: Synth, at: number) => void, len: number, tune?: (t: Tuning) => void): Promise<Measure> {
  const t = cloneTuning();
  t.impact.variation = 0; // repeatable levels (variation is checked in impact.test.ts)
  tune?.(t);
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil((len + AT + 0.1) * FS), sampleRate: FS });
  const synth = new Synth({ ctx: ctx as unknown as BaseAudioContext, tuning: t, rand: seeded(7) });
  play(synth, AT);
  const buf = await ctx.startRendering();
  return measure([buf.getChannelData(0), buf.getChannelData(1)], FS);
}

const results = new Map<string, Measure>();
let music: Measure;
let bossMusic: Measure;

beforeAll(async () => {
  for (const e of SFX) results.set(e.id, await render(e.play, e.len));
  music = await render((s, at) => s.scheduleMusic(at, 48), 48 * (60 / 130 / 4));
  bossMusic = await render((s, at) => s.scheduleMusic(at, 128, 'boss'), 128 * (60 / 150 / 4));
  if (process.env.AUDIO_REPORT) {
    const row = (m: Measure) => [m.peak, m.loud, m.mean, m.energy, m.phoneLoud, m.phoneMean, m.phoneEnergy, m.lowEnergy].map((v) => v.toFixed(2).padStart(7)).join(' ');
    console.log(`${'sound'.padEnd(16)}    peak    loud    mean  energy  phLoud  phMean phEnerg   lowEn`);
    for (const e of SFX) console.log(`${e.id.padEnd(16)} ${row(results.get(e.id)!)}`);
    console.log(`${'music'.padEnd(16)} ${row(music)}`);
    console.log(`${'boss music'.padEnd(16)} ${row(bossMusic)}`);
  }
}, 120_000);

describe('rendered sound levels', () => {
  it('no sound clips, and every sound is audible', () => {
    for (const e of SFX) {
      const m = results.get(e.id)!;
      expect(m.peak, `${e.id} peak`).toBeLessThan(0.99);
      expect(m.peak, `${e.id} peak`).toBeGreaterThan(0.02);
    }
    for (const m of [music, bossMusic]) {
      expect(m.peak).toBeLessThan(0.99);
      expect(m.peak).toBeGreaterThan(0.05);
    }
  });

  it('impacts are not quieter than the music, on phone speakers too', () => {
    for (const e of SFX.filter((x) => x.tier)) {
      const m = results.get(e.id)!;
      for (const [name, mus] of [
        ['music', music],
        ['boss music', bossMusic],
      ] as const) {
        expect(m.loud, `${e.id} loudness vs ${name}`).toBeGreaterThanOrEqual(mus.loud);
        expect(m.phoneLoud, `${e.id} phone loudness vs ${name}`).toBeGreaterThanOrEqual(mus.phoneLoud);
      }
    }
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
