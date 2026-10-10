# Story bible (SPOILERS: the whole plot, every twist, the ending)

This is the story's single source. It replaces the old "Great Pendulum / twelve weights" story completely. Region
mechanics live in `docs/content-bible.md`; this file says *why* each region plays the way it does. Keep twists out of
commit titles, PR titles, the Test lab's labels and anything the playtester reads first.

---

## 0. Rules for writers

- **The main plot is earnest.** No gags, puns or fourth-wall winks in story scenes about the plot (the intro, region
  scenes, boss scenes, victories). Real stakes, real twists, characters who mean what they say. Wit is fine when it's
  in character and true to the moment; a joke for its own sake is not.
- **The comedy lives in the heroes.** Camp banter, hero arrivals (`meet*` scenes), companions' bios, Mags at her
  forge: that's where the charm and the jokes go (as in the old game). A hero can be funny inside a plot scene the way
  a person is funny at a funeral: once, and in character.
- **Boxes:** at most 6 per scene, 2 lines per box, every line fits the box (`tests/unit/data.test.ts`). Short words,
  short sentences. Read every line aloud.
- **New game to first fight: at most 4 boxes.** Setup comes later, between fights.
- **His refrain.** After an edit the Mapmaker says some form of "There. Better." Players should learn to dread it.
  Use it sparingly (once per region at most) so it stays sharp.
- **Never name a later region** in a scene, bio or banter line that can play before that region is reached.
- **Directions on the world map:** Greenmarch south-west, the Frostpeaks north, Ashfell's volcano north-east, the fen
  south-east below the heartland, the sun plateau east; the far isles lie past the east coast.

### Voices (for writers and the editor pass)
| Who | Voice | Never |
|---|---|---|
| Narrator | plain, concrete, present tense in scenes; one image per box | jokes, UI words ("bar", "tap") |
| Rowan | plain and warm; short sentences; asks real questions; says "we"; steady under pressure | sarcasm about the quest, speeches |
| Pip (plot) | dry, warm, brief; knows too much and lets it show a little; contractions; "Hoo." at most once a scene | bits, billing jokes (those are banter) |
| The Mapmaker | gentle, courteous, precise; **no contractions** (until Region 11, when his composure breaks); craftsman's words (line, draft, smudge); compliments; "There. Better." rarely | shouting (until Region 11), threats, lies |
| Hesper | terse, formal, few kind words; no contractions | explaining herself (until the end) |
| Sable | quick, light-fingered, practical; one quip per scene | cruelty |
| Brann | (vow of silence until his abbey's bell rings, Region 9) writes on a slate: `(writes on a slate)` in his arrival, `(writes)` in banter; calm, kind, few words | speaking aloud before Region 9 |
| Neve | prickly, proud, CAPITALS for emphasis, secretly glad of company | admitting it |
| Mags | gruff, warm underneath, forge talk | (she can joke: she's camp) |
| Bosses | each their own: the Boar King and the golem shout in capitals; Rimehorn and the golem speak without contractions; Glacia says "darling"; Bellybog is slow and greedy ("Mmf."); the Sluice Keeper talks in timetables; the Noon Sphinx speaks in riddles, formal and sad | winking at the player |

---

## 1. The premise in one paragraph

The kingdom is a living map. Every road, river, hill and season in it is drawn on the **Great Atlas**, a vast sheet of
vellum in the Atlas Hall at the capital, **Meridian**, and whatever is drawn there is real. For centuries its keepers
have sworn only to keep its lines, never to make new ones. Fifteen years ago one of them broke that oath and was exiled
to the edge of the map. Now he is back, with a pen of his own, and he is redrawing the kingdom his way: one region at a
time, each one "fixed". He is **Ambrose Fairhand, the Mapmaker**: courteous, brilliant, kind to everyone he meets, and
certain he is mending a careless, unfair world. Where he draws, the rules of the land change, which is why every region
fights differently, and why his edits change boss fights halfway through. Where he scrapes a line off to get ink, the
land goes blank: that is the fog on the world map, **erased land**, and everything in it sleeps. One junior knight,
**Rowan**, stays awake in the blank. Rowan is the one thing on the map the Mapmaker cannot erase, and neither of them
knows why.

---

## 2. The Great Atlas: how drawing works

The rules below are the whole system. Every scene should be consistent with them; no scene needs to explain more than
one at a time.

1. **Drawn is real.** The Atlas holds the land: ground, water, roads, buildings, weather, seasons, and the land's
   rules (how snow falls, how fire spreads, when the tide turns). Change the drawing and the land changes to match.
2. **Never the living.** People and creatures are born, not drawn. That is the oldest law of the Atlas. (Ambrose
   broke it once. See section 6.) He can draw things *for* a creature (a crown, a mirror, an anvil) and the creature
   changes around the gift, but he cannot draw a creature into being.
3. **The Silver Nib.** Only the keepers' pen marks the Atlas. When Ambrose was exiled his nib was broken. On the Margin
   he cut a new one from a feather Pip dropped the day he left (see Pip). With it he can draw on the land itself,
   in the air, wherever he stands; the Atlas in Meridian records his lines as they appear. On screen: glowing ink
   strokes hanging in the air, a pen that is clearly an owl's feather.
4. **Ink is never new.** The only ink that marks the Atlas is the Atlas's own. To draw anything, Ambrose must scrape
   the same amount off somewhere else. Every fix is paid for by an erasure.
5. **Erased is not destroyed.** Scraped land goes blank (the fog). Everything on it sleeps, unchanged, like a flower
   pressed in a book. The vellum keeps the dent of every line ever pressed into it: the **impression**.
6. **Redrawn land obeys the newest line.** Its people wake into the new rules. They notice the change; they cannot
   undo it.
7. **Keystones.** A redraw holds on one strong line, drawn hardest, and Ambrose always puts it in the keeping of the
   strongest creature in the region, as a gift: the Boar King's crown, Glacia's mirror, Bellows's anvil. That
   creature is the region's boss. Break the keystone and the new ink lets go: it runs back to the lines it was scraped
   from (the land it came from wakes), and the impression pulls the redrawn land back to its old lines. That is what
   **restoring a region** means. (Greenmarch: he scraped the Meadow Road's farms to draw the straight road, the
   fortress and the crown; the farmers sleep in blank fields until the crown breaks.)
8. **Edits mid-fight.** When a keystone is threatened, Ambrose arrives in person and redraws the fight around it.
   Every boss phase is one of his edits (one per phase). He is not the boss; he is the hand behind it.
9. **He works inward.** First the far isles, scraped bare out of sight; then, over the weeks before the story, the
   continent's outer lands (the plateau, the fen, the volcano, the mountains); Greenmarch last, on the night of the
   intro, and lightly, because it was his home (a seed for section 6). So every land Rowan reaches has been redrawn
   for a while (the clocks stopped "weeks ago"), and a hero from any land can turn up at camp from the start. Each
   restoration sends Ambrose to the next land to defend it, and he is waiting there.
10. **The fog beyond the sea.** Before the game begins he scraped the seven isles beyond the sea bare for ink: that is
   the blank in the far sea. As Rowan restores the continent, Ambrose falls back to the isles and begins drawing his
   new world on the blank. A far isle's fog **thins** when he starts drawing there and **lifts** when his draft is
   done (the world plan's `thin` / `lift`). Restoring an isle wakes the sleepers under it.
11. **Rowan.** The blank does not put Rowan to sleep, and ink slides off him. Why: section 6.

**Words to use:** draw, line, redraw, erase, the blank, ink, the Atlas, the impression, a keystone, restore.
**Words to avoid in story text:** magic, spell (for the Atlas; Neve's spells are her own), reality, simulation.

---

## 3. Places

- **Meridian**, the capital, in the heart of Greenmarch: a walled town round the **Atlas Hall**, a domed hall whose
  floor is the Great Atlas under glass. The keepers work on galleries above it. (World map: the capital landmark,
  replacing the Pendulum tower; see section 9.)
- **The lake under the falls**, just outside Meridian (already on the world map). Quiet, deep, very still. It was a
  valley once, with a village called **Wend** in it. No map shows Wend now. (Section 6.)
- **The continent:** five lands, Regions 1-5.
- **The far sea:** seven isles, Regions 6-12, erased before the story starts. The last and farthest is **the
  Margin**, at the very edge of the vellum, where Ambrose was exiled.

---

## 4. Cast

### Ambrose Fairhand, the Mapmaker (speaker `mapmaker`, plate "The Mapmaker"; "Ambrose" from Region 11 on)
- **Look:** a tall, spare man near fifty, kind tired eyes, ink-stained fingers, silver-shot dark hair tied back, a
  long coat of faded keeper's blue with its badge torn off, a satchel of rolled maps, spectacles pushed up. His pen is a
  barred owl feather with a silver tip. When he draws, his lines glow gold and hang in the air before they sink in.
- **History:** born in Wend, a river village in the valley outside Meridian. A gifted draughtsman, taken into the Atlas
  Hall young, the finest hand in a century and the youngest keeper ever sworn. He married, had a son (also named
  **Rowan**; the name is only revealed late), and kept the lines faithfully for ten years.
- **The flood (fifteen years ago):** a spring flood was coming down the valley. Ambrose begged the High Keeper, Hesper,
  to let him draw a levee above Wend. She refused: *keep the line, never make it.* Wend drowned. The valley became the
  lake. His wife survived; his son did not. (His wife died some years later, in his exile. He mentions her once.)
- **Why he was exiled:** the public story is that he "tried to redraw the kingdom". The truth: on the night after the
  funeral he drew his son back onto the Atlas. That is the oldest law broken. Hesper caught him at it, broke his nib,
  and sent him to the Margin. She told him the drawing had faded by morning.
- **Motive:** he believes the world is a draft drawn by careless hands, and that every grief in it is a line in the
  wrong place: a road that gets travellers lost, a snow that buries a village, a tide that drowns a child. He is not
  conquering. He is *fixing*. His goal is the **Fair Copy**: the whole kingdom redrawn clean on a fresh sheet, where no
  flood ever comes, and then the old Atlas burned. He does not think of erased land as harmed: "They are only
  sleeping. They will wake somewhere better."
- **His flaw:** every fix removes a danger by removing a living rhythm (falling snow, turning seasons, night, tides,
  change itself). His world is safe because nothing in it moves. He can't see it, because the one thing he wants is
  for one moment, fifteen years ago, to have never moved on.
- **Voice:** gentle, precise, unhurried; a teacher's patience. Mapmaker's words: line, draft, smudge, margin, a
  steady hand, a fair copy. He compliments his enemies and means it. Never shouts (until Region 11). Polite to a fault:
  "Forgive me." "If you would step aside." "There. Better."
  - "A crooked road gets people lost. I have straightened it. You are welcome."
  - "Forgive the interruption. Your fight was drawn badly. Let me fix it."
  - "Nobody is hurt. They are sleeping. When they wake, the world will be kind."
  - "I have erased mountains, knight. Why will you not come off the page?"

### High Keeper Hesper (speaker `keeper`, plate "Hesper")
- The keeper of the Great Atlas for thirty years; Ambrose's teacher. Silver-haired, upright, grey keeper's blue, a
  heavy key on a chain. Speaks plainly and briefly; few kind words, all of them meant.
- She sends Rowan out (after Region 1) because she knows he alone can walk in the blank. She knows why, and she keeps
  it to herself.
- **Her secret (twist 2):** the keepers have redrawn the Atlas before, quietly, for the capital's sake. A hundred years
  ago a keeper turned the river away from Meridian, into Wend's valley; that is why Wend flooded at all. Hesper knew
  when she refused the levee. She kept the oath for Wend because breaking it would have shown the old edit.
- **Her lie:** the drawn boy did not fade. She took him to the knights' hall and let them raise him as a foundling.
  She has watched Rowan grow up for fifteen years.
- **Her end:** she confesses, in public, and asks Rowan to decide what to tell Ambrose. She draws one last line on the
  Atlas, the only new line in the whole story that everyone agrees to: Wend's name, on the lake.

### Rowan, Junior Knight (the starter)
- A junior knight of the Meridian guard, twenty-one. A foundling: found at six, fifteen years ago, on the Atlas Hall steps, soaked
  through, with no memory before that night except his own name. (Mapmakers label what they draw: Ambrose wrote the
  name beside the drawing. It's the one thing the boy knew.) Raised in the knights' hall. Kind, earnest, a little unsure of himself,
  brave when it counts. Hates deep water and doesn't know why. (In banter he still naps anywhere: that's his comedy.)
- **The mystery:** in the intro the blank rolls over him and he stays awake; Ambrose tries to erase him and the ink
  slides off. Ambrose asks "Who drew you?" at the end of Region 1, and again now and then (never every region: it
  should stay sharp). Rowan has no answer.
- **The payoff (twist 3):** Rowan is the boy Ambrose drew back. The night after the funeral Ambrose drew his son with a
  shaking hand, pressing so hard the nib went through the vellum. Rowan is not a line on the Atlas: he is a **cut** in
  it. You can scrape ink off a page. You can't scrape off a hole. And a living thing can't be drawn twice, which is
  why every portrait of his son that Ambrose has drawn since has faded by morning: his son already lives.
- **Voice:** plain and warm; short sentences; asks real questions; says "we" more than "I". Never sarcastic about the
  quest. Under pressure: steady. "Then I'll stay awake for them."

### Pip (companion and guide)
- The owl. In plot scenes Pip is the guide who knows too much about the Atlas: dry, warm, brief, fond of Rowan, never
  doing bits. In banter and companion text Pip keeps his comic persona (the consultant who bills by the hoot).
- **His secret (twist 1):** Pip was Ambrose's owl, the Atlas Hall's owl. Pip sat on Ambrose's shoulder the night he
  drew the boy, and saw what came through the page. When Ambrose was exiled Pip stayed, for the boy, and has haunted the
  knights' hall rafters ever since. He "meets" Rowan in Act 1 as if for the first time. Ambrose's pen is one of Pip's
  feathers.
- Pip knows *that* Rowan was drawn; he promised Hesper he would never tell. He tells half the truth at the end of
  Region 5 and the rest only when Rowan asks him straight, in Region 11.

### Mags (the camp's smith)
- A badger smith, gruff and funny (comedy stays). Apprentice to Bellows of Ashfell (Region 3). She is the camp's
  constant: the person who fixes things the slow way, with her hands. Late, she is the one who tells Ambrose that a
  thing mended by hand still shows the mend, and that's the point.

### The companions
- Creatures that wandered out of redrawn or erased lands and adopted the camp. They are pure charm and comedy: their
  bios stay jokes. Homes, for flavour only (never in plot scenes): Bun and Burr (Greenmarch hedges), Flurry
  (Frostpeaks), Newt and Sunny (Ashfell), Gloam (the fen), Lark (the plateau of the sun), Brick (a moor of standing
  stones), Sprocket (a makers' town), Nimbus (the sky over the far isles), Mote (fell out of the sky; nobody knows
  from where, and Mote isn't telling).

### The heroes: every one is someone whose home he redrew
Hero arrivals (`meet*`) stay funny and short, and never name a region the player hasn't reached: a far-isle hero says
"across the sea" or "my island". Far-isle heroes were away from home when the isles were erased; their families sleep
in the blank. That is the one serious note each of them carries.

| Hero | Home (region) | What he did to it | Joins |
|---|---|---|---|
| Rowan | Meridian's knights' hall (truly: Wend) | (section 6) | the start |
| Sable | Crookwell, a market town of alleys (1) | straightened every alley into a grid: a thief with no corners | story: robs the camp after Act 1 |
| Moss | a wild grove in Greenmarch's woods (1) | redrew the wild wood in tidy rows; the trees don't know each other any more | chest |
| Dell | a hill farm in Greenmarch (1) | squared the fields; drew out the crows (and the corn doesn't grow right) | chest |
| Neve | the Rime Observatory on the peaks (2) | held in the endless afternoon; she froze herself trying to stop it | story: after the Act 1 mini-boss |
| Tam | an avalanche crew's hut (2) | Tam set off small avalanches so big ones never came; he stopped the snow: no job, no snow, no spring | chest |
| Torva | a basalt quarry in Ashfell (3) | the rocks drift away before she can break them; her crew is chained in pairs | chest |
| Vesper | the night channels of the fen (4) | took away the lanterns and the night; her eyes were made for the dark | chest |
| Solenne | the Dawn Order of the sun plateau (5) | pinned the sun at noon: no dawn to greet, an order with no oath to keep | chest |
| Yara | a spirit-calling village in a deep forest isle (6) | erased; then drawn silent: her spirits can't hear her | chest |
| Wren | a cliff town of rope bridges (7) | erased; then drawn to float: nothing ever falls, no one ever climbs | chest |
| Tess | a makers' town of clockmakers (8) | erased; then drawn so nothing ever breaks: no clock needs her | chest |
| Hollis | a storm wall on a fishing isle (9) | erased; then the sea drawn dead calm: a wall with nothing to hold back | chest |
| Brann | the storm-bell abbey on the same isle (9) | the bell warned of storms; he stilled the sea; Brann took a vow of silence until it rings for a reason | chest |
| Fizz | the lighthouse of a beacon isle (10) | her flame-brews fed the light; he drew a light that never needs her | chest |
| Gorm | the standing stones of a moorland isle (11) | erased; then drawn over with someone else's village (section 6) | chest |

(For chest heroes, the region in brackets is for this bible only; the meet scenes stay vague. Their lines about home
can deepen in the banter once their region is reached: a banter line with `after` that region's opening scene.)

---

## 5. The arc

Three movements across twelve regions. Stakes rise each region; the Mapmaker's attitude shifts with them.

### Movement I: the drafts (Regions 1-5, the continent)
He is courteous, curious, sure of himself. Each region is a "fix" of a natural danger, made in the weeks before the
story; each restored region sends him on to the next, where he waits to defend it. At the end of Region 1 he tries to
erase Rowan, fails, and asks "Who drew you?"; after that he watches Rowan more than the fights. In Region 4 he starts
scraping the continent itself for ink (a fen village goes blank in front of them): the first time Rowan sees people
fall asleep because of a choice made in front of him.
- **End of Region 5 (midpoint): twist 1.** Before the boss fight on the plateau, Ambrose greets the owl by name:
  "Hello, Pip. You have grown." "Hello, Ambrose." The fight plays with that hanging. Pip was his. After it, Ambrose
  shows the feather pen; Pip tells Rowan the half he can: he sat on Ambrose's shoulder in the Atlas Hall for ten
  years, and when Ambrose left he stayed, "for a reason". Ambrose walks out over the sea to the blank: "I was gentle
  with your continent. Across the sea, there is no one left to be gentle for."

### Movement II: the erasures (Regions 6-9, beyond the sea)
The isles are blank, and he is drawing his own world on them: not fixes of nature now, fixes of *people* (no one
alone, no one falls, nothing breaks, no storms). The sleepers in the blank are real and many; the heroes from these
isles find their families asleep. He is no longer gentle; he still never lies.
- **Region 8: twist 2.** In the makers' town, the copyists' archive holds a copy of the Atlas made every hundred
  years. Two copies side by side show it: the river once ran through Meridian; a century ago a keeper moved it into
  Wend's valley. Ambrose shows Rowan, and tells him about the levee, the flood, the boy. For the first time Rowan
  cannot say the Mapmaker is wrong. ("The world *was* unfair. You're right about that. You're wrong about the rest.")
- **End of Region 9: the stakes peak.** To finish the Fair Copy he needs more ink than the isles hold, and he takes it
  from the one place that has plenty: he erases **Meridian**. The capital, the Atlas Hall's galleries, Hesper, the
  knights' hall: all asleep in the blank. The Atlas itself remains (a page can't erase itself), alone in white. The
  camp is the only place awake that Rowan has left.

### Movement III: the fair copy (Regions 10-12)
- **Region 10:** the beacon isle; he has turned its light into the lamp over his drawing table. Rowan wakes Hesper
  by walking into the blank Atlas Hall (Meridian's restoration is the region's reward). She tells him the oldest law
  and that Ambrose once broke it, and no more. Pip begs her to tell the rest; she won't.
- **Region 11: twist 3 and the late emotional beat (section 6).**
- **Region 12: the Margin, the finale; the ending (section 7).**

### The twists (where each is seeded and paid)
| # | Twist | Seeded | Revealed |
|---|---|---|---|
| 1 | Pip was the Mapmaker's owl; the pen is Pip's feather | written: R1 Pip knows Rowan's name before they meet (`act1`, `road`) and warns "be careful of him" (`act3`); R2 he knows how Ambrose chooses ("He finds whoever will love his fix the most", `frost2`); R5 he sits apart at camp, "just remembering someone" (`noonCamp`), goes quiet (`noon2`), offers only "Don't touch the mane." (`brassLion`). To add: the pen drawn plainly as an owl feather (art) | R5 (`noonBoss`, `noonVictory`) |
| 2 | The keepers moved the river themselves; Wend drowned because of the capital | written: R4 the fen-woman, "The river ran down from the north, once" (`duskVictory`). banter "Hesper never looks at that lake." (after `victory`). Outlined: R6 Pip reads a moved river in the impression, "Long before him." (`hush2`). To add: Hesper never looks at the lake (her portrait) | R8 (`wick2`) |
| 3 | Rowan is the son Ambrose drew back: a cut through the page | written: the intro (the only one who woke); "Who drew you?" (`victory`); R4 Rowan can't swim, "since before I remember" (`dusk3`), and walks on the blank water (`dusk2`); at camp, "Why can't he erase me?" (`duskCamp`); and in camp banter, "They found me on some steps. Soaked." and Pip's "I've known you a long time." Outlined: R6 Pip stayed "for someone who needed watching over" (`hushCamp`); R7 the blank holds Rowan up, "It feels like paper" (`reach1`); R8 Ambrose tells of "my boy" and never says his name (`wick2`) | R11 |

(Never let Ambrose say his son's name before Region 11. When he finally does, it is the end of the scene.)

---

## 6. The late emotional beat (Region 11: Lowmoor)

Lowmoor was a moorland isle of standing stones (Gorm's home). Ambrose has drawn over it **Wend, exactly as it was on
the morning before the flood**: every fence, the mill, the bridge, a lit window in his own house, the river held back
behind a levee he finally got to draw. It is beautiful and completely empty. He has drawn his son into the window
again and again; every morning the drawing has faded. He doesn't know why.

The boss is **the Flood**: the river itself, a great serpent of grey water rising behind his levee. Every time Rowan
gains, Ambrose draws the levee higher, and the river rises to meet it. (Edits: "Higher." and "Higher.") At the end he
can't draw fast enough, and he turns his nib on Rowan, close enough to see the line he's trying to scrape: and it isn't
a line. It's a cut. It's his own hand. He knows it the way you know your own writing.

Then the beat, in as few words as it takes:
- Ambrose: "I pressed too hard. I couldn't see. I was crying." / "You were six. You were soaked through."
- Pip, asked straight by Rowan, tells the truth: the night, the cut, Hesper's lie.
- Rowan understands why he's afraid of deep water, why the blank can't hold him, why the man he's been fighting has
  looked at him like that since the first night.
- Ambrose says the name for the first time: "Rowan." His plate changes from "The Mapmaker" to "Ambrose".
- And the turn: his son is alive, which means the Fair Copy can never hold him (a cut can't be copied onto a fresh
  sheet). If he finishes it, the son he got back is the one thing his perfect world leaves out. He doesn't stop. He
  can't, yet: "Then I'll draw you in by hand. I'll get it right this time." He leaves for the Margin.
- Rowan's answer (the line the whole game has been walking toward): "You did get it right. You just didn't stay to
  see it."

---

## 7. The finale and the ending (Region 12: the Margin)

The Margin is the isle at the very edge of the vellum, where the First Hand signed the Atlas with a compass rose. It was
Ambrose's prison for fifteen years; his drawing table stands where the rose was, the **Fair Copy** spread on it, almost
done: the whole kingdom, clean, without a lake. He has drawn a champion to stand guard: the **Fair Knight**, his son as
he imagines him grown, flawless, drawn from fifteen years of wishing. It is the final boss, and it is fading as it
fights (a living thing can't be drawn twice). Ambrose's edits in the last fight bring back every region's rule, one
phase at a time, faster and faster: everything he ever "fixed", turned on the one person he wanted to save.

**The ending.** The Fair Knight fades mid-stroke. Ambrose has ink on the nib and the Fair Copy in front of him: one line
finishes it. Rowan doesn't fight him for the pen. He sits down beside the table, the way you'd sit beside someone at a
grave, and waits. Ambrose puts the nib down. He burns the Fair Copy himself.

The restoration follows: every region's old lines, the isles' sleepers waking, the fog gone from the map. In Meridian,
Hesper tells the kingdom the truth about the river. The keepers will draw no new land; the Atlas keeps one new line,
drawn by Hesper, that everyone agrees to: the word **Wend**, written on the lake. Ambrose is not exiled again. He
lives by the lake and mends fences in Greenmarch the slow way, by hand. Pip splits his time. The last image: Rowan and
Ambrose at the water's edge; Rowan takes his boots off and puts his feet in the lake for the first time; Pip on a
branch above them. The Atlas keeps its one hole, and nobody patches it.

---

## 8. The regions

Each entry: the name; its **original drawing**; **his redraw** and why (his "fix"); how that explains its **bar
rules**; the **boss**, its keystone and **his edits** (one per phase); what **restoring** it means; the plot beat.
Regions 1-3 are built (their data exists); Region 4 is being built by Team 3 (names here are suggestions they may
change); Regions 5-12 have no rules yet: the rule hooks are ideas, not decisions.

### Region 1: Greenmarch (acts: Meadow Road, Old Ruins, Boar King's Hollow)
- **Original:** the kingdom's green heart round Meridian: crooked lanes, hedgerows, wild woods, a ruined fortress, a
  great hollow tree in the deep wood. Untidy and lovely.
- **His redraw (his lightest, done last: it was home):** he straightened the Meadow Road ("a crooked road gets people lost"), drew the Old
  Ruins back into the fortress they were three hundred years ago (and woke its guardian), and gave the wild Hollow a
  ruler: he drew a crown on the biggest boar in the wood ("a wild wood without a king is only chaos"). The night he
  came, he scraped the Meadow Road's farms for the ink, and the farmers fell asleep where they stood.
- **Bar rules: the basics.** In Greenmarch he changed *things*, never the rules: he couldn't bring himself to change
  more of the land he grew up in. Greenmarch fights the way the First Hand drew the world, which is why it teaches the
  basics. ("I was too gentle with Greenmarch. I always was.")
- **Mini-bosses:** the Bandit Captain (robbing the sleeping farms: "That's what makes it fair. Somebody redrew the
  world last night. I'm just keeping up."); the Ruin Golem (asleep in the rubble for three hundred years, woken when
  the redraw put the walls back, still obeying a dead king: "THE GATE IS WHOLE. SO I GUARD IT.").
- **Boss: the Boar King.** Keystone: the drawn crown (when he drew it, the boar learned to speak: crowns do that).
  - Phase 2 edit: "A king needs subjects." He draws piglets into the fight.
  - Phase 3 edit: "Too slow. Let me quicken the line." He redraws the pace of the wood: everything faster.
- **Restoring:** the crown cracks; the Hollow is a wild wood again; the road crooks; the farms wake. Ambrose, unhurt,
  tries to erase Rowan for the first time at close range; the ink slides off. "Who drew you?" He goes.
- **Beat:** Rowan goes home to Meridian, where Hesper waits in the Atlas Hall: "Ambrose Fairhand. He kept this Atlas
  once. He cannot erase you. So it falls to you." (She never looks at the lake: a stage direction for her portrait and
  a later camp scene.) Sable joins after Act 1. Scenes: `intro`, `act1`, `road`, `captain`, `sableJoin`, `act2`,
  `golem`, `act3`, `boarKing`-`boarKing3`, `victory`.

### Region 2: the Frostpeaks (Frostbite Pass, Glimmer Caves, Wyrm's Glacier)
- **Original:** high mountains with real winters: snow that fell, springs that came, and avalanches that buried a
  village every few years. Mountain folk who lived by the seasons; Tam's avalanche crews; Neve's observatory.
- **His redraw:** "Snow that never falls can never bury anyone." He drew the snow still, hanging in the air, and held
  the season at one cold afternoon so spring (avalanche season) never comes. He drew the passes smooth as glass so no
  one trips on a rock, and the caves' ice to hold fast whatever it touches so nothing ever slides.
- **Bar rules:** **ice patches** are his glass roads (the cursor speeds up on them); **hold blocks** are his ice that
  holds on (so you must hold); **snowdrifts** (Act 3) are where his still snow has piled (the cursor slows).
- **Mini-bosses:** Rimehorn (a colossal ram who keeps travellers off the glass road: "I caught two. I could not catch
  the third." He fights to see if they can stand); the Loom Matron (weaves the one afternoon into tapestries and
  likes it that way: "Nothing changes now, so at last I can weave it exactly.").
- **Boss: Glacia, the Rime Wyrm.** Keystone: the **Winter Mirror**, the centrepiece of her hoard, which holds the one
  afternoon; he gave it to her, and her scales copy it.
  - Phase 2 edit: "Hold still." He draws every third block into holding ice, and lends her scales the mirror.
  - Phase 3 edit: losing, he does the one thing he came here to stop: he draws an **avalanche**, stripes of ice and
    drift sliding down the bar. The first time we see him break his own rule to win.
- **Restoring:** the mirror cracks; the snow falls down at last; the clocks move on; spring will come, and with it the
  avalanches. Ambrose: "Spring will bring its avalanche, knight. Remember who let it in." Neve: "They'll build the
  snow walls again. Like before. That's what people do."
- **Beat:** Neve joins (Act 1). Ambrose is more interested in Rowan than in the mountain: he watches the fight from the
  ridge before he edits it.

### Region 3: Ashfell (Cinder Flats, Glass Warrens, The Black Forge)
- **Original:** a volcano land whose lava rivers changed course every year; the forge-folk moved their forges with
  them, and families were cut apart by new lava overnight.
- **His redraw:** "No one should lose their home to a river of fire, or their family to the far bank." He unpinned the
  land so every stone floats out of the lava's way, and chained together everything that belongs together, so nothing
  can ever be parted. Then he gave the finest smith alive, **Bellows**, an anvil that never cools, and Bellows has
  forged the chain for all of Ashfell ever since: every blow shakes the land.
- **Bar rules:** **drifting blocks** (the unpinned land that won't hold still); **linked pairs** (his chains: hit one,
  then the other).
- **Mini-bosses:** Rumbleback (paves the drifting flats every day, and every night they drift away); Hob & Nob (the
  forge's two-headed hound: one guards, one wants to play, and their master hasn't patted them in ages).
- **Boss: Bellows, the Forge Titan.** Keystone: the anvil that never cools. Bellows was Mags's master.
  - Phase 2 edit: "Together. Always together." He pins the land still and doubles the chains.
  - Phase 3 edit: the volcano erupts *through* his drawing, the old land pushing back, and he redraws as fast as it
    breaks: everything drifts, the pairs too.
- **Restoring:** the anvil cools; the chains fall; the land holds still; the volcano sleeps. Bellows sits down for the
  first time in years ("Put the hammer down. The chain is long enough."). Ambrose: "The next lava flow will part their
  families." Rowan: "Then they'll choose where to go. You don't get to choose for them."
- **Beat:** Rowan sees, for the first time, that Ambrose was *right about the problem*: the forge-folk did lose people
  to the lava. Torva's crew was chained in pairs. The question changes from "is he wrong" to "what does a fix cost".

### Region 4: the Duskmire (Lanternfen, The Drowned Causeway, The Gloaming Mere; Team 3 built its data)
- **Original:** Lanternfen, a wide fen of reed beds, black water and stilt houses, lit at night by lanterns on poles;
  the sea's tide ran in and out through the reeds and the fen-folk lived by their tide tables. A tipped lantern could
  burn a whole stilt row; a night tide could drown the careless.
- **His redraw:** he thought it "badly lit and badly drained". He inked the sun into one lighthouse lamp, so light
  goes only where he points it and nobody needs a flame; and he penciled the shore in, so the tide comes and goes on
  his timetable and never surprises anyone. The sky is stuck at sunset, and whatever he hasn't inked yet stays dark.
- **Bar rules:** **dark blocks** (what he hasn't inked: you see only what your own lantern reaches); **tides** (his
  penciled shoreline, rubbed out and redrawn on a timetable: the water rises and falls on the bar).
- **Mini-bosses:** Old Bellybog (a toad the size of a hut who swallows the fen's lanterns, "free light, just lying
  around", and glows from inside: "Nobody's been warm out there for a month."); the Sluice Keeper (a beaver engineer
  who runs the floodgates on the Mapmaker's timetable and believes in it: "Before the timetable, the tide came when it
  liked. It took my brother.").
- **Boss: the Gloaming Lighthouse**, a lighthouse he drew wading in the mere on stone legs; he speaks from its gallery
  (it doesn't speak). Keystone: **the lamp, with the sun shut in it** (the world map's glow in the fen, "the
  Mirelight", is that lamp seen from afar).
  - Phase 2 edit: "The shoreline was in the wrong place." The water comes in from both sides.
  - Phase 3 edit: "And nobody needs a sky." He rubs the sky out: dark but for the light Rowan carries.
- **Restoring:** the lamp cracks; the sun rolls out and sets at last; true night, the fen-folk's lanterns one by one;
  then morning. The tide keeps its own time again; they'll read their tables again.
- **Beat:** he begins to scrape the continent itself for ink: a causeway village goes blank in front of Rowan, who
  walks into the blank to the sleepers (and on the white water). At camp Rowan asks Pip why he can't be erased ("I
  don't know everything, Rowan."). On the mere Rowan admits he can't swim. Ambrose at the boss: "One village,
  sleeping, to save a thousand houses from fire. You would do the same sum." An old fen-woman at the end: "The river
  ran down from the north, once" (twist 2 seed). Vesper's home. Scenes: `src/data/story-dusk.ts` (Team 3's ids:
  `dusk1`, `bellybog`, `duskCamp`, `dusk2`, `sluiceKeeper`, `dusk3`, `lighthouse`, `lighthouse2`, `lighthouse3`,
  `duskVictory`).

### Region 5: Noonspire (The White Road, The Spire Steps, The Great Sundial; Team 3 built its data)
- **Original:** a high desert plateau of white stone towers and great sundials; the people kept time and direction by
  shadows. Cold, deadly desert nights. The Dawn Order (Solenne) greets every sunrise from the tallest spire.
- **His redraw:** "No one will freeze in the desert dark again." He drove a nail through the sun and pinned it at
  noon: no night, no cold, and no shadows. Without shadows nobody can tell the time or find the way; the heat never
  breaks; the Dawn Order has no dawn.
- **Bar rules (built, content bible section 8):** **mirages** (the haze lies about where things are: a yellow hops to
  a ghost outline shown first) and **heat** (blazing yellows hit hard and burn the hero; a green cools).
- **Mini-bosses:** the Noon Sphinx (keeps the White Road with a riddle: "Long at dawn, gone at noon, long again at
  dusk." A shadow. Rowan answers, but a traveler with no shadow is a mirage to her, and she lets no mirage pass); the
  Brass Lion (the Dawn Order's lion that roared the sun up every morning; a month with no morning, in this heat; it
  doesn't speak).
- **Boss: the Gnomon**, the great sundial's needle, stood up as a brass sentinel (it doesn't speak). Keystone: **the
  Nail** through the sun above it.
  - Phase 2 edit: "Too bright to see? Then do not look." The glare: every yellow blazes.
  - Phase 3 edit: "Closer, then." He draws the sun down, low and huge: everything is a mirage, and the blaze stays.
- **Restoring:** the sun sets for the first time in a month; the first dawn; Solenne's order greets it.
- **Beat: twist 1 (Pip).** Pip goes quiet in Act 2 ("Don't touch the mane." is all he offers); Rowan asks him straight
  at the sundial ("After this one. I promise."); Ambrose greets him by name before the fight, and Pip says nothing
  more until the last phase ("Steady, Rowan. I'm still here."); after it, the feather pen and Pip's half of the truth.
  Ambrose walks out over the sea, drawing a road as he goes, and far out the blank takes a shape: the first far isle,
  his draft there done (rule 10: it thinned while he drew it, from Region 4's restoring; its fog lifts and its name
  shows on the world map now). Scenes: `src/data/story-noon.ts` (`noon1`, `sphinx`, `noonCamp`, `noon2`, `brassLion`, `noon3`,
  `noonBoss`-`noonBoss3`, `noonVictory`).

### Beyond the sea: who is awake on the isles (Regions 6-12)
Everything on an erased isle sleeps (rule 5). His drafts are drawn on top of the blank: land, weather and *things*,
never creatures (rule 2). He draws around the sleepers: their villages stay blank, white pockets inside his drawing
("They will wake into the Fair Copy. Somewhere better."). So the isles' foes are: **things he drew to move** (shears,
rope, brass, presses: constructs, drawn to keep his draft as he wants it); **creatures that were away** when the isle
went blank and came home to his draft (birds, sea things, like the far-isle heroes); and **creatures that crossed
his sea road** from the continent. A keystone goes to the strongest creature awake there, or to the strongest thing
he drew to keep it. The party crosses on the road he drew over the sea (`noonVictory`); each restored isle sends him
to the next, already drawn (its fog lifts on the world map as the scene ends). Story heroes only in scenes (Rowan,
Pip, Sable, Neve, the Mapmaker); a chest hero's tie to an isle goes in banter gated on that isle's scenes.

### Region 6: Hushwood (far isle) — scene outline, ready for the content team
- **Original:** a forest isle of giant trees and great storms; the storms toppled trees on villages; Yara's people
  called the forest's spirits to warn them.
- **His draft on the blank:** "A tree that never falls can never fall on anyone." A forest with no wind: nothing
  falls, not a leaf, and with no wind and no creatures drawn in it, no sound at all. The villages are blank pockets.
- **Acts (suggested):** 1 **The Windless Wood** (his road comes ashore; autumn leaves that never fall); 2 **The
  Sleeping Hollows** (the blank pockets, Yara's village among them); 3 **The Yew Grove** (the heart of the wood).
- **Rule hooks (ideas; content decides):** *growth* (nothing falls, everything grows: a yellow left alone sprouts
  wider, then hardens into bark that takes two taps: hit it young) and *brambles* (a hit can drop a seed that grows
  into a yellow, or a bramble trap). His last edit lets a little wind out: *gusts* push every block one way.
- **Mini-bosses:** **the Shears** (Act 1: great garden shears walking on their points, drawn to keep his rows tidy;
  they snip whatever grows out of line; no speech). **Old Slowcoach** (Act 2: a giant snail who followed his sea road
  from the continent for a month; the only living thing in the wood; slow, polite, very territorial: "...Mine.").
- **Boss: Mother Yew**, the isle's oldest yew, the first thing he drew back, drawn to walk so she can keep the wood as
  he likes it. Keystone: **the Stopper**, a stone jar with the isle's wind corked in it, held in her branches.
  - Phase 2 edit: "Hush." Everything grows twice as fast.
  - Phase 3 edit: losing, he pulls the cork a little to knock Rowan down: "Just a breath." Gusts.
- **Restoring:** the Stopper cracks; the wind pours out; every leaf held for months falls at once; birds, wakened
  under the blank, start up all together; the blank pockets fill in and the villagers wake on their doorsteps.
- **Scenes (drafted in full ahead of the data: `src/data/story-hush.ts`, speaker `slowcoach` "Old Slowcoach"; the
  outline below is what they say):**
  - `hush1` (Act 1 start): off his sea road into a silent wood; no birds, no wind, leaves hanging. Rowan: "Listen.
    ...Nothing. Not one bird." Pip: "He can't draw birds. Nobody can. So he left them out." Sable: "A forest that
    doesn't creak. I hate it already."
  - `shears` (Act 1 mini-boss): the Shears come snipping down a perfectly straight row. Neve: "It's trimming the
    wood. And now it's measuring US."
  - `hushCamp` (camp, after Act 1): night; Rowan asks Pip the rest of "for a reason". Pip: "I stayed for someone who
    needed watching over. I promised I'd say nothing." Rowan: "Who?" Pip: "...Go to sleep, Rowan." (twist 3 seed)
  - `hush2` (Act 2 start): the first blank pocket: a white village inside the green, people asleep mid-step. Rowan
    walks in. The scale: from the ridge, dozens of white pockets. Pip reads the impression under the white: "This
    river was moved once. Long before him." Rowan: "Who else draws?" Pip: "Nobody. Nobody should." (twist 2 seed)
  - `slowcoach` (Act 2 mini-boss): the snail, a month from home, will not give up the only lettuce on the isle.
  - `hush3` (Act 3 start): the Yew Grove; the Stopper in her branches; the Mapmaker drawing new trees in a ring.
  - `yew` (boss intro): he is no longer gentle. "Storms dropped trees on these roofs every autumn. Count the graves,
    knight, then tell me about wind." Rowan: "And they called the spirits, and the spirits warned them. You took
    that too." He: "I took the danger. The warning goes with it."
  - `yew2`, `yew3`: his two edits (short, his line + the narrator + a hint).
  - `hushVictory`: the wind; the noise; the villagers wake. He, leaving: "The next storm will drop a tree on a roof,
    and you will have let it." Rowan: "And they'll hear it coming. They always did." Far out, the next isle takes
    shape.
- **Banter seeds (gated):** Yara after `hush2`: "My village. Asleep. I sang to them." / after `hushVictory`: "They
  woke up arguing. Home!" Moss after `hush1`: "The trees here don't even whisper." Rowan after `hushVictory`:
  "Birds! Loud ones! I missed loud."

### Region 7: Kestrel Reach (far isle) — scene outline
- **Original:** a cliff isle of rope bridges and climbing towns, wind and gulls; people fell, sometimes.
- **His draft:** the isle drawn in floating pieces at one height, every piece tied to the next with gold thread:
  nothing ever falls, so nobody ever climbs, and nobody is ever far from anyone. His first fix of *people's* troubles,
  not the land's: "No one will ever be far from anyone again." (He was far from someone once, when it mattered.)
- **Acts (suggested):** 1 **The Hanging Steps** (his road ends at a cliff that isn't there: stairs floating in a
  row); 2 **Ropetown** (the climbing town, every house its own floating piece); 3 **The Eyrie** (the highest piece,
  the kestrel's nest).
- **Rule hooks (ideas):** *gaps* (the bar in floating pieces: the cursor leaps each gap, so a block just past a gap
  comes sooner than it looks) and *updrafts* (a patch where the cursor floats a moment).
- **Mini-bosses:** **the Ropewright** (Act 1: a knot of rope and planks he drew to tie the pieces together; it ties
  whatever it touches to something; no speech). **Squall, the gull queen** (Act 2: the gulls were out at sea when the
  isle went blank; earnest: "Nothing falls here. So my chicks have never flown." You learn to fly by falling).
- **Boss: the Great Kestrel**, who was hunting far out at sea when the isle went blank and came home to his draft. He
  gave her the Tether (keystone): a gold thread that holds every piece up, her nest too. Wren's town climbed her cliff.
  - Phase 2 edit: "Closer." He pulls the pieces together: the gaps close and everything crowds in.
  - Phase 3 edit: "Hold on to each other." Every block tied to the next.
- **Restoring:** the Tether snaps; the pieces come down to the sea and stand as cliffs again; the bridges sway; the
  sleepers wake on their own doorsteps; a gull chick tumbles off a ledge, and flies.
- **Scenes (drafted in full: `src/data/story-reach.ts`, speaker `squall`):** `reach1` (Act 1 start: the steps hanging over nothing; between the pieces, white blank; Rowan steps out
  onto it and it holds him. Neve: "You are standing on NOTHING." Rowan: "It isn't nothing. It feels like paper.");
  `ropewright`; `reachCamp` (camp: Sable and Neve on Rowan walking on the blank; Rowan: "I don't know what I am." Neve:
  "You're the one who carries us across. That'll do."); `reach2` (Act 2 start: Ropetown; every house tied to every
  other; the people asleep in white pockets, tied together too); `squall`; `reach3` (Act 3 start: the Eyrie, the
  Tether shining up into the sky); `kestrel` (boss intro: he means it kindly: "Here, no one falls. No one is ever too
  far away to reach." Rowan: "Then why do you look so alone?"); `kestrel2`, `kestrel3`; `reachVictory` (the isle comes
  down; he, quietly: "I was too far away, once. Only once." He goes; the next isle takes shape).
- **Banter seeds:** Wren after `reachVictory`: "Ma climbed back down. She's FURIOUS." Sable after `reach1`: "Rowan
  walks on nothing now. Normal." Pip after `reachCamp`: "Hoo. Nobody falls on my watch."

### Region 8: Thimblewick (far isle) — scene outline (twist 2)
- **Original:** a makers' town: clockmakers, weavers, copyists. The copyists' archive keeps a copy of the Atlas made
  every hundred years.
- **His draft:** nothing ever breaks or wears out, so nobody needs a maker, and the town stops. He drew the copyists'
  archive back line for line, on purpose: for what it holds.
- **Acts (suggested):** 1 **The Spotless Lanes** (every cobble new, every hinge silent, every shop shut); 2 **The
  Hall of Copies** (the archive); 3 **The Mainspring** (the great works under the town, where the Mender stands).
- **Rule hooks (ideas):** *mending* (nothing breaks: a block you hit once mends itself unless hit again soon) and
  *winding* (a wound block runs down: tap it to wind it back, or it goes off).
- **Mini-bosses:** **the Polisher** (Act 1: a many-armed brass thing that polishes away every scuff, yours too; no
  speech). **the Press** (Act 2: the archive's printing press, drawn to walk, stamping copies of everything so nothing
  is ever lost; it shouts in capitals: "COPY. COPY. COPY.").
- **Boss: the Mender**, a vast brass figure of many hands that mends anything broken, including the foes you break.
  Keystone: **the Key**, turning in its back, that keeps everything wound.
  - Phase 2 edit: "Nothing breaks." Everything mends faster.
  - Phase 3 edit: "Let me mend this fight." He winds everything at once.
- **Restoring:** the Key snaps; a hinge squeaks, the first sound of wear; the makers wake and go back to work.
- **Scenes (drafted in full: `src/data/story-wick.ts`, speaker `press`):** `wick1` (Act 1 start: a town where nothing is worn; Sable: "Not one scuff. Who LIVES like this?"
  Pip: "Nobody. That's the trouble."); `polisher`; `wickCamp` (camp: Mags at her forge, cross about a town that never
  needs a smith; "A mend should SHOW. That's how you know someone cared."); `wick2` (Act 2 start: twist 2, below);
  `press`; `wick3` (Act 3 start: the
  Mender under the town, the Key turning); `mender` (boss intro: "Nothing will ever wear out again. Nothing will ever
  be lost." Rowan: "Things get lost. People find them. That's most of what people do."); `mender2`, `mender3`;
  `wickVictory` (the Key snaps; the hinge; he, honest as ever: "These isles do not hold ink enough for what I am drawing,
  knight. I will find more." (it sets up Region 9's end) Pip, after he goes: "Rowan. There's more. It isn't mine to tell." The next isle takes shape).
- **`wick2` (the twist, 6 boxes, the whole region turns on it):** two great copies of the Atlas side by side under
  the lamps, made a hundred years apart. "Look at the river. Here, it runs through Meridian. Here, it does not." A
  keeper moved it, a century ago, into a valley with a village in it: his. Wend. A spring flood came down it; he
  asked the High Keeper for a levee; she said keep the line, never make it; Wend drowned, "and my boy with it". (Never
  his son's name; never his age.) Rowan, after a long box of silence: "The world was unfair to you. You're right about
  that. You're wrong about the rest." At the boss, Rowan asks "Did Hesper know?" He: "Ask her, knight. She will tell you less than I have." (sets up
  Region 10)
- **Banter seeds:** Tess after `wick1`: "No clock wears out here. Disgusting." / after `wickVictory`: "A squeaky
  hinge! Music." Rowan after `wick2`: "He had a son. I keep thinking about it." Sprocket is from here (its bio).

### Region 9: Saltmarrow (far isle) — outline (the stakes peak)
- **Original:** a fishing isle in a stormy sea, a storm wall (Hollis) and a storm-bell abbey (Brann) that rang when a
  storm was coming.
- **His draft:** "No boat will ever go down in a storm again." The sea drawn dead calm, flat as glass, until it
  crusted into salt; no tide, no waves, no fish moving under it. The abbey bell has nothing to ring for.
- **Acts (suggested):** 1 **The Salt Flats** (a sea you can walk on); 2 **The Storm Wall** (Hollis's wall, holding
  back nothing); 3 **The Glass** (out where the deep water was, under a pane laid over the sea).
- **Rule hooks (ideas):** *salt crust* (blocks crusted over: the first tap cracks the salt, the second hits) and
  *glass calm* (a stretch of bar where nothing moves at all: blocks there wait until the cursor has passed once).
- **Mini-bosses:** **the Saltworks** (Act 1: a rake-armed thing he drew to keep the flats smooth; no speech); **Gale**
  (Act 2: a storm petrel who was out at sea when the isle went blank and has flown ever since, looking for a storm to
  ride: "No wind. No wave. Nowhere to land." It speaks; tired, proud).
- **Boss: Old Brine**, a sea serpent who was out in the deep when the isle went blank, came home, and was caught when
  he drew the sea still: salt crusts its coils. He gave it the Glass (keystone) to lie under. It doesn't speak; it
  groans like a ship.
  - Phase 2 edit: "Be still." The salt spreads. Phase 3 edit: "Stiller."
- **Restoring:** the Glass cracks; the first wave in months; then a storm, a real one, and the abbey bell rings for a
  reason. The fishing village wakes, soaked and furious and alive.
- **The end of the region (the stakes peak, `saltVictory`, 6 boxes):** the storm passes; Rowan looks west; on the
  horizon the capital goes white, the way the causeway did (`dusk2`). He took the ink he needed from the one place that
  has plenty: **Meridian**, the Atlas Hall's galleries, Hesper, the knights' hall, all asleep in the blank. The Atlas
  itself stays (a page can't erase itself), alone in white. Ambrose, honest: "The isles did not hold enough. I took it
  from the one place that has plenty. They are sleeping, knight. Only sleeping." Rowan says nothing. Pip: "Rowan...
  that was home." The camp is the only awake place Rowan has left (the world map: the capital blank).
- **Scenes:** `salt1`, the Act 1 mini-boss's, `salt2`, the Act 2 mini-boss's, `salt3`, `brine`, `brine2`, `brine3`,
  `saltVictory`. Brann's first words go in banter (he may not be at the camp): after `saltVictory`, with Brann there,
  `{ who: 'brann', text: '...The bell rang. So. Hello.' }` (no "(writes)").

### Region 10: Farlight (far isle) — outline
- **Original:** a beacon isle whose lighthouse guided ships home; Fizz's flame-brews fed its light.
- **His draft:** "A light that never goes out." He turned the beacon inward: it is the lamp over his drawing table on
  the Margin now, and its Flame burns the ink he scraped from Meridian to stay lit. Out at sea, ships wreck in the dark.
- **Acts (suggested):** 1 **The Dark Harbor**; 2 **The Wreck Shore** (the hulls of every ship the dark sea wrecked);
  3 **The Beacon Stair**.
- **Boss: the Wreckwarden**, a giant pieced together from those hulls, drawn to guard the beacon stair. Keystone:
  **the Flame**. (Not a lighthouse boss: the Duskmire has the one.)
- **Restoring (and Meridian):** the Flame breaks; the beacon swings back out to sea; and the ink it was burning runs
  home (rule 7): Meridian comes back, line by line, on the horizon. Rowan crosses on his road, walks into the waking
  Atlas Hall, and finds Hesper on the gallery, just waking.
- **The beat (`farVictory` and a Meridian scene, e.g. `hallWakes`):** Hesper tells Rowan the oldest law (never the
  living) and that Ambrose broke it once, the night after the funeral, and no more. Pip begs her to tell the rest
  ("He has a right to know, Hesper."); she won't: "Not today." Pip's anger is the first
  time he raises his voice in the game. (Her secret, the river, waits for her confession at the end.)
- **Scenes:** `far1`-`far3`, two mini-bosses', `warden`, `warden2`, `warden3`, `farVictory`, `hallWakes`. Fizz after
  `farVictory`: "MY light! Pointing the RIGHT way!"

### Region 11: Lowmoor (far isle): section 6.
- Original: a moorland isle of standing stones (Gorm's). His draft: Wend before the flood. Boss: **the Flood**.
  Keystone: **the Levee**.

### Region 12: the Margin (far isle): section 7.
- Original: the isle at the vellum's edge where the First Hand's compass rose is. His draft: his workshop and the Fair
  Copy. Boss: **the Fair Knight**. Keystone: **the Nib**.

---

## 9. UI words (for the art team, the world map and every screen that used "weights")

| Old | New |
|---|---|
| Weights home: 3/12 | **Regions restored: 3/12** (short: "Restored 3/12") |
| The Great Pendulum (the capital's tower) | **The Great Atlas** (in the Atlas Hall, at Meridian) |
| Tap card: "Stopped. Its weights are lost." | "The Great Atlas. 3 of 12 regions restored." / at 0: "Its lines are fading." / at 12: "Whole again." |
| the far lands' fog | **Erased land** (card title "Erased land", line "Restore more regions to bring it back.") |
| a thinning fog | "Something is being drawn here." |
| "Beyond the sea" (an unnamed far land) | "Erased land" until its name is revealed |
| Region victory: "The first weight is home." | **"Greenmarch is restored."** (the region's name) / "N regions to go." |
| achievements "Bring the first weight home." | "Restore Greenmarch." (names are fine once cleared) |
| the pendulum emblem (shrine gable, camp, gear) | the Atlas's **compass rose** |
| the narrator's portrait (the Pendulum's bob) | the Atlas: a corner of a living map, with a compass rose |
| the Boar King's "pendulum bob" crown | the crown he drew: gold, with faint glowing ink lines |
| the act clear / world map's "weight" pips (12 dots) | 12 small compass roses, lit as regions are restored |
| item: Pendulum Shard (effect "Tick, Tock") | **Keystone Shard** (effect "Fresh Ink": every 10th combo hit draws a green block) |
| Bellows's anvil "with the brass pendulum weight" | the anvil that never cools, glowing gold ink along its edge |
| the Bandit Captain's portrait: the "genuine" pendulum weight he holds up (`art-story.ts`) | a fat coin purse lifted from a sleeping farmer (he robs the sleeping farms) |
| the Ruin Golem's forehead rune: a little pendulum (`art-story.ts`) | the old king's crest: a crown over a gate (it guards a dead king's gate) |
| the Keystone Shard's icon (`item_shard`, "pendulum brass" in `art-gear.ts`) | a shard of the Boar King's broken crown: gold, with faint glowing ink lines |
| the world map's capital card, header and pips (`view/world.ts`) | as above: "The Great Atlas", "Regions restored: N/12", compass roses; far lands: their names (`core/world-plan.ts`) once revealed, else "Erased land" |

The capital's landmark becomes the domed Atlas Hall; the pendulum that swung wider as weights came home can become the
Atlas's light: a glow under the dome that brightens as regions are restored. Erased land should look **blank**, not
cloudy: white-grey paper with faint pencil-like dents of the old coastline (the impression), thinning to show his
gold lines while he's drawing there.

---

## 10. Scene plan and status, Regions 1-3 (ids stay stable)

Region 1: `intro` (3 boxes), `act1` (1 box: Pip): together the 4 boxes before the first fight. Proposed new scene
`road` (after the first fight is won: Pip explains the blank and the Atlas; needs a hook, see the report). `captain`,
`sableJoin` (camp), `act2`, `golem`, `act3`, `boarKing`, `boarKing2`, `boarKing3`, `victory` (ends in Meridian with
Hesper). Region 2 and 3: the same ids as now (`frost1` ... `frostVictory`, `ash1` ... `ashVictory`), rewritten to this
bible. New speakers: `mapmaker` ("The Mapmaker"), `keeper` ("Hesper"); both need portraits (art team).

Status (round 8, chunk 2): Regions 1-3 rewritten (`story.ts`, `story-ash.ts`) and passed by an independent editor
twice; the chest heroes' arrivals say whose home was redrawn (Brann writes on a slate); the welcome back catches a
returning player up; Region 4's ten scenes are in Team 3's ids (`story-dusk.ts`; speakers `bellybog`, `sluiceKeeper`
need portraits); Region 5's nine scenes fit its data as built (`story-noon.ts`, incl. the mini-bosses' `sphinx` and
`brassLion`; speaker `sphinx` needs a portrait). Hesper speaks in the allies' warm look. Camp banter follows the story (`core/banter.ts` gates each region's
lines on their scenes). Every player-facing data text was swept for the old premise (gear, meta, relics, events,
quests, companions' bios, heroes' bios, act names, tips); the far isles' names are in `core/world-plan.ts` (shown
once revealed). Still to do: the `road` hook (first 10 minutes team); the portraits (`portrait_mapmaker`,
`portrait_keeper`, the Region 4-5 speakers'; until they exist the story view shows Phaser's missing-texture box);
the world map's and title's words (art team, section 9). Region 4 is in play now (its scenes and banter with it);
Region 5's scenes and banter (`banter-noon.ts`) wait for its region.
---

## 11. What the story needs from other teams (round 8)

- **Art (Team 2):** portraits `portrait_mapmaker` (section 4's look: tall, spare, near fifty, kind tired eyes,
  ink-stained fingers, faded keeper's-blue coat with the badge torn off, an owl-feather pen with a silver tip),
  `portrait_keeper` (Hesper: silver-haired, upright, grey-blue keeper's robes, a heavy key on a chain), and Region 4-5's
  speakers (`portrait_bellybog`, `portrait_sluiceKeeper`, `portrait_sphinx`: a gold desert sphinx, eyes half shut
  against the glare). Until they exist, the story view shows Phaser's missing-texture box. (`keeper` now has the
  allies' warm look in `view/story.ts`.) The narrator's portrait (now the Pendulum's bob) becomes a corner of the Atlas
  with a compass rose. The Mapmaker's edits, when shown, are gold ink strokes hanging in the air. Every UI word in
  section 9, including its last rows: the Bandit Captain's prize, the golem's rune, the Keystone Shard's icon, and
  `view/world.ts`'s capital card, header and pips (still "Weights home" / "The Great Pendulum" on the run branch).
- **First 10 minutes (Team 5):** the `road` scene (6 boxes: who Pip is, what the blank is) is written for right after
  the first fight is won, once (e.g. `profile.seen` 'road'); it needs a hook in the post-fight flow, which is yours.
  If it costs the first minutes too much, cut it to 3 boxes or move it to the first rest: tell the story team.
- **Lead:** `WELCOME_ID` in `src/data/tips.ts` is still `welcomeM4a`, so a returning player who saw the old welcome
  won't see the new one (which now catches them up on the story); bumping it (e.g. `welcomeR8`) replays it once
  (`tests/smoke/smoke.spec.ts` checks the id by name). The screenshot baseline `story.png` changes (the new intro).
- **Content (Team 3):** Region 5's nine scenes fit its data as built (`story-noon.ts`: the mini-bosses' `sphinx` and
  `brassLion` are written, `story-noon-minis.ts` is empty); new: `noonCamp`, the camp's scene after Act 1 (wire it like
  `duskCamp`: `run.ts` `campScene`/`sableJoined` at `actsCleared >= 13`, and `core/lab.ts` marks it seen), speaker
  `sphinx` ("Noon Sphinx", needs a portrait), and `banter-noon.ts` (already read by `core/banter.ts`; it shows once the
  region is in play). Regions 6-10 are outlined in section 8 with scene ids, mini-bosses, bosses, his edits and rule
  ideas, and Regions 6-8's scenes are drafted in full (`story-hush.ts`, `story-reach.ts`, `story-wick.ts`; speakers
  `slowcoach`, `squall`, `press`): the rule hooks are ideas; rename anything and tell the story team so the scenes
  follow.
