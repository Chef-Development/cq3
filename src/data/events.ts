// Map events: a short text and two choices, each with a small risk or reward (src/core/run.ts applies them).
// Text boxes hold two short lines; keep each line within about 46 characters. The first six can turn up anywhere;
// the rest belong to one region (`region`): its redraw and its people, a real choice between two costs.

import { REGIONS } from './regions';
import type { ActDef, EventDef } from './types';

export const EVENTS: EventDef[] = [
  {
    id: 'well',
    title: 'Wishing Well',
    text: 'A mossy well. Something glints at the bottom.\nPip: "Statistically, wells keep the coins."',
    choices: [
      {
        label: 'Toss 15 coins',
        cost: 15,
        outcomes: [
          { chance: 1, text: 'Something glints its way back up.', boost: 'rare' },
          { chance: 1, text: 'Nothing. Pip: "Told you."' },
        ],
      },
      { label: 'Walk on', outcomes: [{ text: 'You keep your coins. Wise, says Pip.' }] },
    ],
  },
  {
    id: 'mushroom',
    title: 'Suspicious Mushroom',
    text: 'A mushroom the size of a helmet. It smells\nlike fresh bread. Rowan is very hungry.',
    choices: [
      {
        label: 'Eat it',
        outcomes: [
          { chance: 2, text: 'Delicious. You feel much better.', heal: 0.3 },
          { chance: 1, text: 'Your tongue goes numb. Then your knees.', hp: -12 },
        ],
      },
      { label: 'Leave it', outcomes: [{ text: 'You leave it. Pip looks relieved.' }] },
    ],
  },
  {
    id: 'dummy',
    title: 'Training Dummy',
    text: 'An old straw dummy wearing a crown that says\n"KING". Somebody has issues.',
    choices: [
      { label: 'Practice', outcomes: [{ text: 'Good swings. You hit a bit harder now.', atk: 1, hp: -8 }] },
      { label: 'Salute it', outcomes: [{ text: "It doesn't salute back. Rude.", coins: 5 }] },
    ],
  },
  {
    id: 'merchant',
    title: 'Lost Merchant',
    text: 'A merchant hangs upside down in a hedge.\n"A little help? I can pay. Some."',
    choices: [
      { label: 'Pull him out', outcomes: [{ text: 'He gives you a tonic. Max HP up!', maxHp: 10, hp: -5 }] },
      {
        label: 'Ask for coins',
        outcomes: [
          { chance: 1, text: 'He pays 30 coins, grumbling.', coins: 30 },
          { chance: 1, text: 'He bites you. Then pays 15.', coins: 15, hp: -10 },
        ],
      },
    ],
  },
  {
    id: 'shiny',
    title: 'Pip Found Something',
    text: 'Pip lands with a shiny button. "Consulting\nfee," Pip says, and won\'t let go.',
    choices: [
      { label: 'Let Pip keep it', outcomes: [{ text: 'Pip is pleased. His pecks land harder.', pet: 3 }] },
      { label: 'Sell it', outcomes: [{ text: 'It was a real gold button! +25 coins.', coins: 25 }] },
    ],
  },
  {
    id: 'shrine',
    title: 'Waymark Shrine',
    text: 'A roadside stone carved with an old map.\nA sign says "Offerings keep the lines bright."',
    choices: [
      { label: 'Offer 20 coins', cost: 20, outcomes: [{ text: 'The carved lines glow gold. You feel lucky.', boost: 'rare' }] },
      { label: 'Trace the map', outcomes: [{ text: 'A coin was stuck in the carving. Ouch.', hp: -6, coins: 10 }] },
    ],
  },
  // ---- Greenmarch: the farms asleep in the fields, the road drawn straight
  {
    id: 'sleepingFarmer',
    region: 'greenmarch',
    title: 'Asleep at the Plough',
    text: 'A farmer asleep mid-furrow, as he left her.\nHer purse hangs open at her belt.',
    choices: [
      { label: 'Tie it shut', outcomes: [{ text: 'You tie it shut and move her out of the sun.\nPip watches you, then pecks harder.', pet: 2 }] },
      { label: 'Take a few coins', outcomes: [{ text: 'Twenty-five coins. Nobody will ever know.\nPip looks away.', coins: 25 }] },
    ],
  },
  {
    id: 'straightRoad',
    region: 'greenmarch',
    title: 'The Straight Road',
    text: 'His road runs dead straight through an\norchard. The old lane still winds beside it.',
    choices: [
      { label: 'Take his road', outcomes: [{ text: 'Smooth, quick, easy going.\nYou arrive rested, and uneasy.', heal: 0.2 }] },
      {
        label: 'Take the old lane',
        outcomes: [
          { chance: 1, text: 'Under an old milestone, someone hid\ntheir savings. Thirty coins.', coins: 30 },
          { chance: 1, text: 'Brambles and a ditch. You lose an hour,\nand some skin.', hp: -8 },
        ],
      },
    ],
  },
  // ---- the Frostpeaks: the snow held still, the ice that holds whatever touches it
  {
    id: 'heldFast',
    region: 'frostpeaks',
    title: 'Held Fast',
    text: "A pedlar's boots are frozen to the glass\nroad. He has stood here for days.",
    choices: [
      { label: 'Chip him free', outcomes: [{ text: 'Your hands go numb. He presses his\nwhetstone on you. You hit harder now.', hp: -10, atk: 1 }] },
      { label: 'Take his purse', outcomes: [{ text: '"Fetch help," he says. There is no help\nto fetch, and you both know it.', coins: 20 }] },
    ],
  },
  {
    id: 'tenPastThree',
    region: 'frostpeaks',
    title: 'Ten Past Three',
    text: 'In a mountain village every clock says ten\npast three. An old woman winds hers anyway.',
    choices: [
      { label: 'Sit with her', outcomes: [{ text: 'Tea, a warm stove, an hour of quiet.\nHer clock ticks once, and stops.', heal: 0.25 }] },
      { label: 'Ask the way up', outcomes: [{ text: 'She draws the glacier in the frost on her\nwindow. You learn its ways.', boost: 'common' }] },
    ],
  },
  // ---- Ashfell: the drifting land, everything chained in pairs
  {
    id: 'chainedPair',
    region: 'ashfell',
    title: 'Chained Pair',
    text: 'Two strangers, chained wrist to wrist by his\ndrawing. One of them is badly burned.',
    choices: [
      { label: 'Break the chain', outcomes: [{ text: 'The links fight back. You break them. They\nthank you, and walk on together anyway.', hp: -12, maxHp: 8 }] },
      { label: 'Pay for a healer', cost: 15, outcomes: [{ text: 'The healer works through the night. At dawn\nthey give you a forge-charm.', boost: 'rare' }] },
    ],
  },
  {
    id: 'driftingHouse',
    region: 'ashfell',
    title: 'Drifting House',
    text: 'A house floats past on its stone, a family\nat the window. The gap is wide, and hot.',
    choices: [
      {
        label: 'Jump across',
        outcomes: [
          { chance: 2, text: 'You land hard, and help them onto safer\nground. They feed you before you go.', heal: 0.25 },
          { chance: 1, text: 'You land short. The lava is close enough\nto blister.', hp: -15 },
        ],
      },
      { label: 'Let it go', outcomes: [{ text: 'It drifts out of sight. You will think\nof that window later.' }] },
    ],
  },
  // ---- the Duskmire: the lanterns, the tide on a timetable
  {
    id: 'lanternPost',
    region: 'duskmire',
    title: 'The Crossing Light',
    text: 'An empty lantern post at a crossing. The\nfen-folk say this light once saved lives.',
    choices: [
      { label: 'Light it', cost: 15, outcomes: [{ text: 'It burns. On the far bank, someone waves.\nThey leave you dried fish and a blessing.', heal: 0.25 }] },
      { label: 'Take the oil', outcomes: [{ text: 'The oil sells well. The crossing stays\ndark behind you.', coins: 25 }] },
    ],
  },
  {
    id: 'tideReader',
    region: 'duskmire',
    title: 'The Tide-Reader',
    text: 'An old tide-reader: "His timetable says\nit\'s safe to cross. My tables don\'t."',
    choices: [
      { label: 'Wait with her', outcomes: [{ text: 'An hour later the water comes, early and\nfast. She was right. You rested, at least.', heal: 0.2 }] },
      {
        label: 'Trust the timetable',
        outcomes: [
          { chance: 2, text: 'You cross on time, dry. Someone dropped a\npurse on the boards.', coins: 20 },
          { chance: 1, text: 'The water comes early. You crawl out\nsoaked and bruised.', hp: -12 },
        ],
      },
    ],
  },
];

export const EVENT_IDS = EVENTS.map((e) => e.id);

/** The events an act's map can hold: the ones for anywhere, and its own region's. */
export function eventIdsFor(act: ActDef): string[] {
  const region = REGIONS.find((r) => r.acts.some((a) => a === act || a.name === act.name))?.id;
  return EVENTS.filter((e) => !e.region || e.region === region).map((e) => e.id);
}
export const eventById = (id: string): EventDef | undefined => EVENTS.find((e) => e.id === id);
