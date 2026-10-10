// Region 9's story scenes, DRAFTED AHEAD of its data (SPOILERS: docs/story-bible.md section 8, "Saltmarrow", and
// section 5: the end of Movement II, where the stakes peak). NOT IN PLAY: no region data exists yet. Ids for the content
// team's data (rename anything and tell the story team): `startScene` salt1-3; the mini-bosses' `bossScene` saltworks
// (Act 1) and gale (Act 2); the camp's scene after Act 1, saltCamp; the boss's `bossScene` brine and `phaseScenes`
// { 2: 'brine2', 3: 'brine3' }; the region's `victoryScene` saltVictory (he takes Meridian: the world map's capital
// goes blank after it). Same rules as story.ts (tests/unit/data.test.ts). The phase hints follow the outline's ideas
// (salt crust; glass calm) and change with the rules as built.
//
// Saltmarrow was a fishing isle in a stormy sea, with a storm wall (Hollis's) and a storm-bell abbey (Brann's). His
// draft over the blank: the sea drawn dead calm, flat as glass, until it crusted into salt: no boat lost, no tide, no
// fish, and nothing for the bell to ring for. Keystone: the Glass, a pane laid over the deep water, given to Old
// Brine, a sea serpent who was out in the deep when the isle went blank and was caught when the sea was drawn still
// (it doesn't speak). Brann's first words belong in banter (he may not be at the camp): banter-isles.ts.

import type { StoryBox } from './types';

export const SALT_STORY: Record<string, StoryBox[]> = {
  // Act 1 start: a sea you can walk on
  salt1: [
    { who: 'narrator', text: 'Saltmarrow. The sea around it lies flat and\nwhite, crusted over with salt.' },
    { who: 'rowan', text: 'You can walk on it. On the sea.' },
    { who: 'sable', text: "For once, so can the rest of us.\nI'm not sure I like that better." },
    { who: 'pip', text: 'No storms, so no boat will ever go down.\nNo tide. No fish. Nothing moves at all.' },
    { who: 'neve', text: 'Even the gulls are walking.' },
    { who: 'rowan', text: "Let's give them back their sea." },
  ],
  // Act 1 mini-boss: a rake-armed thing he drew to keep the flats smooth (no speech)
  saltworks: [
    { who: 'narrator', text: 'A rake-armed thing scrapes across the flats,\nsmoothing every ripple out of the salt.' },
    { who: 'pip', text: 'He drew it to keep the sea flat.\nIt smooths whatever stands up.' },
    { who: 'sable', text: "Rowan. We're standing up." },
  ],
  // camp, after Act 1: the deep water under the salt (a seed)
  saltCamp: [
    { who: 'narrator', text: 'Night at camp, out on the salt. Under it,\nfar down, the deep water waits.' },
    { who: 'neve', text: "You keep looking down. It's SALT, Rowan.\nIt'll hold." },
    { who: 'rowan', text: "I know. I keep thinking about what's under\nit. Deep water. I don't know why." },
    { who: 'pip', text: "...You're safe up here, Rowan.\nI promise." },
  ],
  // Act 2 start: the storm wall and the bell with nothing to do
  salt2: [
    { who: 'narrator', text: 'The Storm Wall: a great sea wall, holding\nback a sea that never moves.' },
    { who: 'rowan', text: 'Someone built this against the storms.\nAnd up the hill, a bell.' },
    { who: 'pip', text: 'It rang when a storm was coming.\nNow it has nothing to ring for.' },
    { who: 'sable', text: 'A wall with nothing to stop. A bell with\nnothing to say. I know how they feel.' },
  ],
  // Act 2 mini-boss: a storm petrel, a month on the wing with nowhere to land
  gale: [
    { who: 'narrator', text: 'A storm petrel drops out of the white sky,\nragged, its wings worn thin.' },
    { who: 'gale', text: 'Storm? Storm? ...No. Nothing. Months on\nthe wing, and not one wave to land on.' },
    { who: 'rowan', text: "We're bringing the storms back.\nLet us through." },
    { who: 'gale', text: 'Back? ...Then show me you can stand in\na wind. HOLD ON!' },
  ],
  // Act 3 start: the Glass over the deep water; what waits under it
  salt3: [
    { who: 'narrator', text: 'Out where the deep water was, a pane of\nglass lies over the sea.' },
    { who: 'pip', text: "The Glass. That's his line. And under it,\nsomething very big has been waiting." },
    { who: 'narrator', text: 'Under the Glass, a coil of salt-white scales\nshifts, and groans like a ship.' },
    { who: 'neve', text: "Rowan, you've gone pale." },
    { who: 'rowan', text: "It's deep under there. I'm fine.\nLet's go." },
  ],
  // Act 3 boss: his reason, in five words
  brine: [
    { who: 'mapmaker', text: 'Not a boat lost since I came. Not one\nwoman widowed on this shore.' },
    { who: 'rowan', text: 'Not one fish. Not one wave. Not one bell.\nYou took everything that moves.' },
    { who: 'mapmaker', text: 'Everything that moves can drown.' },
    { who: 'narrator', text: 'The Glass heaves, and Old Brine rises\nbeneath it, crusted in salt.' },
  ],
  // phase 2 (his first edit): the salt spreads (hint: the outline's salt crust)
  brine2: [
    { who: 'mapmaker', text: 'Be still.' },
    { who: 'narrator', text: 'Salt creeps from his pen across everything,\nthick and white.' },
    { who: 'neve', text: 'The crusted ones take two: crack the salt,\nthen strike!' },
  ],
  // phase 3 (his second edit): stiller (hint: the outline's glass calm)
  brine3: [
    { who: 'mapmaker', text: 'Stiller.' },
    { who: 'narrator', text: 'The air itself stops. Nothing moves but\nRowan, and the serpent.' },
    { who: 'pip', text: "Some won't stir until you've gone by once.\nPatience, Rowan." },
  ],
  // victory: the first wave, a storm, the bell; then he takes Meridian for ink (the stakes peak)
  saltVictory: [
    { who: 'narrator', text: 'The Glass shatters. The first wave in months\nrolls in, and then a storm, a real one.' },
    { who: 'narrator', text: 'Up the hill, the abbey bell rings for a\nreason. The fishing village wakes, soaked.' },
    { who: 'mapmaker', text: 'Forgive me, knight. You will want to go\nhome now. You will find it asleep.' },
    { who: 'mapmaker', text: 'The isles did not hold ink enough. I took\nMeridian. They are only sleeping, knight.' },
    { who: 'narrator', text: 'Rowan says nothing. Behind him, the storm\nwalks away across the sea.' },
    { who: 'pip', text: "Rowan... The knights' hall. Hesper.\nThat was home." },
  ],
};
