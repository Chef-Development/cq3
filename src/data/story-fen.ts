// Region 4's story scenes (SPOILERS: docs/story-bible.md section 8, "Lanternfen"; region id `duskmire`). NOT IN PLAY
// YET: not merged into STORY (src/data/story.ts) until Team 3 wires the region in: then `Object.assign(STORY,
// FEN_STORY)` and point the acts at these ids (`startScene` fen1-3; the boss's `bossScene` fenBoss and `phaseScenes`
// { 2: 'fenBoss2', 3: 'fenBoss3' }; the region's `victoryScene` fenVictory). The mini-bosses' scenes come once their
// foes exist. Same rules as story.ts (6 boxes a scene, 2 lines a box, every line fits: tests/unit/data.test.ts).
//
// Lanternfen was a coastal fen lit by a thousand lanterns, with a tide that ran in twice a day. A tipped lantern could
// burn a stilt row; a night tide could drown the careless. His fix: he drew the flames out of the lanterns, held the
// sun just under the horizon (an endless dusk) and put the tide on a short leash (in and out every few minutes, never
// higher than a knee). Dark blocks and tides. Keystone: the last lantern, the Mirelight, hung on the lure of Mirewick,
// a vast old angler-toad of the deep channels (it doesn't speak). Here he first erases part of the continent itself.

import type { StoryBox } from './types';

export const FEN_STORY: Record<string, StoryBox[]> = {
  // Act 1 start: an endless dusk; lanterns everywhere and none lit; the water breathing in and out
  fen1: [
    { who: 'narrator', text: 'Lanternfen, at dusk. It has been dusk for\na month. Not one lantern burns on the water.' },
    { who: 'rowan', text: 'There are lanterns on every post and roof.\nWhy is nobody lighting them?' },
    { who: 'pip', text: 'He drew the flame out of them. No fires, no\nburned stilt-houses. And no night, ever.' },
    { who: 'neve', text: 'No night, so no stars. Stars are the only\nthing I like more than ice.' },
    { who: 'sable', text: "And the water won't sit still. In, out, in,\nout. Like the whole fen is breathing." },
    { who: 'pip', text: "He leashed the tide. It's never high enough\nto drown in. Keep your boots on the boards." },
  ],
  // Act 2 start: he erases a fen village in front of them (he needs ink); Rowan walks into the blank
  fen2: [
    { who: 'narrator', text: "At the fen's edge stands a village on stilts.\nAs they watch, it goes white." },
    { who: 'rowan', text: "He's rubbing it out. Right in front of us.\nPip, there are people in there." },
    { who: 'pip', text: 'He needs ink. Every line he draws is scraped\nfrom somewhere else. Now it comes from here.' },
    { who: 'narrator', text: 'Rowan walks into the blank. White boards,\nwhite water, and the villagers asleep.' },
    { who: 'rowan', text: "They're asleep where they stood. I'll come\nback for you. Every one of you." },
    { who: 'sable', text: 'Rowan. The water went white, and you\nwalked on it. Just... walked.' },
  ],
  // Act 3 start: the Mirelight far out on the deep channels; Rowan can't swim and doesn't know why
  fen3: [
    { who: 'narrator', text: 'The deep channels. Far out on the black\nwater hangs one light: the Mirelight.' },
    { who: 'pip', text: 'The last lantern in the fen. He hung it\nwhere nobody could reach it.' },
    { who: 'rowan', text: "Then we go out to it. Over the water.\n...I can't swim. I never could." },
    { who: 'rowan', text: "I don't know why. Deep water, and my hands\njust stop. Since before I remember." },
    { who: 'neve', text: "Then you won't fall in. I'll freeze you a\npath. You're welcome in advance." },
    { who: 'sable', text: 'Something under that light is moving.\nSomething big. With teeth.' },
  ],
  // Act 3 boss: Mirewick rises; he defends what he did, and the sum he did
  fenBoss: [
    { who: 'narrator', text: 'The light rises from the water. Under it,\na mouth as wide as a boat. Mirewick.' },
    { who: 'mapmaker', text: 'Do not hurt it. It has kept the last light\nfor a month and never once let it go out.' },
    { who: 'rowan', text: 'You took every other lantern in the fen.\nAnd you erased a village to do it.' },
    { who: 'mapmaker', text: 'One village, sleeping, to save a thousand\nhouses from fire. You would do the same sum.' },
    { who: 'rowan', text: "I wouldn't do the sum at all.\nThey're people." },
    { who: 'mapmaker', text: 'So were the ones who burned.\nMirewick. Light the way.' },
  ],
  // phase 2 (his edit): the tide comes in higher
  fenBoss2: [
    { who: 'mapmaker', text: 'The tide comes in.' },
    { who: 'narrator', text: 'He draws the tide higher. The water climbs\nthe boards, and the dark climbs with it.' },
    { who: 'pip', text: 'Mind the water, Rowan!\nRead the tide before you swing.' },
  ],
  // phase 3 (his edit): he snuffs the lure; only the light Rowan carries is left
  fenBoss3: [
    { who: 'mapmaker', text: 'Lights out.' },
    { who: 'narrator', text: 'He snuffs the lure. The fen goes black, but\nfor the little light Rowan carries.' },
    { who: 'pip', text: "You've got your own light. Look where it\nfalls, and trust it." },
  ],
  // victory: true night and a thousand lanterns; the cost, named; a seed (the river once ran from the north)
  fenVictory: [
    { who: 'narrator', text: 'The Mirelight goes out, and true night falls\nfor the first time in a month. Stars.' },
    { who: 'narrator', text: 'Then, one by one, the fen-folk light their\nlanterns. A thousand of them, on the water.' },
    { who: 'mapmaker', text: 'One of those will tip over by spring, and a\nrow of houses will burn. You know that.' },
    { who: 'rowan', text: "And the village you erased is waking up.\nThat's the only sum I need." },
    { who: 'narrator', text: 'An old fen-woman watches the lights. "The\nriver ran down from the north, once," she says.' },
    { who: 'pip', text: "He's gone east, to Noonspire. The sun there\nhasn't set in a month." },
  ],
};
