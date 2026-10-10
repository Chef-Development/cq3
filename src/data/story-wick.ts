// Region 8's story scenes, DRAFTED AHEAD of its data (SPOILERS: docs/story-bible.md section 8, "Thimblewick", its
// outline, and section 5: twist 2 plays here, in `wick2`). NOT IN PLAY: no region data exists yet. Ids for the content
// team's data (rename anything and tell the story team): `startScene` wick1-3 (wick2 is the twist, in the copyists'
// archive); the mini-bosses' `bossScene` polisher (Act 1) and press (Act 2); the camp's scene after Act 1, wickCamp;
// the boss's `bossScene` mender and `phaseScenes` { 2: 'mender2', 3: 'mender3' }; the region's `victoryScene`
// wickVictory. Same rules as story.ts (tests/unit/data.test.ts). The phase hints follow the outline's ideas (mending;
// winding) and change with the rules as built.
//
// Thimblewick was a makers' town: clockmakers, weavers, copyists; the copyists' archive keeps a copy of the Atlas
// made every hundred years. His draft over the blank: nothing ever breaks or wears out, so nobody needs a maker, and
// the town stops. He drew the archive back line for line, for what it holds: two copies, a century apart, that show
// a keeper moved the river into Wend's valley. He never says his son's name (not until Region 11).

import type { StoryBox } from './types';

export const WICK_STORY: Record<string, StoryBox[]> = {
  // Act 1 start: a town where nothing wears out
  wick1: [
    { who: 'narrator', text: 'Thimblewick, a town of makers. Every hinge\nsilent. Every shop shut.' },
    { who: 'sable', text: 'Not one scuff. Who lives like this?' },
    { who: 'pip', text: "Nobody. That's the trouble. Nothing here\nwears out, so nobody needs a maker." },
    { who: 'neve', text: "A town that doesn't need its people.\nHe's outdone himself." },
    { who: 'rowan', text: "Then let's make it need them again." },
  ],
  // Act 1 mini-boss: an eight-armed brass thing that polishes away every scuff (no speech)
  polisher: [
    { who: 'narrator', text: 'A brass thing with eight arms comes down\nthe lane, polishing everything it passes.' },
    { who: 'sable', text: 'It buffed my dagger clean. Every nick\non that blade was a story.' },
    { who: 'neve', text: 'Then keep it OFF you.' },
  ],
  // camp, after Act 1: Mags on a town that never needs a smith (seeds her line for the end)
  wickCamp: [
    { who: 'narrator', text: 'Night at camp. Mags bangs at her anvil\nharder than she needs to.' },
    { who: 'smith', text: 'A whole town of makers, and nothing to\nmend. Feh. Who draws a thing like THAT?' },
    { who: 'rowan', text: 'He says nothing will break there again.' },
    { who: 'smith', text: "Then nothing gets mended. A mend should\nSHOW, lad. That's how you know someone cared." },
    { who: 'pip', text: "Hoo. She's right, you know." },
  ],
  // Act 2 start (twist 2): the copyists' archive; two copies of the Atlas, a century apart; the river; the flood
  wick2: [
    { who: 'narrator', text: 'In the archive, two great copies of the\nAtlas lie side by side, a century apart.' },
    { who: 'mapmaker', text: 'Look at the river, knight. Here, it runs\nthrough Meridian. Here, it does not.' },
    { who: 'mapmaker', text: 'A keeper moved it, a hundred years ago,\ninto a valley. Into my village. Wend.' },
    { who: 'mapmaker', text: 'A flood came. I begged the High Keeper for a\nlevee. She said: keep the line, never make it.' },
    { who: 'mapmaker', text: 'So I kept the line.\nAnd the water took my boy.' },
    { who: 'rowan', text: "...The world was unfair to you. You're\nright about that. You're wrong about the rest." },
  ],
  // Act 2 mini-boss: the archive's printing press, drawn to walk, copying everything so nothing is ever lost
  press: [
    { who: 'narrator', text: "Behind the shelves, the archive's great press\nwakes with a thump, and walks." },
    { who: 'press', text: 'COPY. COPY. COPY.' },
    { who: 'sable', text: "It's printing us. Page after page of me,\nand not one of them breathing." },
    { who: 'press', text: 'NOTHING LOST. NOTHING LOST. COPY.' },
  ],
  // Act 3 start: the works under the town; Rowan can't stop thinking about the boy
  wick3: [
    { who: 'narrator', text: 'Under the town, the great works turn. At\ntheir heart stands a brass giant, all hands.' },
    { who: 'pip', text: "The Mender. In its back, the Key that keeps\nit all wound. That's his line." },
    { who: 'sable', text: "Rowan. You've been quiet since the archive." },
    { who: 'rowan', text: 'He had a son.\nI keep thinking about it.' },
    { who: 'neve', text: "Think after. Fight now. ...I'm sorry about\nhis boy. I am." },
  ],
  // Act 3 boss: nothing lost; Rowan asks about Hesper
  mender: [
    { who: 'mapmaker', text: 'Nothing here will ever wear out again.\nNothing will ever be lost.' },
    { who: 'rowan', text: "Things get lost. People find them. That's\nmost of what people do." },
    { who: 'rowan', text: 'Did Hesper know? About the river?' },
    { who: 'mapmaker', text: 'Ask her, knight. She will tell you less\nthan I have.' },
    { who: 'narrator', text: 'The Mender turns, every hand open, to mend\nwhatever Rowan breaks.' },
  ],
  // phase 2 (his first edit): everything mends faster (hint: the outline's mending idea)
  mender2: [
    { who: 'mapmaker', text: 'Nothing breaks.' },
    { who: 'narrator', text: 'His pen moves. Everything Rowan strikes\nknits itself back together, faster.' },
    { who: 'neve', text: 'Hit them twice, and quick,\nbefore they mend!' },
  ],
  // phase 3 (his second edit): he winds everything at once (hint: the outline's winding idea)
  mender3: [
    { who: 'mapmaker', text: 'Let me mend this fight.' },
    { who: 'narrator', text: 'He turns the Key with his own hand. Every\nwheel under the town spins at once.' },
    { who: 'pip', text: "Everything's wound tight. Keep up, Rowan.\nYou can." },
  ],
  // victory: wear comes back; the makers wake; he needs more ink (sets up the next region's end)
  wickVictory: [
    { who: 'narrator', text: 'The Key snaps. Somewhere above, a hinge\nsqueaks: the first sound of wear in months.' },
    { who: 'narrator', text: 'In their white patches, the makers wake,\nand reach for their tools.' },
    { who: 'mapmaker', text: 'These isles do not hold ink enough for the\nFair Copy, knight. I will find more.' },
    { who: 'narrator', text: 'He goes. Far out on the sea, his next isle\nis already drawn, and waiting.' },
    { who: 'pip', text: "Rowan. There's more. It isn't mine to tell." },
  ],
};
