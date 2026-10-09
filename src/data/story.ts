// Story scenes: a portrait and a text box, tap to advance, a Skip button. At most 6 boxes per scene and
// 2 lines per box (tests/unit/data.test.ts checks both, and that every line fits the box).
// The story (SPOILERS: docs/story-bible.md): the kingdom is a living map; whatever is drawn on the Great Atlas is real,
// and its exiled Mapmaker is redrawing it region by region. Tone: the plot is earnest (no gags, puns or winks); the
// comedy lives in the heroes' arrivals, the camp banter, Mags and the companions.

import type { Speaker, StoryBox } from './types';
import { ASH_STORY } from './story-ash';

export const SPEAKER_NAME: Record<Speaker, string> = {
  narrator: '',
  rowan: 'Rowan',
  pip: 'Pip',
  mapmaker: 'The Mapmaker',
  keeper: 'Hesper',
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
  solenne: 'Solenne',
  wren: 'Wren',
  // part6:B
  yara: 'Yara',
  dell: 'Dell',
  // part6:C
  gorm: 'Gorm',
  tess: 'Tess',
  // part6:D
  fizz: 'Fizz',
  brann: 'Brann',
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
  // after Act 1, at the camp: Sable tries to rob it, Pip catches them, and they join (unlocks Sable). Sable's town
  // was one of his redraws: every alley drawn straight.
  sableJoin: [
    { who: 'narrator', text: 'Night at camp. Rowan sleeps at last.\nSomeone creeps toward the bags.' },
    { who: 'sable', text: "Coins, a map, a good sword. A lot of nice\nthings for one knight. He won't miss a few." },
    { who: 'pip', text: 'He will. Put it down. Owls see very well\nin the dark, and I bite.' },
    { who: 'sable', text: 'Fine. Sable, thief, of Crookwell. Last night\nsomeone drew all my alleys straight.' },
    { who: 'rowan', text: "We're after the man who did it. Help us put\nit back. We could use quick hands." },
    { who: 'sable', text: 'Give me my alleys back, and you get two\ndaggers. I keep anything shiny. Deal?' },
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
  // New game: at most 4 boxes before the first fight (this and act1). Who he is, and the Atlas, come later.
  intro: [
    { who: 'narrator', text: 'Whatever is drawn on the Great Atlas is real:\nevery road, river and hill in the kingdom.' },
    { who: 'narrator', text: 'Someone is redrawing it, land by land. Where\nhe rubs out a line, the land goes blank.' },
    { who: 'narrator', text: 'Last night he came to the Meadow Road. Only\none knight woke up. A voice: "Now that is odd."' },
  ],
  // Act 1 starts: Pip arrives (and already knows Rowan's name)
  act1: [
    { who: 'pip', text: "Hoo. You're awake, Rowan. Good. On your feet:\nwhat he redrew is waking up, and it's angry." },
  ],
  // after the first fight is won (needs a hook: the first fight node's win, before the map): what the blank is
  road: [
    { who: 'rowan', text: 'Thanks for the warning. Who are you?\nAnd how do you know my name?' },
    { who: 'pip', text: 'Pip. I know a lot of names. Look at the farms.\nThe farmers are asleep where they stood.' },
    { who: 'rowan', text: "Then let's wake them. Come on." },
    { who: 'pip', text: "We can't. Someone rubbed this land off the\nGreat Atlas. What's erased, sleeps." },
    { who: 'pip', text: 'And what he redraws wakes up wrong. This road\nwas crooked yesterday. Follow it.' },
    { who: 'rowan', text: 'Then we follow it. Someone has to stay\nawake for them.' },
  ],
  // Act 1 mini-boss: a bandit robbing the sleeping farms
  captain: [
    { who: 'captain', text: 'Well, well. A whole road asleep, and one\nknight left to guard it. Bad luck.' },
    { who: 'rowan', text: "Put it back. All of it. Those people can't\neven wake up to stop you." },
    { who: 'captain', text: "That's what makes it fair. Somebody redrew\nthe world last night. I'm just keeping up." },
    { who: 'pip', text: "The sleepers' things are in his cart, Rowan.\nDon't let him reach the crossroads." },
    { who: 'captain', text: 'Lads! Up you get. This knight wants\nto be a hero.' },
  ],
  act2: [
    { who: 'narrator', text: 'The Old Ruins lay broken for three hundred\nyears. This morning they have walls again.' },
    { who: 'sable', text: 'Fresh stone. Fresh mortar. Not a crack.\nWho builds a fortress overnight?' },
    { who: 'pip', text: 'Nobody built it. He drew it back the way it\nwas. Walls, towers, gate. And the guard.' },
    { who: 'rowan', text: 'Then his trail runs through here.\nStay close, both of you.' },
  ],
  // Act 2 mini-boss: the fortress's guardian, woken when its walls came back
  golem: [
    { who: 'golem', text: 'HALT. NONE MAY PASS. BY ORDER\nOF KING ALDRIC THE THIRD.' },
    { who: 'rowan', text: 'King Aldric died three hundred years ago.\nThere is no one left to guard.' },
    { who: 'golem', text: '...THREE HUNDRED. I SLEPT IN THE RUBBLE.\nTHEN THE WALLS CAME BACK, AND I WOKE.' },
    { who: 'golem', text: 'THE GATE IS WHOLE. SO I GUARD IT.\nMY LAST ORDER STANDS. NONE MAY PASS.' },
    { who: 'pip', text: "He doesn't know how to stop. Be gentle,\nRowan. He's doing what he was made for." },
  ],
  act3: [
    { who: 'narrator', text: 'The deep wood. Yesterday it was wild and\nbelonged to no one. Today it has a king.' },
    { who: 'pip', text: "Look at the trees. Cut back, set in rows,\na road to a throne. He's been tidying." },
    { who: 'sable', text: 'Boar tracks everywhere. Big ones. And they\nall head the same way.' },
    { who: 'rowan', text: 'To the hollow tree. Whatever he drew last\nis in there. Maybe he is, too.' },
    { who: 'pip', text: 'He will be. He never leaves a drawing\nunfinished. Rowan... be careful of him.' },
  ],
  // Act 3 boss: a boar the Mapmaker crowned; the crown is his redraw's keystone. He stays to watch (and edits).
  boarKing: [
    { who: 'boarking', text: 'KNEEL. I WAS A BOAR. NOW I AM A KING.\nTHE CROWN TOLD ME SO.' },
    { who: 'mapmaker', text: 'Forgive him. He is new to words. When I drew\nthat crown, he learned to speak.' },
    { who: 'rowan', text: "You're the one. You rubbed out the farms.\nThose people are asleep in the fields." },
    { who: 'mapmaker', text: 'Sleeping, not harmed. A wild wood needs a\nruler. I am only putting things in order.' },
    { who: 'mapmaker', text: 'You should be asleep with them. Odd.\nAnother time. Majesty? He is yours.' },
    { who: 'boarking', text: 'MINE! THE WOOD IS MINE! CHARGE!' },
  ],
  // phase 2 (his first edit): piglets join the fight
  boarKing2: [
    { who: 'mapmaker', text: 'Struggling, Majesty? A king needs\nsubjects. Allow me.' },
    { who: 'narrator', text: 'Gold lines run from his pen. He draws a door\nin the roots, and piglets pour out of it.' },
    { who: 'pip', text: 'The piglets first, Rowan.\nThe king hides behind them.' },
  ],
  // phase 3 (his second edit): everything faster
  boarKing3: [
    { who: 'mapmaker', text: 'Too slow. Let me quicken the line.' },
    { who: 'narrator', text: 'He redraws the pace of the wood. The king,\nthe wind, the light: everything runs faster.' },
    { who: 'pip', text: "Keep your own rhythm, Rowan.\nDon't chase his." },
  ],
  // victory: the keystone breaks and Greenmarch is restored; he tries to erase Rowan and can't; the High Keeper
  victory: [
    { who: 'narrator', text: 'The crown cracks in two. The gold lines fade\nfrom the wood, and the farms begin to wake.' },
    { who: 'mapmaker', text: 'I was too gentle with Greenmarch. I always\nwas. You, though. Hold still a moment.' },
    { who: 'narrator', text: 'He draws a line through Rowan to rub him\nout. The ink runs off him like rain.' },
    { who: 'mapmaker', text: 'Everything I erase sleeps. You will not even\nsmudge. Who drew you, knight?' },
    { who: 'narrator', text: 'And he is gone. At Meridian, in the Atlas\nHall, the High Keeper is waiting.' },
    { who: 'keeper', text: 'Ambrose Fairhand. He kept this Atlas once.\nHe cannot erase you. So it falls to you.' },
  ],

  // ---- Region 2 (story bible section 8): he drew the snow still and held the season, so no avalanche can come.
  // Keystone: the Winter Mirror, Glacia's centrepiece. Act 1 start: snow that hangs in the air.
  frost1: [
    { who: 'narrator', text: 'The Frostpeaks. Snow on the pines, snow on\nthe rocks, and snow hanging in the air.' },
    { who: 'rowan', text: "It isn't falling. It just stopped, mid-air.\nPip, is this him?" },
    { who: 'pip', text: "It is. Snow that never falls can never bury\nanyone. That's how he'd put it." },
    { who: 'sable', text: 'Every clock in the village says ten past\nthree. They have for weeks. I checked.' },
    { who: 'pip', text: 'He held the season too. No spring, so no\navalanches. No thaw, and no planting.' },
    { who: 'rowan', text: 'Like the crown in the Hollow. Something here\nholds it all. We find it, and we break it.' },
  ],
  // Act 1 mini-boss: a colossal ram who keeps travellers off the glass road for their own good
  rimehorn: [
    { who: 'rimehorn', text: 'STOP. Nobody crosses Frostbite Pass.\nThe road is glass now. Turn back.' },
    { who: 'rowan', text: 'We have to cross. Something up there holds\nthis whole mountain still.' },
    { who: 'rimehorn', text: 'The last ones who tried slid off the edge.\nI caught two. I could not catch the third.' },
    { who: 'pip', text: "He's guarding the pass from the road itself,\nRowan. Not from us." },
    { who: 'rimehorn', text: 'Then show me you can stand on it. Stand\nagainst me. If you fall, you go home.' },
  ],
  // after the Act 1 mini-boss: the fight's shockwave cracks Neve out of her own frost spell, and she joins
  neveJoin: [
    { who: 'narrator', text: "Rimehorn's last stomp shakes the whole pass.\nA block of ice beside the road cracks open." },
    { who: 'neve', text: "FINALLY. How long was I in there? Don't say.\nIt's always ten past three up here." },
    { who: 'rowan', text: 'You were frozen inside that ice.\nAre you all right?' },
    { who: 'neve', text: "Neve. Frost mage. I climbed up to break the\nwyrm's mirror. It threw my spell right back." },
    { who: 'pip', text: "Glacia's mirror. That's his line, Rowan.\nThat's what holds the mountain." },
    { who: 'neve', text: "Then I'm coming. You need a real mage.\nNot for the company. ...Do you play cards?" },
  ],
  // Act 2 start: into the caves; why the wyrm keeps the mirror
  frost2: [
    { who: 'neve', text: 'The Glimmer Caves. Mind the ice: he drew it\nto hold whatever touches it. Fingers too.' },
    { who: 'rowan', text: 'Why give the mirror to a wyrm?\nWhat does she get out of it?' },
    { who: 'neve', text: 'A winter that never ends. Cold keeps her\nhoard bright, and her scales. She adores it.' },
    { who: 'sable', text: "A hoard? Of shiny things?\nWhy is nobody running? Let's GO." },
    { who: 'pip', text: 'He finds whoever will love his fix the most,\nand gives them the line to keep.' },
    { who: 'rowan', text: "Then she won't give it up for asking." },
  ],
  // Act 2 mini-boss: a giant frost spider who weaves the frozen afternoon, and likes it that way
  matron: [
    { who: 'matron', text: 'Quiet, knight. Look down. You are standing\non my finest work.' },
    { who: 'rowan', text: 'A tapestry of one afternoon, over and over.\nThe same snow, the same clouds.' },
    { who: 'matron', text: 'Panel ninety. Nothing changes now, so at\nlast I can weave it exactly. Every flake.' },
    { who: 'neve', text: 'The Loom Matron. She weaves the hoard for\nGlacia. She LIKES it like this.' },
    { who: 'matron', text: 'Break that mirror and everything moves again.\nNo. Hold still. I will weave you in.' },
  ],
  // Act 3 start: the glacier under the aurora, the mirror in sight
  frost3: [
    { who: 'narrator', text: "Wyrm's Glacier, under the aurora. At its heart,\na great mirror and a great deal of gold." },
    { who: 'rowan', text: 'There. The whole mountain is in that mirror,\nstopped at ten past three.' },
    { who: 'neve', text: "She froze me once. Not again. This time\nI've got a team. ...Don't make it weird." },
    { who: 'sable', text: "Mirror first. Then that gold isn't going\nto carry itself." },
    { who: 'pip', text: "He'll be close. He always watches the\nbig ones. Stay together." },
  ],
  // Act 3 boss
  glacia: [
    { who: 'glacia', text: 'Visitors, in MY glacier. Come to admire me?\nEveryone does. The light is perfect.' },
    { who: 'rowan', text: 'We came for the mirror. The whole mountain\nis stuck in it.' },
    { who: 'glacia', text: "Stuck? Kept. It's always afternoon now,\ndarling. The light never fades. Nor do I." },
    { who: 'neve', text: "Remember me? The mage you bounced off\nyour scales? I'm back. And unfrozen." },
    { who: 'glacia', text: "The little ice cube! Such a pretty ornament.\nI'll freeze you all into a matching set." },
  ],
  // phase 2 (his edit): holds every 3rd yellow, a mirror in the middle of the bar
  glacia2: [
    { who: 'mapmaker', text: 'Forgive me, Glacia. Allow me to steady\nthings. Hold still, all of you.' },
    { who: 'narrator', text: 'His pen moves. Every third block sets into\nholding ice, and her scales turn to mirror.' },
    { who: 'neve', text: "Her mirror bounces your cursor back. And\nhold the long ones right to the end!" },
  ],
  // phase 3 (his edit): he draws the one thing he came to stop, an avalanche of ice and snowdrift
  glacia3: [
    { who: 'mapmaker', text: 'Enough. Just this once.' },
    { who: 'narrator', text: 'He draws the one thing he came here to stop.\nAn avalanche. Ice and snow pour down.' },
    { who: 'pip', text: 'Ice speeds you up, snow slows you down, and\nit all slides. Re-time every block, Rowan!' },
  ],
  // victory: the mirror cracks; the snow falls and the season turns; he names the cost; next, Ashfell
  frostVictory: [
    { who: 'narrator', text: 'The mirror cracks from edge to edge. The snow\nbegins to fall, the way snow should.' },
    { who: 'glacia', text: "My afternoon. My light. It's going.\nI will look so ordinary in the spring." },
    { who: 'mapmaker', text: 'Spring will bring its avalanche, knight.\nRemember who let it in.' },
    { who: 'neve', text: "They'll build the snow walls again. Like\nbefore. That's what people do." },
    { who: 'rowan', text: "And they'll have a spring to build them in.\nWhere did he go?" },
    { who: 'pip', text: 'East. Look at the smoke over Ashfell:\nit moves sideways. All of it, all at once.' },
  ],

  // ---- hero arrivals: the first time each chest hero is revealed from a hero chest (content bible section 3)
  meetMoss: [
    { who: 'narrator', text: 'The chest creaks open. Out tumbles someone\nsmall and round, in a cloak of leaves.' },
    { who: 'moss', text: "Oh! Hello. I'm Moss. I keep a grove. Well,\nthe grove mostly keeps me. Have we met?" },
    { who: 'moss', text: "Someone redrew my wild wood in tidy rows.\nThe trees don't know their neighbors now." },
    { who: 'pip', text: 'Hoo. A gnome who talks to trees. Still\nbetter conversation than the knight.' },
  ],
  meetTam: [
    { who: 'narrator', text: 'The chest lid blows off with a BANG!\nA cloud of soot coughs out a grin.' },
    { who: 'tam', text: 'TA-DA! Tam, sapper! I blow things up!\nWalls! Rocks! Boredom! Mostly walls!' },
    { who: 'tam', text: 'I set off little avalanches so big ones never\ncome. Then the snow STOPPED. No snow, no job!' },
    { who: 'rowan', text: "We'll get your snow back. Until then, no kegs\nin camp. ...Welcome to the team, Tam." },
  ],
  meetHollis: [
    { who: 'narrator', text: 'A huge blue shield fills the chest. Behind it,\na very calm, very large man climbs out.' },
    { who: 'hollis', text: "Hollis. Shieldwarden. Things hit my shield\nand bounce off. It's a living." },
    { who: 'hollis', text: 'I kept a sea wall, across the water. My island\nwent blank while I was ashore. So. Here I am.' },
    { who: 'pip', text: "Hoo. Then you'll stand with us. And I'll\nstand behind you. I call the left side." },
  ],
  meetVesper: [
    { who: 'narrator', text: 'A silver longbow rises from the chest,\nthen a hooded ranger in dusk purple.' },
    { who: 'vesper', text: "Vesper. Ranger. My fen went dark, so I hunt\nwhoever did it. I don't do small talk." },
    { who: 'vesper', text: "...Is that an owl? A little tufty one?\nAhem. Never mind. I didn't say that." },
    { who: 'pip', text: "Hoo. She likes me. They always do.\nIt's the ear tufts." },
  ],
  meetTorva: [
    { who: 'narrator', text: 'The chest groans, bulges, and bursts.\nA giant stone hammer comes out first.' },
    { who: 'torva', text: 'HA! TORVA! My quarry keeps floating off\nbefore I can smash it! What needs smashing?' },
    { who: 'rowan', text: 'Nothing needs smashing. Well. Not anymore.\nThat was a really nice chest.' },
    { who: 'torva', text: 'Problem? HAMMER. Locked door? HAMMER.\nFeeling sad? HAMMER HUG! Come here!' },
  ],
  // ---- Solenne and Wren (Part 6): round 7's chest heroes
  meetSolenne: [
    { who: 'narrator', text: 'The chest glows gold, then hotter.\nSomehow, the sun comes up. Indoors.' },
    { who: 'solenne', text: 'Good MORNING! Solenne, Dawnblade!\nSworn to the sunrise. Every single one.' },
    { who: 'rowan', text: "It's the middle of the night.\nAlso, you're very... bright." },
    { who: 'solenne', text: "Then I'm early! Back home our sun is stuck\nat noon. I have SO many dawns to catch up on." },
  ],
  meetWren: [
    { who: 'narrator', text: 'The chest creaks open. Empty?\nA rope drops from the branch above.' },
    { who: 'wren', text: "Wren. I run roofs. Doors are slow.\nNice chest. Was it locked? It isn't now." },
    { who: 'pip', text: 'Hoo! She took my snack.\nMid-sentence! While I was LOOKING!' },
    { who: 'wren', text: "Borrowed. My town's across the sea, in the\nfog. I'm owed a few things. Point me at him." },
  ],
  // ---- Yara and Dell (Part 6): their first chest reveal
  meetYara: [
    { who: 'narrator', text: 'Starlight spills from the chest. A wolf\nmade of light pads out. Then a girl.' },
    { who: 'yara', text: "I'm Yara. I call spirits. This is Wolf.\nHe says you smell like boar. Sorry." },
    { who: 'yara', text: 'That is Tortoise. Never say turtle.\nShe holds a grudge for a hundred years.' },
    { who: 'yara', text: "My village sleeps across the sea, in the fog.\nThe spirits say it's only sleeping. I listen." },
  ],
  meetDell: [
    { who: 'narrator', text: 'A pebble pings off the lid from inside.\nThen a straw hat pokes out.' },
    { who: 'dell', text: "Howdy! I'm Dell. I scare crows off our farm.\nOnly somebody drew the farm all square. Weird." },
    { who: 'pip', text: "Hoo. Hold on. Crows? I'm a bird, kid.\nWe have an understanding, yes?" },
    { who: 'dell', text: 'Course! Owls are pals. Owls are great.\n...Unless you eat my corn.' },
  ],
  // ---- Part 6: Fizz and Brann
  meetFizz: [
    { who: 'narrator', text: 'The chest hisses, fizzes and pops. Green\nsmoke pours out, then a scorched cap.' },
    { who: 'fizz', text: "Fizz! Alchemist! Don't touch the red one.\nOr the blue one. The green one's fine. Ish." },
    { who: 'pip', text: 'Hoo. She smells like a burnt kettle.\nI like her already.' },
    { who: 'fizz', text: "My lighthouse is across the sea, in the fog.\nWhere's the lab? ...This is the lab now." },
  ],
  meetBrann: [
    { who: 'narrator', text: 'A deep BONNNG rolls out of the chest. A calm\nmonk climbs out, a huge bell on his back.' },
    { who: 'brann', text: 'Brann. Bellwarden. I took a vow of silence.\nThe bell did not.' },
    { who: 'narrator', text: 'His abbey sleeps across the sea. He will\nspeak when its bell rings again.' },
    { who: 'narrator', text: 'For now, he rings his own, very softly.\nIt is the loudest thing Rowan has ever heard.' },
  ],
};

// the third region's scenes (src/data/story-ash.ts)
Object.assign(STORY, ASH_STORY);

// ---- Gorm and Tess (Part 6): their first chest reveals
Object.assign(STORY, {
  meetGorm: [
    { who: 'narrator', text: 'The chest creaks open. Two stone fists\nlift the lid off, very, very gently.' },
    { who: 'gorm', text: "Oh. Hello. Sorry, I was napping.\nI'm Gorm. I punch rocks. Nicely." },
    { who: 'rowan', text: 'You were napping in a CHEST?\nHow did you even fit in there?' },
    { who: 'gorm', text: "I folded up small, like my stones back home.\nThey're in the fog now. Who needs squashing?" },
  ],
  meetTess: [
    { who: 'narrator', text: 'The chest ticks. Then it chimes.\nA tiny old lady climbs out, scowling.' },
    { who: 'tess', text: "You're four minutes late. I'm Tess.\nI fix clocks. And now and then, time." },
    { who: 'rowan', text: "Late? We didn't even know\nyou were in there." },
    { who: 'tess', text: 'Excuses. Every clock in my workshop, across\nthe sea, stopped at once. Someone owes me.' },
  ],
} satisfies Record<string, StoryBox[]>);
