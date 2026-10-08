// The finisher show's plan (pure; no Phaser, no DOM): each style's shared kit (how its heroes move through the show),
// each hero's signature moment (the one beat that belongs to that hero alone, or their style's default until they
// have one), the rarity scaler (Rare < Epic < Legendary < Mythic < Celestial < Divine: a longer build-up within the same
// total, more layers, a bigger screen effect) and the timeline every show runs on: always inside the envelope
// `finisherShowMs(stacks)` (core/impact.ts; the core holds the cursor for exactly that long), with the strike count
// `finisherStrikes(stacks)` and the last blow at `FINISHER_BLOW_AT`. The view draws from it (engine/view/finishers.ts,
// finisher-kits.ts, finisher-signatures.ts).
//
// A new hero's finisher: pick a style (its kit comes free), then add a SignatureId for them below (HERO_SIGNATURE and
// SIGNATURES) and its drawing in engine/view/finisher-signatures.ts (SIGNATURE_DRAW is typed over every SignatureId,
// so the build fails until it has one). A hero left out of HERO_SIGNATURE plays their style's default moment.

import { HEROES, type StyleId } from '../data/heroes';
import { tierIndex, TIERS, type Tier } from '../data/rarity';
import { FINISHER_BLOW_AT, finisherShowMs, finisherStrikeAt, finisherStrikes } from './impact';

/** How a hero moves through the show: dash in, leap in, vanish into the shadows and strike from them, march to a
 *  guard spot short of the foes, or stand back and cast, throw or shoot. */
export type ShowMove = 'dash' | 'leap' | 'blink' | 'guard' | 'stand';

/** Each style's kit, shared by every hero of that style (the drawing is engine/view/finisher-kits.ts). */
export interface StyleShow {
  move: ShowMove;
  /** The kit's pieces in a few words (the Sound lab, the docs, the report). */
  pieces: string;
}

export const STYLE_SHOW: Record<StyleId, StyleShow> = {
  blade: { move: 'dash', pieces: 'crescent slashes, steel glints, a cut that lingers; a steel sky with speed lines' },
  shadow: { move: 'blink', pieces: 'afterimages, violet rifts, ink smoke; a moonlit night' },
  guardian: { move: 'guard', pieces: 'flying shields, shield arcs, a steel shockwave; a sky of golden rays' },
  marksman: { move: 'stand', pieces: 'arrows and their trails, target reticles that lock; a dusk sky with stars' },
  brute: { move: 'leap', pieces: 'ground cracks, rock debris and dust, rock spikes; a dust-storm sky' },
  controller: { move: 'stand', pieces: 'ice spikes, frost shards, cold mist, an ice crystal that shatters; an aurora' },
  summoner: { move: 'stand', pieces: 'spirit wisps, vines that coil, leaves; a deep grove with light shafts' },
  bomber: { move: 'stand', pieces: 'lobbed bombs, blasts, shrapnel and smoke; a smoky, fiery sky' },
};

/** Every signature moment the view can draw: one per hero, plus each style's default (a hero without their own). */
export type SignatureId =
  // the heroes' own
  | 'whirlwind'
  | 'shadowLeap'
  | 'glacierRise'
  | 'greatTree'
  | 'giantKeg'
  | 'rampartWall'
  | 'arrowSky'
  | 'earthSplit'
  // round 7 (Part 6): the second hero of each style
  // part6:A
  // part6:B
  | 'spiritStampede'
  | 'pebbleStorm'
  // part6:C
  // part6:D
  // the styles' defaults
  | 'crossCut'
  | 'rift'
  | 'shieldDome'
  | 'lockOn'
  | 'groundSlam'
  | 'iceSpikes'
  | 'spiritSwarm'
  | 'barrage';

export interface SignatureSpec {
  /** The moment in a few words (the report, the gallery's line). */
  name: string;
  /** A style's default moment (for a hero who has none of their own yet), not any one hero's. */
  styleDefault?: StyleId;
  /** Overrides the style's way of moving through the show. */
  move?: ShowMove;
}

export const SIGNATURES: Record<SignatureId, SignatureSpec> = {
  whirlwind: { name: 'a steel whirlwind through every foe, bursting into a ring of blades' },
  shadowLeap: { name: 'sinks into her shadow, bursts out of the target\'s, twin fangs snap shut', move: 'blink' },
  glacierRise: { name: 'a glacier rises under the foes, swallows them and shatters' },
  greatTree: { name: 'a great tree grows behind the foes and storms them with leaves' },
  giantKeg: { name: 'a giant keg lobbed into the foes, its fuse burning down, the biggest blast' },
  rampartWall: { name: 'a great wall rises before him and topples onto the foes', move: 'guard' },
  arrowSky: { name: 'one arrow up becomes a sky of arrows; a giant golden arrow last' },
  earthSplit: { name: 'a towering leap, the earth splits to the foes and erupts in rock and fire', move: 'leap' },
  // part6:A
  // part6:B
  spiritStampede: { name: 'stars join into a stag; her spirits stampede through every foe, then the great stag leaps down' },
  pebbleStorm: { name: 'pebbles ping from foe to foe; his lucky golden pebble hops through them all' },
  // part6:C
  // part6:D
  crossCut: { name: 'a great cross cut over every foe', styleDefault: 'blade' },
  rift: { name: 'a rift tears open behind the foes', styleDefault: 'shadow' },
  shieldDome: { name: 'a shield dome over the hero bursts outward', styleDefault: 'guardian' },
  lockOn: { name: 'reticles lock on every foe', styleDefault: 'marksman' },
  groundSlam: { name: 'a ground slam that rocks the stage', styleDefault: 'brute' },
  iceSpikes: { name: 'a row of ice spikes under the foes', styleDefault: 'controller' },
  spiritSwarm: { name: 'a swarm of spirits circles, then dives', styleDefault: 'summoner' },
  barrage: { name: 'a barrage of bombs arcs over', styleDefault: 'bomber' },
};

/** Each hero's own signature moment (a hero left out plays their style's default). */
export const HERO_SIGNATURE: Readonly<Record<string, SignatureId>> = {
  rowan: 'whirlwind',
  sable: 'shadowLeap',
  neve: 'glacierRise',
  moss: 'greatTree',
  tam: 'giantKeg',
  hollis: 'rampartWall',
  vesper: 'arrowSky',
  torva: 'earthSplit',
  // part6:A
  // part6:B
  yara: 'spiritStampede',
  dell: 'pebbleStorm',
  // part6:C
  // part6:D
};

/** Each style's default moment. */
export const STYLE_DEFAULT: Record<StyleId, SignatureId> = {
  blade: 'crossCut',
  shadow: 'rift',
  guardian: 'shieldDome',
  marksman: 'lockOn',
  brute: 'groundSlam',
  controller: 'iceSpikes',
  summoner: 'spiritSwarm',
  bomber: 'barrage',
};

/** A hero's style (an unknown id, e.g. one added before its data: Blade). */
export function styleOf(hero: string): StyleId {
  return (HEROES as Record<string, { style: StyleId } | undefined>)[hero]?.style ?? 'blade';
}

/** A hero's rarity (an unknown id: Rare). */
export function rarityOf(hero: string): Tier {
  return (HEROES as Record<string, { rarity: Tier } | undefined>)[hero]?.rarity ?? 'rare';
}

/** The signature moment a hero plays: their own, else their style's default. */
export function signatureOf(hero: string): SignatureId {
  return HERO_SIGNATURE[hero] ?? STYLE_DEFAULT[styleOf(hero)];
}

/** How the hero moves through their show (their signature can override their style). */
export function moveOf(hero: string): ShowMove {
  return SIGNATURES[signatureOf(hero)].move ?? STYLE_SHOW[styleOf(hero)].move;
}

// ---------------------------------------------------------------- the rarity scaler

export interface ShowScale {
  tier: Tier;
  /** 0 (Common) .. 7 (Divine). */
  rank: number;
  /** Share of the show spent on the build-up, before the flurry (the whole stays finisherShowMs). */
  buildUp: number;
  /** Effect layers on the build-up, each strike and the last blow (1 = the kit alone). */
  layers: number;
  /** The last blow's screen flash (ms; the stacks add to it). */
  flashMs: number;
  /** Extra shake at the last blow (game px). */
  shake: number;
  /** How dark the stage's edges get while it plays (0..1). */
  vignette: number;
  /** How fully the style's sky takes over the stage's (0..1). */
  sky: number;
  /** Extra animated layers in the sky (0 none .. 3: motes, then light shafts, then stars or a prism). */
  skyFx: number;
  /** The top tiers' own sparkle over the whole show. */
  sparkle: 'none' | 'stars' | 'prism';
}

const SCALE: Record<Tier, Omit<ShowScale, 'tier' | 'rank'>> = {
  common: { buildUp: 0.2, layers: 1, flashMs: 70, shake: 0, vignette: 0, sky: 0.6, skyFx: 0, sparkle: 'none' },
  uncommon: { buildUp: 0.22, layers: 1, flashMs: 80, shake: 0, vignette: 0.05, sky: 0.65, skyFx: 0, sparkle: 'none' },
  rare: { buildUp: 0.24, layers: 1, flashMs: 90, shake: 1, vignette: 0.12, sky: 0.78, skyFx: 0, sparkle: 'none' },
  epic: { buildUp: 0.3, layers: 2, flashMs: 110, shake: 1, vignette: 0.22, sky: 0.88, skyFx: 1, sparkle: 'none' },
  legendary: { buildUp: 0.36, layers: 3, flashMs: 130, shake: 2, vignette: 0.32, sky: 0.96, skyFx: 2, sparkle: 'none' },
  mythic: { buildUp: 0.4, layers: 4, flashMs: 150, shake: 2, vignette: 0.4, sky: 1, skyFx: 2, sparkle: 'none' },
  celestial: { buildUp: 0.43, layers: 5, flashMs: 170, shake: 3, vignette: 0.45, sky: 1, skyFx: 3, sparkle: 'stars' },
  divine: { buildUp: 0.46, layers: 6, flashMs: 200, shake: 3, vignette: 0.5, sky: 1, skyFx: 3, sparkle: 'prism' },
};

/** How a tier scales the spectacle. */
export function showScale(tier: Tier): ShowScale {
  const t = TIERS.includes(tier) ? tier : 'rare';
  return { tier: t, rank: tierIndex(t), ...SCALE[t] };
}

// ---------------------------------------------------------------- the timeline

/** The flurry ends here (the last blow lands at FINISHER_BLOW_AT, a breath later). */
export const FLURRY_END = 0.7;

export interface ShowTimeline {
  /** The whole show (ms): finisherShowMs(stacks), the envelope the core holds the cursor for. */
  ms: number;
  /** The stacks the show is drawn for (1..5: more banked than that looks like 5). */
  n: number;
  /** Where the build-up ends and the flurry starts (a share of the show). */
  build: number;
  /** Each strike of the flurry (finisherStrikes(n) of them, from `build` to FLURRY_END). */
  strikes: number[];
  /** The last blow (FINISHER_BLOW_AT). */
  blow: number;
  /** The hero heads home (after the blow). */
  back: number;
}

/**
 * When every beat of a show lands, for a tier and the stacks spent. The strikes keep finisherStrikeAt's even spacing
 * (an Epic show is exactly it: 30% to 70%), squeezed after a longer build-up for a rarer hero; the last blow always
 * lands at FINISHER_BLOW_AT and the show always lasts finisherShowMs(stacks).
 */
export function showTimeline(tier: Tier, stacks: number): ShowTimeline {
  const n = Math.max(1, Math.min(5, Math.round(stacks) || 1));
  const build = Math.min(FLURRY_END - 0.16, showScale(tier).buildUp);
  const count = finisherStrikes(n);
  const a0 = finisherStrikeAt(0, count);
  const a1 = finisherStrikeAt(count - 1, count);
  const strikes = Array.from({ length: count }, (_, i) => build + ((finisherStrikeAt(i, count) - a0) / Math.max(1e-6, a1 - a0)) * (FLURRY_END - build));
  return { ms: finisherShowMs(n), n, build, strikes, blow: FINISHER_BLOW_AT, back: FINISHER_BLOW_AT + 0.05 };
}
