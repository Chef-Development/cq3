# Art audit (playtest round 8, team 2)

Every texture group and the main screens, scored against the art bible (`docs/art-style.md`, section 14: 5 follows
every rule, 4 a small slip, 3 one rule broken that a player would notice, 2 several or from another game, 1 a
placeholder). Contact sheets come from `scripts/art-audit.mjs` (run it by hand against a dev server: see its header);
`before/` is the game as this round found it, `after/` the pieces redone since.

| Sheet | What's on it |
| --- | --- |
| `before/screens.png` | the main screens at phone size: title, world map, three act maps, a fight in every act, camp, hero select, companions, shrine, vault, completion card, a story scene |
| `before/sheet-heroes-a.png`, `-b.png` | the sixteen heroes' fight frames and hero cards (x2) |
| `before/sheet-foes-*.png` | every foe's frames per region (Greenmarch x2, Frostpeaks and Ashfell x1) |
| `before/sheet-companions-allies.png` | companions, their cards, the Summoners' allies (x2) |
| `before/sheet-portraits.png` | portraits, the camp's people and backdrop (x2) |
| `before/sheet-map-sprites.png` | map walkers, foe minis, lairs, map icons, critters (x3) |
| `before/sheet-icons-*.png` | skill, relic, item and tag icons (x3) |
| `before/sheet-backdrops.png`, `sheet-stage-light.png` | the nine fight backdrops and their frames; colour grades, rays, foregrounds |
| `before/sheet-world-map.png`, `sheet-world-pieces.png` | the world map and its moving parts (veils, fog, sea, wind) |
| `before/sheet-ui-chrome.png` | the bar's frame, the band, chests, the shrine's parts, the old logo |

## Scores

| Item | Score | What's off |
| --- | --- | --- |
| Heroes' fight frames (all 16 on the shared rig) | 4 | Consistent rig, ramps and outlines. Now 4-frame idles with secondary motion and every pose of the bible's twelve (round 8, A2B-2). |
| Rowan's fight frames (`hero_*`) | 3, now 4 | Was off the shared rig with 9 poses; redrawn on it with all 14 (below). |
| Hero cards | 4 | Same glow and framing for all sixteen. |
| Greenmarch foes | 4 | Cohesive; good tells. |
| Frostpeaks foes | 4 | The wisp and the hailcaller are small inside their frames. |
| **Ashfell foes: chain sentinel, forgehand, obsidian ox, cinder kite** | 3 | Dark on dark: their values sit inside the Ashfell backdrops' range, so they don't pop (section 8). Needs a lighter rim on the ember side. |
| Other Ashfell foes, the three region bosses | 4-5 | Strong silhouettes, phase looks. |
| Companions, their cards | 4 | Soft, readable, consistent. |
| Spirit stag (Summoner ally) | 3, now 4 | Was stick legs and a flat fill; rebuilt (below). |
| Other allies | 4 | |
| Portraits | 4 | Same bust framing; lit from the top left. |
| Map walkers, foe minis | 4 | Every foe has one; readable at 1x. |
| Map lairs | 4 | |
| **Cinder lair** (`maplair_cinder`) | 3 | A flat stepped block with stripes: no volume or light, unlike the other lairs. |
| Critters, map icons | 4 | |
| Item icons | 5 | |
| **Relic icons** | 3 | The Frostpeaks' 15 relics share stand-in glyphs (a rail, a snowflake), so the icon doesn't say what the relic does. |
| **Skill icons** | 2 | About half of the 240 skill nodes reuse a generic purple up-arrow or a gold frame. |
| Tag icons | 4 | |
| Backdrops: forest, hollow | 5 | Layers, light shafts, calm ground. |
| Backdrops: ruins, pass, caves, glacier, cinder | 4 | |
| Backdrops: glass, forge | 3, now 4 | Were flat; a far cavern, heat shafts, a far ridge, a lit plume, a calm floor (below). |
| World map (craft) | 4 | Lush and well made, but a painted continent, not the inked Atlas the new story needs (the planned rework). |
| **World map veils** (`wm_veil_*`) | 2 | Flat grey with rectangular holes: reads as a placeholder, not erased land. To become Atlas fog (blank paper, faded lines). |
| Act maps | 4 | Busy but cohesive. |
| Completion card (parchment map) | 4 | Already close to the Atlas look. |
| **Title (before)** | 3 | The old "Combo Quest 3" chrome logo and crest over a reused fight stage; nothing of the new premise. Redone this round (below). |
| Fight HUD, bar, band | 4 | |
| Camp, hero select, companions, shrine, completion, story | 4 | Follow ui-style.md. |
| **Vault** | 3 | Dim: the chests barely lit, a big empty floor, no focal light. |
| Chest reveal (old and sharper) | 5 | |

## Outliers (the redo list, worst first)

1. Skill icons (2, now 3): about half were generic; now themed emblems, still repeated within a tree.
2. World map veils (2): placeholder fog. Part of the Great Atlas rework of the world map.
3. Relic icons sharing generic glyphs (3): done, the Frostpeaks' 15 painted.
4. Rowan's fight frames (3): done, on the rig with every pose.
5. The dark Ashfell foes (3): done, an ember rim from below.
6. The glass and forge backdrops (3): done, depth and air.
7. The vault (3): dim, no focal light.
8. The spirit stag (3): done. The cinder lair (3).
9. The world map's style (4 in craft): becomes the inked Atlas.

## Redone

| Item | Before | After | Notes |
| --- | --- | --- | --- |
| Skill icons | 2 | 3 | `after/sheet-icons-skills.png`. The 127 rule nodes and capstones without a painted icon now show the emblem their name is about (15 emblems: smoke, ice, thorns, bomb, flame, shield, arrow, rock, fist, hourglass, bell, sun, clover, dagger, moon; gold corners on capstones; `art-skill-emblems.ts`, unit-tested). Two keep the rune. Still to do: painted icons per node (a hero's tree repeats its theme's emblem). |
| Relic icons (the Frostpeaks' 15) | 3 | 4 | `after/sheet-icons-relics-items.png`. Each its own picture (a skate, a frost rune, cocoa, a hammer on ice, a plough in snow, an ice heart, a frosted fang, a melting cube, a grip, a held note, a knot, a valve, a tether, a lucky mitten, crampons) instead of a stand-in snowflake or rail. |
| Dark Ashfell foes (ox, sentinel, forgehand, kite) | 3 | 4 | `after/sheet-foes-ashfell.png`, `after/fight-act8-uplit.png`. Ashfell's light recipe applied: an ember rim along their lower edges (light from below), a faint cool lift on the top edges (`art-ash.ts` emberRim). |
| Title screen, logo, key art | 3 | 4 | `before/title-phone.png`; `after/title-phone.png`, `after/title-desktop.png`, `after/title-continue.png`. The Atlas spread open: an inked parchment map, colour come back round the hero, fog over the erased east, a quill drawing the route; the logo built from `GAME_NAME` (Scale3x lettering, gold face, rim light, extrusion, ink outline). |
| Rowan's fight frames | 3 | 4 | `after/rowan-before-after.png`, in a fight `after/fight-act1-rowan.png`. On the shared rig (`art-hero-rowan.ts`): the peers' head size and stance, 14 poses (idle0-3, windup, slashA, slashB, dash, leap, parry, hurt, cast, down, fin), a plume and a cape that lag his breath, polished steel. |
| Heroes' idles | 4 | 4 | `after/heroes-idle4.png`. Every hero idles in four frames (the secondary piece a frame behind); Sable gains fin and cast. |
| Spirit stag | 3 | 4 | `after/stag-before-after.png`. A haunch and a shoulder, jointed legs with hocks and hooves, great antlers, fewer specks. |
| Backdrops: glass, forge | 3 | 4 | `after/backdrops-glass-forge.png`, in a fight at phone size `after/fight-act8-glass.png`, `after/fight-act9-forge.png`. The warren: a tall arch onto a hazy far cavern (pillars at two depths, heat shafts), the lake's light on the wall, embers rising. The forge: a far ridge, a heat plume lit from below, pilasters, a calm strip under the feet. |
