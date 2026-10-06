// Heroes' levels and skill trees (pure; no DOM). Each hero has their own XP (from kills and act clears), level
// (1-30: small base-stat gains) and skill tree (a point every 2 levels; nodes learned in order within a branch;
// a free reset at the camp). Gear is shared. The profile keeps it (core/profile.ts); a fight reads it as a
// HeroBuild (who is fighting, their level, the skills learned), the way it reads the gear as a Loadout.

import { HERO_IDS, HEROES, type HeroId } from '../data/heroes';
import { STYLES } from '../data/styles';
import { SKILL_TREES, skillById, type SkillBranch, type SkillNode, type SkillStat } from '../data/skills';
import type { Tuning } from './tuning';

export { HERO_IDS, type HeroId } from '../data/heroes';

/** Who is fighting: the hero, their level and the skills learned. Not saved with the run: it comes from the profile. */
export interface HeroBuild {
  id: HeroId;
  level: number;
  skills: string[];
  /** Stars (1-5, from shards of duplicates): 2 and 4 add stats, 3 and 5 unlock moves (core/kit-fx.ts). */
  stars?: number;
}

export const defaultBuild = (id: HeroId = 'rowan', stars = 1): HeroBuild => ({ id, level: 1, skills: [], stars });

/** One hero's progress, kept in the profile. */
export interface HeroProgress {
  unlocked: boolean;
  xp: number; // total XP earned
  skills: string[]; // node ids learned
  stars: number; // 1-5
  shards: number; // toward the next star
  /** Acts cleared with this hero (mastery milestones count them). */
  acts: number;
}

export const newHeroProgress = (unlocked: boolean): HeroProgress => ({ unlocked, xp: 0, skills: [], stars: 1, shards: 0, acts: 0 });

// ---------------------------------------------------------------- XP and levels

/** XP to go from level `level` to the next. */
export function xpToNext(t: Tuning, level: number): number {
  const L = t.levels;
  return Math.max(1, Math.round(L.xpBase * Math.pow(Math.max(1, level), L.xpExp)));
}

/** Total XP needed to reach `level` from level 1. */
export function xpForLevel(t: Tuning, level: number): number {
  let xp = 0;
  for (let l = 1; l < level; l++) xp += xpToNext(t, l);
  return xp;
}

export const maxLevel = (t: Tuning): number => Math.max(1, Math.round(t.levels.max));

/** The level a hero with `xp` total XP is at (capped at the max level). */
export function levelFromXp(t: Tuning, xp: number): number {
  const max = maxLevel(t);
  let level = 1;
  let need = 0;
  while (level < max) {
    need += xpToNext(t, level);
    if (xp < need) break;
    level++;
  }
  return level;
}

/** Where a hero stands in their level: the level, XP into it, and XP the next one needs (0 at the max level). */
export function levelProgress(t: Tuning, xp: number): { level: number; into: number; need: number } {
  const level = levelFromXp(t, xp);
  if (level >= maxLevel(t)) return { level, into: 0, need: 0 };
  return { level, into: xp - xpForLevel(t, level), need: xpToNext(t, level) };
}

/** Skill points a hero of this level has earned in all (one every levels.pointEvery levels: 15 at level 30). */
export function skillPoints(t: Tuning, level: number): number {
  return Math.floor(Math.max(1, level) / Math.max(1, Math.round(t.levels.pointEvery)));
}

export function pointsLeft(t: Tuning, p: HeroProgress): number {
  return Math.max(0, skillPoints(t, levelFromXp(t, p.xp)) - p.skills.length);
}

/** XP a kill of `key` gives in act `act` (elites and bosses give more). */
export function killXp(t: Tuning, key: string, act: number): number {
  const def = t.enemies[key];
  if (!def) return 0;
  const L = t.levels;
  const base = def.boss ? L.xpBoss : def.elite ? L.xpElite : L.xpKill;
  return Math.round(base * (1 + act));
}

/** XP for clearing act `act` (double the first time). */
export function actXp(t: Tuning, act: number, first: boolean): number {
  return Math.round(t.levels.xpAct * (act + 1) * (first ? 2 : 1));
}

/** Add XP; returns the levels gained. */
export function addXp(t: Tuning, p: HeroProgress, xp: number): number {
  const before = levelFromXp(t, p.xp);
  p.xp = Math.max(0, Math.round(p.xp + Math.max(0, xp)));
  return levelFromXp(t, p.xp) - before;
}

// ---------------------------------------------------------------- skill trees

export const treeOf = (hero: HeroId): SkillBranch[] => SKILL_TREES[hero] ?? [];

/** The branch and position of a node in a hero's tree. */
export function nodeAt(hero: HeroId, id: string): { branch: SkillBranch; index: number } | null {
  for (const branch of treeOf(hero)) {
    const index = branch.nodes.findIndex((n) => n.id === id);
    if (index >= 0) return { branch, index };
  }
  return null;
}

export type LearnCheck = 'ok' | 'learned' | 'order' | 'points' | 'none';

/** Whether a hero can learn node `id` now: it's theirs, not learned, the one before it is, and a point is left. */
export function canLearn(t: Tuning, hero: HeroId, p: HeroProgress, id: string): LearnCheck {
  const at = nodeAt(hero, id);
  if (!at) return 'none';
  if (p.skills.includes(id)) return 'learned';
  if (at.index > 0 && !p.skills.includes(at.branch.nodes[at.index - 1].id)) return 'order';
  if (pointsLeft(t, p) <= 0) return 'points';
  return 'ok';
}

export function learn(t: Tuning, hero: HeroId, p: HeroProgress, id: string): boolean {
  if (canLearn(t, hero, p, id) !== 'ok') return false;
  p.skills.push(id);
  return true;
}

/** Free reset at the camp: every point back. Returns how many. */
export function resetSkills(p: HeroProgress): number {
  const n = p.skills.length;
  p.skills = [];
  return n;
}

/** Only nodes that belong to the hero, each with the one before it in its branch (a save from an older tree), in
 *  the order they were learned. */
export function validSkills(hero: HeroId, ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const want = new Set(ids.filter((x): x is string => typeof x === 'string'));
  const ok = new Set<string>();
  for (const branch of treeOf(hero))
    for (const n of branch.nodes) {
      if (!want.has(n.id)) break;
      ok.add(n.id);
    }
  return [...want].filter((id) => ok.has(id));
}

/** A skill node's live number (tuning.skills.n), or its data default. */
export const skillN = (t: Tuning, id: string): number => t.skills.n[id] ?? skillById(id)?.n ?? 0;

/** A node's text with its number filled in. */
export function skillText(t: Tuning, node: SkillNode, text = node.text): string {
  const n = skillN(t, node.id);
  return text.replace('{n}', `${Math.round(n * 100) / 100}`);
}

// ---------------------------------------------------------------- what level and skills add

/** What a hero's level and stat nodes add to the base stats. */
export interface BuildBonus {
  hp: number; // flat max HP from levels
  hpPct: number; // share of max HP (stat nodes)
  levelAtk: number; // share of the base attack from levels
  atkPct: number; // share of all attack (stat nodes)
  critChance: number;
  def: number;
  meterGain: number;
  comboPower: number;
}

const bonusCache = new WeakMap<HeroBuild, { t: Tuning; level: number; skills: number; stars: number; out: BuildBonus }>();

/** What a hero's level and stat nodes add (cached per build: fights read it on every hit). */
export function buildBonus(t: Tuning, b: HeroBuild | undefined): BuildBonus {
  if (!b) return computeBonus(t, b);
  const hit = bonusCache.get(b);
  const stars = b.stars ?? 1;
  if (hit && hit.t === t && hit.level === b.level && hit.skills === b.skills.length && hit.stars === stars) return hit.out;
  const out = computeBonus(t, b);
  bonusCache.set(b, { t, level: b.level, skills: b.skills.length, stars, out });
  return out;
}

function computeBonus(t: Tuning, b: HeroBuild | undefined): BuildBonus {
  const out: BuildBonus = { hp: 0, hpPct: 0, levelAtk: 0, atkPct: 0, critChance: 0, def: 0, meterGain: 0, comboPower: 0 };
  if (!b) return out;
  const lv = Math.max(0, Math.min(maxLevel(t), b.level) - 1);
  out.hp = t.levels.hpPer * lv;
  out.levelAtk = t.levels.atkPer * lv;
  // stars: 2 stars add attack, 4 stars max HP (3 and 5 unlock moves)
  const stars = b.stars ?? 1;
  if (stars >= 2) out.atkPct += t.levels.star2Atk;
  if (stars >= 4) out.hpPct += t.levels.star4Hp;
  for (const id of b.skills) {
    const node = skillById(id);
    if (!node || node.kind !== 'stat' || !node.stat) continue;
    addStat(out, node.stat, skillN(t, id));
  }
  return out;
}

function addStat(o: BuildBonus, s: SkillStat, n: number): void {
  if (s === 'atkPct') o.atkPct += n / 100;
  else if (s === 'critChance') o.critChance += n / 100;
  else if (s === 'hpPct') o.hpPct += n / 100;
  else if (s === 'def') o.def += n;
  else if (s === 'meterGain') o.meterGain += n / 100;
  else if (s === 'comboPower') o.comboPower += n;
}

export const isHeroId = (v: unknown): v is HeroId => typeof v === 'string' && HERO_IDS.includes(v as HeroId);

/** What a node changes, as the skill screen shows it: stat nodes compute the stat before and after from the hero's
 *  real stats (pass them in: `before` from heroStats now, `after` with the node learned); rule nodes use their text. */
export function skillPreview(t: Tuning, node: SkillNode): { stat: string; delta: string } | { before: string; after: string } {
  if (node.kind === 'stat' && node.stat) {
    const n = skillN(t, node.id);
    const name: Record<SkillStat, string> = { atkPct: 'ATK', critChance: 'Crit', hpPct: 'Max HP', def: 'DEF', meterGain: 'Meter', comboPower: 'Combo' };
    const pct = node.stat === 'def' || node.stat === 'comboPower' ? '' : '%';
    return { stat: name[node.stat], delta: `+${Math.round(n * 100) / 100}${pct}` };
  }
  return { before: skillText(t, node, node.before ?? ''), after: skillText(t, node, node.after ?? node.text) };
}

// ---------------------------------------------------------------- kit texts

export type KitWhich = 'signature' | 'ability' | 'passive' | 'finisher';

/** The live number a kit part's text shows as '{n}' (tuning.hero for Rowan, tuning.kits.<id> for the rest). */
export function kitN(t: Tuning, id: HeroId, which: KitWhich): number {
  const k = t.kits;
  switch (`${id}.${which}`) {
    case 'rowan.ability':
      return t.hero.abilityCritBonus * 100;
    case 'sable.ability':
      return k.sable.abilitySec;
    case 'sable.passive':
      return k.sable.silentStep * 100;
    case 'neve.ability':
      return k.neve.abilitySec;
    case 'moss.passive':
      return k.moss.roots * 100;
    case 'hollis.signature':
      return k.hollis.slam * 100;
    case 'hollis.passive':
      return k.hollis.ironHide * 100;
    case 'torva.passive':
      return k.torva.unstoppable * 100;
    default:
      return 0;
  }
}

/** A kit part's text with its number filled in. */
export function kitText(t: Tuning, id: HeroId, which: KitWhich): string {
  const part = HEROES[id]?.[which];
  if (!part) return '';
  return part.text.replace('{n}', `${Math.round(kitN(t, id, which) * 100) / 100}`);
}

/** A style's shared rule with its number filled in. */
export function styleText(t: Tuning, id: HeroId): string {
  const st = STYLES[HEROES[id].style];
  const S = t.styles;
  const n: Record<string, number> = { blade: S.bladeFill * 100, shadow: S.chainStep * 100, brute: S.heavyMult };
  return st.rule.text.replace('{n}', `${Math.round((n[HEROES[id].style] ?? 0) * 100) / 100}`);
}
