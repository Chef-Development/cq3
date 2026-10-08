// Camp banter (plain data, no logic): one-line quips Rowan, Pip and Sable trade by the fire. The camp home shows one
// now and then while it sits idle (src/engine/view/camp.ts), in a small speech bubble over whoever says it.
// Tone: cheeky and light, like the story scenes. `sable`: only once Sable has joined (their own lines always are).
// tests/unit/data.test.ts checks every line fits its bubble (two short lines at most).

export type BanterSpeaker = 'rowan' | 'pip' | 'sable';

export interface BanterLine {
  who: BanterSpeaker;
  text: string;
  /** Needs Sable at the camp (they're in it, or it's about them). */
  sable?: boolean;
}

export const BANTER: BanterLine[] = [
  { who: 'rowan', text: 'Still tired from the end of time.' },
  { who: 'rowan', text: "My armor squeaks. It's called charm." },
  { who: 'rowan', text: 'Pip, stop eating the trail rations.' },
  { who: 'rowan', text: 'One more act. Then a very long nap.' },
  { who: 'rowan', text: 'The boars know my name now. Rude.' },
  { who: 'rowan', text: 'Why does the fire hiss at me?' },
  { who: 'pip', text: "Hoo. I'm billing you for this fire." },
  { who: 'pip', text: "Owls don't sleep. We supervise." },
  { who: 'pip', text: 'Your snoring scared off a bear.' },
  { who: 'pip', text: 'Found a worm. Not sharing.' },
  { who: 'pip', text: 'Hoo. The stars are judging you.' },
  { who: 'pip', text: 'My consulting fee is due. Hoo.' },
  { who: 'pip', text: "I'd fly ahead, but union rules." },
  { who: 'sable', text: 'Counted the coins. Twice. For fun.' },
  { who: 'sable', text: 'Hands off my snacks, owl.' },
  { who: 'sable', text: 'Your bag has a lock? Cute.' },
  { who: 'sable', text: 'Owl. You blinked. I saw that.' },
  { who: 'sable', text: 'I only stole one spoon. Today.' },
  { who: 'pip', text: 'Hoo. Rowan, count the coins.', sable: true },
  { who: 'rowan', text: "Sable, that's my sword. Again.", sable: true },
];

/** Everyone who can talk by the fire once the new heroes are in: the heroes, Pip, and Mags at her forge. */
export type CampSpeaker =
  | BanterSpeaker | 'smith' | 'neve' | 'moss' | 'tam' | 'hollis' | 'vesper' | 'torva'
  // part6:A
  // part6:B
  // part6:C
  // part6:D
  | 'fizz' | 'brann'
  ;

/**
 * The new heroes' lines, and lines to or about them (content bible section 3). Like BANTER, but a line plays only
 * once its speaker and everyone in `with` are at the camp (a hero is there once they've joined: Neve through the
 * story, the others from hero chests). Mags speaks from her forge.
 */
export interface HeroBanterLine {
  who: CampSpeaker;
  text: string;
  /** Who else needs to be at the camp (the line is to them, or about them). */
  with?: CampSpeaker[];
}

export const HERO_BANTER: HeroBanterLine[] = [
  // Neve: prickly, proud, secretly delighted to have company
  { who: 'neve', text: 'Too warm. Scoot over anyway.' },
  { who: 'neve', text: "I'm not smiling. My face is just cold." },
  { who: 'neve', text: "Frost mages don't shiver. We sparkle." },
  { who: 'neve', text: 'Cards? Not that I care. Deal me in.' },
  { who: 'neve', text: 'Frozen for weeks. I am owed gossip.' },
  { who: 'neve', text: 'Sable. My crystal. Put it back.', with: ['sable'] },
  { who: 'neve', text: "Pip, you're warm. I'm leaning. Hush.", with: ['pip'] },
  { who: 'sable', text: 'Neve, freeze this lock? Asking.', with: ['neve'] },
  { who: 'rowan', text: 'Frozen boots again. Thanks, Neve.', with: ['neve'] },
  { who: 'pip', text: 'Hoo. Neve laughed. Then denied it.', with: ['neve'] },
  { who: 'smith', text: 'Neve. Stop frosting my FORGE.', with: ['neve'] },

  // Moss: a gentle, absent-minded grove keeper who talks to plants
  { who: 'moss', text: "This log is very old. We're chatting." },
  { who: 'moss', text: 'Shh. The grass is falling asleep.' },
  { who: 'moss', text: 'Wait. Did I water the grove?' },
  { who: 'moss', text: 'I named every tree here. Then forgot.' },
  { who: 'moss', text: "Hello, fire. Please don't eat me." },
  { who: 'moss', text: 'Pip, your nest wants lichen.', with: ['pip'] },
  { who: 'pip', text: 'Moss asked a rock about its day.', with: ['moss'] },
  { who: 'rowan', text: 'Moss said sorry to my boots. For me.', with: ['moss'] },
  { who: 'smith', text: 'Moss. My anvil is NOT tired.', with: ['moss'] },

  // Tam: an excitable sapper who loves loud things
  { who: 'tam', text: 'This fire needs more BOOM.' },
  { who: 'tam', text: 'Fuse? Lit. Keg? Ready. Plan? Er...' },
  { who: 'tam', text: 'Lost my eyebrows again. Worth it!' },
  { who: 'tam', text: 'Is that ringing? Oh. My ears.' },
  { who: 'tam', text: 'Loud is a feeling. And I feel GREAT!' },
  { who: 'tam', text: 'Torva! I blow it up, you smash the bits!', with: ['torva'] },
  { who: 'moss', text: 'Tam, the daisies flinch at bangs.', with: ['tam'] },
  { who: 'rowan', text: 'Tam, why is my tent smoking?', with: ['tam'] },
  { who: 'smith', text: 'Tam. No kegs near my forge. AGAIN.', with: ['tam'] },

  // Hollis: a calm, dry-humoured shieldwarden
  { who: 'hollis', text: 'Standing guard. Also, standing.' },
  { who: 'hollis', text: "I've blocked worse. Breakfast, mostly." },
  { who: 'hollis', text: 'This dent looks like a boar. Long story.' },
  { who: 'hollis', text: "Relax. Nothing's on fire. Yet." },
  { who: 'hollis', text: 'Tam asked to test a keg on me. Later.', with: ['tam'] },
  { who: 'hollis', text: "Rowan's snoring dented my shield.", with: ['rowan'] },
  { who: 'sable', text: 'Hollis, can I nap behind your shield?', with: ['hollis'] },
  { who: 'pip', text: 'Hollis is a fine perch. Very still.', with: ['hollis'] },
  { who: 'smith', text: 'Hollis. Your dents have dents.', with: ['hollis'] },

  // Vesper: an aloof ranger with a secret soft spot for owls
  { who: 'vesper', text: "I don't sit by fires. I watch." },
  { who: 'vesper', text: "The stars are fine. I've seen better." },
  { who: 'vesper', text: "I can split a hair. I'm bored." },
  { who: 'vesper', text: 'Friends? I have arrows.' },
  { who: 'vesper', text: 'The owl sat by me. A coincidence.', with: ['pip'] },
  { who: 'vesper', text: 'Pip, a crumb. Hold still. There.', with: ['pip'] },
  { who: 'vesper', text: 'Sable. Hands off my arrows. All of them.', with: ['sable'] },
  { who: 'pip', text: 'Hoo. Vesper keeps saving me berries.', with: ['vesper'] },
  { who: 'rowan', text: 'Vesper smiled! At Pip. Not at me.', with: ['vesper', 'pip'] },
  { who: 'sable', text: "Vesper's bow is silver. Just saying.", with: ['vesper'] },

  // Torva: a booming, cheerful brute who solves everything with a hammer
  { who: 'torva', text: 'HA! Lovely night! Anything to smash?' },
  { who: 'torva', text: "My hammer's name? Hammer! HA!" },
  { who: 'torva', text: 'Tired? Smash something! Works!' },
  { who: 'torva', text: 'Who wants a hug? Too late! HUG!' },
  { who: 'torva', text: 'Rowan! Arm wrestle? HA!', with: ['rowan'] },
  { who: 'torva', text: "MAGS! I hit a mountain! It's fine!", with: ['smith'] },
  { who: 'rowan', text: 'Torva hugged me. My armor folded.', with: ['torva'] },
  { who: 'sable', text: 'Torva, carry the loot? All of it?', with: ['torva'] },
  { who: 'smith', text: "Torva's hammer? Second best here.", with: ['torva'] },

  // ---- Part 6. Fizz: a wild, cheerful alchemist who brews by the fire (and blows things up, carefully-ish)
  { who: 'fizz', text: 'This fire is boring. One drop of red?' },
  { who: 'fizz', text: 'Do NOT drink the blue one. Trust me.' },
  { who: 'fizz', text: 'My eyebrows grow back. Mostly.' },
  { who: 'fizz', text: "It's not smoke. It's a breakthrough!" },
  { who: 'fizz', text: 'Mags! Can I borrow your hottest fire?', with: ['smith'] },
  { who: 'fizz', text: 'Tam! Your kegs and my flasks? BIG!', with: ['tam'] },
  { who: 'tam', text: 'Fizz gets it. Loud is a science!', with: ['fizz'] },
  { who: 'rowan', text: "Fizz made me tea. It's still fizzing.", with: ['fizz'] },
  { who: 'smith', text: 'Fizz. That flask ate my tongs.', with: ['fizz'] },

  // Brann: a calm, near-silent bell monk (his bell talks for him)
  { who: 'brann', text: '...' },
  { who: 'brann', text: 'Silence is a bell that waits.' },
  { who: 'brann', text: 'Breathe in. Block. Breathe out. Bonng.' },
  { who: 'brann', text: 'The fire is loud. I forgive it.' },
  { who: 'brann', text: 'Rowan. You nap well. A true master.', with: ['rowan'] },
  { who: 'brann', text: 'Hollis. We are both walls. Sit.', with: ['hollis'] },
  { who: 'pip', text: "Hoo. Brann's bell hums at me.", with: ['brann'] },
  { who: 'sable', text: 'Tried to ring the bell. It rang ME.', with: ['brann'] },
  { who: 'fizz', text: 'Brann, can I put a fuse on the bell?', with: ['brann'] },
];
