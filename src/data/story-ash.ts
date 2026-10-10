// Region 3's story scenes (SPOILERS: docs/story-bible.md section 8, mechanics in docs/content-bible.md section 6).
// Merged into STORY (src/data/story.ts). Same rules as story.ts: at most 6 boxes per scene, 2 lines per box, every line
// fits the text box (tests/unit/ashfell-data.test.ts). The plot is earnest; the jokes belong to the heroes.
//
// Ashfell's lava rivers used to change course every year and cut families apart. The Mapmaker's fix: he unpinned the
// land so every stone drifts out of the lava's way (drifting blocks), and chained together everything that belongs
// together (linked pairs). His keystone: an anvil that never cools, given to Bellows, the finest smith alive, who has
// forged the chain for all of Ashfell ever since; every blow shakes the land. Mags, the camp's smith, was his apprentice.

import type { StoryBox } from './types';

export const ASH_STORY: Record<string, StoryBox[]> = {
  // Act 1 start: ash, basalt, lava, and none of it holds still; chains on everything
  ash1: [
    { who: 'narrator', text: 'Ashfell. Black rock, gray ash, rivers of\nlava. And none of it will hold still.' },
    { who: 'rowan', text: 'That boulder just slid past me. On its own.\nThe whole land is drifting.' },
    { who: 'pip', text: "He unpinned it. Every stone floats out of\nthe lava's way, so no home burns again." },
    { who: 'neve', text: "Too hot, AND it won't hold still. My two\nleast favorite things." },
    { who: 'sable', text: "And chains. On the carts, the doors, the\npeople. Everyone's chained in pairs." },
    { who: 'pip', text: "So no new river of fire can part a family.\nTogether, always. That's his fix." },
  ],
  // Act 1 mini-boss: a road-roller armadillo who paves the drifting flats, and they never stay paved
  rumbleback: [
    { who: 'rumbleback', text: "OFF THE ROAD! I just laid that slab. It's the\nonly one that hasn't drifted off." },
    { who: 'rowan', text: "We're here to stop the drifting. Let us\nthrough, and you can finish your road." },
    { who: 'rumbleback', text: 'Finish it? Every slab drifts off by morning.\nI have paved these flats every single day.' },
    { who: 'pip', text: "Rumbleback. He paves a road nobody can keep.\nHe hasn't stopped since the redraw." },
    { who: 'rumbleback', text: "And now you've left BOOTPRINTS on it.\nHold still while I smooth you out!" },
  ],
  // at the camp after Act 1 (where the Frostpeaks had Neve join): Mags knows whose forge it is
  magsTale: [
    { who: 'smith', text: "Ashfell, eh? That smoke on the volcano is\nOld Bellows' forge. He was my master." },
    { who: 'rowan', text: "Your master? What's he forging up there?" },
    { who: 'smith', text: 'Chain. For the whole land. Your Mapmaker\ngave him an anvil that never cools.' },
    { who: 'smith', text: "A perfect anvil. Worst gift you can give a\nsmith. He'll never put the hammer down." },
    { who: 'rowan', text: 'So every blow shakes the land, and the more\nit drifts, the more chain he forges.' },
    { who: 'smith', text: 'If you see him, tell him Mags says rest.\nAnd his good tongs are in MY bag.' },
  ],
  // Act 2 start: tunnels of black glass, and everything chained in twos
  ash2: [
    { who: 'narrator', text: 'The Glass Warrens. Tunnels of black glass,\nlit red by lava glowing behind the walls.' },
    { who: 'sable', text: "Glass walls. A piece of this would pay a\nyear's rent. A small piece." },
    { who: 'rowan', text: "Everything's chained in twos down here.\nThe lamps, the buckets, the doors." },
    { who: 'pip', text: 'Hit both ends of a pair, and quick.\nOne, then the other.' },
    { who: 'neve', text: "Glass bounces things back. That's how I got\nfrozen. I'm watching every wall." },
  ],
  // Act 2 mini-boss: the forge's two-headed hound; one guards, one wants to play; nobody has patted them in years
  hobnob: [
    { who: 'hobnob', text: "HOB: Who goes there? Turn back.\nNOB: ...Do you have food? We're hungry." },
    { who: 'rowan', text: 'Two heads, one hound. Which of you\nguards the forge?' },
    { who: 'hobnob', text: "HOB: Me. Nobody passes the master's gate.\nNOB: He hasn't fed us in a long time." },
    { who: 'pip', text: "Bellows hasn't stopped working long enough\nto feed his own hound." },
    { who: 'sable', text: "Easy, both of you. We're not here for\nyour master's gate. ...Well. We are." },
    { who: 'hobnob', text: 'HOB: Then you go through us.\nNOB: ...Sorry.' },
  ],
  // Act 3 start: the forge on the volcano's rim, shaking with every blow
  ash3: [
    { who: 'narrator', text: "The Black Forge, on the volcano's rim.\nBANG. The whole mountain jumps. BANG." },
    { who: 'rowan', text: 'Every blow, the ground slides. Nobody here\nhas slept in weeks.' },
    { who: 'sable', text: 'Chains as thick as trees, glowing hot.\nWorth a fortune. Too heavy to steal.' },
    { who: 'pip', text: "The anvil's in there, and Bellows with it.\nAnd the volcano is getting restless." },
    { who: 'rowan', text: "Then we put the hammer down for him.\nGently, if he'll let us." },
  ],
  // Act 3 boss
  bellows: [
    { who: 'bellows', text: "Can't stop, can't chat. One more link.\nThen one more. Then one more." },
    { who: 'rowan', text: "That anvil is the Mapmaker's line. Put the\nhammer down, and the land can hold still." },
    { who: 'bellows', text: "Down? It's the finest anvil ever drawn!\nNothing struck on it ever cools." },
    { who: 'rowan', text: 'Mags says rest. And she has your tongs.' },
    { who: 'bellows', text: 'Little Mags? Still holding her hammer wrong?\nNo time. You will make fine links, all of you!' },
  ],
  // phase 2 (his edit): the drifting stops; the chains double
  bellows2: [
    { who: 'mapmaker', text: 'Together. Always together. Let me\nhelp you, old friend.' },
    { who: 'narrator', text: 'His pen pins the land still and doubles the\nchains. Now everything comes in pairs.' },
    { who: 'pip', text: 'Pairs, Rowan! Hit one, then its partner,\nquick. Both or nothing.' },
  ],
  // phase 3: the volcano breaks through his drawing, and he redraws as fast as it breaks
  bellows3: [
    { who: 'narrator', text: 'The volcano wakes under his drawing and\nbreaks through it. The lines split apart.' },
    { who: 'mapmaker', text: 'Steady. I can draw faster than\nyou can break.' },
    { who: 'pip', text: "Everything slides now, the pairs too.\nWatch which way they're heading!" },
  ],
  // victory: the anvil cools; Bellows sits down at last; he names the cost; next, the Duskmire
  ashVictory: [
    { who: 'narrator', text: 'The anvil cools, dull and gray. The chains\nfall slack. Across Ashfell, the land stops.' },
    { who: 'bellows', text: 'My arms... When did I last sit down?\nI have forgotten how.' },
    { who: 'rowan', text: 'Like this. Put the hammer down.\nThe chain is long enough.' },
    { who: 'mapmaker', text: 'The next lava flow will part their families.\nYou know that, knight.' },
    { who: 'rowan', text: "Then they'll choose where to go.\nYou don't get to choose for them." },
    { who: 'pip', text: "He's gone south, to the Duskmire. It has\nbeen sunset there for a month." },
  ],
};
