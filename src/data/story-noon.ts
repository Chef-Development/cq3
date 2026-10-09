// Region 5's story scenes (SPOILERS: docs/story-bible.md section 8, "Noonspire", and section 5: the midpoint twist).
// NOT IN PLAY YET: no region data exists. When it does, `Object.assign(STORY, NOON_STORY)` and point its acts at these
// ids (`startScene` noon1-3; the boss's `bossScene` noonBoss and `phaseScenes` { 2: 'noonBoss2', 3: 'noonBoss3' }; the
// region's `victoryScene` noonVictory). Same rules as story.ts (tests/unit/data.test.ts). The bar-rule hints in the
// phase scenes are placeholders until the region's rules exist.
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
    { who: 'pip', text: "With no shadows, they can't tell the time or\nthe way. The sundials are just plates now." },
  ],
  // Act 2 start: the Dawn Order still faces east; Pip has gone quiet (a seed)
  noon2: [
    { who: 'narrator', text: 'On the tallest spire, the Dawn Order stands\nfacing east, as it has for a month.' },
    { who: 'rowan', text: "They're waiting for a sunrise. Every day.\nAnd it never comes." },
    { who: 'pip', text: "They swore to greet every dawn. He took the\ndawns away. They're still keeping the oath." },
    { who: 'rowan', text: "Then we'll give them one to greet." },
    { who: 'narrator', text: 'Pip has been quiet all day. When Rowan\nlooks up, the owl looks away.' },
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
  // phase 2 (his edit): the glare (placeholder hint)
  noonBoss2: [
    { who: 'mapmaker', text: 'Too bright to see? Then do not look.' },
    { who: 'narrator', text: "He turns the sun's glare onto the fight.\nEverything blazes white." },
    { who: 'pip', text: "Don't trust what the glare shows you.\nTrust your rhythm, Rowan." },
  ],
  // phase 3 (his edit): the sun drawn down, low and huge (placeholder hint)
  noonBoss3: [
    { who: 'mapmaker', text: 'Closer, then.' },
    { who: 'narrator', text: 'He draws the sun down, low and huge.\nThe stones begin to shimmer.' },
    { who: 'pip', text: "It's all heat and haze now.\nSteady, Rowan. Steady." },
  ],
  // victory: the sun sets; the feather pen; Pip's half of the truth; he crosses the sea and the fog lifts
  noonVictory: [
    { who: 'narrator', text: 'The Nail comes loose. The sun slides west,\nand for the first time in a month, it sets.' },
    { who: 'mapmaker', text: 'My pen is one of your feathers, Pip. You\ndropped it the day they sent me away.' },
    { who: 'rowan', text: 'Pip. You were his.' },
    { who: 'pip', text: 'I sat on his shoulder in the Atlas Hall for\nten years. When he left, I stayed. For a reason.' },
    { who: 'mapmaker', text: 'I was gentle with your continent. Across the\nsea, there is no one left to be gentle for.' },
    { who: 'narrator', text: 'He walks out over the water, drawing a road\nas he goes. Out at sea, the fog begins to lift.' },
  ],
};
