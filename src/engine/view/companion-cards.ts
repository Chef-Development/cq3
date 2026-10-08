// What a companion does, as the companions screen shows it (view/companions.ts): its attack, then each perk, as cards
// (an icon on a coloured disc, the name in its colour, the line under it). This is the one place that text is built:
// the full description comes from the data (src/data/companions.ts), and each perk also has a short line for when the
// screen is too crowded to show every description in full (then a tap on the card shows the full one in a sheet).
// No Phaser here: tests/unit/companion-cards.test.ts checks every perk has a look and that the short lines fit.
import { COMPANIONS, type CompanionId } from '../../data/companions';
import { textWidth } from '../font';

/**
 * A card's text wrapped in bold to `w` px: a number keeps its unit ("4 s", "1 s.") on its line, and the lines come
 * out even (the narrowest width that needs no more lines), so a description never ends on one lonely word.
 */
export function wrapCard(s: string, w: number): string[] {
  const toks: string[] = [];
  for (const word of s.split(' ')) {
    const last = toks[toks.length - 1];
    if (last !== undefined && /(^|\s)\d+$/.test(last) && /^s[.,:;]?$/.test(word)) toks[toks.length - 1] = `${last} ${word}`;
    else toks.push(word);
  }
  const wrap = (max: number): string[] => {
    const out: string[] = [];
    let cur = '';
    for (const t of toks) {
      const test = cur ? `${cur} ${t}` : t;
      if (!cur || textWidth(test, 1, true) <= max) cur = test;
      else {
        out.push(cur);
        cur = t;
      }
    }
    out.push(cur);
    return out;
  };
  const lines = wrap(w);
  if (lines.length < 2) return lines;
  let best = lines;
  for (let m = w - 2; m > w / 2; m -= 2) {
    const l = wrap(m);
    if (l.length > lines.length || l.some((x) => textWidth(x, 1, true) > m)) break;
    best = l;
  }
  return best;
}

export interface CardLook {
  /** A camp-kit pix / HUD icon key. */
  icon: string;
  /** The icon's disc. */
  col: number;
  /** The name's colour. */
  text: number;
}

/** Each perk's look (by its name) and its short line (one line of bold, a complete sentence, no numbers). */
export const PERK_LOOK: Record<string, CardLook & { short: string }> = {
  'Lucky Foot': { icon: 'coin', col: 0x9a6a14, text: 0xffe680, short: 'Hits find coins.' },
  'Owl Watch': { icon: 'feather', col: 0x3a6ab0, text: 0x9ad8ff, short: 'Pecks away a trap.' },
  'Ember Bite': { icon: 'flame', col: 0xa8401c, text: 0xffb070, short: 'Bites set foes on fire.' },
  'Oil Can': { icon: 'clock', col: 0x3a7a5a, text: 0xb4f070, short: 'Wider Perfect zones.' },
  'Rock Wall': { icon: 'shield', col: 0x4a5a8a, text: 0xb8d0ff, short: 'Blocks a red for you.' },
  'Chill Bite': { icon: 'flake', col: 0x2a7aa0, text: 0xa8ecff, short: 'Bites slow reds.' },
  'Snow Dash': { icon: 'flake', col: 0x2a7aa0, text: 0xa8ecff, short: 'Blocks slow reds.' },
  Starlight: { icon: 'star', col: 0x7a4ab0, text: 0xe8c8ff, short: 'Combos make greens.' },
  Mend: { icon: 'heartS', col: 0x9a2a3a, text: 0xffa8b0, short: 'Combos heal you.' },
  'Gold Hoard': { icon: 'coin', col: 0x9a6a14, text: 0xffe680, short: 'Kills drop more coins.' },
  'Fire Breath': { icon: 'flame', col: 0xa8401c, text: 0xffb070, short: 'Combos burn traps.' },
  'Warm Glow': { icon: 'flame', col: 0xb8601c, text: 0xffd08a, short: 'Melts ice faster.' },
  // ---- Part 6 companions
  Prickly: { icon: 'spines', col: 0x7a4a24, text: 0xf0c890, short: 'Spines hit back.' },
  'Wake-up Song': { icon: 'note', col: 0x9a7a14, text: 0xfff07a, short: 'Its song adds combo.' },
  'Night Eyes': { icon: 'moon', col: 0x4a2a7a, text: 0xd8b8ff, short: 'Traps turn yellow.' },
  Tide: { icon: 'wave', col: 0x1a6a8a, text: 0x9af0f0, short: 'Waves push reds.' },
  'Calm Seas': { icon: 'calm', col: 0x2a5a9a, text: 0xb8e0ff, short: 'Big combos hit hard.' },
};
/** A perk without a look of its own yet. */
export const PERK_DEFAULT: CardLook = { icon: 'rune', col: 0x4a3a7a, text: 0xd8c8ff };
/** The attack's card. */
export const ATTACK_LOOK: CardLook = { icon: 'crit', col: 0x8a2a2a, text: 0xffffff };

const VERB: Record<string, string> = { Kick: 'Kicks', Peck: 'Pecks', Bite: 'Bites', Zap: 'Zaps', Headbutt: 'Headbutts', Twinkle: 'Twinkles', Breath: 'Breathes' };
// ---- Part 6 companions
Object.assign(VERB, { Roll: 'Rolls in', Swipe: 'Swipes', Spray: 'Sprays' });

/** How a companion attacks, in plain words ("Pecks every 4 hits", "Breathes on every foe every 6 hits"). */
export function attackText(id: CompanionId): string {
  const c = COMPANIONS[id];
  return `${VERB[c.attack] ?? c.attack}${c.allFoes ? ' on every foe' : ''} every ${c.every} hits`;
}

export interface CompanionCard {
  kind: 'attack' | 'perk';
  /** The card's title: the attack's or the perk's name. */
  name: string;
  look: CardLook;
  /** What it does, in full (the data's line). */
  text: string;
  /** One short line, for a crowded screen (the full text then sits behind a tap). */
  short: string;
}

/** A companion's cards, in order: its attack, then each perk. */
export function companionCards(id: CompanionId): CompanionCard[] {
  const c = COMPANIONS[id];
  const hits = `Every ${c.every} hits${c.allFoes ? ', all foes' : ''}.`;
  return [
    { kind: 'attack', name: c.attack, look: ATTACK_LOOK, text: hits, short: hits },
    ...c.perks.map((pk) => {
      const look = PERK_LOOK[pk.name];
      return { kind: 'perk' as const, name: pk.name, look: look ?? PERK_DEFAULT, text: pk.text, short: look?.short ?? pk.text };
    }),
  ];
}

/** The companions screen's stage width (the left part of the safe area L..R), as the hero select's. */
export const companionStageW = (L: number, R: number): number => Math.round((R - L) * 0.46);
/** A card's text starts after its icon disc, CARD_TEXT_X px in. */
export const CARD_TEXT_X = 17;
/** The text width on a card `w` wide: to the column's edge (the plate reaches 2 px past it), less room for the
 *  chevron a shortened card shows. */
export const cardTextW = (w: number, chevron = false): number => w - CARD_TEXT_X - (chevron ? 6 : 0);

/** The light the grove's lamp throws on each companion (its own accent), and its motes. */
export const COMPANION_LIGHT: Record<CompanionId, number> = {
  bun: 0xfff0d8, // warm cream
  pip: 0xc8e4ff, // moonlight
  newt: 0xffb878, // embers
  sprocket: 0xffdc98, // brass
  brick: 0xf0d4a8, // lamplit stone
  flurry: 0xc0f4ff, // ice
  mote: 0xe4ccff, // starlight
  sunny: 0xffe48a, // gold
  // ---- Part 6 companions
  burr: 0xf0d0a0, // a warm hearth
  lark: 0xfff4b0, // sunrise
  gloam: 0xd4b8ff, // violet moonlight
  nimbus: 0xc0f4ff, // sky
};
