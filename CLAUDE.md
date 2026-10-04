# Combo Quest 3 (working title)

Personal mobile timing-RPG inspired by Combo Quest 2 (2016, iOS). M1 was the **feel prototype** (CQ2-style
timing-bar combat, installable on an iPhone home screen, live tuning panel). M3a turned it into **Region 1,
Greenmarch**: three acts of branching node maps, enemies with telegraphed special moves, story scenes.
The user playtests on an iPhone 16 Pro and does not read long output; a separate planning chat orchestrates.

## Rules

- **Original assets only.** No CQ2 art, names, music, sounds or code. Art is drawn from character maps in
  `src/engine/art.ts` (hero, Pip, first enemies), `art-foes.ts` (Greenmarch enemies), `art-story.ts` (portraits, map
  icons), `art-world.ts` (the kingdom world map), `backdrop.ts` and `chrome.ts` (style guide: `docs/art-style.md`), the font in `src/engine/font.ts`, sounds
  are synthesized in `src/engine/audio.ts`, icons come from `scripts/make-icons.mjs`.
- **Content is data.** Enemies (stats, base pattern, 0-2 special moves; a boss's HP-gated phase changes come on top), the region's acts and encounters, events and
  story scenes live in `src/data/` (plain data, no logic). A special = a telegraph (0.6-1.0 s wind-up pose + its own
  sound) then reusable actions (`src/core/specials.ts`: formation, heal, shell, summon, split, cursor, guard, phase,
  protect). New actions need a unit test in `tests/unit/specials.test.ts`. Story boxes: max 6 per scene, 2 lines each
  (`tests/unit/data.test.ts` checks they fit).
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
  bump `SAVE_VERSION` if `RunSave` changes shape (v4 = waves of foes; older saves are dropped).
- **Impacts** (hits, blocks, bombs, finisher blows, kills) are tiered by one weight each in `tuning.impact`, which
  drives both the layered sound (`audio.ts`: crack, saturated body, tail, sub) and the visuals (`fx.impact()`:
  hit-stop, shake, white frames, music duck). Impact sounds play from the view when the blow lands on screen.
  New sounds go in the `SFX` catalog so the Sound lab and the level tests pick them up. Each place has a seeded
  ambience bed (`audio.setAmbience`, cued with the music in `app.ts`) that sits well under the music and impacts.
- **Balance:** combat numbers were set with the bot, which plays whole acts picking map nodes at random and aims
  like a person (a timing error in ms, reaction time, a thumb's tap rate; the real judge decides each tap), so thin
  or fast blocks and a fast cursor are as hard for it as for a player. `tests/unit/bot.test.ts` guards the targets:
  set for a typical 70% player: Act 1 ~100% first try, Act 2 ~85-90%, the Boar King's first fight won ~65-75%; a
  skilled 85% player clears every act first try most of the time. Re-run `npm run balance` after changing them. Red formations must stay blockable
  by a thumb (`tests/unit/data.test.ts`: never thinner than a normal red, waves spaced >= 0.16 s at 1.5x cursor).
  Fights are waves of foes, one after another (`acts[i].waves` in the data: more per fight the deeper the row; the HUD
  shows "foe 3/7"). Acts scale enemies with `acts[i].hpMult/atkMult/pace` (plus `map.rowHp` per map row); HP carries from node to node; dying restarts the act with the hero as they entered it.
- Landscape (like CQ2) canvas 327x150, integer-scaled (8x on an iPhone 16 Pro held sideways) so pixels are
  big and chunky like the reference; pixel art, no smoothing. Safe areas (Dynamic Island left/right, home indicator) come from `env(safe-area-inset-*)`
  (see `src/engine/layout.ts`).

## Layout

```
src/data/      enemies.ts (stats, patterns, specials), greenmarch.ts (acts, encounters, map weights), events.ts,
               story.ts (scenes), types.ts
src/core/      tuning.ts (numbers), combat.ts (sim), specials.ts (special-move actions), blocks.ts, map.ts (act
               maps), run.ts (region flow: map, nodes, boosts, shop, events, scenes, revive/retry), impact.ts
               (impact tier weights -> hit-stop/shake/flash and sound layers), save.ts (save at every node),
               progress.ts (acts cleared and weights home, kept across runs), bot.ts (balance bot), clock.ts,
               calibration.ts, swipe.ts, rng.ts
src/engine/    app.ts (time + input glue, music cues, story state), scene.ts (Phaser scene: layout, layers, anim
               clock, routes core events to view/), input.ts, debug.ts (tuning panel, Sound lab, Jump to),
               calibrate.ts, audio.ts, art.ts / art-foes.ts / art-story.ts / art-world.ts (sprites, portraits, map
               icons, the world map),
               backdrop.ts (forest, ruins, hollow), chrome.ts (UI textures), font.ts, layout.ts, storage.ts
src/engine/view/  stage.ts (backdrop, clouds, ambient), fighters.ts (hero, enemies, Pip, telegraphs, summons,
               finisher show, deaths), effects.ts (particles, floaters, camera), bar.ts (timing bar, blocks,
               telegraph previews, cursor), hud.ts (stats, meter, coins, stat rain), overlays.ts (title, boost,
               chest, defeat, victory, pause), world.ts (kingdom world map), map.ts (act map), story.ts (scenes),
               nodes.ts (rest, shop, events),
               ui.ts (text pool, panels), icons.ts, pixels.ts, shared.ts
tests/unit/    Vitest tests for src/core and src/data (specials, map, run, save, bot targets, content checks), plus
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
npm run balance      # balance bot report -> docs/balance.md (~1-2 min); re-run after changing combat numbers
npm run icons        # regenerate public/icons
```

Playwright uses the preinstalled Chromium (`PLAYWRIGHT_BROWSERS_PATH`); never run `playwright install`.

## Backlog

Meta-game features the playtester wants later (gear, camp, gacha/chest roll, loadout, upgrades) are listed in
`docs/backlog.md`. The latest status report for the planning chat is `docs/orchestrator-report.md`.

## Deploy

- `.github/workflows/deploy.yml`: on push to **any** branch, run tests, build, publish `dist/` to the
  `gh-pages` branch (last push wins).
- Vite `base` is `/cq3/` (the repo name). If the repo is renamed, change `BASE` in `vite.config.ts`.
- One-time GitHub setup: repo Settings > Pages > Source: "Deploy from a branch" > `gh-pages`, `/ (root)` > Save.
- Live URL: https://chef-development.github.io/cq3/
- The service worker is network-first for the page, so a new deploy shows up on the next launch.
