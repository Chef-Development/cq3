// The M5 heroes' art (see docs/art-style.md and docs/content-bible.md section 3): Neve, Moss, Tam, Hollis, Vesper
// and Torva, drawn on the shared rig (art-rig.ts), one file per hero (art-hero-<id>.ts). Textures, per hero `id`:
//   ${id}_${pose}       fight frames in the hero box (HERO_W x HERO_H, feet centred on HERO_FEET_X, the soles on the
//                       row above the bottom outline row, facing right) for every pose in HERO_POSE_KEYS: idle0/1,
//                       dash (run in), slashA/slashB (the two attack frames), windup, parry (block), hurt, leap,
//                       down (knocked out), fin (the finisher's pose), cast (the green ability)
//   hero_card_${id}     hero select card (HERO_CARD_W x HERO_CARD_H, like hero_card_sable)
//   portrait_${id}      40x40 dialogue portrait facing right (art-hero-portraits.ts; PORTRAIT_FACE_AT has each face's
//                       18x18 badge window)
//   m${id}_idle0/1, m${id}_walk0..3
//                       map walkers (13x16, feet at ROWAN_FEET, like msab_*; art-hero-map.ts)
//   camp_${id}0/1       a two-frame camp sprite (HERO_CAMP_W x HERO_CAMP_H, drawn bottom-centre, facing right with a
//                       firelight rim on that side, like camp_sable0/1)
// and for Moss's allies ally_{thornling,barkback,glowmoth,seedling}_{0,1,act} (ALLY_W x ALLY_H, art-hero-allies.ts),
// and Tam's `keg_icon` (9x9) for the UI.
import { HERO_FEET_X, HERO_H, HERO_W, grid, toCanvas } from './art';
import { buildAllyArt } from './art-hero-allies';
import { HOLLIS_CAMP, HOLLIS_CARD, HOLLIS_POSES, HOLLIS_RIG } from './art-hero-hollis';
import { buildHeroWalkers } from './art-hero-map';
import { MOSS_CAMP, MOSS_CARD, MOSS_POSES, MOSS_RIG } from './art-hero-moss';
import { NEVE_CAMP, NEVE_CARD, NEVE_POSES, NEVE_RIG } from './art-hero-neve';
import { buildHeroPortraits } from './art-hero-portraits';
import { TAM_CAMP, TAM_CARD, TAM_POSES, TAM_RIG, kegIcon } from './art-hero-tam';
import { TORVA_CAMP, TORVA_CARD, TORVA_POSES, TORVA_RIG } from './art-hero-torva';
// part6:A
import { SOLENNE_CAMP, SOLENNE_CARD, SOLENNE_POSES, SOLENNE_RIG } from './art-hero-solenne';
import { WREN_CAMP, WREN_CARD, WREN_POSES, WREN_RIG } from './art-hero-wren';
// part6:B
import { buildSpiritArt } from './art-hero-spirits';
import { YARA_CAMP, YARA_CARD, YARA_POSES, YARA_RIG } from './art-hero-yara';
import { DELL_CAMP, DELL_CARD, DELL_POSES, DELL_RIG } from './art-hero-dell';
// part6:C
import { GORM_CAMP, GORM_CARD, GORM_POSES, GORM_RIG } from './art-hero-gorm';
import { TESS_CAMP, TESS_CARD, TESS_POSES, TESS_RIG } from './art-hero-tess';
// part6:D
import { FIZZ_CAMP, FIZZ_CARD, FIZZ_POSES, FIZZ_RIG } from './art-hero-fizz';
import { BRANN_CAMP, BRANN_CARD, BRANN_POSES, BRANN_RIG } from './art-hero-brann';
import { VESPER_CAMP, VESPER_CARD, VESPER_POSES, VESPER_RIG } from './art-hero-vesper';
import { ROWAN_POSES, ROWAN_RIG, rowanTip } from './art-hero-rowan';
import { fireRim, paintRig, rigFrame, type Add, type HeroCardSpec, type Rig, type RigPose } from './art-rig';
import { heroCard } from './art-sable';

/** The poses every M5 hero has a fight frame for. */
export const HERO_POSE_KEYS = ['idle0', 'idle1', 'idle2', 'idle3', 'dash', 'slashA', 'slashB', 'windup', 'parry', 'hurt', 'leap', 'down', 'fin', 'cast'] as const;
/** The M5 heroes with art. */
export const M5_HEROES = ['neve', 'moss', 'tam', 'hollis', 'vesper', 'torva', 'fizz', 'brann'] as const;

/** The camp sprites' box (drawn bottom-centre at a spot, like camp_sable0/1): the feet centred, one row under them. */
export const HERO_CAMP_W = 32;
export const HERO_CAMP_H = 38;

interface HeroArt {
  rig: Rig;
  poses: Record<string, RigPose>;
  card: HeroCardSpec;
  camp: [RigPose, RigPose];
}
const HEROES: Record<string, HeroArt> = {
  neve: { rig: NEVE_RIG, poses: NEVE_POSES, card: NEVE_CARD, camp: NEVE_CAMP },
  moss: { rig: MOSS_RIG, poses: MOSS_POSES, card: MOSS_CARD, camp: MOSS_CAMP },
  tam: { rig: TAM_RIG, poses: TAM_POSES, card: TAM_CARD, camp: TAM_CAMP },
  hollis: { rig: HOLLIS_RIG, poses: HOLLIS_POSES, card: HOLLIS_CARD, camp: HOLLIS_CAMP },
  vesper: { rig: VESPER_RIG, poses: VESPER_POSES, card: VESPER_CARD, camp: VESPER_CAMP },
  torva: { rig: TORVA_RIG, poses: TORVA_POSES, card: TORVA_CARD, camp: TORVA_CAMP },
  // part6:A
  solenne: { rig: SOLENNE_RIG, poses: SOLENNE_POSES, card: SOLENNE_CARD, camp: SOLENNE_CAMP },
  wren: { rig: WREN_RIG, poses: WREN_POSES, card: WREN_CARD, camp: WREN_CAMP },
  // part6:B
  yara: { rig: YARA_RIG, poses: YARA_POSES, card: YARA_CARD, camp: YARA_CAMP },
  dell: { rig: DELL_RIG, poses: DELL_POSES, card: DELL_CARD, camp: DELL_CAMP },
  // part6:C
  gorm: { rig: GORM_RIG, poses: GORM_POSES, card: GORM_CARD, camp: GORM_CAMP },
  tess: { rig: TESS_RIG, poses: TESS_POSES, card: TESS_CARD, camp: TESS_CAMP },
  // part6:D
  fizz: { rig: FIZZ_RIG, poses: FIZZ_POSES, card: FIZZ_CARD, camp: FIZZ_CAMP },
  brann: { rig: BRANN_RIG, poses: BRANN_POSES, card: BRANN_CARD, camp: BRANN_CAMP },
};

/**
 * A camp sprite: the pose cropped from the hero box to HERO_CAMP_W x HERO_CAMP_H round the feet, with a warm
 * firelight rim on the edges facing right (they stand left of the fire, facing it, like Rowan).
 */
function campFrame(rig: Rig, p: RigPose): HTMLCanvasElement {
  const g = grid(HERO_W, HERO_H);
  paintRig(g, rig, p);
  fireRim(g, 0, '#ffc890', '#e8a070', new Set(['#140c1c']));
  const full = toCanvas(g);
  const c = document.createElement('canvas');
  c.width = HERO_CAMP_W;
  c.height = HERO_CAMP_H;
  c.getContext('2d')!.drawImage(full, HERO_CAMP_W / 2 - HERO_FEET_X, HERO_CAMP_H - HERO_H);
  return c;
}

/** Where the point of Rowan's sword is in each of his fight frames, from the sprite's anchor (feet centre, bottom):
 *  filled when his frames are painted (the blade's glint, fighters.ts). */
export const ROWAN_SWORD_TIP: Record<string, [number, number]> = {};

/** Rowan's fight frames (`hero_${pose}`), on the shared rig like everyone else's. */
function buildRowanArt(add: Add): void {
  for (const k of HERO_POSE_KEYS) {
    const g = grid(HERO_W, HERO_H);
    const tip = rowanTip((gg) => paintRig(gg, ROWAN_RIG, ROWAN_POSES[k]), g);
    if (tip && k !== 'down') ROWAN_SWORD_TIP[k] = [tip[0] - HERO_FEET_X, tip[1] - HERO_H];
    add(`hero_${k}`, toCanvas(g));
  }
}

export function buildHeroArt(add: Add): void {
  buildRowanArt(add);
  // (every hero in the registry: the M5 six and round 7's, Part 6)
  for (const [id, h] of Object.entries(HEROES)) {
    for (const k of HERO_POSE_KEYS) add(`${id}_${k}`, rigFrame(h.rig, h.poses[k]));
    add(`hero_card_${id}`, heroCard(h.card.glow, h.card.motes, rigFrame(h.rig, h.card.pose)));
    h.camp.forEach((p, i) => add(`camp_${id}${i}`, campFrame(h.rig, p)));
  }
  buildHeroPortraits(add);
  buildHeroWalkers(add);
  buildAllyArt(add);
  buildSpiritArt(add); // Yara's spirits (Part 6)
  add('keg_icon', kegIcon());
}
