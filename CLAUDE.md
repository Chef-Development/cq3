# Combo Quest 3 (working title)

Personal mobile timing-RPG inspired by Combo Quest 2 (2016, iOS). M5 (this session) added **eight heroes, one per
style**, **companions**, **hero chests, gems and the shrine**, **region completion**, shared progression (mastery,
camp upgrades), the **second region** (ice patches and hold blocks), and the **Test lab**. M1 was the **feel prototype** (CQ2-style
timing-bar combat, installable on an iPhone home screen, live tuning panel). M3a turned it into **Region 1,
Greenmarch**: three acts of branching node maps, enemies with telegraphed special moves, story scenes. M3b added
**gear** (6 slots, 6 rarities, 10 stats, sets, signature boss drops), the **camp** (bag, forge, a locked shrine) and
farming cleared acts, plus an **accuracy readout** measured like the balance bot defines it. M4a ("depth") added
choices that change how you play: **relics** (run picks that change a rule), a second hero, **Sable** (then two cursors; one since M5),
**hero levels and skill trees**, and a **soundtrack per act** (calm/intense arrangements, boss themes, combo layers).
Playtest round 4 added **map content**: wandering packs (ambushes) and a travelling merchant on the act map, a Coin
Rush mini-game stop, bounties (side quests), a secret cache per act, and a wandering foe on the world map (skirmishes).
The user playtests on an iPhone 16 Pro and does not read long output; a separate planning chat orchestrates.

## Rules

- **Original assets only.** No CQ2 art, names, music, sounds or code. Art is drawn from character maps in
  `src/engine/art.ts` (hero, Pip, first enemies), `art-foes.ts` (Greenmarch enemies), `art-story.ts` (portraits, map
  icons), `art-world.ts` + `art-world-sites.ts` (the kingdom world map: the land, and what stands on it), `art-map.ts` (act map landscapes, map-scale Rowan, node props),
  `art-stage.ts` (per-act fight lighting), `art-sable.ts` (Sable's frames, map walker, hero cards), `art-relics.ts`
  (relic, tag and skill icons), `art-life.ts` (the maps' critters), `backdrop.ts`, `backdrop-frost.ts` (the second region's fight backdrops: painted
  the first time an act needs one, `Stage.ensure`, not at boot) and `chrome.ts` (style guide: `docs/art-style.md`), the font in `src/engine/font.ts`, sounds
  are synthesized in `src/engine/audio.ts` and the music in `src/engine/music.ts`, icons come from `scripts/make-icons.mjs` (art in `scripts/icon-art.mjs`).
- **Content is data.** Enemies (stats, base pattern, 0-2 special moves; a boss's HP-gated phase changes come on top), the region's acts and encounters, events and
  story scenes live in `src/data/` (plain data, no logic). So does gear (`src/data/gear.ts`: the 10 stats, slots,
  rarities, ~28 base items, the two sets, Legendary/Mythic unique effects, each boss's signature drops); the numbers
  that scale it are `tuning.gear` (drops, rarity weights, item level, stat sizes), `tuning.forge` and `tuning.effects`. A special = a telegraph (0.6-1.0 s wind-up pose + its own
  sound) then reusable actions (`src/core/specials.ts`: formation, heal, shell, summon, split, cursor, guard, phase,
  protect). New actions need a unit test in `tests/unit/specials.test.ts`. Story boxes: max 6 per scene, 2 lines each
  (`tests/unit/data.test.ts` checks they fit).
- **Relics, skills and kits are fight hooks.** A relic (`src/data/relics.ts`: 1-2 synergy tags, a rarity, at most
  one number in `tuning.relics.n`, an unlock), a skill node (`src/data/skills.ts`; numbers in `tuning.skills.n`) and a
  hero's kit change the rules through `src/core/hooks.ts`: Combat collects the hooks of what the hero carries
  (`kit-fx.ts`, `skill-fx.ts` + `skill-fx-heroes.ts`, `relic-fx.ts`) and calls them at fixed points (crit chance, hit
  damage, after a hit/block, meter, combo gain, combo break, misses, traps, impacts, the finisher, Pip's pecks, kills,
  bombs). Per-fight state lives in `c.perk`; a perk that kicks in calls `c.perkFx(id, ...)` so the UI names it. Every
  relic and every rule node/capstone has a with/without unit test (`tests/unit/relics.test.ts`, `skills.test.ts`,
  `hero-skills.test.ts`). Relics never flat-bump a stat. Run-level relics (shops, rests, map steps) live in `run.ts`.
  Offers (`core/relics.ts`): mostly relics plus at most one stat card, leaning toward owned tags ("Synergy!"); relics
  carry and reset like boosts (`hero.relics`, never mutated in place); replays draft `kit.relicPicks` per act behind.
- **Map extras** (`core/roam.ts`, `quests.ts`, `skirmish.ts`; numbers in `tuning.extras/roam/rush/quests/secret/wander`).
  After `buildActMap`, `addExtras` (its own random stream: the map itself is unchanged) turns a fight mid-act into a
  **Coin Rush** (`rush` node) and an early event/fight into a **bounty board** (`bounty` node), hides a **secret** beside
  one node, and sets who roams: 1-2 **packs** (`acts[i].packs` in greenmarch.ts, more in later acts) and a travelling
  **merchant**. Roamers step along the links (either way) each time the hero moves, their next step known a step ahead
  (`roamAt` replays the path from the seed: roamers are never saved). Stepping onto a roamer's node, or onto the node it
  steps to, meets it: a pack is an **ambush** (`run.ambush`: on a fight node its foes join as extra waves, elsewhere it's
  fought first and the node's stop opens after, `PickThen` 'node'; it pays coins, an extra Uncommon+ item and a rare
  pick), the merchant opens her small shop (`run.merchant`). They never touch the boss, a rest, an elite or the first row, never
  share a node, and always leave the hero a clear next step (with a step of look-ahead; `tests/unit/roam.test.ts` walks
  every path). Coin Rush is `Combat` with `rush` (seconds): the `coinSack` (yellows only) can't die, every hit pays
  coins (`rushHitCoins`), misses don't hurt, only the kit's hooks run, the clock ends it; an interrupted one saves as
  the map. Bounties (`src/data/quests.ts`): taken at the board, counted from won fights (`Combat.log`: reds blocked,
  best combo, clean waves, kills; elite, HP left), paid when met (coins, a Rare+ item, or a relics-only pick after the
  fight's, `run.pickKind` 'bounty'). The secret cache: shown when its node is in reach, tappable while the hero stands
  there (`run.secretHere`/`openSecret`): a richer chest and a pick of every relic (a locked one unlocks; 'secret').
  The world map's wandering foe: after `wander.every` fights won since the last (Act 1 cleared), one paces the Meadow
  Road (`profile.wander`); tapping it starts one skirmish (`run.startSkirmish`: an encounter from a cleared act as
  `heroFor` that act; used up when it starts, never saved) for gear and XP, then back to the world map. Drawing:
  `view/map-roam.ts` (roamers, telegraphs, secret, the bounty tracker beside the coins), `view/stops.ts` (the board),
  `view/world-roam.ts` (the foe and its card), `art-roam.ts` (sprites); the Coin Rush clock is on the enemy plate.
- **The world map is bigger than the screen and pans** (`view/world.ts`, art in `art-world.ts`): a continent
  `WORLD_W` x `WORLD_H` (960x300, about 3x2 screens) plus a strip of far sea east of it (`FAR_SEA_W`, painted on its
  own: the camera pans over `MAP_W`) under a camera (`worldMap.ox/oy`); everything on it is placed in
  world px less the camera, while the HUD (the header, the Camp button, the cards, the act picker) stays put inside the
  safe areas. **Tap vs drag:** there a press is judged on release (`input.ts` -> `pressAt/dragTo/releaseAt`): one that
  moves more than `DRAG_PX` (4 game px) is a drag (it pans, flings on with momentum, clamps at the edges, and never
  starts anything); one that stays put is a tap. It opens on the current act's `WORLD_ACTS[i].view`; the very first
  visit (`profile.worldTour`) glides in from the far east in under 2 s (any tap skips it). Every playable act is a
  landmark (`WORLD_ACTS`, by global act index: Greenmarch's 0-2, the Frostpeaks' 3-5; box, Rowan's stand, flag): a
  tap selects one (its card: name, what playing it means, Play = the act picker's start), Rowan (or, before any act
  is cleared, his "Tap to begin!" plate) opens the story or the act picker on his region's acts (never all of them);
  once an act is cleared a region chip (top right) names the region in view with its completion (`core/completion.ts`:
  "65%", the `badge_region` laurel at 100%, also beside the region's boss flag) and opens that region's picker. The
  locked lands sit under veils (`wm_veil_<id>`) that thin when tapped; a land unveils once it can be played
  (`core/world-plan.ts` `landOpen`: the Frostpeaks at `actsCleared >= 3`), with a short reveal the first time (the
  view glides there, the veil thins away, a card names it; remembered as `unveil:<id>` in `profile.seen`). The world
  plan has 12 regions (one per weight): the 7 far lands (`FAR_ISLES` in `art-world-lands.ts`, placeholder ids, no
  names: "Beyond the sea") are silhouettes in the far sea under fog that thins and lifts with `profile.weights`
  (`WORLD_PLAN` thin/lift). Tests use `greenmarch()`, `actSpot(i)`, `cardPlay()`, `camera()`, `lookAt(x, y)`,
  `regionChip()`, `pickerRegion`, `revealing` and `life.sparkleOnScreen()` (screen px).
  The world is painted once, in idle slices after boot (`paintWorldSlice`; `scene.ensureWorldArt()` finishes it at
  once if the map is opened first): keep each step a few tens of ms and the frame to moving images and a modest
  number of rects for what's in view.
- **Heroes: one cursor for every hero, always.** A hero = a **style** (`src/data/styles.ts`: Blade, Shadow, Guardian,
  Marksman, Brute, Controller, Summoner, Bomber; each style's shared rule is a set of fight hooks in `core/styles.ts`,
  numbers `tuning.styles`) + a signature, an ability (the green-hit ability window), a passive, a finisher twist, a
  3x5 skill tree (>= 2 rule nodes per branch and a capstone; `src/data/skills.ts` + `skills-heroes.ts`, hooks in
  `skill-fx.ts` + `skill-fx-heroes.ts`), a rarity (`src/data/rarity.ts`: 8 tiers, Common to Divine; Celestial pale cyan
  with stars, Divine prismatic gold; above Mythic adds new things, never only numbers) and soft strengths (15-25% vs
  some enemy tags, shown on the hero select; `tuning.hero.strengthScale`, 0 in unit tests). Data: `src/data/heroes.ts`
  (8 heroes: Rowan the starter, Sable and Neve join through the story, the rest come from hero chests); the kits are
  `core/kit-fx.ts` (`KIT_HOOKS`, numbers `tuning.kits.<id>`: base HP and attack share, ability, passive, finisher, 3-
  and 5-star moves). Gear is shared; each hero has their own XP, level and tree (`core/heroes.ts`), stars 1-5 from
  shards (`core/roster.ts`). The fight reads who is fighting from the profile as `hero.build` (switching heroes at camp
  mid-act works). A new hero needs: data, kit hooks, a tree with with/without tests, a full sprite set, portrait and
  chest reveal, a Test lab scenario, and the parity check (`npm run campaign`: every hero within +/-10 points of Rowan
  in every act at 85%).
- **Companions** (`src/data/companions.ts`, perks in `core/companion-fx.ts`, levels/stars/slots in `core/roster.ts`):
  8 of them, Pip first; each brings bar perks, levels from XP earned with them, stars from shards; one slot, a second
  with the camp's Companion Perch.
- **Chests, gems, the shrine, completion** (`core/chests.ts`, `core/meta.ts`, `core/completion.ts`; numbers
  `tuning.chests`/`tuning.gems`): hero chests (bosses, bounties, rarely elites; opened free) hold a hero or companion
  weighted low, or shards for one you own; gems come only from playing (first clears, bosses, bounties, hidden
  treasures, achievements, 100% regions), and the shrine sells Rare chests for gems with pity (a Legendary or better
  within 30). **No timers, no energy, no real money, ever.** A region's completion counts acts, mini-bosses, the boss,
  bounties, hidden treasures and events; 100% gives a region chest and a map badge. Mastery milestones (4 per hero)
  unlock things for everyone (relics, set pieces, camp upgrades, cosmetics); camp upgrades are bought with coins and
  add options more than numbers. There is no catch-up XP.
- **Regions.** Acts are numbered globally (`src/data/regions.ts`: Greenmarch 0-2, the Frostpeaks 3-5); the run walks
  `CAMPAIGN` and a region's last act ends in its own victory scene (`profile.weights` = regions won). A region starts a
  fresh run (relic picks only for acts behind within the region). An act's **bar rules** (`acts[i].bar`, introduced
  from a map row: ice and snow patches that change the cursor's speed, hold blocks; drifting blocks and linked pairs
  for a later region) are applied in `core/combat.ts` and only draw from the random stream in an act that has them.
  A hold is pressed at its near edge and held past its far edge; it is never a finisher swipe (`core/swipe.ts`,
  unit-tested). Every hero must work with every bar rule (tests in `hero-kits.test.ts`, `bar-rules.test.ts`).
- **Core/engine split.** `src/core/` is plain TypeScript with **no Phaser (or DOM) imports**: deterministic,
  fixed 120 Hz step (`Combat.step`), seeded RNG, fully unit-tested. `src/engine/` (Phaser + DOM) only
  renders core state and feeds input into it.
- **Timing.** Taps are judged by the pointer event's `timeStamp` mapped to sim time (`SimClock`), minus the
  calibration offset, against the cursor/block positions *at that moment* (core keeps ~1 s of history and
  rewinds). Never judge by the frame a tap was processed on. An attack (red, shield, bomb) under the cursor always
  takes the tap first; the grace window is time at the closing speed (reds get more).
- **Data-driven tuning.** System numbers live in `src/core/tuning.ts` (`DEFAULT_TUNING`), plus the slider metadata for
  the debug panel; it also pulls in a live copy of the enemies and the acts' HP/attack scaling from `src/data/`, so
  the panel can edit them. Don't hard-code gameplay numbers elsewhere. New numbers need a slider entry in
  `sliderGroups`.
- **Settings/tuning persistence** goes through `src/engine/storage.ts` (localStorage, always try/catch). So does
  the mid-run save (`core/save.ts`): it autosaves at every node (every phase change) and when the page is hidden;
  bump `SAVE_VERSION` if `RunSave` changes shape and add a migration (v5 = gear: `migrateSave` moves a v4 save's coins
  into the profile's purse; v6 = relics: a v5 save gets none; v7 = map extras: the quest, the secret found, an ambush
  in progress, the merchant's shop, a bounty's picks to come, and `extras` (a v6 save's act goes on with a plain map:
  `enterAct(i, scenes, false)`; the next act has them); older saves are dropped). The **profile** (`core/profile.ts`, key `cq3.profile.v2`) is kept
  across runs: progress, the bag (60 items), what's equipped, coins (the purse carries over between runs), scrap, each
  signature drop's bad-luck counter, the accuracy log, whether the smith was met; v3 adds the heroes (picked, XP, skills, Sable met, the twin tutorial
  shown) and the relics unlocked, the tips seen and whether tips are off, the world map's wandering foe (`wander`), the map sparkles picked up, whether the world map's first-visit reveal played (`worldTour`) (still v3: missing reads as none; a profile
  from before the tips that has cleared an act gets the basics' tips marked seen). `readProfile` migrates v1 (progress only) and v2 (Rowan gets the cleared acts'
  first-clear XP; their relics unlock). Gear is not saved in the run: the hero's `gear` loadout always comes from the profile (`run.refreshGear()`).
  Gear and coins found are kept when you die. The title offers Continue (the run, or the world map with everything
  kept) and **New game**, which wipes everything: tapped twice, it erases the profile and the run, keeping tuning and
  settings (`eraseProgress`, `app.newGame()`; the gear panel's "Start over" does the same, asked twice).
- **Teach it slowly (tips).** One short tip, shown once, the moment a system first matters: the words in
  `src/data/tips.ts` (max 2 lines, `TIP_TEXT_W` px each, an anchor, pre-fight or pausing; the order is the priority),
  the when in `core/tips.ts` (`TipCoach`: fed the fight's events and asked every frame; one at a time, one per screen,
  a few seconds apart in a fight, counted from the first that stops it (the first red's tip comes first: Act 1's first
  fight always teaches blocking); seen ids in `profile.tips`), the card in `view/tips.ts` (only at a safe moment: no
  scene, wipe, card, toast, panel or tutorial; seen and saved the moment it shows; in a fight `App.tipUp` stops the
  clock and the next tap only dismisses it). The gear panel has "Tips: on/off" and "Show tips again". A returning
  player's first launch of a new version plays Pip's welcome back over the title once (`welcomeScene`; new players
  never get it). Smoke and screenshot tests run with tips off unless they ask for them (`ready`/`boot` `{ tips: true }`).
- **Impacts** (hits, blocks, bombs, finisher blows, kills) are tiered by one weight each in `tuning.impact`, which
  drives both the layered sound (`audio.ts`: crack, saturated body, tail, sub) and the visuals (`fx.impact()`:
  hit-stop, shake, white frames, music duck). Impact sounds play from the view when the blow lands on screen.
  New sounds go in the `SFX` catalog so the Sound lab and the level tests pick them up. Each place has a seeded
  ambience bed (`audio.setAmbience`, cued with the music in `app.ts`; the camp has a campfire-and-crickets one) that sits
  well under the music and impacts. Music (`music.ts`): each act has one melody in a calm arrangement (map, nodes,
  scenes) and an intense one (fights), crossfading on the beat; mini-bosses and the Boar King (escalating per phase,
  a key change in phase 3) have their own themes, the camp a quiet one. Fight layers join with the combo (drums,
  bass, lead at `tuning.music` thresholds) and drop on a break. `app.ts cueMusic()` picks the piece.
- **Map life stays at the edges; sparkles are tiny and not farmable.** The act maps (`view/map-life.ts`) and the
  world map (`view/world-life.ts`; shared parts in `view/life.ts`, sprites in `art-life.ts`) have critters per theme
  (rabbits, sparrows, a frog, fish, a hawk; a hedgehog, crows, moths; a squirrel, a doe, spores; a goat, snow buntings;
  glow beetles, cave fish; snow hares, an owl; gulls and dolphins at sea) that startle when tapped (Pip chirps), and now and then a sparkle that pays a coin or two. Life is small,
  muted and slow, on open ground (`land.ground` from `paintLand`, away from the nodes when there's room) or open sea,
  and never over a node, a road, a tag, the roamers, the secret's boulder, the hint, the Camp button or the HUD (the
  bounty tracker too); it only gets the taps nothing else takes (`input.ts` after the secret and the nodes; on the
  world map, after the wanderer, the landmarks, the regions, the plate and the buttons; placed where the map's opening
  view sees the sea). The only text it adds is the "+1" of a pop. Everything
  animates from `now` and seeds (screenshots stay exact). The rules are `core/sparkle.ts` (pure, unit-tested): at most
  one sparkle per act-map step (never an act's first) and one per world-map visit (a new visit only once you've played:
  gear found, XP, an act cleared), deterministic from its key, and the profile keeps the claimed keys
  (`profile.sparkles`), so a reload, a retry or a replay never pays one twice. Numbers in `tuning.life` (with
  sliders); the sounds (`sparklePop`, `critterFlutter`, `critterChirp`) are in the `SFX` catalog and stay under the
  music (`audio.test.ts`). The first sparkle gets a tip.
- **Balance:** combat numbers were set with the bot, which plays whole acts picking map nodes at random and aims
  like a person (a timing error in ms, reaction time, a thumb's tap rate; the real judge decides each tap), so thin
  or fast blocks and a fast cursor are as hard for it as for a player. It wears the best gear it finds (item power).
  `tests/unit/bot.test.ts` guards the targets, set for the playtester (`TYPICAL_ACCURACY` = 85%; it was a typical 70%
  player until playtest round 4) on a fresh first playthrough with found gear only: Act 1 ~100% first try, Act 2
  ~80-90%, the Boar King's first fight won ~60-75%, also by a cautious 85% bot that never takes the relics charging HP
  (`avoid`); a 70% player still clears Act 3 within 6 tries (~85-90%); an 85% player loses more HP to foes per fight
  act over act (later acts' reds are faster: `acts[i].redSpeed`), and normal fights don't get shorter act over act; and
  farming the Boar King (replaying Act 3 with the gear kept, `playFarm`) measurably raises the win rate. Replays start
  with `tuning.kit` (what an 85% story run has gained per act behind, re-measured: keep it in step with the story).
  `npm run snowball` (tests/balance/snowball.run.ts) shows what each fight costs per act and where the hero's stats come
  from (gear, levels, run gains, skills), with ablations and a veteran (story + 6 forged Act 3 farms, then Acts 1-3
  replayed); `npm run perks` benches each relic and skill node on a typical Act 3 hero. The bot picks relics synergy-greedy, spends skill points down
  one branch (`focus` forces one, for measuring), plays every hero with one thumb (kits are passive or plain taps),
  lets go of holds with a human error (a little late on average, the odd early lift), finishes linked pairs, and
  visits camp between regions (every Rare chest its gems buy, chests opened, affordable camp upgrades, its rarest
  companions). **Later regions** are balanced from a typical end-of-Greenmarch hero (`playCampaign`):
  `tests/unit/bot-region2.test.ts` guards the second region (Act 1 ~90% first try, Act 2 ~75%, Act 3 ~60%, its boss
  ~55-65%); `npm run campaign` reports every hero against Rowan; `npm run region-tune` replays one region from cached
  end-of-region heroes with numbers to try (`TUNE='{"acts.4.hpMult":7}'`, `FOCUS=bulwark`, `BRANCHES=1`). It meets roamers when its random
  route runs into them (an ambush; the merchant's shop like a shop), plays Coin Rush with its normal aim (not counted
  in the fight stats: `ActAttempt.extras`), takes every bounty and opens a secret half the time. The report also shows relic win
  rates (by build and by relic, and against a stat-cards-only control). Re-run `npm run balance` after changing them.
  `ACC=0.62 npm run retarget` re-aims the whole curve at another player (writes docs/retarget.md with the act numbers).
- **Accuracy readout** (`core/accuracy.ts`): every tap aimed at an isolated yellow gives a timing error; the median and
  MAD of the recent ones, mapped through `SD_CALIBRATION` (made with bots of known accuracy: `npm run calibrate`; re-run
  it after changing block widths, the cursor or the acts' pace; `tests/unit/accuracy.test.ts` fails when it drifts),
  give the share of plain yellows the player would hit at the starting speed: the bot's own definition. Shown in the
  gear panel (with a history per act clear) and on each act-clear screen. Red formations must stay blockable
  by a thumb (`tests/unit/data.test.ts`: never thinner than a normal red, waves spaced >= 0.16 s at 1.5x cursor).
  Fights are waves of foes, one after another (`acts[i].waves` in the data: more per fight the deeper the row; the HUD
  shows "foe 3/7"). Acts scale enemies with `acts[i].hpMult/atkMult/pace` (plus `map.rowHp` per map row); HP carries from node to node; dying restarts the act with the hero as they entered it.
- Landscape (like CQ2) canvas 327x150, integer-scaled (8x on an iPhone 16 Pro held sideways) so pixels are
  big and chunky like the reference; pixel art, no smoothing. Safe areas (Dynamic Island left/right, home indicator) come from `env(safe-area-inset-*)`
  (see `src/engine/layout.ts`). iOS launches a home-screen app upright and turns it, with resize events that can be
  early or missing, so `main.ts` re-measures after any hint and on a 500 ms watch (`app.relayout()` is a no-op unless
  the layout changed).
- **Test lab** (`src/data/lab.ts` scenarios, `core/lab.ts` profiles/fights/ratings/report, `engine/lab.ts` the list):
  short scenarios that drop the playtester straight into what's new, rated Good / Needs work / Broken with a note,
  copied as one report. It plays on its own save (`storage.ts` slot 'lab': `cq3.lab.profile` / `cq3.lab.run`; ratings
  in `cq3.lab.ratings`); leaving it puts the real game back as it was. Region foes, bosses and story go in its spoiler
  group (hidden until "Show spoilers"; labelled by act number only). **Every session adds its new content to the Test
  lab (`LAB_NEW` in `src/data/lab.ts`), and moves the previous session's items to its 'Earlier' section (`LAB_EARLIER`).**
- **Text readability.** The pixel fonts bake an ink outline; dark text (on parchment, gold) automatically uses the
  outline-free twins (`font.ts` `isDarkInk`), and light text gets a brightness floor (`readable()`). New text must fit
  its box at 8x (`textWidth`): wrap or shorten it rather than truncating with "...", and never let bold rows overlap.

## Layout

```
src/data/      enemies.ts (stats, patterns, specials), greenmarch.ts (acts, encounters, map weights), events.ts,
               story.ts (scenes), types.ts
src/data/gear.ts  stats, slots, rarities, base items, sets, unique effects, signature drops
src/data/relics.ts (40 relics, tags, build names), heroes.ts (the eight heroes), styles.ts (the eight styles), rarity.ts, companions.ts, meta.ts (achievements, mastery, camp upgrades), regions.ts + frostpeaks.ts + enemies-frost.ts (the second region), skills.ts + skills-heroes.ts (the eight trees), tips.ts (the tips),
               quests.ts (the bounties' goals), lab.ts (the Test lab's scenarios: New and Earlier)
src/core/      tuning.ts (numbers), combat.ts (sim; heroStats, gear effects), specials.ts (special-move actions),
               blocks.ts, map.ts (act maps), run.ts (region flow: map, nodes, loot, boosts, shop, events, scenes,
               camp, replaying acts, revive/retry), gear.ts (item stats, drops, bad-luck protection, forge prices),
               profile.ts (kept across runs: progress, bag, equipped, purse, scrap, accuracy log), accuracy.ts
               (accuracy readout), hooks.ts (fight hooks), relic-fx.ts / skill-fx.ts / skill-fx-heroes.ts / kit-fx.ts (the
               relics, skill nodes and kits as hooks), relics.ts (offers, synergy, build names, unlocks), heroes.ts (XP,
               levels, skill trees), impact.ts (impact tier weights -> hit-stop/shake/flash and sound layers),
               roam.ts (the map's extras: Coin Rush and bounty stops, the secret, roamers and their steps), quests.ts
               (bounties), skirmish.ts (the world map's wandering foe), lab.ts (the Test lab: each scenario's profile
               and fight, ratings, the report), save.ts
               (save at every node, migrations), bot.ts (balance bot, farming), tips.ts (which tip shows when; the
               welcome back), sparkle.ts (the maps' sparkles: when, where, what they pay, claimed once), world-plan.ts
               (the world map's 12 regions: which lands are open, the far lands' fog per weights home), clock.ts,
               calibration.ts, swipe.ts, rng.ts
src/engine/    app.ts (time + input glue, music cues, story state, the Test lab's swap to its own save), scene.ts
               (Phaser scene: layout, layers, anim clock, routes core events to view/), input.ts, debug.ts (tuning
               panel, Sound lab, Jump to), lab.ts (the Test lab: list, rating card, report; HTML), clipboard.ts,
               calibrate.ts, audio.ts (sounds, ambience), music.ts (the soundtrack), art.ts / art-foes.ts / art-story.ts / art-world.ts /
               art-map.ts / art-stage.ts (sprites, portraits, the world map, act map landscapes, fight lighting),
               art-world-sites.ts (the world map's trees, villages, landmarks, mountains: what stands on its land),
               art-world-lands.ts (the second region's landmark markers, the far lands and their fog),
               art-roam.ts (the coin sack, the board, the secret rock, the merchant),
               art-gear.ts (item icons), art-camp.ts (the camp, Mags the smith), art-dummy.ts (the camp's Training
               Dummy, a foe for practice fights), art-paint.ts (painting helpers),
               art-life.ts (the maps' critters),
               backdrop.ts (forest, ruins, hollow), backdrop-frost.ts (pass, caves, glacier), chrome.ts (UI textures), font.ts, layout.ts, storage.ts
src/engine/view/  stage.ts (backdrop, clouds, ambient), fighters.ts (hero in `${art}_${pose}` frames, enemies and a boss's
               phase look, telegraphs, summons, stuns, finisher show, deaths; finishers.ts each hero's own show; party.ts
               the companions and a Summoner's allies), effects.ts (particles, floaters, camera), bar.ts (timing bar,
               blocks, telegraph previews, cursor, holds, mirrors, icicle marks, dashes; bar-kinds.ts the painters for
               patches, kegs, frozen blocks, holds, ice coats, fuses, chilled reds, the Rampart wall, vines), hud.ts (hero
               and enemy plates, the style readout (Chain, Guard, Focus, Unstoppable, allies), meter, coins, relic belt), overlays.ts (title, boost,
               chest, defeat, victory, pause), world.ts (kingdom world map: the camera, drag and tap, the landmarks and
               their card, the act picker; world-roam.ts its wandering foe), map.ts (act
               map; map-roam.ts its roamers, telegraphs, secret and bounty tracker), map-life.ts and world-life.ts (their
               critters and sparkles; life.ts the shared critters, glint and pop), stops.ts (the bounty board), story.ts (scenes),
               nodes.ts (rest, shop, events), camp.ts (the camp home; bag.ts, forge.ts, heroes.ts (hero select: all
               eight, paged by a strip of faces; Kit / Stars / Mastery tabs), stats.ts, skills.ts (skill trees),
               relic-log.ts, chests.ts (the waiting chests and their reveal), shrine.ts (Rare chests for gems, odds,
               pity), companions.ts, upgrades.ts (camp upgrades; Practice with the Training Dummy), progress.ts
               (region completion; camp.openProgress(r) opens it from elsewhere) its screens; item-grid.ts the bag
               grid and worn slots; camp-kit.ts their shared layers, effects, buttons, hero tabs, rarity frames and
               stars; the top bar's middle is kept clear for the HTML gear button: kit.hudZone(), kit.topRow()),
               gains.ts (run.gains, what a fight or an act gave beyond the loot, shown briefly), relic-ui.ts (relic icons, tag chips, relic
               cards, perk names), loot.ts (loot reveal and Legendary/Mythic cards), items.ts (item cells with rarity frames, item text),
               ui.ts (text pool, panels), transition.ts (screen wipes), tips.ts (the tip card), icons.ts, pixels.ts (panels, gauges,
               buttons), shared.ts
tests/unit/    Vitest tests for src/core and src/data (specials, waves, map, run, save, bot targets, content checks; roam,
               quests and map-content for the map extras), plus
               audio.test.ts: renders every sound on an OfflineAudioContext (node-web-audio-api) and checks levels
               (no clipping, impacts >= music, tiers get heavier, telegraphs read over the music)
tests/balance/ npm run balance: the bot plays 1,000 whole runs per accuracy and writes docs/balance.md
tests/smoke/   Playwright smoke tests (874x402 @3x, landscape: intro, map, fight, every enemy's specials, reload)
               and screenshot regression tests (screens.spec.ts: fake clock + seeded Math.random, pixel-exact)
scripts/       make-icons.mjs, sw-template.js (service worker, precache list injected at build)
```

## Commands

```
npm install
npm run dev          # local dev server (also on LAN for phone testing)
npm test             # unit tests (Vitest)
npm run typecheck
npm run build        # typecheck + production build to dist/ (+ dist/sw.js)
npm run smoke        # Playwright smoke + screenshot tests; builds and serves dist itself
npm run screens      # screenshot tests only; EXACT=1 for a zero-tolerance compare
npm run screens:update  # refresh the baselines after an intentional visual change (look at them first)
npm run balance      # balance bot report -> docs/balance.md (a few min); re-run after changing combat numbers
npm run calibrate    # accuracy readout calibration table (paste into core/accuracy.ts SD_CALIBRATION)
ACC=0.62 npm run retarget  # re-aim the difficulty curve at a player of that accuracy -> docs/retarget.md
npm run campaign     # every hero through both regions at 85%, gaps to Rowan (HEROES, RUNS, ACC; writes docs/balance-campaign.md)
npm run region-tune  # one later region from cached end-of-region heroes (TUNE, FOCUS, BRANCHES, HEROES, RUNS)
npm run snowball     # what fights cost per act, stat sources, ablations, a veteran (RUNS, ACC, HERO, TUNE, AVOID env)
npm run perks        # each relic and skill node alone on a typical Act 3 hero (RUNS, ACC, HERO, BUILD=relic,... env)
npm run icons        # regenerate public/icons
```

Playwright uses the preinstalled Chromium (`PLAYWRIGHT_BROWSERS_PATH`); never run `playwright install`.

## Backlog

Meta-game features still to come (the gacha shrine, chest rolls, loadout, kingdom upgrades) are listed in
`docs/backlog.md`. The latest status report for the planning chat is `docs/orchestrator-report.md`.

## Deploy

- `.github/workflows/deploy.yml`: on push to **any** branch, run tests, build, publish `dist/` to the
  `gh-pages` branch (last push wins).
- Vite `base` is `/cq3/` (the repo name). If the repo is renamed, change `BASE` in `vite.config.ts`.
- One-time GitHub setup: repo Settings > Pages > Source: "Deploy from a branch" > `gh-pages`, `/ (root)` > Save.
- Live URL: https://chef-development.github.io/cq3/
- The service worker is network-first for the page, so a new deploy shows up on the next launch. A home-screen app
  left in the background keeps the build it loaded, so `main.ts` checks `version.txt` (the build's label, written at
  build, never cached) whenever the app comes back to the front and reloads when a newer build is deployed (the run
  saved first; never mid-fight). The gear panel's foot shows the build (`__BUILD__`: commit and time).
