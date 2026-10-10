// The last two regions' KEY scenes, drafted ahead of their data (SPOILERS: the whole ending; docs/story-bible.md
// sections 6 and 7). NOT IN PLAY. Region 11 (Lowmoor): the opening, the Flood's intro and edits, and the beat after it
// (floodEnd, lowTruth, lowGoes, played back to back as the region's victory). Region 12 (the Margin): the Fair Knight's
// intro and the ending (marginEnd, epilogue, lastImage). From lowTruth on, his plate reads "Ambrose" (speaker
// `ambrose`: the Mapmaker's portrait under his own name; `portrait_ambrose` can alias `portrait_mapmaker`) and his
// composure breaks: contractions allowed. Same rules as story.ts (tests/unit/data.test.ts).

import type { StoryBox } from './types';

export const END_STORY: Record<string, StoryBox[]> = {
  // ---- Region 11, Lowmoor: he has drawn Wend over the moor, the morning before the flood
  low1: [
    { who: 'narrator', text: 'Lowmoor. Where the moor should be, there is\na valley, a river, and a village.' },
    { who: 'narrator', text: 'A mill. A bridge. Fences, every one mended.\nA lit window. Not one person.' },
    { who: 'rowan', text: "I know this bridge. ...I've never been\nhere. Have I?" },
    { who: 'narrator', text: 'Pip does not answer. He is looking at\nthe window.' },
    { who: 'sable', text: 'Whoever drew this loved it.\nEvery fence post.' },
  ],
  // the boss: the river itself, behind his levee
  flood: [
    { who: 'narrator', text: 'Above the village, behind a high new levee,\nthe river rises like a gray serpent.' },
    { who: 'mapmaker', text: 'This is Wend, knight, the morning before.\nThis time, the levee holds.' },
    { who: 'rowan', text: 'You drew it all back. All of it.\nExcept the people.' },
    { who: 'mapmaker', text: 'I draw him in that window every night.\nBy morning, he is gone. I do not know why.' },
    { who: 'narrator', text: 'The river strikes the levee, and comes.' },
  ],
  flood2: [
    { who: 'mapmaker', text: 'Higher.' },
    { who: 'narrator', text: 'He draws the levee higher.\nThe river rises to meet it.' },
    { who: 'neve', text: "Every time we gain, he draws it HIGHER.\nDon't slow down." },
  ],
  flood3: [
    { who: 'mapmaker', text: 'Higher.' },
    { who: 'narrator', text: 'His hand shakes. The ink runs.\nThe river does not stop.' },
    { who: 'pip', text: "Rowan. Don't let go. Not now." },
  ],
  // the beat, three scenes back to back (docs/story-bible.md section 6); the name comes last in lowTruth
  floodEnd: [
    { who: 'narrator', text: 'The levee gives. The river goes down to its\nbed, and is only a river again.' },
    { who: 'narrator', text: 'He turns his nib on Rowan, to rub him out.\nClose, this time. Then he stops.' },
    { who: 'mapmaker', text: 'This is not a line. It is a cut, through\nthe page. ...I know this hand. It is mine.' },
    { who: 'mapmaker', text: 'I pressed too hard. I could not see.\nI was crying.' },
    { who: 'mapmaker', text: 'You were six. You were soaked through.' },
    { who: 'rowan', text: 'Pip. Tell me. All of it.' },
  ],
  lowTruth: [
    { who: 'pip', text: 'The night after the funeral, he drew his boy\nback. I was on his shoulder. I saw you come.' },
    { who: 'pip', text: "Hesper broke his nib and sent him away.\nShe told him the drawing faded. It didn't." },
    { who: 'pip', text: "She took you to the knights' hall. I stayed\nto watch over you. That was the reason." },
    { who: 'rowan', text: "The blank can't hold me. Deep water. The way\nhe's looked at me, since the first night." },
    { who: 'ambrose', text: '...Rowan.' },
  ],
  lowGoes: [
    { who: 'ambrose', text: "That's why the window is empty every\nmorning. You were already here." },
    { who: 'ambrose', text: "You're alive. So the Fair Copy can never\nhold you. A cut can't be copied." },
    { who: 'ambrose', text: "Then I'll draw you in by hand.\nI'll get it right this time." },
    { who: 'rowan', text: "You did get it right. You just weren't\nthere to see it." },
    { who: 'narrator', text: 'He stops on the road, as if to answer.\nThen he goes on, toward the edge of the map.' },
  ],
  // ---- Region 12, the Margin: the Fair Knight, and the ending (docs/story-bible.md section 7)
  fairKnight: [
    { who: 'narrator', text: 'The Margin. At the very edge of the map,\na drawing table, and the Fair Copy on it.' },
    { who: 'narrator', text: "Before it stands a knight in white, flawless:\nRowan's face, with none of his doubt." },
    { who: 'ambrose', text: "I drew him the way you should have grown.\nNo fear of water. No cut." },
    { who: 'rowan', text: "Look at him. He's fading.\nHe's already fading." },
    { who: 'ambrose', text: "Then I'll draw faster." },
  ],
  marginEnd: [
    { who: 'narrator', text: 'The Fair Knight fades mid-stroke, like breath\non glass. Ambrose stands at his table.' },
    { who: 'narrator', text: 'One line would finish the Fair Copy.\nThe ink is on his nib.' },
    { who: 'narrator', text: 'Rowan does not fight him for the pen. He\nsits down beside the table, and waits.' },
    { who: 'ambrose', text: "...There's no lake in it. No flood.\nNo you." },
    { who: 'narrator', text: 'He puts the nib down. He holds the Fair\nCopy to the candle, and lets it burn.' },
  ],
  epilogue: [
    { who: 'narrator', text: "Every land's old lines come home. The\nisles wake. The blank is gone from the map." },
    { who: 'narrator', text: 'In the Atlas Hall, before all Meridian,\nthe High Keeper speaks.' },
    { who: 'keeper', text: 'A hundred years ago, the keepers moved the\nriver into Wend. I knew. I kept the line.' },
    { who: 'keeper', text: 'And I let a man believe his son was gone.\nI am sorry. To you both.' },
    { who: 'narrator', text: 'She draws one new line on the Atlas, the\nonly one everyone agrees to: a name.' },
    { who: 'narrator', text: 'On the lake, in small, careful letters:\nWend.' },
  ],
  lastImage: [
    { who: 'narrator', text: 'Ambrose lives by the lake now. He mends\nfences in Greenmarch, the slow way.' },
    { who: 'smith', text: "A mend should show, Ambrose. That's how\nyou know someone cared." },
    { who: 'narrator', text: 'At the water\'s edge, Rowan takes off his\nboots, and puts his feet in the lake.' },
    { who: 'ambrose', text: 'Cold?' },
    { who: 'rowan', text: "Yes. ...It's all right, though." },
    { who: 'narrator', text: 'Pip, on a branch above them, says nothing\nat all. The Atlas keeps its one cut.' },
  ],
};
