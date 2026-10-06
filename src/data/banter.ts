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
