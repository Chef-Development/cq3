# Combo Quest 3: status report (M4a "depth" + playtest rounds 3 and 4)

- **Live build:** https://chef-development.github.io/cq3/ (installable PWA, landscape). Every push deploys.
- **Branch:** `claude/m4a-depth`, PR Chef-Development/cq3#4. PR #3 (M3b) was still open, so M4a is built on top of
  it: #4 includes #3 (and #2) and supersedes them (merge #4; #2 and #3 can be closed).
- **Tests:** 504 Vitest unit tests (`npm test`, in CI), 15 Playwright smoke tests and 26 pixel-exact screenshot tests
  (42 baselines; M4a: relic pick, relic belt and panel, act-clear build, relic unlocked, shop relics, Sable's tutorial
  and two-cursor bar, hero select, skill tree, relic log, Sable joining the camp; round 3: the tip cards, the relic deal
  and flight, the combo flourish; round 4: the map extras, the living maps, the new world map, and a test that nothing
  on the world map follows the camera).
- **Round 4 in one breath** (sections 7-10): New game wipes everything; the act maps got wandering packs (ambushes), a
  travelling merchant, Coin Rush, bounties, secret caches and critters; the world map became a continent you drag
  around with Greenmarch's acts as landmarks; the difficulty was re-aimed at the playtester (85%) after finding why they
  felt immune; then fixes from their phone (world-map gulls and clouds, a fractional HP readout, a late red-block tip,
  and an app that kept running old builds).
- **Built by:** a foundation pass (the data for 40 relics, both heroes and both skill trees; a fight-hook system; XP,
  levels and skill points; relic offers and unlocks; profile v3 and run save v6), then seven parallel agents (relic
  effects, Sable's two cursors and her tree, Rowan's tree and XP pacing, the fight UI, the camp UI, the art, the music),
  merged, rebalanced and checked together.
- **Playtester accuracy:** 80-90% (round 4). The curve is now aimed at an 85% player (`TYPICAL_ACCURACY`), the
  playtester, on a fresh first playthrough (section 8).

## What M4a adds

### 1. Relics (rule-changing run picks)
- **The pick after a fight** offers mostly relics plus at most one stat card (55% of picks have one). Relics use the
  card rarities (19 common, 17 rare, 4 epic), are never offered twice, and follow the boosts' carry/reset rules: they
  carry from act to act, a retry restores the act-start set, a new run starts with none. Elites, bosses and treasure
  guarantee a rare (or better) card. Shops sell relics too (x1.25 a card's price).
- **Every relic changes a rule or a decision, with at most one number** (the text shows it; `tuning.relics.n` has a
  slider for each). The user's 14 examples are in as written (Powder Keg, Short Fuse, Sharpshooter, Glass Edge, Iron
  Rhythm, Hoarder, Overcharge, Greenhouse, Chain Reaction, Night Watch, Purple Pact, Momentum, Last Stand, Gold Fever)
  plus 26 more, e.g. Sapper's Fuse (every 4th red is a bomb), Blast Wave (yellows a blast clears count as hits),
  Parting Gift (a bomb after each finisher), Weak Spot (the first hit after a block crits), Ricochet (a crit also hits
  the next foe), Mirror Guard (a Perfect block throws the attack back for the red's own damage), Turtle Shell (shields
  need one tap less), Shieldbearer (only blocks fill the meter, x3), Crescendo (+1% finisher per combo), Clutch (a miss
  keeps the combo but costs 3% HP), Overdrive (at 30+ combo deal and take double), Sweeper (the finisher keeps the
  combo), Quick Draw (a 1-stack finisher x3), Echo Strike (the finisher hits again for 50%), Blood Price (finisher x2
  for 10% HP), Verdant Surge (a green hit banks a stack), Evergreen, Photosynthesis, Hunting Owl, Lucky Penny, Treasure
  Nose, Wingman, Vampiric Fang (hits heal 1, rests heal nothing), Field Rations, Tithe (rests cost 20 coins, heal fully),
  Haggler (the first buy in each shop is free).
- **Synergy:** 10 tags (Bomb, Crit, Block, Combo, Finisher, Green, Pip, Sustain, Coins, Risk), 1-2 per relic. Offers
  lean toward tags you own (each shared tag x2.2 more likely); a card that shares a tag shows a gold "Synergy!" badge
  with the shared tag lit. The act-clear screen names the build from the top tags ("Bomber", "Crit Fiend", or a pair:
  "Demolisher", "Glass Cannon", "Counterpuncher", "Maestro"...), with the tag chips and the relics collected.
- **In fights:** the owned relics sit as an icon belt under the coin chip; an icon bobs when its relic kicks in, and a
  short popup names it (with damage, heals, coins or stacks). Tapping an icon pauses the fight and opens the relic
  panel (every relic's icon, name, tags, text, "kicked in N times this fight"); taps on the belt are never bar taps.
- **Unlocks:** 25 relics from the start; 15 unlock: 2 per first act clear, 1 per act for the first elite won, and 6 from
  event choices (one per event). "New relic unlocked!" cards show on the act clear, after an elite's loot and on the
  event's outcome. The relic log at camp shows all 40 (locked ones as silhouettes with how to unlock them), NEW marks
  and "Relics 27/40".
- **Replays** of a cleared act draft relics first: 2 relic-only picks per act behind ("Starting relic 2/4").
- **How it works (code):** `src/core/hooks.ts`. Combat collects the hooks of the hero's kit, learned skills and relics
  and calls them at fixed points (crit chance, hit damage, after a hit/block, meter, combo, combo break, miss, trap,
  impact, finisher, pecks, kills, bombs). Every relic has a with/without unit test (`tests/unit/relics.test.ts`, 60).

### 2. Sable, the second hero (Twin family: two cursors)
- **An original dual-dagger ninja** (hooded, indigo with a teal scarf). After Act 1, Sable tries to rob the camp, Pip
  catches them and they join (a 6-box scene in the game's tone; it plays at the camp, or before Act 2 if you go on).
- **Controls:** the bar is split. Cursor A sweeps the left half, B the right half, each at the normal pass time; they
  move in step, half a bar apart. A tap on the left half of the screen judges A, the right half B; a swipe is the
  finisher. Reds cross B's half, then A's, so either cursor can block them. Yellows and greens spawn inside either half
  (never across the middle). One shared combo. The bar draws a blue A and a violet B cursor, a divider and a tint per
  half. Sable's first fight shows the two tap zones before "Tap to begin".
- **Kit:** hits deal 0.7x Rowan's. Passive **Ambidextrous**: a hit with the other hand than the last fills the meter
  25% faster. Green ability **Shadow Step**: for 3 s, a hit with one cursor also hits (or blocks) what's under the
  other. Finisher **Twin Fang**: hits the current target alone for x1.4 the usual finisher damage; a kill keeps a
  stack (Rowan's Whirlwind hits every foe).
- **Art:** a full sprite set (idle, run, a strike per hand, both-hand strike, wind-up, block, hurt, KO, leap, finisher
  dive), portrait, map walker, a camp pose by the fire, and hero cards.
- **The bot** plays Sable with two thumbs: an independent timing error, tap rate and pending tap per hand.
  **At the same accuracy, Sable is within +/-10 points of Rowan** (first-try clears and first boss fights won, per
  act): a 70% player 0 to +5 points, an 85% player 0 to -10 (Act 3). The gap leans with skill, and repeat runs on
  other seeds move it by about 4 points. Sable has 125 base HP (Rowan 100). `npm run twin` compares them;
  `tests/unit/twin-bot.test.ts` guards it.

### 3. Hero levels and skill trees
- **XP** from kills (elites and bosses more, more per act) and act clears (double the first time) goes to the hero who
  fights. Levels 1-30: +2 max HP and +1.5% base attack per level, and a skill point every 2 levels (15 at 30). A
  typical first playthrough reaches level 3 by the Bandit Captain, 6 by the Golem, 8 at the Boar King and about 9-10
  after the region; six Act 3 replays add about 5 more. Level 30 is far away (later regions).
- **Each hero has 3 branches of 5 nodes**, learned in order: two stat nodes, two rule nodes, then a capstone.
  - Rowan: **Blade** (Keen Edge, Steady Aim, Follow-Through: overkill carries to the next foe, Whetstone: every 5th
    combo hit crits, capstone **Executioner**: foes under 30% HP take double from yellows); **Bulwark** (Stout, Plate
    Training, Parry: a Perfect block pushes every red back, Shield Bash: breaking a shield stuns its owner, capstone
    **Shield Wall**: 5 blocked reds charge a bubble that absorbs one unblocked hit, once a fight); **Momentum** (Rhythm,
    Power Stance, Double Time: a Perfect hit is 2 combo, Charged Up: fights start with a stack, capstone **Unbroken**:
    a combo break halves your combo and stacks instead of zeroing them).
  - Sable: **Crossfire**, alternating hands (Flurry: every 4th alternating hit crits, Twin Rhythm: an alternating hit is
    2 combo, capstone **Whirling Blades**: 6 alternating hits in a row start Shadow Step); **Shadowguard**,
    cross-blocking (Cross Guard: one block covers both cursors, Counter Slash: left-cursor blocks hit back, capstone
    **Afterimage**: each block leaves an afterimage that stops the next red in that half); **Quicksilver**, speed and
    both hands (Blur: above 1.6x cursor speed hits crit, Double Down: hits with both cursors within 120 ms deal x2,
    capstone **Quickening**: every 20 combo banks a stack).
- **Camp:** reachable mid-act too (playtest: a Camp button on the act map, bottom right; "Act N map" brings you back
  to the same spot). The title's **New game** wipes everything (tapped twice; settings and calibration stay; round 4);
  Continue keeps it all. The gear panel's Start over does the same, asked twice. A hero chip (face, level, XP) and both heroes by the fire; the **hero select** (art, family, bio, level and
  XP bar, the kit with its numbers, points, Pick; gear is shared); the **skill tree** (three branch rows of five linked
  nodes, points left, a node card with the text and its before/after: "ATK 12 > 13" or "Now: ... / With it: ...",
  Learn with the reason when you can't, a free Reset with a confirm tap); the stats screen per hero, with level and
  skills in the breakdown. The fight HUD shows a level chip; act clears show "+N XP", the XP bar and "Level up!".
- **Branch balance (bot, 70%):** Act 3 first-try clear by the branch the bot focused: Blade 66%, Momentum 68%,
  Bulwark 76% (Bulwark's defence matters most against Act 3's big hits; it was 85% before Shield Wall became once a
  fight and the numbers moved).

### 4. A soundtrack per act (`src/engine/music.ts`)
- Act 1, Meadow Road: D major, 128 BPM, bouncy. Act 2, Old Ruins: E Dorian, 104 BPM, a rolling echoing arpeggio.
  Act 3, Boar King's Hollow: C minor, 140 BPM, war drums. Each act's melody has a calm arrangement (flute, music box,
  light pad: map, nodes, scenes) and an intense one (fights), crossfading on the beat.
- Bandit Captain: an A minor jig in 6/8. Ruin Golem: D Phrygian, 74 BPM, stone stomps. Boar King: G minor, 156 BPM;
  phase 2 adds drums and brass stabs, phase 3 moves up a whole step with everything in. Camp: a quiet Bb major
  lullaby in 3/4. Title and world map keep the old map theme.
- **Combo layers:** drums join at combo 10, bass at 25, lead at 50 (sliders in "Music"), on the beat; they drop back
  after a combo break (a finisher holds them 2 s).
- All of it is in the Sound lab (a button per piece, a combo picker, "Game's music"). The audio tests render every
  piece across its loop point and check levels (no clipping, impacts and telegraphs over the music, layers add up,
  the Boar King escalates and changes key, crossfades have no gap, under 320 new audio nodes a second).

### 5. Saves
- **Profile v3** (same storage key): the picked hero, each hero's XP and skills, the relics unlocked (and which are
  new), Sable met, the twin tutorial shown. A v2 profile is migrated: Rowan gets the cleared acts' first-clear XP and
  their act relics unlock. (A v2 profile with all three acts cleared lands at level 7.)
- **Run save v6:** the hero's relics, the act-start relics, a replay's starting picks left. A v5 save is migrated (no
  relics yet), so a run in progress survives the update; v4 still migrates through v5.

### 6. Playtest round 3: "too many numbers, cluttered"
- **Clarity pass:** the fight shows only what you act on (no stat row, no enemy attack chip, no stat rain); gear
  reads in plain words and short numbers (`fmtStatShort`); the bag's compare is one verdict band (better / worse /
  side-grade); a loot card shows its top 3 stats.
- **Tips, taught slowly** (`src/data/tips.ts`, 23 tips; `core/tips.ts` picks at most one at a safe moment): a card
  points at the thing it's about and pauses the fight while it's up; each is shown once (kept in the profile); the
  gear panel can turn tips off or show them again. A returning player's first launch of this version plays a short
  welcome back from Pip over the title (what's new; once).
- **Polish:** fight pop-ups share one lane; combo milestones flourish on the music's beat; relic picks are dealt like
  cards and the pick flies to the belt; act clear, defeat and victory have one clear headline each; map tags are
  icons first; Sable stands on the title once met; the camp lives (fire, idle heroes, banter lines from
  `src/data/banter.ts`, quiet while a tip or scene is up); hero select uses plain one-line kit text.
- **Asked in the same round:** a Camp button on the act map; "New run" says "Keeps your gear", and a real Start over
  (gear panel, asked twice) erases the profile.

### 7. Playtest round 4: map content ("the main map needs more activity")
Another agent did the living scenery, critters and coin sparkles; this part is roaming foes, events and more to do
between fights. Icons first, few words, no new HUD rows (the bounty tracker sits in the top row, left of the coins).
- **Wandering packs** (`core/roam.ts`): 1 pack on Act 1's map, 2 on Acts 2-3 (`acts[i].packs` in greenmarch.ts, two
  waves each, tougher later). They stand beside a node, red-outlined with a "!", and step along the links each time
  Rowan moves; the next step is telegraphed (a marching dotted line, an arrowhead, a ring on the node). A reachable
  node a pack would meet you on is tagged "Ambush" (its foes counted in). Stepping onto a pack, or onto where it is
  stepping, is an **ambush**: on a fight node its waves join the fight; elsewhere it's fought first, then the stop
  opens. Packs never touch the boss, rests, elites or the first row, and the hero always has a clear next step (a step of
  look-ahead; the tests walk every path of 75 maps). Deterministic from the map seed and the path (never saved).
- **Coin Rush** (one per act: a fight node mid-act becomes a coin sack stop): 12 s on the real bar against a Coin
  Sack that never attacks (`Combat` with `rush`); every hit knocks coins out, more on a long combo; the enemy plate is
  the clock; "TIME'S UP!" and the haul. A reload mid-rush ends it with what you had.
- **Bounties** (one board per act, early): one goal for the act (block 25 reds, a 40 combo, beat an elite, win above
  80% HP, 2 waves without a miss, 15 foes), Take it or Pass; a tiny tracker (icon + 12/25, a tick when met).
- **Secret cache** (one per act): a mossy boulder beside a node, shown when that node is in reach; standing there, its
  crack glows and a tap opens a richer chest with a pick of **every** relic (a locked one unlocks).
- **Travelling merchant** (one per act map): roams like a pack (gold telegraph, "Trader" tag); meeting her opens a
  small shop (one rare-or-better relic and a potion, 15% off), then the node's own stop.
- **World map skirmish:** once Act 1 is cleared, after every 8 fights won a foe paces the Meadow Road with a "!"; tap
  it: a card (its foes, Gear + XP), Fight: one skirmish from a cleared act (a group, then an elite) as a hero who has
  been through that act; gear and XP, then back to the world map. State in the profile (`wander`): one at a time, used
  up when the fight starts, a reload never brings another.
- **Tips:** one each (roamer, rush, bounty, secret, merchant, skirmish). **Saves:** run save v7 (a v6 save's act goes
  on with a plain map; the next act has the extras); the profile stays v3 (`wander` optional).
- **Reward sizes (for the rebalance):** ambush +15 coins x act and 1 extra Uncommon+ item, its pick at least rare;
  Coin Rush 1 coin per hit, +1 per 15 combo, +1 per perfect, a finisher 4 x stacks (the bot makes ~39 per rush at
  70%); bounty: 50 x act coins, or a Rare+ item, or a relics-only rare pick; secret: 2x a chest's coins, 1 Rare+ item,
  an epic-or-better pick of every relic; merchant: 1 relic (rare+) and a potion at 0.85x; skirmish: 1 Uncommon+ item
  and 40 x act XP. All in `tuning.extras/roam/rush/quests/secret/wander`, with sliders ("Map extras", "Coin Rush",
  "Bounties, secrets, skirmishes").
- **Balance effect** (bot, 70% player, 300 runs, the same seeds, extras off -> on): Act 1 first try 100% -> 99%,
  Act 2 87% -> 93% (above its 85-90% target: the extra kills, items and picks help), Act 3 70% -> 74%, the Boar
  King's first fight 74% -> 77%. The bot meets ~0.4 / 0.7 / 0.7 ambushes
  per act attempt. A first cut with a two-relic, 30%-off merchant pushed the Boar King to 81-84%, so she was trimmed.
  The bot guards pass; re-run `npm run balance` after merging with the combat retune.

### 8. Playtest round 4: balance ("the scaling gets insane later: basically immune, huge damage, free combos")
Measured first with the bot (new: `npm run snowball`, per act and node type: HP lost per fight, the foes' share of it,
fight length, damage per second, combo, where each stat comes from, ablations, and a **veteran**: a full playthrough,
6 forged Act 3 farms, then Acts 1-3 replayed; `npm run perks`: each relic and skill node alone on a typical Act 3 hero;
`AVOID=relic` on snowball/twin weighs one relic against going without it). Found:
- **Reds almost never reach an 85% player.** About 99% are blocked or knocked off the bar (a red crosses the cursor's
  path 2-3 times in its 2.8 s, the red grace is 40 ms, finishers and kills clear reds). In normal fights the foes took
  1.2% / 3.0% / 1.2% of max HP per fight in Acts 1 / 2 / 3: less in Act 3 than in Act 1. What an 85% player loses is
  their own relic prices (Clutch, Glass Edge, Blood Price, Purple Pact); with stat cards instead of relics they lose
  4-6% a fight. Enemy HP and attack barely move them (doubling Act 3's numbers: Boar King 85% -> 70%, while a 70%
  player's first Act 3 try drops to ~15%).
- **The replay kit was from the stat-card era.** A replayed act started with +22% damage, +8.5% crit, +0.77 crit
  damage, +0.82 combo power and +68 HP per act behind (on top of the relic drafts); a real 85% story run gains about
  +1% / +0.3% / +0.03 / +0.03 / +15 HP per act now that relics replaced most stat cards. The veteran's Act 3 replay:
  ATK 67 vs 35, HP 410 vs 230, crit 43% vs 12%, crit damage x4.1 vs x2.3; normal fights 7% HP and 11 s; every farmed
  Boar King won (99-100%).
- **Kill gains were half the hero's attack by Act 3** (+0.25 ATK and +1 max HP per kill: +17.8 of 35 ATK, +70 HP),
  and later acts send more foes per fight. The biggest single source in the ablations (without it an 85% player's
  Act 2 first try fell 97% -> 58%); gear, levels, skills and stat cards each moved it 0-10 points.
- **Damage per point of ATK doubles over the region** (3.2 -> 6.7 for an 85% player): crits climb 18% -> 43% through
  the Perfect rules (Sharpshooter, Weak Spot, Whetstone, Battle Focus), Rowan's finisher hits every foe of the bigger
  Act 3 waves, and relic perks. That is the build working; not trimmed.
- **Sable's Afterimage made her immune:** every block recharged it, so the next red was always stopped (bench: Boar
  King 10% -> 100% won, the foes' damage to 0).
- **Not dominant:** Defense (16-40 DEF cuts 14-29% off reds that rarely land), levels (+2 HP, +1.5% base attack a
  level), Double Time, Twin Rhythm, Chain Reaction, Unbroken, Sweeper, Quickening (each within a few points when the
  bot goes without it, or a capstone a story run doesn't reach), gear growth per item level (2.6-2.9x by Act 3 against
  enemy HP x2.4 plus rows; gear is 13% of a story hero's ATK). The map extras are not part of the snowball (no trims).
- **Clutch becomes the one dominant relic once reds land** (+33 points at the Boar King): a miss keeps the combo and
  every banked stack, so the finisher never resets. Trimmed to 4% (below).

Changed (one line each; every number in `tuning.ts` with its slider; the second pass, "faster reds", after the lead
picked option (a)):
- **Later acts' reds are faster** (new per-act `acts[i].redSpeed` in greenmarch.ts, slider "Red speed x"): x1 / x1.05 /
  x1.15, so a red crosses the bar in 2.8 / 2.7 / 2.4 s and the cursor gets fewer passes at it. Readable (you see it
  move faster), no grace window touched; `data.test.ts` checks every formation stays blockable at the fastest act, on
  Sable's bar too.
- **Sable: her bar's reds speed up `sable.actRedSpeed` = 3.5x as much** (Act 3: x1.5 on her bar). One line: her two
  half-speed cursors ride along with a red on the way back, so a faster red cost Rowan a pass but her almost nothing
  (+20-40 points over Rowan for a 70% player without it).
- Sable also: hits 0.7x Rowan's, 125 HP, static blocks x0.85 (she taps more, so this keeps her misses per fight, and
  what Clutch charges, near Rowan's), reds x0.55.
- `tuning.kit` re-measured from an 85% story run: per act behind +3.7 ATK, +16 HP, +0.5% damage, +0.3% crit, +0.025
  crit damage, +0.035 combo power, +1 Pip (was 6.8 / 68 / 22% / 8.5% / 0.77 / 0.82 / 6.8); `kit.relicPicks` 2 -> 3.
- Kill gains: +0.15 ATK and +0.6 max HP per kill (was 0.25 / 1).
- **Clutch costs 4% HP per miss** (was 3%). With reds landing it was worth +33 points at the Boar King (the bot without
  it: 71% -> 38%); at 4% the default and cautious bots end level (74% / 74%). At 5-6% it hurt Act 2 more than it paid.
- Afterimage (Sable's capstone): stops {n} = 2 reds a fight (was every block recharging it); text, slider, unit test.
- Act 2: enemy HP x1.4 (was 1.6), attack x5.5 (was 4.4). Act 3: HP x3.6 (was 2.4), attack x8.5 (was 11.4): more of the
  danger is reds landing, less is each hit's size. The Boar King's attack 18 -> 15 (a 70% player clears Act 3).
- `TYPICAL_ACCURACY` 0.7 -> 0.85; `tests/unit/bot.test.ts` for 85%: Boar King 60-75% for the default and a cautious
  bot, Act 3's foes' share at least 2x Act 1's (Act 2 in between), a 70% player clears Act 3 with retries, normal fights
  never get shorter; `twin-bot.test.ts` guards Sable at 85% (unchanged +/-10).
- Measurement only in `bot.ts` (fight cost, HP by source, stat sources, combo, `noGear` / `avoid` options, replay
  costs); docs/balance.md gains "What a fight costs" (and a cautious player's), and "A farmed replay still costs HP".

| 85% player (playtester) | Act 1 first try | Act 2 first try | Boar King first fight | HP lost per normal fight, Act 1 / 3 | from foes alone, Act 1 / 2 / 3 | Normal fight, Act 1 / 2 / 3 |
|---|---|---|---|---|---|---|
| Before | 100% | 94% | 96% | 7% / 24% | 1.2% / 3.0% / 1.2% | 15 / 21 / 18 s |
| **After** | **100%** | **84%** | **74%** | **8% / 39%** | **1.4% / 4.7% / 5.1%** | **16 / 21 / 22 s** |
| Cautious, after (no Clutch, Glass Edge, Blood Price, Purple Pact) | 100% | 90% | 74% | 5% / 23% | 1.8% / 12.1% / 19.3% | 16 / 25 / 28 s |

| 70% player | Act 1 first try | Act 2 first try | Boar King first fight | Act 3 cleared in 6 tries | HP lost per normal fight, Act 1 / 3 | Normal fight, Act 1 / 3 |
|---|---|---|---|---|---|---|
| Before | 100% | 87% | 75% | 100% | 11% / 12% | 18 / 22 s |
| **After** | **98%** | **67%** | **31%** | **87%** (farming the Boar King: 30% -> 73% over 6 replays) | **12% / 37%** (foes 4% / 25%) | **19 / 29 s** |

"Before" is the old tuning on this branch (map extras in; snowball, 300 runs); "after" is docs/balance.md (1,000 runs;
cautious 500).
- **The foes' share, 85%:** the default bot takes 5.1% of max HP from foes per Act 3 fight, the cautious one 19.3%
  (the asked 8-12% sits between them). The default bot's relics end fights faster and its long combos speed the cursor
  up, which gives it more passes at each red; it pays in relic prices instead (39% HP lost per Act 3 fight in all).
- **Farming, 85%:** Boar King 75% in the story; replays 64-72% -> 88-92% over six (the first replay drafts 6 relics
  against ~14 earned in the story, so it starts a little under). A farmed Act 3 fight still costs 17-21% HP (story 38%).
- **Sable vs Rowan:** within +/-7 points at 70% and 85% in every act (worst: 85% Act 2 +7, Act 3 -7).
- **Boss one-shots:** none (Boar King HP 6.5x a max-stack finisher).

### 9. World map: bigger and alive (playtest: "barren and empty, it doesn't feel large enough")
- **3 screens wide, 2 tall** (960x300 game px), dragged to explore: a press that moves over 4 game px pans (with
  momentum, clamped, never starts anything); one released in place is a tap. The HUD stays put in the safe areas. It
  opens on Rowan's act; the first visit glides in from the far east (1.95 s, any tap skips; `profile.worldTour`, so
  existing players see it once). Off screen, Rowan gets a small edge chip that brings the view back.
- **Greenmarch's acts are landmarks** on a winding road: the Bandit Captain's camp by the Meadow Road's village,
  fields and windmill; the Old Ruins (broken towers, the Golem's hall); the Boar King's hollow tree in its dark autumn
  wood. A tap selects one (gold ring, the view eases to it, a small card: name, "Begin/Continue the story" or
  "Replay (farm)", Play); out of reach, a tiny padlock shakes. Flags fly over cleared acts. "Tap to begin!" stays over
  Rowan only before Act 1 is cleared; then the landmarks are the call to action (tap Rowan for the act picker).
- **Dense everywhere:** a harbour with piers and boats, the lighthouse islet, a forest lake under a waterfall,
  orchards, standing stones, campsites, a cove; the capital as a walled town round the Pendulum on the Silverrun;
  islets, reefs and ships. The locked lands are painted as richly (Frostpeaks' peaks, keep and frozen lake; Ashfell's
  volcano and lava rivers; Duskmire's stilt village and Mirelight; Noonspire's floating sun temple) under a soft fog
  with a cloud wall at each frontier; a tap thins it and names the land.
- **Alive, only what's in view:** ships, whale, gulls, dolphins, crows over the woods, a cart and walkers on the
  roads, chimney and capital smoke, fires, waterfalls, snow, volcano smoke and steam, wisps; the wanderer and the
  sparkle re-placed for the new map. Warm light from the west; the far north hazes into a cloud band.
- **Cost:** painted once after boot in idle slices (~40 steps, ~300-450 ms total on this shared VM, longest step
  ~25-38 ms), so boot paints none of it (the old map was painted twice during boot, 125-210 ms each here); opening
  the map early finishes it at once. ~11 MB of textures.
- **Tests:** a smoke test (the reveal and its skip, a drag that starts nothing, a landmark's card, Play); screenshots
  of the map opened on Greenmarch, panned to the locked lands, and an act landmark selected.

### 10. Playtest round 4: New game, living maps, and the fixes from the phone
- **New game wipes everything** (playtest: "I want new game to wipe everything"). The title offers Continue (the run,
  or the world map with everything kept) and New game whenever anything is earned (`anythingToErase`); New game is
  tapped twice ("Tap again / Erases all") and erases the profile and the run (settings and calibration stay), then
  reloads fresh. The gear panel's Start over does the same. So a game is now a fresh first playthrough plus optional
  replays and farming inside it (which is what the balance targets measure).
- **Living maps** (`view/map-life.ts`, `world-life.ts`, `life.ts`, `art-life.ts`, `core/sparkle.ts`): per-theme critters
  on the act maps (rabbits, sparrows, a frog, leaping fish, a hawk; a hedgehog, crows, moths; a squirrel, a doe, spores)
  and gulls and dolphins at sea on the world map; tapped, they startle (Pip chirps). A rare sparkle pays 1-2 coins with
  a tiny "+1" pop: at most one per act-map step and one per world-map visit, deterministic and remembered in the
  profile, so a reload never pays twice. Life stays on open ground, off nodes, roads, tags, roamers and the HUD, and
  only gets taps nothing else takes. Numbers in `tuning.life`; three soft sounds in the `SFX` catalog; one tip.
- **Fixes from the phone:**
  - **World-map gulls and clouds followed the camera** (they were drawn in screen space; a drag carried them along).
    Both now live in world space. A screenshot-suite test freezes the clock, pans the map and checks that every
    sprite on it moves with the map; it fails on the old code (exactly on the gulls).
  - **HP read "96.19999999999999/101"** on the act map: HP is fractional inside (kill gains are +0.6 max HP, Defense
    cuts, heals in shares) and the map, rest, shop and defeat screens printed it raw. `hpLabel` (view/shared.ts) rounds
    up and never shows more than the max, as the fight HUD already did.
  - **The red-block tip came in the second fight.** Two pacing rules held it back: the pre-fight yellow tip started
    the 4 s gap (so early reds were skipped), and the special-move tip outranked it with two tips per fight at most.
    Now the first red's tip comes first and the pre-fight tip doesn't start the gap; a unit test plays Act 1's first
    fight on 60 seeds (the old rules missed the first red in all 60).
  - **The phone kept running old builds** (a home-screen app sits in the background with what it loaded, so two fixes
    "didn't work"). The build now writes `version.txt` (never cached); when the app comes back to the front it checks
    it and reloads if a newer build is deployed (the run saved first; never mid-fight). The gear panel's foot shows
    the build ("Build 3570bb0 Oct 6 ..."). Smoke test with a stubbed version file.
  - Playwright's preview port comes from `PORT` (worktrees serve their own build instead of reusing another's).

## Balance (docs/balance.md: 1,000 whole runs per player; farming 333 players per row)

Round 4 (section 8) aimed the curve at the playtester (85%); M4a's numbers below that table are history.

| Player | Act 1 first try | Act 2 first try | Act 3 first try | Boar King first fight won |
|---|---|---|---|---|
| 55% | 89% | 44% | 16% | 21% |
| 70% | 98% | 67% | 27% | 31% |
| **85%** | **100%** | **84%** | 68% | **74%** |
| 95% | 100% | 99% | 94% | 96% |

M4a: relics replace most stat cards, so the hero grows by rules, levels and gear instead of numbers. Re-measured with
the bot (synergy-greedy picks, one skill branch at a time) and rebalanced (then for a 70% player) so fights kept their
length.

- **Win rates with relics:** builds the bot ends with at the Boar King are mostly Counterpuncher (Block + Finisher),
  Maestro (Combo + Finisher) and Demolisher (Bomb + Finisher), all winning 74-78% of first fights. Per relic, most
  sit at 74-80%; the standouts are Verdant Surge (94%, epic), Evergreen (87%), and at the low end Blood Price (68%)
  and Tithe (70%). The bot carries about 5 relics into the Captain, 12 into the Golem and 19 into the Boar King.
- **Relics vs stat cards:** the same player taking stat cards only (as before M4a) clears Act 2 first try 97% and
  wins 84% of first Boar King fights on these act numbers: as the bot plays them, relics are worth a little less raw
  power than all-stat picks, and the acts were eased to match. A player who builds around a relic's rule should do
  better than the bot, which doesn't change how it plays for most relics.
- **The bot leaves Glass Edge and Clutch alone below 80% accuracy** (they charge HP for every miss): picking them
  blindly cost a 70% player a third of its Act 1 runs. That's the decision those relics are meant to pose.
- **Farming still pays:** replaying Act 3 raises a typical player's Boar King win rate from 71% (story) to 97-100%.
- **Sable vs Rowan** (same accuracy, same tuning): within +/-10 points per act (table in docs/balance.md).

## Decisions I made (please check)
1. **Sable's two cursors move in step** (A over the left half, B over the right, half a bar apart), not
   independently. Easier to read with two thumbs, and the judge stays one cursor history.
2. **Twin Fang** (Sable's finisher): hits only the current target, x1.4, and a kill keeps a stack; it still clears all
   reds like Rowan's.
3. **Shield Wall** is once a fight (5 blocks charge it). As "every 5 blocks" it made Bulwark win almost every fight.
4. **Unbroken** halves the combo AND the stacks (combo alone does little: it only speeds the cursor).
5. **Clutch** costs 4% of max HP per miss (a flat 3 HP was nothing by Act 3; 3% was worth +33 points at the Boar King
   once later acts' reds got faster, round 4).
6. Relics in a pick: 55% of picks have one stat card. The relic shop price is x1.25 a card's.
7. **Starting HP:** a new run now starts at full HP including gear (it started at the base 100 before).

## Still unverified on the iPhone (checked in headless Chromium and Node)
- **Round 4:** the faster reds in Acts 2-3 (tense or unfair?); the world map's drag on a real thumb (a press that
  moves 4 game px is a drag) and its paint time (~300-450 ms in idle slices on the VM); whether the Act 3 map reads
  clearly with packs, the merchant, tags and critters on it; that the app now updates itself when brought back.
- **The music is checked by measured levels only:** nobody has listened to it. Please listen on the phone (speakers
  and headphones): the act themes, the boss themes, the camp, and the combo layers coming in at 10 / 25 / 50.
- Sable's two tap zones with real thumbs: whether in-step cursors read well, and whether 0.7x hits feel weak.
- Relic text on the cards at 8x (two lines each), the relic belt's tap targets, the skill tree's node size.
- The relic popups' pace in a busy fight (each perk names itself at most every 3.5 s).
- Everything from M3b's list that is still open (the launch fix on a cold start, loot timings, camp tap targets).

## Known gaps and suggested next steps
1. **Feel-check the faster reds on the phone** (Act 3: 2.4 s across the bar, Sable's 1.9 s). If they read as unfair
   rather than tense, lower `acts[2].redSpeed` (x1.15) and raise `acts[2].atkMult`; for Sable, `sable.actRedSpeed`.
2. **Sable takes more hits than Rowan for a skilled (85%) player** in Act 3 (3.8 vs 2.5 a minute; her 125 HP covers
   it). Her reds are narrower (x0.55) and faster in later acts: if blocking feels unfair, give back red width and HP.
3. Bulwark is still the safest branch (+8-10 points in Act 3); if it reads as "the right answer", trim Parry or
   Shield Bash next.
4. Some special moves place blocks at set spots and don't know about Sable's middle line; a safety net moves such a
   block into one half (it can overlap a neighbour). Teaching `specials.ts` about the halves would be cleaner.
5. Sable's accuracy readout uses Rowan's calibration and reads 3-4 points low; a Sable table would fix it.
6. The shrine (gacha) is still locked; the other backlog items are in docs/backlog.md.
7. **Round 4 targets not fully met:** the default 85% bot takes 5.1% of max HP from foes per Act 3 fight (target 8-12%;
   the cautious bot takes 19.3%), and a 70% player is now much harder pressed (Boar King first fight 31%, Act 3
   cleared within 6 tries 87%, farming lifts it to 73%). Fine while the playtester is the only player.
8. The world map: mountains look a bit regular in places; frame rate judged by eye only; the paint time on the phone
   is unmeasured.

## History

### What M3b added (the camp, gear and the forge; playtest round 2)

#### 0. Accuracy readout (gear panel and every act-clear screen)
- Measured with the balance bot's own definition: the share of plain yellow blocks the player would hit at the
  starting cursor speed. Every tap aimed at an isolated yellow (no other block or wall turn within 150 ms) gives a
  timing error; the median and spread of the recent ones are mapped through a calibration made by running bots of
  known accuracy (`npm run calibrate`), then the bot's formula gives the number. A unit test plays 55%, 70% and 85%
  bots and checks they read back within 4 points.
- **Gear panel > "Your accuracy"** (top, open by default): the number, "from N recent taps · timing spread ±S ms ·
  T ms late/early on average", a meter with the "tuned for 70%" mark, the history (one entry per act cleared) and a
  Copy button that copies a one-line summary to send back.
- **Act clear:** "Accuracy this act: 74% (212 taps)".
- **Retargeting:** the curve is set for `TYPICAL_ACCURACY = 0.7` (`src/core/bot.ts`). `ACC=0.62 npm run retarget`
  searches one multiplier per act (enemy HP and attack) so a player of that accuracy gets the same curve (Act 1
  ~99% first try, Act 2 ~87%, the Boar King ~70% of first fights), and writes docs/retarget.md with the numbers and a
  JSON snippet to paste into the gear panel. Not retuned yet: waiting for the playtester's number.

#### 1. Stats (10)
HP, Attack, Defense (unblocked reds and bombs deal x100/(100+DEF)), Crit chance, Crit damage, Combo power (finisher),
Meter gain, Steady (slows how fast the cursor speeds up with combo, capped at 75%), Luck (shifts drop rarity toward the
rare end and adds coins), Companion power (Pip's pecks). The stats screen (tap Rowan at the camp, or Stats) shows HP,
Attack, Defense and Crit big, with how much comes from gear; "All stats" lists all 10 with what each does and where it
comes from (base, this run, gear).

#### 2. Gear
- **6 slots:** weapon, helm, armor, boots, 2 trinkets. **6 rarities** with frame colours: Common grey, Uncommon green,
  Rare blue, Epic purple, Legendary orange, Mythic red; 0/1/2/3/3/4 bonus stats; Legendary and Mythic add a unique
  effect.
- **Base stats per slot:** weapon Attack; helm HP (+ a little Defense or Luck); armor HP + Defense; boots Defense +
  Steady; each trinket leans on one stat. Bonus stats roll from the 10 (never the item's own base stat), in ranges
  scaled by item level and rarity. Item level comes from the act: Act 1 items Lv 1-5, Act 2 Lv 10-14, Act 3 Lv 20-24.
- **28 base items** with original names and painted icons (e.g. Squire Shortsword, Hedge Saber, Thornspear, Iron Pot
  Helm, Plumed Hat, Bramble Cuirass, Marsh Waders, Owl-feather Charm, Cog Brooch, Footpad's Loaded Die).
- **Signature drops** (bad-luck protection: 20% on a kill, +10% for every kill without it, so at most 9 kills):
  - Bandit Captain: **Captain's Cutlass** (Legendary weapon): bombs you tap always crit.
  - Ruin Golem: **Golemheart Plate** (Legendary armor): blocking a red heals 1 HP.
  - Boar King: **Tusk Crown** (Legendary helm): each finisher stack spent gives +5% crit for 5 s.
  - Boar King, rare: **Pendulum Shard** (Mythic trinket; 5%, +3% per miss): every 10th combo hit spawns a green block.
  - Other Legendaries and Mythics roll one of six effects: Opening Blow (first hit on each foe crits), Leech (crits
    heal 2), Riposte (a blocked red hits back for half your attack), Golden Touch (+50% coins), Owl Eye (Pip pecks every
    3 hits), Second Wind (once a fight, under 30% HP heals 20%).
- **Sets:** Greenwarden (hood, mail, treads, sprig): 2-piece +10% max HP; 4-piece rests heal 50% and kills heal 3%.
  Footpad (shiv + loaded die): 2-piece, your first miss each fight doesn't break the combo (or hurt). Set pieces drop
  at Rare or Epic.
- **Drops** (all in tuning, with sliders): a fight 50% one item, an elite always one (Uncommon+), treasure 1-2, a
  mini-boss 2 + its signature roll, the Boar King 3 + his signature rolls. Rarity weights 55/28/12/4/0.9/0.1, shifted
  by Luck.
- **Loot feel:** after the last foe falls a ball of light swells where it died (crackling in the best item's colour
  when an Epic or better is inside); the items arc out one by one, rarest last, and land in a row under pillars of
  light in their rarity's colour (sparkles from Rare, rays from Epic, red embers and a screen pulse for Mythic), with
  NEW badges and a green arrow when one beats what Rowan wears. Epic and up play a sting. Legendary and Mythic stop for
  a full-screen reveal card (rays, the icon at 2x in an ornate frame, rarity ribbon, stats, the effect, "Signature
  drop!") with its own fanfare. On continue the items fly into Rowan's portrait.
- **Kept when you die,** and so are the coins you found; coins spent in that act on things the retry undoes (shop
  boosts, potions, rerolls, event costs) are refunded. Cleared acts can be replayed for drops: tapping Greenmarch on the world map opens an act
  picker (cleared acts say "Replay (farm)", the next one "Continue the story"; each row shows its gear level and the
  boss's signature drops, ticked when you own them). A replayed act starts Rowan with the boosts a run typically has
  by then (measured with the bot, `tuning.kit`) plus his gear. Signature drops only come from their own boss.

#### 3. The camp
- **Reachable** from the world map (a Camp button), from every act-clear screen (Camp / Next: Act N+1) and from the
  defeat screen (Camp / Retry the act, so new loot can be equipped before a retry). Back returns where you came from.
- **Camp home:** a night clearing: Rowan and Pip on a log by the campfire, the bag tent, the forge with Mags, and the
  locked shrine; coins and scrap counters; tap a building or the buttons on the band.
- **Bag:** 60-cell grid with rarity frames (Rare+ glow, Epic+ shimmer; worn, new, locked and +N marks), the six worn
  slots, sort (Rarity / Slot / New), a compare card (name in rarity colour, kind, power and its change, "vs" the worn
  item, each stat as a green/red delta, stats you'd lose, the effect, the set and pieces worn), one-tap Equip, Lock.
  A full bag salvages new drops into scrap (and says so).
- **Forge,** run by **Mags**, an original badger blacksmith with goggles and a soot-black apron, with a short intro
  scene on the first visit. Upgrade +1 to +10 (each level +8% base stat; scrap + coins, x1.35 per level and more for
  rarer items; "+3 -> +4", every stat before -> after, two hammer blows with sparks); Reroll one bonus stat (40
  coins, doubling per reroll on that item; a slot-machine flicker, then was/now); Salvage (confirm tap); Salvage all
  Common/Uncommon (skips locked and worn items; shows count and scrap first).
- **Shrine:** locked: the padlock rattles, "The Shrine: coming soon!".
- **Coins carry over between runs** (the purse lives in the profile) and are spent at act shops and the forge.

#### 4. Sound
Loot drops climbing with rarity, Epic+ stings, Legendary and Mythic reveal fanfares, the forge hammer and upgrade,
salvage, equip, lock, reroll, gear-effect cues, and a campfire-and-crickets ambience at the camp. All in the Sound lab.

#### 5. Saves
- **Profile** (`cq3.profile.v2`): progress, bag, equipped gear, coins, scrap, the signature drops' bad-luck counters,
  the accuracy log, whether Mags was met. The old progress save (v1) is migrated (acts cleared and weights kept).
- **Run save v5:** a v4 save from the last build is migrated (its coins move into the purse), so a run in progress
  survives the update. The loot screen and the act's timing samples are saved too.
- Tests cover drop rolls (rarity weights and Luck, per-node counts, signatures only from their boss), bad-luck
  protection (odds rise per miss, reset on a drop, guaranteed within 9 kills), stat math (base/bonus scaling, all 10
  stats in a fight, Defense, Steady, sets and every unique effect), forge costs (upgrade, reroll doubling, salvage
  value, refusals) and the migrations (v1 profile, v4 run save, storage writes once).


### Playtest round 2 (after M3b): readability and the launch layout

The playtester sent a screenshot of the "Suspicious Mushroom" event ("Hard to see what the text says - do a full pass
on readability") and reported "first open the app and sometimes it doesn't match the proper aspect ratio of my
device". Both are fixed on PR #3; the playtester approved the layout fix (not yet confirmed on the phone).

#### 1. Readability pass (every screen checked at 8x with the iPhone's safe areas)
- **The event text (the cause):** the pixel fonts bake a 1 px ink outline and shadow around each glyph, so dark
  brown text inside a dark outline turned to blobs. Both fonts now have plain twins without the outline
  (`FONT_PLAIN`, `FONT_BOLD_PLAIN` in `font.ts`), and the text pool picks them by itself for dark colours
  (`isDarkInk`). That fixes every event, the parchment notes and dark text on gold tags.
- **Light text:** a brightness floor (`readable()`: no light text colour dimmer than a set level) and a gentler
  shading gradient on small type, so grey and lavender labels stop sinking into navy panels.
- **Act map:** node names sit on dark pills over the painted landscape. **World map:** the info plate moves aside
  instead of covering Greenmarch's plate.
- **Fight HUD:** enemy names show in full and in bold ("Boar King", was "King"); the Act 3 boss's ~17,000 HP reads
  "17.1k/17.1k" instead of overflowing the gauge; the enemy's attack moved to a chip under its badge (mirroring the
  coin chip on the left) to make room for the name.
- **Defeat and victory:** the subtitle lines get a dark backing strip over the busy stage.
- **Bag:** "Lv 24 Legendary" wraps to two lines instead of being cut to "Legenda..."; the compare numbers no longer
  overlap each other (small type, still on a green or red band).
- **Forge:** warnings shortened to fit ("Worn: unequip it first"); the salvage note and reroll hint stay inside
  their panel. Also brighter: the loot card's "Tap to continue"; roomier: the all-stats rows; un-squeezed: the
  shop's rarity tags.

#### 2. The launch layout
- **Cause:** iOS starts a home-screen app upright and turns it sideways while it opens. The game laid itself out
  on resize events, and those can come before the new size is readable, or not at all, so it sometimes stayed
  laid out for the upright screen (3x instead of 8x, letterboxed) until something else resized it.
- **Fix (`main.ts`):** any sign of a change (resize, orientation, the visual viewport, returning to the app, a
  ResizeObserver on the game) re-measures several times over the next 2 s, and a slow watch re-measures twice a
  second. A relayout only rebuilds anything when the measured layout actually changed (`sameLayout`), so the watch
  is free when nothing moves.
- **Test:** a smoke test boots upright with every resize event and the ResizeObserver blocked, turns the viewport,
  and checks the game reaches 8x and the canvas matches.


### Playtester notes from Act 1 (applied first)

1. **"Is there a point to choosing a path? No reward or risk."** Nodes now differ in what they give, and the map says
   so. Under every node you can reach next there is a reward chip: Fight "50% gear", Elite "Gear+" (always an Uncommon
   or better item; shown in red with a skull: they're the risk), Treasure "Gear x1-2", Rest "+30% HP", Shop "Spend
   coins", Event "Risky", Boss "Gear x2 + signature" (x3 for the Boar King). Fights still show their foe count.
2. **"Upgrades don't seem to do much visually; hard to gauge what an upgrade did."**
   - Boost cards (and shop cards) show the real stat before and after: "ATK 14 -> 16", "Crit 9% -> 14%",
     "Max HP 120 -> 140", "Pip 6 -> 18", computed from Rowan's actual stats (gear included).
   - The fight HUD reads the real stats; any gain pulses with "+N" as the next fight starts (stats the plate doesn't
     show, like Defense or Luck, float up under it).
   - Gear is visible on Rowan: an Uncommon+ weapon colours his slashes and adds a glint to the blade; Legendary or
     Mythic gear gives him a faint glowing outline and rising motes (gold while the Tusk Crown's buff is up).
   - Every gear effect announces itself briefly in fights ("Saved!", "Powder Monkey!", "+1" hearts...).
   - At the camp, equipping shows each stat before -> after, and coming back to the fire in better gear pops
     "Gear power +N!".



### Playtest round 1 (after M3a)

The playtester: "level one can't have a 700 hp boar, and the attacks it throws are way too hard"; the Crow's wave of
3 thin, fast reds was "almost a guaranteed hit" (one crossing, a tiny window); "you calibrated it for a machine, not
for a player"; and the world map and act map should be "a lot more lively".

1. **The bot now plays like a person.** It used to land a fixed share of taps inside any block, however thin or fast,
   so it couldn't feel what the playtester felt. Now each tap is aimed at the moment the cursor crosses the block's
   center with a human timing error in milliseconds (a normal spread set by the player's accuracy, plus 3% lapses),
   a 250 ms reaction time for blocks that pop up, and a thumb's tap rate (140 ms); the real judge decides what the
   tap hits. Re-measured with it, M3a's Act 1 was 45% first try for an 85% player (not the 75% reported before).
2. **Fairer judging:** the grace window is now a time window at the speed the cursor and the block close at, and
   blocking reds gets 40 ms a side (attacking yellows keep 20 ms, so they stay sharp). New slider: Red grace.
3. **Fair red waves:** reds are never thinner than normal, fast ones are wider, and reds in a wave are spaced so the
   cursor meets them one at a time (a data test checks every formation at 1.5x cursor speed). Crow Dive: 3 wide reds
   0.75 s apart at 1.2x (was 3 thin ones 0.22 s apart at 1.7x). Boar Charge: 1.4x and wider (was 2x). The wolves'
   Howl and the Boar King's double charge now come one after the other; the archer's volley is spread wider.
4. **Easier Act 1, gentler ramp:** see the balance section.
5. **Taps clear attacks first** (playtester request): a red, shield, bomb or speed block under the cursor always takes
   the tap, even over a nearer yellow or a trap.
6. **Fights are runs of foes** (playtester request: "multiple enemies in a row, like enemy 3/11, scaling the further
   in the act you are"). A fight node holds waves from the act's pools, one after another: Act 1 has 2 waves in the
   first row up to 4 before the boss, Act 2 3-5, Act 3 3-6 (a wave is one pool group, so later fights can be 10+
   foes). An elite comes after 1-2 escort waves; the boss fights alone. The next wave walks in 1.2 s after one falls
   (fliers drop in). The HUD shows a foe counter (skulls up to 8, "Foe 3/11" beyond), and the act map labels the
   nodes ("Fight x3"). Mid-fight saves keep the wave (save v4). Per-enemy HP, coins and kill growth were lowered to
   fit, kills heal 1%, and each act has a pace (spawn interval x1.1 / x0.85 / x0.75).
7. **Livelier maps:**
   - *World map:* animated sea, ships, a whale and fish, gulls, cloud shadows, a smoking volcano, snow, mist, a
     turning windmill, sheep and a cart. Rowan waits at Greenmarch under a "Tap to begin!" plate, with Pip once
     they've met. The Pendulum swings wider as weights come home. Tapping a region or the capital shows its plate.
   - *Act map:* a painted landscape per act (sunny meadow with a stream and windmill; mossy ruins at dusk; an
     autumn hollow at sunset) with real roads, worn boot-printed paths and shimmering next roads. Each fight node
     shows its enemy, plus campfires, chests, a market stall, a pulsing "?" and a lair per boss. Rowan walks the
     road with Pip and footsteps.
8. **"More modern, less light and empty"** (playtester): the palette was all bright mid-tones with nothing dark to
   anchor it, the fighters stood small in an empty strip, the HUD was bare numbers floating over the art, little
   moved, and there was silence between hits. Changes:
   - *Fight stage:* per-act lighting (warm sun, cool moon and rain, low sunset), vignette and darker ground,
     light pools and flickering torches, drifting mist, a dark swaying foreground frame, contact shadows and rim
     light on every fighter, ambient life, dust, sparks and rubble on hits.
   - *UI:* navy panels with bevels and gold trim, chunky HP gauges with a damage ghost, a hero portrait plate, a
     combo counter, a finisher strip with stack gems, a new title (big Rowan and Pip, chrome logo), restyled boost,
     node, story and result screens, and a quick wipe or iris between screens.
   - *Sound:* fuller music (sub bass, pads, a real drum kit, stereo echo and reverb, ducking under the kick) at the
     same peak level, and a seeded ambience bed for every place (birds and wind, rain and drips, crickets and
     torches, sea and gulls). New UI sounds: whoosh, panel, coin tick, footsteps.
9. **New home-screen icon:** a close-up of Rowan with his sword and a "3" badge (re-add the shortcut to see it).
10. **Saved tuning reset once:** the tuning key moved to v3, so changes saved against the old numbers are dropped and
    the new defaults reach the phone.

### What M3a adds

1. **Content is data** (`src/data/`): `enemies.ts` (stats, a base pattern and 0-2 special moves each),
   `greenmarch.ts` (acts, encounters, map weights), `events.ts`, `story.ts`. `tuning.ts` pulls a live copy of the
   enemies and act scaling in, so every enemy number (and each special's telegraph time, interval and HP trigger)
   has a slider.
2. **Special moves** (`src/core/specials.ts`): a telegraph (the enemy's own wind-up pose, its name over its head,
   a countdown ring, a "!", its own sound, 0.6-1.0 s; for red attacks the bar also shows blinking outlines where
   they will land) then actions. The actions are reusable and data-driven: **formation** (any blocks, at a spot,
   beside yellows, delayed, faster, wider, in pairs), **heal**, **shell** (self or an ally), **summon**, **split**,
   **cursor** (freeze it, or floor its speed), **guard**, **phase**, **protect**. One telegraph at a time, so each
   can be read. Every action has unit tests (34 in `tests/unit/specials.test.ts`).
3. **Region structure** (`src/core/map.ts`, `run.ts`): 3 acts, each a branching map 8 rows deep (2-3 nodes per row,
   links never cross, most nodes offer two ways on). Node types: fight, elite, treasure, rest (heals 30%), shop
   (boost cards, a potion, a reroll of the next 1-of-3 pick), event (a short text choice with a small risk or
   reward), and the boss. The first row is fights, the row before the boss always has a rest, and every type
   appears at least once per act.
   - Acts 1 and 2 end in a mini-boss, Act 3 in the Boar King.
   - **Save at every node** (save v3; saves from the level builds are dropped). A mid-fight save resumes with
     the summons, boss phase and used specials.
   - **Dying** sends you to the act's start with the hero and coins as you entered it, on the same map. There is
     one revive per act.
   - Rewards: a boost pick after every fight (elites and bosses guarantee a rare). Kills still add a little attack
     and max HP, and coins buy things in shops.
4. **The enemies** (each one changes how the bar plays):

   | Enemy | Special(s) | What it does to the bar |
   |---|---|---|
   | Slime | Split | Once below 50% HP, it splits into 2 Slimelets (a big enough hit kills it first) |
   | Boar | Charge | Paws the ground, then one wide red at 1.4x speed |
   | Bandit | Smoke | 2 purple traps right beside yellow blocks |
   | Crow (flies) | Dive | 3 wide reds, one after another, a little faster than usual |
   | Goblin Archer | Volley | 3 reds at once across the bar's right side |
   | Mushroom Shaman | Spores | Pink heal blocks: tap them, or it and its allies heal |
   | Shell Beetle | Shell Up | Your hits deal 50% until you break its 2 teal shell blocks |
   | Wolf (pairs) | Howl | A red from each wolf, one right after the other |
   | Big Slime (elite) | Split + Spores | Splits into 2 Slimes; spreads spores |
   | Hedge Knight (elite) | Guard | Shield up 2 s: tapping yellow is countered like a trap (yellows get a shield mark) |
   | Bandit Captain (Act 1) | Bombs, Call | Throws bomb pairs; at 50% HP calls 2 Bandits (damage can't skip it) |
   | Ruin Golem (Act 2) | Wall of Stone, Stomp, Fortify | A huge 3-tap shield block; Stomp (foot raised) freezes the cursor 0.5 s; at 50% HP Fortify: half damage until 2 plate blocks break |
   | Boar King (Act 3) | 3 phases | P1 frequent Charges. P2 (66%): 2 Piglets, he takes half damage while they live. P3 (33%): enraged, cursor never below 1.2x, Charges two at a time. A short scene at each change; damage can't skip a phase |

5. **Story**: portrait + text box, the text types out, tap to finish or advance, Skip, 6 boxes max, 2 lines each.
   Scenes: intro (the Great Pendulum, the Clockless King, Rowan asleep on watch), Act 1 (Pip: "I'm not a pet.
   I'm a consultant."), Bandit Captain (fake pendulum pieces), Act 2, Ruin Golem (guarding for a king 300 years
   dead), Act 3, Boar King (wears the first weight as a crown), his two phase changes, victory (the Pendulum ticks
   once; next stop, the Frostpeaks).
6. **Art and audio** (all original, following docs/art-style.md):
   - sprites for the 11 new enemies with idle, attack, hurt, death and telegraph poses (plus the knight's raised
     shield and the beetle's closed shell), and telegraph poses for the 4 old enemies;
   - the Act 3 backdrop (a sunset autumn hollow around the Boar King's den tree, with torches, leaves and
     fireflies);
   - the map screen (a parchment chart on a wooden board, node icons, Rowan's helmet marker);
   - portraits for Rowan, Pip, the Bandit Captain, the Ruin Golem, the Boar King (the brass pendulum weight in his
     crown), and the Great Pendulum for the narrator;
   - a map theme; a distinct telegraph sound for every special (16); sounds for the stomp, freeze, guard counter,
     shell breaks, spores, split, summons, map, shop, rest, events, dialogue and a victory fanfare. They are all
     in the Sound lab, and the audio tests check their levels.
7. **Kingdom world map** (from the playtester's screenshot of the reference's main map; our own version): a painted
   island kingdom between runs. Greenmarch is playable; four other regions (the Frostpeaks, Ashfell, Duskmire and
   Noonspire) sit behind padlocks, and tapping one rattles its padlock. The Great Pendulum's clock tower stands in
   the capital. A flag is planted on Greenmarch for each act cleared, and a "Weights home: x/12" counter tracks
   the pendulum weights recovered. This progress is kept across runs (`core/progress.ts`).
   - Flow: New run → world map → Greenmarch → intro → Act 1. After the victory you return to the map.
   - The reference's kingdom level, currencies, timed rewards and upgrade/chest/loadout/shop buttons stay in
     docs/backlog.md (gear, camp and gacha come later).
8. **Debug panel**: "Jump to" any act's map, or straight into a fight with any enemy, carrying a typical hero for
   that act. The Sound lab plays all three themes.

### Balance after playtest round 1 (before gear; superseded by the numbers above)

The bot plays like a person (see above). Targets are set for a **typical player (70%)**: that player hits 70% of plain
yellow blocks at the starting speed (a 60 ms timing spread).

| Player (timing spread) | Act 1 first try | Act 2 first try | Act 3 first try | Boar King first fight won |
|---|---|---|---|---|
| 55% (83 ms) | 95% | 52% | 40% | 43% |
| **70% (60 ms)** | **100%** | **85%** | 69% | **70%** |
| 85% (42 ms) | 100% | 98% | 93% | 93% |
| 95% (28 ms) | 100% | 100% | 100% | 100% |

- **Act 1 is a gentle start** for everyone; Act 2 is a step up; the Boar King is the real test. With retries, 97% of
  typical players clear Act 3.
- **No boss can be one-shot:** the Bandit Captain's call for help, the Ruin Golem's new Fortify (half damage until two
  plate blocks break) and the Boar King's phases are half-HP gates a finisher can't skip.
- **Fight length (70% player):** normal fights 17 / 26 / 22 s (2-6 waves), elites 33 / 28 / 22 s, bosses 41 / 58 / 58 s.
- **Skilled players breeze through** (85%: 100 / 98 / 93%). Taps clearing attacks first made defence much easier, so
  later acts hit harder per hit (attack x1 / x4 / x6.6) rather than sending more thin reds. If the playtester wants
  more challenge, `acts[i].atkMult` and `acts[i].pace` are the sliders to try first.
- **Numbers:** Act 1 enemies 90-190 HP (Slime 110, Crow 90, Boar 150, Bandit 190), elites 700-750, Captain 1,800;
  acts scale HP x1 / x1.8 / x2.3, +4% enemy HP per map row.
