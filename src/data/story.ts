// Story scenes: a portrait and a text box, tap to advance, a Skip button. At most 6 boxes per scene and
// 2 lines per box (tests/unit/story.test.ts checks both, and that every line fits the box).
// Tone: cheeky and light.

import type { Speaker, StoryBox } from './types';
import { ASH_STORY } from './story-ash';

export const SPEAKER_NAME: Record<Speaker, string> = {
  narrator: '',
  rowan: 'Rowan',
  pip: 'Pip',
  captain: 'Bandit Captain',
  golem: 'Ruin Golem',
  boarking: 'Boar King',
  smith: 'Mags',
  sable: 'Sable',
  neve: 'Neve',
  moss: 'Moss',
  tam: 'Tam',
  hollis: 'Hollis',
  vesper: 'Vesper',
  torva: 'Torva',
  // part6:A
  // part6:B
  yara: 'Yara',
  dell: 'Dell',
  // part6:C
  // part6:D
  rimehorn: 'Rimehorn',
  matron: 'Loom Matron',
  glacia: 'Glacia',
  // Region 3 (src/data/story-ash.ts; not in play yet)
  rumbleback: 'Rumbleback',
  hobnob: 'Hob & Nob',
  bellows: 'Bellows',
};

export const STORY: Record<string, StoryBox[]> = {
  // the first visit to the camp's forge: Mags, a badger smith with a soot-black apron and a very large hammer
  smith: [
    { who: 'smith', text: "Oi! Mind the sparks. Name's Mags.\nI fix what knights break. So, everything." },
    { who: 'rowan', text: 'Is that... a badger? With a hammer?' },
    { who: 'smith', text: "Best hammer in Greenmarch. Bring me junk,\nI melt it into scrap." },
    { who: 'smith', text: 'Scrap and coin buy upgrades. Coin buys\na fresh roll on a gem. No refunds.' },
    { who: 'pip', text: 'She once forged a spoon so sharp\nit got banned. Twice.' },
    { who: 'smith', text: "Hand over that sword. It's bent.\nYou slept on it, didn't you?" },
  ],
  // after Act 1, at the camp: Sable tries to rob it, Pip catches them, and they join (unlocks Sable)
  sableJoin: [
    { who: 'narrator', text: 'Night at camp. Rowan snores by the fire.\nSomething creeps toward the bag tent.' },
    { who: 'sable', text: "Coins, coins... ooh, a shiny sword.\nDon't mind if I do." },
    { who: 'pip', text: "Hoo. Evening. That's Rowan's bag. Also,\nowls never sleep. It's a whole thing." },
    { who: 'sable', text: 'Caught by a bird. Embarrassing. Fine:\nSable. Thief. Ninja. Fast runner.' },
    { who: 'rowan', text: 'You nearly robbed a knight. Bold. We need\nbold. Want a job? Pay is... coins? Later?' },
    { who: 'sable', text: 'Two daggers, two hands, no questions.\nI keep half of anything shiny. Deal.' },
  ],
  // welcome back: a returning player opens this version for the first time (over the title, once; core/tips.ts
  // welcomeScene picks one): what's new since they last played. The last box depends on whether Sable has joined.
  welcomeBack: [
    { who: 'pip', text: "Hoo! Look who's back. While you napped,\nthings changed. I've been VERY busy." },
    { who: 'pip', text: 'Relics now bend the rules of a fight.\nPick one after a battle. Mix, match, cheat.' },
    { who: 'pip', text: "And you level up now! Spend skill points\nat the camp. Sable's there too. Hide the coins." },
  ],
  welcomeBackVisitor: [
    { who: 'pip', text: "Hoo! Look who's back. While you napped,\nthings changed. I've been VERY busy." },
    { who: 'pip', text: 'Relics now bend the rules of a fight.\nPick one after a battle. Mix, match, cheat.' },
    { who: 'pip', text: "And you level up now: skills at the camp.\nSomeone's been sneaking round it, too..." },
  ],
  welcomeBackSoon: [
    { who: 'pip', text: "Hoo! Look who's back. While you napped,\nthings changed. I've been VERY busy." },
    { who: 'pip', text: 'Relics now bend the rules of a fight.\nPick one after a battle. Mix, match, cheat.' },
    { who: 'pip', text: 'And you level up now: skills at the camp.\nClear Act 1 and we get a visitor. Shifty one.' },
  ],
  intro: [
    { who: 'narrator', text: 'The kingdom keeps time by the Great Pendulum.\nTick, tock. Very reliable.' },
    { who: 'narrator', text: 'Until one night it stopped. The Clockless King\nshattered it, and its 12 weights scattered.' },
    { who: 'narrator', text: 'The knight on watch that night was Rowan.\nRowan was asleep. Loudly.' },
    { who: 'rowan', text: 'In my defense, the Pendulum is VERY soothing.\nTick, tock. Tick... zzz.' },
    { who: 'narrator', text: 'So, as punishment, Rowan is sent to bring\nall twelve weights back.' },
    { who: 'rowan', text: 'Twelve weights. One junior knight. Fine.\nHow hard can it be?' },
  ],
  act1: [
    { who: 'pip', text: "Hoo! You're the knight who slept through\nthe end of time? Big fan." },
    { who: 'rowan', text: "An owl. Great. Shoo, I'm on a quest.\nNo pets allowed." },
    { who: 'pip', text: "I'm not a pet. I'm a consultant.\nMy first advice: duck." },
    { who: 'rowan', text: "Duck? Why would I duck? ...oh.\nThat's a slime, isn't it." },
    { who: 'pip', text: "First weight's out in Greenmarch. Follow the\nroad, hit what hits back. I'll bill you." },
  ],
  captain: [
    { who: 'captain', text: 'Step right up! Genuine pendulum pieces!\nCertified by me, a very honest man!' },
    { who: 'rowan', text: "That's a doorknob. Painted gold." },
    { who: 'captain', text: "It's a RARE doorknob. Pendulum grade.\nTwo hundred coins, or your boots." },
    { who: 'pip', text: "He sold me a 'magic' worm earlier.\nIt was just a worm." },
    { who: 'captain', text: "No refunds! Lads, let's show this tin can\nour returns policy!" },
  ],
  act2: [
    { who: 'pip', text: 'The Old Ruins. Watch your step, the floors\nhere are older than my jokes.' },
    { who: 'rowan', text: "Your jokes aren't that old." },
    { who: 'pip', text: "Correct. These floors are ancient.\nAnd the weight's trail leads inside." },
  ],
  golem: [
    { who: 'golem', text: 'HALT. NONE MAY PASS. BY ORDER\nOF KING ALDRIC THE THIRD.' },
    { who: 'rowan', text: 'King Aldric? He died 300 years ago.' },
    { who: 'golem', text: '...NOBODY TOLD ME. I HAVE BEEN STANDING\nHERE FOR A VERY LONG TIME.' },
    { who: 'pip', text: 'Awkward. Maybe let us through, and you can\nfinally take a break?' },
    { who: 'golem', text: 'A GOOD GUARD NEVER BREAKS. ALSO, MY KNEES\nARE STONE. PREPARE YOURSELF.' },
  ],
  act3: [
    { who: 'pip', text: "Smell that? Wet fur and ego. We're close\nto the Boar King's hollow." },
    { who: 'rowan', text: 'The first weight is in there.\nI can feel it ticking.' },
    { who: 'pip', text: "That's your knees knocking. Chin up, knight." },
  ],
  boarKing: [
    { who: 'boarking', text: 'WHO DARES ENTER THE HOLLOW\nOF THE BOAR KING? SNORT!' },
    { who: 'rowan', text: 'Hi. That thing on your head is a pendulum\nweight. I need it back.' },
    { who: 'boarking', text: 'It is a CROWN. It fell from the sky. A sign\nthat I am meant to rule. Everything.' },
    { who: 'pip', text: "It fell on your head, didn't it." },
    { who: 'boarking', text: '...IT WAS A GLORIOUS CORONATION.\nYOU WILL NOT HAVE IT!' },
  ],
  boarKing2: [
    { who: 'boarking', text: 'Grr! Not bad for a sleepy tin can.\nPIGLETS! Defend your king!' },
    { who: 'pip', text: 'Hit the piglets first. He hides behind them.\nClassic boss move.' },
  ],
  boarKing3: [
    { who: 'boarking', text: 'ENOUGH! THE CROWN STAYS ON MY HEAD!\nRAAAGH!' },
    { who: 'pip', text: "Uh oh. He's enraged: everything's faster.\nKeep your rhythm!" },
  ],
  victory: [
    { who: 'boarking', text: 'Fine! Take your shiny hat. It was giving me\nheadaches anyway.' },
    { who: 'narrator', text: 'Rowan carried the first weight home and set it\nback on the Great Pendulum...' },
    { who: 'narrator', text: '...and for the first time in weeks,\nthe Pendulum ticked. Once.' },
    { who: 'rowan', text: 'One down. Eleven to go. Can I nap first?' },
    { who: 'pip', text: 'No. Word is the next weight is up in the\nFrostpeaks. Pack a scarf, knight.' },
    { who: 'narrator', text: 'To be continued...' },
  ],

  // ---- Region 2 (docs/content-bible.md section 5): the second weight froze time on the peaks; a vain wyrm hoards it
  // Act 1 start: endless snow that hangs in the air, and every clock stuck at the same afternoon
  frost1: [
    { who: 'narrator', text: 'The Frostpeaks. Snow on the pines, snow on\nthe rocks... and snow just hanging in the air.' },
    { who: 'rowan', text: "Pip, the snow isn't falling. It's just\nfloating there. Is that a mountain thing?" },
    { who: 'pip', text: "Hoo. The second weight fell here and froze\ntime. It's been the same afternoon for weeks." },
    { who: 'sable', text: 'Every clock in the village says ten past\nthree. I checked. While borrowing them.' },
    { who: 'rowan', text: 'The same afternoon, forever? Like a nap\nthat never ends. Honestly? Jealous.' },
    { who: 'pip', text: 'Up the pass, then. Find the weight before\nyour nose freezes off. Scarf on, knight.' },
  ],
  // Act 1 mini-boss: a colossal ram who collects the toll (the toll is one headbutt)
  rimehorn: [
    { who: 'rimehorn', text: 'HALT! This is Frostbite Pass. Nobody\ncrosses without paying the TOLL.' },
    { who: 'rowan', text: "Fair enough. How much? Sable's got the\ncoins. Sable? ...Sable?" },
    { who: 'sable', text: "Coins? What coins? I've never seen a coin.\nStop looking at my pockets." },
    { who: 'rimehorn', text: 'COINS? Bah! The toll is ONE HEADBUTT.\nPer traveler. Owls fly free.' },
    { who: 'pip', text: "Finally, a discount. Good luck, knight.\nI'll be up here. Being free." },
    { who: 'rimehorn', text: "Hold still, little knight. It hurts less\nif you're already asleep." },
  ],
  // after the Act 1 mini-boss: the fight's shockwave cracks Neve out of her own frost spell, and she joins
  neveJoin: [
    { who: 'narrator', text: "Rimehorn's last stomp shook the whole pass.\nA big block of ice nearby went... crack." },
    { who: 'neve', text: 'Pfft! Snow up my nose. FINALLY! Who broke\nme out? ...You? The sleepy one? Ugh.' },
    { who: 'rowan', text: 'You were inside a block of ice. Is that\na mage thing? Or just a really bad day?' },
    { who: 'neve', text: 'Neve. Frost mage. I went to freeze the wyrm\nwho stole the weight. Her scales? MIRRORS.' },
    { who: 'pip', text: "Hoo. So it bounced, and froze you solid.\nThat's going in my memoirs. Chapter one." },
    { who: 'neve', text: "Fine, I'll come. You clearly need a real\nmage. Not for company. ...Do you play cards?" },
  ],
  // Act 2 start: into the caves; why the wyrm wants the weight
  frost2: [
    { who: 'neve', text: "The Glimmer Caves. Don't lick the icicles.\nI'm looking at you, knight." },
    { who: 'rowan', text: "So why does a wyrm want a pendulum weight?\nShe can't even tell the time with it." },
    { who: 'neve', text: "She STOPS time with it. No time, no spring.\nNo spring? Winter lasts forever." },
    { who: 'neve', text: 'And winter keeps her hoard cold and shiny.\nMelting is NOT glamorous, apparently.' },
    { who: 'sable', text: "Hold on. A whole hoard? Of shiny things?\nWhy is nobody running? Let's GO." },
    { who: 'pip', text: "Hoo. Time's frozen, so I've billed you for\nthe same hour for weeks. Lovely." },
  ],
  // Act 2 mini-boss: a giant frost spider who weaves tapestries of the hoard, offended you walked on one
  matron: [
    { who: 'matron', text: 'STOP. Little knight. Look down.\nWhat are you standing on?' },
    { who: 'rowan', text: "A rug? It's a nice rug. Very... sparkly." },
    { who: 'matron', text: "A TAPESTRY. 'The Hoard, Panel Ninety.'\nWoven in ice silk. And you wore BOOTS." },
    { who: 'neve', text: "The Loom Matron. She weaves pictures of the\nwyrm's treasure. The wyrm adores them." },
    { who: 'sable', text: 'Pictures of treasure? Why not weave a map\nto it? Asking for a friend. Me.' },
    { who: 'matron', text: "Philistines! I'll weave you into the next\npanel. Now hold very, very still..." },
  ],
  // Act 3 start: the glacier under the aurora, the hoard in sight
  frost3: [
    { who: 'narrator', text: "Wyrm's Glacier. Above, the aurora ripples\ngreen and pink. Below: one enormous hoard." },
    { who: 'rowan', text: 'Pretty sky. Does it do that every night?' },
    { who: 'neve', text: "It's done it all afternoon. For a month.\nTime's frozen, remember? Keep up, knight." },
    { who: 'sable', text: "Is that... a mountain of gold? Hold me.\nNo, don't. I need my hands free." },
    { who: 'pip', text: "Hoo. The weight's in there. So are the\nteeth. Big ones. Mind your fingers, Sable." },
    { who: 'neve', text: "She froze me once. Not again. This time\nI have a team. ...Don't make it weird." },
  ],
  // Act 3 boss
  glacia: [
    { who: 'glacia', text: 'Visitors! In MY glacier! Did you bring me\ngifts? Shiny ones? Kneel. Dazzle me.' },
    { who: 'rowan', text: "We came for the pendulum weight. The big\nround thing you're lying on." },
    { who: 'glacia', text: 'My centerpiece? It keeps the winter, darling.\nAnd winter keeps my hoard sparkling.' },
    { who: 'neve', text: "Remember me, Glacia? The mage you bounced\noff your scales? I'm BACK. And unfrozen." },
    { who: 'glacia', text: "The ice cube! You made such a cute ornament.\nI'll freeze you all into a matching set." },
    { who: 'pip', text: 'Hoo. Vain, rich and enormous. My three\nleast favorite things in a lizard.' },
  ],
  // phase 2: holds every 3rd yellow, a mirror in the middle of the bar
  glacia2: [
    { who: 'glacia', text: 'My SCALES! Scratched! I polish those every\nafternoon! And it is ALWAYS afternoon!' },
    { who: 'neve', text: "Her mirror's up! It bounces your cursor\nback. That's exactly how she got me." },
    { who: 'pip', text: "And she's hoarding blocks: hold the long\nones right to the end. Don't let go!" },
  ],
  // phase 3: the bar turns to sliding stripes of ice and snowdrift
  glacia3: [
    { who: 'glacia', text: "ENOUGH! If I can't have my winter, nobody\ngets ANYTHING! AVALANCHE!" },
    { who: 'pip', text: 'Ice speeds you up, snow slows you down,\nand it all slides. Re-time every block!' },
    { who: 'rowan', text: 'Fast, slow, fast. Like waking up from\na nap. I can do this. Probably.' },
  ],
  // victory: the weight home, two ticks, the snow falls down again; the next weight is in Ashfell
  frostVictory: [
    { who: 'glacia', text: 'My winter! My sparkle! Fine, take your ugly\nweight. It clashed with my gold anyway.' },
    { who: 'narrator', text: 'Rowan carried the second weight home and\nhung it on the Great Pendulum. It ticked...' },
    { who: 'narrator', text: '...TWICE. Up in the peaks, the snow fell DOWN\nat last. Every clock said eleven past three.' },
    { who: 'neve', text: "Falling snow! Ticking clocks! I'm coming\nwith you. For science. Not for you lot." },
    { who: 'rowan', text: 'Two down. Ten to go. NOW can I nap?' },
    { who: 'pip', text: "No. The next weight's down in Ashfell.\nSounds toasty. Swap the scarf for sunscreen." },
  ],

  // ---- hero arrivals: the first time each chest hero is revealed from a hero chest (content bible section 3)
  meetMoss: [
    { who: 'narrator', text: 'The chest creaks open. Out tumbles someone\nsmall and round, in a cloak of leaves.' },
    { who: 'moss', text: "Oh! Hello. I'm Moss. I keep a grove. Well,\nthe grove mostly keeps me. Have we met?" },
    { who: 'moss', text: "Your grass says you step on it all day.\nI'll tell it you're sorry. Are you sorry?" },
    { who: 'pip', text: 'Hoo. A gnome who talks to grass. Still\nbetter conversation than the knight.' },
  ],
  meetTam: [
    { who: 'narrator', text: 'The chest lid blows off with a BANG!\nA cloud of soot coughs out a grin.' },
    { who: 'tam', text: 'TA-DA! Tam, sapper! I blow things up!\nWalls! Rocks! Boredom! Mostly walls!' },
    { who: 'tam', text: 'Cute camp. Very quiet. I can fix that!\nAnyone mind if I light this?' },
    { who: 'rowan', text: 'YES. Everyone minds. Put the keg down.\nSlowly. ...Welcome to the team, Tam.' },
  ],
  meetHollis: [
    { who: 'narrator', text: 'A huge blue shield fills the chest. Behind it,\na very calm, very large man climbs out.' },
    { who: 'hollis', text: "Hollis. Shieldwarden. Things hit my shield\nand bounce off. It's a living." },
    { who: 'hollis', text: "Bit cramped in there. I've had worse.\nMostly other chests." },
    { who: 'pip', text: 'Hoo. Finally, someone big enough to hide\nbehind. I call the left side.' },
  ],
  meetVesper: [
    { who: 'narrator', text: 'A silver longbow rises from the chest,\nthen a hooded ranger in dusk purple.' },
    { who: 'vesper', text: "Vesper. Ranger. I hit what I aim at.\nI don't do small talk. Or hugs." },
    { who: 'vesper', text: "...Is that an owl? A little tufty one?\nAhem. Never mind. I didn't say that." },
    { who: 'pip', text: "Hoo. She likes me. They always do.\nIt's the ear tufts." },
  ],
  meetTorva: [
    { who: 'narrator', text: 'The chest groans, bulges, and bursts.\nA giant stone hammer comes out first.' },
    { who: 'torva', text: 'HA! TORVA! Hammer brute! What needs\nsmashing? Point me at it, friend!' },
    { who: 'rowan', text: 'Nothing needs smashing. Well. Not anymore.\nThat was a really nice chest.' },
    { who: 'torva', text: 'Problem? HAMMER. Locked door? HAMMER.\nFeeling sad? HAMMER HUG! Come here!' },
  ],
  // ---- Yara and Dell (Part 6): their first chest reveal
  meetYara: [
    { who: 'narrator', text: 'Starlight spills from the chest. A wolf\nmade of light pads out. Then a girl.' },
    { who: 'yara', text: "I'm Yara. I call spirits. This is Wolf.\nHe says you smell like boar. Sorry." },
    { who: 'yara', text: 'That is Tortoise. Never say turtle.\nShe holds a grudge for a hundred years.' },
    { who: 'pip', text: 'Hoo. The little lights keep landing on\nme. I am a fine owl, NOT a lamp.' },
  ],
  meetDell: [
    { who: 'narrator', text: 'A pebble pings off the lid from inside.\nThen a straw hat pokes out.' },
    { who: 'dell', text: "Howdy! I'm Dell. I scare crows off the\nfarm. With my slingshot. And rocks." },
    { who: 'pip', text: "Hoo. Hold on. Crows? I'm a bird, kid.\nWe have an understanding, yes?" },
    { who: 'dell', text: 'Course! Owls are pals. Owls are great.\n...Unless you eat my corn.' },
  ],
};

// the third region's scenes (src/data/story-ash.ts)
Object.assign(STORY, ASH_STORY);
