// Block kinds (pure; shared by the combat sim and the specials).
import type { BlockCode } from '../data/types';

/** yellow/green: your attacks; red/shield/bomb/speed: enemy attacks to block; purple: a trap;
 *  spore: a heal block (pop it, or the enemies heal); ward: a shell block (break it to end a Shell Up). */
export type BlockKind = 'yellow' | 'green' | 'red' | 'shield' | 'bomb' | 'speed' | 'purple' | 'spore' | 'ward';

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
export const isAttack = (k: BlockKind): boolean => k === 'yellow' || k === 'green';
