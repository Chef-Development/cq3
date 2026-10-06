// Constants, small helpers and view-state types shared by the scene's modules.
import Phaser from 'phaser';
import { isRed, type BlockKind, type RemoveReason } from '../../core/combat';
import type { BoostId } from '../../core/run';
import { FOE_COL } from '../art-foes';
import { FROST_COL } from '../art-frost';

export const COL = {
  yellow: [0xeab22e, 0xffe680, 0xb8781a],
  green: [0x4ccf4a, 0xa8f590, 0x2a9a3a],
  red: [0xd63a3a, 0xff8a76, 0x9a1c26],
  purple: [0x9a4ad8, 0xdab0ff, 0x6a2aa8],
  spore: [0xe05ab8, 0xffb0e8, 0x9a2a80], // a mushroom's heal block
  ward: [0x3aa8a0, 0xa8f0e0, 0x1a6a6a], // a shell block
  keg: [0x3a3444, 0xffb060, 0x1a1620], // a Bomber's keg (its fuse's glow as the light)
  frozen: [0x8ae0f6, 0xe0faff, 0x4aa4d0], // a red frozen in place
  hold: [0x5ab4ec, 0xb8e8ff, 0x2a78c0], // a hold
  mirror: [0xc8d8f0, 0xffffff, 0x7a8ab0], // a mirror shard
} as const;
export const kindCol = (k: BlockKind) =>
  k === 'yellow'
    ? COL.yellow
    : k === 'green'
      ? COL.green
      : k === 'purple'
        ? COL.purple
        : k === 'spore'
          ? COL.spore
          : k === 'ward'
            ? COL.ward
            : k === 'keg' || k === 'frozen' || k === 'hold' || k === 'mirror'
              ? COL[k]
              : COL.red;
export const BOMB_COL = [0xf28a2a, 0xffd890, 0xa04a10] as const;
const DEEP: Partial<Record<BlockKind, number>> = { yellow: 0x7a4410, green: 0x14622a, purple: 0x3a1a60, spore: 0x5a1050, ward: 0x0e3a3a, keg: 0x100c14, frozen: 0x1e5a80, hold: 0x14407a, mirror: 0x4a5a80 };
export const deepOf = (k: BlockKind) => DEEP[k] ?? 0x5a1020;

/** How a block leaves the bar: never instantly. */
export type DyingStyle = 'pop' | 'shatter' | 'crunch' | 'fade' | 'zip' | 'fly';
export const DYING_MS: Record<DyingStyle, number> = { pop: 270, shatter: 360, crunch: 220, fade: 260, zip: 200, fly: 420 };
export const dyingStyle = (kind: BlockKind, reason: RemoveReason): DyingStyle =>
  reason === 'finisher'
    ? 'fly'
    : // ice breaks: a frozen block shatters when hit, a hold that slipped shatters
      (kind === 'frozen' && reason === 'hit') || (kind === 'hold' && reason === 'expire')
      ? 'shatter'
      : reason === 'hit'
      ? isRed(kind)
        ? 'shatter'
        : 'pop'
      : reason === 'bomb'
        ? 'shatter'
        : reason === 'impact'
          ? 'crunch'
          : reason === 'expire'
            ? 'fade'
            : 'zip';
/** A dying enemy flashes and swells this long before it bursts. */
export const DEATH_CHARGE_MS = 150;

export interface Dying {
  x: number; // center, game px
  w: number;
  kind: BlockKind;
  reason: RemoveReason;
  style: DyingStyle;
  at: number; // anim time
}
export const ENEMY_COL: Record<string, number> = { slime: 0x4fc4a0, bigslime: 0x4fc4a0, boar: 0x8a5a34, bandit: 0x5a4a6a, ...FOE_COL, ...FROST_COL };

export const WHITE = 0xffffff;
export const INK = 0x0a0812;
export const SPRITE_SCALE = 1;
export const BOOST_ICON: Record<BoostId | 'relic', string> = { maxHp: 'heart', damage: 'sword', crit: 'crit', critDmg: 'crit', comboPower: 'bolt', pet: 'feather', heal: 'potion', relic: 'bolt' };
export const BAND_H = 32;
export const DASH_MS = 70;
export const RETURN_MS = 190;
export const ENGAGE_MS = 750;
export const LEAP_MS = 260;
/** Finisher show length grows with the number of stacks spent. */
export { finisherShowMs as superMsFor } from '../../core/impact';
/** Color per finisher stack: [fill, highlight, shade]. Stack 1 blue, 2 violet, 3 gold, 4 crimson, 5 white-hot. */
const STACK_COL: ReadonlyArray<readonly [number, number, number]> = [
  [0x2a8ae0, 0x7ad0ff, 0x1a5ab0],
  [0x3aa0ff, 0xa8e4ff, 0x1a5ab0],
  [0xa060ff, 0xe0c0ff, 0x5a2ab0],
  [0xffb020, 0xfff0a0, 0xa86010],
  [0xff4a6a, 0xffb0c0, 0xa01a3a],
  [0xf6f2ff, 0xffffff, 0xb0a0e0],
];
export const stackCol = (n: number) => STACK_COL[Math.max(0, Math.min(STACK_COL.length - 1, n))];
export const FINISHER_NAME = ['', 'Finisher!', 'Double Finisher!', 'Triple Finisher!', 'Quad Finisher!', 'MAX FINISHER!'];
/** Slash color by combo tier: the longer the streak, the hotter the blade. */
export const comboSlashCol = (combo: number) => (combo >= 50 ? 0xff6ad8 : combo >= 25 ? 0xffd23a : combo >= 10 ? 0x5af0ff : 0x6ab4ff);
export const ENTER_MS = 700;
export const PIP_SWOOP_MS = 140;
export const PIP_BACK_MS = 280;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EnemyView {
  id: number;
  sprite: string;
  img: Phaser.GameObjects.Image;
  homeX: number;
  x: number;
  y: number; // feet
  pose: string;
  poseUntil: number;
  flashUntil: number;
  knockUntil: number;
  kickAt: number; // anim time of the last hit (spring knockback + squash)
  kickDist: number;
  numAt: number; // anim time of the last damage number (for cascading)
  numLevel: number;
  lunge: { t0: number; dist: number; ms: number } | null;
  dieAt: number;
  phase: number;
  hpShown: number;
  enterAt: number; // anim time the walk-in started (0 = done)
  fly: number; // hovers this many px above the ground
  tellAt: number; // anim time its special's telegraph started...
  tellUntil: number; // ...and ends (the 'tell' pose, the countdown ring)
  fleeAt: number; // anim time it started running off (0 = not fleeing)
  popAt: number; // anim time it split apart (0 = not splitting)
  enterFrom: number; // x it walks in from (the right edge, or the parent slime's spot for a split)
  stunUntil: number; // anim time a stun (Wind-Up) wears off: stars circle its head until then
}

export interface HeroAnim {
  state: 'idle' | 'dash' | 'engaged' | 'return' | 'leap' | 'super';
  x: number;
  y: number;
  fromX: number;
  toX: number;
  t0: number;
  pose: string;
  poseUntil: number;
  lastAction: number;
  alt: boolean;
  hurtUntil: number;
  flashUntil: number;
  flashColor: number;
  lungeAt: number; // anim time of the last slash (small forward lunge)
  down: boolean; // knocked out (the defeat): the KO pose until the next fight
}

export interface Floater {
  t: Phaser.GameObjects.BitmapText;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  born: number;
  life: number;
  scale: number;
  pop: boolean;
  count?: { to: number; dur: number; at?: number }; // a number that counts up from 0
  icon?: string; // HUD icon drawn in front of the text
  relic?: string; // or a relic's icon (a perk kicking in)
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  born: number;
  life: number;
  color: number;
  size: number;
  world: boolean;
  streak: boolean;
  shape?: 'chip' | 'shard' | 'spark' | 'streak';
}

export interface Ambient {
  kind: 'leaf' | 'mote' | 'rain' | 'ember';
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number; // anim ms
  life: number;
  color: number;
  phase: number;
}

export interface Pending {
  at: number; // anim time
  fn: () => void;
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
/** Scale an RGB color toward black (f < 1) or white (f > 1). */
export const shade = (c: number, f: number) => {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f <= 1 ? v * f : v + (255 - v) * (f - 1))));
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
};
/**
 * Text gets a gentle top-to-bottom gradient (lit top, deeper bottom), like the reference's lettering. Small text (5 px
 * caps) gets a lighter one: a deep bottom row would eat into its few pixels.
 */
export const tintGrad = (t: Phaser.GameObjects.BitmapText, c: number, small = false) => {
  const top = shade(c, small ? 1.06 : 1.12);
  const bot = shade(c, small ? 0.9 : 0.78);
  t.setTint(top, top, bot, bot);
};
export const ease = (k: number) => 1 - (1 - k) * (1 - k);
export const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
/** Ease out with a little overshoot past 1 before settling (panels sliding in). */
export const easeBack = (k: number, over = 1.6) => {
  const t = clamp01(k) - 1;
  return 1 + t * t * ((over + 1) * t + over);
};
export const easeOut3 = (k: number) => 1 - (1 - clamp01(k)) ** 3;
export const easeInOut = (k: number) => {
  const t = clamp01(k);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
};
/** 0..1 triangle-free pulse: 0 at rest, smoothly up to 1 and back over `period` ms. */
export const pulse = (now: number, period: number, phase = 0) => 0.5 - 0.5 * Math.cos(((now + phase) / period) * Math.PI * 2);
/** Linear mix of two RGB colors. */
export const mix = (a: number, b: number, k: number) => {
  const t = clamp01(k);
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};
export const inRect = (r: Rect, x: number, y: number, pad = 0) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;

/** "96/101": HP as whole numbers. HP is fractional inside (Defense cuts, heals and kill gains in shares), so it's
 *  rounded up (a sliver left reads as 1, never 0) and never shown above the max. */
export const hpLabel = (hp: number, max: number): string => {
  const m = Math.round(max);
  return `${Math.max(0, Math.min(m, Math.ceil(hp - 1e-6)))}/${m}`;
};
