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
| The Mapmaker | gentle, courteous, precise; **no contractions**; craftsman's words (line, draft, smudge); compliments; "There. Better." rarely | shouting (until Region 11), threats, lies |
| Hesper | terse, formal, few kind words; no contractions | explaining herself (until the end) |
| Sable | quick, light-fingered, practical; one quip per scene | cruelty |
| Neve | prickly, proud, CAPITALS for emphasis, secretly glad of company | admitting it |
| Mags | gruff, warm underneath, forge talk | (she can joke: she's camp) |
| Bosses | each their own: the Boar King and the golem shout in capitals; Rimehorn and the golem speak without contractions; Glacia says "darling" | winking at the player |

---

## 1. The premise in one paragraph

The kingdom is a living map. Every road, river, hill and season in it is drawn on the **Great Atlas**, a vast sheet of
vellum in the Atlas Hall at the capital, **Meridian**, and whatever is drawn there is real. For centuries its keepers
have sworn only to keep its lines, never to make new ones. Twenty years ago one of them broke that oath and was exiled
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
- **The flood (twenty years ago):** a spring flood was coming down the valley. Ambrose begged the High Keeper, Hesper,
  to let him draw a levee above Wend. She refused: *keep the line, never make it.* Wend drowned. The valley became the
  lake. His wife survived; his son did not. (His wife died some years later, in his exile. He mentions her once.)
- **Why he was exiled:** the public story is that he "tried to redraw the kingdom". The truth: on the night after the
  funeral he drew his son back onto the Atlas. That is the oldest law broken. Hesper caught him at it, broke his nib,
  and sent him to the Margin. She told him the drawing had faded by morning.
- **Motive:** he believes the world is a draft drawn by careless hands, and that every grief in it is a line in the
  wrong place: a road that gets travellers lost, a snow that buries a village, a tide that drowns a child. He is not
  conquering. He is *fixing*. His goal is the **Fair Copy**: the whole kingdom redrawn clean on a fresh sheet, where no
  flood ever comes, and then the old Atlas burned. He does not think of erased land as harmed: "They're only
  sleeping. They'll wake somewhere better."
- **His flaw:** every fix removes a danger by removing a living rhythm (falling snow, turning seasons, night, tides,
  change itself). His world is safe because nothing in it moves. He can't see it, because the one thing he wants is
  for one moment, twenty years ago, to have never moved on.
- **Voice:** gentle, precise, unhurried; a teacher's patience. Mapmaker's words: line, draft, smudge, margin, a
  steady hand, a fair copy. He compliments his enemies and means it. Never shouts (until Region 11). Polite to a fault:
  "Forgive me." "If you'd step aside." "There. Better."
  - "A crooked road gets people lost. I've straightened it. You're welcome."
  - "Forgive the interruption. Your fight was drawn badly. Let me fix it."
  - "Nobody is hurt. They're sleeping. When they wake, the world will be kind."
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
- A junior knight of the Meridian guard, about twenty. A foundling: found at six on the Atlas Hall steps, soaked
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
He is courteous, curious, sure of himself. Each region is a "fix" of a natural danger. In each, he tries once to
erase Rowan, fails, and asks "Who drew you?" Each restored region sends him back to his table to try again. He erases
the far isles' last scraps for ink; in Region 4 he starts scraping the continent's coasts (a fen village goes blank):
the first time Rowan sees people he knows fall asleep.
- **End of Region 5 (midpoint): twist 1.** On the plateau, Ambrose greets the owl by name: "Hello, Pip. You've
  grown." Pip was his. Ambrose shows the feather pen. Pip tells Rowan the half he can: he knew Ambrose, he sat on his
  shoulder in the Atlas Hall, he stayed behind "for someone". Ambrose crosses the sea to the blank: "I was gentle with
  your continent. Out there, there's nobody to be gentle for."

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
| 1 | Pip was the Mapmaker's owl; the pen is Pip's feather | R1: Pip knows the Atlas Hall too well; R2: Pip flinches at his voice; R3: the pen is plainly an owl feather | end of R5 |
| 2 | The keepers moved the river themselves; Wend drowned because of the capital | R1 victory: Hesper won't look at the lake; R4: the fen-folk say "the river came from the north once"; R6: an erased isle's oldest lines are newer than they should be | R8 |
| 3 | Rowan is the son Ambrose drew back: a cut through the page | intro (awake in the blank); every region ("Who drew you?"); R1: Rowan was found on the Atlas Hall steps, soaked; R4: Rowan can't swim; R8: Ambrose tells of "my boy" and never says his name | R11 |

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
Ambrose's prison for twenty years; his drawing table stands where the rose was, the **Fair Copy** spread on it, almost
done: the whole kingdom, clean, without a lake. He has drawn a champion to stand guard: the **Fair Knight**, his son as
he imagines him grown, flawless, drawn from twenty years of wishing. It is the final boss, and it is fading as it
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
- **Mini-bosses:** the Bandit Captain (robbing the sleeping farms: "A whole road asleep. Somebody has to collect.");
  the Ruin Golem (woken by the redraw, still obeying a king three hundred years dead: "THEN WHO WOKE ME?").
- **Boss: the Boar King.** Keystone: the drawn crown (when he drew it, the boar learned to speak: crowns do that).
  - Phase 2 edit: "A king needs subjects." He draws piglets into the fight.
  - Phase 3 edit: "Quicker, then." He redraws the king's pace: everything faster.
- **Restoring:** the crown cracks; the Hollow is a wild wood again; the road crooks; the farms wake. Ambrose, unhurt,
  tries to erase Rowan for the first time at close range; the ink slides off. "Who drew you?" He goes.
- **Beat:** Rowan goes home to Meridian. Hesper, in the Atlas Hall, shows him Greenmarch's lines coming back on the
  Atlas, names the Mapmaker, and sends him on: "Everything he erases sleeps. You don't. So it's you." (She never
  looks at the lake.) Sable joins after Act 1.

### Region 2: the Frostpeaks (Frostbite Pass, Glimmer Caves, Wyrm's Glacier)
- **Original:** high mountains with real winters: snow that fell, springs that came, and avalanches that buried a
  village every few years. Mountain folk who lived by the seasons; Tam's avalanche crews; Neve's observatory.
- **His redraw:** "Snow that never falls can never bury anyone." He drew the snow still, hanging in the air, and held
  the season at one cold afternoon so spring (avalanche season) never comes. He drew the passes smooth as glass so no
  one trips on a rock, and the caves' ice to hold fast whatever it touches so nothing ever slides.
- **Bar rules:** **ice patches** are his glass roads (the cursor speeds up on them); **hold blocks** are his ice that
  holds on (so you must hold); **snowdrifts** (Act 3) are where his still snow has piled (the cursor slows).
- **Mini-bosses:** Rimehorn (a ram who guards the only pass and takes a toll in headbutts; comic, a little); the Loom
  Matron (weaves the hoard into tapestries; vain about it).
- **Boss: Glacia, the Rime Wyrm.** Keystone: the **Winter Mirror**, the centrepiece of her hoard, which holds the one
  afternoon; he gave it to her, and her scales copy it.
  - Phase 2 edit: "Hold still." He draws every third block into holding ice, and lends her scales the mirror.
  - Phase 3 edit: losing, he does the one thing he came here to stop: he draws an **avalanche**, stripes of ice and
    drift sliding down the bar. The first time we see him break his own rule to win.
- **Restoring:** the mirror cracks; the snow falls down at last; the clocks move on; spring will come, and with it the
  avalanches. Neve: "They'll build the walls again. Like before. That's what people do."
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
- **Mini-bosses:** Rumbleback (paves the drifting flats with basalt; it never sets); Hob & Nob (the forge's two-headed
  hound; one guards, one wants to play).
- **Boss: Bellows, the Forge Titan.** Keystone: the anvil that never cools. Bellows was Mags's master.
  - Phase 2 edit: "Together. Always together." He pins the land still and doubles the chains.
  - Phase 3 edit: the volcano erupts *through* his drawing, the old land pushing back, and he redraws as fast as it
    breaks: everything drifts, the pairs too.
- **Restoring:** the anvil cools; the chains fall; the land holds still; the volcano sleeps. Bellows sits down for the
  first time in years, and Rowan sits with him until he sleeps. (Tender, not a gag.)
- **Beat:** Rowan sees, for the first time, that Ambrose was *right about the problem*: the forge-folk did lose people
  to the lava. Torva's crew was chained in pairs. The question changes from "is he wrong" to "what does a fix cost".

### Region 4: Lanternfen (working id `duskmire`; Team 3 builds it)
- **Original:** a wide coastal fen at the river's mouth: reed channels, stilt villages, and at night a thousand
  lanterns. The sea's tide ran in and out twice a day through the reeds; the fen-folk lived by their tide tables. A
  spring tide at night could drown the careless; a tipped lantern could burn a whole stilt row.
- **His redraw:** "No more fires, and no more night to drown in." He drew the lanterns out and held the sun just under
  the horizon: an endless dusk, never black night, never day. He put the tide on a short leash: in and out every few
  minutes, never higher than a knee.
- **Bar rules:** **dark blocks** (nothing is lit any more; you see only what your own light reaches); **tides** (the
  water never rests: the level on the bar rises and falls).
- **Boss (suggestion): Mirewick, the Fen Angler**, a vast old angler-toad from the deep channels. Keystone: **the last
  lantern**, which Ambrose hung on its lure: the only light in the fen. (The world map already paints a lamp in the
  fen, "the Mirelight": that is the last lantern, seen from afar.)
  - Phase 2 edit: "The tide comes in." He draws the tide higher and quicker.
  - Phase 3 edit: "Lights out." He snuffs the lure: dark everywhere but the cursor's own light.
- **Restoring:** true night comes back, with stars, and the fen-folk light their lanterns one by one: the victory
  image is a thousand lanterns. The tide turns twice a day again; they'll read their tables again.
- **Beat:** he begins to scrape the continent itself for ink: a fen village on the coast goes blank in front of Rowan.
  Vesper's home. An old fen-woman says the river "came down from the north once, before my gran's day" (twist 2 seed).
  Rowan admits he can't swim.

### Region 5: Noonspire (working id `noonspire`)
- **Original:** a high desert plateau of white stone towers and great sundials; the people kept time and direction by
  shadows. Cold, deadly desert nights. The Dawn Order (Solenne) greets every sunrise from the tallest spire.
- **His redraw:** "No one will freeze in the desert dark again." He drove a nail through the sun and pinned it at
  noon: no night, no cold, and no shadows. Without shadows nobody can tell the time or find the way; the heat never
  breaks; the Dawn Order has no dawn.
- **Rule hook (later):** glare and mirages (blocks that blaze or lie), shadowless timing; open.
- **Boss (working): the Gnomon**, the great sundial's needle, stood up as a brass sentinel. Keystone: **the Nail**.
  Edits: he turns the sun's glare on the bar; then he pulls the sun lower and hotter.
- **Restoring:** the sun sets for the first time in months; the first dawn; Solenne's order greets it.
- **Beat: twist 1 (Pip).** Ambrose crosses the sea. The first far isle's fog lifts.

### Region 6: Hushwood (far isle)
- **Original:** a forest isle of giant trees and great storms; the storms toppled trees on villages; Yara's people
  called the forest's spirits to warn them.
- **His draft on the blank:** a forest with no wind and no sound: nothing ever falls. The spirits can't hear anyone.
- **Boss (working): Mother Yew**, an ancient walking yew. Keystone: **the Stopper** (he corked the wind in a jar).
- **Restoring:** the wind comes back; the forest is loud again; the sleepers wake. **Beat:** the scale of the
  sleepers; Yara finds her village asleep under the blank.

### Region 7: Kestrel Reach (far isle)
- **Original:** a cliff isle of rope bridges and climbing towns, wind and gulls; people fell, sometimes.
- **His draft:** the isle drawn in floating pieces at one height: nothing ever falls, so nobody ever climbs.
- **Boss (working): the Great Kestrel.** Keystone: **the Tether**, a gold thread holding the pieces up.
- **Restoring:** the isle comes down to the sea where it belongs. **Beat:** Wren's family; Ambrose starts to fix
  *people's* troubles, not the land's: "No one will ever be far from anyone again."

### Region 8: Thimblewick (far isle)
- **Original:** a makers' town: clockmakers, weavers, copyists. The copyists' archive keeps a copy of the Atlas made
  every hundred years.
- **His draft:** nothing ever breaks or wears out, so nobody needs a maker, so the town stops.
- **Boss (working): the Mender**, a vast clockwork that mends anything broken, including you. Keystone: **the Key**
  that keeps everything wound.
- **Restoring:** things wear out again and the makers go back to work. **Beat: twist 2** (section 5).

### Region 9: Saltmarrow (far isle)
- **Original:** a fishing isle in a stormy sea, a storm wall (Hollis) and a storm-bell abbey (Brann).
- **His draft:** the sea drawn dead calm, flat as glass, until it crusted into salt.
- **Boss (working): Old Brine**, a sea serpent caught in the still sea, salt-crusted. Keystone: **the Glass**, a pane
  laid over the water.
- **Restoring:** storms again, and the bell rings for a reason; Brann speaks his first words in the game.
  **Beat:** Ambrose erases Meridian (section 5). The capital goes blank on the world map.

### Region 10: Farlight (far isle)
- **Original:** a beacon isle whose lighthouse guided ships home; Fizz's flame-brews fed its light.
- **His draft:** a light that never goes out, turned inward: the lamp over his drawing table on the Margin, burning
  the isle's own ink to keep it lit.
- **Boss (working): Lumen**, the lighthouse made to walk. Keystone: **the Flame**.
- **Restoring:** the beacon points out to sea again; and Meridian is restored (Rowan walks into the blank Atlas Hall
  and wakes Hesper). **Beat:** the oldest law; Hesper's silence; Pip's anger at her.

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
| the fen's map label "Duskmire" | **Lanternfen** (the id `duskmire` stays) |
| the act clear / world map's "weight" pips (12 dots) | 12 small compass roses, lit as regions are restored |
| item: Pendulum Shard (effect "Tick, Tock") | **Keystone Shard** (effect "Fresh Ink": every 10th combo hit draws a green block) |
| Bellows's anvil "with the brass pendulum weight" | the anvil that never cools, glowing gold ink along its edge |

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

Status (round 8, chunk 1): Regions 1-3 rewritten (`story.ts`, `story-ash.ts`), editor-passed, tests updated. Still to
do: the `road` hook; the hero arrivals' home lines (`meet*`); banter that follows the story (lines gated on scenes, like
`banter-ash.ts`); a welcome for returning players (their save never replays the new intro); Region 4's scenes with
Team 3; the bosses' portraits and the two new speakers' (`portrait_mapmaker`, `portrait_keeper`: until they exist the
story view shows Phaser's missing-texture box); `keeper` belongs with the allies' warm look in `view/story.ts`.
