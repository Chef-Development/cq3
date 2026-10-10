// Region 7's story scenes, DRAFTED AHEAD of its data (SPOILERS: docs/story-bible.md section 8, "Kestrel Reach", and
// its outline there). NOT IN PLAY: no region data exists yet. Ids for the content team's data (rename anything and
// tell the story team): `startScene` reach1-3; the mini-bosses' `bossScene` ropewright (Act 1) and squall (Act 2); the
// camp's scene after Act 1, reachCamp; the boss's `bossScene` kestrel and `phaseScenes` { 2: 'kestrel2',
// 3: 'kestrel3' }; the region's `victoryScene` reachVictory. Same rules as story.ts (tests/unit/data.test.ts). The
// phase hints follow the outline's ideas (gaps closing; everything tied in pairs) and change with the rules as built.
//
// Kestrel Reach was a cliff isle of rope bridges and climbing towns; people fell, sometimes. His draft over the blank:
// the isle in floating pieces at one height, each tied to the next with gold thread: nothing falls, nobody climbs, and
// nobody is ever far from anyone (his first fix of people's troubles, not the land's). Between the pieces is blank,
// and the blank holds Rowan up (a seed). Keystone: the Mooring, held by the Great Kestrel, who was out at sea when the
// isle went blank (she doesn't speak).

import type { StoryBox } from './types';

export const REACH_STORY: Record<string, StoryBox[]> = {
  // Act 1 start: the road ends at floating steps; Rowan walks on the blank between them
  reach1: [
    { who: 'narrator', text: "His road ends at a cliff that isn't there:\nrocks floating in a row, and white between." },
    { who: 'sable', text: 'Those gaps. How do we get across?' },
    { who: 'narrator', text: 'Rowan steps off the edge, onto the white.\nIt holds him.' },
    { who: 'neve', text: 'You are standing on NOTHING.' },
    { who: 'rowan', text: "It isn't nothing. It feels like paper.\nTake my hand. All of you." },
    { who: 'pip', text: '...Hoo.' },
  ],
  // Act 1 mini-boss: a knot of rope and planks he drew to tie the pieces together (no speech)
  ropewright: [
    { who: 'narrator', text: 'A tangle of rope and planks hauls itself\nup onto the path, knotting as it comes.' },
    { who: 'pip', text: 'He drew it to tie the pieces together.\nIt ties whatever it touches to something.' },
    { who: 'sable', text: "Then nobody touch it.\n...Rowan, it's touching you." },
  ],
  // camp, after Act 1: what is Rowan? (a seed)
  reachCamp: [
    { who: 'narrator', text: 'Night at camp, on a floating rock. Below,\nthe white goes all the way down.' },
    { who: 'sable', text: 'On the causeway you walked on blank water.\nToday, blank air. What are you, Rowan?' },
    { who: 'rowan', text: "I don't know. I don't know what I am." },
    { who: 'neve', text: "You're the one who carries us across.\nThat'll do for now." },
    { who: 'narrator', text: 'On the edge of the rock, Pip says nothing\nat all. That is how they know he heard.' },
  ],
  // Act 2 start: Ropetown; his fix of people's troubles
  reach2: [
    { who: 'narrator', text: 'Ropetown. Every house is its own floating\nrock, tied with gold to every other.' },
    { who: 'pip', text: "He means it kindly. No one will ever be\nfar from anyone again. That's his fix." },
    { who: 'sable', text: "Tied to my family forever? That's not a\nfix. That's a sentence." },
    { who: 'rowan', text: "Why would he care who's far away?" },
    { who: 'pip', text: '...Ask him. He might even tell you.' },
  ],
  // Act 2 mini-boss: the gull queen, whose chicks have never fallen, so have never flown
  squall: [
    { who: 'narrator', text: 'On the highest roof, a huge gull stands over\na nest of chicks, and screams at them.' },
    { who: 'squall', text: 'Jump. JUMP! ...They will not. They have\nnever fallen. So they have never flown.' },
    { who: 'rowan', text: "We can bring the falling back.\nThen they'll learn." },
    { who: 'squall', text: 'Fall? From HERE? Into THAT?\nOff my roof!' },
    { who: 'pip', text: "She's frightened for them, Rowan.\nGo gently. She won't." },
  ],
  // Act 3 start: the Eyrie and the Mooring
  reach3: [
    { who: 'narrator', text: 'The Eyrie, on the highest rock of all. From\nit, a gold thread runs up into the sky.' },
    { who: 'pip', text: "The Mooring. It holds every piece up, her\nnest too. That's his line." },
    { who: 'neve', text: 'And on the nest, the biggest bird I have\never seen. Is it looking at us?' },
    { who: 'sable', text: "It's looking at Pip." },
  ],
  // Act 3 boss: he means it kindly; Rowan sees what he is
  kestrel: [
    { who: 'narrator', text: 'The Great Kestrel spreads her wings, and\nthe whole Eyrie falls into shadow.' },
    { who: 'mapmaker', text: 'You crossed my blank on foot, knight.\nIt held you. Who drew you?' },
    { who: 'mapmaker', text: 'She was out at sea when the isle went blank.\nShe came home to this. She likes it.' },
    { who: 'mapmaker', text: 'Here, no one falls. No one is ever too far\naway to reach. Is that so terrible?' },
    { who: 'rowan', text: 'Then why do you look so alone?' },
    { who: 'mapmaker', text: '...My wife asked me that, once.\nHunt well.' },
  ],
  // phase 2 (his first edit): the pieces drawn together, the gaps closed (hint: the outline's idea)
  kestrel2: [
    { who: 'mapmaker', text: 'Closer. ...There. Better.' },
    { who: 'narrator', text: 'He draws the pieces in. The gaps close,\nand everything crowds together.' },
    { who: 'neve', text: "No more gaps. It's all packed tight.\nKeep your rhythm, Rowan!" },
  ],
  // phase 3 (his second edit): everything tied in pairs (hint: the outline's idea)
  kestrel3: [
    { who: 'mapmaker', text: 'Hold on to each other. All of you.' },
    { who: 'narrator', text: 'Gold thread runs from his pen through\neverything, and ties it all in pairs.' },
    { who: 'pip', text: "Tied in pairs: hit one, then the other.\nYou've done this before." },
  ],
  // victory: the isle comes down; a chick falls, and flies; "too far away, once" (a seed for the next region)
  reachVictory: [
    { who: 'narrator', text: 'The Mooring snaps. Rock by rock, the isle\ncomes down to the sea, and stands.' },
    { who: 'narrator', text: 'On a ledge, a gull chick tips over the edge.\nIt falls. Then it flies.' },
    { who: 'mapmaker', text: 'I was too far away, once. Only once.\nIt was enough.' },
    { who: 'rowan', text: 'Too far away from who?' },
    { who: 'narrator', text: 'He does not answer. Ahead of him, out of\nthe blank, the next isle rises.' },
  ],
};
