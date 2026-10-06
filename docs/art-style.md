# Art style guide (all procedural art)

Goal: the polish level of the reference's combat screen and of modern pixel-art RPGs, with 100% original art.
The game is 327x150 game px, shown at 8x on an iPhone 16 Pro (2.67 CSS px per game px). One game px is a
big chunky pixel, so every pixel counts.

## What the reference does that we must match

- **Everything has a dark outline** (`#140c1c`), 1 px, around sprites, icons, UI, and text. Text also has a
  1 px drop shadow under the outline, which gives it depth.
- **Nothing is a plain rectangle.** Buttons, bars, blocks and panels have rounded corners (cut 1-2 px), a
  bright 1 px rim on the top and left, a dark band on the bottom and right, and a fill with 2-3 tones.
  Specular dashes in the top-right and bottom-left corners make things look glossy.
- **Heavy, mixed-case font**: thick 2 px stems, proportional widths, outline plus shadow ("Block!",
  "Tap to begin!").
- **Painterly backgrounds**: organic leaf clumps with scalloped edges, layered silhouettes, atmospheric
  perspective (far layers are low contrast and tinted toward the sky), a limited palette per scene, long
  thin rain streaks, light shafts.
- **Effects are bold shapes**: thick crescent slashes, cloud-shaped starbursts, chunky white diamond
  shards, thick rings.

## Modern pixel-art techniques (Sea of Stars, Eastward, Celeste, Shovel Knight style)

1. Light comes from the top left. Every material has at least 3 tones.
2. **Hue shifting**: shadows shift cooler (toward blue or purple), highlights shift warmer (toward yellow).
   Never shade by only darkening the same hue.
3. **Selective outlines**: the outside silhouette uses `#140c1c`. Interior lines use the darkest tone of
   the local ramp, not black.
4. No pillow shading (dark ring around a light center). Shade by form and light direction.
5. **Clusters, not noise**: no isolated single pixels except deliberate sparkles or stars. Clean jaggies:
   curves step consistently (1-1-2-3 ...).
6. Anti-alias interior curves where two contrasting ramps meet, using an in-between tone.
7. Readability first: actors are higher contrast and more saturated than the backdrop. The ground strip
   under the actors stays calm.
8. Dither only for big gradients (sky, light shafts), with a 2x2 or 4x4 ordered pattern.

## Shared ramps (dark to light)

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
