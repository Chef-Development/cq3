// Story scenes: a portrait and a text box, tap to advance, a Skip button. At most 6 boxes per scene and
// 2 lines per box (tests/unit/story.test.ts checks both, and that every line fits the box).
// Tone: cheeky and light.

import type { Speaker, StoryBox } from './types';

export const SPEAKER_NAME: Record<Speaker, string> = {
  narrator: '',
  rowan: 'Rowan',
  pip: 'Pip',
  captain: 'Bandit Captain',
  golem: 'Ruin Golem',
  boarking: 'Boar King',
  smith: 'Mags',
  sable: 'Sable',
};

export const STORY: Record<string, StoryBox[]> = {
  // the first visit to the camp's forge: Mags, a badger smith with a soot-black apron and a very large hammer
  smith: [
    { who: 'smith', text: "Oi! Mind the sparks. Name's Mags.\nI fix what knights break. So, everything." },
    { who: 'rowan', text: 'Is that... a badger? With a hammer?' },
    { who: 'smith', text: "Best hammer in Greenmarch. Bring me junk,\nI melt it into scrap." },
    { who: 'smith', text: 'Scrap and coin buy upgrades. Coin buys\na fresh roll on a gem. No refunds.' },
    { who: 'pip', text: 'She once forged a spoon so sharp\nit got banned. Twice.' },
    { who: 'smith', text: "Hand over that sword. It's bent.\nYou slept on it, didn't you?" },
  ],
  // after Act 1, at the camp: Sable tries to rob it, Pip catches them, and they join (unlocks Sable)
  sableJoin: [
    { who: 'narrator', text: 'Night at camp. Rowan snores by the fire.\nSomething creeps toward the bag tent.' },
    { who: 'sable', text: "Coins, coins... ooh, a shiny sword.\nDon't mind if I do." },
    { who: 'pip', text: "Hoo. Evening. That's Rowan's bag. Also,\nowls never sleep. It's a whole thing." },
    { who: 'sable', text: 'Caught by a bird. Embarrassing. Fine:\nSable. Thief. Ninja. Fast runner.' },
    { who: 'rowan', text: 'You nearly robbed a knight. Bold. We need\nbold. Want a job? Pay is... coins? Later?' },
    { who: 'sable', text: 'Two daggers, two hands, no questions.\nI keep half of anything shiny. Deal.' },
  ],
  intro: [
    { who: 'narrator', text: 'The kingdom keeps time by the Great Pendulum.\nTick, tock. Very reliable.' },
    { who: 'narrator', text: 'Until one night it stopped. The Clockless King\nshattered it, and its 12 weights scattered.' },
    { who: 'narrator', text: 'The knight on watch that night was Rowan.\nRowan was asleep. Loudly.' },
    { who: 'rowan', text: 'In my defense, the Pendulum is VERY soothing.\nTick, tock. Tick... zzz.' },
    { who: 'narrator', text: 'So, as punishment, Rowan is sent to bring\nall twelve weights back.' },
    { who: 'rowan', text: 'Twelve weights. One junior knight. Fine.\nHow hard can it be?' },
  ],
  act1: [
    { who: 'pip', text: "Hoo! You're the knight who slept through\nthe end of time? Big fan." },
    { who: 'rowan', text: "An owl. Great. Shoo, I'm on a quest.\nNo pets allowed." },
    { who: 'pip', text: "I'm not a pet. I'm a consultant.\nMy first advice: duck." },
    { who: 'rowan', text: "Duck? Why would I duck? ...oh.\nThat's a slime, isn't it." },
    { who: 'pip', text: "First weight's out in Greenmarch. Follow the\nroad, hit what hits back. I'll bill you." },
  ],
  captain: [
    { who: 'captain', text: 'Step right up! Genuine pendulum pieces!\nCertified by me, a very honest man!' },
    { who: 'rowan', text: "That's a doorknob. Painted gold." },
    { who: 'captain', text: "It's a RARE doorknob. Pendulum grade.\nTwo hundred coins, or your boots." },
    { who: 'pip', text: "He sold me a 'magic' worm earlier.\nIt was just a worm." },
    { who: 'captain', text: "No refunds! Lads, let's show this tin can\nour returns policy!" },
  ],
  act2: [
    { who: 'pip', text: 'The Old Ruins. Watch your step, the floors\nhere are older than my jokes.' },
    { who: 'rowan', text: "Your jokes aren't that old." },
    { who: 'pip', text: "Correct. These floors are ancient.\nAnd the weight's trail leads inside." },
  ],
  golem: [
    { who: 'golem', text: 'HALT. NONE MAY PASS. BY ORDER\nOF KING ALDRIC THE THIRD.' },
    { who: 'rowan', text: 'King Aldric? He died 300 years ago.' },
    { who: 'golem', text: '...NOBODY TOLD ME. I HAVE BEEN STANDING\nHERE FOR A VERY LONG TIME.' },
    { who: 'pip', text: 'Awkward. Maybe let us through, and you can\nfinally take a break?' },
    { who: 'golem', text: 'A GOOD GUARD NEVER BREAKS. ALSO, MY KNEES\nARE STONE. PREPARE YOURSELF.' },
  ],
  act3: [
    { who: 'pip', text: "Smell that? Wet fur and ego. We're close\nto the Boar King's hollow." },
    { who: 'rowan', text: 'The first weight is in there.\nI can feel it ticking.' },
    { who: 'pip', text: "That's your knees knocking. Chin up, knight." },
  ],
  boarKing: [
    { who: 'boarking', text: 'WHO DARES ENTER THE HOLLOW\nOF THE BOAR KING? SNORT!' },
    { who: 'rowan', text: 'Hi. That thing on your head is a pendulum\nweight. I need it back.' },
    { who: 'boarking', text: 'It is a CROWN. It fell from the sky. A sign\nthat I am meant to rule. Everything.' },
    { who: 'pip', text: "It fell on your head, didn't it." },
    { who: 'boarking', text: '...IT WAS A GLORIOUS CORONATION.\nYOU WILL NOT HAVE IT!' },
  ],
  boarKing2: [
    { who: 'boarking', text: 'Grr! Not bad for a sleepy tin can.\nPIGLETS! Defend your king!' },
    { who: 'pip', text: 'Hit the piglets first. He hides behind them.\nClassic boss move.' },
  ],
  boarKing3: [
    { who: 'boarking', text: 'ENOUGH! THE CROWN STAYS ON MY HEAD!\nRAAAGH!' },
    { who: 'pip', text: "Uh oh. He's enraged: everything's faster.\nKeep your rhythm!" },
  ],
  victory: [
    { who: 'boarking', text: 'Fine! Take your shiny hat. It was giving me\nheadaches anyway.' },
    { who: 'narrator', text: 'Rowan carried the first weight home and set it\nback on the Great Pendulum...' },
    { who: 'narrator', text: '...and for the first time in weeks,\nthe Pendulum ticked. Once.' },
    { who: 'rowan', text: 'One down. Eleven to go. Can I nap first?' },
    { who: 'pip', text: 'No. Word is the next weight is up in the\nFrostpeaks. Pack a scarf, knight.' },
    { who: 'narrator', text: 'To be continued...' },
  ],
};
