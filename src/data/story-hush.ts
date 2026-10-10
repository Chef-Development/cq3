// Region 6's story scenes, DRAFTED AHEAD of its data (SPOILERS: docs/story-bible.md section 8, "Hushwood", and its
// outline there). NOT IN PLAY: no region data exists yet. The ids are the outline's, for the content team's data to
// point at (rename anything and tell the story team): `startScene` hush1-3; the mini-bosses' `bossScene` shears (Act 1)
// and slowcoach (Act 2); the camp's scene after Act 1, hushCamp (like duskCamp); the boss's `bossScene` yew and
// `phaseScenes` { 2: 'yew2', 3: 'yew3' }; the region's `victoryScene` hushVictory. Same rules as story.ts
// (tests/unit/data.test.ts). The phase hints follow the outline's rule ideas (growth; gusts) and change with the rules
// as built.
//
// Hushwood was a forest isle of giant trees and great storms; storms dropped trees on the villages, and Yara's people
// called the forest's spirits to warn them. Erased before the story; now his draft is drawn over the blank: a forest
// with no wind, where nothing falls, and (no creature can be drawn) no birds, so no sound. The villages are blank
// pockets inside it, their people asleep. Keystone: the Stopper, a stone jar with the isle's wind corked in it, held by
// Mother Yew, the isle's oldest yew, drawn back first and drawn to walk (she doesn't speak).

import type { StoryBox } from './types';

export const HUSH_STORY: Record<string, StoryBox[]> = {
  // Act 1 start: off his sea road into a silent wood
  hush1: [
    { who: 'narrator', text: 'His road over the sea ends on a still shore.\nBeyond it, a forest. Not a leaf moves.' },
    { who: 'rowan', text: 'Listen. ...Nothing. Not one bird.' },
    { who: 'pip', text: "He can't draw birds. Nobody can.\nSo he left them out." },
    { who: 'sable', text: "A forest that doesn't creak.\nI hate it already." },
    { who: 'neve', text: "The leaves have turned, and not one of them\nfalls. Not ONE. It's deeply wrong." },
    { who: 'rowan', text: 'There were people here. Somewhere under all\nthis, there still are. Come on.' },
  ],
  // Act 1 mini-boss: great garden shears he drew to keep his rows tidy (no speech)
  shears: [
    { who: 'narrator', text: 'Down a perfectly straight row of trees come\na pair of shears as tall as a house.' },
    { who: 'pip', text: 'He drew them to keep his rows tidy. They\nsnip whatever sticks out.' },
    { who: 'neve', text: "It's trimming the wood. And now it's\nmeasuring US." },
    { who: 'sable', text: "I'm exactly the right height.\nI am EXACTLY the right height!" },
  ],
  // camp, after Act 1: Rowan asks what "for a reason" meant; Pip keeps his promise (a seed)
  hushCamp: [
    { who: 'narrator', text: 'Night at camp. No wind in the fire. The\nflames stand straight up, like drawings.' },
    { who: 'rowan', text: 'Pip. On the plateau, you said you stayed\nfor a reason. What reason?' },
    { who: 'pip', text: 'Someone needed watching over. I promised\nto say no more than that. I keep promises.' },
    { who: 'rowan', text: 'Who?' },
    { who: 'pip', text: '...Go to sleep, Rowan.' },
  ],
  // Act 2 start: the first blank pocket; the scale of the sleepers; a moved river under the white (a seed)
  hush2: [
    { who: 'narrator', text: 'In the green, a patch of white: a village,\nblank, its people asleep mid-step.' },
    { who: 'rowan', text: 'A girl with a water jug. A man on a ladder.\nAll asleep. Pip, how many?' },
    { who: 'narrator', text: 'From the ridge they count the white patches.\nThey stop counting at forty.' },
    { who: 'pip', text: 'Look under the white. The old lines still\nshow. This river was moved once. Long ago.' },
    { who: 'rowan', text: 'Moved? By who? Who else draws?' },
    { who: 'pip', text: 'Nobody. Nobody should.' },
  ],
  // Act 2 mini-boss: a giant snail who followed his sea road from the continent, a month, for a lettuce
  slowcoach: [
    { who: 'narrator', text: 'Across the path lies a snail the size of a\ncart. Behind it grows a single lettuce.' },
    { who: 'slowcoach', text: '...Mine.' },
    { who: 'sable', text: "It's a snail. We can walk round it.\n...Why are we not walking round it?" },
    { who: 'pip', text: 'He crossed the whole sea on that road.\nIt took him a month. For one lettuce.' },
    { who: 'slowcoach', text: '...Very. ...Much. ...Mine.' },
  ],
  // Act 3 start: the Yew Grove; the Stopper in her branches; he is drawing more trees
  hush3: [
    { who: 'narrator', text: 'The Yew Grove. In a ring of new trees stands\nthe oldest yew on the isle.' },
    { who: 'pip', text: "In her branches: a stone jar. He's corked\nthe isle's wind in it. That's his line." },
    { who: 'neve', text: 'Then we uncork it. Loudly.' },
    { who: 'sable', text: "Someone's drawing more trees round the\nedge. With a feather." },
    { who: 'rowan', text: 'Ambrose.' },
  ],
  // Act 3 boss: he is no longer gentle, and he still never lies
  yew: [
    { who: 'mapmaker', text: 'Storms dropped trees on these roofs every\nautumn. Count the graves. Then speak of wind.' },
    { who: 'rowan', text: 'They called the spirits, and the spirits\nwarned them. You took that too.' },
    { who: 'mapmaker', text: 'I took the danger. The warning goes with it.\nMother? Keep the wood still.' },
    { who: 'narrator', text: 'The old yew draws her roots out of the earth,\nslow as a tide, and comes.' },
  ],
  // phase 2 (his first edit): everything grows faster (hint: the outline's growth idea)
  yew2: [
    { who: 'mapmaker', text: 'Hush.' },
    { who: 'narrator', text: 'His pen moves through the grove. Every\ngreen thing grows twice as fast.' },
    { who: 'neve', text: 'Hit them young! Once they turn to bark,\nthey take two.' },
  ],
  // phase 3 (his second edit): he lets a little wind out of the jar to knock Rowan down (hint: gusts)
  yew3: [
    { who: 'mapmaker', text: 'Just a breath, then.' },
    { who: 'narrator', text: "He lifts the cork a finger's width. The\nwind comes out of the jar all at once." },
    { who: 'pip', text: 'Everything blows one way now.\nRead the wind, Rowan.' },
  ],
  // victory: the wind; every leaf falls; birds; the villages wake; he goes on to the next isle
  hushVictory: [
    { who: 'narrator', text: 'The Stopper cracks. The wind pours out, and\nevery leaf the forest held falls at once.' },
    { who: 'narrator', text: 'Birds start up, all together. The white\npatches fill in, and the villages wake.' },
    { who: 'mapmaker', text: 'The next storm will drop a tree on a roof,\nand you will have let it.' },
    { who: 'rowan', text: "And they'll hear it coming.\nThey always did." },
    { who: 'narrator', text: 'He walks on along his road. Far out, the\nblank takes the shape of another isle.' },
  ],
};
