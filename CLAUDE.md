# Combo Quest 3 (working title)

Personal mobile timing-RPG inspired by Combo Quest 2 (2016, iOS). Milestone M1 is a **feel prototype**:
CQ2-style timing-bar combat, installable on an iPhone home screen, with a live tuning panel.
The user playtests on an iPhone 16 Pro and does not read long output; a separate planning chat orchestrates.

## Rules

- **Original assets only.** No CQ2 art, names, music, sounds or code. Placeholder art is drawn from
  character maps in `src/engine/art.ts`, `backdrop.ts` and `chrome.ts` (style guide: `docs/art-style.md`), the font in `src/engine/font.ts`, sounds are synthesized in
  `src/engine/audio.ts`, icons come from `scripts/make-icons.mjs`.
- **Core/engine split.** `src/core/` is plain TypeScript with **no Phaser (or DOM) imports**: deterministic,
  fixed 120 Hz step (`Combat.step`), seeded RNG, fully unit-tested. `src/engine/` (Phaser + DOM) only
  renders core state and feeds input into it.
- **Timing.** Taps are judged by the pointer event's `timeStamp` mapped to sim time (`SimClock`), minus the
  calibration offset, against the cursor/block positions *at that moment* (core keeps ~1 s of history and
  rewinds). Never judge by the frame a tap was processed on.
- **Data-driven tuning.** Every tunable number lives in `src/core/tuning.ts` (`DEFAULT_TUNING`), including
  enemy stats and block patterns, plus the slider metadata for the debug panel. Don't hard-code gameplay
  numbers elsewhere. New numbers need a slider entry in `sliderGroups`.
- **Settings/tuning persistence** goes through `src/engine/storage.ts` (localStorage, always try/catch). So does
  the mid-run save (`core/save.ts`): it autosaves on every phase change and when the page is hidden; bump
  `SAVE_VERSION` if `RunSave` changes shape.
- **Impacts** (hits, blocks, bombs, finisher blows, kills) are tiered by one weight each in `tuning.impact`, which
  drives both the layered sound (`audio.ts`: crack, saturated body, tail, sub) and the visuals (`fx.impact()`:
  hit-stop, shake, white frames, music duck). Impact sounds play from the view when the blow lands on screen.
  New sounds go in the `SFX` catalog so the Sound lab and the level tests pick them up.
- **Balance:** combat numbers were set with the bot; `tests/unit/bot.test.ts` guards the targets. Re-run
  `npm run balance` after changing them. Levels ramp from easy to tough; later levels scale enemies with
  `levels[i].hpMult/atkMult` and bring more enemies, and the hero carries upgrades from level to level.
- Landscape (like CQ2) canvas 327x150, integer-scaled (8x on an iPhone 16 Pro held sideways) so pixels are
  big and chunky like the reference; pixel art, no smoothing. Safe areas (Dynamic Island left/right, home indicator) come from `env(safe-area-inset-*)`
  (see `src/engine/layout.ts`).

## Layout

```
src/core/      tuning.ts (all numbers), combat.ts (sim), run.ts (levels/boosts/revive), impact.ts (impact
               tier weights -> hit-stop/shake/flash and sound layers), save.ts (mid-run save), bot.ts (balance
               bot), clock.ts, calibration.ts, swipe.ts, rng.ts
src/engine/    app.ts (time + input glue), scene.ts (Phaser scene: layout, layers, anim clock, routes core
               events to view/), input.ts, debug.ts (tuning panel), calibrate.ts, audio.ts, art.ts (sprites),
               backdrop.ts (level backdrops per theme), chrome.ts (UI textures), font.ts, layout.ts, storage.ts
src/engine/view/  stage.ts (backdrop, clouds, ambient), fighters.ts (hero, enemies, Pip, finisher show, deaths),
               effects.ts (particles, floaters, sparks, debris, camera shake/kick/freeze/flash), bar.ts (timing
               bar, blocks, cursor), hud.ts (stats, meter, coins, stat rain), overlays.ts (title, boost, chest,
               defeat, pause), pixels.ts (pixel drawing primitives), shared.ts (constants, helpers, types)
tests/unit/    Vitest tests for src/core, plus audio.test.ts: renders every sound on an OfflineAudioContext
               (node-web-audio-api) and checks levels (no clipping, impacts >= music, tiers get heavier)
tests/balance/ npm run balance: the bot plays 1,000 runs per level and writes docs/balance.md
tests/smoke/   Playwright smoke test (874x402 @3x, landscape) and screenshot regression tests (screens.spec.ts:
               fake clock + seeded Math.random, so renders are pixel-exact)
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
npm run balance      # balance bot report -> docs/balance.md (~10 s); re-run after changing combat numbers
npm run icons        # regenerate public/icons
```

Playwright uses the preinstalled Chromium (`PLAYWRIGHT_BROWSERS_PATH`); never run `playwright install`.

## Backlog

Meta-game features the playtester wants later (loot, chest roll, map, loadout, upgrades) are listed in
`docs/backlog.md`. The latest status report for the planning chat is `docs/orchestrator-report.md`.

## Deploy

- `.github/workflows/deploy.yml`: on push to **any** branch, run tests, build, publish `dist/` to the
  `gh-pages` branch (last push wins).
- Vite `base` is `/cq3/` (the repo name). If the repo is renamed, change `BASE` in `vite.config.ts`.
- One-time GitHub setup: repo Settings > Pages > Source: "Deploy from a branch" > `gh-pages`, `/ (root)` > Save.
- Live URL: https://chef-development.github.io/cq3/
- The service worker is network-first for the page, so a new deploy shows up on the next launch.
