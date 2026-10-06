# Combo Quest 3 (working title)

Personal mobile timing-RPG inspired by Combo Quest 2 (2016, iOS). M1 was the **feel prototype** (CQ2-style
timing-bar combat, installable on an iPhone home screen, live tuning panel). M3a turned it into **Region 1,
Greenmarch**: three acts of branching node maps, enemies with telegraphed special moves, story scenes. M3b added
**gear** (6 slots, 6 rarities, 10 stats, sets, signature boss drops), the **camp** (bag, forge, a locked shrine) and
farming cleared acts, plus an **accuracy readout** measured like the balance bot defines it. M4a ("depth") added
choices that change how you play: **relics** (run picks that change a rule), a second hero, **Sable** (two cursors),
**hero levels and skill trees**, and a **soundtrack per act** (calm/intense arrangements, boss themes, combo layers).
Playtest round 4 added **map content**: wandering packs (ambushes) and a travelling merchant on the act map, a Coin
Rush mini-game stop, bounties (side quests), a secret cache per act, and a wandering foe on the world map (skirmishes).
The user playtests on an iPhone 16 Pro and does not read long output; a separate planning chat orchestrates.

## Rules

- **Original assets only.** No CQ2 art, names, music, sounds or code. Art is drawn from character maps in
  `src/engine/art.ts` (hero, Pip, first enemies), `art-foes.ts` (Greenmarch enemies), `art-story.ts` (portraits, map
  icons), `art-world.ts` (the kingdom world map), `art-map.ts` (act map landscapes, map-scale Rowan, node props),
  `art-stage.ts` (per-act fight lighting), `art-sable.ts` (Sable's frames, map walker, hero cards), `art-relics.ts`
  (relic, tag and skill icons), `backdrop.ts` and `chrome.ts` (style guide: `docs/art-style.md`), the font in `src/engine/font.ts`, sounds
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
  (`kit-fx.ts`, `skill-fx.ts` + `skill-fx-sable.ts`, `relic-fx.ts`) and calls them at fixed points (crit chance, hit
  damage, after a hit/block, meter, combo gain, combo break, misses, traps, impacts, the finisher, Pip's pecks, kills,
  bombs). Per-fight state lives in `c.perk`; a perk that kicks in calls `c.perkFx(id, ...)` so the UI names it. Every
  relic and every rule node/capstone has a with/without unit test (`tests/unit/relics.test.ts`, `skills.test.ts`,
  `sable-skills.test.ts`). Relics never flat-bump a stat. Run-level relics (shops, rests, map steps) live in `run.ts`.
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
- **Heroes.** Rowan (Blade: one cursor) and Sable (Twin: two cursors, A sweeps the left half, B the right, in step;
  a tap on the left half of the screen judges A, the right half B; `Combat.hands`, `tap(t, hand)`,
  `cursorPosAt(t, hand)`). Gear is shared; each hero has their own XP, level (1-30, `tuning.levels`) and skill tree
  (`core/heroes.ts`: a point every 2 levels, learned in branch order, free reset). The fight reads who is fighting
  from the profile as `hero.build` (like the gear's loadout; not saved in the run). Sable joins after Act 1 (scene
  `sableJoin`). Sable's numbers are `tuning.sable`; `tests/unit/twin-bot.test.ts` keeps her within +/-10 points of
  Rowan at the same accuracy.
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
  shown) and the relics unlocked, the tips seen and whether tips are off, the world map's wandering foe (`wander`) (still v3: missing reads as none; a profile
  from before the tips that has cleared an act gets the basics' tips marked seen). `readProfile` migrates v1 (progress only) and v2 (Rowan gets the cleared acts'
  first-clear XP; their relics unlock). Gear is not saved in the run: the hero's `gear` loadout always comes from the profile (`run.refreshGear()`).
  Gear and coins found are kept when you die. The title offers Continue (the run, or the world map with everything
  kept) and **New game**, which wipes everything: tapped twice, it erases the profile and the run, keeping tuning and
  settings (`eraseProgress`, `app.newGame()`; the gear panel's "Start over" does the same, asked twice).
- **Teach it slowly (tips).** One short tip, shown once, the moment a system first matters: the words in
  `src/data/tips.ts` (max 2 lines, `TIP_TEXT_W` px each, an anchor, pre-fight or pausing; the order is the priority),
  the when in `core/tips.ts` (`TipCoach`: fed the fight's events and asked every frame; one at a time, one per screen,
  a few seconds apart in a fight; seen ids in `profile.tips`), the card in `view/tips.ts` (only at a safe moment: no
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
- **Balance:** combat numbers were set with the bot, which plays whole acts picking map nodes at random and aims
  like a person (a timing error in ms, reaction time, a thumb's tap rate; the real judge decides each tap), so thin
  or fast blocks and a fast cursor are as hard for it as for a player. It wears the best gear it finds (item power).
  `tests/unit/bot.test.ts` guards the targets, set for the playtester (`TYPICAL_ACCURACY` = 85%; it was a typical 70%
  player until playtest round 4) on a fresh first playthrough with found gear only: Act 1 ~100% first try, Act 2
  ~80-90%, the Boar King's first fight won ~75-85% (aimed at 60-70%: enemy numbers barely move an 85% player, who blocks
  ~99% of reds; docs/orchestrator-report.md, round 4); a 70% player still clears Act 3 within 6 tries; an 85% player
  loses at least as much HP per Act 3 fight as per Act 1 fight, and normal fights don't get shorter act over act; and
  farming the Boar King (replaying Act 3 with the gear kept, `playFarm`) measurably raises the win rate. Replays start
  with `tuning.kit` (what an 85% story run has gained per act behind, re-measured: keep it in step with the story).
  `npm run snowball` (tests/balance/snowball.run.ts) shows what each fight costs per act and where the hero's stats come
  from (gear, levels, run gains, skills), with ablations and a veteran (story + 6 forged Act 3 farms, then Acts 1-3
  replayed); `npm run perks` benches each relic and skill node on a typical Act 3 hero. The bot picks relics synergy-greedy, spends skill points down
  one branch, and plays Sable with two thumbs (an independent timing error per hand). It meets roamers when its random
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
- **Text readability.** The pixel fonts bake an ink outline; dark text (on parchment, gold) automatically uses the
  outline-free twins (`font.ts` `isDarkInk`), and light text gets a brightness floor (`readable()`). New text must fit
  its box at 8x (`textWidth`): wrap or shorten it rather than truncating with "...", and never let bold rows overlap.

## Layout

```
src/data/      enemies.ts (stats, patterns, specials), greenmarch.ts (acts, encounters, map weights), events.ts,
               story.ts (scenes), types.ts
src/data/gear.ts  stats, slots, rarities, base items, sets, unique effects, signature drops
src/data/relics.ts (40 relics, tags, build names), heroes.ts (Rowan, Sable), skills.ts (both trees), tips.ts (the tips),
               quests.ts (the bounties' goals)
src/core/      tuning.ts (numbers), combat.ts (sim; heroStats, gear effects), specials.ts (special-move actions),
               blocks.ts, map.ts (act maps), run.ts (region flow: map, nodes, loot, boosts, shop, events, scenes,
               camp, replaying acts, revive/retry), gear.ts (item stats, drops, bad-luck protection, forge prices),
               profile.ts (kept across runs: progress, bag, equipped, purse, scrap, accuracy log), accuracy.ts
               (accuracy readout), hooks.ts (fight hooks), relic-fx.ts / skill-fx.ts / skill-fx-sable.ts / kit-fx.ts (the
               relics, skill nodes and kits as hooks), relics.ts (offers, synergy, build names, unlocks), heroes.ts (XP,
               levels, skill trees), impact.ts (impact tier weights -> hit-stop/shake/flash and sound layers),
               roam.ts (the map's extras: Coin Rush and bounty stops, the secret, roamers and their steps), quests.ts
               (bounties), skirmish.ts (the world map's wandering foe), save.ts
               (save at every node, migrations), bot.ts (balance bot, farming), tips.ts (which tip shows when; the
               welcome back), clock.ts, calibration.ts, swipe.ts, rng.ts
src/engine/    app.ts (time + input glue, music cues, story state), scene.ts (Phaser scene: layout, layers, anim
               clock, routes core events to view/), input.ts, debug.ts (tuning panel, Sound lab, Jump to),
               calibrate.ts, audio.ts (sounds, ambience), music.ts (the soundtrack), art.ts / art-foes.ts / art-story.ts / art-world.ts /
               art-map.ts / art-stage.ts (sprites, portraits, the world map, act map landscapes, fight lighting),
               art-roam.ts (the coin sack, the board, the secret rock, the merchant),
               art-gear.ts (item icons), art-camp.ts (the camp, Mags the smith), art-paint.ts (painting helpers),
               backdrop.ts (forest, ruins, hollow), chrome.ts (UI textures), font.ts, layout.ts, storage.ts
src/engine/view/  stage.ts (backdrop, clouds, ambient), fighters.ts (hero, enemies, Pip, telegraphs, summons,
               finisher show, deaths), effects.ts (particles, floaters, camera), bar.ts (timing bar, blocks,
               telegraph previews, cursor), hud.ts (hero and enemy plates, meter, coins, relic belt), overlays.ts (title, boost,
               chest, defeat, victory, pause), world.ts (kingdom world map; world-roam.ts its wandering foe), map.ts (act
               map; map-roam.ts its roamers, telegraphs, secret and bounty tracker), stops.ts (the bounty board), story.ts (scenes),
               nodes.ts (rest, shop, events), camp.ts (the camp home; bag.ts, forge.ts, heroes.ts (hero select),
               stats.ts, skills.ts (skill trees), relic-log.ts its screens; item-grid.ts the bag grid and worn
               slots; camp-kit.ts their shared layers, effects, buttons and hero tabs; the top bar's middle is
               kept clear for the HTML gear button: kit.hudZone()), relic-ui.ts (relic icons, tag chips, relic
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
npm run twin         # Rowan vs Sable on the same tuning (RUNS, ACC, TUNE='{"sable":{...}}', AVOID=relic,... env)
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
- The service worker is network-first for the page, so a new deploy shows up on the next launch.
