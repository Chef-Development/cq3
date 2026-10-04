// THE tuning file. Every system number lives here; content (enemies and their specials, the region's acts,
// events, story) lives in src/data/ and is pulled in below (enemies, act scaling) so the debug panel can edit
// it live. Numbers were balanced with the headless bot (npm run balance, docs/balance.md).
// The debug panel edits a live copy of this object; "Copy tuning as JSON" exports it.

import { ENEMIES } from '../data/enemies';
import { GREENMARCH } from '../data/greenmarch';
import type { ActDef } from '../data/types';

export type { BlockCode, EnemyDef, ActDef } from '../data/types';

/** The acts' enemy scaling, as tuned live (structure and encounters stay in src/data/greenmarch.ts). */
export interface ActScale {
  name: string;
  hpMult: number;
  atkMult: number;
}

export const DEFAULT_TUNING = {
  cursor: {
    basePassSec: 1.1, // seconds for one left->right pass at base speed
    speedPerHit: 0.02, // +2% speed per combo hit (linear)
    maxSpeedMult: 2.5, // cap on total cursor speed multiplier
    speedBlockBonus: 0.15, // +15% per blocked Speed block, until you take damage
    widthFrac: 0.012, // cursor width as a fraction of the bar
  },
  judge: {
    perfectFrac: 0.3, // central 30% of a block = PERFECT
    graceMs: 20, // extra hit window on each side, in time at the current cursor speed
    maxRewindMs: 300, // how far back a tap timestamp may be judged
    missSelfDamage: 1, // Classic mode: damage for tapping empty bar
  },
  blocks: {
    attackWidth: 0.07, // yellow width (fraction of bar); narrow like the reference, timing has to be sharp
    greenWidth: 0.05,
    redWidth: 0.09, // red attacks (and shields, bombs, speed) move, so they stay wider...
    trapWidth: 0.06,
    widthMin: 0.7, // every spawned block's width is its kind's width times a random factor in [widthMin, widthMax]
    widthMax: 1.4,
    redWidthMin: 0.9, // ...and vary less: never thin enough to slip through
    redWidthMax: 1.25,
    redTravelSec: 2.8, // right end -> left end
    impactGraceMs: 60, // red block sits at the left end this long (still blockable) before hitting
    trapLifeSec: 4,
    attackLifeSec: 0, // 0 = yellow/green stay until hit
    shieldHits: 2,
    shieldKnockback: 0.2, // a cracked shield is knocked back this fraction of the bar...
    knockbackSec: 0.14, // ...over this long, then resumes its travel
    bombRadius: 0.2, // fraction of bar, measured from the bomb's center
    bombDamage: 40, // to every enemy when a bomb is tapped
    bombHitMult: 1.5, // bomb that reaches you hits this much harder
    maxStatic: 7, // max yellow/green/purple on the bar
    minAttack: 2, // if fewer yellow/green than this are on the bar, add one right away
    maxRed: 3,
    spawnRateMult: 1, // >1 = slower spawns
    groupSpawnMult: 0.8, // spawn interval multiplier when 2+ enemies share the screen (<1 = busier)
    openingSpawns: 3, // yellow blocks placed at the start of a fight
    minGap: 0, // min empty space between static blocks (0 = they may touch)
    edgeMargin: 0.02,
  },
  hero: {
    maxHp: 100,
    atk: 10,
    greenMult: 1.5,
    critChance: 0.05,
    critDmg: 2, // crit damage multiplier
    perfectCritBonus: 0.25, // added crit chance on a PERFECT hit
    abilityCritBonus: 0.1, // Rowan's green ability: +10% crit chance...
    abilitySec: 3, // ...for 3 s
    comboPower: 5, // finisher damage = attack x comboPower x stacks ^ meter.stackExp
    reviveHpFrac: 0.5,
    revivesPerAct: 1, // a revive per act (refilled at each act's start)
    healOnKill: 0.2, // fraction of max HP restored by every kill
  },
  meter: {
    // The meter fills once per stack; keep the combo going to bank more stacks (a combo break loses them all).
    perHit: 0.16,
    perGreen: 0.24,
    perBlock: 0.12,
    perfectBonus: 0.03,
    maxStacks: 5,
    stackExp: 1.7, // finisher damage grows as stacks ^ stackExp (2 stacks = 3.2x, 3 = 6.5x, 5 = 15x)
    finisherHold: 1, // during the finisher the cursor stops for this share of the show, then restarts from the left (0 = keeps moving)
  },
  tiers: {
    // Combo tiers (toggle in settings): damage multiplier at combo thresholds
    t1: 10,
    m1: 1.5,
    t2: 25,
    m2: 2,
    t3: 50,
    m3: 3,
  },
  kill: {
    // Every kill permanently raises the hero's stats for the rest of the run (the icons rain into the HUD).
    atk: 1,
    maxHp: 5,
    comboPower: 0, // finisher growth comes from boosts only, so max-stack finishers never outgrow the bosses
  },
  companion: {
    // Pip the owl: swoops in for a peck after every N attack hits (0 = no companion)
    everyHits: 4,
    damage: 6,
  },
  boosts: {
    maxHp: 20,
    damage: 0.15, // +15% damage
    crit: 0.05,
    critDmg: 0.5,
    comboPower: 0.5,
    pet: 4, // Companion Power: Pip's pecks hit this much harder
    rareChance: 0.15, // each card's chance to be rare (blue, rareMult x stronger)...
    epicChance: 0.04, // ...or epic (gold, epicMult x). A boss kill always offers at least one rare.
    rareMult: 2,
    epicMult: 3,
  },
  swipe: {
    minDistPx: 36, // CSS px in any direction
    maxMs: 350,
  },
  juice: {
    hitStopMs: 40, // the simulation (cursor and reds) freezes this long on crits and finishers
    shakeMinPx: 2, // small shakes outside the impact tiers (a miss)
    shakeMaxPx: 4, // big shakes outside the impact tiers (taking a hit, the chest)
    shakeMs: 120,
    flashMs: 70, // the hero's red flash when hurt
  },
  impact: {
    // Every impact has a weight from 0 (lightest) to 1 (heaviest); its sound and visuals scale with it.
    hit: 0.1,
    perfect: 0.18,
    block: 0.3,
    crit: 0.4,
    bomb: 0.5,
    finisher: 0.55, // 1 stack...
    finisherStack: 0.06, // ...plus this per extra stack (5 stacks = 0.79)
    kill: 0.85,
    bossKill: 1,
    hurt: 0.45, // taking a hit (sound only)
    curve: 1.3, // visual ramps follow weight ^ curve (higher keeps light hits subtler)
    // visuals, from the lightest impact to the heaviest
    hitStopLight: 28, // ms the scene freezes (the bar keeps running)
    hitStopHeavy: 150,
    shakeLight: 0.5, // px
    shakeHeavy: 7,
    shakeMsLight: 60,
    shakeMsHeavy: 450,
    knockLight: 5, // px the enemy is knocked back
    knockHeavy: 20,
    flashLight: 45, // ms the enemy flashes white
    flashHeavy: 150,
    frameFlash1: 0.4, // from this weight, a 1-frame white impact flash...
    frameFlash2: 0.75, // ...and 2 frames from this one
    duckFrom: 0.4, // impacts at least this heavy duck the music...
    duckDepth: 0.75, // ...by up to this much...
    duckMs: 380, // ...and it comes back over about this long
    // sound layers (also in the Sound lab)
    crack: 1, // 0-5 ms transient
    body: 1, // 120-600 Hz saturated thump: carries the weight on phone speakers
    tail: 1, // noise and debris tail
    sub: 0.5, // deep sine: only adds on headphones
    combo: 0.5, // the musical blip that climbs with the combo
    drive: 1, // body saturation
    bodyHzLight: 320, // the body's pitch drop ends here...
    bodyHzHeavy: 140,
    bodyMsLight: 70, // ...and it lasts this long
    bodyMsHeavy: 320,
    tailMsLight: 90,
    tailMsHeavy: 750,
    variation: 0.04, // +/- random pitch and timing, so repeats never sound identical
    music: 0.18, // music volume
  },
  specials: {
    tellGap: 0.5, // seconds after one telegraph's action before the next telegraph may start (one at a time)
    jitter: 0.15, // +/- share of a timed special's interval, so they don't tick like clockwork
    maxEnemies: 4, // summons and splits stop at this many enemies on screen
  },
  map: {
    restHeal: 0.3, // a rest node heals this share of max HP
    treasureCoins: 25, // a treasure chest holds this many coins (+/- 40%) and a rare-or-better boost card
    rowHp: 0.04, // enemies get this much more HP per map row (the act's fights ramp up)
    priceCommon: 30, // shop prices
    priceRare: 60,
    priceEpic: 110,
    pricePotion: 35, // a potion heals potionHeal of max HP
    potionHeal: 0.4,
    priceReroll: 20, // one reroll of the next 1-of-3 boost pick
  },
  enemies: cloneData(ENEMIES),
  acts: GREENMARCH.acts.map((a: ActDef): ActScale => ({ name: a.name, hpMult: a.hpMult, atkMult: a.atkMult })),
};

export type Tuning = typeof DEFAULT_TUNING;

export interface Settings {
  mode: 'classic' | 'relaxed'; // empty-bar tap: self-damage + combo break, or combo break only
  finisherInput: 'button' | 'swipe';
  comboTiers: boolean;
  targeting: 'auto' | 'tap';
  godMode: boolean;
  calibrationMs: number; // average tap lateness; subtracted from tap timestamps
  audioIgnoresSilentSwitch: boolean;
  muted: boolean;
  music: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'classic',
  finisherInput: 'swipe',
  comboTiers: false,
  targeting: 'auto',
  godMode: false,
  calibrationMs: 0,
  audioIgnoresSilentSwitch: true,
  muted: false,
  music: true,
};

function cloneData<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function cloneTuning(t: Tuning = DEFAULT_TUNING): Tuning {
  return JSON.parse(JSON.stringify(t)) as Tuning;
}

/** Deep-merge `src` onto `dst`, only for keys that exist in `dst` with the same primitive type. */
export function mergeKnown(dst: unknown, src: unknown): void {
  if (!isObj(dst) || !isObj(src)) return;
  for (const key of Object.keys(dst)) {
    if (!(key in src)) continue;
    const d = dst[key];
    const s = src[key];
    if (Array.isArray(d)) {
      // arrays keep their shape (acts, specials, formations): merge element by element
      if (Array.isArray(s))
        d.forEach((item, i) => {
          if (isObj(item)) mergeKnown(item, s[i]);
          else if (typeof item === typeof s[i] && !(typeof s[i] === 'number' && !Number.isFinite(s[i]))) d[i] = s[i];
        });
      continue;
    }
    if (isObj(d)) {
      if (key === 'enemies' && isObj(s)) {
        // keep enemy set fixed, merge per-enemy values
        for (const ek of Object.keys(d)) mergeKnown(d[ek], s[ek]);
      } else mergeKnown(d, s);
    } else if (typeof d === typeof s) {
      if (typeof s === 'number' && !Number.isFinite(s)) continue;
      dst[key] = s;
    }
  }
}

/** Only the values in `t` that differ from `base` (so saved tuning doesn't pin old defaults). */
export function tuningDiff(t: unknown, base: unknown): unknown {
  if (Array.isArray(t) || !isObj(t) || !isObj(base)) return JSON.stringify(t) === JSON.stringify(base) ? undefined : t;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(t)) {
    const d = tuningDiff(t[k], base[k]);
    if (d !== undefined) out[k] = d;
  }
  return Object.keys(out).length ? out : undefined;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ---- Slider metadata for the debug panel (same file so every number stays in one place) ----

export interface SliderDef {
  path: string; // dot path into Tuning
  label: string;
  min: number;
  max: number;
  step: number;
}

export interface SliderGroup {
  title: string;
  sliders: SliderDef[];
}

const s = (path: string, label: string, min: number, max: number, step: number): SliderDef => ({
  path,
  label,
  min,
  max,
  step,
});

/** The impact sound-layer levels: in the Impact group and in the gear panel's Sound lab. */
export const IMPACT_SOUND_SLIDERS: SliderDef[] = [
  s('impact.crack', 'Layer: crack', 0, 2, 0.05),
  s('impact.body', 'Layer: body', 0, 2, 0.05),
  s('impact.tail', 'Layer: tail', 0, 2, 0.05),
  s('impact.sub', 'Layer: sub (headphones)', 0, 2, 0.05),
  s('impact.combo', 'Layer: combo notes', 0, 2, 0.05),
  s('impact.drive', 'Body drive', 0, 3, 0.05),
  s('impact.variation', 'Variation (+/-)', 0, 0.15, 0.005),
  s('impact.music', 'Music volume', 0, 0.6, 0.01),
];

export function sliderGroups(t: Tuning): SliderGroup[] {
  const groups: SliderGroup[] = [
    {
      title: 'Cursor',
      sliders: [
        s('cursor.basePassSec', 'Base pass (s)', 0.5, 3, 0.05),
        s('cursor.speedPerHit', 'Speed per hit', 0, 0.1, 0.005),
        s('cursor.maxSpeedMult', 'Max speed x', 1, 4, 0.1),
        s('cursor.speedBlockBonus', 'Speed block bonus', 0, 0.5, 0.01),
        s('cursor.widthFrac', 'Cursor width', 0, 0.05, 0.002),
      ],
    },
    {
      title: 'Judgment',
      sliders: [
        s('judge.perfectFrac', 'Perfect zone', 0.05, 1, 0.05),
        s('judge.graceMs', 'Grace (ms)', 0, 80, 1),
        s('judge.maxRewindMs', 'Max rewind (ms)', 0, 600, 10),
        s('judge.missSelfDamage', 'Miss self-dmg', 0, 20, 1),
      ],
    },
    {
      title: 'Blocks',
      sliders: [
        s('blocks.attackWidth', 'Yellow width', 0.02, 0.25, 0.005),
        s('blocks.greenWidth', 'Green width', 0.02, 0.25, 0.005),
        s('blocks.redWidth', 'Red width', 0.02, 0.25, 0.005),
        s('blocks.trapWidth', 'Trap width', 0.02, 0.25, 0.005),
        s('blocks.widthMin', 'Width varies from x', 0.3, 1, 0.05),
        s('blocks.widthMax', '...to x', 1, 2.5, 0.05),
        s('blocks.redWidthMin', 'Red width varies from x', 0.3, 1.5, 0.05),
        s('blocks.redWidthMax', '...to x (red)', 0.5, 2.5, 0.05),
        s('blocks.redTravelSec', 'Red travel (s)', 0.8, 6, 0.1),
        s('blocks.impactGraceMs', 'Impact grace (ms)', 0, 200, 5),
        s('blocks.trapLifeSec', 'Trap life (s)', 1, 10, 0.5),
        s('blocks.attackLifeSec', 'Attack life (s, 0=inf)', 0, 12, 0.5),
        s('blocks.shieldHits', 'Shield taps', 1, 4, 1),
        s('blocks.shieldKnockback', 'Shield knockback', 0, 0.6, 0.01),
        s('blocks.knockbackSec', 'Knockback time (s)', 0, 0.5, 0.01),
        s('blocks.bombRadius', 'Bomb radius', 0.05, 0.6, 0.01),
        s('blocks.bombDamage', 'Bomb dmg', 0, 80, 1),
        s('blocks.bombHitMult', 'Bomb hit x', 1, 3, 0.1),
        s('blocks.maxStatic', 'Max static', 1, 8, 1),
        s('blocks.minAttack', 'Min attack blocks', 0, 6, 1),
        s('blocks.maxRed', 'Max red', 1, 6, 1),
        s('blocks.spawnRateMult', 'Spawn interval x', 0.3, 3, 0.05),
        s('blocks.groupSpawnMult', 'Group interval x', 0.5, 4, 0.1),
        s('blocks.openingSpawns', 'Opening blocks', 0, 4, 1),
        s('blocks.minGap', 'Min gap', 0, 0.1, 0.005),
        s('blocks.edgeMargin', 'Edge margin', 0, 0.2, 0.01),
      ],
    },
    {
      title: 'Hero (Rowan)',
      sliders: [
        s('hero.maxHp', 'Max HP', 10, 400, 5),
        s('hero.atk', 'Attack', 1, 60, 1),
        s('hero.greenMult', 'Green x', 1, 4, 0.1),
        s('hero.critChance', 'Crit chance', 0, 1, 0.01),
        s('hero.critDmg', 'Crit dmg x', 1, 5, 0.1),
        s('hero.perfectCritBonus', 'Perfect crit +', 0, 1, 0.01),
        s('hero.abilityCritBonus', 'Ability crit +', 0, 1, 0.01),
        s('hero.abilitySec', 'Ability (s)', 0, 10, 0.5),
        s('hero.comboPower', 'Combo power', 0, 20, 0.5),
        s('hero.reviveHpFrac', 'Revive HP', 0.1, 1, 0.05),
        s('hero.revivesPerAct', 'Revives/act', 0, 3, 1),
        s('hero.healOnKill', 'Heal on kill', 0, 1, 0.05),
      ],
    },
    {
      title: 'Meter / Finisher',
      sliders: [
        s('meter.perHit', 'Per hit', 0, 0.5, 0.01),
        s('meter.perGreen', 'Per green', 0, 0.5, 0.01),
        s('meter.perBlock', 'Per block', 0, 0.5, 0.01),
        s('meter.perfectBonus', 'Perfect bonus', 0, 0.3, 0.01),
        s('meter.maxStacks', 'Max stacks', 1, 9, 1),
        s('meter.stackExp', 'Stack exponent', 1, 3, 0.05),
        s('meter.finisherHold', 'Cursor stop during finisher', 0, 1.5, 0.05),
      ],
    },
    {
      title: 'Combo tiers',
      sliders: [
        s('tiers.t1', 'Tier 1 at', 1, 100, 1),
        s('tiers.m1', 'Tier 1 x', 1, 5, 0.1),
        s('tiers.t2', 'Tier 2 at', 1, 150, 1),
        s('tiers.m2', 'Tier 2 x', 1, 5, 0.1),
        s('tiers.t3', 'Tier 3 at', 1, 200, 1),
        s('tiers.m3', 'Tier 3 x', 1, 8, 0.1),
      ],
    },
    {
      title: 'Boosts',
      sliders: [
        s('boosts.maxHp', 'Max HP +', 0, 100, 5),
        s('boosts.damage', 'Damage +', 0, 1, 0.05),
        s('boosts.crit', 'Crit +', 0, 0.3, 0.01),
        s('boosts.critDmg', 'Crit dmg +', 0, 2, 0.1),
        s('boosts.comboPower', 'Combo power +', 0, 5, 0.5),
        s('boosts.pet', 'Companion power +', 0, 20, 1),
        s('boosts.rareChance', 'Rare card chance', 0, 1, 0.01),
        s('boosts.epicChance', 'Epic card chance', 0, 1, 0.01),
        s('boosts.rareMult', 'Rare x', 1, 5, 0.25),
        s('boosts.epicMult', 'Epic x', 1, 6, 0.25),
      ],
    },
    {
      title: 'Swipe finisher',
      sliders: [s('swipe.minDistPx', 'Min dist (px)', 10, 200, 5), s('swipe.maxMs', 'Max time (ms)', 80, 800, 10)],
    },
    {
      title: 'Kill rewards',
      sliders: [s('kill.atk', 'Attack +', 0, 10, 1), s('kill.maxHp', 'Max HP +', 0, 50, 1), s('kill.comboPower', 'Combo power +', 0, 3, 0.25)],
    },
    {
      title: 'Companion (Pip)',
      sliders: [s('companion.everyHits', 'Peck every N hits', 0, 12, 1), s('companion.damage', 'Peck damage', 0, 60, 1)],
    },
    {
      title: 'Impact',
      sliders: [
        s('impact.hit', 'Weight: hit', 0, 1, 0.01),
        s('impact.perfect', 'Weight: perfect', 0, 1, 0.01),
        s('impact.block', 'Weight: block', 0, 1, 0.01),
        s('impact.crit', 'Weight: crit', 0, 1, 0.01),
        s('impact.bomb', 'Weight: bomb', 0, 1, 0.01),
        s('impact.finisher', 'Weight: finisher x1', 0, 1, 0.01),
        s('impact.finisherStack', 'Weight: per extra stack', 0, 0.25, 0.01),
        s('impact.kill', 'Weight: kill', 0, 1, 0.01),
        s('impact.bossKill', 'Weight: boss kill', 0, 1, 0.01),
        s('impact.hurt', 'Weight: hurt (sound)', 0, 1, 0.01),
        s('impact.curve', 'Visual curve', 0.5, 3, 0.05),
        s('impact.hitStopLight', 'Hit-stop light (ms)', 0, 200, 1),
        s('impact.hitStopHeavy', 'Hit-stop heavy (ms)', 0, 300, 5),
        s('impact.shakeLight', 'Shake light (px)', 0, 8, 0.1),
        s('impact.shakeHeavy', 'Shake heavy (px)', 0, 12, 0.5),
        s('impact.shakeMsLight', 'Shake light (ms)', 0, 400, 10),
        s('impact.shakeMsHeavy', 'Shake heavy (ms)', 0, 1000, 10),
        s('impact.knockLight', 'Knockback light (px)', 0, 30, 1),
        s('impact.knockHeavy', 'Knockback heavy (px)', 0, 40, 1),
        s('impact.flashLight', 'Enemy flash light (ms)', 0, 200, 5),
        s('impact.flashHeavy', 'Enemy flash heavy (ms)', 0, 400, 5),
        s('impact.frameFlash1', '1-frame flash from', 0, 1.05, 0.01),
        s('impact.frameFlash2', '2-frame flash from', 0, 1.05, 0.01),
        s('impact.duckFrom', 'Music duck from', 0, 1.05, 0.01),
        s('impact.duckDepth', 'Music duck depth', 0, 1, 0.05),
        s('impact.duckMs', 'Music duck (ms)', 50, 1500, 10),
        ...IMPACT_SOUND_SLIDERS,
        s('impact.bodyHzLight', 'Body pitch light (Hz)', 60, 700, 5),
        s('impact.bodyHzHeavy', 'Body pitch heavy (Hz)', 40, 700, 5),
        s('impact.bodyMsLight', 'Body light (ms)', 20, 400, 5),
        s('impact.bodyMsHeavy', 'Body heavy (ms)', 20, 1000, 10),
        s('impact.tailMsLight', 'Tail light (ms)', 20, 600, 10),
        s('impact.tailMsHeavy', 'Tail heavy (ms)', 50, 2000, 10),
      ],
    },
    {
      title: 'Juice',
      sliders: [
        s('juice.hitStopMs', 'Sim freeze: crit/fin (ms)', 0, 200, 5),
        s('juice.shakeMinPx', 'Shake: miss (px)', 0, 8, 1),
        s('juice.shakeMaxPx', 'Shake: hurt (px)', 0, 8, 1),
        s('juice.shakeMs', 'Shake: hurt (ms)', 0, 400, 10),
        s('juice.flashMs', 'Hero hurt flash (ms)', 0, 200, 5),
      ],
    },
  ];
  groups.push(
    {
      title: 'Specials',
      sliders: [
        s('specials.tellGap', 'Gap between telegraphs (s)', 0, 3, 0.05),
        s('specials.jitter', 'Interval jitter +/-', 0, 0.5, 0.01),
        s('specials.maxEnemies', 'Max enemies on screen', 1, 5, 1),
      ],
    },
    {
      title: 'Map and nodes',
      sliders: [
        s('map.restHeal', 'Rest heals', 0, 1, 0.05),
        s('map.treasureCoins', 'Treasure coins', 0, 200, 5),
        s('map.rowHp', 'Enemy HP + per row', 0, 0.2, 0.01),
        s('map.priceCommon', 'Shop: common card', 0, 300, 5),
        s('map.priceRare', 'Shop: rare card', 0, 300, 5),
        s('map.priceEpic', 'Shop: epic card', 0, 400, 5),
        s('map.pricePotion', 'Shop: potion', 0, 200, 5),
        s('map.potionHeal', 'Potion heals', 0, 1, 0.05),
        s('map.priceReroll', 'Shop: reroll', 0, 200, 5),
      ],
    },
  );
  t.acts.forEach((a, i) =>
    groups.push({
      title: `Act ${i + 1}: ${a.name}`,
      sliders: [s(`acts.${i}.hpMult`, 'Enemy HP x', 0.2, 6, 0.05), s(`acts.${i}.atkMult`, 'Enemy attack x', 0.2, 5, 0.05)],
    }),
  );
  for (const key of Object.keys(t.enemies)) {
    const e = t.enemies[key];
    groups.push({
      title: `Enemy: ${e.name}`,
      sliders: [
        s(`enemies.${key}.hp`, 'HP', 5, 9000, 5),
        s(`enemies.${key}.atk`, 'Attack', 0, 80, 1),
        s(`enemies.${key}.special`, 'Trap / counter dmg', 0, 150, 1),
        s(`enemies.${key}.interval`, 'Spawn every (s)', 0.2, 4, 0.05),
        s(`enemies.${key}.coins`, 'Coins', 0, 300, 1),
        ...e.specials.flatMap((sp, i) => [
          s(`enemies.${key}.specials.${i}.tell`, `${sp.id}: telegraph (s)`, 0.3, 1.5, 0.05),
          ...(sp.every !== undefined ? [s(`enemies.${key}.specials.${i}.every`, `${sp.id}: every (s)`, 1, 30, 0.5)] : []),
          ...(sp.hpBelow !== undefined ? [s(`enemies.${key}.specials.${i}.hpBelow`, `${sp.id}: below HP`, 0.05, 0.95, 0.01)] : []),
        ]),
      ],
    });
  }
  return groups;
}

export function getPath(obj: unknown, path: string): number {
  let cur: unknown = obj;
  for (const k of path.split('.')) cur = (cur as Record<string, unknown>)[k];
  return cur as number;
}

export function setPath(obj: unknown, path: string, value: number): void {
  const keys = path.split('.');
  let cur = obj as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]] as Record<string, unknown>;
  cur[keys[keys.length - 1]] = value;
}
