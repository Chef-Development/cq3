// Story scenes: a portrait and a text box, tap to advance, a Skip button. At most 6 boxes per scene and
// 2 lines per box (tests/unit/data.test.ts checks both, and that every line fits the box).
// The story (SPOILERS: docs/story-bible.md): the kingdom is a living map; whatever is drawn on the Great Atlas is real,
// and its exiled Mapmaker is redrawing it region by region. Tone: the plot is earnest (no gags, puns or winks); the
// comedy lives in the heroes' arrivals, the camp banter, Mags and the companions.

import type { Speaker, StoryBox } from './types';
import { ASH_STORY } from './story-ash';
import { DUSK_STORY } from './story-dusk';
import { NOON_ON } from './flags';
import { NOON_STORY } from './story-noon';
import { NOON_MINI_STORY } from './story-noon-minis';
import { PAGE_STORY } from './atlas-pages';

export const SPEAKER_NAME: Record<Speaker, string> = {
  narrator: '',
  rowan: 'Rowan',
  pip: 'Pip',
  mapmaker: 'The Mapmaker',
  keeper: 'Hesper',
  bellybog: 'Old Bellybog',
  sluiceKeeper: 'Sluice Keeper',
  sphinx: 'Noon Sphinx',
  hollowfang: 'Hollowfang',
  squall: 'Squall',
  press: 'The Press',
  gale: 'Gale',
  ambrose: 'Ambrose',
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
    { who: 'smith', text: 'Scrap and coin buy upgrades. Coin swaps\na bonus stat for a new one. No refunds.' },
    { who: 'pip', text: 'She once forged a spoon so sharp\nit got banned. Twice.' },
    { who: 'smith', text: "Hand over that sword. It's bent.\nYou slept on it, didn't you?" },
  ],
  // after Act 1, at the camp: Sable tries to rob it, Pip catches them, and they join (unlocks Sable). Sable's town
  // was one of his redraws: every alley drawn straight.
  sableJoin: [
    { who: 'narrator', text: 'Night at camp. Rowan sleeps at last.\nSomeone creeps toward the bags.' },
    { who: 'pip', text: 'Put it down. Owls see very well in the\ndark, and I bite.' },
    { who: 'sable', text: "Fine. I'm Sable, from Crookwell. Last night\nsomeone drew all my alleys straight." },
    { who: 'rowan', text: "We're after the man who did it. Come with\nus. We could use quick hands." },
  ],
  // welcome back: a returning player opens this version for the first time (over the title, once; core/tips.ts
  // welcomeScene picks one): the new story in two boxes (their save never replays the intro). The last box depends
  // on whether Sable has joined. (It replays only if data/tips.ts WELCOME_ID changes: see the story team's report.)
  welcomeBack: [
    { who: 'pip', text: "Hoo. You're back. A lot has changed while you\nwere away. Sit down, I'll catch you up." },
    { who: 'pip', text: 'The kingdom is a living map. The man redrawing\nit is the Mapmaker. Only you stayed awake.' },
    { who: 'pip', text: "Restore a land and his redraw breaks.\nSable's at camp. Counting our coins. Again." },
  ],
  welcomeBackVisitor: [
    { who: 'pip', text: "Hoo. You're back. A lot has changed while you\nwere away. Sit down, I'll catch you up." },
    { who: 'pip', text: 'The kingdom is a living map. The man redrawing\nit is the Mapmaker. Only you stayed awake.' },
    { who: 'pip', text: "Restore a land and his redraw breaks.\nAnd someone's been creeping round the camp..." },
  ],
  welcomeBackSoon: [
    { who: 'pip', text: "Hoo. You're back. A lot has changed while you\nwere away. Sit down, I'll catch you up." },
    { who: 'pip', text: 'The kingdom is a living map. The man redrawing\nit is the Mapmaker. Only you stayed awake.' },
    { who: 'pip', text: 'Restore a land and his redraw breaks.\nPast the Meadow Road, a visitor. Shifty one.' },
  ],
  // New game: at most 4 boxes before the first fight (this and act1). Who he is, and the Atlas, come later.
  intro: [
    { who: 'narrator', text: 'Whatever is drawn on the Great Atlas is real:\nevery road, river and hill in the kingdom.' },
    { who: 'narrator', text: 'Someone is redrawing it, land by land. Where\nhe rubs out a line, the land goes blank.' },
    { who: 'narrator', text: 'Last night he came to the Meadow Road, and\nall there fell asleep. All but one knight.' },
  ],
  // Act 1 starts: Pip arrives (and already knows Rowan's name)
  act1: [
    { who: 'pip', text: "Hoo. You're awake, Rowan. Good. On your feet:\nwhat he redrew is waking up, and it's angry." },
  ],
  // after a new player's first win (greenmarch.ts Act 1 `winScene`; run.ts plays it once per profile): what the blank is
  road: [
    { who: 'rowan', text: 'Who are you?\nAnd how do you know my name?' },
    { who: 'pip', text: 'Pip. I know a lot of names. Look: the\nfarmers are asleep where they stood.' },
    { who: 'pip', text: "Rubbed off the Great Atlas. What's erased,\nsleeps. And this road was crooked yesterday." },
    { who: 'rowan', text: 'Then we follow it. Someone has to stay\nawake for them.' },
  ],
  // Act 1 mini-boss: a bandit robbing the sleeping farms
  captain: [
    { who: 'captain', text: 'Well, well. A whole road asleep, and one\nknight left to guard it. Bad luck.' },
    { who: 'rowan', text: "Put back what you took. Those people can't\neven wake up to stop you." },
    { who: 'captain', text: "That's what makes it fair. Somebody redrew\nthe world last night. I'm just keeping up." },
    { who: 'captain', text: 'Lads! Up you get. This knight wants\nto be a hero.' },
  ],
  act2: [
    { who: 'narrator', text: 'The Old Ruins lay broken for three hundred\nyears. Now they have walls again.' },
    { who: 'sable', text: 'Fresh stone. Fresh mortar. Not a crack.\nWho builds a fortress overnight?' },
    { who: 'pip', text: 'Nobody built it. He drew it back the way it\nwas. Walls, towers, gate. The guard woke too.' },
    { who: 'rowan', text: 'His trail runs through here.\nStay close, both of you.' },
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
    { who: 'narrator', text: 'The deep wood. It was wild, and it belonged\nto no one. Now it has a king.' },
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
    { who: 'mapmaker', text: 'There. Better.' },
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
  // Act 1 mini-boss: a colossal ram who keeps travelers off the glass road for their own good
  rimehorn: [
    { who: 'rimehorn', text: 'STOP. Nobody crosses Frostbite Pass.\nThe road is glass now. Turn back.' },
    { who: 'rowan', text: 'We have to cross. Something up there holds\nthis whole mountain still.' },
    { who: 'rimehorn', text: 'The last ones who tried slid off the edge.\nI caught two. I could not catch the third.' },
    { who: 'pip', text: "He's guarding people from the road itself,\nRowan. Not the road from us." },
    { who: 'rimehorn', text: 'Then show me you can stand on it. Stand\nagainst me. If you fall, you go home.' },
  ],
  // after the Act 1 mini-boss: the fight's shockwave cracks Neve out of her own frost spell, and she joins
  neveJoin: [
    { who: 'narrator', text: "Rimehorn's last stomp shakes the whole pass.\nA block of ice beside the road cracks open." },
    { who: 'neve', text: "FINALLY. How long was I in there? Don't say.\nIt's always ten past three up here." },
    { who: 'rowan', text: 'You were frozen inside that ice.\nAre you all right?' },
    { who: 'neve', text: "Neve. Frost mage. The wyrm's mirror threw my\nspell back, and me ALL the way down here." },
    { who: 'pip', text: "Glacia's mirror. That's his line, Rowan.\nThat's what holds the mountain." },
    { who: 'neve', text: "Then I'm coming. You need a real mage.\nNot for the company. ...Do you play cards?" },
  ],
  // Act 2 start: into the caves; why the wyrm keeps the mirror
  frost2: [
    { who: 'neve', text: 'The Glimmer Caves. Mind the ice: he drew it\nto hold whatever touches it. Fingers too.' },
    { who: 'rowan', text: 'Why give the mirror to a wyrm?\nWhat does she get out of it?' },
    { who: 'neve', text: 'A winter that never ends. Cold keeps her\nhoard bright, and her scales. She adores it.' },
    { who: 'sable', text: 'A hoard. Of shiny things.\nWhy are we still standing here?' },
    { who: 'pip', text: 'He finds whoever will love his fix the most,\nand gives them the line to keep.' },
    { who: 'rowan', text: "So she won't give it up for asking." },
  ],
  // Act 2 mini-boss: a giant frost spider who weaves the frozen afternoon, and likes it that way
  matron: [
    { who: 'matron', text: 'Quiet, knight. Look down. You are standing\non my finest work.' },
    { who: 'rowan', text: 'A tapestry of one afternoon, over and over.\nThe same snow, the same clouds.' },
    { who: 'matron', text: 'Panel ninety. Nothing changes now, so at\nlast I can weave it exactly. Every flake.' },
    { who: 'neve', text: "The Loom Matron. She weaves for Glacia's\nhoard. She LIKES it like this." },
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
    { who: 'narrator', text: 'His pen moves. The ice grips whatever\ntouches it, and her scales turn to mirror.' },
    { who: 'neve', text: 'Her scales bounce your swing right back.\nAnd hold the long ones right to the end!' },
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
    { who: 'narrator', text: 'The chest creaks open. Out steps someone\nshort and weathered, in a cloak of leaves.' },
    { who: 'moss', text: "Oh. Hello. I'm Moss. I keep a grove. Well,\nthe grove mostly keeps me. Have we met?" },
    { who: 'moss', text: "Someone redrew my wild wood in tidy rows.\nThe trees don't know their neighbors now." },
    { who: 'pip', text: 'Hoo. A grove keeper who talks to trees.\nStill better conversation than the knight.' },
  ],
  meetTam: [
    { who: 'narrator', text: 'The chest lid blows off with a BANG.\nA cloud of soot coughs out a grin.' },
    { who: 'tam', text: 'Tam. Sapper. I blow things up. Walls,\nmostly. Rocks. Once, a wedding. By accident.' },
    { who: 'tam', text: 'I set off little avalanches so big ones never\ncome. Then the snow STOPPED. No snow, no job.' },
    { who: 'rowan', text: "We'll get your snow back. Until then, no kegs\nin camp. ...Welcome, Tam." },
  ],
  meetHollis: [
    { who: 'narrator', text: 'A huge blue shield fills the chest. Behind it,\na very calm, very large man climbs out.' },
    { who: 'hollis', text: "Hollis. Shieldwarden. Things hit my shield\nand bounce off. It's a living." },
    { who: 'hollis', text: 'I kept a sea wall, across the water. My island\nwent blank while I was ashore. So. Here I am.' },
    { who: 'pip', text: "Hoo. Then you'll stand with us. And I'll\nstand behind you. I call the left side." },
  ],
  meetVesper: [
    { who: 'narrator', text: 'A silver longbow rises from the chest,\nthen a hooded ranger in dusk purple.' },
    { who: 'vesper', text: "Vesper. Ranger. Someone stole my fen's\nnight. I hunt him. I don't do small talk." },
    { who: 'vesper', text: "...Is that a barred owl? Hm.\nNever mind. I didn't say anything." },
    { who: 'pip', text: 'Hoo. She likes me.\nThey always do.' },
  ],
  meetTorva: [
    { who: 'narrator', text: 'The chest groans, bulges, and bursts.\nA giant stone hammer comes out first.' },
    { who: 'torva', text: 'HA! Torva. My quarry keeps floating off\nbefore I can break it. What needs smashing?' },
    { who: 'rowan', text: 'Nothing needs smashing. Well. Not anymore.\nThat was a really nice chest.' },
    { who: 'torva', text: 'Problem? HAMMER. Locked door? HAMMER.\nBad day? I buy the drinks. THEN hammer.' },
  ],
  // ---- Solenne and Wren (Part 6): round 7's chest heroes
  meetSolenne: [
    { who: 'narrator', text: 'The chest glows gold, then hotter.\nSomehow, the sun comes up. Indoors.' },
    { who: 'solenne', text: 'Good morning. Solenne, Dawnblade. Sworn\nto greet the sunrise. Every single one.' },
    { who: 'rowan', text: "It's the middle of the night.\nAlso, you're very... bright." },
    { who: 'solenne', text: "Then I'm early. Back home our sun is stuck\nat noon. I have a lot of dawns to catch up on." },
  ],
  meetWren: [
    { who: 'narrator', text: 'The chest creaks open. Empty?\nA rope drops from the branch above.' },
    { who: 'wren', text: "Wren. I run roofs. Doors are slow.\nNice chest. Was it locked? It isn't now." },
    { who: 'pip', text: 'Hoo. She took my supper. Mid-sentence.\nWhile I was looking right at her.' },
    { who: 'wren', text: "Borrowed. My town's across the sea. Gone\nblank. I'm owed a few things. Point me at him." },
  ],
  // ---- Yara and Dell (Part 6): their first chest reveal
  meetYara: [
    { who: 'narrator', text: 'Starlight spills from the chest. A wolf\nmade of light pads out. Then a young woman.' },
    { who: 'yara', text: "I'm Yara. I call spirits. This is Wolf.\nHe says you smell like boar. Sorry." },
    { who: 'yara', text: 'That is Tortoise. Never say turtle.\nShe holds a grudge for a hundred years.' },
    { who: 'yara', text: 'My village is asleep across the sea.\nThe spirits say it will wake. I listen.' },
  ],
  meetDell: [
    { who: 'narrator', text: 'A pebble pings off the lid from inside.\nThen a straw hat pokes out.' },
    { who: 'dell', text: "Name's Dell. I keep crows off our farm. Only\nsomeone drew the farm dead square. Odd." },
    { who: 'pip', text: "Hoo. Hold on. Crows? I'm a bird, kid.\nWe have an understanding, yes?" },
    { who: 'dell', text: 'Course. Owls are welcome.\n...Until one eats my corn.' },
  ],
  // ---- Part 6: Fizz and Brann
  meetFizz: [
    { who: 'narrator', text: 'The chest hisses, fizzes and pops. Green\nsmoke pours out, then a scorched cap.' },
    { who: 'fizz', text: "Fizz. Alchemist. Don't touch the red one.\nOr the blue. The green one's fine. Mostly." },
    { who: 'pip', text: 'Hoo. She smells like a burnt kettle.\nI like her already.' },
    { who: 'fizz', text: "My lighthouse went blank, across the sea.\nWhere's the lab? ...This is the lab now." },
  ],
  meetBrann: [
    { who: 'narrator', text: 'A deep BONNG rolls out of the chest. A calm\nmonk climbs out, a huge bell on his back.' },
    { who: 'brann', text: '(writes on a slate) Brann. Bellwarden.\nI took a vow of silence. The bell did not.' },
    { who: 'narrator', text: 'His abbey sleeps across the sea. He will\nspeak when its bell rings again.' },
    { who: 'narrator', text: 'For now, he rings his own, very softly.\nIt is the loudest thing Rowan has ever heard.' },
  ],
};

// the third region's scenes (src/data/story-ash.ts)
Object.assign(STORY, ASH_STORY);
// the fourth region's scenes (src/data/story-dusk.ts)
Object.assign(STORY, DUSK_STORY);
// the fifth region's, once it is in play (a scene in STORY lets the camp's lines that wait for it show)
if (NOON_ON) Object.assign(STORY, NOON_STORY, NOON_MINI_STORY);
// the Atlas pages, one per act, read when found in a hidden treasure (src/data/atlas-pages.ts)
Object.assign(STORY, PAGE_STORY);

// ---- Gorm and Tess (Part 6): their first chest reveals
Object.assign(STORY, {
  meetGorm: [
    { who: 'narrator', text: "Two stone fists lift the chest's lid off,\nvery, very gently." },
    { who: 'gorm', text: "Mm. Sorry. I was napping. I'm Gorm.\nI punch rocks. Nicely." },
    { who: 'rowan', text: 'You were napping in a chest?\nHow did you even fit in there?' },
    { who: 'gorm', text: "I folded up small, like my stones back home.\nThey've gone blank. So. Who do I hit?" },
  ],
  meetTess: [
    { who: 'narrator', text: 'The chest ticks. Then it chimes. A small,\nsharp old woman climbs out, scowling.' },
    { who: 'tess', text: "You're four minutes late. I'm Tess.\nI fix clocks. And now and then, time." },
    { who: 'rowan', text: "Late? We didn't even know\nyou were in there." },
    { who: 'tess', text: 'Excuses. Every clock in my workshop, across\nthe sea, stopped at once. Someone owes me.' },
  ],
} satisfies Record<string, StoryBox[]>);
