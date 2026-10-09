// Map events: a short text and two choices, each with a small risk or reward (src/core/run.ts applies them).
// Text boxes hold two short lines; keep each line within about 46 characters.

import type { EventDef } from './types';

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
          { chance: 1, text: 'The well burps up a shiny boost!', boost: 'rare' },
          { chance: 1, text: 'Plop. Nothing. Pip: "Told you."' },
        ],
      },
      { label: 'Walk on', outcomes: [{ text: 'You keep your coins. Wise, says Pip.' }] },
    ],
  },
  {
    id: 'mushroom',
    title: 'Suspicious Mushroom',
    text: 'A mushroom the size of a helmet. It smells\nlike pancakes. Rowan is very hungry.',
    choices: [
      {
        label: 'Eat it',
        outcomes: [
          { chance: 2, text: 'Delicious! You feel much better.', heal: 0.3 },
          { chance: 1, text: 'Your tongue goes purple. Ouch.', hp: -12 },
        ],
      },
      { label: 'Leave it', outcomes: [{ text: 'The mushroom looks a little hurt.' }] },
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
    text: 'A merchant is stuck in a hedge. "Help!\nI will pay! Mostly in exposure!"',
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
      { label: 'Let Pip keep it', outcomes: [{ text: 'Pip is thrilled. Pip pecks harder now.', pet: 3 }] },
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
];

export const EVENT_IDS = EVENTS.map((e) => e.id);
export const eventById = (id: string): EventDef | undefined => EVENTS.find((e) => e.id === id);
