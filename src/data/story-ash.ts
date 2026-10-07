// Region 3's story scenes (SPOILERS: docs/content-bible.md section 6). NOT IN PLAY YET: not merged into STORY
// (src/data/story.ts) until the region is wired in. Same rules as story.ts: at most 6 boxes per scene, 2 lines per
// box, every line fits the text box (tests/unit/ashfell-data.test.ts). Tone: cheeky and light.
//
// The third weight fell into the forge of Bellows, a giant old smith who has been forging the longest chain in the
// world for four hundred years. It makes the perfect anvil (nothing struck on it ever cools), so he hammers day and
// night, and every blow on it shakes the whole land: nothing in Ashfell holds still. Mags, the camp's smith, was his
// apprentice. He never learned to rest; Rowan, the kingdom's finest napper, teaches him.

import type { StoryBox } from './types';

export const ASH_STORY: Record<string, StoryBox[]> = {
  // Act 1 start: ash, basalt, lava, and none of it holds still
  ash1: [
    { who: 'narrator', text: 'Ashfell. Black rock, gray ash, rivers of\nlava... and none of it will hold still.' },
    { who: 'rowan', text: 'Pip, that boulder just slid past me.\nOn its own. Is that a volcano thing?' },
    { who: 'pip', text: 'Hoo. The third weight fell here. Every time\nit ticks, the whole land shuffles over.' },
    { who: 'neve', text: 'Too hot AND too wobbly. My two least\nfavorite things. Someone fan me.' },
    { who: 'sable', text: 'I put my coins down, they wander off.\nThe GROUND is stealing from me. Rude.' },
    { who: 'pip', text: 'Up the road to the volcano, then. Mind the\nlava, knight. And your eyebrows.' },
  ],
  // Act 1 mini-boss: a road-roller armadillo who paves the flats with basalt and flattens whatever is on his road
  rumbleback: [
    { who: 'rumbleback', text: "OI! OFF THE ROAD! Can't you read the sign?\nWET BASALT. KEEP OFF. I just paved that!" },
    { who: 'rowan', text: "That's not a road. That's a river of lava." },
    { who: 'rumbleback', text: "It's a road that isn't FINISHED. Give it\na few hundred years. It'll set lovely." },
    { who: 'pip', text: 'Rumbleback. He rolls flat whatever is on his\nroad. Rocks, carts, knights. Mostly knights.' },
    { who: 'sable', text: "Or we just walk round? There's a perfectly\ngood bit of not-lava right over there." },
    { who: 'rumbleback', text: "Too late! You've left BOOTPRINTS. Now hold\nstill while I smooth you out!" },
  ],
  // at the camp after Act 1 (where the Frostpeaks had Neve join): Mags knows whose forge it is
  magsTale: [
    { who: 'smith', text: "Ashfell, eh? That smoke on the volcano is\nOld Bellows' forge. He was my master." },
    { who: 'rowan', text: 'Your master? I thought you were born\nholding a hammer. Fully grown. Grumpy.' },
    { who: 'smith', text: "Learned it all at his anvil. He never finished\na thing in his life. Always 'one more link'." },
    { who: 'rowan', text: "So that's the ticking! Every bang on the\nweight shakes the whole land sideways." },
    { who: 'smith', text: 'Bang, bang, all night. He never sleeps.\nNever learned how, the old fool.' },
    { who: 'smith', text: "If you see him, Mags says hi. And his good\ntongs are in MY bag. Finders keepers." },
  ],
  // Act 2 start: tunnels of black glass, and chains on everything
  ash2: [
    { who: 'narrator', text: 'The Glass Warrens. Tunnels of black glass,\nlit red by lava glowing behind the walls.' },
    { who: 'sable', text: 'Glass! Walls of it! Can I take a wall?\nJust a little one. A pocket-sized wall.' },
    { who: 'neve', text: 'Careful. Glass bounces things back.\nThat is how I got frozen. Long story.' },
    { who: 'rowan', text: 'Why is everything chained together? The\nrocks, the lamps... even the buckets.' },
    { who: 'pip', text: "Hoo. Bellows' spare chain. Pairs: hit one,\nthen the other. Quick. One, two." },
    { who: 'neve', text: "One, two. Like a spell. Or a slap.\nI'm very good at both." },
  ],
  // Act 2 mini-boss: the forge's two-headed watchdog; one head guards, the other wants to play
  hobnob: [
    { who: 'hobnob', text: 'HOB: Grr. Who goes there? Go away.\nNOB: Visitors! Hi! Wanna play fetch?' },
    { who: 'rowan', text: 'Two heads, one dog. Which one do I talk to?' },
    { who: 'hobnob', text: "HOB: Me. I'm the guard. Nobody passes.\nNOB: He's grumpy. I'm Nob! I like sticks!" },
    { who: 'pip', text: 'The forge watchdog. One head guards, one\nhead fetches. The tail is very confused.' },
    { who: 'sable', text: "Nob, buddy. Fetch the stick! It's past the\ngate. Far, far past the gate." },
    { who: 'hobnob', text: 'NOB: STICK! HOB: No! Bad Nob! ...Fine.\nBOTH: We bite you first. THEN fetch!' },
  ],
  // Act 3 start: the forge on the volcano's rim, shaking with every blow
  ash3: [
    { who: 'narrator', text: "The Black Forge, on the volcano's rim.\nBANG. The whole mountain jumps. BANG." },
    { who: 'rowan', text: 'Every bang, the ground slides. How does\nanyone nap in a place like this?' },
    { who: 'neve', text: "Nobody here has slept for weeks. Look\nat them. Even the lava looks tired." },
    { who: 'sable', text: 'Chains as thick as trees, glowing hot.\nWorth a fortune. Too heavy to steal. Tragic.' },
    { who: 'pip', text: "Hoo. The weight's in there, on his anvil.\nAnd the volcano is getting ideas." },
    { who: 'rowan', text: 'Right. Get the weight, stop the banging.\nThen everybody gets a nice long nap.' },
  ],
  // Act 3 boss
  bellows: [
    { who: 'bellows', text: "WHO'S THAT? Can't stop, can't chat. One more\nlink. Then one more. Then one more." },
    { who: 'rowan', text: "We need the pendulum weight back. The big\nround thing you're hitting with a hammer." },
    { who: 'bellows', text: 'My ANVIL? Best I ever had! Nothing struck\non it ever cools. My chain will never end!' },
    { who: 'pip', text: 'Hoo. The longest chain in the world, and\nthe land shakes with every link. Lovely.' },
    { who: 'rowan', text: "Mags says hi. And she's got your tongs." },
    { who: 'bellows', text: 'Little Mags? Still holding her hammer wrong?\nEnough! You lot will make fine links!' },
  ],
  // phase 2: the drifting stops; every 3rd yellow comes as a pair
  bellows2: [
    { who: 'bellows', text: 'You DENTED my chain! Four hundred years,\nnot one dent! CHAINWORK!' },
    { who: 'pip', text: "He's chaining your blocks in pairs. Hit one,\nthen its partner, quick! Both or nothing." },
    { who: 'neve', text: "At least the blocks stopped sliding. That's\nnice. That's... suspicious." },
  ],
  // phase 3: everything drifts again, pairs too, and the cursor never slows down
  bellows3: [
    { who: 'bellows', text: 'ENOUGH! Hotter! HOTTER! Stoke the forge\ntill the whole mountain BLOWS!' },
    { who: 'pip', text: 'Eruption! Everything slides, the pairs too.\nWatch which way they are heading!' },
    { who: 'rowan', text: 'Fast, sliding and chained together. Like my\nlast camping trip. I can do this.' },
  ],
  // victory: Rowan teaches the titan to nap; the weight home, three ticks; the next weight is in Duskmire
  ashVictory: [
    { who: 'bellows', text: "Huff... my arms... When did I last sit down?\nFour hundred years? I've forgotten how." },
    { who: 'rowan', text: 'Easy. Lie down. Close your eyes. Then think:\ntick... tock... tick...' },
    { who: 'bellows', text: 'Tick... tock... zzz... ZZZRRK... zzz...' },
    { who: 'narrator', text: 'The banging stopped. The land held still.\nRowan carried the third weight home, and...' },
    { who: 'narrator', text: '...the Great Pendulum ticked THREE times.\nIn Ashfell, the ground finally stayed put.' },
    { who: 'pip', text: 'Three down! And no, no nap. Next: Duskmire.\nSwamps. Bring a towel, knight.' },
  ],
};
