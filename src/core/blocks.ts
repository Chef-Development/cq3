// Block kinds (pure; shared by the combat sim and the specials).
import type { BlockCode } from '../data/types';

/** yellow/green: your attacks; red/shield/bomb/speed: enemy attacks to block; purple: a trap;
 *  spore: a heal block (pop it, or the enemies heal); ward: a shell block (break it to end a Shell Up);
 *  keg: a Bomber's keg (hit it: it blasts every foe); frozen: a red frozen in place (hit it: it shatters);
 *  hold: hold your finger from its start to its end; mirror: a shard the cursor bounces off (never tapped). */
export type BlockKind = 'yellow' | 'green' | 'red' | 'shield' | 'bomb' | 'speed' | 'purple' | 'spore' | 'ward' | 'keg' | 'frozen' | 'hold' | 'mirror';

export const CODE_KIND: Record<BlockCode, BlockKind> = {
  Y: 'yellow',
  G: 'green',
  R: 'red',
  S: 'shield',
  B: 'bomb',
  F: 'speed',
  P: 'purple',
};

export const isRed = (k: BlockKind): boolean => k === 'red' || k === 'shield' || k === 'bomb' || k === 'speed';
/** Your own attack blocks: hit them for damage (a hold is pressed and held). */
export const isAttack = (k: BlockKind): boolean => k === 'yellow' || k === 'green' || k === 'keg' || k === 'frozen' || k === 'hold';
/** Blocks a tap can never land on. */
export const untappable = (k: BlockKind): boolean => k === 'mirror';
