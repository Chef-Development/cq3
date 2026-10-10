// Music: an original theme per place and per boss, played live by a small synthesized band (no samples).
//
// Every piece is a loop on a 16th-note grid with its own tempo and meter (4/4, a 6/8 jig, 3/4, a 7/8 whose uneven
// beats are its `pulses`, a 5/4, a 2/4 galop), a chord per bar (or two), one melody, and the parts of its arrangements:
//   - the acts' themes have two arrangements of the same melody at the same tempo: calm (the act map, nodes, story
//     scenes: a flute and a music box over a light pad, no drums) and intense (fights). Moving between them
//     crossfades inside the piece, from a beat, so it stays one piece.
//   - in a fight the intense arrangement starts from its base (pad, arpeggio, percussion, the melody on a bell) and
//     layers join as the combo climbs: drums, then bass, then the lead (tuning.music), each on the next beat; a
//     combo break drops them back. A phased boss's theme (the Boar King, Region 2's and Region 3's bosses: `keyUp`;
//     Region 3's two-headed mini-boss: `phased`) also adds layers with the phases and goes up a key in the last one.
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

export type MusicTrack =
  | 'title'
  | 'camp'
  | 'act1'
  | 'act2'
  | 'act3'
  | 'captain'
  | 'golem'
  | 'boarKing'
  // Region 2 (docs/content-bible.md, section 5): its three acts, two mini-bosses and the boss
  | 'frost1'
  | 'frost2'
  | 'frost3'
  | 'rimehorn'
  | 'matron'
  | 'glacia'
  // Region 3 (docs/content-bible.md, section 6; not in play yet): its three acts, two mini-bosses and the boss
  | 'ash1'
  | 'ash2'
  | 'ash3'
  | 'rumbleback'
  | 'hobnob'
  | 'bellows'
  | 'dusk1'
  | 'dusk2'
  | 'dusk3'
  | 'bellybog'
  | 'sluiceKeeper'
  | 'lighthouse';
export const MUSIC_TRACKS: MusicTrack[] = [
  'title',
  'camp',
  'act1',
  'act2',
  'act3',
  'captain',
  'golem',
  'boarKing',
  'frost1',
  'frost2',
  'frost3',
  'rimehorn',
  'matron',
  'glacia',
  'ash1',
  'ash2',
  'ash3',
  'rumbleback',
  'hobnob',
  'bellows',
  'dusk1',
  'dusk2',
  'dusk3',
  'bellybog',
  'sluiceKeeper',
  'lighthouse',
];

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
  pulses?: number[]; // uneven beats (7/8 as 2+2+3): the bar's steps where a beat falls; changes land on these
  bars: number;
  split?: number; // where a bar's second chord starts (default: half the bar)
  chords: Chord[][];
  melody: Note[];
  echo: number; // ping-pong echo feedback (its time is a dotted 8th)
  swing: number; // offbeat 16ths of the shakers and hats land late by this share of a step
  keyUp?: number; // the Boar King: phases 2 and 3 add layers, phase 3 goes up this many semitones
  phased?: boolean; // follows the boss's phase without a key change (phase 2 brings the kit and the stabs layer)
  calm?: Part[];
  intense?: Part[];
}

const hz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
const scale = (p: Pts, k: number): Pts => p.map(([d, v]): [number, number] => [d, v * k]);

/** Whether a piece follows the boss's phase (its layers, and its key with `keyUp`). */
const phasedSong = (song: Song): boolean => !!song.phased || !!song.keyUp;

/** Whether step s of a bar is on a beat (every `beat` steps, or on the piece's uneven pulses). */
const onPulse = (song: Song, s: number): boolean => (song.pulses ? song.pulses.includes(s) : s % song.beat === 0);
/** Steps from step s of a bar to the next beat (0 on one; the bar line is always a beat). */
function toPulse(song: Song, s: number): number {
  if (!song.pulses) return (song.beat - (s % song.beat)) % song.beat;
  const next = song.pulses.find((p) => p >= s);
  return (next ?? song.meter) - s;
}

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
  gate?: number; // share of the note's length it sounds
  hold?: number; // share of that it holds before dying away (default 0.6; a calm bass sustains)
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

// ---- Region 2 (secret: docs/content-bible.md, section 5). Each act, mini-boss and the boss has its own key, tempo,
// meter and band, unlike Region 1's pieces and each other. ----

// Act 4, the pass: B minor, 116 BPM. A celesta hook that falls like snow (a dotted step down, a drop to the root,
// back up a step at a time), the glockenspiel twinkling on its long notes, a harp of plucked strings, sleigh bells
// and a low choir. The fight drives it with 16th-note pizzicato and taiko; the lead is a thin, glassy pulse.
const FROST1_CALM_BASS = bassBar('0:8 . . . . . . . 7:8 . . . . . . .');
const FROST1_BASS = bassBar('0:2 . 0:1 0:1 12:2 . 0:1 0:1 0:2 . 0:1 0:1 7:2 . 12:2 .');
const FROST1_TURN = bassBar('0:2 . 0:1 0:1 12:2 . 0:1 0:1 0:2 . 2:2 . 4:2 . 5:2 .'); // F#, G#, A# up into B
const FROST1_PIZZ = [0, 2, 1, 2, 3, 2, 1, 2, 0, 2, 1, 2, 4, 3, 2, 1];
const FROST1: Song = {
  track: 'frost1',
  name: 'Frostbite Pass',
  key: 'B minor',
  bpm: 116,
  meter: 16,
  beat: 4,
  bars: 8,
  chords: chords('Bm | G | Em | F# | Bm | D A | G Em | F#sus4 F#'),
  melody: mel(
    16,
    'f#5:3 d5:1 b4:2 f#5:2 g5:2 f#5:2 d5:4 | g5:3 e5:1 b4:2 g5:2 a5:2 g5:2 d5:4 | e5:2 g5:2 b5:3 a5:1 g5:2 f#5:2 e5:4 | f#5:3 e5:1 c#5:2 a#4:2 c#5:8 |' +
      'f#5:3 d5:1 b4:2 f#5:2 b5:2 a5:2 f#5:4 | a5:3 f#5:1 d5:2 a5:2 c#6:2 b5:2 a5:4 | b5:3 a5:1 g5:2 d5:2 e5:2 f#5:2 g5:4 | f#5:4 b4:2 c#5:2 a#4:6 c#5:2',
  ),
  echo: 0.36,
  swing: 0.08,
  calm: [
    pad({ level: 0.07, hz: 800, attack: 0.6, wave: 'triangle' }),
    part('base', (x) => (x.change || x.first) && x.b.choir(x, 0.11)),
    // the harp: plucked strings up the chord and back in 8ths
    part('base', (x) => {
      const k = [0, -1, 1, -1, 2, -1, 3, -1, 4, -1, 3, -1, 2, -1, 1, -1][x.s];
      if (k >= 0) x.b.pizz(x, tone(x.chord, k), 0.2, { hz: 2600 });
    }),
    melody('base', (x, m) => x.b.celesta(x, m, 0.3)),
    part('base', (x) => x.note && x.note[1] >= 4 && x.b.bell(x, x.note[0] + 12, 0.1)), // the glockenspiel twinkles
    bass(() => FROST1_CALM_BASS, { level: 0.24, hz: [800, 300], sub: 1.05, gate: 1.05, hold: 0.93 }, 'base'),
    perc(['..o...x...o...x.'], (x, v) => x.b.sleigh(x, x.t + x.song.swing * x.STEP, v * 0.6)),
    riser(0.3),
    chime(83, 0.8),
  ],
  intense: [
    pad({ level: 0.15, hz: 1300, attack: 0.2 }),
    part('base', (x) => (x.change || x.first) && x.b.choir(x, 0.12)),
    part('base', (x) => x.b.pizz(x, tone(x.chord, FROST1_PIZZ[x.s]), x.s % 4 ? 0.24 : 0.34)),
    melody('base', (x, m) => x.b.celesta(x, m + 12, 0.34 * x.lead)),
    perc(['X.o.x.o.X.o.x.o.'], (x, v) => x.b.sleigh(x, x.t + (x.s % 4 ? x.song.swing * x.STEP : 0), v)),
    perc(['X.......X.....x.', 'X.......X..x..x.'], (x, v) => x.b.taiko(x, x.t, v * 1.3)),
    riser(0.6),
    kit({
      kick: ['X.......X.x.....', 'X.......X.x...x.'],
      snare: ['....X.......X...'],
      hats: ['x.o.x.o.x.o.x.o.'],
      clap: true,
      fill: { snare: '....X.......XxXX', hats: 'x.o.x.o.x.......' },
      crash: [0],
      level: 0.75,
    }),
    bass((bar) => (bar === 7 ? FROST1_TURN : FROST1_BASS), { level: 0.32, hz: [1700, 460], sub: 1.35 }),
    melody('lead', (x, m, len) => x.b.lead(x, m, len, 0.22, 'pulse12', 4400)),
  ],
};

// Act 5, the caves: A flat Lydian (its raised fourth, D, floats over the tonic), 96 BPM. A glass harmonica sings
// slow phrases that climb through the D; water-drop woodblocks and high crystal notes in a dotted rhythm ring in a
// long echo over a fretless bass that slides into its notes. The fight pulses: an 8th-note synth bass and toms.
const FROST2_FRETLESS = bassBar('0:10 . . . . . . . . . 7:4 . . . 12:2 .');
const FROST2_PULSE = bassBar('0:1 . 0:1 . 0:1 . 0:1 . 0:1 . 0:1 . 12:1 . 0:1 .');
const FROST2_DROPS = [880, 1175, 990, 1320, 784, 1046, 1480];
const FROST2: Song = {
  track: 'frost2',
  name: 'Glimmer Caves',
  key: 'Ab Lydian',
  bpm: 96,
  meter: 16,
  beat: 4,
  bars: 8,
  chords: chords('Ab | Bb | Cm | Gm | Ab | Bb | Fm Gm | Eb Bb'),
  melody: mel(
    16,
    'c5:4 d5:4 eb5:6 g5:2 | f5:6 d5:2 bb4:8 | eb5:4 g5:4 c6:6 bb5:1 ab5:1 | bb5:6 g5:2 d5:8 |' +
      'c5:4 d5:4 eb5:4 ab5:4 | g5:6 f5:1 eb5:1 d5:4 f5:4 | ab5:4 g5:2 f5:2 g5:4 bb5:4 | g5:4 eb5:4 f5:4 d5:4',
  ),
  echo: 0.55,
  swing: 0,
  calm: [
    pad({ level: 0.1, hz: 760, attack: 1, wave: 'triangle', detune: 11 }),
    // crystals: high notes every three 16ths, cascading in the dotted echo
    arp([4, -1, -1, 6, -1, -1, 5, -1, -1, 7, -1, -1, 6, -1, -1, -1], { level: 0.13, wave: 'sine', dur: 3, oct: 1, hz: 6000, echo: 0.6 }),
    melody('base', (x, m, len) => x.b.glass(x, m, len, 0.21)),
    part('base', (x) => {
      const n = FROST2_FRETLESS[x.s];
      if (n) x.b.fretless(x, x.chord.root + n[0], n[1] * x.STEP * 0.95, 0.2);
    }),
    perc(['..x.....o..x....', '.....x..x.....o.'], (x, v) => x.b.drip(x, x.t, FROST2_DROPS[(x.s + x.bar * 3) % 7], v * 0.5)),
    riser(0.3),
    chime(86, 0.8),
  ],
  intense: [
    pad({ level: 0.16, hz: 1000, attack: 0.25 }),
    // a rippling synth pulse in a dotted rhythm (3-3-2), doubled by the echo
    arp([0, -1, -1, 2, -1, -1, 1, -1, 4, -1, -1, 2, -1, -1, 1, -1], { level: 0.75, wave: 'pulse25', dur: 1.8, hz: 2600, echo: 0.5 }),
    melody('base', (x, m, len) => x.b.glass(x, m, len, 0.3 * x.lead, 'bell')),
    perc(['x..x..x...x..x..', 'x..x..x...x.x.x.'], (x, v) => x.b.drip(x, x.t, FROST2_DROPS[(x.s + x.bar) % 7], v * 0.8)),
    perc(['X.......x.x.....', 'X.......x.x...x.'], (x, v) => x.b.tom(x, x.t, v >= 1 ? 110 : 150 + (x.s % 3) * 25, v * 0.9, 'perc')),
    riser(0.6),
    kit({
      kick: ['X.........X.....', 'X.....x...X.....'],
      snare: ['........X.......'],
      hats: ['x.x.x.x.x.x.x.x.'],
      open: ['..............x.'],
      clap: true,
      fill: { snare: '........X.......', hats: 'x.x.x.x.........', toms: '........X.x.XxXx' },
      crash: [0],
      level: 0.9,
    }),
    bass(() => FROST2_PULSE, { level: 0.42, hz: [1500, 400], sub: 1.4, gate: 0.8 }),
    melody('lead', (x, m, len) => x.b.lead(x, m, len, 0.24, 'triangle', 3000)),
  ],
};

// Act 6, the glacier: C sharp minor, 132 BPM, epic. A horn call that leaps from the root to the fifth and climbs,
// over tremolo strings, a choir singing "ah" and timpani. The fight adds the brass section's ostinato (3-3-2-3-3-2)
// and a brass lead an octave above the horns.
const FROST3_BASS = bassBar('0:2 . 0:2 . 0:2 . 0:2 . 0:2 . 0:2 . 12:2 . 7:2 .');
const FROST3: Song = {
  track: 'frost3',
  name: "Wyrm's Glacier",
  key: 'C# minor',
  bpm: 132,
  meter: 16,
  beat: 4,
  bars: 8,
  chords: chords('C#m | A | E | B | C#m | A | F#m | G#'),
  melody: mel(
    16,
    'c#5:6 g#4:2 c#5:2 e5:2 g#5:4 | a5:6 g#5:2 f#5:2 e5:2 c#5:4 | b4:4 e5:4 g#5:6 f#5:2 | f#5:8 d#5:4 b4:4 |' +
      'c#5:6 g#4:2 c#5:2 e5:2 c#6:4 | b5:4 a5:2 g#5:2 a5:4 e5:4 | f#5:4 a5:4 c#6:6 b5:2 | g#5:6 f#5:2 e5:2 d#5:2 b#4:4',
  ),
  echo: 0.3,
  swing: 0,
  calm: [
    pad({ level: 0.06, hz: 700, attack: 0.8, shift: -12 }),
    part('base', (x) => (x.change || x.first) && x.b.tremolo(x, 0.055, { hz: 1800 })),
    part('base', (x) => (x.change || x.first) && x.b.choir(x, 0.09, { oct: 1 })),
    melody('base', (x, m, len) => x.b.horn(x, m - 12, len, 0.4)),
    bass(() => WHOLE, { level: 0.24, hz: [600, 280], sub: 1.05, gate: 1.05, hold: 0.93 }, 'base'),
    // timpani: a stroke at the top of each phrase, a roll into the loop
    part('base', (x) => {
      if ((x.bar === 0 || x.bar === 4) && x.s === 0) x.b.timpani(x, x.t, x.chord.root, 0.5);
      if (x.last && x.s === 8) x.b.timpani(x, x.t, x.chord.root, 0.45, 8 * x.STEP);
    }),
    riser(0.3),
    chime(85, 0.7),
  ],
  intense: [
    pad({ level: 0.13, hz: 1100, attack: 0.15, shift: -12 }),
    part('base', (x) => (x.change || x.first) && x.b.tremolo(x, 0.07, { hz: 2800 })),
    part('base', (x) => (x.change || x.first) && x.b.choir(x, 0.1, { oct: 1 })),
    perc(['X..x..X.X..x..X.'], (x, v) => x.b.brass(x, (v >= 1 ? 2 : 1.4) * x.STEP, 0.18 * v)),
    melody('base', (x, m, len) => x.b.horn(x, m - 12, len, 0.46 * x.lead)),
    perc(['X.......X..X....', 'X.......X..X..x.'], (x, v) => x.b.timpani(x, x.t, x.chord.root, v * 0.95)),
    riser(0.8),
    kit({
      kick: ['X.....X.X.......', 'X.....X.X.....X.'],
      snare: ['....X.......X...'],
      hats: ['x.o.x.o.x.o.x.o.'],
      clap: true,
      fill: { kick: 'X.....X.X.......', snare: '....X...........', hats: 'x.o.x.o.........', toms: '........X.X.XxXx' },
      crash: [0, 4],
      level: 0.8,
    }),
    bass(() => FROST3_BASS, { level: 0.36, hz: [1800, 480], sub: 1.35 }),
    part('lead', (x) => {
      if (!x.note) return;
      const [m, n] = x.note;
      x.b.horn(x, m, n * x.STEP, 0.3, 'lead');
      x.b.lead(x, m, n * x.STEP, 0.1, 'sawtooth', 3600, false);
    }),
  ],
};

// The ram at the toll (Act 4's mini-boss): stomping folk in G Mixolydian (its flat seventh, F, all over), 150 BPM in
// 7/8 counted 2+2+3: a hurdy-gurdy drone, the fiddle on the tune, a frame drum (doum, tek), claps on the long beat
// and a low horn call at the top of each phrase. Once the combo is up, a horn section blasts the tune.
const RIME_BASS = bassBar('0:2 . 12:2 . 0:2 . 12:2 . 0:2 . 7:2 . 10:2 .');
const RIME_TURN = bassBar('0:2 . 12:2 . 0:2 . 12:2 . 7:2 . 5:2 . 2:2 .');
const RIME_DOUM = ['X...X...X.....', 'X...X...X...x.'];
const RIME_TEK = ['..o...o...o.o.', '..o...o...oo..'];
const RIMEHORN: Song = {
  track: 'rimehorn',
  name: 'Rimehorn',
  key: 'G Mixolydian',
  bpm: 150,
  meter: 14,
  beat: 4,
  pulses: [0, 4, 8],
  bars: 8,
  split: 8,
  chords: chords('G | F | G | C | G | F | Dm F | G'),
  melody: mel(
    14,
    'g4:2 b4:2 d5:2 g5:2 f5:2 d5:4 | f5:2 e5:2 f5:2 a5:2 c6:4 a5:2 | g5:2 f5:2 d5:2 b4:2 g4:6 | c5:2 e5:2 g5:2 e5:2 f5:2 e5:2 d5:2 |' +
      'g4:2 b4:2 d5:2 g5:2 b5:4 a5:2 | a5:2 g5:2 f5:2 c5:2 f5:2 g5:2 a5:2 | d5:2 f5:2 a5:2 f5:2 c6:2 a5:2 f5:2 | g5:2 f5:2 e5:2 c5:2 d5:6',
  ),
  echo: 0.34,
  swing: 0,
  intense: [
    part('base', (x) => (x.s === 0 || x.first) && x.b.drone(x, 55, 0.12)),
    pad({ level: 0.08, hz: 1400, attack: 0.08, wave: 'pulse25', detune: 9 }),
    melody('base', (x, m, len) => x.b.fiddle(x, m, len, 0.4 * x.lead, 'bell')),
    part('base', (x) => {
      const d = hit(RIME_DOUM[x.bar % 2], x.s);
      if (d) x.b.frame(x, x.t, d * 1.4);
      const k = hit(RIME_TEK[x.bar % 2], x.s);
      if (k) x.b.frame(x, x.t, k * 1.4, true);
      if (x.s === 8 || x.s === 11) x.b.clap(x, x.t, x.s === 8 ? 1 : 0.7);
    }),
    // the ram's horn: G, then up to D, at the top of each phrase
    part('base', (x) => {
      if (x.bar % 4 !== 0) return;
      if (x.s === 0) x.b.horn(x, 55, 4 * x.STEP, 0.4);
      else if (x.s === 4) x.b.horn(x, 62, 10 * x.STEP, 0.4);
    }),
    part('base', (x) => x.last && x.s === 8 && x.b.riser(x, 6 * x.STEP, 0.6)),
    kit({
      kick: ['X.......X.....', 'X.......X...x.'],
      snare: ['....X.......X.'],
      hats: ['x.o.x.o.x.o.o.'],
      clap: true,
      fill: { snare: '....X...X.xxXX', hats: 'x.o.x.o.......', toms: '........X.X.X.' },
      crash: [0, 4],
      level: 0.8,
    }),
    bass((bar) => (bar === 7 ? RIME_TURN : RIME_BASS), { level: 0.36, hz: [1700, 480], sub: 1.4 }),
    part('lead', (x) => {
      if (!x.note) return;
      const [m, n] = x.note;
      x.b.horn(x, m, n * x.STEP, 0.21, 'lead');
      x.b.horn(x, m - 12, n * x.STEP, 0.12, 'lead');
    }),
  ],
};

// The spider who weaves the hoard (Act 5's mini-boss): a waltz in F minor, 3/4 at 88. A harpsichord's
// oom-pah-pah, a music box gone wrong on the tune (it sags flat, its octave out of tune), a cello holding the root
// and a clock that ticks. The combo brings a waltz kit, a bowed cello bass, then the cello singing the tune low.
const MATRON_BASS = bassBar('0:4 . . . 7:4 . . . 12:4 . . .');
const MATRON: Song = {
  track: 'matron',
  name: 'The Loom Matron',
  key: 'F minor',
  bpm: 88,
  meter: 12,
  beat: 4,
  bars: 8,
  split: 8,
  chords: chords('Fm | C | Fm | Db | Bbm | Fm | Gdim C | Fm'),
  melody: mel(
    12,
    'c5:4 f5:4 ab5:4 | g5:6 e5:2 c5:4 | ab5:4 g5:2 f5:2 c5:4 | db5:6 c5:2 f5:4 | bb4:4 db5:4 f5:4 | ab5:6 g5:2 f5:4 | bb5:2 ab5:2 g5:2 f5:2 e5:4 | f5:6 e5:2 f5:2 g5:2',
  ),
  echo: 0.3,
  swing: 0,
  intense: [
    pad({ level: 0.1, hz: 900, attack: 0.5, wave: 'triangle', detune: 16 }),
    // the harpsichord: the root low on 1, the chord on 2 and 3 (strummed), a run up on the last beat now and then
    part('base', (x) => {
      const c = x.chord;
      if (x.s === 0) x.b.harpsi(x, x.t, c.root + 12, 0.58);
      else if (x.s === 4 || x.s === 8) [1, 2, 3].forEach((k, i) => x.b.harpsi(x, x.t + i * 0.009, tone(c, k), 0.32, i % 2));
      else if (x.bar % 2 && (x.s === 9 || x.s === 10 || x.s === 11)) x.b.harpsi(x, x.t, tone(c, x.s - 5), 0.24, 1);
    }),
    part('base', (x) => (x.s === 0 || x.first) && x.b.cello(x, x.chord.root + 12, (x.song.meter - x.s) * x.STEP, 0.26, 'str')),
    melody('base', (x, m) => x.b.warpedBox(x, m + 12, 0.72 * x.lead)),
    perc(['x.......o...', 'x.......o.-.'], (x, v) => x.b.block(x, x.t, v >= 0.7 ? 1250 : 880, v * 1.8)),
    riser(0.5, 1),
    kit({
      kick: ['X...........', 'X.......x...'],
      snare: ['....X...X...'],
      hats: ['x.o.x.o.x.o.'],
      fill: { snare: '....X...XoxX', hats: 'x.o.x.o.....' },
      crash: [0],
      level: 0.75,
    }),
    part('bass', (x) => {
      const n = MATRON_BASS[x.s];
      if (n) x.b.cello(x, x.chord.root + n[0], n[1] * x.STEP * 0.9, 0.3, 'bass', 1.3);
    }),
    part('lead', (x) => {
      if (!x.note) return;
      const [m, n] = x.note;
      x.b.cello(x, m - 12, n * x.STEP, 0.26, 'lead');
      x.b.fiddle(x, m, n * x.STEP, 0.07);
    }),
  ],
};

// The wyrm (Region 2's boss): E flat minor, 148 BPM. An imperious hook (the root, up to the fifth, a turn down) on
// an organ over a pipe-organ bed, string spiccato in 16ths and timpani. Her phases escalate it: phase 2 brings the
// drums with double-time hats and a choir for good; phase 3 goes up to F sharp minor with everything in (bass,
// lead, brass stabs).
const GLACIA_BASS = bassBar('0:2 . 0:2 . 12:1 0:1 0:2 . 0:2 . 0:2 . 12:1 7:1 10:2 .');
const GLACIA_SPIC = [0, 1, 2, 1, 3, 1, 2, 1, 0, 1, 2, 1, 4, 3, 2, 1];
const GLACIA: Song = {
  track: 'glacia',
  name: 'Glacia',
  key: 'Eb minor (phase 3: F# minor)',
  bpm: 148,
  meter: 16,
  beat: 4,
  bars: 8,
  chords: chords('Ebm | Cb | Abm | Bb | Ebm | Gb | Cb Bb | Ebm'),
  melody: mel(
    16,
    'eb5:4 bb5:4 gb5:2 f5:2 eb5:4 | cb6:4 bb5:2 ab5:2 gb5:4 eb5:4 | ab5:4 cb6:4 eb6:6 db6:2 | d6:8 bb5:4 f5:4 |' +
      'eb5:4 bb5:4 gb5:2 f5:2 eb5:4 | db6:4 cb6:2 bb5:2 gb5:4 db5:4 | eb6:4 db6:2 cb6:2 bb5:2 ab5:2 f5:2 d5:2 | eb5:8 r:4 bb4:2 d5:2',
  ),
  echo: 0.34,
  swing: 0,
  keyUp: 3,
  intense: [
    part('base', (x) => (x.change || x.first) && x.b.organ(x, x.chord.tones.slice(0, 3).map((m) => m - 12), x.left, 0.12)),
    part('base', (x) => x.b.pizz(x, tone(x.chord, GLACIA_SPIC[x.s]), x.s % 4 ? 0.24 : 0.33, { bow: true, hz: 3600 })),
    melody('base', (x, m, len) => x.b.organ(x, [m], len, 0.31 * x.lead, 'bell')),
    perc(['X.......X.......', 'X.......X.....x.'], (x, v) => x.b.timpani(x, x.t, x.chord.root, v * 0.8)),
    riser(0.8),
    part('drums', (x) => {
      // phase 2 on: the hats go double-time and the kit hits harder
      const dbl = x.phase >= 2;
      const fill = x.last && x.s >= 8;
      const v = dbl ? 0.9 : 0.8;
      const k = hit(x.bar % 2 ? 'X.....x.X.....x.' : 'X.....x.X.......', x.s);
      if (k && !fill) x.b.kick(x, x.t, k * v);
      const sn = fill ? hit('........XxoxXxXX', x.s) : hit('....X.......X...', x.s);
      if (sn) x.b.snare(x, x.t, sn * v, sn >= 1 && !fill);
      if (fill && x.s % 2 === 0) x.b.tom(x, x.t, 160 - (x.s - 8) * 10, (0.7 + (x.s - 8) * 0.04) * v);
      if ((x.bar === 0 || x.bar === 4) && x.s === 0) x.b.crash(x, x.t, v * 0.75);
      else if (!fill) {
        const h = hit(dbl ? 'XoxoXoxoXoxoXoxo' : 'x.o.x.o.x.o.x.o.', x.s);
        if (h) x.b.hat(x, x.t, h * v);
      }
    }),
    // phase 2 on: the choir; phase 3: brass stabs on the offbeats too
    part('stabs', (x) => (x.change || x.first) && x.b.choir(x, 0.34, { oct: 1, role: 'hymn' })),
    part('stabs', (x) => x.phase >= 3 && x.s % 4 === 2 && x.b.stab(x, 2 * x.STEP, 0.44)),
    // (the bass digs in harder in the last phase)
    part('bass', (x) => {
      const n = GLACIA_BASS[x.s];
      if (n) x.b.bass(x, x.chord.root + n[0], n[1] * x.STEP * 0.92, { level: x.phase >= 3 ? 0.33 : 0.25, hz: [1900, 500], sub: 1.45 });
    }),
    part('lead', (x) => {
      if (!x.note) return;
      const [m, n] = x.note;
      x.b.lead(x, m, n * x.STEP, 0.17, 'sawtooth', 3200);
      x.b.lead(x, m + 12, n * x.STEP, 0.05, 'pulse12', 4200, false);
    }),
  ],
};

// ---- Region 3 (secret: docs/content-bible.md, section 6; not in play yet). Every tonic is taken by now, so each
// act, mini-boss and the boss differs from Regions 1-2 and each other in mode, tempo, meter and band. ----

/** A pattern step: '.' rests, a digit is a chord tone (tone()), 'R' the chord's root (an octave up). */
const pat = (src: string, x: Step): number | null => {
  const ch = src[x.s];
  if (!ch || ch === '.') return null;
  return ch === 'R' ? x.chord.root + 12 : tone(x.chord, Number(ch));
};
/** The highest chord tone at least a minor third under midi m (a second voice under the tune). */
const under = (c: Chord, m: number): number => {
  let best = m - 12;
  for (const t of c.tones.slice(0, 3)) for (let o = -2; o <= 2; o++) if (t + 12 * o <= m - 3 && t + 12 * o > best) best = t + 12 * o;
  return best;
};
/** A swung 16th: offbeat 16ths land late by the piece's swing. */
const swung = (x: Step): number => x.t + (x.s % 2 ? x.song.swing * x.STEP : 0);

// Act 7, the ash plains: E Phrygian dominant (the F leaning on the E, the leap from F up to G sharp), 112 BPM with a
// half-time feel. An oud plucks an ostinato over a reed drone on E and B, a breathy ney sings the tune sliding into
// its notes, an ash-hiss shaker and a distant frame drum keep the time. The fight brings a doumbek groove
// (doum-tek-tek-doum-tek), a driving low-string ostinato and the oud on the tune; the lead is a nasal reed (zurna).
const ASH1_DRONE = [40, 47, 52]; // E2, B2 and E3, under every chord
const ASH1_OUD = 'R.2.1.2.R.2.3.2.';
const ASH1_LOW = [0, 0, 2, 0, 1, 0, 2, 0, 0, 0, 2, 0, 3, 2, 1, 0];
const ASH1_DOUM = ['D.T.k.T.D.k.T.k.', 'D.T.k.T.D.k.TkTk'];
const ASH1_BASS = bassBar('0:3 . . 0:1 . . 12:2 . 0:3 . . 0:1 1:2 . 0:2 .');
const ASH1_TURN = bassBar('0:3 . . 0:1 . . 12:2 . 0:2 . 1:2 . 4:2 . 5:2 .');
const ASH1: Song = {
  track: 'ash1',
  name: 'Cinder Flats',
  key: 'E Phrygian dominant',
  bpm: 112,
  meter: 16,
  beat: 4,
  bars: 8,
  chords: chords('E | F | Dm | E | Am | F | Dm E | E'),
  melody: mel(
    16,
    'b4:4 e5:2 f5:2 g#5:6 f5:2 | a5:4 g#5:2 f5:2 e5:4 c5:4 | d5:3 e5:1 f5:4 a5:4 g#5:2 f5:2 | e5:10 r:2 b4:2 d5:2 |' +
      'c5:4 e5:2 a5:2 b5:6 a5:2 | c6:4 b5:2 a5:2 g#5:4 f5:4 | f5:4 e5:2 d5:2 e5:2 f5:2 g#5:2 b5:2 | e5:12 r:4',
  ),
  echo: 0.38,
  swing: 0.06,
  calm: [
    part('base', (x) => (x.s === 0 || x.first) && x.b.reedDrone(x, ASH1_DRONE, 0.07)),
    part('base', (x) => {
      const m = pat(ASH1_OUD, x);
      if (m !== null) x.b.oud(x, x.t, m, x.s % 8 ? 0.22 : 0.3);
    }),
    melody('base', (x, m, len) => x.b.ney(x, m, len, 0.38)),
    bass(() => WHOLE, { level: 0.26, hz: [700, 300], sub: 1.25, gate: 1.05, hold: 0.93 }, 'base'),
    perc(['..o...x...o...x.'], (x, v) => x.b.hiss(x, x.t, v * 0.7)),
    perc(['X.........o.....'], (x, v) => x.b.frame(x, x.t, v * 0.45)), // a frame drum, far off
    riser(0.3),
    chime(88, 0.7),
  ],
  intense: [
    part('base', (x) => (x.s === 0 || x.first) && x.b.reedDrone(x, ASH1_DRONE, 0.06)),
    pad({ level: 0.12, hz: 1000, attack: 0.2, detune: 9 }),
    part('base', (x) => x.b.pizz(x, tone(x.chord, ASH1_LOW[x.s]) - 12, x.s % 4 ? 0.28 : 0.4, { bow: true, hz: 2400 })),
    melody('base', (x, m, len) => x.b.oud(x, x.t, m, 0.44 * x.lead, { len, role: 'bell' })),
    part('base', (x) => {
      const k = ASH1_DOUM[x.bar % 2][x.s];
      if (k !== '.') x.b.doumbek(x, x.t, k === 'k' ? 0.7 : 1.5, k as 'D' | 'T' | 'k');
    }),
    perc(['-.x.-.x.-.x.-.x.'], (x, v) => x.b.hiss(x, x.t + (x.s % 2 ? x.song.swing * x.STEP : 0), v)),
    riser(0.6),
    kit({
      kick: ['X.........x.....', 'X.........x...x.'],
      snare: ['........X.......'],
      hats: ['x...x...x...x...'],
      open: ['......x.......x.'],
      clap: true,
      fill: { snare: '........X...XxXX', hats: 'x...x...x.......' },
      crash: [0],
      level: 0.8,
    }),
    bass((bar) => (bar === 7 ? ASH1_TURN : ASH1_BASS), { level: 0.34, hz: [1600, 450], sub: 1.35 }),
    melody('lead', (x, m, len) => x.b.zurna(x, m, len, 0.2)),
  ],
};

// Act 8, the glass tunnels: B flat Dorian (its raised sixth, G, shining through the minor), 108 BPM in 5/4 counted
// 3+2. A kalimba plays an ostinato on the 3+2 and sings the tune over it, under a bowed-glass pad; wind chimes ring
// at the ends of the phrases and a soft heartbeat thumps on 1. The fight runs a marimba in double time over tabla-like
// hand drums; the lead is a bright square.
const ASH2_KAL = '0.2.1.3.2.1.4.2.3.1.'; // three beats of 8ths, then two
const ASH2_MARIMBA = [0, 1, 2, 1, 3, 2, 1, 2, 0, 2, 1, 3, 4, 3, 2, 1, 2, 3, 4, 5];
const ASH2_TABLA = ['G.t.N.t.N.ttG.t.N.t.', 'G.t.N.t.N.t.G.tNN.tt'];
const ASH2_CALM_BASS = bassBar('0:12 . . . . . . . . . . . 7:8 . . . . . . .');
const ASH2_BASS = bassBar('0:2 . 0:1 12:1 . . 0:2 . 7:2 . 0:1 . 0:2 . 10:2 . 12:2 . 7:2 .');
const ASH2: Song = {
  track: 'ash2',
  name: 'Glass Warrens',
  key: 'Bb Dorian',
  bpm: 108,
  meter: 20,
  beat: 4,
  bars: 8,
  split: 12,
  chords: chords('Bbm | Eb | Fm | Bbm | Db | Ab | Eb Fm | Bbm'),
  melody: mel(
    20,
    'f5:6 db5:2 bb4:4 c5:4 db5:4 | eb5:6 g5:2 bb5:4 ab5:4 g5:4 | ab5:6 f5:2 c5:4 eb5:4 f5:4 | db5:8 c5:4 bb4:8 |' +
      'f5:6 ab5:2 db6:4 c6:4 ab5:4 | c6:6 bb5:2 ab5:4 g5:4 eb5:4 | g5:4 bb5:4 g5:4 ab5:4 f5:4 | bb5:12 r:8',
  ),
  echo: 0.42,
  swing: 0,
  calm: [
    part('base', (x) => (x.change || x.first) && x.b.glassPad(x, 0.06)),
    part('base', (x) => {
      const m = pat(ASH2_KAL, x);
      if (m !== null) x.b.tine(x, x.t, m, x.s === 0 || x.s === 12 ? 0.34 : 0.23, x.s % 4 ? 1 : 0, 'arp');
    }),
    melody('base', (x, m) => x.b.tine(x, x.t, m, 0.46)),
    bass(() => ASH2_CALM_BASS, { level: 0.22, hz: [700, 300], sub: 1.2, gate: 1.08, hold: 0.96 }, 'base'),
    perc(['X.o.................'], (x, v) => x.b.heart(x, x.t, v)),
    part('base', (x) => (x.bar === 3 || x.bar === 7) && x.s === 12 && x.b.windChimes(x, 1)),
    riser(0.3),
  ],
  intense: [
    pad({ level: 0.15, hz: 1200, attack: 0.25, wave: 'triangle', detune: 10 }),
    part('base', (x) => x.b.marimba(x, x.t, tone(x.chord, ASH2_MARIMBA[x.s]), x.s === 0 || x.s === 12 ? 0.54 : x.s % 2 ? 0.32 : 0.43)),
    melody('base', (x, m) => x.b.tine(x, x.t, m, 0.48 * x.lead)),
    part('base', (x) => {
      const k = ASH2_TABLA[x.bar % 2][x.s];
      if (k !== '.') x.b.tabla(x, x.t, k === 'G' ? 1.25 : k === 'N' ? 1.15 : 0.9, k as 'G' | 'N' | 't');
    }),
    part('base', (x) => (x.bar === 3 || x.bar === 7) && x.s === 12 && x.b.windChimes(x, 1.4)),
    riser(0.6),
    kit({
      kick: ['X.....x.....X.......', 'X.....x.....X.....x.'],
      snare: ['........X.......X...'],
      hats: ['x.x.x.x.x.x.x.x.x.x.'],
      open: ['..........x.........'],
      clap: true,
      fill: { snare: '........X.......XxXX', hats: 'x.x.x.x.x.x.x.x.....' },
      crash: [0],
      level: 0.8,
    }),
    bass(() => ASH2_BASS, { level: 0.36, hz: [1500, 420], sub: 1.4 }),
    melody('lead', (x, m, len) => x.b.lead(x, m, len, 0.17, 'square', 3400)),
  ],
};

// Act 9, the forge on the volcano's rim: A flat minor (its seventh raised to G at the cadence), 138 BPM. A low
// brass chorale (tuba and trombones) under a trombone's tune, an anvil ting on 2 and 4, the bellows breathing in and
// out, a male choir humming. The fight hammers it out: a brass riff in octaves, forge-hammer drums (huge low toms),
// anvil 16ths; the lead an overdriven bass on the tune with brass stabs.
const ASH3_RIFF = bassBar('0:2 . . 0:2 . . 0:1 . 12:2 . 0:1 . 10:2 . 7:2 .');
const ASH3_BASS = bassBar('0:1 . 0:1 . 0:1 . 12:1 . 0:1 . 0:1 . 10:1 . 12:1 .');
const ASH3: Song = {
  track: 'ash3',
  name: 'The Black Forge',
  key: 'Ab minor',
  bpm: 138,
  meter: 16,
  beat: 4,
  bars: 8,
  chords: chords('Abm | Fb | Cb | Gb | Abm | Dbm | Fb Eb | Abm'),
  melody: mel(
    16,
    'ab4:6 cb5:2 eb5:8 | fb5:6 eb5:2 db5:4 cb5:4 | eb5:6 gb5:2 fb5:4 eb5:4 | db5:12 bb4:4 |' +
      'ab4:6 cb5:2 eb5:4 ab5:4 | gb5:6 fb5:2 eb5:4 db5:4 | cb5:4 db5:4 bb4:4 g4:4 | ab4:12 r:4',
  ),
  echo: 0.3,
  swing: 0,
  calm: [
    // the chorale: a tuba on the root (on the right, where it sits in a band), trombones on the chord, held
    part('base', (x) => {
      if (!(x.change || x.first)) return;
      x.b.tuba(x, x.t, x.chord.root, x.left, 0.16, 'duet', true);
      x.chord.tones.slice(0, 3).forEach((m, i) => x.b.trombone(x, m - 12, x.left, 0.1, 'duet', x.t + i * 0.015, i === 1));
    }),
    part('base', (x) => (x.change || x.first) && x.b.hum(x, 0.1)),
    melody('base', (x, m, len) => x.b.trombone(x, m, len, 0.3)),
    bass(() => WHOLE, { level: 0.17, hz: [600, 280], sub: 1.3, gate: 1.05, hold: 0.93 }, 'base'),
    perc(['....x.......x...'], (x, v) => x.b.anvil(x, x.t, v * 0.6)),
    part('base', (x) => x.s === 0 && x.b.bellows(x, x.t, x.song.meter * x.STEP, 1, x.bar % 2 === 1)),
    riser(0.3),
  ],
  intense: [
    pad({ level: 0.12, hz: 900, attack: 0.15, shift: -12 }),
    part('base', (x) => {
      const n = ASH3_RIFF[x.s];
      if (!n) return;
      const len = n[1] * x.STEP * 0.85;
      x.b.trombone(x, x.chord.root + 12 + n[0], len, 0.17, 'brass');
      x.b.trombone(x, x.chord.root + 24 + n[0], len, 0.1, 'brass');
    }),
    part('base', (x) => (x.change || x.first) && x.b.hum(x, 0.08)),
    melody('base', (x, m, len) => x.b.trombone(x, m, len, 0.3 * x.lead)),
    perc(['X.....X.X.......', 'X.....X.X.....x.'], (x, v) => x.b.hammer(x, x.t, v * 1.15)),
    part('base', (x) => x.bar % 2 === 0 && x.s === 0 && x.b.bellows(x, x.t, 2 * x.song.meter * x.STEP, 0.8, true)),
    riser(0.8),
    kit({
      kick: ['X.......X.x.....', 'X.......X.x...x.'],
      snare: ['....X.......X...'],
      hats: ['................'],
      clap: true,
      fill: { kick: 'X.......X.......', snare: '....X...........', toms: '........X.X.XxXx' },
      crash: [0, 4],
      level: 0.8,
    }),
    // anvil 16ths (they stop for the fill)
    perc(['x-o-x-o-x-o-x-o-'], (x, v) => !(x.last && x.s >= 8) && x.b.anvil(x, x.t, v * 0.9, 'drums'), 'drums'),
    bass(() => ASH3_BASS, { level: 0.36, hz: [1800, 480], sub: 1.35 }),
    part('lead', (x) => {
      if (x.note) x.b.lead(x, x.note[0] - 12, x.note[1] * x.STEP, 0.15, 'sawtooth', 2400, true, 'drive');
      if (x.s === 6 || x.s === 14) x.b.stab(x, 2 * x.STEP, 0.2, 'lead');
    }),
  ],
};

// Act 7's mini-boss, the road-roller: a road-works funk in F sharp blues, 92 BPM, its 16ths swung hard. A wah-pulse
// guitar scratches 16ths, a cowbell and a clanking road-works hit keep the time, a sax plays the tune and a tuba
// backs up ("beep, beep") at the end of each phrase. The combo brings the funk kit, a slap bass, then the honking sax
// section.
const RUMBLE_WAH = 'x.xx.xX.x.xx.xX.';
const RUMBLE_SLAP = bassBar('0:2 . 12:1 . 0:1 . 0:1 10:1 . 0:1 12:1 . 0:1 . 7:1 10:1');
const RUMBLE_TURN = bassBar('0:2 . 12:1 . 0:1 . 0:1 10:1 . 0:1 12:1 . 0:1 2:1 3:1 4:1');
const RUMBLEBACK: Song = {
  track: 'rumbleback',
  name: 'Rumbleback',
  key: 'F# blues',
  bpm: 92,
  meter: 16,
  beat: 4,
  bars: 12,
  chords: chords('F#7 | F#7 | F#7 | F#7 | B7 | B7 | F#7 | F#7 | C#7 | B7 | F#7 | C#7'),
  melody: mel(
    16,
    'f#4:2 a4:1 b4:1 c5:1 c#5:3 r:2 e5:2 c#5:2 r:2 | r:2 f#5:2 e5:1 c#5:1 e5:2 c#5:2 b4:2 a4:2 f#4:2 |' +
      'f#4:2 a4:1 b4:1 c5:1 c#5:3 r:2 e5:2 f#5:2 a5:2 | f#5:6 e5:2 c#5:2 c5:2 b4:2 a4:2 |' +
      'b4:2 c#5:1 e5:1 f#5:1 e5:3 r:2 c#5:2 b4:2 r:2 | r:2 a5:2 f#5:1 e5:1 f#5:2 e5:2 c#5:2 c5:2 b4:2 |' +
      'f#4:2 a4:1 b4:1 c5:1 c#5:3 r:2 a4:2 f#4:2 r:2 | r:4 c#5:2 e5:2 f#5:4 e5:2 c#5:2 |' +
      'c#5:6 e5:2 r:2 c#5:2 b4:2 c#5:2 | b4:6 a4:2 r:2 b4:2 c#5:2 e5:2 | f#5:4 e5:2 c#5:2 c5:2 b4:2 a4:2 f#4:2 | c#5:4 r:4 c5:2 c#5:2 e5:2 f#5:2',
  ),
  echo: 0.26,
  swing: 0.3,
  intense: [
    pad({ level: 0.08, hz: 1300, attack: 0.04, wave: 'square', detune: 6 }),
    part('base', (x) => {
      const k = RUMBLE_WAH[x.s];
      if (k !== '.') x.b.wah(x, swung(x), k === 'X' ? 0.23 : 0.16, [0, 0.35, 0.7, 1][x.s % 4], k === 'X');
    }),
    part('base', (x) => x.note && x.b.sax(x, swung(x), x.note[0], x.note[1] * x.STEP - (x.s % 2) * x.song.swing * x.STEP, 0.34 * x.lead)),
    perc(['X..x..x.X...x.x.'], (x, v) => x.b.cowbell(x, swung(x), v)),
    part('base', (x) => ((x.bar % 2 === 1 && x.s === 12) || (x.bar === 0 && x.s === 0)) && x.b.clank(x, x.t, 0.55)),
    // the tuba backs up at the end of each phrase: "beep, beep"
    part('base', (x) => x.bar % 4 === 3 && (x.s === 8 || x.s === 12) && x.b.tuba(x, x.t, x.chord.root + 12, 2 * x.STEP, 0.2, 'brass')),
    part('base', (x) => x.last && x.s === 8 && x.b.riser(x, 8 * x.STEP, 0.5)),
    part('drums', (x) => {
      const fill = x.last && x.s >= 12;
      const t = swung(x);
      const k = hit(x.bar % 2 ? 'X..x....X.x..x..' : 'X..x....X.x...x.', x.s);
      if (k) x.b.kick(x, t, k, 0.95);
      const sn = hit(fill ? '....X..o.o..XxXX' : '....X..o.o..X..o', x.s);
      if (sn) x.b.snare(x, t, sn * 0.95, false);
      if (x.bar % 4 === 0 && x.s === 0) x.b.crash(x, t, 0.8);
      else if (!fill) {
        const h = hit('xoxoxoxoxoxoxoxo', x.s);
        if (h) x.b.hat(x, t, h * 0.8, x.s === 14);
      }
    }),
    part('bass', (x) => {
      const n = (x.bar === 11 ? RUMBLE_TURN : RUMBLE_SLAP)[x.s];
      if (n) x.b.slap(x, swung(x), x.chord.root + n[0], n[1] * x.STEP * 0.85, 0.4, n[0] >= 12);
    }),
    part('lead', (x) => {
      if (x.note) x.b.sax(x, swung(x), x.note[0] - 12, x.note[1] * x.STEP, 0.24, { role: 'lead', honk: true });
      // the section's stabs: a honk on the "and"s
      if ((x.s === 3 || x.s === 11) && x.bar % 2 === 0) for (const m of x.chord.tones.slice(1, 3)) x.b.sax(x, swung(x), m, 1.5 * x.STEP, 0.1, { role: 'lead', honk: true });
    }),
  ],
};

// Act 8's mini-boss, the two-headed hound: a galop in A major, 2/4 at 168. Two leads trade bars, Hob's muted trumpet
// (left) and Nob's clarinet (right), over a tuba's oom-pah, with snare rolls and a slide whistle into each phrase.
// The combo brings the galop kit, the tuba walking, then a xylophone on the tune; in phase 2 the heads squabble:
// each plays under the other's bars too.
const HOB_OOM = bassBar('0:2 . . . 7:2 . . .');
const HOB_WALK = bassBar('0:2 . 4:2 . 7:2 . 9:2 .');
const HOBNOB: Song = {
  track: 'hobnob',
  name: 'Hob & Nob',
  key: 'A major',
  bpm: 168,
  meter: 8,
  beat: 4,
  bars: 16,
  chords: chords('A | E | A | E7 | D | A | E | A | A | D | A | F#m | Bm | E | E7 | A'),
  melody: mel(
    8,
    'e5:2 a5:2 c#6:2 a5:2 | b5:1 c#6:1 b5:1 g#5:1 e5:4 | e5:2 a5:2 c#6:2 e6:2 | d6:3 c#6:1 b5:4 |' +
      'f#5:2 a5:2 d6:2 a5:2 | c#6:1 b5:1 a5:1 g#5:1 a5:2 e5:2 | f#5:1 g#5:1 a5:1 b5:1 c#6:2 b5:2 | a5:4 r:2 e5:2 |' +
      'c#6:2 c#6:1 c#6:1 e6:2 c#6:2 | d6:2 a5:2 f#5:2 a5:2 | c#6:2 b5:1 c#6:1 e6:2 a5:2 | f#5:1 g#5:1 a5:1 b5:1 c#6:4 |' +
      'd6:2 b5:2 f#5:2 d6:2 | c#6:2 b5:2 g#5:2 e5:2 | d6:1 c#6:1 b5:1 a5:1 g#5:2 b5:2 | a5:4 r:4',
  ),
  echo: 0.22,
  swing: 0,
  phased: true,
  intense: [
    // a calliope holding the chord; the oom-pah: a soft oom on the beats, the band's "pah" between
    pad({ level: 0.06, hz: 1800, attack: 0.04, wave: 'square', detune: 12, swell: false }),
    part('base', (x) => {
      if (x.s === 0 || x.s === 4) x.b.tuba(x, x.t, x.chord.root + (x.s ? 7 : 0), 1.6 * x.STEP, 0.16, 'brass');
      else if (x.s === 2 || x.s === 6) x.b.pah(x, 1.4 * x.STEP, 0.1, x.s === 6);
    }),
    // the heads trade bars: Hob's muted trumpet on the left, Nob's clarinet on the right (they step back only a
    // little when the xylophone doubles them)
    melody('base', (x, m, len) => {
      const v = 0.5 + 0.5 * x.lead;
      if (x.bar % 2) x.b.clarinet(x, m, len, 0.36 * v, 'duet', true);
      else x.b.mutedTrumpet(x, m, len, 0.5 * v, 'duet');
    }),
    // a snare roll into each line, a long one and a slide whistle into each phrase
    part('base', (x) => {
      if (x.bar % 8 === 7 && x.s === 0) {
        x.b.roll(x, x.t, 4 * x.STEP, 0.22);
        x.b.roll(x, x.t + 4 * x.STEP, 3.6 * x.STEP, 0.38);
      } else if (x.bar % 4 === 3 && x.s === 4) x.b.roll(x, x.t, 3.6 * x.STEP, 0.3);
      if (x.bar % 8 === 7 && x.s === 4) x.b.slideWhistle(x, x.t, 3.8 * x.STEP, 74, 90, 0.08);
    }),
    kit({
      kick: ['X...X...'],
      snare: ['..X...X.'],
      hats: ['x.x.x.x.'],
      open: ['......x.'],
      clap: false,
      fill: { snare: '..X.XxXX', hats: 'x.x.....' },
      crash: [0, 8],
      level: 0.9,
    }),
    part('bass', (x) => {
      const n = (x.bar % 4 === 3 ? HOB_WALK : HOB_OOM)[x.s];
      if (n) x.b.tuba(x, x.t, x.chord.root - 12 + n[0], n[1] * x.STEP * 0.85, 0.4);
    }),
    melody('lead', (x, m) => x.b.xylo(x, x.t, m, 0.3)),
    // phase 2: the other head joins in under the tune, from its own side
    part('stabs', (x) => {
      if (!x.note) return;
      const [m, n] = x.note;
      const h = under(x.chord, m);
      if (x.bar % 2) x.b.mutedTrumpet(x, h, n * x.STEP, 0.4, 'spat');
      else x.b.clarinet(x, h, n * x.STEP, 0.3, 'spat', true);
    }),
  ],
};

// Region 3's boss, the forge titan: B Phrygian (the C above the B grinding against it), 162 BPM. Anvils on the
// backbeat, a low brass ostinato, war drums, the bellows breathing, horns on the tune. His phases escalate it: phase 2
// brings the kit, a male choir chanting and a chain-rattle shaker in 16ths answered by horns; phase 3 lifts it a
// semitone (C Phrygian) with double-time drums, a distorted bass, the lead and brass stabs: everything in.
const BELLOWS_OST = bassBar('0:2 . . 0:2 . . 1:2 . 0:2 . . 0:2 . . -2:2 .');
const BELLOWS_BASS = bassBar('0:1 . 0:1 . 0:1 0:1 1:1 . 0:1 . 0:1 . 0:1 0:1 12:1 .');
const BELLOWS_CHANT = ['X.......X...x.x.', 'X.......X.......'];
const BELLOWS: Song = {
  track: 'bellows',
  name: 'Bellows',
  key: 'B Phrygian (phase 3: C Phrygian)',
  bpm: 162,
  meter: 16,
  beat: 4,
  bars: 8,
  chords: chords('Bm | C | Bm | D | Em | C | Am C | Bm'),
  melody: mel(
    16,
    'b4:2 b4:1 c5:1 b4:2 f#5:4 e5:2 d5:4 | c5:2 c5:1 d5:1 c5:2 g5:4 f#5:2 e5:4 | d5:2 d5:1 e5:1 d5:2 a5:4 g5:2 f#5:4 | a5:8 f#5:4 d5:4 |' +
      'e5:4 g5:2 b5:2 c6:4 b5:4 | c6:4 b5:2 a5:2 g5:4 e5:4 | a5:4 g5:2 e5:2 c5:4 e5:2 g5:2 | f#5:4 e5:2 c5:2 b4:8',
  ),
  echo: 0.3,
  swing: 0,
  keyUp: 1,
  intense: [
    pad({ level: 0.13, hz: 1000, attack: 0.1, shift: -12 }),
    part('base', (x) => {
      const n = BELLOWS_OST[x.s];
      if (!n) return;
      const len = n[1] * x.STEP * 0.85;
      x.b.trombone(x, x.chord.root + 12 + n[0], len, 0.17, 'brass');
      if (x.s % 8 === 0) x.b.tuba(x, x.t, x.chord.root + n[0], len, 0.16, 'brass');
    }),
    melody('base', (x, m, len) => x.b.horn(x, m - 12, len, 0.4 * x.lead)),
    perc(['....X.......X...'], (x, v) => x.b.anvil(x, x.t, v * 1.1, 'perc', 1320)),
    // war drums (in the last phase only the big strokes: the kick has doubled)
    perc(['X..x..x.X.x.X...', 'X..x..x.X.x.X.xx'], (x, v) => (x.phase < 3 || v >= 1) && x.b.taiko(x, x.t, v * 1.15)),
    part('base', (x) => x.s === 0 && x.b.bellows(x, x.t, x.song.meter * x.STEP, 0.9, x.bar % 2 === 1)),
    riser(0.8),
    part('drums', (x) => {
      // phase 3: the kick and the hats double
      const p3 = x.phase >= 3;
      const fill = x.last && x.s >= 8;
      const v = p3 ? 0.9 : 0.8;
      const k = hit(p3 ? 'X.x.X.x.X.x.X.x.' : 'X...X...X...X.x.', x.s);
      if (k && !fill) x.b.kick(x, x.t, k * v, 0.95);
      const sn = fill ? hit('........XxXxXXXX', x.s) : hit('....X.......X...', x.s);
      if (sn) x.b.snare(x, x.t, sn * v, sn >= 1 && !fill);
      if (fill && x.s % 2 === 0) x.b.tom(x, x.t, 150 - (x.s - 8) * 9, (0.7 + (x.s - 8) * 0.04) * v);
      if ((x.bar === 0 || x.bar === 4) && x.s === 0) x.b.crash(x, x.t, v * 0.8);
      else if (!fill) {
        const h = hit(p3 ? 'XoxoXoxoXoxoXoxo' : 'x.o.x.o.x.o.x.o.', x.s);
        if (h) x.b.hat(x, x.t, h * v);
      }
    }),
    // the bass (distorted in the last phase)
    part('bass', (x) => {
      const n = BELLOWS_BASS[x.s];
      if (!n) return;
      if (x.phase >= 3) x.b.grit(x, x.chord.root + n[0], n[1] * x.STEP * 0.9, 0.1);
      else x.b.bass(x, x.chord.root + n[0], n[1] * x.STEP * 0.9, { level: 0.3, hz: [1900, 500], sub: 1.4 });
    }),
    part('lead', (x) => {
      if (!x.note) return;
      const [m, n] = x.note;
      x.b.horn(x, m, n * x.STEP, 0.26, 'lead');
      x.b.lead(x, m, n * x.STEP, 0.08, 'pulse25', 3400, false);
    }),
    // phase 2 on: the choir chants, a chain rattles in 16ths and horns answer it; phase 3: brass stabs too
    perc(BELLOWS_CHANT, (x, v) => x.b.chant(x, (v >= 1 ? 3 : 1.5) * x.STEP, 0.3 * v), 'stabs'),
    part('stabs', (x) => x.s % 4 === 0 && x.b.rattle(x, x.t, x.STEP, 1)),
    part('stabs', (x) => {
      if (x.bar % 2 === 0) return;
      if (x.s === 8) x.b.horn(x, tone(x.chord, 2), 3 * x.STEP, 0.24, 'stab');
      else if (x.s === 11) x.b.horn(x, tone(x.chord, 1), 5 * x.STEP, 0.24, 'stab');
    }),
    part('stabs', (x) => x.phase >= 3 && x.s % 4 === 2 && x.b.stab(x, 2 * x.STEP, 0.36)),
  ],
};

// ---- Region 4, the Duskmire: a fen at a dusk that never ends ----

/** A bass held through a whole bar of `steps` (the calm arrangements' roots). */
const held = (steps: number): Note[] => bassBar(['0:' + steps, ...Array(steps - 1).fill('.')].join(' '));

// Act 10, the lantern fen: E flat Mixolydian (the D flat in place of a D: a blue, back-porch major), 84 BPM in 12/8,
// a lazy shuffle. A slide dobro rolls the chords with a soft banjo, a harmonica sings the tune, a frog-croak guiro and a
// cricket shaker keep the time over an upright bass walking slow. The fight brings a washboard groove, the bass in
// 8ths and the dobro on the tune; the lead is the harmonica wailing an octave up.
const DUSK1_ROLL = '0.2.4.1.3.5.0.2.4.1.3.5.'; // a banjo roll, triplet 8ths
const DUSK1_WALK = bassBar('0:6 . . . . . 4:6 . . . . . 7:6 . . . . . 9:6 . . . . .');
const DUSK1_8THS = bassBar('0:2 . 0:2 . 7:2 . 12:2 . 7:2 . 0:2 . 0:2 . 7:2 . 10:2 . 12:2 . 7:2 . 4:2 .');
const DUSK1: Song = {
  track: 'dusk1',
  name: 'Lanternfen',
  key: 'Eb Mixolydian',
  bpm: 84,
  meter: 24,
  beat: 6,
  bars: 8,
  split: 12,
  chords: chords('Eb | Db | Ab | Eb | Eb | Db | Ab Bbm | Eb'),
  melody: mel(
    24,
    'bb4:4 c5:2 eb5:6 db5:4 c5:2 bb4:6 | ab4:4 bb4:2 db5:6 c5:4 bb4:2 ab4:6 | c5:4 eb5:2 f5:6 eb5:4 c5:2 ab4:6 | bb4:12 r:6 g4:2 ab4:2 bb4:2 |' +
      'eb5:4 f5:2 g5:6 f5:4 eb5:2 db5:6 | f5:4 eb5:2 db5:6 c5:4 bb4:2 ab4:6 | c5:6 ab4:6 bb4:6 db5:6 | eb5:18 r:6',
  ),
  echo: 0.34,
  swing: 0,
  calm: [
    pad({ level: 0.07, hz: 800, attack: 0.5, wave: 'triangle', detune: 8 }),
    part('base', (x) => x.s % 6 === 0 && x.b.dobro(x, x.t, tone(x.chord, x.s % 12 ? 1 : 0), x.s % 12 ? 0.26 : 0.32, { len: 4 * x.STEP })),
    part('base', (x) => {
      const m = pat(DUSK1_ROLL, x);
      if (m !== null && x.s % 6 !== 0) x.b.banjo(x, x.t, m + 12, 0.12);
    }),
    melody('base', (x, m, len) => x.b.harmonica(x, m, len, 0.4, 'bell')),
    bass(() => DUSK1_WALK, { level: 0.24, hz: [800, 320], sub: 1.2, gate: 0.9, hold: 0.8 }, 'base'),
    perc(['......x.....-.....x.....'], (x, v) => x.b.croak(x, x.t, v)),
    perc(['..o...o.....o...o.....o.'], (x, v) => x.b.cricket(x, x.t, v)),
    riser(0.25),
    chime(87, 0.6),
  ],
  intense: [
    pad({ level: 0.11, hz: 1000, attack: 0.2, wave: 'triangle', detune: 12 }),
    melody('base', (x, m, len) => x.b.dobro(x, x.t, m, 0.54 * x.lead, { len, role: 'duet' })),
    part('base', (x) => {
      const m = pat(DUSK1_ROLL, x);
      if (m !== null) x.b.banjo(x, x.t, m + 12, x.s % 6 ? 0.1 : 0.14);
    }),
    perc(['......x.....-.....x.....'], (x, v) => x.b.croak(x, x.t, v)),
    riser(0.6),
    kit({
      kick: ['X.....x.....X.....x.....', 'X.....x.....X.....x...x.'],
      snare: ['......X...........X.....'],
      hats: ['........................'],
      clap: false,
      fill: { snare: '......X.....X.x.X.XxXxXX' },
      crash: [0],
      level: 0.75,
    }),
    // the washboard: a shuffle on the triplet 8ths (long-short), scraped harder on the backbeat
    perc(['x...o.x.o.o.x...o.X.o.o.'], (x, v) => !(x.last && x.s >= 12) && x.b.washboard(x, x.t, v), 'drums'),
    bass(() => DUSK1_8THS, { level: 0.34, hz: [1500, 440], sub: 1.35 }),
    melody('lead', (x, m, len) => x.b.harmonica(x, m + 12, len, 0.17, 'lead', len >= 6 * x.STEP)),
  ],
};

// Act 11, the drowned causeway: G Aeolian (the natural minor, no leading note: the tide doesn't resolve), 102 BPM in
// 6/4, the bar heard as 3+3 against 2+2+2, a tide-like hemiola. A vibraphone with a slow tremolo plays the chords in
// threes over a low accordion drone in twos, a bowed saw sings the tune, the water laps the stones every bar. The
// fight brings hand claps and a talking drum on the hemiola; the lead is a reedy accordion.
const DUSK2_VIBES = [0, -1, -1, 1, -1, -1, 2, -1, -1, 1, -1, -1, 0, -1, -1, 2, -1, -1, 3, -1, -1, 2, -1, -1]; // in threes
const DUSK2_DRONE = bassBar('0:8 . . . . . . . 7:8 . . . . . . . 0:8 . . . . . . .'); // in twos
const DUSK2_BASS = bassBar('0:3 . . 0:3 . . 12:2 . 7:3 . . 0:3 . . 10:2 . 7:2 . 5:2 .');
const DUSK2_TALK = ['U.....d.....U.....d..u..', 'U.....d.....U..d..U..d.u'];
const DUSK2: Song = {
  track: 'dusk2',
  name: 'The Drowned Causeway',
  key: 'G Aeolian',
  bpm: 102,
  meter: 24,
  beat: 4,
  bars: 8,
  split: 12,
  chords: chords('Gm | Eb | Cm | Dm | Gm | Bb | Eb F | Gm'),
  melody: mel(
    24,
    'd5:8 bb4:4 g4:12 | g5:8 f5:4 eb5:12 | eb5:8 d5:4 c5:8 bb4:4 | a4:12 d5:12 |' +
      'd5:8 g5:4 bb5:12 | a5:8 f5:4 d5:12 | eb5:8 g5:4 f5:8 a5:4 | g5:20 r:4',
  ),
  echo: 0.4,
  swing: 0,
  calm: [
    part('base', (x) => {
      const k = DUSK2_VIBES[x.s];
      if (k >= 0) x.b.vibes(x, x.t, tone(x.chord, k) + 12, x.s % 12 ? 0.18 : 0.24, (x.s / 3) % 2);
    }),
    part('base', (x) => {
      const n = DUSK2_DRONE[x.s];
      if (n) x.b.accordion(x, x.chord.root + 12 + n[0], n[1] * x.STEP, 0.12, 'pad', true);
    }),
    melody('base', (x, m, len) => x.b.bowedSaw(x, m, len, 0.3, 'bell')),
    bass(() => held(24), { level: 0.2, hz: [600, 280], sub: 1.25, gate: 1.04, hold: 0.94 }, 'base'),
    part('base', (x) => x.s === 0 && x.b.lap(x, x.t + 0.1, x.song.meter * x.STEP * 0.8, 1)),
    riser(0.25),
  ],
  intense: [
    pad({ level: 0.1, hz: 1100, attack: 0.25, detune: 10 }),
    part('base', (x) => {
      const k = DUSK2_VIBES[x.s];
      if (k >= 0) x.b.vibes(x, x.t, tone(x.chord, k) + 12, x.s % 12 ? 0.22 : 0.3, (x.s / 3) % 2);
    }),
    melody('base', (x, m, len) => x.b.bowedSaw(x, m, len, 0.32 * x.lead, 'bell')),
    part('base', (x) => {
      const k = DUSK2_TALK[x.bar % 2][x.s];
      if (k !== '.') x.b.talkingDrum(x, x.t, k === k.toUpperCase() ? 1.1 : 0.75, k.toLowerCase() === 'u');
    }),
    part('base', (x) => x.s === 0 && x.b.lap(x, x.t + 0.1, x.song.meter * x.STEP * 0.7, 1.2)),
    riser(0.6),
    kit({
      kick: ['X.......X.......X.......', 'X.......X.......X.....x.'],
      snare: ['........................'],
      hats: ['x.o.x.o.x.o.x.o.x.o.x.o.'],
      clap: false,
      fill: { kick: 'X.......X.......X.......', toms: '................X.X.XxXx' },
      crash: [0],
      level: 0.75,
    }),
    // hand claps in threes against the kick's twos (the hemiola)
    perc(['............X...........', '............X.....x.....'], (x, v) => x.b.clap(x, x.t, v * 1.1), 'drums'),
    perc(['......x...........x.....'], (x, v) => x.b.clap(x, x.t, v * 0.8), 'drums'),
    bass(() => DUSK2_BASS, { level: 0.34, hz: [1500, 420], sub: 1.35 }),
    melody('lead', (x, m, len) => x.b.accordion(x, m + 12, len, 0.12)),
  ],
};

// Act 12, the gloaming mere: A Phrygian (the B flat over the A, dark and still), 120 BPM. A low pipe organ holds the
// chords, a choir sings "oo", a bell tolls every two bars across the water, a theremin's wavering sine sings the tune.
// The fight drives it: a 16th-note bass, taiko, the organ in stabs; the lead is the theremin an octave up.
const DUSK3_BASS = bassBar('0:1 0:1 12:1 0:1 0:1 0:1 12:1 0:1 0:1 0:1 12:1 0:1 10:1 0:1 7:1 0:1');
const DUSK3: Song = {
  track: 'dusk3',
  name: 'The Gloaming Mere',
  key: 'A Phrygian',
  bpm: 120,
  meter: 16,
  beat: 4,
  bars: 8,
  chords: chords('Am | Bb | Am | Gm | F | Bb | Gm Bb | Am'),
  melody: mel(
    16,
    'e5:6 f5:2 e5:8 | d5:4 f5:4 bb5:8 | a5:6 g5:2 e5:4 c5:4 | d5:12 r:4 |' + 'c5:4 f5:4 a5:6 c6:2 | bb5:6 a5:2 f5:4 d5:4 | g5:4 bb5:4 a5:4 g5:4 | a5:12 r:4',
  ),
  echo: 0.42,
  swing: 0,
  calm: [
    part('base', (x) => (x.change || x.first) && x.b.organ(x, x.chord.tones.slice(0, 3).map((m) => m - 12), x.left, 0.07)),
    part('base', (x) => (x.change || x.first) && x.b.choir(x, 0.12)),
    melody('base', (x, m, len) => x.b.theremin(x, m, len, 0.3, 'bell')),
    bass(() => WHOLE, { level: 0.2, hz: [500, 260], sub: 1.3, gate: 1.05, hold: 0.94 }, 'base'),
    part('base', (x) => x.bar % 2 === 0 && x.s === 0 && x.b.toll(x, x.t, x.chord.root + 12, 0.16)),
    riser(0.25),
  ],
  intense: [
    part('base', (x) => (x.change || x.first) && x.b.organ(x, x.chord.tones.slice(0, 3).map((m) => m - 12), x.left, 0.05)),
    // the organ in stabs on the offbeats
    part('base', (x) => (x.s === 6 || x.s === 14) && x.b.organ(x, x.chord.tones.slice(0, 3), 1.5 * x.STEP, 0.05, 'arp')),
    melody('base', (x, m, len) => x.b.theremin(x, m, len, 0.3 * x.lead, 'bell')),
    part('base', (x) => x.bar % 2 === 0 && x.s === 0 && x.b.toll(x, x.t, x.chord.root + 12, 0.14)),
    perc(['X.....X...X.....', 'X.....X...X...x.'], (x, v) => x.b.taiko(x, x.t, v * 1.1)),
    riser(0.7),
    kit({
      kick: ['X.......X.......', 'X.......X.....x.'],
      snare: ['....X.......X...'],
      hats: ['x.x.x.x.x.x.x.x.'],
      clap: true,
      fill: { snare: '....X.......XxXX', hats: 'x.x.x.x.x.x.....' },
      crash: [0, 4],
      level: 0.8,
    }),
    bass(() => DUSK3_BASS, { level: 0.32, hz: [1700, 460], sub: 1.3, gate: 0.8 }),
    melody('lead', (x, m, len) => x.b.theremin(x, m + 12, len, 0.15, 'lead')),
  ],
};

// Act 10's mini-boss, the toad-king of the fen: a zydeco two-step in E Mixolydian, 176 BPM. An accordion pumps the
// tune, a washboard scrapes 16ths, a fiddle answers, and a tuba burps at the end of every phrase. The combo brings the
// two-step kit, the tuba walking, then the fiddle on the tune; once he lights up (phase 2) the accordion's chords stab
// the offbeats and the burps double.
const BOG_WALK = bassBar('0:4 . . . 7:4 . . . 0:4 . . . 7:4 . . .');
const BOG_TURN = bassBar('0:4 . . . 4:4 . . . 7:4 . . . 9:2 . 10:2 .');
const BELLYBOG: Song = {
  track: 'bellybog',
  name: 'Old Bellybog',
  key: 'E Mixolydian',
  bpm: 176,
  meter: 16,
  beat: 4,
  bars: 8,
  chords: chords('E | E | A | E | B7 | A | E D | E'),
  melody: mel(
    16,
    'b4:2 e5:2 g#5:2 b5:2 g#5:2 e5:2 f#5:4 | g#5:2 f#5:2 e5:2 d5:2 e5:8 | c#5:2 e5:2 a5:2 c#6:2 b5:2 a5:2 f#5:4 | g#5:4 e5:4 b4:8 |' +
      'd#5:2 f#5:2 a5:2 b5:2 a5:2 f#5:2 d#5:4 | c#5:2 e5:2 a5:4 f#5:2 e5:2 c#5:4 | b4:2 e5:2 g#5:4 a5:2 f#5:2 d5:4 | e5:12 r:4',
  ),
  echo: 0.2,
  swing: 0.12,
  phased: true,
  intense: [
    melody('base', (x, m, len) => x.b.accordion(x, m, len, 0.4 * (0.55 + 0.45 * x.lead), 'bell')),
    // the left hand: bass note on the beat, the chord on the "and" (the bellows' oom-pah)
    part('base', (x) => {
      if (x.s % 4 === 2) x.b.accordion(x, x.chord.tones[1], 1.2 * x.STEP, 0.08, 'arp', true);
    }),
    perc(['xoxoXoxoxoxoXoxo'], (x, v) => x.b.washboard(x, swung(x), v * 0.9, 'perc')),
    // the tuba's burp at the end of each phrase
    part('base', (x) => x.bar % 2 === 1 && x.s === 12 && x.b.tuba(x, x.t, x.chord.root - 12, 3 * x.STEP, 0.26, 'brass')),
    riser(0.5),
    kit({
      kick: ['X.......X.......'],
      snare: ['....X.......X...'],
      hats: ['................'],
      clap: false,
      fill: { snare: '....X.......XxXX' },
      crash: [0],
      level: 0.85,
    }),
    part('bass', (x) => {
      const n = (x.bar % 4 === 3 ? BOG_TURN : BOG_WALK)[x.s];
      if (n) x.b.tuba(x, x.t, x.chord.root - 12 + n[0], n[1] * x.STEP * 0.8, 0.36);
    }),
    melody('lead', (x, m, len) => x.b.fiddle(x, m, len, 0.15)),
    // phase 2: he's lit up: the chords stab the offbeats and he burps twice as often
    part('stabs', (x) => x.s % 4 === 2 && x.b.accordion(x, tone(x.chord, 2), 1.2 * x.STEP, 0.1, 'stab')),
    part('stabs', (x) => x.bar % 2 === 0 && x.s === 12 && x.b.tuba(x, x.t, x.chord.root - 12, 3 * x.STEP, 0.24, 'stab')),
  ],
};

// Act 11's mini-boss, the floodgate engineer: a work song in D Dorian, 114 BPM in 7/4 counted 4+3. A mallet rings a
// pipe on every beat, a bari sax plays the riff, a ratchet turns like a wheel, a steam whistle blows every 4 bars. The
// combo brings the kit on the 4+3, a tuba, then the sax up an octave; in phase 2 (the spillway) the whistle blows every
// bar and brass stabs mark the 3.
const SLUICE_BASS = bassBar('0:4 . . . 0:2 . 7:2 . 10:4 . . . 12:2 . 7:2 . 0:4 . . . 7:4 . . . 5:2 . 7:2 .');
const SLUICE: Song = {
  track: 'sluiceKeeper',
  name: 'The Sluice Keeper',
  key: 'D Dorian',
  bpm: 114,
  meter: 28,
  beat: 4,
  bars: 8,
  split: 16,
  chords: chords('Dm | C | Dm | G | Dm | F | C G | Dm'),
  melody: mel(
    28,
    'd4:4 f4:4 a4:4 g4:4 f4:6 e4:6 | e4:4 g4:4 c5:4 b4:4 a4:6 g4:6 | d4:4 f4:4 a4:4 c5:4 b4:6 a4:6 | g4:8 b4:8 d5:12 |' +
      'a4:4 c5:4 d5:4 f5:4 e5:6 d5:6 | c5:4 a4:4 f4:4 a4:4 c5:12 | e5:4 d5:4 c5:8 b4:6 a4:6 | d5:16 r:12',
  ),
  echo: 0.22,
  swing: 0,
  phased: true,
  intense: [
    pad({ level: 0.06, hz: 900, attack: 0.1, wave: 'square', detune: 6 }),
    part('base', (x) => x.note && x.b.sax(x, x.t, x.note[0] - 12, x.note[1] * x.STEP, 0.32 * (0.5 + 0.5 * x.lead))),
    // the mallet on the pipe: every beat, the "1" of each group harder
    perc(['X...x...x...x...X...x...x...'], (x, v) => x.b.pipe(x, x.t, v, x.s === 16 ? 720 : 640)),
    part('base', (x) => x.s === 16 && x.b.ratchet(x, x.t, x.STEP, 0.9)),
    part('base', (x) => x.bar % 4 === 3 && x.s === 16 && x.b.whistle(x, x.t, 6 * x.STEP, 0.16)),
    riser(0.5),
    kit({
      kick: ['X.......x.......X.......x...', 'X.......x.....x.X.......x...'],
      snare: ['........X...............X...'],
      hats: ['x.x.x.x.x.x.x.x.x.x.x.x.x.x.'],
      clap: true,
      fill: { snare: '........X...........X.XxXxXX', hats: 'x.x.x.x.x.x.x.x.x.x.........' },
      crash: [0],
      level: 0.8,
    }),
    bass(() => SLUICE_BASS, { level: 0.34, hz: [1500, 420], sub: 1.35 }),
    melody('lead', (x, m, len) => x.b.sax(x, x.t, m, len, 0.2, { role: 'lead', honk: true })),
    // phase 2, the spillway: the whistle every bar, brass stabs on the 3
    part('stabs', (x) => x.bar % 4 !== 3 && x.s === 16 && x.b.whistle(x, x.t, 3 * x.STEP, 0.12, 'stab')),
    part('stabs', (x) => (x.s === 16 || x.s === 20) && x.b.stab(x, 2 * x.STEP, 0.26)),
  ],
};

// Region 4's boss, the lighthouse: C sharp Phrygian (the D over the C sharp), 152 BPM; a phase down a whole tone in the
// last (B Phrygian: the mapmaker's redraw). Phase 1: a foghorn drone, a bell tower tolling, strings in tremolo, war
// drums. Phase 2 adds a choir and a harpsichord scratching 16ths like a pen. Phase 3 drops a whole tone and brings
// double-time drums, a distorted bass and the lead: everything in.
const LIGHT_BASS = bassBar('0:1 . 0:1 0:1 1:1 . 0:1 0:1 0:1 . 0:1 0:1 12:1 . 10:1 .');
const LIGHT_PEN = [0, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 3, 4, 2, 3, 1];
const LIGHTHOUSE: Song = {
  track: 'lighthouse',
  name: 'The Gloaming Lighthouse',
  key: 'C# Phrygian (phase 3: B Phrygian)',
  bpm: 152,
  meter: 16,
  beat: 4,
  bars: 8,
  chords: chords('C#m | D | C#m | Bm | A | D | Bm D | C#m'),
  melody: mel(
    16,
    'c#5:4 d5:2 c#5:2 g#5:8 | f#5:4 e5:2 d5:2 a4:8 | c#5:4 e5:2 g#5:2 b5:4 a5:4 | f#5:12 d5:4 |' +
      'e5:4 a5:4 c#6:6 b5:2 | a5:4 f#5:4 d5:6 e5:2 | f#5:4 d5:4 a5:4 f#5:4 | c#5:12 r:4',
  ),
  echo: 0.3,
  swing: 0,
  keyUp: -2,
  intense: [
    part('base', (x) => (x.change || x.first) && x.b.tremolo(x, 0.06)),
    part('base', (x) => x.bar % 2 === 0 && x.s === 0 && x.b.foghorn(x, x.t, x.chord.root - 12, 6 * x.STEP, 0.16)),
    part('base', (x) => (x.s === 0 || x.s === 8) && x.b.toll(x, x.t, x.chord.root + 24, x.s ? 0.08 : 0.12)),
    melody('base', (x, m, len) => x.b.horn(x, m - 12, len, 0.38 * x.lead)),
    // war drums (in the last phase only the big strokes: the kick has doubled)
    perc(['X..x..x.X.x.X...', 'X..x..x.X.x.X.xx'], (x, v) => (x.phase < 3 || v >= 1) && x.b.taiko(x, x.t, v * 1.1)),
    riser(0.8),
    part('drums', (x) => {
      // phase 3: the kick and the hats go double-time
      const p3 = x.phase >= 3;
      const fill = x.last && x.s >= 8;
      const v = p3 ? 0.9 : 0.8;
      const k = hit(p3 ? 'X.x.X.x.X.x.X.x.' : 'X.......X...X...', x.s);
      if (k && !fill) x.b.kick(x, x.t, k * v, 0.95);
      const sn = fill ? hit('........XxXxXXXX', x.s) : hit('....X.......X...', x.s);
      if (sn) x.b.snare(x, x.t, sn * v, sn >= 1 && !fill);
      if ((x.bar === 0 || x.bar === 4) && x.s === 0) x.b.crash(x, x.t, v * 0.8);
      else if (!fill) {
        const h = hit(p3 ? 'XoxoXoxoXoxoXoxo' : 'x.o.x.o.x.o.x.o.', x.s);
        if (h) x.b.hat(x, x.t, h * v);
      }
    }),
    part('bass', (x) => {
      const n = LIGHT_BASS[x.s];
      if (!n) return;
      if (x.phase >= 3) x.b.grit(x, x.chord.root + n[0], n[1] * x.STEP * 0.9, 0.1);
      else x.b.bass(x, x.chord.root + n[0], n[1] * x.STEP * 0.9, { level: 0.3, hz: [1800, 480], sub: 1.4 });
    }),
    part('lead', (x) => {
      if (!x.note) return;
      x.b.theremin(x, x.note[0], x.note[1] * x.STEP, 0.16, 'lead');
      x.b.horn(x, x.note[0], x.note[1] * x.STEP, 0.16, 'lead');
    }),
    // phase 2 on: the choir, and a harpsichord scratching 16ths like a pen redrawing the line
    part('stabs', (x) => (x.change || x.first) && x.b.choir(x, 0.3, { oct: 1, role: 'hymn' })),
    part('stabs', (x) => {
      const k = LIGHT_PEN[x.s];
      x.b.harpsi(x, x.t, tone(x.chord, k) + 12, x.s % 4 ? 0.07 : 0.1, x.s % 2);
    }),
    part('stabs', (x) => x.phase >= 3 && x.s % 4 === 2 && x.b.stab(x, 2 * x.STEP, 0.34)),
  ],
};

export const SONGS: Record<MusicTrack, Song> = {
  title: TITLE,
  camp: CAMP,
  act1: ACT1,
  act2: ACT2,
  act3: ACT3,
  captain: CAPTAIN,
  golem: GOLEM,
  boarKing: BOAR_KING,
  frost1: FROST1,
  frost2: FROST2,
  frost3: FROST3,
  rimehorn: RIMEHORN,
  matron: MATRON,
  glacia: GLACIA,
  ash1: ASH1,
  ash2: ASH2,
  ash3: ASH3,
  rumbleback: RUMBLEBACK,
  hobnob: HOBNOB,
  bellows: BELLOWS,
  dusk1: DUSK1,
  dusk2: DUSK2,
  dusk3: DUSK3,
  bellybog: BELLYBOG,
  sluiceKeeper: SLUICE,
  lighthouse: LIGHTHOUSE,
};

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
  // Region 2 (labels name no place or foe: the playtester opens this panel)
  { id: 'frost1', label: 'Act 4: map', track: 'frost1', intense: false },
  { id: 'frost1-fight', label: 'Act 4: fight', track: 'frost1', intense: true },
  { id: 'frost2', label: 'Act 5: map', track: 'frost2', intense: false },
  { id: 'frost2-fight', label: 'Act 5: fight', track: 'frost2', intense: true },
  { id: 'frost3', label: 'Act 6: map', track: 'frost3', intense: false },
  { id: 'frost3-fight', label: 'Act 6: fight', track: 'frost3', intense: true },
  { id: 'rimehorn', label: 'Act 4 mini-boss', track: 'rimehorn', intense: true },
  { id: 'matron', label: 'Act 5 mini-boss', track: 'matron', intense: true },
  { id: 'glacia1', label: 'Act 6 boss, phase 1', track: 'glacia', intense: true, phase: 1 },
  { id: 'glacia2', label: 'Act 6 boss, phase 2', track: 'glacia', intense: true, phase: 2 },
  { id: 'glacia3', label: 'Act 6 boss, phase 3', track: 'glacia', intense: true, phase: 3 },
  // Region 3 (the same: acts by number only)
  { id: 'ash1', label: 'Act 7: map', track: 'ash1', intense: false },
  { id: 'ash1-fight', label: 'Act 7: fight', track: 'ash1', intense: true },
  { id: 'ash2', label: 'Act 8: map', track: 'ash2', intense: false },
  { id: 'ash2-fight', label: 'Act 8: fight', track: 'ash2', intense: true },
  { id: 'ash3', label: 'Act 9: map', track: 'ash3', intense: false },
  { id: 'ash3-fight', label: 'Act 9: fight', track: 'ash3', intense: true },
  { id: 'rumbleback', label: 'Act 7 mini-boss', track: 'rumbleback', intense: true },
  { id: 'hobnob1', label: 'Act 8 mini-boss, phase 1', track: 'hobnob', intense: true, phase: 1 },
  { id: 'hobnob2', label: 'Act 8 mini-boss, phase 2', track: 'hobnob', intense: true, phase: 2 },
  { id: 'bellows1', label: 'Act 9 boss, phase 1', track: 'bellows', intense: true, phase: 1 },
  { id: 'bellows2', label: 'Act 9 boss, phase 2', track: 'bellows', intense: true, phase: 2 },
  { id: 'bellows3', label: 'Act 9 boss, phase 3', track: 'bellows', intense: true, phase: 3 },
  { id: 'dusk1', label: 'Act 10: map', track: 'dusk1', intense: false },
  { id: 'dusk1-fight', label: 'Act 10: fight', track: 'dusk1', intense: true },
  { id: 'dusk2', label: 'Act 11: map', track: 'dusk2', intense: false },
  { id: 'dusk2-fight', label: 'Act 11: fight', track: 'dusk2', intense: true },
  { id: 'dusk3', label: 'Act 12: map', track: 'dusk3', intense: false },
  { id: 'dusk3-fight', label: 'Act 12: fight', track: 'dusk3', intense: true },
  { id: 'bellybog1', label: 'Act 10 mini-boss, phase 1', track: 'bellybog', intense: true, phase: 1 },
  { id: 'bellybog2', label: 'Act 10 mini-boss, phase 2', track: 'bellybog', intense: true, phase: 2 },
  { id: 'sluice1', label: 'Act 11 mini-boss, phase 1', track: 'sluiceKeeper', intense: true, phase: 1 },
  { id: 'sluice2', label: 'Act 11 mini-boss, phase 2', track: 'sluiceKeeper', intense: true, phase: 2 },
  { id: 'lighthouse1', label: 'Act 12 boss, phase 1', track: 'lighthouse', intense: true, phase: 1 },
  { id: 'lighthouse2', label: 'Act 12 boss, phase 2', track: 'lighthouse', intense: true, phase: 2 },
  { id: 'lighthouse3', label: 'Act 12 boss, phase 3', track: 'lighthouse', intense: true, phase: 3 },
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

// (Region 2 adds: 'str' bowed strings, 'brass' a brass section, 'drip' percussion into the echo, and 'hymn' a choir
// that joins with a boss's phases, in the stabs layer)
// (Region 3 adds: 'duet' a two-sided chain (two leads trading bars, a spread brass section); 'spat' the same in the
// stabs layer (the other lead joining with a boss's phase); 'rattle' percussion in the stabs layer; 'grit' and 'drive'
// an overdriven bass and lead)
type Role = 'pad' | 'arp' | 'bell' | 'lead' | 'bass' | 'drums' | 'perc' | 'fx' | 'choir' | 'stab' | 'str' | 'brass' | 'drip' | 'hymn' | 'duet' | 'spat' | 'rattle' | 'grit' | 'drive';
const ROLE_LAYER: Record<Role, Layer> = {
  pad: 'base',
  arp: 'base',
  bell: 'base',
  perc: 'base',
  fx: 'base',
  choir: 'base',
  str: 'base',
  brass: 'base',
  drip: 'base',
  duet: 'base',
  lead: 'lead',
  drive: 'lead',
  bass: 'bass',
  grit: 'bass',
  drums: 'drums',
  stab: 'stabs',
  hymn: 'stabs',
  spat: 'stabs',
  rattle: 'stabs',
};

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

  /** ctx time of the next beat not yet scheduled: where a change asked for now (a layer joining) lands. */
  nextBeatAt(): number | null {
    const d = this.deck;
    if (!d || !this.rig) return null;
    return this.next + toPulse(d.song, d.step % d.song.meter) * stepSec(d.song);
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
    if (onPulse(d.song, s)) d = this.onBeat(d, t, s);
    const song = d.song;
    const STEP = stepSec(song);
    for (const g of Object.values(d.groups)) if (g.live || t < g.until) this.play(d, g, t, STEP);
    this.next = t + STEP;
    d.step = (d.step + 1) % (song.bars * song.meter);
  }

  /** A new piece from step `step` at ctx time t: the arrangement asked for, its layers as the combo stands. */
  private newDeck(t: number, step: number): Deck {
    const song = SONGS[this.want.track];
    const phase = phasedSong(song) ? this.phase : 1;
    const d: Deck = { song, step: step % (song.bars * song.meter), arr: arrangementOf(song, this.want.intense), groups: {}, tr: phase >= 3 ? (song.keyUp ?? 0) : 0, phase };
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
    if (s === 0 && phasedSong(d.song) && d.phase !== this.phase) {
      d.phase = this.phase;
      const tr = d.phase >= 3 ? (d.song.keyUp ?? 0) : 0;
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
    else if (role === 'hymn') {
      const sing = out(gain(1), 0.08, 0.55);
      c = { in: input(pan(-0.45, sing)), r: input(pan(0.45, sing)) };
    }
    else if (role === 'str') {
      const tone = out(filter('lowpass', o.hz ?? 3000, 0.6), o.echo ?? 0.1, 0.45);
      c = { in: input(pan(-0.45, tone)), r: input(pan(0.45, tone)) };
    } else if (role === 'brass') c = { in: input(pan(-0.08, out(filter('lowpass', o.hz ?? 3200, 0.7), o.echo ?? 0.12, 0.35))) };
    else if (role === 'drip') c = { in: input(pan(0.3, out(gain(1), o.echo ?? 0.5, 0.35))) };
    else if (role === 'duet' || role === 'spat') {
      const tone = out(filter('lowpass', o.hz ?? 4200, 0.6), o.echo ?? 0.2, 0.35);
      c = { in: input(pan(-0.45, tone)), r: input(pan(0.45, tone)) };
    } else if (role === 'rattle') c = { in: input(pan(0.35, out(gain(1), 0.1, 0.25))) };
    else if (role === 'grit' || role === 'drive') {
      // overdriven: into a waveshaper, then a lowpass takes the fizz off (the bass ducks under the kick too)
      const duck = role === 'grit' ? gain(1, g.dry) : undefined;
      const tone = filter('lowpass', o.hz ?? (role === 'grit' ? 2200 : 2600), 0.7, duck);
      if (!duck) out(tone, o.echo ?? 0.25, 0.25);
      const drive = keep(ctx.createWaveShaper());
      drive.curve = this.h.drive(role === 'grit' ? 4 : 3) as Float32Array<ArrayBuffer>;
      drive.connect(tone);
      c = { in: input(drive), duck };
    }
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
  lead(x: Step, m: number, len: number, level: number, wave: Wave, lp: number, vib = true, role: Role = 'lead'): void {
    const c = this.chain(x.g, role, { hz: lp });
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
  horn(x: Step, m: number, len: number, level: number, role: Role = 'bell'): void {
    const c = this.chain(x.g, role);
    const f = hz(m);
    const l = Math.max(0.1, len);
    const vib = len >= 4 * x.STEP ? { rate: 5, cents: 0, cents1: 10 } : undefined;
    this.h.voice({ at: x.t, type: 'sawtooth', f: [[0, f]], vib, filter: 'lowpass', ff: [[0, 450], [0.06, 1900], [l, 900]], q: 0.8, amp: [[0.04, level], [l * 0.7, level * 0.75], [l * 0.95, 0]], out: c.in });
  }

  /** A fiddle: a bright saw with a quick bow attack and vibrato on the long notes, a faint octave above. */
  fiddle(x: Step, m: number, len: number, level: number, role: Role = 'lead'): void {
    const c = this.chain(x.g, role, { hz: 3800, echo: 0.25 });
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
  stab(x: Step, len: number, level: number, role: Role = 'stab'): void {
    const c = this.chain(x.g, role);
    for (const m of x.chord.tones.slice(0, 3))
      this.h.voice({ at: x.t, type: 'sawtooth', f: [[0, hz(m)]], filter: 'lowpass', ff: [[0, 700], [0.025, 3400], [len, 900]], q: 1, amp: [[0.008, level], [len * 0.5, level * 0.6], [len, 0]], out: c.in });
  }

  /** A low choir under a chord: two detuned pulses through an "aah" formant, swelling in (`oct`: octaves up from
   *  the low one; `role`: 'hymn' for a choir that joins with a boss's phases). */
  choir(x: Step, level: number, o: { oct?: number; role?: Role } = {}): void {
    const c = this.chain(x.g, o.role ?? 'choir');
    const len = x.left;
    const up = 12 * ((o.oct ?? 0) - 1);
    for (const [m, det, side] of [
      [x.chord.tones[0], -8, c.in],
      [x.chord.tones[2], 8, c.r ?? c.in],
    ] as const)
      this.h.voice({
        at: x.t,
        type: 'pulse25',
        f: [[0, hz(m + up)]],
        vib: { rate: 4.6, cents: det },
        filter: 'bandpass',
        ff: [[0, 750]],
        q: 2,
        amp: [[Math.min(0.8, len * 0.4), level], [len, level * 0.7], [len + 0.4, 0]],
        out: side,
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
    const { g, end } = this.h.env(o.level, t, 0.004, dur * (o.hold ?? 0.6), dur, 0.04);
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
    for (const b of [x.g.chains.bass?.duck?.gain, x.g.chains.grit?.duck?.gain]) {
      if (!b) continue;
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
  tom(x: Step, t: number, f: number, v: number, into: 'drums' | 'perc' = 'drums'): void {
    const c = this.chain(x.g, into);
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

  // ---------------------------------------------------------------- Region 2's instruments

  /** A celesta: a struck steel bar over a wooden box: a round sine ringing long, a soft octave and a quick bright
   *  ping (rounder and longer than the glockenspiel). */
  celesta(x: Step, m: number, level: number, role: Role = 'bell'): void {
    const c = this.chain(x.g, role);
    const f = hz(m);
    this.h.tone({ type: 'sine', f, at: x.t, attack: 0.003, dur: 1.3, gain: level, out: c.in });
    this.h.tone({ type: 'sine', f: f * 2, at: x.t, attack: 0.002, dur: 0.45, gain: level * 0.34, out: c.in });
    this.h.tone({ type: 'triangle', f: f * 4.02, at: x.t, attack: 0.001, dur: 0.05, gain: level * 0.12, out: c.in });
  }

  /** Plucked strings: a saw whose lowpass snaps shut (pizzicato), or bowed short (`bow`: spiccato, a little
   *  longer and brighter); 8ths and 16ths alternate sides. */
  pizz(x: Step, m: number, level: number, o: { bow?: boolean; role?: Role; hz?: number } = {}): void {
    const c = this.chain(x.g, o.role ?? 'arp', { hz: o.hz ?? 3200, echo: 0.16 });
    const f = hz(m);
    const out = (x.s + (x.s >> 1)) & 1 ? (c.r ?? c.in) : c.in;
    if (o.bow) {
      const d = Math.min(0.2, x.STEP * 1.6);
      this.h.voice({ at: x.t, type: 'sawtooth', f: [[0, f]], filter: 'lowpass', ff: [[0, f * 3], [0.03, f * 7], [d, f * 3]], q: 0.9, amp: [[0.008, level], [d * 0.5, level * 0.6], [d, 0]], out });
      return;
    }
    this.h.voice({ at: x.t, type: 'sawtooth', f: [[0, f]], filter: 'lowpass', ff: [[0, Math.min(9000, f * 7)], [0.07, f * 1.5]], q: 1.4, amp: [[0.003, level], [0.08, level * 0.4], [0.3, 0]], out });
  }

  /** Sleigh bells: a shake of small bells (quick ringing jingles), a shimmer on the loud ones. */
  sleigh(x: Step, t: number, v: number): void {
    const c = this.chain(x.g, 'perc');
    const n = v >= 0.7 ? 4 : 2;
    this.h.ticks(
      Array.from({ length: n }, (_, i) => t + i * 0.011),
      { gain: 0.5 * v, f: 6800, q: 7, ms: 13, out: c.in },
    );
    if (v >= 0.7) this.h.noise({ at: t, attack: 0.004, dur: 0.12, gain: 0.1 * v, filter: 'highpass', f: 7500, out: c.in });
  }

  /** A glass harmonica: a wet finger on spinning glass: two pure sines a few cents apart (a slow shimmer of
   *  beating) and a soft twelfth, swelling in and fading long. */
  glass(x: Step, m: number, len: number, level: number, role: Role = 'lead'): void {
    const c = this.chain(x.g, role, { hz: 5200, echo: 0.42 });
    const f = hz(m);
    const l = Math.max(0.2, len);
    const amp: Pts = [[Math.min(0.11, l * 0.3), level], [l * 0.85, level * 0.72], [l + 0.4, 0]];
    this.h.voice({ at: x.t, type: 'sine', f: [[0, f * 0.9983]], amp, out: c.in });
    this.h.voice({ at: x.t, type: 'sine', f: [[0, f * 1.0017]], amp: scale(amp, 0.8), out: c.in });
    this.h.tone({ type: 'triangle', f: f * 3, at: x.t, attack: 0.06, dur: Math.min(1.2, l), gain: level * 0.1, out: c.in });
  }

  /** A water-drop woodblock: a hollow knock whose pitch flicks up as the drop closes, ringing on in the echo. */
  drip(x: Step, t: number, f: number, v: number): void {
    const c = this.chain(x.g, 'drip');
    this.h.tone({ type: 'sine', f, f1: f * 1.75, glide: 0.03, at: t, attack: 0.001, dur: 0.1, gain: 0.34 * v, out: c.in });
    this.h.tone({ type: 'triangle', f: f * 0.5, f1: f * 0.45, glide: 0.04, at: t, attack: 0.001, dur: 0.05, gain: 0.2 * v, out: c.in });
  }

  /** A fretless bass: a warm saw sliding up into the note, its lowpass blooming a moment after the attack (the
   *  "mwah"), over a sine sub that slides with it. */
  fretless(x: Step, m: number, dur: number, level: number): void {
    const c = this.chain(x.g, 'bass');
    const f = hz(m);
    const s = f >= 80 ? f / 2 : f;
    const l = Math.max(0.12, dur);
    const amp: Pts = [[0.025, level], [l * 0.7, level * 0.8], [l, 0]];
    this.h.voice({ at: x.t, type: 'sawtooth', f: [[0, f * 0.94], [0.08, f]], filter: 'lowpass', ff: [[0, 260], [0.12, 1100], [l, 420]], q: 2.5, amp, out: c.in });
    this.h.voice({ at: x.t, type: 'sine', f: [[0, s * 0.94], [0.08, s]], amp: scale(amp, 1.3), out: c.in });
  }

  /** Timpani (tuned D2 to C#3, the chord's root): a boom that settles onto its pitch, its fifth (a triangle, whose
   *  overtones carry it on a phone) and octave partials, the felt mallet's thud. `roll`: a crescendo roll over
   *  `roll` seconds instead (one trembling voice per partial). */
  timpani(x: Step, t: number, m: number, v: number, roll = 0): void {
    const c = this.chain(x.g, 'perc');
    const f = hz(m);
    if (roll) {
      const trem = { rate: 15, depth: 0.75 };
      this.h.voice({ at: t, type: 'sine', f: [[0, f]], trem, amp: [[roll * 0.85, 0.32 * v], [roll, 0.4 * v], [roll + 0.3, 0]], out: c.in });
      this.h.voice({ at: t, type: 'triangle', f: [[0, f * 1.5]], trem, amp: [[roll * 0.85, 0.12 * v], [roll, 0.16 * v], [roll + 0.2, 0]], out: c.in });
      return;
    }
    this.h.tone({ type: 'sine', f: f * 1.05, f1: f, glide: 0.06, at: t, attack: 0.002, dur: 1.1, gain: 0.3 * v, out: c.in });
    this.h.tone({ type: 'triangle', f: f * 1.5, at: t, attack: 0.002, dur: 0.45, gain: 0.24 * v, out: c.in });
    this.h.tone({ type: 'sine', f: f * 2, at: t, attack: 0.002, dur: 0.6, gain: 0.16 * v, out: c.in });
    this.h.noise({ at: t, dur: 0.05, attack: 0.001, gain: 0.24 * v, filter: 'bandpass', f: 520, q: 1, out: c.in });
  }

  /** Tremolo strings on the chord: its three tones on bowed saws (alternate sides), trembling at a 32nd-note rate,
   *  swelling in over the chord. */
  tremolo(x: Step, level: number, o: { oct?: number; hz?: number } = {}): void {
    const c = this.chain(x.g, 'str', { hz: o.hz ?? 3000 });
    const len = x.left;
    const trem = { rate: 2 / x.STEP, depth: 0.65 };
    x.chord.tones.slice(0, 3).forEach((m, i) =>
      this.h.voice({
        at: x.t,
        type: 'sawtooth',
        f: [[0, hz(m + 12 * (o.oct ?? 0))]],
        trem,
        amp: [[Math.min(0.2, len * 0.3), level], [len, level * 0.85], [len + 0.25, 0]],
        out: i % 2 ? c.r : c.in,
      }),
    );
  }

  /** A brass section on the chord (the ostinato): saws whose lowpass flares on the attack, short and punchy. */
  brass(x: Step, len: number, level: number): void {
    const c = this.chain(x.g, 'brass');
    x.chord.tones.slice(0, 3).forEach((m, i) =>
      this.h.voice({ at: x.t, type: 'sawtooth', f: [[0, hz(m)]], filter: 'lowpass', ff: [[0, 500], [0.02, 2600 + i * 300], [len, 800]], q: 0.9, amp: [[0.012, level], [len * 0.6, level * 0.7], [len, 0]], out: c.in }),
    );
  }

  /** A harpsichord: a quilled pluck: a thin bright pulse and a saw an octave up (two choirs of strings), no
   *  sustain; `side` 1 plays on the right. */
  harpsi(x: Step, t: number, m: number, level: number, side = 0): void {
    const c = this.chain(x.g, 'arp', { hz: 6500, echo: 0.12 });
    const f = hz(m);
    const out = side ? c.r! : c.in;
    this.h.tone({ type: 'pulse12', f, at: t, attack: 0.001, dur: 0.55, gain: level, out });
    this.h.tone({ type: 'sawtooth', f: f * 2, at: t, attack: 0.001, dur: 0.22, gain: level * 0.3, out });
  }

  /** The music box gone wrong: a warped cylinder: each note sags flat as it rings and its octave tine is out of
   *  tune (by a different amount each step). */
  warpedBox(x: Step, m: number, level: number): void {
    const c = this.chain(x.g, 'bell');
    const f = hz(m);
    const off = [1.97, 2.035, 1.985, 2.05][x.i % 4];
    this.h.tone({ type: 'triangle', f, f1: f * 0.972, glide: 0.7, at: x.t, attack: 0.002, dur: 0.9, gain: 0.5 * level, out: c.in });
    this.h.tone({ type: 'sine', f: f * off, f1: f * off * 0.985, glide: 0.4, at: x.t, attack: 0.001, dur: 0.45, gain: 0.24 * level, out: c.in });
  }

  /** A cello: a bowed saw through a warm lowpass, the bow biting in, vibrato blooming on long notes, a sine under
   *  it for body. */
  cello(x: Step, m: number, len: number, level: number, role: Role = 'lead', sub = 0): void {
    const c = this.chain(x.g, role, { hz: 2600, echo: 0.2 });
    const f = hz(m);
    const l = Math.max(0.12, len);
    const vib = len >= 3 * x.STEP ? { rate: 5.3, cents: 3, cents1: 18 } : { rate: 5.3, cents: 3 };
    const amp: Pts = [[0.06, level], [l * 0.8, level * 0.85], [l + 0.06, 0]];
    this.h.voice({ at: x.t, type: 'sawtooth', f: [[0, f]], vib, filter: 'lowpass', ff: [[0, 700], [0.08, 2200], [l, 1400]], q: 1.3, amp, out: c.in });
    this.h.voice({ at: x.t, type: 'sine', f: [[0, sub && f >= 80 ? f / 2 : f]], amp: scale(amp, sub || 0.6), out: c.in });
  }

  /** A frame drum: the open "doum" (a deep boom, the hand flat in the middle) or the rim "tek" (a dry slap). */
  frame(x: Step, t: number, v: number, tek = false): void {
    const c = this.chain(x.g, 'perc');
    if (tek) {
      this.h.ticks([t], { gain: 0.9 * v, f: 1250, q: 1.6, ms: 12, out: c.in });
      this.h.tone({ type: 'triangle', f: 420, f1: 330, glide: 0.03, at: t, dur: 0.05, gain: 0.16 * v, out: c.in });
      return;
    }
    this.h.tone({ type: 'triangle', f: 140, f1: 66, glide: 0.1, at: t, attack: 0.002, dur: 0.4, gain: 0.52 * v, out: c.in });
    this.h.noise({ at: t, dur: 0.05, gain: 0.26 * v, filter: 'bandpass', f: 680, q: 1, out: c.in });
  }

  /** Hand claps: three quick bursts. */
  clap(x: Step, t: number, v: number): void {
    const c = this.chain(x.g, 'perc');
    this.h.ticks([t - 0.01, t - 0.004, t + 0.003], { gain: 0.9 * v, f: 1500, q: 1.1, ms: 8, out: c.in });
  }

  /** A hurdy-gurdy drone: a root and its fifth on buzzy pulses, held for the bar. */
  drone(x: Step, root: number, level: number): void {
    const c = this.chain(x.g, 'pad', { hz: 1700 });
    const len = (x.song.meter - x.s) * x.STEP;
    for (const [m, out, det] of [
      [root, c.in, -5],
      [root + 7, c.r!, 5],
    ] as const)
      this.h.tone({ type: 'pulse25', f: hz(m), detune: det, at: x.t, attack: 0.05, hold: len - 0.05, dur: len + 0.3, minTail: 0.25, gain: level, out });
  }

  /** A pipe organ: each note a flue pipe (a soft square) with its octave and twelfth as sines, held. On the
   *  'pad' chain (the chord, alternate sides) or another (the tune). */
  organ(x: Step, notes: number[], len: number, level: number, role: Role = 'pad'): void {
    const c = this.chain(x.g, role, { hz: 2600 });
    notes.forEach((m, i) => {
      const f = hz(m);
      const out = i % 2 && c.r ? c.r : c.in;
      const o = { at: x.t, attack: 0.02, hold: Math.max(0, len - 0.02), dur: len + 0.18, minTail: 0.15, out };
      this.h.tone({ ...o, type: 'square', f, gain: level * 0.5 });
      this.h.tone({ ...o, type: 'sine', f: f * 2, gain: level * 0.4 });
      this.h.tone({ ...o, type: 'sine', f: f * 3, gain: level * 0.18 });
    });
  }

  // ---------------------------------------------------------------- Region 3's instruments

  /** An oud: a fretless lute plucked with a quill: a bright saw whose lowpass snaps shut over a ringing triangle,
   *  sliding up into its note (no frets); 8ths alternate sides. With `len`, a long note is tremolo-picked. */
  oud(x: Step, t: number, m: number, level: number, o: { len?: number; role?: Role } = {}): void {
    const c = this.chain(x.g, o.role ?? 'arp', { hz: 4200, echo: 0.18 });
    const f = hz(m);
    const out = (x.s >> 1) & 1 ? (c.r ?? c.in) : c.in;
    const n = o.len && o.len >= 3.5 * x.STEP ? Math.floor(o.len / x.STEP) : 1;
    for (let i = 0; i < n; i++) {
      const at = t + i * x.STEP;
      const v = level * (i ? 0.5 - 0.06 * (i % 2) : 1);
      const end = i < n - 1 ? x.STEP * 1.1 : 0.45;
      this.h.voice({ at, type: 'sawtooth', f: [[0, f * 0.985], [0.03, f]], filter: 'lowpass', ff: [[0, Math.min(8000, f * 9)], [0.1, f * 2.2]], q: 1.8, amp: [[0.002, v], [Math.min(0.09, end * 0.6), v * 0.4], [end, 0]], out });
      if (!i) this.h.tone({ type: 'triangle', f, at, attack: 0.002, dur: 0.6, gain: v * 0.55, out });
    }
  }

  /** A ney: an end-blown reed flute, more breath than tone: a soft triangle sliding up into each note from a little
   *  under it, a wash of breath all through, vibrato blooming on the long notes. */
  ney(x: Step, m: number, len: number, level: number): void {
    const c = this.chain(x.g, 'lead', { hz: 3800, echo: 0.36 });
    const f = hz(m);
    const l = Math.max(0.15, len);
    const vib = len >= 4 * x.STEP ? { rate: 4.6, cents: 0, cents1: 20 } : undefined;
    const amp: Pts = [[0.07, level], [l * 0.6, level * 0.82], [l * 0.97 + 0.04, 0]];
    const slide: Pts = [[0, f * 0.965], [0.1, f]];
    this.h.voice({ at: x.t, type: 'triangle', f: slide, vib, amp, out: c.in });
    this.h.voice({ at: x.t, type: 'sine', f: scale(slide, 2), amp: scale(amp, 0.12), out: c.in });
    this.h.voice({ at: x.t, type: 'noise', filter: 'bandpass', ff: [[0, f * 1.5], [0.1, f * 2.2]], q: 1.2, amp: scale(amp, 0.5), out: c.in });
  }

  /** A reed drone on fixed notes (the ash plains: E and B), two saws a little apart per note through the pad's dark
   *  lowpass, held to the bar's end. */
  reedDrone(x: Step, notes: number[], level: number): void {
    const c = this.chain(x.g, 'pad', { hz: 900 });
    const len = (x.song.meter - x.s) * x.STEP;
    notes.forEach((m, i) => {
      for (const [out, det] of [
        [c.in, -6],
        [c.r!, 6],
      ] as const)
        this.h.tone({ type: 'sawtooth', f: hz(m), detune: det + i * 2, at: x.t, attack: 0.08, hold: len - 0.08, dur: len + 0.3, minTail: 0.25, gain: level, out });
    });
  }

  /** An ash-hiss shaker: a soft "tsss" of high noise, slower to speak than a shaker. */
  hiss(x: Step, t: number, v: number): void {
    const c = this.chain(x.g, 'perc');
    this.h.noise({ at: t, attack: 0.03, dur: 0.12, gain: 0.22 * v, filter: 'bandpass', f: 5200, q: 0.8, out: c.in });
  }

  /** A doumbek (goblet drum): the deep "doum" in the middle of the head (D), the bright "tek" on the rim (T), the
   *  soft "ka" of the other hand (k). */
  doumbek(x: Step, t: number, v: number, stroke: 'D' | 'T' | 'k'): void {
    const c = this.chain(x.g, 'perc');
    if (stroke === 'D') {
      this.h.tone({ type: 'sine', f: 105, f1: 78, glide: 0.1, at: t, attack: 0.002, dur: 0.4, gain: 0.5 * v, out: c.in });
      this.h.tone({ type: 'triangle', f: 210, f1: 150, glide: 0.06, at: t, attack: 0.001, dur: 0.18, gain: 0.32 * v, out: c.in });
      return;
    }
    const k = stroke === 'T' ? 1 : 0.5;
    this.h.ticks([t], { gain: 1.1 * v * k, f: 3400, q: 3.5, ms: 9, out: c.in });
    this.h.tone({ type: 'triangle', f: 760, f1: 640, glide: 0.03, at: t, dur: 0.07, gain: 0.16 * v * k, out: c.in });
  }

  /** A zurna: a shrill double reed: a thin pulse through a nasal formant, scooping into the note, a quick vibrato. */
  zurna(x: Step, m: number, len: number, level: number): void {
    const c = this.chain(x.g, 'lead', { hz: 4200, echo: 0.28 });
    const f = hz(m);
    const l = Math.max(0.08, len);
    const vib = len >= 3 * x.STEP ? { rate: 6.4, cents: 6, cents1: 26 } : { rate: 6.4, cents: 6 };
    const amp: Pts = [[0.012, level], [l * 0.8, level * 0.85], [l * 0.96 + 0.02, 0]];
    const scoop: Pts = [[0, f * 0.97], [0.025, f]];
    this.h.voice({ at: x.t, type: 'pulse12', f: scoop, vib, filter: 'peaking', ff: [[0, 1400]], q: 2.2, amp, out: c.in });
    this.h.voice({ at: x.t, type: 'sawtooth', f: scoop, filter: 'bandpass', ff: [[0, 2600]], q: 3, amp: scale(amp, 0.35), out: c.in });
  }

  /** A kalimba tine: a round sine with a buzzing octave a few cents sharp and the click of the thumb (`side` 1: the
   *  right side, on a two-sided chain). */
  tine(x: Step, t: number, m: number, level: number, side = 0, role: Role = 'bell'): void {
    const c = this.chain(x.g, role, { hz: 6500, echo: 0.3 });
    const f = hz(m);
    const out = side && c.r ? c.r : c.in;
    this.h.tone({ type: 'sine', f, at: t, attack: 0.002, dur: 1.1, gain: level, out });
    this.h.tone({ type: 'sine', f: f * 2.005, at: t, attack: 0.001, dur: 0.3, gain: level * 0.28, out });
    this.h.tone({ type: 'triangle', f: f * 4.8, at: t, attack: 0.001, dur: 0.04, gain: level * 0.1, out });
  }

  /** A bowed-glass pad: the chord's three tones on rims of glass, each two pure sines beating slowly against each
   *  other and a soft twelfth, swelling in over the chord (alternate sides). */
  glassPad(x: Step, level: number): void {
    const c = this.chain(x.g, 'pad', { hz: 3000 });
    const len = x.left;
    x.chord.tones.slice(0, 3).forEach((m, i) => {
      const f = hz(m + 12);
      const out = i % 2 ? c.r! : c.in;
      const amp: Pts = [[Math.min(0.5, len * 0.4), level], [len, level * 0.8], [len + 0.5, 0]];
      this.h.voice({ at: x.t, type: 'sine', f: [[0, f * 0.998]], amp, out });
      this.h.voice({ at: x.t, type: 'sine', f: [[0, f * 1.002]], amp: scale(amp, 0.8), out });
      this.h.voice({ at: x.t, type: 'triangle', f: [[0, f * 3]], amp: scale(amp, 0.06), out });
    });
  }

  /** Wind chimes: small tubes knocked together, high and inharmonic, ringing into the hall. */
  windChimes(x: Step, level: number): void {
    const c = this.chain(x.g, 'fx');
    [96, 92, 99, 94, 89, 97].forEach((m, i) => {
      const at = x.t + [0, 0.13, 0.21, 0.37, 0.52, 0.71][i];
      const f = hz(m);
      this.h.tone({ type: 'sine', f, at, attack: 0.001, dur: 1.4, gain: 0.05 * level, out: c.in });
      this.h.tone({ type: 'sine', f: f * 2.76, at, attack: 0.001, dur: 0.4, gain: 0.02 * level, out: c.in });
    });
  }

  /** A heartbeat under the floor: a soft sub thump (and a knock a phone can play). */
  heart(x: Step, t: number, v: number): void {
    const c = this.chain(x.g, 'perc');
    this.h.tone({ type: 'sine', f: 64, f1: 44, glide: 0.1, at: t, attack: 0.004, dur: 0.32, gain: 0.5 * v, out: c.in });
    this.h.tone({ type: 'triangle', f: 130, f1: 70, glide: 0.06, at: t, attack: 0.003, dur: 0.12, gain: 0.18 * v, out: c.in });
  }

  /** A marimba: a rosewood bar over its resonator: a warm sine, its tuned partial about four times up dying fast, a
   *  mallet knock; 16ths alternate sides. */
  marimba(x: Step, t: number, m: number, level: number): void {
    const c = this.chain(x.g, 'arp', { hz: 5000, echo: 0.2 });
    const f = hz(m);
    const out = x.s % 2 ? c.r! : c.in;
    this.h.tone({ type: 'sine', f, at: t, attack: 0.002, dur: 0.5, gain: level, out });
    this.h.tone({ type: 'sine', f: f * 3.93, at: t, attack: 0.001, dur: 0.09, gain: level * 0.3, out });
    this.h.tone({ type: 'triangle', f: f * 0.5, at: t, attack: 0.001, dur: 0.03, gain: level * 0.2, out });
  }

  /** Tabla-like hand drums: "na" (N), the ringing rim of the small drum, tuned to the key's B flat, its overtones
   *  nearly harmonic; "tin" (t), softer and shorter; "ge" (G), the big drum's bass, bending up under the heel of the
   *  hand. */
  tabla(x: Step, t: number, v: number, stroke: 'N' | 't' | 'G'): void {
    const c = this.chain(x.g, 'perc');
    if (stroke === 'G') {
      this.h.tone({ type: 'sine', f: 85, f1: 125, glide: 0.18, at: t, attack: 0.003, dur: 0.4, gain: 0.45 * v, out: c.in });
      this.h.tone({ type: 'triangle', f: 170, f1: 240, glide: 0.15, at: t, attack: 0.002, dur: 0.2, gain: 0.2 * v, out: c.in });
      return;
    }
    const f = hz(70);
    const d = stroke === 'N' ? 0.32 : 0.12;
    const k = stroke === 'N' ? 1 : 0.55;
    this.h.tone({ type: 'sine', f, at: t, attack: 0.001, dur: d, gain: 0.3 * v * k, out: c.in });
    this.h.tone({ type: 'sine', f: f * 2, at: t, attack: 0.001, dur: d * 0.6, gain: 0.14 * v * k, out: c.in });
    this.h.tone({ type: 'sine', f: f * 3.02, at: t, attack: 0.001, dur: d * 0.35, gain: 0.08 * v * k, out: c.in });
    this.h.ticks([t], { gain: 0.6 * v * k, f: 3600, q: 2, ms: 5, out: c.in });
  }

  /** An anvil struck with a hammer: a bright inharmonic ring (steel), a click, ringing on. */
  anvil(x: Step, t: number, v: number, role: Role = 'perc', f = 1180): void {
    const c = this.chain(x.g, role);
    this.h.tone({ type: 'sine', f, at: t, attack: 0.001, dur: 0.7, gain: 0.16 * v, out: c.in });
    this.h.tone({ type: 'sine', f: f * 2.71, at: t, attack: 0.001, dur: 0.3, gain: 0.09 * v, out: c.in });
    this.h.tone({ type: 'sine', f: f * 4.95, at: t, attack: 0.001, dur: 0.12, gain: 0.05 * v, out: c.in });
    this.h.ticks([t], { gain: 0.6 * v, f: 4200, q: 1.2, ms: 4, out: c.in });
  }

  /** The forge's bellows: a long breath of filtered noise drawn in (rising) or blown out (falling, a low roar under
   *  it), over `d` seconds. */
  bellows(x: Step, t: number, d: number, level: number, blow: boolean): void {
    const c = this.chain(x.g, 'perc');
    const ff: Pts = blow ? [[0, 1400], [d, 380]] : [[0, 360], [d, 1300]];
    this.h.voice({ at: t, type: 'noise', filter: 'bandpass', ff, q: 1.1, amp: [[d * 0.45, 0.12 * level], [d * 0.8, 0.09 * level], [d, 0]], out: c.in });
    if (blow) this.h.voice({ at: t, type: 'noise', filter: 'lowpass', ff: [[0, 300]], amp: [[d * 0.4, 0.1 * level], [d, 0]], out: c.in });
  }

  /** A male choir humming the chord low ("mmm"): two detuned pulses through a closed-mouth lowpass, swelling in over
   *  the chord. */
  hum(x: Step, level: number): void {
    const c = this.chain(x.g, 'choir');
    const len = x.left;
    for (const [m, det] of [
      [x.chord.tones[0] - 12, -7],
      [x.chord.tones[2] - 12, 7],
    ] as const)
      this.h.voice({ at: x.t, type: 'pulse25', f: [[0, hz(m)]], vib: { rate: 4.2, cents: det }, filter: 'lowpass', ff: [[0, 420]], q: 3, amp: [[Math.min(0.9, len * 0.45), level], [len, level * 0.75], [len + 0.4, 0]], out: c.in });
  }

  /** A trombone: a saw sliding up into the note, its lowpass blaring open and settling, a sine under it for body;
   *  vibrato on the long notes (`right`: on a two-sided chain's right side). */
  trombone(x: Step, m: number, len: number, level: number, role: Role = 'bell', t = x.t, right = false): void {
    const c = this.chain(x.g, role);
    const out = right && c.r ? c.r : c.in;
    const f = hz(m);
    const l = Math.max(0.1, len);
    const vib = len >= 4 * x.STEP ? { rate: 5, cents: 0, cents1: 12 } : undefined;
    const amp: Pts = [[0.04, level], [l * 0.75, level * 0.8], [l * 0.96, 0]];
    const slide: Pts = [[0, f * 0.95], [0.06, f]];
    this.h.voice({ at: t, type: 'sawtooth', f: slide, vib, filter: 'lowpass', ff: [[0, 380], [0.07, 1700], [l, 850]], q: 1.1, amp, out });
    this.h.voice({ at: t, type: 'sine', f: slide, amp: scale(amp, 0.5), out });
  }

  /** A tuba: a round low brass note, a saw through a lowpass that opens a little on the attack, a sine under it
   *  (`right`: on a two-sided chain's right side). */
  tuba(x: Step, t: number, m: number, len: number, level: number, role: Role = 'bass', right = false): void {
    const c = this.chain(x.g, role);
    const out = right && c.r ? c.r : c.in;
    const f = hz(m);
    const l = Math.max(0.08, len);
    const amp: Pts = [[0.02, level], [l * 0.7, level * 0.75], [l, 0]];
    this.h.voice({ at: t, type: 'sawtooth', f: [[0, f]], filter: 'lowpass', ff: [[0, 300], [0.04, 1200], [l, 500]], q: 1, amp, out });
    this.h.voice({ at: t, type: 'sine', f: [[0, f]], amp: scale(amp, 0.9), out });
  }

  /** A forge-hammer drum: a huge low tom, the thud of the skin and the clang of iron in it. */
  hammer(x: Step, t: number, v: number): void {
    const c = this.chain(x.g, 'perc');
    this.h.tone({ type: 'triangle', f: 110, f1: 55, glide: 0.14, at: t, attack: 0.002, dur: 0.55, gain: 0.5 * v, out: c.in });
    this.h.tone({ type: 'sine', f: 62, f1: 40, glide: 0.18, at: t, attack: 0.003, dur: 0.5, gain: 0.3 * v, out: c.in });
    this.h.noise({ at: t, dur: 0.06, attack: 0.001, gain: 0.3 * v, filter: 'bandpass', f: 700, q: 1, out: c.in });
    this.h.tone({ type: 'square', f: 360, f1: 300, glide: 0.05, at: t, attack: 0.001, dur: 0.07, gain: 0.05 * v, out: c.in });
  }

  /** A slap bass: the thumb (a saw whose lowpass snaps from bright to round, over a sine) or a popped string (an
   *  octave up, brighter, with the snap of the string on the frets). */
  slap(x: Step, t: number, m: number, dur: number, level: number, pop: boolean): void {
    const c = this.chain(x.g, 'bass');
    const f = hz(m);
    const l = Math.max(0.06, dur);
    const amp: Pts = [[0.003, level], [l * 0.5, level * 0.6], [l, 0]];
    this.h.voice({ at: t, type: 'sawtooth', f: [[0, f]], filter: 'lowpass', ff: [[0, pop ? 4200 : 2600], [0.06, pop ? 1400 : 600]], q: 3, amp, out: c.in });
    this.h.voice({ at: t, type: 'sine', f: [[0, f >= 80 ? f / 2 : f]], amp: scale(amp, pop ? 0.4 : 1.2), out: c.in });
    this.h.ticks([t], { gain: (pop ? 0.5 : 0.3) * level, f: pop ? 3000 : 1800, q: 1.5, ms: 5, out: c.in });
  }

  /** A funk guitar through a wah pedal: a muted 16th scratch, or a chord "chuck", on thin pulses through a bandpass
   *  the pedal rocks from heel (0) to toe (1). */
  wah(x: Step, t: number, level: number, pedal: number, chuck: boolean): void {
    const c = this.chain(x.g, 'arp', { hz: 4000, echo: 0.1 });
    const out = x.s % 2 ? c.r! : c.in;
    const f0 = 450 + 1700 * pedal;
    const d = chuck ? 0.12 : 0.045;
    const notes = chuck ? x.chord.tones.slice(0, 3) : [x.chord.tones[0], x.chord.tones[2]];
    for (const m of notes) this.h.voice({ at: t, type: 'pulse25', f: [[0, hz(m)]], filter: 'bandpass', ff: [[0, f0 * 0.7], [d * 0.5, f0 * 1.3], [d, f0]], q: 3.5, amp: [[0.003, level], [d * 0.6, level * 0.5], [d, 0]], out });
    if (!chuck) this.h.noise({ at: t, dur: 0.03, gain: 0.25 * level, filter: 'bandpass', f: f0 * 1.5, q: 2, out });
  }

  /** A cowbell: two clanky squares a little over a fifth apart through a bandpass, dying fast. */
  cowbell(x: Step, t: number, v: number): void {
    const c = this.chain(x.g, 'perc');
    for (const f of [562, 838]) this.h.voice({ at: t, type: 'square', f: [[0, f]], filter: 'bandpass', ff: [[0, 900]], q: 2.5, amp: [[0.001, 0.12 * v], [0.05, 0.05 * v], [0.28, 0]], out: c.in });
  }

  /** A road-works clank: a shovel dropped on a steel plate (inharmonic rings, a crash of grit). */
  clank(x: Step, t: number, v: number): void {
    const c = this.chain(x.g, 'perc');
    for (const [f, d, g] of [
      [420, 0.35, 0.16],
      [1130, 0.22, 0.1],
      [2390, 0.12, 0.06],
    ] as const)
      this.h.tone({ type: 'triangle', f, f1: f * 0.985, glide: d, at: t, attack: 0.001, dur: d, gain: g * v, out: c.in });
    this.h.noise({ at: t, dur: 0.12, attack: 0.001, gain: 0.25 * v, filter: 'bandpass', f: 3000, q: 0.9, out: c.in });
  }

  /** A tenor sax: a saw through a reedy formant, scooping up into the note, vibrato on the long ones; `honk`: the
   *  growl of a honking section (a buzz in the tone, brighter). */
  sax(x: Step, t: number, m: number, len: number, level: number, o: { role?: Role; honk?: boolean } = {}): void {
    const c = this.chain(x.g, o.role ?? 'bell', { hz: 3600, echo: 0.22 });
    const f = hz(m);
    const l = Math.max(0.08, len);
    const vib = len >= 3 * x.STEP ? { rate: 5.6, cents: 0, cents1: 18 } : undefined;
    const amp: Pts = [[0.015, level], [l * 0.75, level * 0.82], [l * 0.95 + 0.02, 0]];
    const scoop: Pts = [[0, f * 0.96], [0.04, f]];
    this.h.voice({ at: t, type: 'sawtooth', f: scoop, vib, filter: 'peaking', ff: [[0, o.honk ? 1500 : 1100]], q: 2, amp, out: c.in });
    this.h.voice({ at: t, type: 'square', f: scoop, filter: 'lowpass', ff: [[0, o.honk ? 2600 : 1600]], amp: scale(amp, o.honk ? 0.5 : 0.25), trem: o.honk ? { rate: 31, depth: 0.5 } : undefined, out: c.in });
  }

  /** A muted trumpet (Hob, the cross head): a buzzy saw squeezed through a harmon mute (a narrow bandpass) that opens
   *  a little on each note. */
  mutedTrumpet(x: Step, m: number, len: number, level: number, role: Role = 'bell'): void {
    const c = this.chain(x.g, role);
    const f = hz(m);
    const l = Math.max(0.06, len);
    const amp: Pts = [[0.01, level], [l * 0.7, level * 0.8], [l * 0.95, 0]];
    this.h.voice({ at: x.t, type: 'sawtooth', f: [[0, f * 0.98], [0.02, f]], filter: 'bandpass', ff: [[0, 900], [0.05, 1900], [l, 1500]], q: 4, amp, out: c.in });
    this.h.voice({ at: x.t, type: 'square', f: [[0, f]], filter: 'bandpass', ff: [[0, 3000]], q: 6, amp: scale(amp, 0.25), out: c.in });
  }

  /** A clarinet (Nob, the cheerful head): a hollow square (odd harmonics, a woody tone) through a soft lowpass, a
   *  breath at the start, vibrato on the long notes (`right`: on a two-sided chain's right side). */
  clarinet(x: Step, m: number, len: number, level: number, role: Role = 'bell', right = false): void {
    const c = this.chain(x.g, role);
    const out = right && c.r ? c.r : c.in;
    const f = hz(m);
    const l = Math.max(0.06, len);
    const vib = len >= 3 * x.STEP ? { rate: 5.4, cents: 0, cents1: 14 } : undefined;
    const amp: Pts = [[0.02, level], [l * 0.8, level * 0.85], [l * 0.95, 0]];
    this.h.voice({ at: x.t, type: 'square', f: [[0, f]], vib, filter: 'lowpass', ff: [[0, 1300], [0.03, 2400], [l, 1800]], q: 0.8, amp, out });
    this.h.noise({ at: x.t, dur: 0.05, attack: 0.01, gain: 0.15 * level, filter: 'bandpass', f: f * 3, q: 1.5, out });
  }

  /** The band's "pah" in an oom-pah: the chord, short, on brassy saws whose lowpass flares, left or right. */
  pah(x: Step, len: number, level: number, right: boolean): void {
    const c = this.chain(x.g, 'arp', { hz: 3000, echo: 0.12 });
    const out = right ? c.r! : c.in;
    x.chord.tones.slice(0, 3).forEach((m, i) =>
      this.h.voice({ at: x.t, type: 'sawtooth', f: [[0, hz(m)]], filter: 'lowpass', ff: [[0, 600], [0.02, 2400 + i * 200], [len, 900]], q: 0.9, amp: [[0.01, level], [len * 0.6, level * 0.6], [len, 0]], out }),
    );
  }

  /** A snare roll over `d` seconds (one noise voice spiking at each stroke). */
  roll(x: Step, t: number, d: number, v: number): void {
    const c = this.chain(x.g, 'perc');
    const n = Math.max(2, Math.round(d / 0.028));
    this.h.ticks(
      Array.from({ length: n }, (_, i) => t + (i * d) / n),
      { gain: 0.5 * v, f: 2200, q: 0.8, ms: 22, out: c.in },
    );
  }

  /** A slide whistle swooping up into the next phrase (a sine with a little flutter). */
  slideWhistle(x: Step, t: number, d: number, from: number, to: number, level: number): void {
    const c = this.chain(x.g, 'fx');
    this.h.voice({ at: t, type: 'sine', f: [[0, hz(from)], [d, hz(to)]], vib: { rate: 7, cents: 15 }, amp: [[0.04, level], [d * 0.85, level], [d, 0]], out: c.in });
  }

  /** A xylophone: a hard mallet on a short wooden bar (a bright sine with its twelfth, dying quickly, and a knock),
   *  bouncing round the ping-pong echo. */
  xylo(x: Step, t: number, m: number, level: number): void {
    const c = this.chain(x.g, 'lead', { hz: 7000, echo: 0.55 });
    const f = hz(m);
    this.h.tone({ type: 'sine', f, at: t, attack: 0.001, dur: 0.28, gain: level, out: c.in });
    this.h.tone({ type: 'sine', f: f * 3, at: t, attack: 0.001, dur: 0.06, gain: level * 0.35, out: c.in });
    this.h.noise({ at: t, dur: 0.012, gain: 0.3 * level, filter: 'bandpass', f: 2600, q: 1.2, out: c.in });
  }

  /** A male choir chanting a short syllable on the chord, low: detuned pulses through an open "ah" formant, on both
   *  sides (the hymn chain: it joins with a boss's phases). */
  chant(x: Step, len: number, level: number): void {
    const c = this.chain(x.g, 'hymn');
    const l = Math.max(0.1, len);
    // (detuned a few cents apart, no vibrato: a chant is short)
    for (const [m, cents, side] of [
      [x.chord.tones[0] - 12, -15, c.in],
      [x.chord.tones[2] - 12, 15, c.r ?? c.in],
      [x.chord.tones[0], 10, c.r ?? c.in],
    ] as const)
      this.h.voice({ at: x.t, type: 'pulse25', f: [[0, hz(m + cents / 100)]], filter: 'bandpass', ff: [[0, 620], [0.05, 820], [l, 650]], q: 2.2, amp: [[0.02, level], [l * 0.6, level * 0.8], [l, 0]], out: side });
  }

  /** A chain rattling in 16ths for a beat: each stroke a burst of small steel links clinking (a few quick ringing
   *  clicks), the first loud, the other three softer (two voices for the beat). */
  rattle(x: Step, t: number, step: number, v: number): void {
    const c = this.chain(x.g, 'rattle');
    const burst = (at: number) => [at, at + 0.008, at + 0.017];
    this.h.ticks(burst(t), { gain: 0.5 * v, f: 4600, q: 7, ms: 8, out: c.in });
    this.h.ticks([1, 2, 3].flatMap((k) => burst(t + k * step)), { gain: 0.25 * v, f: 4600, q: 7, ms: 8, out: c.in });
  }

  /** A distorted bass: a saw and a square an octave up into the 'grit' chain's overdrive, over a clean sine sub. */
  grit(x: Step, m: number, dur: number, level: number): void {
    const c = this.chain(x.g, 'grit');
    const f = hz(m);
    const l = Math.max(0.06, dur);
    const amp: Pts = [[0.004, level], [l * 0.6, level * 0.8], [l, 0]];
    this.h.voice({ at: x.t, type: 'sawtooth', f: [[0, f]], filter: 'lowpass', ff: [[0, 2400], [0.12, 900]], q: 2, amp, out: c.in });
    const b = this.chain(x.g, 'bass');
    this.h.tone({ type: 'sine', f: f >= 80 ? f / 2 : f, at: x.t, attack: 0.004, hold: l * 0.6, dur: l, gain: level * 3.2, out: b.in });
  }
  // ---------------------------------------------------------------- Region 4's instruments

  /** A slide dobro: a resonator guitar played with a bottleneck: a saw and a triangle through a metal cone's
   *  resonance, sliding up into each note from a tone under it; a long note shimmers (slide vibrato). */
  dobro(x: Step, t: number, m: number, level: number, o: { len?: number; role?: Role } = {}): void {
    const c = this.chain(x.g, o.role ?? 'arp', { hz: 4600, echo: 0.22 });
    const f = hz(m);
    const out = (x.s >> 2) & 1 ? (c.r ?? c.in) : c.in;
    const l = Math.max(0.3, o.len ?? 0.6);
    const vib = l > 0.5 ? { rate: 5.4, cents: 0, cents1: 18 } : undefined;
    const slide: Pts = [[0, f * 0.89], [0.07, f]];
    const amp: Pts = [[0.004, level], [0.12, level * 0.55], [l, level * 0.25], [l + 0.25, 0]];
    this.h.voice({ at: t, type: 'sawtooth', f: slide, vib, filter: 'peaking', ff: [[0, 1150]], q: 3, amp: scale(amp, 0.55), out });
    this.h.voice({ at: t, type: 'triangle', f: slide, vib, amp, out });
    this.h.voice({ at: t, type: 'sine', f: scale(slide, 2.01), amp: scale(amp, 0.18), out });
  }

  /** A banjo: a bright, dry pluck that dies at once (a thin pulse and its twang), the drone string's click. */
  banjo(x: Step, t: number, m: number, level: number): void {
    const c = this.chain(x.g, 'arp', { hz: 5200, echo: 0.12 });
    const f = hz(m);
    const out = x.s % 2 ? (c.r ?? c.in) : c.in;
    this.h.voice({ at: t, type: 'pulse12', f: [[0, f]], filter: 'lowpass', ff: [[0, Math.min(9000, f * 8)], [0.08, f * 1.5]], q: 2, amp: [[0.002, level], [0.06, level * 0.35], [0.24, 0]], out });
    this.h.tone({ type: 'triangle', f: f * 2, at: t, attack: 0.001, dur: 0.12, gain: level * 0.25, out });
  }

  /** A harmonica: two reeds a few cents apart through the cupped hands' formant, breath on the attack, a vibrato
   *  blooming on the long notes; `bend`: it starts a semitone flat and bends up (the wail). */
  harmonica(x: Step, m: number, len: number, level: number, role: Role = 'lead', bend = false): void {
    const c = this.chain(x.g, role, { hz: 3600, echo: 0.3 });
    const f = hz(m);
    const l = Math.max(0.1, len);
    const vib = len >= 4 * x.STEP ? { rate: 5.6, cents: 0, cents1: 24 } : undefined;
    const pitch: Pts = bend ? [[0, f * 0.944], [Math.min(0.18, l * 0.4), f]] : [[0, f * 0.99], [0.03, f]];
    const amp: Pts = [[0.03, level], [l * 0.7, level * 0.8], [l * 0.96 + 0.03, 0]];
    for (const det of [0.997, 1.003])
      this.h.voice({ at: x.t, type: 'pulse25', f: scale(pitch, det), vib, filter: 'bandpass', ff: [[0, 1500]], q: 1.1, amp: scale(amp, 0.6), out: c.in });
    this.h.voice({ at: x.t, type: 'noise', filter: 'bandpass', ff: [[0, f * 3]], q: 2, amp: [[0.02, level * 0.3], [0.08, 0]], out: c.in });
  }

  /** A frog-croak guiro: a scraped gourd (or a frog in the reeds): a run of low clicks slowing as it goes. */
  croak(x: Step, t: number, v: number): void {
    const c = this.chain(x.g, 'perc');
    const at = [0, 0.016, 0.034, 0.054, 0.078, 0.106].map((d) => t + d);
    this.h.ticks(at, { gain: 0.6 * v, f: 640, q: 3.5, ms: 10, out: c.in });
    this.h.tone({ type: 'square', f: 150, f1: 120, glide: 0.1, at: t, attack: 0.005, dur: 0.12, gain: 0.04 * v, out: c.in });
  }

  /** A cricket shaker: three quick high chirps. */
  cricket(x: Step, t: number, v: number): void {
    const c = this.chain(x.g, 'perc');
    this.h.ticks([t, t + 0.022, t + 0.044], { gain: 0.3 * v, f: 4800, q: 9, ms: 7, out: c.in });
  }

  /** A washboard (a frottoir): thimbles scraped over the ridges: a burst of fine clicks and a little hiss. */
  washboard(x: Step, t: number, v: number, into: 'perc' | 'drums' = 'drums'): void {
    const c = this.chain(x.g, into);
    this.h.ticks([t, t + 0.009, t + 0.018], { gain: 0.42 * v, f: 3600, q: 2.2, ms: 6, out: into === 'drums' ? c.hats! : c.in });
    this.h.noise({ at: t, dur: 0.04, attack: 0.002, gain: 0.08 * v, filter: 'highpass', f: 4200, q: 0.7, out: into === 'drums' ? c.hats! : c.in });
  }

  /** An accordion: reeds tuned a little apart (the musette's beating), a breath of the bellows at the start;
   *  `low`: the left hand's drone an octave down, darker. */
  accordion(x: Step, m: number, len: number, level: number, role: Role = 'lead', low = false): void {
    const c = this.chain(x.g, role, { hz: low ? 1600 : 3400, echo: low ? 0 : 0.22 });
    const f = hz(m);
    const l = Math.max(0.08, len);
    const amp: Pts = [[0.03, level], [l * 0.85, level * 0.9], [l * 0.98 + 0.04, 0]];
    for (const [type, det, k] of [
      ['sawtooth', 0.995, 0.4],
      ['sawtooth', 1.005, 0.4],
      ['pulse25', 1, 0.35],
    ] as const)
      this.h.voice({ at: x.t, type, f: [[0, f * det]], filter: 'lowpass', ff: [[0, low ? 900 : Math.min(5000, f * 5)]], q: 0.8, amp: scale(amp, k), out: c.in });
  }

  /** A vibraphone: a soft bar ringing long, its motor tremolo pulsing slowly. */
  vibes(x: Step, t: number, m: number, level: number, side = 0): void {
    const c = this.chain(x.g, 'bell', { hz: 6000, echo: 0.3 });
    const f = hz(m);
    const out = side && c.r ? c.r : c.in;
    const trem = { rate: 4.2, depth: 0.45 };
    this.h.voice({ at: t, type: 'sine', f: [[0, f]], trem, amp: [[0.003, level], [0.4, level * 0.6], [1.8, 0]], out });
    this.h.voice({ at: t, type: 'sine', f: [[0, f * 4]], amp: [[0.002, level * 0.16], [0.18, 0]], out });
  }

  /** A bowed saw: a pure tone swelling in slowly, sliding up into its note, a wide singing vibrato. */
  bowedSaw(x: Step, m: number, len: number, level: number, role: Role = 'lead'): void {
    const c = this.chain(x.g, role, { hz: 4000, echo: 0.4 });
    const f = hz(m);
    const l = Math.max(0.2, len);
    const amp: Pts = [[Math.min(0.18, l * 0.3), level], [l * 0.8, level * 0.85], [l + 0.06, 0]];
    const pitch: Pts = [[0, f * 0.96], [0.14, f]];
    this.h.voice({ at: x.t, type: 'sine', f: pitch, vib: { rate: 5.2, cents: 10, cents1: 34 }, amp, out: c.in });
    this.h.voice({ at: x.t, type: 'triangle', f: scale(pitch, 2), vib: { rate: 5.2, cents: 10, cents1: 34 }, amp: scale(amp, 0.08), out: c.in });
  }

  /** Water lapping on stone: a swell of dark filtered noise that rises and draws back. */
  lap(x: Step, t: number, d: number, level: number): void {
    const c = this.chain(x.g, 'fx');
    this.h.voice({ at: t, type: 'noise', filter: 'lowpass', ff: [[0, 380], [d * 0.4, 1100], [d, 300]], q: 0.8, rate: 0.6, amp: [[d * 0.4, 0.09 * level], [d, 0]], out: c.in });
  }

  /** A talking drum: a hand drum squeezed under the arm, its pitch bending up (or down) as it rings. */
  talkingDrum(x: Step, t: number, v: number, up: boolean): void {
    const c = this.chain(x.g, 'perc');
    const [f0, f1] = up ? [150, 230] : [220, 140];
    this.h.tone({ type: 'sine', f: f0, f1, glide: 0.12, at: t, attack: 0.002, dur: 0.3, gain: 0.5 * v, out: c.in });
    this.h.tone({ type: 'triangle', f: f0 * 2, f1: f1 * 2, glide: 0.08, at: t, attack: 0.001, dur: 0.12, gain: 0.14 * v, out: c.in });
    this.h.ticks([t], { gain: 0.5 * v, f: 2200, q: 2, ms: 6, out: c.in });
  }

  /** A theremin: a pure tone gliding into each note from a little under it, its wide vibrato never still. */
  theremin(x: Step, m: number, len: number, level: number, role: Role = 'lead'): void {
    const c = this.chain(x.g, role, { hz: 3200, echo: 0.42 });
    const f = hz(m);
    const l = Math.max(0.12, len);
    const amp: Pts = [[0.07, level], [l * 0.8, level * 0.85], [l + 0.08, 0]];
    const pitch: Pts = [[0, f * 0.93], [0.11, f]];
    this.h.voice({ at: x.t, type: 'sine', f: pitch, vib: { rate: 6.2, cents: 22, cents1: 40 }, amp, out: c.in });
    this.h.voice({ at: x.t, type: 'triangle', f: pitch, vib: { rate: 6.2, cents: 22, cents1: 40 }, amp: scale(amp, 0.12), out: c.in });
  }

  /** A tolling bell (a bell tower far off): a deep hum, the strike tone and a minor-third partial ringing long. */
  toll(x: Step, t: number, m: number, level: number): void {
    const c = this.chain(x.g, 'bell', { hz: 5000, echo: 0.18 });
    const f = hz(m);
    for (const [r, k, d] of [
      [0.5, 0.5, 3.2],
      [1, 1, 2.4],
      [1.19, 0.45, 1.8],
      [1.5, 0.28, 1.4],
      [2, 0.3, 1.1],
      [2.66, 0.16, 0.6],
    ] as const)
      this.h.tone({ type: 'sine', f: f * r, at: t, attack: 0.003, dur: d, gain: level * k, out: c.in });
    this.h.ticks([t], { gain: 0.25 * level, f: 2400, q: 1.5, ms: 8, out: c.in });
  }

  /** A foghorn: a low reedy blare, two saws beating against each other, swelling and dropping away. */
  foghorn(x: Step, t: number, m: number, len: number, level: number): void {
    const c = this.chain(x.g, 'pad', { hz: 700 });
    const f = hz(m);
    const amp: Pts = [[Math.min(0.3, len * 0.25), level], [len * 0.8, level * 0.8], [len + 0.3, 0]];
    for (const [out, det] of [
      [c.in, 0.994],
      [c.r!, 1.006],
    ] as const)
      this.h.voice({ at: t, type: 'sawtooth', f: [[0, f * det * 0.97], [0.2, f * det]], filter: 'lowpass', ff: [[0, 300], [0.25, 760], [len, 420]], q: 1.4, amp, out });
  }

  /** A mallet on a pipe: a hollow metal clang (inharmonic partials) with the knock of the strike. */
  pipe(x: Step, t: number, v: number, f = 640): void {
    const c = this.chain(x.g, 'perc');
    for (const [r, k, d] of [
      [1, 1, 0.45],
      [2.76, 0.4, 0.22],
      [5.4, 0.18, 0.08],
    ] as const)
      this.h.tone({ type: 'sine', f: f * r, at: t, attack: 0.001, dur: d, gain: 0.2 * v * k, out: c.in });
    this.h.ticks([t], { gain: 0.6 * v, f: 2600, q: 2, ms: 5, out: c.in });
  }

  /** A ratchet like a turning wheel: a run of hard clicks across a beat. */
  ratchet(x: Step, t: number, step: number, v: number): void {
    const c = this.chain(x.g, 'perc');
    this.h.ticks(Array.from({ length: 8 }, (_, i) => t + (i * step) / 2), { gain: 0.32 * v, f: 2100, q: 4, ms: 7, out: c.in });
  }

  /** A steam whistle: a chord of two shrill pipes and the steam rushing through them. */
  whistle(x: Step, t: number, d: number, level: number, role: Role = 'perc'): void {
    const c = this.chain(x.g, role);
    const amp: Pts = [[0.04, level], [d * 0.85, level * 0.8], [d + 0.06, 0]];
    for (const f of [1046, 1318]) this.h.voice({ at: t, type: 'triangle', f: [[0, f * 0.97], [0.05, f]], amp: scale(amp, 0.35), out: c.in });
    this.h.voice({ at: t, type: 'noise', filter: 'bandpass', ff: [[0, 2600]], q: 1.4, amp: scale(amp, 0.4), out: c.in });
  }
}
