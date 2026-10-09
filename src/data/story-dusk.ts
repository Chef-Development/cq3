// Region 4's story scenes (SPOILERS: docs/story-bible.md section 8, mechanics in docs/content-bible.md section 7). Not
// merged into STORY yet: the region joins REGIONS with its art (then `Object.assign(STORY, DUSK_STORY)`). Same rules as
// story.ts: at most 6 boxes a scene, 2 lines a box, every line fits (tests/unit/duskmire-data.test.ts). The plot is
// earnest; the jokes belong to the heroes.
//
// Duskmire was Lanternfen: a fen of reed beds, stilt houses and lanterns, with a tide the fen-folk read from tables. A
// tipped lantern could burn a stilt row; a night tide could drown the careless. The Mapmaker's fix: he inked the sun
// into one lighthouse lamp, so light goes only where he points it and nobody needs a flame, and he penciled the shore in
// so the tide comes and goes on his timetable. The sky is stuck at dusk, and whatever he hasn't inked yet stays dark:
// you see only what your own light reaches (dark blocks, the tide). His keystone: the lamp with the sun shut in it, on
// the Gloaming Lighthouse, a lighthouse he drew wading in the mere (it doesn't speak; he speaks from its gallery).
// Here he first scrapes the continent itself for ink: a causeway village goes blank in front of Rowan.

import type { StoryBox } from './types';

export const DUSK_STORY: Record<string, StoryBox[]> = {
  // Act 1 start: a sky stuck at dusk; the sun is somewhere else; the water breathes in and out
  dusk1: [
    { who: 'narrator', text: 'Lanternfen. Reeds, black water, boardwalks\non stilts, and a sky stuck at dusk.' },
    { who: 'rowan', text: "It's been sunset for an hour. Pip, the sun\nhasn't moved at all." },
    { who: 'pip', text: "It can't. He drew the sun into one lamp, out\non the mere. Light goes where he points it." },
    { who: 'neve', text: "And everywhere he doesn't point it stays\ndark. Charming. Keep your lantern close." },
    { who: 'sable', text: "The water won't sit still. In, out, in, out.\nLike the whole fen is breathing." },
    { who: 'pip', text: 'He penciled the shore in. The tide keeps his\ntimetable now. Mind your boots.' },
  ],
  // Act 1 mini-boss: a toad the size of a hut, glowing with every lantern he swallowed
  bellybog: [
    { who: 'bellybog', text: 'Mmf. More lanterns? Free light, just\nlying around on poles. Gulp.' },
    { who: 'rowan', text: "Those are the fen-folk's lanterns. They're\nthe only light the fen has left." },
    { who: 'bellybog', text: "Then it's mine. Warm in here. Nobody's\nbeen warm out there for a month." },
    { who: 'pip', text: "He's swallowed half the fen's lanterns.\nYou can see them glow through his belly." },
    { who: 'bellybog', text: 'Yours looks tasty too, little knight.\nCome closer. Bring the light.' },
  ],
  // at the camp after Act 1 (like magsTale): the question Rowan can't answer, and Pip won't
  duskCamp: [
    { who: 'narrator', text: 'Night at camp, if it is night. The sky is\nthe same violet it was all day.' },
    { who: 'rowan', text: "Pip. Why can't he erase me? Everything else\ngoes white. I just... don't." },
    { who: 'pip', text: "...I don't know everything, Rowan." },
    { who: 'rowan', text: 'You know a lot about him, though. His pen.\nHow he thinks. Where he goes next.' },
    { who: 'pip', text: "I've watched him a long time. Sleep.\nThe tide keeps a timetable. It'll wait." },
    { who: 'narrator', text: 'Rowan sleeps. Pip does not. All night he\nwatches the lamp out on the mere.' },
  ],
  // Act 2 start: he erases a causeway village in front of them (he needs ink); Rowan walks into the blank
  dusk2: [
    { who: 'narrator', text: 'The Drowned Causeway. As they watch, the\nstilt houses at its end go white.' },
    { who: 'rowan', text: "He's rubbing it out. Right in front of us.\nPip, there are people in there." },
    { who: 'pip', text: 'He needs ink. Every line he draws is scraped\nfrom somewhere else. Now it comes from here.' },
    { who: 'narrator', text: 'Rowan walks into the blank. White boards,\nwhite water, and the villagers asleep.' },
    { who: 'rowan', text: "They're asleep where they stood. I'll come\nback for you. Every one of you." },
    { who: 'sable', text: 'Rowan. The water went white, and you\nwalked on it. Just... walked.' },
  ],
  // Act 2 mini-boss: a beaver engineer who runs the floodgates on the Mapmaker's timetable, and believes in it
  sluiceKeeper: [
    { who: 'sluiceKeeper', text: "You're late. The four-oh-five tide is due,\nand you are standing in it." },
    { who: 'rowan', text: 'You run the floodgates? For him?' },
    { who: 'sluiceKeeper', text: 'For everyone. Before the timetable, the tide\ncame when it liked. It took my brother.' },
    { who: 'sluiceKeeper', text: 'Now it comes on the minute. Nobody drowns.\nNobody is ever surprised. It is perfect.' },
    { who: 'pip', text: "He means it, Rowan. They all mean it.\nThat's what makes this hard." },
    { who: 'sluiceKeeper', text: "Four-oh-five. Gates open. Stand clear,\nor don't. The schedule won't wait." },
  ],
  // Act 3 start: the lighthouse wading in the mere; Rowan can't swim and doesn't know why
  dusk3: [
    { who: 'narrator', text: 'The Gloaming Mere. Out on the black water,\na lighthouse stands on stone legs.' },
    { who: 'pip', text: "The sun's in that lamp. He shut it in, so the\nlight goes only where he points it." },
    { who: 'rowan', text: "Then we go out to it. Over the water.\n...I can't swim. I never could." },
    { who: 'rowan', text: "I don't know why. Deep water, and my hands\njust stop. Since before I remember." },
    { who: 'neve', text: "Then you won't fall in. I'll freeze you a\npath. You're welcome in advance." },
    { who: 'sable', text: "Someone's up on the gallery.\nWith a pen." },
  ],
  // Act 3 boss: the Gloaming Lighthouse; he speaks from its gallery and defends the sum he did
  lighthouse: [
    { who: 'narrator', text: 'The lighthouse turns its beam on them. Its\ndoor opens like a mouth. On the gallery: him.' },
    { who: 'mapmaker', text: 'Forgive the dark. I have not inked the\nwhole fen yet. Good work takes time.' },
    { who: 'rowan', text: 'You erased a village on the causeway.\nThere were people in it.' },
    { who: 'mapmaker', text: 'One village, sleeping, to save a thousand\nhouses from fire. You would do the same sum.' },
    { who: 'rowan', text: "I wouldn't do the sum at all.\nThey're people." },
    { who: 'mapmaker', text: 'So were the ones who burned.' },
  ],
  // phase 2 (his first edit): the shoreline moves; water from both ends
  lighthouse2: [
    { who: 'mapmaker', text: 'The shoreline was in the wrong place.\nAllow me.' },
    { who: 'narrator', text: 'He redraws the shore around them. The water\ncomes in from both sides at once.' },
    { who: 'pip', text: "Mind the water, Rowan! What's under it is\nout of reach. Read the tide." },
  ],
  // phase 3 (his second edit): he rubs out the sky; only the light Rowan carries is left
  lighthouse3: [
    { who: 'mapmaker', text: 'And nobody needs a sky.' },
    { who: 'narrator', text: 'He rubs the sky out. The mere goes black,\nbut for the little light Rowan carries.' },
    { who: 'pip', text: "You've got your own light. Look where it\nfalls, and trust it." },
  ],
  // victory: the lamp cracks, the sun sets at last, night, lanterns, then morning; the cost, named; a seed
  duskVictory: [
    { who: 'narrator', text: 'The lamp cracks. The sun rolls out and sets\nat last, and true night falls on the fen.' },
    { who: 'narrator', text: 'One by one, the fen-folk light their lanterns.\nIn the morning, the sun comes up.' },
    { who: 'mapmaker', text: 'One of those will tip over by spring, and a\nrow of houses will burn. You know that.' },
    { who: 'rowan', text: "And the village you erased is waking up.\nThat's the only sum I need." },
    { who: 'narrator', text: 'An old fen-woman watches the lights. "The\nriver ran down from the north, once," she says.' },
    { who: 'pip', text: "He's gone east, to Noonspire. The sun there\nhasn't set in a month." },
  ],
};
