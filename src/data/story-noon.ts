// Region 5's story scenes (SPOILERS: docs/story-bible.md section 8, "Noonspire", and section 5: the midpoint twist).
// NOT IN PLAY YET: the region's data (src/data/noonspire.ts, enemies-noon.ts; docs/content-bible.md section 8) points
// at these ids but isn't wired in; when it is, `Object.assign(STORY, NOON_STORY)`. Acts: `startScene` noon1-3; the
// mini-bosses' `bossScene` sphinx (Act 1) and brassLion (Act 2); the Gnomon's `bossScene` noonBoss and `phaseScenes`
// { 2: 'noonBoss2', 3: 'noonBoss3' }; the region's `victoryScene` noonVictory. Same rules as story.ts
// (tests/unit/data.test.ts). The hints follow the rules as built: mirages (a yellow hops to the ghost outline shown
// first) from Act 1, heat (blazing yellows hit hard and burn; a green cools) from Act 2; the Gnomon's phase 2 is the
// glare (every yellow blazes), phase 3 the sun drawn down (everything a mirage, the blaze stays).
//
// Noonspire was a high desert plateau of white towers and sundials, with deadly cold nights; the Dawn Order greeted
// every sunrise from its tallest spire. His fix: he drove a nail through the sun and pinned it at noon. No night, no
// cold, and no shadows, so nobody can tell the time or the way, and the Dawn Order has no dawn. Keystone: the Nail,
// guarded by the Gnomon, the great sundial's needle stood up as a brass sentinel (it doesn't speak). Here the
// Mapmaker greets Pip by name, and Pip admits he was his owl (twist 1); then Ambrose crosses the sea.

import type { StoryBox } from './types';

export const NOON_STORY: Record<string, StoryBox[]> = {
  // Act 1 start: no shadows anywhere
  noon1: [
    { who: 'narrator', text: 'Noonspire. White towers on a high plateau,\nand the sun nailed straight overhead.' },
    { who: 'rowan', text: 'Nobody has a shadow. Not the towers, not\nthe people. Not me.' },
    { who: 'pip', text: 'He pinned the sun at noon, so nobody freezes\nin the desert dark. No night. No cold.' },
    { who: 'sable', text: "And no shade. I'm cooking. Neve has\nturned into a puddle." },
    { who: 'neve', text: 'I am NOT a puddle. I am a mage with a\ndamp hat. There is a difference.' },
    { who: 'pip', text: "With no shadows, they can't tell the time or\nthe way. And the heat paints lakes on the road." },
  ],
  // Act 1 mini-boss: the Noon Sphinx keeps the White Road with a riddle nobody can answer any more
  sphinx: [
    { who: 'narrator', text: 'On the White Road lies a sphinx, gold as the\nsand, her eyes half shut against the glare.' },
    { who: 'sphinx', text: 'Travelers. A riddle, then. Long at dawn,\ngone at noon, long again at dusk. What am I?' },
    { who: 'rowan', text: '...A shadow.' },
    { who: 'sphinx', text: 'Yes. No one has answered me in a month.\nBut you cast no shadow. So you are a mirage.' },
    { who: 'sphinx', text: 'The road is full of mirages, and I do not\nlet them pass. Not one.' },
    { who: 'pip', text: 'The haze is her trick. Strike where the\nshimmer lands, not where it was.' },
  ],
  // Act 2 start: the Dawn Order still faces east; Pip has gone quiet (a seed)
  noon2: [
    { who: 'narrator', text: 'On the tallest spire, the Dawn Order stands\nfacing east, as it has for a month.' },
    { who: 'rowan', text: "They're waiting for a sunrise. Every day.\nAnd it never comes." },
    { who: 'neve', text: "They swore to greet every dawn. He took the\ndawns away. They're STILL keeping the oath." },
    { who: 'rowan', text: "Then we'll give them one to greet." },
    { who: 'narrator', text: 'Pip has been quiet all day. When Rowan\nlooks up, the owl looks away.' },
  ],
  // Act 2 mini-boss: the Dawn Order's brass lion, which roared the sun up, has had no sunrise for a month
  brassLion: [
    { who: 'narrator', text: "At the foot of the Dawn Order's stair, a brass\nlion paces. The air above its mane ripples." },
    { who: 'neve', text: "The Order's lion. It roared the sun up every\nmorning. Then the mornings stopped." },
    { who: 'sable', text: "A month with nothing to roar at, in this\nheat. I'd be cross too." },
    { who: 'rowan', text: 'Pip? Any advice?' },
    { who: 'pip', text: "...Don't touch the mane." },
  ],
  // Act 3 start: the great sundial and the Nail; Rowan asks Pip straight
  noon3: [
    { who: 'narrator', text: "The great sundial at the plateau's heart.\nIts needle stands up, and walks." },
    { who: 'pip', text: "The Gnomon. And above it, through the sun,\nhis Nail. That's the line that holds it all." },
    { who: 'rowan', text: "Pip. You know him, don't you?\nNot just his name. Him." },
    { who: 'pip', text: '...After this one. I promise.\nAfter this one.' },
  ],
  // Act 3 boss: he defends the long safe day; then he greets the owl
  noonBoss: [
    { who: 'narrator', text: 'The Gnomon turns its brass face to the sun,\nand the light comes off it like a blade.' },
    { who: 'mapmaker', text: 'No one has frozen in this desert for a\nmonth. Not one. You may count them.' },
    { who: 'rowan', text: "And nobody has seen a sunrise. They've\nstopped counting days." },
    { who: 'mapmaker', text: 'Days are how you count losses, knight.\n...Hello, Pip. You have grown.' },
    { who: 'pip', text: 'Hello, Ambrose.' },
    { who: 'rowan', text: '...Pip?' },
  ],
  // phase 2 (his first edit, Glare!): every yellow blazes. Pip has said nothing since "Hello, Ambrose."
  noonBoss2: [
    { who: 'mapmaker', text: 'Too bright to see? Then do not look.' },
    { who: 'narrator', text: "He turns the sun's glare onto the fight.\nEvery stone blazes white." },
    { who: 'neve', text: 'The blazing ones hit hard, and they burn.\nA green cools you off. Pick your strikes!' },
  ],
  // phase 3 (his second edit, Sun Drawn Down!): everything a mirage, the blaze stays; Pip finds his voice
  noonBoss3: [
    { who: 'mapmaker', text: 'Closer, then.' },
    { who: 'narrator', text: 'He draws the sun down, low and huge.\nThe whole dial shimmers and swims.' },
    { who: 'pip', text: "Watch the outlines. That's where they'll\nland. Steady, Rowan. I'm still here." },
  ],
  // victory: the sun sets; the feather pen; Pip's half of the truth; he crosses the sea, and the first far isle
  // takes shape out of the blank (its draft is done: the world map lifts its fog, docs/story-bible.md rule 10)
  noonVictory: [
    { who: 'narrator', text: 'The Nail comes loose. The sun slides west,\nand for the first time in a month, it sets.' },
    { who: 'mapmaker', text: 'My pen is one of your feathers, Pip. You\ndropped it the day they sent me away.' },
    { who: 'rowan', text: 'Pip. You were his.' },
    { who: 'pip', text: 'I sat on his shoulder in the Atlas Hall for\nten years. When he left, I stayed. For a reason.' },
    { who: 'mapmaker', text: 'I was gentle with your continent. Across the\nsea, there is no one left to be gentle for.' },
    { who: 'narrator', text: 'He walks out over the water, drawing a road\nas he goes. Far out, the blank takes a shape.' },
  ],
};
