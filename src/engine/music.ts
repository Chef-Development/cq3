// Music: an original theme per place and per boss, played live by a small synthesized band (no samples).
//
// Every piece is a loop on a 16th-note grid with its own tempo and meter (4/4, a 6/8 jig, a 3/4 lullaby), a chord
// per bar (or two), one melody, and the parts of its arrangements:
//   - the acts' themes have two arrangements of the same melody at the same tempo: calm (the act map, nodes, story
//     scenes: a flute and a music box over a light pad, no drums) and intense (fights). Moving between them
//     crossfades inside the piece, from a beat, so it stays one piece.
//   - in a fight the intense arrangement starts from its base (pad, arpeggio, percussion, the melody on a bell) and
//     layers join as the combo climbs: drums, then bass, then the lead (tuning.music), each on the next beat; a
//     combo break drops them back. The Boar King's theme also adds layers with his phases and goes up a key in
//     the last one.
//   - another piece (a mini-boss, the camp, the next act) starts from its top on the next beat while the last one
//     rings out.
//
// Graph: one rig per music run, one deck per piece playing (two while one rings out), one group per arrangement:
//   voices -> chain (its layer gate, then the part's sound: pad filter and sidechain, arpeggio sides, kick drive...)
//     -> group dry / echo send / hall send (the arrangement's fade)
//       -> rig: music bus (tuning.impact.music, ducked under big impacts) -> master
//               ping-pong echo (dotted 8ths of the piece), hall reverb -> music bus
// Notes are short voices into the chains; a layer that's off schedules no notes (iPhone: few nodes per second).

import type { Tuning } from '../core/tuning';
import type { NoiseOpts, Pts, ToneOpts, VoiceOpts, Wave } from './audio';

export type MusicTrack = 'title' | 'camp' | 'act1' | 'act2' | 'act3' | 'captain' | 'golem' | 'boarKing';
export const MUSIC_TRACKS: MusicTrack[] = ['title', 'camp', 'act1', 'act2', 'act3', 'captain', 'golem', 'boarKing'];

/** Calm (maps, nodes, scenes) or intense (fights). */
export type Arrangement = 'calm' | 'intense';
/** The fight arrangement's layers: the base always plays, the others join with the combo (and boss phases). */
export type Layer = 'base' | 'drums' | 'bass' | 'lead' | 'stabs';
const GATED: Layer[] = ['drums', 'bass', 'lead', 'stabs'];

type Note = [number, number] | null; // [midi (melody) or semitones over the root (bass), length in steps]
export interface Chord {
  root: number; // bass note (midi, D2..C#3)
  tones: number[]; // four voiced chord tones (midi, from about G3 up)
}

/** What the music borrows from the synth: its context, the master and the voice builders. */
export interface MusicHost {
  readonly offline: boolean;
  ctx(): BaseAudioContext;
  out(): AudioNode;
  hall(): AudioBuffer;
  drive(k: number): Float32Array;
  tone(o: ToneOpts): void;
  noise(o: NoiseOpts): void;
  voice(o: VoiceOpts): GainNode;
  ticks(at: number[], o: { gain: number; f: number; q?: number; ms?: number; out?: AudioNode }): void;
  osc(type: Wave, f: number): OscillatorNode;
  env(peak: number, t: number, attack: number, hold: number, dur: number, minTail?: number): { g: GainNode; end: number };
  tuning(): Tuning;
}

/** One step of one arrangement: what's sounding and where (the parts read it). */
export interface Step {
  b: Band;
  g: Group;
  song: Song;
  i: number; // step in the loop
  bar: number;
  s: number; // step in the bar
  t: number; // ctx time
  STEP: number; // seconds per step
  chord: Chord; // sounding now (in the key of the moment)
  change: boolean; // a chord starts on this step
  left: number; // seconds the chord has left
  note: Note; // the melody note starting here (in the key of the moment)
  last: boolean; // the loop's last bar
  first: boolean; // the arrangement's first step: the pad comes straight in, mid-chord
  phase: number; // boss phase (1 for every other piece)
  lead: number; // 1, or less while the lead layer has the melody (the base's melody voice steps back)
}

interface Part {
  layer: Layer;
  play(x: Step): void;
}

export interface Song {
  track: MusicTrack;
  name: string;
  key: string; // for the Sound lab and the tests
  bpm: number; // beats per minute (a 6/8 beat is a dotted quarter)
  meter: number; // steps (16ths) per bar
  beat: number; // steps per beat
  bars: number;
  split?: number; // where a bar's second chord starts (default: half the bar)
  chords: Chord[][];
  melody: Note[];
  echo: number; // ping-pong echo feedback (its time is a dotted 8th)
  swing: number; // offbeat 16ths of the shakers and hats land late by this share of a step
  keyUp?: number; // the Boar King: phases 2 and 3 add layers, phase 3 goes up this many semitones
  calm?: Part[];
  intense?: Part[];
}

const hz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
const scale = (p: Pts, k: number): Pts => p.map(([d, v]): [number, number] => [d, v * k]);

// ---- notation: melodies, chords, bass bars and drum patterns as text ----

const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** 'c5', 'f#4', 'bb3' -> midi. */
export function midi(name: string): number {
  const m = /^([a-g])(#|b)?(\d)$/.exec(name);
  if (!m) throw new Error(`music: bad note "${name}"`);
  return (Number(m[3]) + 1) * 12 + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/** A melody: 'note:steps' tokens ('r' rests), bars split by '|'. One [midi, length] on the step each note starts. */
function mel(meter: number, src: string): Note[] {
  const bars = src.split('|').map((b) => b.trim());
  const out = new Array<Note>(bars.length * meter).fill(null);
  bars.forEach((bar, i) => {
    let at = 0;
    for (const tok of bar.split(/\s+/)) {
      const [n, l] = tok.split(':');
      if (n !== 'r') out[i * meter + at] = [midi(n), Number(l)];
      at += Number(l);
    }
    if (at !== meter) throw new Error(`music: bar ${i + 1} of "${src.slice(0, 24)}..." has ${at} steps, not ${meter}`);
  });
  return out;
}

const QUALITY: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  dim: [0, 3, 6],
};

/** A chord symbol ('D', 'F#m', 'Bb', 'A7', 'Bsus4'): its bass root and four tones voiced from midi `lo` up. */
function chord(sym: string, lo: number): Chord {
  const m = /^([A-G])(#|b)?(.*)$/.exec(sym);
  const iv = m ? QUALITY[m[3]] : undefined;
  if (!m || !iv) throw new Error(`music: bad chord "${sym}"`);
  const pc = (PC[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  const tones = iv.map((i) => lo + ((((pc + i - lo) % 12) + 12) % 12)).sort((a, b) => a - b);
  if (tones.length === 3) tones.push(tones[0] + 12);
  return { root: 38 + ((pc + 10) % 12), tones };
}

/** Chords per bar: bars split by '|', a second chord in a bar after a space (it starts half way, or at `split`). */
const chords = (src: string, lo = 55): Chord[][] => src.split('|').map((bar) => bar.trim().split(/\s+/).map((c) => chord(c, lo)));

/** A bass bar: one token per step, '.' or 'semitones:steps' over the chord's root. */
const bassBar = (src: string): Note[] =>
  src
    .trim()
    .split(/\s+/)
    .map((tok): Note => {
      if (tok === '.') return null;
      const [n, l] = tok.split(':');
      return [Number(n), Number(l ?? 1)];
    });

/** Drum patterns: one character per step, X x o - for loud to soft, '.' for none. */
const VEL: Record<string, number> = { X: 1, x: 0.7, o: 0.45, '-': 0.25 };
const hit = (pat: string, s: number): number => VEL[pat[s]] ?? 0;

/** Chord tone k of a chord: 0..3 its four tones, 4..7 an octave up, and so on. */
const tone = (c: Chord, k: number): number => c.tones[k % 4] + 12 * Math.floor(k / 4);

// ---- part builders, shared by the pieces ----

const part = (layer: Layer, play: (x: Step) => void): Part => ({ layer, play });

interface PadOpts {
  level: number;
  hz: number; // lowpass at rest (it opens ~3x over the loop's last bar)
  attack: number;
  shift?: number; // semitones from the chord tones
  wave?: Wave;
  detune?: number; // cents, left and right voices apart
  swell?: boolean;
}
/** The pad on every chord (and straight in, mid-chord, when its arrangement starts). */
const pad = (o: PadOpts) => part('base', (x) => (x.change || x.first) && x.b.pad(x, o));

/** A noise riser over the last `beats` of the loop. */
const riser = (level: number, beats = 2) => part('base', (x) => x.last && x.s === x.song.meter - beats * x.song.beat && x.b.riser(x, beats * x.song.beat * x.STEP, level));

/** A soft chime at the top of the loop (calm arrangements). */
const chime = (m: number, level: number) => part('base', (x) => x.i === 0 && x.b.chime(x, m, level));

/** An arpeggio: chord tone per step (-1 rests). */
const arp = (pattern: number[], o: { level: number; wave?: Wave; dur?: number; oct?: number; hz?: number; echo?: number; box?: boolean }, layer: Layer = 'base') =>
  part(layer, (x) => {
    const k = pattern[x.s];
    if (k === undefined || k < 0) return;
    const m = tone(x.chord, k) + 12 * (o.oct ?? 0);
    if (o.box) x.b.box(x, m, o.level);
    else x.b.pluck(x, m, { wave: o.wave ?? 'pulse25', level: o.level, dur: (o.dur ?? 0.9) * x.STEP, hz: o.hz, echo: o.echo });
  });

/** The melody, played by `play` (len in seconds). */
const melody = (layer: Layer, play: (x: Step, m: number, len: number) => void) => part(layer, (x) => x.note && play(x, x.note[0], x.note[1] * x.STEP));

interface BassOpts {
  level: number;
  hz: [number, number]; // the pluck's filter: from, settling to
  sub: number; // sine sub (share of the level)
  gate?: number; // share of the note's length it holds
}
const bass = (bars: (bar: number) => Note[], o: BassOpts, layer: Layer = 'bass') =>
  part(layer, (x) => {
    const n = bars(x.bar)[x.s];
    if (n) x.b.bass(x, x.chord.root + n[0], n[1] * x.STEP * (o.gate ?? 0.92), o);
  });

/** A kit from patterns (one string per bar of the cycle; the last bar can have its own fill). */
interface KitOpts {
  kick: string[];
  snare: string[];
  hats: string[];
  open?: string[];
  clap?: boolean; // a clap on the loud snares
  fill?: { kick?: string; snare?: string; hats?: string; toms?: string };
  crash?: number[]; // bars with a crash on their first step
  kickPitch?: number;
  level?: number;
}
const kit = (o: KitOpts) =>
  part('drums', (x) => {
    const v = o.level ?? 1;
    const at = <T>(p: T[]) => p[x.bar % p.length];
    const f = x.last ? o.fill : undefined;
    const k = hit(f?.kick ?? at(o.kick), x.s);
    if (k) x.b.kick(x, x.t, k * v, o.kickPitch ?? 1);
    const sn = hit(f?.snare ?? at(o.snare), x.s);
    if (sn) x.b.snare(x, x.t, sn * v, !!o.clap && sn >= 1);
    if (f?.toms) {
      const tm = hit(f.toms, x.s);
      if (tm) x.b.tom(x, x.t, 170 - x.s * 6, tm * v);
    }
    if (o.crash?.includes(x.bar) && x.s === 0) x.b.crash(x, x.t, v);
    else {
      const op = o.open ? hit(at(o.open), x.s) : 0;
      const h = hit(f?.hats ?? at(o.hats), x.s);
      if (op) x.b.hat(x, x.t + (x.s % 2 ? x.song.swing * x.STEP : 0), op * v, true);
      else if (h) x.b.hat(x, x.t + (x.s % 2 ? x.song.swing * x.STEP : 0), h * v);
    }
  });

/** A percussion line from a pattern (one string per bar of the cycle). */
const perc = (pats: string[], play: (x: Step, v: number) => void, layer: Layer = 'base') =>
  part(layer, (x) => {
    const v = hit(pats[x.bar % pats.length], x.s);
    if (v) play(x, v);
  });

// ---- the pieces ----

// Title and world map (the M3 map theme): F major, 100 BPM. A music-box arpeggio in 8ths, a walking bass in
// quarters, a soft flute and light percussion.
const leadSteps = (bars: [number, number, number][][]): Note[] => {
  const at = new Array<Note>(bars.length * 16).fill(null);
  bars.forEach((bar, b) => bar.forEach(([st, m, len]) => (at[b * 16 + st] = [m, len])));
  return at;
};
const walk = (notes: number[]): Note[] => {
  const at = new Array<Note>(16).fill(null);
  notes.forEach((st, i) => (at[i * 4] = [st, 3]));
  return at;
};
const TITLE_WALK: Note[][] = [walk([0, 4, 7, 2]), walk([0, 3, 7, 0]), walk([0, 4, 7, 1]), walk([0, -1, -3, -5]), walk([0, 2, 4, 7]), walk([0, -2, -4, -5]), walk([0, 3, 7, 4]), walk([0, -2, -3, -5])];
const TITLE: Song = {
  track: 'title',
  name: 'Title and world map',
  key: 'F major',
  bpm: 100,
  meter: 16,
  beat: 4,
  bars: 8,
  chords: [
    { root: 41, tones: [60, 65, 69, 72] }, // F
    { root: 45, tones: [60, 64, 69, 72] }, // Am
    { root: 46, tones: [58, 62, 65, 70] }, // Bb
    { root: 48, tones: [60, 64, 67, 72] }, // C
    { root: 41, tones: [60, 65, 69, 72] }, // F
    { root: 50, tones: [57, 62, 65, 69] }, // Dm
    { root: 43, tones: [58, 62, 67, 70] }, // Gm
    { root: 48, tones: [58, 64, 67, 72] }, // C7
  ].map((c) => [c]),
  melody: leadSteps([
    [[0, 72, 4], [4, 77, 2], [6, 79, 2], [8, 81, 6], [14, 79, 2]],
    [[0, 76, 6], [6, 74, 2], [8, 72, 4], [12, 69, 4]],
    [[0, 70, 4], [4, 74, 2], [6, 77, 2], [8, 79, 4], [12, 77, 2], [14, 74, 2]],
    [[0, 76, 6], [6, 74, 2], [8, 72, 8]],
    [[0, 72, 4], [4, 77, 2], [6, 79, 2], [8, 81, 4], [12, 84, 4]],
    [[0, 81, 6], [6, 79, 2], [8, 77, 4], [12, 74, 4]],
    [[0, 70, 4], [4, 74, 2], [6, 79, 2], [8, 77, 4], [12, 76, 4]],
    [[0, 79, 6], [6, 77, 2], [8, 76, 4], [12, 74, 2], [14, 76, 2]],
  ]),
  echo: 0.4,
  swing: 0.16,
  calm: [
    pad({ level: 0.13, hz: 950, attack: 0.45 }),
    riser(0.45),
    bass((bar) => TITLE_WALK[bar], { level: 0.32, hz: [1000, 340], sub: 1.2, gate: 0.85 }, 'base'),
    arp([0, 0, 1, 1, 2, 2, 3, 3, 2, 2, 1, 1, 2, 2, 3, 3].map((k, s) => (s % 2 ? -1 : k)), { level: 1, box: true }),
    melody('base', (x, m, len) => x.b.flute(x, m, len, 0.3, 0)),
    // light percussion: a soft low kick on 1 and 3 (the pad breathes with it), a woodblock on 2 and 4, a swung
    // shaker on the 8ths, a small fill into the loop and a chime at its top
    part('base', (x) => {
      const fill = x.last && x.s >= 10;
      if (x.s === 0 || x.s === 8 || (x.s === 14 && x.bar % 2 === 1 && !fill)) x.b.kick(x, x.t, x.s === 14 ? 0.3 : 0.5, 0.8, 0.6);
      const blk = x.s === 4 || x.s === 12 ? 1 : fill && (x.s === 10 || x.s >= 13) ? 0.7 : 0;
      if (blk) x.b.block(x, x.t, fill ? 760 + (x.s - 10) * 60 : 820, blk);
      if (!fill) x.b.shaker(x, x.t + (x.s % 2 ? x.song.swing * x.STEP : 0), x.s % 4 === 2 ? 1 : x.s % 2 ? 0.25 : 0.5, 'drums');
    }),
    chime(89, 1),
  ],
};

const WHOLE = bassBar('0:16 . . . . . . . . . . . . . . .');

// Camp: a lullaby by the fire. Bb major, 3/4 at 80 BPM: a plucked guitar waltz, a breathy flute with room to
// breathe (every other bar it rests), a warm low sub and a faint pad. No drums: the crickets keep the time.
const CAMP_SUB = bassBar('0:8 . . . . . . . . . . .');
const CAMP: Song = {
  track: 'camp',
  name: 'Camp',
  key: 'Bb major',
  bpm: 80,
  meter: 12,
  beat: 4,
  bars: 8,
  split: 8,
  chords: chords('Bb | Gm | Eb | F | Bb | Gm | Cm F | Bb'),
  melody: mel(12, 'd5:6 c5:2 bb4:4 | d5:8 r:4 | eb5:6 d5:2 c5:4 | c5:8 r:4 | d5:4 f5:4 g5:4 | f5:8 d5:4 | eb5:4 d5:2 c5:2 a4:4 | bb4:8 r:4'),
  echo: 0.35,
  swing: 0,
  calm: [
    pad({ level: 0.1, hz: 700, attack: 1, wave: 'triangle', swell: false }),
    // the guitar: the root on 1, the chord on 2 and 3, a passing note before the bar line every other bar
    part('base', (x) => {
      const c = x.chord;
      if (x.s === 0) x.b.guitar(x, x.t, c.root + 12, 0.48);
      else if (x.s === 4 || x.s === 8) for (const [k, d] of [[1, 0], [2, 0.012]] as const) x.b.guitar(x, x.t + d, tone(c, k + (x.s === 8 ? 1 : 0)), 0.25);
      else if (x.s === 10 && x.bar % 2 === 1) x.b.guitar(x, x.t, tone(c, 4), 0.16);
    }),
    bass(() => CAMP_SUB, { level: 0.2, hz: [500, 250], sub: 1.4, gate: 1 }, 'base'),
    melody('base', (x, m, len) => x.b.flute(x, m, len, 0.38, 0.6)),
    chime(82, 0.7),
  ],
};

// Act 1, Meadow Road: D major, 128 BPM, bouncy. The hook is a dotted skip up the chord (D-F#-A, then up to B).
const ACT1_BASS = bassBar('0:2 . . 0:1 12:2 . 0:1 . 0:2 . . 0:1 12:2 . 7:1 12:1');
const ACT1_CALM = bassBar('0:7 . . . . . . . 7:7 . . . . . . .');
const ACT1_TURN = bassBar('0:2 . . 0:1 12:2 . 0:1 . 0:1 2:1 4:1 5:1 7:1 9:1 11:1 12:1');
const ACT1: Song = {
  track: 'act1',
  name: 'Meadow Road',
  key: 'D major',
  bpm: 128,
  meter: 16,
  beat: 4,
  bars: 8,
  chords: chords('D | G | Bm | A | D | G | Em A | D'),
  melody: mel(
    16,
    'd5:3 f#5:1 a5:2 f#5:2 b5:4 a5:4 | g5:3 f#5:1 e5:2 d5:2 e5:2 g5:2 b5:4 | a5:3 g5:1 f#5:2 e5:2 f#5:4 d5:4 | e5:6 r:2 a4:2 b4:2 c#5:2 e5:2 |' +
      'd5:3 f#5:1 a5:2 f#5:2 b5:4 a5:4 | g5:3 a5:1 b5:2 d6:2 b5:2 a5:2 g5:4 | f#5:3 g5:1 a5:2 f#5:2 e5:2 c#5:2 a4:2 c#5:2 | d5:8 r:4 a4:2 c#5:2',
  ),
  echo: 0.32,
  swing: 0.1,
  calm: [
    pad({ level: 0.1, hz: 900, attack: 0.4 }),
    arp([0, -1, 1, -1, 2, -1, 3, -1, 2, -1, 1, -1, 2, -1, 3, -1], { level: 0.9, box: true }),
    melody('base', (x, m, len) => x.b.flute(x, m, len, 0.27)),
    bass(() => ACT1_CALM, { level: 0.27, hz: [900, 320], sub: 1.2 }, 'base'),
    perc(['..o...x...o...x.'], (x, v) => x.b.shaker(x, x.t + x.song.swing * x.STEP, v * 0.8)),
    riser(0.35),
    chime(86, 0.8),
  ],
  intense: [
    pad({ level: 0.2, hz: 1400, attack: 0.15 }),
    arp([0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 4, 3, 2, 1], { level: 1.15, hz: 3800 }),
    melody('base', (x, m) => x.b.bell(x, m + 12, 0.26 * x.lead)),
    perc(['XoxoXoxoXoxoXoxo'], (x, v) => x.b.shaker(x, x.t + (x.s % 2 ? x.song.swing * x.STEP : 0), v * 1.3)),
    perc(['....X.......X...'], (x, v) => x.b.tamb(x, x.t, v * 1.3)),
    riser(0.6),
    kit({
      kick: ['X......xX.......', 'X......xX.....x.'],
      snare: ['....X.......X..-'],
      hats: ['o...o...o...o...'],
      open: ['..x...x...x...x.'],
      clap: true,
      fill: { snare: '....X.......XoxX', hats: 'o...o...o.......' },
      crash: [0],
      level: 0.75,
    }),
    bass((bar) => (bar === 7 ? ACT1_TURN : ACT1_BASS), { level: 0.3, hz: [1600, 450], sub: 1.35 }),
    melody('lead', (x, m, len) => x.b.lead(x, m, len, 0.25, 'pulse25', 3600)),
  ],
};

// Act 2, Old Ruins: E Dorian, 104 BPM. Slow, questioning phrases (long-short-mid-mid) over an arpeggio that rolls
// across two octaves and echoes off the stones.
const ACT2_BASS = bassBar('0:3 . . 0:1 . . 12:2 . 0:2 . 7:2 . 0:1 12:1 7:2 .');
const ACT2_ROLL = [0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5];
const ACT2: Song = {
  track: 'act2',
  name: 'Old Ruins',
  key: 'E Dorian',
  bpm: 104,
  meter: 16,
  beat: 4,
  bars: 8,
  chords: chords('Em | A | Em | A | G | D | Em | Bsus4'),
  melody: mel(
    16,
    'b4:6 e5:2 f#5:4 g5:4 | a5:6 g5:2 f#5:4 c#5:4 | e5:6 f#5:2 g5:4 b5:4 | a5:8 g5:2 f#5:2 e5:4 |' +
      'g5:6 d5:2 b4:4 d5:4 | f#5:6 d5:2 a4:4 d5:4 | e5:4 g5:4 b5:4 d6:4 | c#6:4 b5:12',
  ),
  echo: 0.5,
  swing: 0.06,
  calm: [
    pad({ level: 0.13, hz: 800, attack: 0.7, wave: 'triangle' }),
    arp(ACT2_ROLL.map((k, s) => (s % 2 ? -1 : k)), { level: 0.42, wave: 'triangle', dur: 2.2, hz: 3000, echo: 0.5 }),
    melody('base', (x, m, len) => x.b.flute(x, m, len, 0.26, 1)),
    bass(() => WHOLE, { level: 0.24, hz: [700, 300], sub: 1.3 }, 'base'),
    riser(0.3),
    chime(88, 0.7),
  ],
  intense: [
    pad({ level: 0.19, hz: 1100, attack: 0.3 }),
    arp(ACT2_ROLL, { level: 1.2, wave: 'triangle', dur: 1.6, hz: 4000, echo: 0.45 }),
    melody('base', (x, m) => x.b.bell(x, m, 0.3 * x.lead, 'kalimba')),
    perc(['--o---x---o---x-'], (x, v) => x.b.shaker(x, x.t + (x.s % 2 ? x.song.swing * x.STEP : 0), v * 0.8)),
    perc(['..x...x...x...xo'], (x, v) => x.b.rim(x, x.t, v)),
    perc(['X.........x.....'], (x, v) => x.b.bodhran(x, x.t, v)),
    riser(0.7),
    kit({
      kick: ['X.....x...x.....', 'X.....x...x...x.'],
      snare: ['........X.....-.'],
      hats: ['x-o-x-o-x-o-x-o-'],
      open: ['................', '......x.........'],
      clap: true,
      fill: { kick: 'X.....x.........', snare: '........X.......', hats: 'x-o-x-o-........', toms: '........X.x.X.x.' },
      crash: [0],
      level: 0.75,
    }),
    bass(() => ACT2_BASS, { level: 0.36, hz: [1500, 450], sub: 1.4 }),
    melody('lead', (x, m, len) => x.b.lead(x, m, len, 0.17, 'square', 2600)),
  ],
};

// Act 3, Boar King's Hollow: C minor (a B natural for the dread), 140 BPM. A martial hook (da-da-da-DUM) over war
// drums that never stop.
const ACT3_BASS = bassBar('0:1 . 0:1 . 0:1 . 0:1 . 0:1 . 0:1 . 12:1 . 0:1 .');
const ACT3: Song = {
  track: 'act3',
  name: "Boar King's Hollow",
  key: 'C minor',
  bpm: 140,
  meter: 16,
  beat: 4,
  bars: 8,
  chords: chords('Cm | Ab | Bb | G | Cm | Ab | Fm G | Cm'),
  melody: mel(
    16,
    'c5:2 c5:1 eb5:1 g5:4 f5:2 eb5:2 d5:4 | eb5:2 eb5:1 f5:1 ab5:4 g5:2 f5:2 eb5:4 | d5:2 d5:1 eb5:1 f5:4 bb5:4 ab5:4 | g5:8 b4:4 d5:4 |' +
      'c5:2 c5:1 eb5:1 g5:4 f5:2 eb5:2 d5:4 | eb5:2 eb5:1 f5:1 ab5:4 c6:4 bb5:4 | ab5:3 g5:1 f5:2 ab5:2 g5:2 f5:2 d5:2 b4:2 | c5:8 r:4 g4:2 b4:2',
  ),
  echo: 0.3,
  swing: 0,
  calm: [
    pad({ level: 0.11, hz: 650, attack: 0.6, shift: -12 }),
    arp([0, -1, 2, -1, 0, -1, 2, -1, 0, -1, 2, -1, 1, -1, 2, -1], { level: 0.55, dur: 1.2, hz: 2200 }),
    melody('base', (x, m, len) => x.b.flute(x, m, len, 0.35)),
    bass(() => WHOLE, { level: 0.26, hz: [600, 280], sub: 1.4 }, 'base'),
    perc(['X..x............'], (x, v) => x.b.taiko(x, x.t, v * 0.4)), // a distant heartbeat
    riser(0.3),
  ],
  intense: [
    pad({ level: 0.22, hz: 1100, attack: 0.1, shift: -12 }),
    arp([0, 0, 2, 0, 1, 0, 2, 0, 0, 0, 2, 0, 3, 2, 1, 0], { level: 1.3, hz: 2600 }),
    melody('base', (x, m, len) => x.b.horn(x, m - 12, len, 0.4 * x.lead)),
    // war drums: low taiko in a 3-3-2 drive, a rim crack on the backbeat
    perc(['X..x..x.X..x..x.', 'X..x..x.X..x.xx.'], (x, v) => x.b.taiko(x, x.t, v * 1.25)),
    perc(['....x.......x...'], (x, v) => x.b.taiko(x, x.t, v * 1.6, true)),
    riser(0.8),
    kit({
      kick: ['X...X...X...X...', 'X...X...X...X.x.'],
      snare: ['....X.......X...'],
      hats: ['x.o.x.o.x.o.x.o.', 'x.o.x.o.x.oox.oo'],
      clap: true,
      fill: { kick: 'X...X...X.......', snare: '....X...........', hats: 'x.o.x.o.........', toms: '........X.X.XxXx' },
      crash: [0, 4],
      level: 0.85,
    }),
    bass(() => ACT3_BASS, { level: 0.38, hz: [2000, 500], sub: 1.3 }),
    part('lead', (x) => {
      if (!x.note) return;
      const [m, n] = x.note;
      x.b.lead(x, m, n * x.STEP, 0.25, 'sawtooth', 3000);
      x.b.lead(x, m - 12, n * x.STEP, 0.11, 'sawtooth', 3000, false);
    }),
  ],
};

// The Bandit Captain: a swashbuckling jig. A minor, 6/8 at 104 dotted quarters: accordion chops on the "pah"s, a
// bodhran, a tremolo mandolin, and a fiddle that takes the tune once the combo is up.
const CAPTAIN_BASS = ['0:2 . . . . . 7:2 . . . . .', '0:2 . . . . . 7:2 . 5:2 . 4:2 .', '0:2 . . . . . 7:2 . . . -5:2 .'].map(bassBar);
const CAPTAIN: Song = {
  track: 'captain',
  name: 'Bandit Captain',
  key: 'A minor',
  bpm: 104,
  meter: 12,
  beat: 6,
  bars: 8,
  chords: chords('Am | G | Am | E | Am | C G | F E | Am'),
  melody: mel(
    12,
    'a4:2 c5:2 e5:2 a5:4 g5:2 | g5:2 f5:2 e5:2 d5:4 b4:2 | c5:2 e5:2 a5:2 c6:4 b5:2 | b5:4 g#5:2 e5:6 |' +
      'a4:2 c5:2 e5:2 a5:4 g5:2 | e5:2 g5:2 c6:2 b5:2 a5:2 g5:2 | a5:2 f5:2 d5:2 b4:2 g#4:2 b4:2 | a4:6 e5:2 d5:2 c5:2',
  ),
  echo: 0.25,
  swing: 0,
  intense: [
    pad({ level: 0.11, hz: 1600, attack: 0.05, wave: 'square', detune: 9 }),
    part('base', (x) => (x.s === 2 || x.s === 4 || x.s === 8 || x.s === 10) && x.b.chop(x, 0.24)),
    melody('base', (x, m, len) => x.b.mandolin(x, m, len, 0.32 * x.lead)),
    perc(['X.o.o.x.o.o.', 'X.o.o.x.o.ox'], (x, v) => x.b.bodhran(x, x.t, v * 1.3)),
    perc(['......x.....'], (x, v) => x.b.tamb(x, x.t, v * 1.3)),
    riser(0.6, 1),
    kit({
      kick: ['X.....x.....', 'X.....x...x.'],
      snare: ['......X.....'],
      hats: ['x.o.o.x.o.o.'],
      clap: true,
      fill: { snare: '......XoxoXx', hats: 'x.o.o.......' },
      crash: [0],
      level: 0.85,
    }),
    bass((bar) => CAPTAIN_BASS[bar === 3 ? 1 : bar === 7 ? 2 : 0], { level: 0.4, hz: [1600, 480], sub: 1.5 }),
    melody('lead', (x, m, len) => x.b.fiddle(x, m, len, 0.2)),
  ],
};

// The Ruin Golem: slow and heavy. D minor with a Phrygian E flat, 74 BPM: stone stomps on 1 and 3, a dark choir,
// a stone horn an octave down, a grinding bass.
const GOLEM_BASS = bassBar('0:6 . . . . . 0:2 . 0:4 . . . 1:2 . 0:2 .');
const GOLEM: Song = {
  track: 'golem',
  name: 'Ruin Golem',
  key: 'D Phrygian',
  bpm: 74,
  meter: 16,
  beat: 4,
  bars: 8,
  chords: chords('Dm | Eb | Dm | C | Dm | Eb | Bb C | Dm'),
  melody: mel(16, 'd5:8 eb5:4 d5:4 | c5:4 bb4:4 g4:8 | a4:8 bb4:4 a4:4 | g4:12 c5:4 | d5:8 f5:4 eb5:4 | d5:4 c5:4 bb4:8 | a4:4 bb4:4 c5:4 e5:4 | d5:16'),
  echo: 0.35,
  swing: 0,
  intense: [
    pad({ level: 0.17, hz: 750, attack: 0.6, shift: -12 }),
    part('base', (x) => (x.change || x.first) && x.b.choir(x, 0.12)),
    arp([0, -1, 0, -1, 1, -1, 0, -1, 0, -1, 0, -1, 2, -1, 1, -1], { level: 0.8, wave: 'pulse12', dur: 1.6, hz: 1300 }),
    melody('base', (x, m, len) => x.b.horn(x, m - 12, len, 0.36 * x.lead)),
    perc(['X.......X.......', 'X.......X.....o.'], (x, v) => x.b.stomp(x, x.t, v * 1.1)),
    riser(0.5),
    kit({
      kick: ['X.....x.........', 'X.....x.......x.'],
      snare: ['........X.......'],
      hats: ['x...o...x...o...'],
      clap: true,
      kickPitch: 0.85,
      level: 0.7,
      fill: { snare: '........X.......', hats: 'x...o...........', toms: '........X...X.XX' },
      crash: [0, 4],
    }),
    bass(() => GOLEM_BASS, { level: 0.3, hz: [1400, 380], sub: 1.2 }),
    melody('lead', (x, m, len) => x.b.lead(x, m, len, 0.25, 'sawtooth', 3200)),
  ],
};

// The Boar King: G minor, 156 BPM, a charge. A galloping line (da-da-DUM) under a hook that climbs by steps. His
// phases escalate it: phase 2 brings the drums and brass stabs in for good, phase 3 goes up a whole step (A minor)
// with everything in.
const BOAR_GALLOP = bassBar('0:1 . 0:1 0:1 0:1 . 0:1 0:1 0:1 . 0:1 0:1 0:1 12:1 7:1 5:1');
const BOAR_KING: Song = {
  track: 'boarKing',
  name: 'Boar King',
  key: 'G minor (phase 3: A minor)',
  bpm: 156,
  meter: 16,
  beat: 4,
  bars: 8,
  chords: chords('Gm | F | Eb | D | Gm | Bb | Eb D | Gm'),
  melody: mel(
    16,
    'g5:4 d5:2 g5:2 bb5:4 a5:2 g5:2 | a5:4 f5:2 a5:2 c6:4 bb5:2 a5:2 | bb5:4 g5:2 eb5:2 g5:4 bb5:4 | a5:8 f#5:4 d5:4 |' +
      'g5:4 d5:2 g5:2 bb5:4 a5:2 g5:2 | d6:4 c6:2 bb5:2 f5:4 bb5:4 | eb6:4 d6:2 c6:2 bb5:2 a5:2 f#5:4 | g5:8 r:4 d5:2 f#5:2',
  ),
  echo: 0.3,
  swing: 0,
  keyUp: 2,
  intense: [
    pad({ level: 0.19, hz: 1200, attack: 0.12, shift: -12 }),
    arp([0, 1, 2, 1, 0, 1, 2, 3, 0, 1, 2, 1, 3, 2, 1, 0], { level: 1.2, hz: 3000 }),
    melody('base', (x, m, len) => x.b.horn(x, m - 12, len, 0.38 * x.lead)),
    // the gallop on the toms
    perc(['X.xX..o.X.xX..o.'], (x, v) => (v >= 0.7 ? x.b.taiko(x, x.t, v * 1.1) : x.b.taiko(x, x.t, 1, true))),
    riser(0.8),
    part('drums', (x) => {
      // phase 3: the hats go to 16ths and the kick doubles
      const p3 = x.phase >= 3;
      const fill = x.last && x.s >= 8;
      const v = 0.85;
      const k = hit(p3 ? 'X.x.X.x.X.x.X.x.' : 'X..x....X..x....', x.s);
      if (k && !fill) x.b.kick(x, x.t, k * v, 1.05);
      const sn = fill ? hit('........XoxoXxXX', x.s) : hit('....X.......X...', x.s);
      if (sn) x.b.snare(x, x.t, sn * v, sn >= 1 && !fill);
      if (fill && x.s % 2 === 0) x.b.tom(x, x.t, 150 - (x.s - 8) * 9, (0.7 + (x.s - 8) * 0.04) * v);
      if ((x.bar === 0 || x.bar === 4) && x.s === 0) x.b.crash(x, x.t, v);
      else if (!fill) {
        const h = hit(p3 ? 'xoxoxoxoxoxoxoxo' : 'x.o.x.o.x.o.x.o.', x.s);
        if (h) x.b.hat(x, x.t, h * v);
      }
    }),
    bass(() => BOAR_GALLOP, { level: 0.34, hz: [2000, 520], sub: 1.4 }),
    part('lead', (x) => {
      if (!x.note) return;
      const [m, n] = x.note;
      x.b.lead(x, m, n * x.STEP, 0.23, 'pulse25', 3000);
      x.b.lead(x, m - 12, n * x.STEP, 0.12, 'sawtooth', 3000, false);
    }),
    // phase 2 on: brass stabs on the offbeats (every half bar; every beat in phase 3)
    part('stabs', (x) => {
      const on = x.phase >= 3 ? x.s % 4 === 2 : x.s === 6 || x.s === 14;
      if (on) x.b.stab(x, 2 * x.STEP, 0.42);
    }),
  ],
};

export const SONGS: Record<MusicTrack, Song> = { title: TITLE, camp: CAMP, act1: ACT1, act2: ACT2, act3: ACT3, captain: CAPTAIN, golem: GOLEM, boarKing: BOAR_KING };

/** Seconds per step of a piece. */
export const stepSec = (s: Song): number => 60 / s.bpm / s.beat;

/** Every piece in the Sound lab (the fight ones with a combo picker for their layers) and the level tests. */
export interface MusicPiece {
  id: string;
  label: string;
  track: MusicTrack;
  intense: boolean;
  phase?: number;
}
export const MUSIC_PIECES: MusicPiece[] = [
  { id: 'title', label: 'Title / world map', track: 'title', intense: false },
  { id: 'camp', label: 'Camp', track: 'camp', intense: false },
  { id: 'act1', label: 'Act 1: map', track: 'act1', intense: false },
  { id: 'act1-fight', label: 'Act 1: fight', track: 'act1', intense: true },
  { id: 'act2', label: 'Act 2: map', track: 'act2', intense: false },
  { id: 'act2-fight', label: 'Act 2: fight', track: 'act2', intense: true },
  { id: 'act3', label: 'Act 3: map', track: 'act3', intense: false },
  { id: 'act3-fight', label: 'Act 3: fight', track: 'act3', intense: true },
  { id: 'captain', label: 'Bandit Captain', track: 'captain', intense: true },
  { id: 'golem', label: 'Ruin Golem', track: 'golem', intense: true },
  { id: 'boarKing1', label: 'Boar King, phase 1', track: 'boarKing', intense: true, phase: 1 },
  { id: 'boarKing2', label: 'Boar King, phase 2', track: 'boarKing', intense: true, phase: 2 },
  { id: 'boarKing3', label: 'Boar King, phase 3', track: 'boarKing', intense: true, phase: 3 },
];

/** Which arrangement a piece plays when the game asks for calm or intense (the camp, the title and the bosses
 *  only have one). */
export function arrangementOf(song: Song, intense: boolean): Arrangement {
  return (intense && song.intense) || !song.calm ? 'intense' : 'calm';
}

// ---- the band ----

/** Linear fades on one or more params, tracked so a new fade starts from wherever the last one is at that time
 *  (explicit ramps only: the offline renderer the tests use applies a setTargetAtTime curve before its start). */
class Fader {
  private t0 = 0;
  private v0: number;
  private t1 = 0;
  private v1: number;

  constructor(
    readonly params: AudioParam[],
    v: number,
  ) {
    this.v0 = this.v1 = v;
    for (const p of params) p.value = v;
  }

  at(t: number): number {
    if (t >= this.t1) return this.v1;
    if (t <= this.t0) return this.v0;
    return this.v0 + ((this.v1 - this.v0) * (t - this.t0)) / (this.t1 - this.t0);
  }

  /** Ramp to v from t0 to t1. A fade still running at t0 is redrawn up to t0 and carries on from its value there. */
  to(v: number, t0: number, t1: number): void {
    t1 = Math.max(t1, t0 + 0.002);
    const from = this.at(t0);
    for (const p of this.params) {
      if (t0 > this.t0 && t0 < this.t1) {
        p.cancelScheduledValues(this.t0);
        p.setValueAtTime(this.v0, this.t0);
        p.linearRampToValueAtTime(from, t0);
      } else {
        p.cancelScheduledValues(t0);
        p.setValueAtTime(from, t0);
      }
      p.linearRampToValueAtTime(v, t1);
    }
    [this.t0, this.v0, this.t1, this.v1] = [t0, from, t1, v];
  }

  get target(): number {
    return this.v1;
  }
}

type Role = 'pad' | 'arp' | 'bell' | 'lead' | 'bass' | 'drums' | 'perc' | 'fx' | 'choir' | 'stab';
const ROLE_LAYER: Record<Role, Layer> = { pad: 'base', arp: 'base', bell: 'base', perc: 'base', fx: 'base', choir: 'base', lead: 'lead', bass: 'bass', drums: 'drums', stab: 'stabs' };

/** A part's sound: its layer gate (on every input) and its processing, into the group's dry and sends. */
interface Chain {
  gate: Fader;
  in: AudioNode; // pad, arpeggio: the left side; drums: the bodies (knock, snare tone, toms)
  r?: AudioNode; // pad, arpeggio: the right side
  tone?: BiquadFilterNode; // pad: its lowpass (opens into the loop point)
  duck?: GainNode; // pad, bass: the kick's sidechain
  kick?: AudioNode; // drums: into a drive, so a phone speaker plays the kick's harmonics
  snare?: AudioNode;
  hats?: AudioNode;
}

/** One arrangement of a piece playing. */
export interface Group {
  arr: Arrangement;
  out: Fader; // its dry, echo and hall sends together: the crossfade
  dry: GainNode;
  echo: GainNode;
  verb: GainNode;
  chains: Partial<Record<Role, Chain>>;
  live: boolean; // playing (or fading in)
  until: number; // faded out: its notes keep coming until then
  first: boolean;
  gate: Record<Layer, { on: boolean; until: number }>;
  lastDuck: number;
  nodes: AudioNode[];
}

/** A piece playing: where it is, its key of the moment and its arrangements. */
interface Deck {
  song: Song;
  step: number; // next step in the loop
  arr: Arrangement;
  groups: Partial<Record<Arrangement, Group>>;
  tr: number; // semitones up (the Boar King's phase 3)
  phase: number;
}

interface Rig {
  bus: GainNode;
  verb: AudioNode;
  echo: AudioNode;
  echoL: DelayNode;
  echoR: DelayNode;
  echoFb: GainNode[];
  echoAt: [number, number]; // the echo's delay time and feedback now (each piece glides them to its own)
  nodes: AudioNode[];
}

/** The scripted changes of a render (tests, Sound lab): at a step from the start, the game asks for this. */
export interface MusicCue {
  step: number;
  track?: MusicTrack;
  intense?: boolean;
  combo?: number;
  phase?: number;
}
export interface MusicRender {
  intense?: boolean;
  combo?: number;
  phase?: number;
  from?: number; // start at this step of the loop
  cues?: MusicCue[];
}

const MUSIC_TRIM = 1; // the whole band's level under the music bus (tuning.impact.music sets the volume)

export class Band {
  rig: Rig | null = null;
  /** ctx time of the next step to schedule. */
  next = 0;
  private deck: Deck | null = null;
  private want: { track: MusicTrack; intense: boolean } = { track: 'title', intense: false };
  private combo = 0;
  private phase = 1;

  constructor(private readonly h: MusicHost) {}

  get bus(): GainNode | null {
    return this.rig?.bus ?? null;
  }

  /** The piece playing (or the one asked for, before the music starts). */
  get track(): MusicTrack {
    return this.deck?.song.track ?? this.want.track;
  }

  /** The arrangement playing. */
  get arrangement(): Arrangement {
    return this.deck?.arr ?? arrangementOf(SONGS[this.want.track], this.want.intense);
  }

  /** Semitones the piece is up now (the Boar King's phase 3). */
  get key(): number {
    return this.deck?.tr ?? 0;
  }

  /** The fight layers sounding now (for the debug readout and tests). */
  get layers(): Layer[] {
    const g = this.deck?.groups.intense;
    if (!g || !g.live) return [];
    return (['base', ...GATED] as Layer[]).filter((l) => l === 'base' || g.gate[l].on);
  }

  setMusic(track: MusicTrack, intense: boolean): void {
    this.want = { track, intense };
  }

  setCombo(combo: number): void {
    this.combo = Math.max(0, combo);
  }

  setBossPhase(phase: number): void {
    this.phase = Math.max(1, Math.min(3, Math.round(phase) || 1));
  }

  /** The persistent graph: the bus, the ping-pong echo and the hall (about 15 nodes per music run). */
  start(level: number, at?: number): Rig {
    const ctx = this.h.ctx();
    const nodes: AudioNode[] = [];
    const keep = <T extends AudioNode>(n: T): T => (nodes.push(n), n);
    const gain = (v: number, to?: AudioNode): GainNode => {
      const g = keep(ctx.createGain());
      g.gain.value = v;
      if (to) g.connect(to);
      return g;
    };
    const filter = (type: BiquadFilterType, f: number, q: number, to: AudioNode): BiquadFilterNode => {
      const n = keep(ctx.createBiquadFilter());
      n.type = type;
      n.frequency.value = f;
      n.Q.value = q;
      n.connect(to);
      return n;
    };
    const bus = gain(0, gain(MUSIC_TRIM, this.h.out()));
    // the hall: a long, dark reverb for the music alone (ducked with it)
    const conv = keep(ctx.createConvolver());
    conv.buffer = this.h.hall();
    conv.connect(gain(0.6, bus));
    const verb = filter('highpass', 320, 0.7, conv);
    // ping-pong echo: left, then right, a little darker each time round
    const merge = keep(ctx.createChannelMerger(2));
    merge.connect(gain(0.55, bus));
    const echoL = keep(ctx.createDelay(1.5));
    const echoR = keep(ctx.createDelay(1.5));
    echoL.connect(merge, 0, 0);
    echoR.connect(merge, 0, 1);
    const fb1 = gain(0.35, echoR);
    echoL.connect(fb1);
    const fb2 = gain(0.35, echoL);
    echoR.connect(filter('lowpass', 2400, 0.5, fb2));
    const echo = filter('highpass', 380, 0.7, echoL);
    this.rig = { bus, verb, echo, echoL, echoR, echoFb: [fb1, fb2], echoAt: [0.3, 0.35], nodes };
    if (at !== undefined) bus.gain.setValueAtTime(level, at);
    else {
      const t = ctx.currentTime;
      bus.gain.setValueAtTime(0, t);
      bus.gain.linearRampToValueAtTime(level, t + 0.06);
    }
    this.deck = null;
    return this.rig;
  }

  /** Tear the music down (the caller has faded the bus out): disconnect everything after `ms`. */
  stop(ms: number): void {
    const rig = this.rig;
    const d = this.deck;
    this.rig = null;
    this.deck = null;
    if (!rig) return;
    const all = [...rig.nodes, ...Object.values(d?.groups ?? {}).flatMap((g) => g.nodes)];
    setTimeout(() => all.forEach((n) => n.disconnect()), ms);
  }

  /** Schedule every step that starts before ctx time `until`. */
  advance(until: number): void {
    if (!this.rig) return;
    while (this.next < until) this.step();
  }

  /** Schedule `steps` steps of a piece from ctx time `at` (tests and offline renders), with scripted changes. */
  render(at: number, steps: number, track: MusicTrack, o: MusicRender, level: number): void {
    if (!this.rig) this.start(level, at);
    this.want = { track, intense: o.intense ?? false };
    this.combo = o.combo ?? 0;
    this.phase = o.phase ?? 1;
    this.next = at;
    this.deck = this.newDeck(at, o.from ?? 0);
    const cues = o.cues ?? [];
    for (let i = 0; i < steps; i++) {
      for (const c of cues) {
        if (c.step !== i) continue;
        if (c.track !== undefined || c.intense !== undefined) this.setMusic(c.track ?? this.want.track, c.intense ?? this.want.intense);
        if (c.combo !== undefined) this.setCombo(c.combo);
        if (c.phase !== undefined) this.setBossPhase(c.phase);
      }
      this.step();
    }
  }

  private step(): void {
    const t = this.next;
    let d = (this.deck ??= this.newDeck(t, 0));
    const s = d.step % d.song.meter;
    if (s % d.song.beat === 0) d = this.onBeat(d, t, s);
    const song = d.song;
    const STEP = stepSec(song);
    for (const g of Object.values(d.groups)) if (g.live || t < g.until) this.play(d, g, t, STEP);
    this.next = t + STEP;
    d.step = (d.step + 1) % (song.bars * song.meter);
  }

  /** A new piece from step `step` at ctx time t: the arrangement asked for, its layers as the combo stands. */
  private newDeck(t: number, step: number): Deck {
    const song = SONGS[this.want.track];
    const phase = song.keyUp ? this.phase : 1;
    const d: Deck = { song, step: step % (song.bars * song.meter), arr: arrangementOf(song, this.want.intense), groups: {}, tr: phase >= 3 ? song.keyUp! : 0, phase };
    this.echoFor(song, t);
    const g = this.group(d, d.arr);
    g.out.to(1, t, t + 0.01);
    g.live = true;
    this.gates(d, g, t, true);
    return d;
  }

  /** On a beat: switch pieces, crossfade arrangements, move the layers; on a bar: the boss phase (and key). */
  private onBeat(d: Deck, t: number, s: number): Deck {
    const m = this.h.tuning().music;
    if (this.want.track !== d.song.track) {
      this.ringOut(d, t, Math.max(0.05, m.ringOut));
      return (this.deck = this.newDeck(t, 0));
    }
    if (s === 0 && d.song.keyUp && d.phase !== this.phase) {
      d.phase = this.phase;
      const tr = d.phase >= 3 ? d.song.keyUp : 0;
      const g = d.groups.intense;
      if (g?.live && (tr !== d.tr || d.phase >= 2)) this.crash(this.ctxStep(d, g, t), t, 1);
      d.tr = tr;
    }
    const want = arrangementOf(d.song, this.want.intense);
    if (want !== d.arr) {
      const beat = d.song.beat * stepSec(d.song);
      const x = beat * Math.max(1, Math.round(Math.max(0, m.crossfade) / beat));
      const from = d.groups[d.arr]!;
      from.out.to(0, t, t + x);
      from.live = false;
      from.until = t + x;
      const to = this.group(d, want);
      const playing = to.live || t < to.until; // (still fading out: it carries on, no new pad)
      to.out.to(1, t, t + x);
      to.live = true;
      to.first = !playing;
      this.gates(d, to, t, !playing);
      d.arr = want;
    } else {
      const g = d.groups[d.arr];
      if (g) this.gates(d, g, t, false);
    }
    return d;
  }

  /** Whether a fight layer plays: the combo (tuning.music) or the boss phase brings it in. */
  private layerOn(d: Deck, l: Layer): boolean {
    const m = this.h.tuning().music;
    const c = this.combo;
    const p = d.phase;
    switch (l) {
      case 'drums':
        return c >= m.drumsAt || p >= 2;
      case 'bass':
        return c >= m.bassAt || p >= 3;
      case 'lead':
        return c >= m.leadAt || p >= 3;
      case 'stabs':
        return p >= 2;
      default:
        return true;
    }
  }

  /** Move a group's layer gates to where the combo and phase want them: in on the beat at t (a short fade landing
   *  on it), out over tuning.music.layerOut from it. `now`: straight there (the arrangement is just starting). */
  private gates(d: Deck, g: Group, t: number, now: boolean): void {
    if (g.arr !== 'intense') return;
    const m = this.h.tuning().music;
    for (const l of GATED) {
      const on = this.layerOn(d, l);
      const st = g.gate[l];
      if (on === st.on && !now) continue;
      st.on = on;
      const fade = now ? 0.002 : on ? Math.max(0.005, m.layerIn) : Math.max(0.02, m.layerOut);
      st.until = on ? Infinity : now ? t : t + fade;
      for (const [role, c] of Object.entries(g.chains) as [Role, Chain][]) {
        if (ROLE_LAYER[role] !== l) continue;
        if (now) c.gate.to(on ? 1 : 0, t, t + fade);
        else if (on) c.gate.to(1, Math.max(0, t - fade), t);
        else c.gate.to(0, t, t + fade);
      }
    }
  }

  /** The last piece fades out from t over `time` (its tails ring on in the hall) and is torn down after. */
  private ringOut(d: Deck, t: number, time: number): void {
    const groups = Object.values(d.groups);
    for (const g of groups) {
      g.out.to(0, t, t + time);
      g.live = false;
      g.until = t;
    }
    if (this.h.offline) return;
    const ctx = this.h.ctx();
    setTimeout(() => groups.forEach((g) => g.nodes.forEach((n) => n.disconnect())), (t + time + 2.5 - ctx.currentTime) * 1000);
  }

  /** The echo glides to the piece's dotted 8th and feedback. */
  private echoFor(song: Song, t: number): void {
    const rig = this.rig!;
    const [time, fb] = rig.echoAt;
    const to = Math.min(1.4, 3 * stepSec(song));
    const glide = (p: AudioParam, from: number, v: number) => {
      p.cancelScheduledValues(t);
      p.setValueAtTime(from, t);
      p.linearRampToValueAtTime(v, t + 0.05);
    };
    for (const n of [rig.echoL, rig.echoR]) glide(n.delayTime, time, to);
    for (const g of rig.echoFb) glide(g.gain, fb, song.echo);
    rig.echoAt = [to, song.echo];
  }

  /** An arrangement's group: its fade and sends (the chains are built as its parts first play). */
  private group(d: Deck, arr: Arrangement): Group {
    const have = d.groups[arr];
    if (have) return have;
    const ctx = this.h.ctx();
    const rig = this.rig!;
    const dry = ctx.createGain();
    const echo = ctx.createGain();
    const verb = ctx.createGain();
    dry.connect(rig.bus);
    echo.connect(rig.echo);
    verb.connect(rig.verb);
    const off = () => ({ on: arr === 'calm', until: 0 });
    const g: Group = {
      arr,
      out: new Fader([dry.gain, echo.gain, verb.gain], 0),
      dry,
      echo,
      verb,
      chains: {},
      live: false,
      until: 0,
      first: true,
      gate: { base: { on: true, until: Infinity }, drums: off(), bass: off(), lead: off(), stabs: off() },
      lastDuck: -1,
      nodes: [dry, echo, verb],
    };
    d.groups[arr] = g;
    return g;
  }

  /** A part's chain in a group, built on first use (o: its filter, its echo send). */
  chain(g: Group, role: Role, o: { hz?: number; echo?: number } = {}): Chain {
    const have = g.chains[role];
    if (have) return have;
    const ctx = this.h.ctx();
    const keep = <T extends AudioNode>(n: T): T => (g.nodes.push(n), n);
    const gain = (v: number, to?: AudioNode): GainNode => {
      const n = keep(ctx.createGain());
      n.gain.value = v;
      if (to) n.connect(to);
      return n;
    };
    const filter = (type: BiquadFilterType, f: number, q: number, to?: AudioNode): BiquadFilterNode => {
      const n = keep(ctx.createBiquadFilter());
      n.type = type;
      n.frequency.value = f;
      n.Q.value = q;
      if (to) n.connect(to);
      return n;
    };
    const pan = (p: number, to?: AudioNode): StereoPannerNode => {
      const n = keep(ctx.createStereoPanner());
      n.pan.value = p;
      if (to) n.connect(to);
      return n;
    };
    /** The chain's end: into the group's dry, and its echo and hall sends. */
    const out = <T extends AudioNode>(from: T, echo: number, verb: number): T => {
      from.connect(g.dry);
      if (echo) from.connect(gain(echo, g.echo));
      if (verb) from.connect(gain(verb, g.verb));
      return from;
    };
    // every input is a gain: together they're the layer gate
    const ins: GainNode[] = [];
    const input = (to: AudioNode, port = 0): GainNode => {
      const n = gain(1);
      n.connect(to, 0, port);
      ins.push(n);
      return n;
    };
    let c: Omit<Chain, 'gate'>;
    if (role === 'pad') {
      const duck = out(gain(1), 0, 0.6);
      const tone = filter('lowpass', o.hz ?? 1200, 0.9, duck);
      const merge = keep(ctx.createChannelMerger(2));
      merge.connect(tone);
      c = { in: input(merge, 0), r: input(merge, 1), tone, duck };
    } else if (role === 'arp') {
      const tone = out(filter('lowpass', o.hz ?? 3600, 0.5), o.echo ?? 0.25, 0.2);
      c = { in: input(pan(-0.55, tone)), r: input(pan(0.55, tone)) };
    } else if (role === 'bell') c = { in: input(pan(0.2, out(filter('lowpass', o.hz ?? 7000, 0.5), o.echo ?? 0.3, 0.35))) };
    else if (role === 'lead') c = { in: input(out(filter('lowpass', o.hz ?? 3400, 0.6), o.echo ?? 0.32, 0.3)) };
    else if (role === 'choir') c = { in: input(pan(0.1, out(gain(1), 0, 0.5))) };
    else if (role === 'stab') c = { in: input(pan(-0.15, out(filter('lowpass', o.hz ?? 3000, 0.6), 0.15, 0.4))) };
    else if (role === 'bass') {
      const duck = gain(1, g.dry);
      c = { in: input(filter('lowpass', 1600, 0.6, duck)), duck };
    } else if (role === 'drums') {
      const drums = gain(1, g.dry);
      const drive = keep(ctx.createWaveShaper());
      drive.curve = this.h.drive(2) as Float32Array<ArrayBuffer>;
      drive.connect(drums);
      const snare = filter('bandpass', 1800, 0.7, drums);
      snare.connect(gain(0.35, g.verb));
      c = { in: input(drums), kick: input(drive), snare: input(snare), hats: input(filter('highpass', 6500, 0.6, pan(0.3, g.dry))) };
    } else if (role === 'perc') c = { in: input(out(pan(-0.3), 0, 0.3)) };
    else c = { in: input(out(gain(1), 0, 0.8)) }; // fx
    const l = ROLE_LAYER[role];
    const on = g.arr === 'calm' || l === 'base' || g.gate[l].on;
    const chain: Chain = { ...c, gate: new Fader(ins.map((n) => n.gain), on ? 1 : 0) };
    g.chains[role] = chain;
    return chain;
  }

  /** The step context of a group (for one-off sounds outside the parts). */
  private ctxStep(d: Deck, g: Group, t: number): Step {
    return this.stepOf(d, g, t, stepSec(d.song));
  }

  private stepOf(d: Deck, g: Group, t: number, STEP: number): Step {
    const song = d.song;
    const i = d.step;
    const bar = Math.floor(i / song.meter);
    const s = i % song.meter;
    const cs = song.chords[bar];
    const split = cs.length > 1 ? (song.split ?? song.meter / 2) : song.meter;
    const second = s >= split;
    const c = cs[second ? 1 : 0];
    const tr = d.tr;
    const n = song.melody[i];
    return {
      b: this,
      g,
      song,
      i,
      bar,
      s,
      t,
      STEP,
      chord: tr ? { root: c.root + tr, tones: c.tones.map((m) => m + tr) } : c,
      change: s === 0 || s === split,
      left: ((second ? song.meter : split) - s) * STEP,
      note: n && tr ? [n[0] + tr, n[1]] : n,
      last: bar === song.bars - 1,
      first: g.first,
      phase: d.phase,
      lead: g.arr === 'intense' && g.gate.lead.on ? 0.5 : 1,
    };
  }

  /** Play one step of one arrangement: every part whose layer is in (or still fading out). */
  private play(d: Deck, g: Group, t: number, STEP: number): void {
    const parts = d.song[g.arr];
    if (!parts) return;
    const x = this.stepOf(d, g, t, STEP);
    for (const p of parts) {
      if (g.arr === 'intense' && p.layer !== 'base') {
        const st = g.gate[p.layer];
        if (!st.on && t >= st.until) continue;
      }
      p.play(x);
    }
    g.first = false;
  }

  // ---------------------------------------------------------------- instruments

  /** The chord on the pad: three notes, each a pair of voices detuned against each other, one per side, through a
   *  lowpass that opens over the loop's last bar. */
  pad(x: Step, o: PadOpts): void {
    const c = this.chain(x.g, 'pad', { hz: o.hz });
    const len = x.left;
    const lp = c.tone!.frequency;
    if (x.first) {
      // (back after a rest: wherever its last swell left the filter, it starts from rest)
      lp.cancelScheduledValues(x.t);
      lp.setValueAtTime(o.hz, x.t);
    }
    if (o.swell !== false) {
      if (x.last && x.s === 0) {
        lp.setValueAtTime(o.hz, x.t);
        lp.exponentialRampToValueAtTime(o.hz * 3.2, x.t + x.song.meter * x.STEP);
      } else if (x.bar === 0 && x.s === 0) lp.exponentialRampToValueAtTime(o.hz, x.t + 0.35);
    }
    const det = o.detune ?? 7;
    for (const m of x.chord.tones.slice(0, 3)) {
      const f = hz(m + (o.shift ?? 0));
      for (const [out, cents] of [
        [c.in, -det],
        [c.r!, det],
      ] as const)
        this.h.tone({ type: o.wave ?? 'sawtooth', f, detune: cents, at: x.t, attack: o.attack, hold: Math.max(0, len - o.attack), dur: len + 0.5, minTail: 0.5, gain: o.level, out });
    }
  }

  /** A plucked note on the arpeggio's sides (alternating). */
  pluck(x: Step, m: number, o: { wave: Wave; level: number; dur: number; hz?: number; echo?: number }): void {
    const c = this.chain(x.g, 'arp', { hz: o.hz, echo: o.echo });
    this.h.tone({ type: o.wave, f: hz(m), at: x.t, attack: 0.003, dur: o.dur, gain: o.level, out: x.s % 2 ? c.r : c.in });
  }

  /** A music box note: a triangle and a soft sine an octave up, alternating sides on the beats. */
  box(x: Step, m: number, level: number): void {
    const c = this.chain(x.g, 'arp');
    const f = hz(m);
    const out = x.s % 4 ? c.r : c.in;
    this.h.tone({ type: 'triangle', f, at: x.t, dur: x.STEP * 2.2, gain: 0.45 * level, out });
    this.h.tone({ type: 'sine', f: f * 2, at: x.t, dur: x.STEP * 1.4, gain: 0.18 * level, out });
  }

  /** The melody on a bell: inharmonic sine partials (a glockenspiel, or a softer kalimba). */
  bell(x: Step, m: number, level: number, kind: 'glock' | 'kalimba' = 'glock'): void {
    const c = this.chain(x.g, 'bell');
    const f = hz(m);
    const [p2, p3] = kind === 'glock' ? [2.76, 5.4] : [3.01, 6.2];
    this.h.tone({ type: 'sine', f, at: x.t, attack: 0.002, dur: kind === 'glock' ? 0.7 : 0.9, gain: level, out: c.in });
    this.h.tone({ type: 'sine', f: f * p2, at: x.t, attack: 0.001, dur: 0.25, gain: level * (kind === 'glock' ? 0.4 : 0.25), out: c.in });
    this.h.tone({ type: 'sine', f: f * p3, at: x.t, attack: 0.001, dur: 0.08, gain: level * 0.2, out: c.in });
  }

  /** A soft flute: a triangle with a quiet pulse, vibrato blooming on the long notes, a breath at the start. */
  flute(x: Step, m: number, len: number, level: number, breath = 0.5): void {
    const c = this.chain(x.g, 'lead', { hz: 4200 });
    const f = hz(m);
    const vib = len >= 4 * x.STEP ? { rate: 5.2, cents: 0, cents1: 16 } : undefined;
    const amp: Pts = [[0.03, level], [Math.max(0.04, len * 0.55), level * 0.8], [Math.max(0.06, len * 0.97), 0]];
    this.h.voice({ at: x.t, type: 'triangle', f: [[0, f]], vib, amp, out: c.in });
    this.h.voice({ at: x.t, type: 'pulse25', f: [[0, f]], vib, amp: scale(amp, 0.14), out: c.in });
    if (breath) this.h.noise({ at: x.t, dur: 0.09, attack: 0.02, gain: 0.25 * breath * level, filter: 'bandpass', f: Math.min(8000, f * 3), q: 1.5, out: c.in });
  }

  /** The lead: a pulse (or other wave) with a quieter detuned saw (a light chorus), scooping up into pitch,
   *  vibrato blooming on long notes; through the lead lowpass into the echo and the hall. */
  lead(x: Step, m: number, len: number, level: number, wave: Wave, lp: number, vib = true): void {
    const c = this.chain(x.g, 'lead', { hz: lp });
    const t = x.t;
    const f = hz(m);
    const end = t + len * 0.95 + 0.04;
    const a = this.h.osc(wave, f);
    const b = this.h.osc('sawtooth', f);
    a.detune.setValueAtTime(-30, t);
    a.detune.linearRampToValueAtTime(0, t + 0.03);
    b.detune.setValueAtTime(-22, t);
    b.detune.linearRampToValueAtTime(8, t + 0.03);
    const ctx = this.h.ctx();
    const bl = ctx.createGain();
    bl.gain.value = 0.3;
    b.connect(bl);
    const { g } = this.h.env(level, t, 0.006, len * 0.5, len * 0.95, 0.04);
    a.connect(g);
    bl.connect(g);
    g.connect(c.in);
    const nodes: AudioNode[] = [a, b, bl, g];
    if (vib && len >= 4 * x.STEP) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.4;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(0, t + 0.15);
      depth.gain.linearRampToValueAtTime(14, t + len);
      lfo.connect(depth);
      depth.connect(a.detune);
      depth.connect(b.detune);
      lfo.start(t);
      lfo.stop(end);
      nodes.push(lfo, depth);
    }
    a.onended = () => nodes.forEach((n) => n.disconnect());
    a.start(t);
    b.start(t);
    a.stop(end);
    b.stop(end);
  }

  /** A brassy horn: a saw whose lowpass opens on the attack and settles, swelling in. */
  horn(x: Step, m: number, len: number, level: number): void {
    const c = this.chain(x.g, 'bell');
    const f = hz(m);
    const l = Math.max(0.1, len);
    const vib = len >= 4 * x.STEP ? { rate: 5, cents: 0, cents1: 10 } : undefined;
    this.h.voice({ at: x.t, type: 'sawtooth', f: [[0, f]], vib, filter: 'lowpass', ff: [[0, 450], [0.06, 1900], [l, 900]], q: 0.8, amp: [[0.04, level], [l * 0.7, level * 0.75], [l * 0.95, 0]], out: c.in });
  }

  /** A fiddle: a bright saw with a quick bow attack and vibrato on the long notes, a faint octave above. */
  fiddle(x: Step, m: number, len: number, level: number): void {
    const c = this.chain(x.g, 'lead', { hz: 3800, echo: 0.25 });
    const f = hz(m);
    const l = Math.max(0.08, len);
    const vib = len >= 3 * x.STEP ? { rate: 6.2, cents: 4, cents1: 22 } : { rate: 6.2, cents: 4 };
    const amp: Pts = [[0.02, level], [l * 0.8, level * 0.85], [l * 0.97, 0]];
    this.h.voice({ at: x.t, type: 'sawtooth', f: [[0, f * 0.985], [0.03, f]], vib, filter: 'peaking', ff: [[0, 2200]], q: 1.5, amp, out: c.in });
    this.h.voice({ at: x.t, type: 'pulse12', f: [[0, f * 2]], amp: scale(amp, 0.25), out: c.in });
  }

  /** A mandolin: a bright pluck, tremolo-picked on the long notes. */
  mandolin(x: Step, m: number, len: number, level: number): void {
    const c = this.chain(x.g, 'bell');
    const f = hz(m);
    const n = len >= 3.5 * x.STEP ? Math.floor(len / x.STEP) : 1;
    for (let i = 0; i < n; i++) {
      const t = x.t + i * x.STEP;
      const v = level * (i ? 0.55 - 0.05 * (i % 2) : 1);
      this.h.tone({ type: 'pulse12', f, at: t, attack: 0.002, dur: i < n - 1 ? x.STEP * 1.1 : 0.3, gain: v, out: c.in });
      this.h.tone({ type: 'triangle', f, at: t, attack: 0.002, dur: 0.2, gain: v * 0.8, out: c.in });
    }
  }

  /** A plucked guitar string: a triangle that rings, with a short bright saw for the pick. */
  guitar(x: Step, t: number, m: number, level: number): void {
    const c = this.chain(x.g, 'arp', { hz: 2600, echo: 0.15 });
    const f = hz(m);
    const out = m < 60 ? c.in : c.r;
    this.h.tone({ type: 'triangle', f, at: t, attack: 0.003, dur: 1.5, gain: level, out });
    this.h.voice({ at: t, type: 'sawtooth', f: [[0, f]], filter: 'lowpass', ff: [[0, 2600], [0.25, 500]], amp: [[0.003, level * 0.35], [0.3, 0]], out });
  }

  /** An accordion chop: the chord's three tones, short, on a reedy pulse. */
  chop(x: Step, level: number): void {
    const c = this.chain(x.g, 'arp', { hz: 2400, echo: 0.1 });
    x.chord.tones.slice(0, 3).forEach((m, i) => this.h.tone({ type: 'pulse25', f: hz(m), detune: i % 2 ? 6 : -6, at: x.t, attack: 0.006, hold: x.STEP * 0.6, dur: x.STEP * 1.5, gain: level, out: x.s % 4 ? c.r : c.in }));
  }

  /** Brass stabs: the chord on saws whose lowpass flares open and closes. */
  stab(x: Step, len: number, level: number): void {
    const c = this.chain(x.g, 'stab');
    for (const m of x.chord.tones.slice(0, 3))
      this.h.voice({ at: x.t, type: 'sawtooth', f: [[0, hz(m)]], filter: 'lowpass', ff: [[0, 700], [0.025, 3400], [len, 900]], q: 1, amp: [[0.008, level], [len * 0.5, level * 0.6], [len, 0]], out: c.in });
  }

  /** A low choir under a chord: two detuned pulses through an "aah" formant, swelling in. */
  choir(x: Step, level: number): void {
    const c = this.chain(x.g, 'choir');
    const len = x.left;
    for (const [m, det] of [
      [x.chord.tones[0], -8],
      [x.chord.tones[2], 8],
    ] as const)
      this.h.voice({
        at: x.t,
        type: 'pulse25',
        f: [[0, hz(m - 12)]],
        vib: { rate: 4.6, cents: det },
        filter: 'bandpass',
        ff: [[0, 750]],
        q: 2,
        amp: [[Math.min(0.8, len * 0.4), level], [len, level * 0.7], [len + 0.4, 0]],
        out: c.in,
      });
  }

  /** The bass: a saw whose resonant lowpass plucks shut (the growl a phone speaker can play) over a sine sub an
   *  octave down (on the fundamental for the lowest notes), ducked under the kick. */
  bass(x: Step, m: number, dur: number, o: BassOpts): void {
    const c = this.chain(x.g, 'bass');
    const ctx = this.h.ctx();
    const t = x.t;
    const f = hz(m);
    const saw = this.h.osc('sawtooth', f);
    const sub = this.h.osc('sine', f >= 80 ? f / 2 : f);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2.5;
    lp.frequency.setValueAtTime(o.hz[0], t);
    lp.frequency.exponentialRampToValueAtTime(o.hz[1], t + Math.min(0.14, dur));
    const subLevel = ctx.createGain();
    subLevel.gain.value = o.sub;
    const { g, end } = this.h.env(o.level, t, 0.004, dur * 0.6, dur, 0.04);
    saw.connect(lp);
    lp.connect(g);
    sub.connect(subLevel);
    subLevel.connect(g);
    g.connect(c.in);
    saw.onended = () => [saw, sub, lp, subLevel, g].forEach((n) => n.disconnect());
    saw.start(t);
    sub.start(t);
    saw.stop(end + 0.02);
    sub.stop(end + 0.02);
  }

  /** A noise riser (band sweeping up, swelling) over `d` seconds into the loop point. */
  riser(x: Step, d: number, level: number): void {
    const c = this.chain(x.g, 'fx');
    this.h.voice({ at: x.t, type: 'noise', filter: 'bandpass', ff: [[0, 450], [d, 7000]], q: 1.3, amp: [[d * 0.5, 0.05 * level], [d * 0.97, 0.2 * level], [d + 0.015, 0]], out: c.in });
  }

  /** A chime into the hall (the top of a calm loop). */
  chime(x: Step, m: number, level: number): void {
    const c = this.chain(x.g, 'fx');
    const f = hz(m);
    this.h.tone({ type: 'sine', f, at: x.t, dur: 0.9, gain: 0.05 * level, out: c.in });
    this.h.tone({ type: 'sine', f: f * 2.76, at: x.t, dur: 0.35, gain: 0.02 * level, out: c.in });
  }

  // drums: the fight layer's kit

  /** Kick: a sine thump with a fast pitch drop into a drive, a knock and a click (what a phone speaker plays of
   *  it); the pad and the bass duck under it and breathe back (sidechain). */
  kick(x: Step, t: number, v: number, pitch = 1, duck = 0.3): void {
    const c = this.chain(x.g, 'drums');
    this.h.tone({ type: 'sine', f: 150 * pitch, f1: 46 * pitch, glide: 0.06, at: t, attack: 0.001, hold: 0.025, dur: 0.22, gain: 0.42 * v, out: c.kick });
    this.h.tone({ type: 'triangle', f: 300 * pitch, f1: 110 * pitch, glide: 0.035, at: t, attack: 0.001, dur: 0.07, gain: 0.16 * v, out: c.in });
    this.h.noise({ at: t, dur: 0.01, attack: 0.0005, gain: 0.2 * v, filter: 'highpass', f: 2500, out: c.in });
    // (one dip at a time: a kick within 0.2 s of the last one doesn't duck again)
    if (t - x.g.lastDuck < 0.2) return;
    x.g.lastDuck = t;
    const p = x.g.chains.pad?.duck?.gain;
    if (p) {
      p.setValueAtTime(1, t);
      p.linearRampToValueAtTime(duck, t + 0.01);
      p.linearRampToValueAtTime(1, t + 0.17);
    }
    const b = x.g.chains.bass?.duck?.gain;
    if (b) {
      b.setValueAtTime(1, t);
      b.linearRampToValueAtTime(0.4 + duck * 0.5, t + 0.006);
      b.linearRampToValueAtTime(1, t + 0.1);
    }
  }

  /** Snare: a noise crack and a short tonal body; on the backbeat a clap over it (three quick bursts). */
  snare(x: Step, t: number, v: number, clap: boolean): void {
    const c = this.chain(x.g, 'drums');
    this.h.noise({ at: t, dur: 0.17, attack: 0.001, gain: 1.6 * v, out: c.snare });
    this.h.tone({ type: 'triangle', f: 210, f1: 150, glide: 0.05, at: t, dur: 0.09, gain: 0.55 * v, out: c.in });
    if (clap) this.h.ticks([t - 0.012, t - 0.005, t + 0.003], { gain: 1.1 * v, f: 1400, q: 1.1, ms: 7, out: c.snare });
  }

  hat(x: Step, t: number, v: number, open = false): void {
    const c = this.chain(x.g, 'drums');
    this.h.noise({ at: t, attack: 0.001, dur: open ? 0.16 : 0.04, gain: 0.75 * v, out: c.hats });
  }

  crash(x: Step, t: number, v: number): void {
    const c = this.chain(x.g, 'fx');
    this.h.noise({ at: t, dur: 1.5, attack: 0.002, gain: 0.2 * v, filter: 'highpass', f: 4500, out: c.in });
  }

  /** A tom: a pitch-falling triangle and a thud of noise. */
  tom(x: Step, t: number, f: number, v: number): void {
    const c = this.chain(x.g, 'drums');
    this.h.tone({ type: 'triangle', f, f1: f * 0.62, glide: 0.12, at: t, attack: 0.002, dur: 0.28, gain: 0.42 * v, out: c.in });
    this.h.noise({ at: t, dur: 0.06, gain: 0.2 * v, filter: 'bandpass', f: f * 4, q: 1, out: c.in });
  }

  // percussion: the base layer's (and the calm arrangements' light touches)

  /** A shaker: a short burst of high noise (into the percussion, or the kit's hats). */
  shaker(x: Step, t: number, v: number, into: 'perc' | 'drums' = 'perc'): void {
    if (into === 'drums') {
      const c = this.chain(x.g, 'drums');
      this.h.noise({ at: t, attack: 0.01, dur: 0.045, gain: 0.4 * v, out: c.hats });
      return;
    }
    const c = this.chain(x.g, 'perc');
    this.h.noise({ at: t, attack: 0.008, dur: 0.05, gain: 0.3 * v, filter: 'highpass', f: 6000, q: 0.7, out: c.in });
  }

  /** A tambourine: three quick jingles and a shimmer. */
  tamb(x: Step, t: number, v: number): void {
    const c = this.chain(x.g, 'perc');
    this.h.ticks([t, t + 0.011, t + 0.023], { gain: 0.5 * v, f: 7500, q: 2, ms: 9, out: c.in });
    this.h.noise({ at: t, attack: 0.002, dur: 0.14, gain: 0.16 * v, filter: 'highpass', f: 7000, out: c.in });
  }

  /** A rim click. */
  rim(x: Step, t: number, v: number): void {
    const c = this.chain(x.g, 'perc');
    this.h.ticks([t], { gain: 0.9 * v, f: 2600, q: 4, ms: 10, out: c.in });
  }

  /** A woodblock. */
  block(x: Step, t: number, f: number, v: number): void {
    const c = this.chain(x.g, 'perc');
    this.h.tone({ type: 'triangle', f, f1: f * 0.92, glide: 0.04, at: t, dur: 0.05, gain: 0.2 * v, out: c.in });
    this.h.noise({ at: t, dur: 0.03, gain: 0.12 * v, filter: 'bandpass', f: 2200, out: c.in });
  }

  /** A bodhran: a frame drum's pitch-dropping thump and the stick's slap. */
  bodhran(x: Step, t: number, v: number): void {
    const c = this.chain(x.g, 'perc');
    this.h.tone({ type: 'triangle', f: 190, f1: 105, glide: 0.06, at: t, attack: 0.002, dur: 0.16, gain: 0.34 * v, out: c.in });
    this.h.noise({ at: t, dur: 0.035, gain: 0.22 * v, filter: 'bandpass', f: 900, q: 1.2, out: c.in });
  }

  /** A war drum (taiko): a big low boom with a skin slap; `ka`: the rim crack instead. */
  taiko(x: Step, t: number, v: number, ka = false): void {
    const c = this.chain(x.g, 'perc');
    if (ka) {
      this.h.ticks([t], { gain: 1.1 * v, f: 1800, q: 2.5, ms: 14, out: c.in });
      this.h.tone({ type: 'triangle', f: 520, f1: 380, glide: 0.03, at: t, dur: 0.06, gain: 0.12 * v, out: c.in });
      return;
    }
    this.h.tone({ type: 'triangle', f: 150, f1: 70, glide: 0.09, at: t, attack: 0.002, dur: 0.5, gain: 0.48 * v, out: c.in });
    this.h.tone({ type: 'sine', f: 75, f1: 50, glide: 0.12, at: t, attack: 0.003, dur: 0.45, gain: 0.3 * v, out: c.in });
    this.h.noise({ at: t, dur: 0.07, attack: 0.001, gain: 0.3 * v, filter: 'bandpass', f: 420, q: 1, out: c.in });
  }

  /** The golem's stomp: a deep thump, a stone crunch and a little debris. */
  stomp(x: Step, t: number, v: number): void {
    const c = this.chain(x.g, 'perc');
    this.h.tone({ type: 'sine', f: 110, f1: 36, glide: 0.11, at: t, attack: 0.002, hold: 0.04, dur: 0.55, gain: 0.55 * v, out: c.in });
    this.h.tone({ type: 'triangle', f: 240, f1: 72, glide: 0.07, at: t, attack: 0.001, dur: 0.22, gain: 0.32 * v, out: c.in });
    this.h.noise({ at: t, dur: 0.3, attack: 0.002, gain: 0.4 * v, filter: 'lowpass', f: 1200, f1: 180, q: 0.8, rate: 0.5, out: c.in });
    this.h.ticks([t + 0.05, t + 0.09, t + 0.16], { gain: 0.25 * v, f: 2600, q: 1.5, ms: 6, out: c.in });
  }
}
