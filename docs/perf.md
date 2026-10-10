# Performance (team 4, overnight run round 8)

How long the game takes to load on a phone-like setup and how steady its frames are, measured before and after each
change. The script is `tests/perf/perf.mjs`, run by hand (never in CI):

```
npm run build && npx vite preview --port 4177 --strictPort &
node tests/perf/perf.mjs 3          # 3 = loads per measure (the median is reported); CPU=1 for no CPU slowdown
```

## Method

- Playwright's Chromium driven through the Chrome DevTools Protocol, at the phone's size (874x402 CSS px @3x, touch).
- **CPU slowed 4x** (`Emulation.setCPUThrottlingRate`) and a **"Fast 4G" network** (`Network.emulateNetworkConditions`:
  165 ms latency, 9 Mbps down, 1.5 Mbps up: the DevTools preset), cache disabled and the service worker blocked, so
  every load is a first visit.
- **Title ready for a tap**: from navigation start to the first animation frame after the scene says it's ready
  (`__cq3.ready`): the first moment a tap on the title is answered.
- **First fight on screen**: from navigation start, a new run, the region's intro skipped, the first map node chosen as
  soon as the map takes input (the app's own calls, no human pauses): the moment the phase is `fight`.
- **Frames**: the gaps between animation frames over 10 s of a fight (Act 2 foes, god mode, Space every 140 ms) and of
  the world map (dragged left and right every ~0.5 s). Shown as frames per second, percentiles and the share of
  frames over 20 ms (a missed 60 Hz frame and then some) and over 34 ms (two missed).
- Bundle sizes are read from `dist/assets` (gzip at level 9).

**Caveat.** The machine is a shared 4-CPU container with five teams' tests and bots running (load average 10-20
during these runs) and no GPU (WebGL is rendered in software). Absolute numbers are far slower than an iPhone 16 Pro;
compare before and after taken under the same conditions, and expect 10-15% noise run to run.

## Before (build `d43a12b`, one chunk)

| chunk | raw | gzip |
|---|---|---|
| index.js (the game and Phaser) | 3496 KB | 1098 KB |
| index.css | 11 KB | 3 KB |
| **total** | **3506 KB** | **1101 KB** |

| measure (CPU 4x, Fast 4G, median of 3) | ms |
|---|---|
| DOMContentLoaded | 2256 |
| load event | 12439 |
| title ready for a tap | 12144 (a second sample: 12551) |
| first fight on screen | 18613 (18419) |

| frames over 10 s, CPU 4x | rate | p50 ms | p95 ms | p99 ms | max ms | > 20 ms | > 34 ms |
|---|---|---|---|---|---|---|---|
| fight | 7.7 fps | 100 | 317 | 433 | 433 | 98.8% | 95.0% |
| world map (dragged) | 7.9 fps | 100 | 267 | 450 | 450 | 100% | 98.9% |

Without the CPU slowdown (CPU 1x, one load): title ready 6916 ms, first fight 12310 ms; fight 19.9 fps (p95 83 ms),
world map 20.4 fps (p95 100 ms).

### Where the load goes (CPU 1x profile, `Profiler` over the load)

- The download is not the bottleneck: DOMContentLoaded is ~2.2 s on Fast 4G; the rest is the CPU painting the art.
- The scene's layout (`FightScene.onLayout`) paints every texture: ~2.3 s at 1x on this machine. Inside it,
  `buildArt` ~1.4 s (the 16 heroes' sprite sets 0.85-0.9 s, the second region's foes 0.37-0.51 s, the camp 0.34 s,
  Greenmarch's foes 0.23-0.32 s, companions 0.15-0.31 s, chests 0.15-0.19 s, relics 0.15 s), the fight stage's
  textures 0.69-0.92 s, and Phaser's texture uploads (`_processTexture`, one WebGL texture per canvas) ~0.5 s.
- **It ran twice at boot**: `main.ts` forced a relayout when Phaser said READY, after the scene had already laid
  itself out, so the title sat frozen for another ~1.9 s before it answered a tap.
- **And on every resize step**: any change of the canvas's place (a desktop window dragged wider by a pixel) rebuilt
  every texture: 1.2-1.4 s per step; a 12-step window drag took 1.3 s to settle.

## After (this chunk)

Changes: the boot paints once (`main.ts`: READY only places the canvas); a relayout that only moves or scales the
canvas (same safe areas, `layout.ts sameGameLayout`) no longer rebuilds the scene (`app.relayout`); Phaser is its own
chunk (`vite.config.ts` `codeSplitting.groups`), so a new deploy re-downloads only the game's code (Phaser's chunk keeps
its hash) and the two download side by side. The service worker's precache lists every built file (the plugin walks
`dist/`), the Phaser chunk included.

| chunk | raw | gzip |
|---|---|---|
| index.js (the game) | 2151 KB | 753 KB |
| phaser.js | 1342 KB | 345 KB |
| index.css | 11 KB | 3 KB |
| **total** | **3504 KB** | **1101 KB** |

| measure (CPU 4x, Fast 4G, median of 3) | before | after |
|---|---|---|
| DOMContentLoaded | 2256 | 2201 |
| load event | 12439 | 8118 |
| **title ready for a tap** | **12144** | **7791** (-36%) |
| **first fight on screen** | **18613** | **14256** (-23%) |
| a 12-step window resize settles (CPU 1x) | 1280 | 28 |

| frames over 10 s, CPU 4x | before | after |
|---|---|---|
| fight | 7.7 fps, p95 317 ms | 9.2 fps, p95 250 ms |
| world map (dragged) | 7.9 fps, p95 267 ms | 8.4 fps, p95 217 ms |

(The frame numbers didn't change by design: nothing in this chunk touched the per-frame drawing; the difference is
within this machine's noise.)

## Next (in order of payoff)

1. **Paint lazily at boot** (art-team files: needs their hands or their OK). The title needs the font, the logo and
   one stage; the 16 heroes' sets (~0.9 s at 1x), the second region's foes (~0.4 s, like the third region's
   `ensureAshArt`), the camp, companions, chests, shrine and relics can be painted in idle slices after the title is
   up (the world map already is), each with an `ensure...()` for a screen opened before it's done.
2. **Texture atlases**: one canvas per sprite means one WebGL texture and one upload each (~0.5 s of
   `_processTexture`); packing each family (a hero's frames, a region's foes) into one canvas cuts the uploads and the
   texture switches per frame.
3. **Split the later regions' code** (`import()` for `backdrop-frost/ash`, `art-frost/ash`, their music) once they
   are painted lazily: ~20-30% of the game's chunk is art data that a first session never draws.
4. **Frame time**: profile a fight's frame (the menus and bar redraw their Graphics every frame) once a real phone
   trace is available; this container's software WebGL is too slow and noisy to judge 60 fps by.

## Round 8, second chunk: region art packs (team 4)

### Region art packs (the pattern for every later region)

A first session plays Greenmarch, so the later regions' art should neither download before the title nor paint at
boot. Each later region's art is a **pack**, a chunk of its own (`src/engine/region-art.ts`):

- `pack-<region>.ts` is the only file that imports the region's art files (`art-<region>.ts`, `backdrop-<region>.ts`,
  ...). It exports `PACK: RegionArtPack`: `paintSlice(ms)` (draw whole sprites until `ms` have gone by; true when all is
  drawn), `addArt(add, now)` (add the drawn art as textures; `now` draws what's left first; a relayout calls it again),
  `isArtKey(key)`, `backdrop(scene, theme, ...)` (a fight theme's backdrop, painted the first time an act needs it) and
  `col` (its foes' colours, merged into `view/shared` `ENEMY_COL` when it arrives).
- `region-art.ts` lists the pack's loader (`LOADERS: { dusk: () => import('./pack-dusk') }`) and its fight themes
  (`PACK_THEMES`, so the stage knows which pack a theme needs before it arrives).
- `main.ts` starts every pack's `import()` before Phaser boots, so the packs download beside the main chunk (on a
  return visit the service worker has them). The scene paints them in idle slices once the title is up (after the
  world map's slices), and any screen of a later region finishes them at once (`App.setPhase` ->
  `FightScene.ensureRegionPacks`, a no-op once all are in): no later region ever asks for a texture that isn't there,
  and a Greenmarch player never waits for them (a Greenmarch fight included: the bar's later-region pieces, icicles
  and mirror shards, are drawn only once they exist). A foe or portrait asked for
  sooner finishes them too (fighters, story). `__cq3.ready` waits for the packs to arrive, so a test may jump anywhere.
- **The one way to get it wrong**: a static `import` of a pack's file from anywhere else pulls it (and what it imports)
  back into the main chunk. Check the build's chunk list (`npm run build` prints `pack-<region>-*.js`). Something the
  game needs before the pack arrives (a theme list, a helper the act maps share, a palette) gets a small file of its
  own: e.g. `backdrop-ice.ts` holds the ice shards and seracs the act maps (painted at boot) and Ashfell's backdrops
  share with the Frostpeaks' backdrops.
- `scripts/sw-template.js` needs nothing: the build plugin lists every file in `dist/` for the precache.

Not split yet (next, in order of payoff): the later regions' **music** (about 40% of `music.ts`, ~28 KB raw: a pack
could register its songs into `SONGS`, the cue falling back to the act's calm theme until it's in; music.ts is being
extended for the new regions tonight, so moving 800 lines would collide), the **sharper chest reveal** (`chest-hd.ts`,
`art-chests-hd.ts`, `art-reveal-hd.ts`: ~50 KB raw, off by default, but drawn into from every frame of a chest
opening: six call sites to guard), the **Test lab** list (~30 KB).

### Measured (CPU 4x, Fast 4G, median of 3; the machine at load 12-15 on 4 CPUs: expect 15-20% noise)

Before: the run branch at `693e1d8` (Region 4 in play, no packs). After: this branch (the Frostpeaks, Ashfell and
Region 4 as packs). Bundle sizes are exact; the timings are as noisy as the note says (the same build measured twice
read 11.4 and 12.4 s to the title).

| chunk | before raw | before gzip | after raw | after gzip |
|---|---|---|---|---|
| index.js (the game) | 2307 KB | 807 KB | **2119 KB** | **735 KB** (-9%) |
| phaser.js | 1342 KB | 345 KB | 1342 KB | 345 KB |
| pack-ash.js (Ashfell's foes, backdrops) | | | 73 KB | 29 KB |
| pack-dusk.js (Region 4's foes, backdrops) | | | 48 KB | 20 KB |
| art-frost.js (the Frostpeaks' foes; the toolkit the other packs share) | | | 44 KB | 17 KB |
| pack-frost.js (the Frostpeaks' backdrops) | | | 25 KB | 11 KB |
| **total** | 3660 KB | 1155 KB | 3662 KB | 1161 KB |

| measure (CPU 4x, Fast 4G, no cache, median of 3) | before | after |
|---|---|---|
| load average while measuring (4 CPUs) | 20-22 | 20-21 |
| DOMContentLoaded | 3384 | 3282 |
| **title ready for a tap** | **12969** (runs 9635-13324) | **12074** (runs 10840-12998) |
| later regions' art arrived (`__cq3.ready`) | 12969 (one chunk) | 12974 |
| first fight on screen | 28645 | 27212 |

What should change: the Frostpeaks' foes (~0.4 s at 1x, so ~1.6 s at 4x) no longer paint before the title, and the
main chunk to download, parse and compile is 9% smaller. Measured: the title ~0.9 s sooner and the first fight ~1.4 s
sooner, but the spread between runs of the same build (up to 3.7 s here) is larger than that: on this machine the
direction is right and the size isn't proven. A phone-like measurement on a quiet machine (or a real device trace) is
the next step. The packs arrive ~1 s after the title is up (their modules evaluate once the boot's long paint lets go
of the main thread); nothing waits for them on the title, and the world map and Greenmarch never do.

Frame rates at load 20 swung wildly between the two runs (the world map read 51 fps for the first build and 3.7 fps
for the second; a busy fight 4.1 and 3.4 fps): not comparable, and not used.

**Frame time** (a CPU profile of 6 s of a busy late fight, Act 9's forge hand, chain sentinel, stoker imp and magma eel
with Space every 140 ms, and of the world map dragged; a non-minified build at CPU 1x): 75% of the fight's main thread
and 94% of the world map's is native time outside the game's code (this container renders WebGL in software; an
iPhone's GPU does that work). The game's own code costs about 4 ms a frame in the busy fight at 1x (the frame's update,
the HUD panel, the actors, a tap's events and sounds) and under 1 ms on the world map: no cheap JS offender to fix. One-time
costs seen: the first tap creates the AudioContext (~0.3 s at 1x, once), the first ambience bed (~85 ms, cached after),
and the world map's idle slices still painting when a fight starts right after boot (sliced: no long frame).
