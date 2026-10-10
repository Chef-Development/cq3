# Art bible (all procedural art)

The rules every pixel in the game follows. They are strict: a piece that breaks one is an outlier and goes on the audit's
redo list (`docs/art-audit/README.md`). Menus add their own layer on top (`docs/ui-style.md`, summarised in section 11);
where the two disagree, this file wins for pixels and that one for layout.

Goal: a cohesive, hand-crafted look at the polish of modern pixel-art RPGs (Sea of Stars, Eastward, Celeste, Shovel
Knight), 100% original, drawn from code. The world is **the Great Atlas**, a living map where whatever is drawn becomes
real: ink, paper and colour are the game's visual motifs (the title, the world map, region restoration, transitions).

## 1. The grid

- The canvas is **327 x 150 game px**, integer-scaled (8x on an iPhone 16 Pro held sideways: 1 game px = 2.67 CSS px).
  One game px is a big chunky pixel: every pixel is a decision.
- **Hard pixels only.** Filled rects and pre-painted canvases; no anti-aliased paths, no smoothing, no blur, no
  sub-pixel positions (round every x and y), no fractional scale of a sprite at rest.
- **One grid per piece of art.** A sprite drawn at 1x and shown at 2x or 3x (the title, the hero select) is fine; a
  piece that mixes 1x and 2x pixels is not. The sharper layer (section 12) has its own grid and never mixes either.
- Plan screens for the safe area: about 283 x 142 (`s.L`..`s.R`, `0`..`s.B`). Art may bleed to the canvas edge;
  anything the player must see or tap stays inside. The top bar's middle stays clear for the gear button.

## 2. Palette

All colour comes from ramps (dark to light). A new material gets its own ramp of 3-6 tones, built by the hue-shift
rule (section 4) and added to this table; never a one-off hex picked by eye.

| Material | Ramp |
| --- | --- |
| ink / outline | `#140c1c` |
| steel | `#2a2f45 #4a5272 #7c86a6 #b8c2d8 #eef3fa` |
| gold | `#5a3410 #9a5a14 #d8901c #f2c230 #fff0a0` |
| red | `#4a0f1a #8a1a22 #d03030 #f05a48 #ff9a80` |
| green leaf | `#12261e #1e3c2a #2e5a32 #4a7e36 #78a83c #b4d058` |
| teal night | `#0e1a22 #162a32 #23404a #355a60 #4e7a78 #7aa49a` |
| earth | `#2a1810 #4a2c18 #6e4426 #98663a #c0905a #e0bc84` |
| wood | `#2e1a0e #4e2c16 #6e4020 #8e5a2e #b07a44 #d09a5e` |
| blue (cursor, meter) | `#10204a #1a3c8a #2a6ad8 #4aa0f0 #9ad8ff #e0f6ff` |
| skin | `#5a2e22 #a0583a #d88a5a #f2b888` |
| purple | `#2a1440 #4a2470 #7a3cb0 #a86ae0 #dab0ff` |
| day sky | `#3a8ad8 #5aaae8 #86c8f2 #b8e2f6 #e6f6fb` |
| **parchment** (the Atlas) | `#3a2416 #6e4a2a #a8804e #d2b07a #ead2a0 #f8ecc8` |
| **atlas ink** (map lines) | `#1a1026 #2e2240 #4a3a5e` (line, wash, faded line) |
| **fog** (erased land) | `#6a6478 #9a94a8 #c8c2d2 #ece8f0` |
| frost | `#16243a #2a4a6e #4a7aa6 #86b4d8 #c4e2f4 #f0faff` |
| ash / ember | `#1a1014 #3a1c18 #6e2a18 #c24a1c #f08a2a #ffd070` |

**Fixed meanings** (never reuse them for decoration): yellow block `COL.yellow`, red block/attack `COL.red`, purple
trap `COL.purple`, green ability `COL.green`; rarity colours are `TIER_INFO[tier].face` everywhere; reward text gold
`0xffe680`, good/done green `0x8af06a`, refused red `0xff6a5a`.

**Per scene:** one region = one limited palette. A backdrop uses at most about 24 colours, pulled from the region's
ramps plus the sky. Greenmarch: green leaf, earth, day sky (dusk and night variants tint toward teal night). Frostpeaks:
frost, steel, teal night. Ashfell: ash/ember, purple, steel.

## 3. Light

- **The key light comes from the top left**, everywhere: sprites, icons, UI, lettering, backdrops. Lit edges are top
  and left; the core shadow falls bottom and right. The only exceptions are local light sources painted in the scene
  (a forge, a torch, a crystal), and those add a **rim** on the side facing them, never replace the key.
- Every standing actor casts a **contact shadow**: a flat ellipse of ink at 30-40% alpha under the feet, 2-3 px tall,
  about the actor's footprint wide. Fliers get a smaller, fainter one on the ground under them.
- Each region has a light recipe (section 9): key colour, ambient tint, rim colour, the particles in the air. Fight
  sprites are never re-shaded per region; the stage's colour grade (`st_grade_*`) and rays do that, over everything
  but the bar.

## 4. Shading

1. **At least 3 tones per material** (shadow, base, light), 4-5 for the focal pieces (heroes, bosses, the logo).
2. **Hue shifting**: shadows shift cooler (toward blue or purple), highlights warmer (toward yellow). Never shade by
   darkening the same hue only, and never by alpha black over a colour.
3. **No pillow shading** (a dark ring round a light centre). Shade by form and light direction.
4. **Clusters, not noise**: no isolated single pixels except deliberate sparkles, stars, specular dots and eyes.
   Clean jaggies: curves step consistently (1-1-2-3...), no doubles or L-corners on an outline.
5. **Anti-alias** interior curves where two contrasting ramps meet, with an in-between tone. Never AA the outer ink
   outline into the background (backgrounds change).
6. **Dither only** for big gradients (sky, light shafts, fog banks), with a 2x2 or 4x4 ordered pattern; never on a
   sprite, never as texture noise.
7. **Gradients are stepped bands**, 2-6 px each, never a smooth canvas gradient.
8. **Specular**: glossy things (metal, gems, glass, slime, buttons) get one bright dash top-left and one small
   reflected dash bottom-right.

## 5. Outline

- **The outside silhouette is `#140c1c`, 1 px**, on every sprite, portrait, icon, map sprite, UI part and piece of
  lettering. No sprite floats without it.
- **Interior lines use the darkest tone of the local ramp**, not ink (selective outlining): the line between a sleeve
  and a tunic is the tunic's darkest tone.
- The outline may thin to the darkest local tone where the key light hits a broad lit edge (top-left) on pieces 40 px
  or larger; never on small sprites, icons or lettering.
- **Backdrops have no ink outline** except on near-layer props the actors interact with (a stump, a crate, the
  stage's floor lip). Far layers lose detail and edges, not gain lines.
- **Lettering**: ink outline + a 1 px drop shadow under it (the bold font bakes both). Display lettering (the logo,
  big banners) adds an extrusion of 2-6 px toward the bottom right in a deep tone of its face colour, ending in ink.
- **The Atlas** (the world map, the title, region restoration) is the one place with drawn lines as a style: ink lines
  in the atlas-ink ramp, 1 px, with a darker 1 px "pressure" dot where a stroke starts or ends. Inked land is
  outlined; fog has no outline (it is the absence of drawing).

## 6. Proportions per character type

Sizes are the frame (the texture) and the figure inside it. Facing: **heroes and companions face right, foes face
left**, always; portraits face into the scene (a speaker on the left looks right).

| Type | Frame | Figure | Rules |
| --- | --- | --- | --- |
| Hero (fight) | 54 x 42 (`HERO_W/H`), feet at x 23 (`HERO_FEET_X`) | 24-30 px tall, head 9-11 px | Chibi, about 2.5-3 heads tall. Shared rig (`art-rig.ts`): same feet line, same head size, same stance width, so swaps line up. The weapon may leave the figure but stays in the frame. |
| Hero card | 40 x 48 | bust to knees | The hero's own palette on a rarity-tinted round glow; same head size across all sixteen. |
| Hero at 3x (menus) | the fight frames scaled whole | | Never redrawn at 3x: the 1x frame scaled. |
| Map walker | 13 x 16 | 12-14 px | 3 heads tall, the hero's two key colours readable at 1x. 2 idle + 2 walk frames minimum. |
| Companion | 36 x 24 | 12-20 px | Rounder and softer than foes; big eyes with a 1 px highlight. |
| Summoner ally | 24 x 22 | 12-18 px | Reads as the summoner's (shares one accent colour). |
| Foe, small | about 20-34 wide | 10-20 px tall | Low and wide (critters, slimes): the silhouette tells you what it is. |
| Foe, standard | 28-40 | 20-35 px tall | Humanoids match the hero's head size (2.5-3 heads). |
| Elite / mini-boss | 40-66 | 30-50 px | A crown, a banner colour or armour that marks it as above the rest. |
| Region boss | 60-105 | 45-80 px | Fills a third of the stage's height or more; one dominant shape; a phase look per phase. |
| Portrait | 40 x 40 | head and shoulders | 3/4 view, the head about 60% of the frame, eyes on the upper third line, lit from the top left, a darker rim on the shadow side. Same eye line across every portrait. |
| Map sprite of a foe | 8-16 wide (mini-boss 14-20, boss up to 24) | | 1-2 frames, facing left, ink outline, the full sprite's two main colours. |
| Icon (relic, skill, item) | 12 x 12 | 10 x 10 inside | Ink outline, one silhouette, 3-tone ramps, readable at 1x. Tag 7 x 7, map icon 15 x 15. |
| Critter (map life) | 3-10 px | | Muted, never brighter than the land under it except a sparkle. |

## 7. Animation

Everything animates from `now` and seeds (screenshots stay exact). Minimum frames:

| What | Minimum | Notes |
| --- | --- | --- |
| Hero (fight) | 12 poses: idle0, idle1, windup, slashA, slashB, dash, leap, parry, hurt, cast, down, fin | Idle breath 2 frames at 420-450 ms; the target is 4 (breath + secondary motion: cape, hair, plume). |
| Foe | idle0, idle1, windup (the tell), attack, hurt, flash (white silhouette, generated) | A special's telegraph holds its windup 0.6-1.0 s. Bosses: a look per phase. |
| Companion | idle0, idle1, act | Fliers flap on idle; walkers breathe. |
| Map walker | idle0, idle1, walk0, walk1 | |
| Critter | 2-3 | Startle frame on tap. |
| Effects | 3-6 frames or a closed-form shape in time | Slashes, rings, bursts (section 10). |

- **Anticipation** before every attack: the windup frame is held at least 80 ms (heroes) and is a pose, not a nudge.
- **Follow-through**: an attack ends on a pose past the hit (the blade low, the body leaning), then eases back to idle.
- **Squash and stretch**: on a landing, a jump, a big hit taken. Done with frames, or with a transform squash of at
  most 100 ms (the only time a sprite may be at a fractional scale). Volume is kept (squash wide = short).
- **Secondary motion**: capes, plumes, hair, tails and chains lag the body by a frame.
- **Ease** every move (`easeBack`, `easeOut3`); nothing moves at a constant speed except drifting particles and fog.
- Idle loops 900-1400 ms; nothing loops faster than 300 ms except sparkles.

## 8. Backdrops

- **Layers, back to front**: sky (stepped bands, dithered at the joins), far silhouettes (low contrast, tinted toward
  the sky colour: atmospheric perspective), mid layer, near layer (the most saturated scenery, still below the actors),
  the ground strip, and a foreground frame (`frame_*`: leaves, rocks, icicles at the edges, darkest values).
- **The ground strip under the actors stays calm**: low contrast, no high-frequency detail within 10 px of the feet line.
- **Actors pop**: the backdrop's value range sits inside the middle; actors own the darkest darks (ink) and the
  brightest lights and the most saturation.
- **Painterly shapes**: organic clumps with scalloped edges, layered silhouettes, light shafts, long thin rain or snow
  streaks; never a tiled rectangle pattern visible as such.
- Every act has its own backdrop, painted once (lazily for later regions), and its own colour grade and rays.

## 9. Lighting and atmosphere per region

| Region | Key light | Ambient | Rim | Air |
| --- | --- | --- | --- | --- |
| Greenmarch, act 1 (forest) | warm white-gold, top left, god rays | green-blue | pale gold | drifting leaves, motes |
| Greenmarch, act 2 (ruins) | moonlight, top left; braziers below | night blue | pale blue | rain streaks, drips off the arches, brazier embers |
| Greenmarch, act 3 (hollow) | the low sunset sun, from the left | plum | orange | autumn leaves, fireflies, warm dust |
| Frostpeaks | cold white, high | steel blue | ice cyan | snow streaks, spindrift |
| Ashfell | ember orange from below the frame plus a dim top-left key | smoky purple | orange | embers rising, ash falling |
| The Atlas (title, world map) | lamplight, top left, warm | parchment | gold | fog drifting at the edges, ink motes |

A new region (another team's) brings its row here: key, ambient, rim, air.

## 10. Effects

- **Bold shapes**: thick crescent slashes, cloud-shaped starbursts, chunky white diamond shards, thick rings.
- Effects are lit like everything else (bright core, coloured body, dark trailing edge) and use the thing's colour
  (a red's block shatters red, a crit flashes gold).
- **Every effect shows on the thing it affects** (the block, the foe, the cursor, the hero), never only as a word.
- White frames and shakes come from `tuning.impact` only (one weight per kind of blow).

## 11. UI (the rules from `docs/ui-style.md`)

1. **One focal point per screen**, big and animated; everything else smaller, quieter and placed around it.
2. **Fewer words**: icons, bars, pips, one-to-three-word labels; sentences only in a `Sheet` after a tap.
3. **Depth, not boxes**: a painted stage, a light source, a vignette, rarity glows; detail on **glass plates**
   (translucent ink, a lit top edge), never an opaque navy panel as the main look.
4. **Motion**: enter 220-300 ms `easeBack`, 40 ms stagger; idle loops; presses sink 1-2 px and flash for 140 ms;
   rewards always burst.
5. **Shared parts** from `view/ui-modern.ts` and `camp-kit.ts`; no private variants.
6. **Type**: bold scale 1 (7 px caps) is the smallest must-read size; bold scale 2 for a screen's focal name; the
   small font only for secondary detail. Never two lines of small text where one bold word would do.
7. **Nothing is a plain rectangle**: buttons, bars, plates have cut corners (1-2 px), a bright rim top and left, a
   dark band bottom and right, a 2-3 tone fill and specular dashes.
8. Hit targets at least 14 x 14 game px; 4 px between related things, 8 px between groups.

## 12. The sharper layer (2x)

A DOM canvas over the game's at 2x its resolution (`hd-layer.ts`, 654 x 300 fine px), used where finer lettering or
detail reads clearly better: the chest reveal now, then menus, cards and long text.
- Still pixel art: hard pixels, 1 fine-px ink outlines, ramps lit from the top left; art drawn on the fine grid
  (`art-*-hd.ts`), lettering from `font-hd.ts` (the game fonts doubled with Scale2x).
- Sprites keep the game grid (scaled whole); only rims and effects around them may be fine. Never mix grids in a
  piece; a screen may mix layers (a 1x sprite on a 2x card).
- Fine text must be at least the size of bold scale 1 (14 fine px caps) to be must-read.

## 13. The name and the logo

- The game's name lives only in `src/data/brand.ts` (`GAME_NAME`). **Anything that shows it is built from the
  constant** (the logo's lettering, the page title, the install name), so a rename needs no art change.
- The logo is display lettering generated from the font masks: a parchment-to-gold face, a rim light on the top-left
  edges, an extrusion toward the bottom right, an ink outline round all of it; a short article ("The", "A") set small
  above the main words; a split into two lines when one would be too wide.

## 14. Checking a piece (the audit's score)

Each item gets 1-5: **5** follows every rule and sits with its neighbours; **4** a small slip (a stray pixel, one
missing tone); **3** one rule broken in a way a player would notice (no outline, flat shading, wrong light, off-scale);
**2** several, or it looks from another game; **1** placeholder. Check:

1. Ramps (3+ tones, hue-shifted), no pillow shading, no noise.
2. Light from the top left; contact shadow; the region's rim.
3. Ink outline outside, ramp tones inside.
4. Proportions and facing for its type (section 6), same head size and eye line as its peers.
5. Frames at least the minimum (section 7), with anticipation and follow-through.
6. Reads at 1x on the phone (squint test: the silhouette alone tells you what it is).
7. Sits in its scene: the actor pops from the backdrop, the backdrop stays calm under the feet.

Run `node scripts/art-audit.mjs` (header comment) for the contact sheets and screens; scores and the redo list live
in `docs/art-audit/README.md`.
