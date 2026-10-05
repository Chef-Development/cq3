// Renders every sound effect (and every piece of music, and the ambience beds) on an OfflineAudioContext and checks
// levels: no clipping, impacts at least as loud as every piece (on phone speakers too, and with the ambience under
// them), every impact tier heavier than the last, every enemy telegraph clearly audible over the fight music,
// building toward its action and unlike the others, a band that is full (stereo, with low end) and ambience that
// sits under it all. The music: each piece is rendered across its loop point (its last bar into its first: the
// riser, the fill and the crash) in every arrangement, the fight ones at combo 0 (the base) and with every layer in.
import { OfflineAudioContext } from 'node-web-audio-api';
import { beforeAll, describe, expect, it } from 'vitest';
import { cloneTuning, type Tuning } from '../../src/core/tuning';
import { AMBIENCES, SFX, Synth, TELL_SOUNDS, type Ambience, type TellSound } from '../../src/engine/audio';
import { Band, midi, MUSIC_PIECES, MUSIC_TRACKS, SONGS, stepSec, type MusicPiece, type MusicRender, type MusicTrack } from '../../src/engine/music';
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

// ---- the music: every piece of the Sound lab, across its loop point ----

/** A render of a piece: `bars` bars from the start of its last bar (or two), at a combo. */
interface Cue {
  id: string;
  piece: MusicPiece;
  combo: number;
  full: boolean; // every layer in (a fight piece at a high combo, or the Boar King's last phase)
}
const FULL_COMBO = 999;
const CUES: Cue[] = MUSIC_PIECES.flatMap((p): Cue[] => {
  if (!p.intense) return [{ id: p.id, piece: p, combo: 0, full: false }];
  if (p.phase === 3) return [{ id: p.id, piece: p, combo: 0, full: true }]; // everything is in already
  return [
    { id: `${p.id}@0`, piece: p, combo: 0, full: false },
    { id: `${p.id}@full`, piece: p, combo: FULL_COMBO, full: true },
  ];
});
const FIGHT_FULL = CUES.filter((c) => c.full);

/** About 4-6 s around the loop point: whole bars, from the start of the loop's last bar(s). */
function seam(track: MusicTrack): { steps: number; from: number; len: number } {
  const song = SONGS[track];
  const bar = song.meter * stepSec(song);
  const bars = Math.max(2, Math.min(4, Math.round(4.5 / bar)));
  const from = (song.bars - Math.floor(bars / 2)) * song.meter;
  return { steps: bars * song.meter, from, len: bars * bar };
}

const cuePlay =
  (c: Cue, o: MusicRender = {}): Play =>
  (s, at) => {
    const w = seam(c.piece.track);
    s.scheduleMusic(at, w.steps, c.piece.track, { intense: c.piece.intense, combo: c.combo, phase: c.piece.phase, from: w.from, ...o });
  };

const results = new Map<string, Measure>();
const music = new Map<string, Measure>();
const musicWidth = new Map<string, number>();
const ambRaw = new Map<Ambience, Float32Array[]>();
const tells = new Map<TellSound, { env: number[]; spec: number[][] }>();
const mus = (id: string) => {
  const m = music.get(id);
  if (!m) throw new Error(`no music render ${id}`);
  return m;
};

beforeAll(async () => {
  for (const e of SFX) {
    const ch = await renderRaw(e.play, e.len);
    results.set(e.id, measure(ch, FS));
    if (e.id.startsWith('amb-')) ambRaw.set(e.id.slice(4) as Ambience, ch);
    if (e.id.startsWith('tell-')) tells.set(e.id.slice(5) as TellSound, { env: envelope(ch, FS, ENV_WIN), spec: spectrogram(ch, FS, AT, AT + TELL_SEC + 0.2, 10, true) });
  }
  for (const c of CUES) {
    const ch = await renderRaw(cuePlay(c), seam(c.piece.track).len);
    music.set(c.id, measure(ch, FS));
    musicWidth.set(c.id, width(ch));
  }
  if (process.env.AUDIO_REPORT) {
    const row = (m: Measure) => [m.peak, m.loud, m.mean, m.energy, m.phoneLoud, m.phoneMean, m.phoneEnergy, m.lowEnergy].map((v) => v.toFixed(2).padStart(7)).join(' ');
    console.log(`${'sound'.padEnd(18)}    peak    loud    mean  energy  phLoud  phMean phEnerg   lowEn`);
    for (const e of SFX) console.log(`${e.id.padEnd(18)} ${row(results.get(e.id)!)}`);
    for (const c of CUES) console.log(`${c.id.padEnd(18)} ${row(mus(c.id))}  width ${musicWidth.get(c.id)!.toFixed(1)}`);
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
}, 240_000);

describe('rendered sound levels', () => {
  it('no sound clips, and every sound is audible', () => {
    for (const e of SFX) {
      const m = results.get(e.id)!;
      expect(m.peak, `${e.id} peak`).toBeLessThan(0.99);
      expect(m.peak, `${e.id} peak`).toBeGreaterThan(0.02);
    }
    for (const c of CUES) {
      expect(mus(c.id).peak, `${c.id} music peak`).toBeLessThan(0.99);
      expect(mus(c.id).peak, `${c.id} music peak`).toBeGreaterThan(0.05);
    }
  });

  it('impacts are not quieter than any piece of music (every layer in), on phone speakers too', () => {
    for (const e of SFX.filter((x) => x.tier)) {
      const m = results.get(e.id)!;
      for (const c of CUES) {
        expect(m.loud, `${e.id} loudness vs ${c.id} music`).toBeGreaterThanOrEqual(mus(c.id).loud);
        expect(m.phoneLoud, `${e.id} phone loudness vs ${c.id} music`).toBeGreaterThanOrEqual(mus(c.id).phoneLoud);
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

describe('telegraphs', () => {
  it('every TellSound is in the Sound lab catalog (and no tell is an impact tier)', () => {
    expect(new Set(TELL_SOUNDS).size).toBe(16);
    for (const k of TELL_SOUNDS) {
      const e = SFX.find((x) => x.id === `tell-${k}`);
      expect(e, k).toBeDefined();
      expect(e!.tier, k).toBeUndefined();
    }
  });

  it('every telegraph is clearly audible over every fight piece (every layer in) on phone speakers, and never clips', () => {
    for (const k of TELL_SOUNDS) {
      const m = results.get(`tell-${k}`)!;
      expect(m.peak, `${k} peak`).toBeLessThan(0.99);
      for (const c of FIGHT_FULL) {
        const mu = mus(c.id);
        // its loudest moment rises well above the music, and on average it sits above the music too
        expect(m.phoneLoud, `${k} phone loudness vs ${c.id} music`).toBeGreaterThanOrEqual(mu.phoneLoud + 3);
        expect(m.phoneMean, `${k} phone mean vs ${c.id} music`).toBeGreaterThanOrEqual(mu.phoneMean + 1);
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

describe('the music', () => {
  /** The old battle, boss and map themes measured -17.3 to -20.2 at their loudest, -20.4 to -23.6 on average. */
  const OLD = { loud: [-20.2, -17.3], mean: [-23.6, -20.4] };

  it('every piece is in the Sound lab: each act calm and in a fight, each mini-boss, the Boar King per phase, the camp and the title', () => {
    expect(new Set(MUSIC_PIECES.map((p) => p.track))).toEqual(new Set(MUSIC_TRACKS));
    for (const act of ['act1', 'act2', 'act3'] as const) {
      expect(MUSIC_PIECES.some((p) => p.track === act && !p.intense), `${act} calm`).toBe(true);
      expect(MUSIC_PIECES.some((p) => p.track === act && p.intense), `${act} fight`).toBe(true);
      expect(SONGS[act].calm && SONGS[act].intense, `${act} has both arrangements`).toBeTruthy();
    }
    expect(MUSIC_PIECES.filter((p) => p.track === 'boarKing').map((p) => p.phase)).toEqual([1, 2, 3]);
    for (const t of ['captain', 'golem', 'boarKing'] as const) expect(SONGS[t].intense, t).toBeTruthy();
  });

  it('each piece has its own identity: key, tempo and meter', () => {
    const id = MUSIC_TRACKS.map((t) => `${SONGS[t].key} ${SONGS[t].bpm} ${SONGS[t].meter}/${SONGS[t].beat}`);
    expect(new Set(id).size).toBe(id.length);
    expect(new Set(MUSIC_TRACKS.map((t) => SONGS[t].key)).size).toBe(MUSIC_TRACKS.length);
    const { act1, act2, act3, captain, golem, boarKing, camp } = SONGS;
    expect(act1.key).toMatch(/major/);
    expect(act1.bpm).toBeGreaterThanOrEqual(120);
    expect(act2.key).toMatch(/Dorian|minor/);
    expect(act2.bpm).toBeLessThan(act1.bpm);
    expect(act3.key).toMatch(/minor/);
    expect(act3.bpm).toBeGreaterThan(act1.bpm);
    expect([captain.meter, captain.beat]).toEqual([12, 6]); // 6/8: two beats of three 8ths
    expect(golem.bpm).toBeLessThan(80); // slow and heavy
    expect(boarKing.keyUp).toBeGreaterThan(0); // his last phase goes up a key
    expect(camp.intense).toBeUndefined(); // the camp only has a gentle arrangement
  });

  it('every melody fills its bars, stays in its key and in a singable range', () => {
    const SCALE: Record<MusicTrack, string> = {
      title: 'f g a bb c d e',
      camp: 'bb c d eb f g a',
      act1: 'd e f# g a b c#',
      act2: 'e f# g a b c# d',
      act3: 'c d eb f g ab bb b',
      captain: 'a b c d e f g g#',
      golem: 'd eb f g a bb c e',
      boarKing: 'g a bb c d eb f f#',
    };
    for (const t of MUSIC_TRACKS) {
      const song = SONGS[t];
      expect(song.melody.length, `${t} melody steps`).toBe(song.bars * song.meter);
      expect(song.chords.length, `${t} chord bars`).toBe(song.bars);
      const pcs = new Set(SCALE[t].split(' ').map((n) => midi(`${n}4`) % 12));
      let notes = 0;
      song.melody.forEach((n, i) => {
        if (!n) return;
        notes++;
        expect(pcs.has(n[0] % 12), `${t} step ${i}: midi ${n[0]} out of ${song.key}`).toBe(true);
        expect(n[0], `${t} step ${i}`).toBeGreaterThanOrEqual(55);
        expect(n[0] + (song.keyUp ?? 0), `${t} step ${i}`).toBeLessThanOrEqual(90);
        expect(i % song.meter + n[1], `${t} step ${i}: a note runs past its bar`).toBeLessThanOrEqual(song.meter);
      });
      expect(notes, `${t} notes`).toBeGreaterThanOrEqual(2 * song.bars);
    }
  });

  it('every piece is in the old themes\' loudness family', () => {
    for (const c of CUES) {
      const m = mus(c.id);
      // the full bands sit where the old themes did; the calm and base arrangements a little under
      expect(m.loud, `${c.id} loudest`).toBeLessThanOrEqual(OLD.loud[1] + 0.5);
      expect(m.loud, `${c.id} loudest`).toBeGreaterThanOrEqual(OLD.loud[0] - (c.full ? 1 : 3.5));
      expect(m.mean, `${c.id} mean`).toBeLessThanOrEqual(OLD.mean[1] + 1);
      expect(m.mean, `${c.id} mean`).toBeGreaterThanOrEqual(OLD.mean[0] - (c.full ? 1 : 3));
    }
  });

  it('the fight layers add up as the combo climbs; under them the base still carries the piece (also on a phone)', () => {
    for (const p of MUSIC_PIECES.filter((x) => x.intense && x.phase !== 3)) {
      const base = mus(`${p.id}@0`);
      const full = mus(`${p.id}@full`);
      if (p.phase === 2) {
        expect(full.energy - base.energy, `${p.id}: bass and lead add`).toBeGreaterThan(0.5);
        continue;
      }
      expect(full.energy - base.energy, `${p.id}: the layers add energy (dB)`).toBeGreaterThan(1.5);
      expect(full.loud - base.loud, `${p.id}: the layers add loudness (dB)`).toBeGreaterThan(2);
      expect(base.phoneMean, `${p.id}: the base on a phone`).toBeGreaterThan(-32);
    }
  });

  it("each act's calm arrangement is calmer than its fight band but still audible on phone speakers", () => {
    for (const act of ['act1', 'act2', 'act3']) {
      const calm = mus(act);
      expect(calm.loud, act).toBeLessThanOrEqual(mus(`${act}-fight@full`).loud - 1.5);
      expect(calm.phoneLoud, act).toBeGreaterThan(-30);
      expect(calm.phoneMean, act).toBeGreaterThan(mus(`${act}-fight@full`).phoneMean - 7);
    }
  });

  it("the Boar King's theme escalates with his phases (more layers, then up a key with everything in)", async () => {
    const [p1, p2, p3] = ['boarKing1@0', 'boarKing2@0', 'boarKing3'].map(mus);
    expect(p2.energy).toBeGreaterThan(p1.energy + 1);
    expect(p2.loud).toBeGreaterThan(p1.loud + 1.5);
    expect(p3.energy).toBeGreaterThan(p2.energy + 1.5);
    expect(p3.loud).toBeGreaterThan(p2.loud + 1.5);
    // phase changes land on the next bar: phase 2 brings in the drums and the stabs, phase 3 everything, a key up
    const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: FS, sampleRate: FS });
    const s = new Synth({ ctx: ctx as unknown as BaseAudioContext, tuning: cloneTuning(), rand: seeded(7) });
    s.scheduleMusic(AT, 20, 'boarKing', { intense: true, combo: 0, phase: 1, cues: [{ step: 6, phase: 2 }] });
    expect(s.currentMusic).toMatchObject({ layers: ['base', 'drums', 'stabs'], key: 0 });
    s.scheduleMusic(AT, 20, 'boarKing', { intense: true, combo: 0, phase: 2, cues: [{ step: 6, phase: 3 }] });
    expect(s.currentMusic).toMatchObject({ layers: ['base', 'drums', 'bass', 'lead', 'stabs'], key: SONGS.boarKing.keyUp });
  });

  it('every piece is in stereo and has weight (the calm arrangements and the full bands)', () => {
    for (const c of CUES) {
      expect(musicWidth.get(c.id), `${c.id} side vs mid (dB)`).toBeGreaterThan(-16);
      if (c.full || !c.piece.intense) expect(mus(c.id).lowEnergy - mus(c.id).energy, `${c.id} low-end share (dB)`).toBeGreaterThan(-5);
    }
  });

  /** Kick times (ctx s) of a render, by watching the band's kick. */
  async function kicksOf(play: Play, len: number): Promise<number[]> {
    const at: number[] = [];
    const kick = Band.prototype.kick;
    Band.prototype.kick = function (this: Band, ...a: Parameters<Band['kick']>) {
      at.push(a[1]);
      return kick.apply(this, a);
    };
    try {
      await renderRaw(play, len);
    } finally {
      Band.prototype.kick = kick;
    }
    return at;
  }

  it('the drums join on the next beat once the combo is up, and drop from the beat after a break', async () => {
    const song = SONGS.act1;
    const STEP = stepSec(song);
    const m = cloneTuning().music;
    const kicks = await kicksOf((s, at) => s.scheduleMusic(at, 64, 'act1', { intense: true, combo: 0, cues: [{ step: 5, combo: m.drumsAt }, { step: 37, combo: 0 }] }), 64 * STEP);
    const steps = kicks.map((t) => (t - AT) / STEP);
    expect(steps[0], 'first kick: the beat after the combo reached the drums').toBeCloseTo(8, 6);
    expect(steps.length).toBeGreaterThan(3);
    // the break at step 37: the drums fade from the beat at step 40, over tuning.music.layerOut
    expect(Math.max(...steps)).toBeLessThanOrEqual(40 + m.layerOut / STEP + 1e-6);
  });

  it('calm -> fight crossfades inside the piece on the beat: no gap, no jump, and it lands on the fight band', async () => {
    const song = SONGS.act1;
    const STEP = stepSec(song);
    const steps = 6 * song.meter;
    const ch = await renderRaw((s, at) => s.scheduleMusic(at, steps, 'act1', { intense: false, cues: [{ step: 2 * song.meter + 2, intense: true, combo: FULL_COMBO }] }), steps * STEP);
    expect(measure(ch, FS).peak).toBeLessThan(0.99);
    const env = rmsEnvelope(ch, 0.1).slice(3, Math.floor((steps * STEP) / 0.1) - 2);
    const sorted = [...env].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    expect(Math.min(...env), 'quietest 100 ms vs the median (dB): no gap').toBeGreaterThan(median - 10);
    // after the crossfade (whole beats, about tuning.music.crossfade), the last bars are as loud as the fight band
    const tail = measure(
      ch.map((c) => c.slice(Math.round((AT + 4 * song.meter * STEP) * FS))),
      FS,
    );
    expect(tail.mean).toBeGreaterThan(mus('act1-fight@full').mean - 2.5);
    expect(tail.mean).toBeGreaterThan(mus('act1').mean + 1);
  });

  it('another piece takes over on the next beat while the last one rings out (no gap, no clipping)', async () => {
    const len = 6;
    const STEP = stepSec(SONGS.act1);
    const ch = await renderRaw((s, at) => s.scheduleMusic(at, Math.round(len / STEP), 'act1', { intense: false, cues: [{ step: 18, track: 'captain', intense: true }] }), len);
    expect(measure(ch, FS).peak).toBeLessThan(0.99);
    const env = rmsEnvelope(ch, 0.1).slice(3, -3);
    const sorted = [...env].sort((a, b) => a - b);
    expect(Math.min(...env)).toBeGreaterThan(sorted[Math.floor(sorted.length / 2)] - 12);
    // asked for mid-beat (step 18), the captain comes in on the beat at step 20
    const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: FS, sampleRate: FS });
    const s = new Synth({ ctx: ctx as unknown as BaseAudioContext, tuning: cloneTuning(), rand: seeded(7) });
    s.scheduleMusic(AT, 20, 'act1', { intense: false, cues: [{ step: 18, track: 'captain', intense: true }] });
    expect(s.currentMusic.track).toBe('act1');
    s.scheduleMusic(AT, 21, 'act1', { intense: false, cues: [{ step: 18, track: 'captain', intense: true }] });
    expect(s.currentMusic.track).toBe('captain');
  });

  it('the band stays light for an iPhone: under 320 new nodes a second, even with every layer in', async () => {
    for (const c of FIGHT_FULL) {
      const w = seam(c.piece.track);
      const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil((w.len + 0.2) * FS), sampleRate: FS });
      let nodes = 0;
      const raw = ctx as unknown as Record<string, (...a: unknown[]) => unknown>;
      for (const k of ['createOscillator', 'createBufferSource', 'createGain', 'createBiquadFilter', 'createStereoPanner', 'createWaveShaper', 'createConvolver', 'createDelay']) {
        const f = raw[k].bind(ctx);
        raw[k] = (...a: unknown[]) => (nodes++, f(...a));
      }
      const s = new Synth({ ctx: ctx as unknown as BaseAudioContext, tuning: cloneTuning(), rand: seeded(7) });
      const before = nodes;
      cuePlay(c)(s, AT);
      expect((nodes - before) / w.len, `${c.id} nodes per second`).toBeLessThan(320);
    }
  });
});

describe('ambience', () => {
  /** The places, each with the music it plays under: the title and world map, the camp, the act maps (each act's
   *  calm theme), and each act's fights, nodes and scenes (its calm and fight arrangements, its boss). */
  const UNDER: [Ambience, string[]][] = [
    ['world', ['title']],
    ['camp', ['camp']],
    ['map', ['act1', 'act2', 'act3']],
    ['forest', ['act1', 'act1-fight@0', 'act1-fight@full', 'captain@0', 'captain@full']],
    ['ruins', ['act2', 'act2-fight@0', 'act2-fight@full', 'golem@0', 'golem@full']],
    ['hollow', ['act3', 'act3-fight@0', 'act3-fight@full', 'boarKing1@0', 'boarKing1@full', 'boarKing2@0', 'boarKing3']],
  ];

  it('every place has an ambience in the Sound lab catalog (and none is an impact tier)', () => {
    expect(AMBIENCES.length).toBe(6);
    expect(new Set(UNDER.map(([a]) => a))).toEqual(new Set(AMBIENCES));
    for (const a of AMBIENCES) {
      const e = SFX.find((x) => x.id === `amb-${a}`);
      expect(e, a).toBeDefined();
      expect(e!.tier, a).toBeUndefined();
    }
  });

  it('each ambience sits well under the music it plays with, and far under the impacts', () => {
    for (const [a, ids] of UNDER) {
      const m = results.get(`amb-${a}`)!;
      for (const id of ids) {
        expect(m.loud, `${a} loudness vs ${id} music`).toBeLessThanOrEqual(mus(id).loud - 6);
        expect(m.mean, `${a} mean vs ${id} music`).toBeLessThanOrEqual(mus(id).mean - 8);
        expect(m.phoneLoud, `${a} phone loudness vs ${id} music`).toBeLessThanOrEqual(mus(id).phoneLoud - 4);
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

  it('music and ambience together still sit under every impact, and the telegraphs still read over the fight bands', async () => {
    const pairs: [Ambience, string][] = [
      ['world', 'title'],
      ['camp', 'camp'],
      ['forest', 'act1-fight@full'],
      ['forest', 'captain@full'],
      ['ruins', 'act2-fight@full'],
      ['ruins', 'golem@full'],
      ['hollow', 'act3-fight@full'],
      ['hollow', 'boarKing3'],
    ];
    for (const [a, id] of pairs) {
      const c = CUES.find((x) => x.id === id)!;
      const len = seam(c.piece.track).len;
      const both = await render((s, at) => {
        cuePlay(c)(s, at);
        s.scheduleAmbience(at, len, a);
      }, len);
      expect(both.peak, `${id} + ${a} peak`).toBeLessThan(0.99);
      for (const e of SFX.filter((x) => x.tier)) {
        const m = results.get(e.id)!;
        expect(m.loud, `${e.id} vs ${id} music + ${a}`).toBeGreaterThanOrEqual(both.loud);
        expect(m.phoneLoud, `${e.id} phone vs ${id} music + ${a}`).toBeGreaterThanOrEqual(both.phoneLoud);
      }
      if (!c.piece.intense) continue;
      for (const k of TELL_SOUNDS) {
        const m = results.get(`tell-${k}`)!;
        expect(m.phoneLoud, `${k} phone vs ${id} music + ${a}`).toBeGreaterThanOrEqual(both.phoneLoud + 3);
        expect(m.phoneMean, `${k} phone mean vs ${id} music + ${a}`).toBeGreaterThanOrEqual(both.phoneMean + 1);
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
