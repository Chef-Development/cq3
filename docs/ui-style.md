# UI style guide: the modern menus (playtest round 6)

The playtester's verdict on the menus: "dated, simplistic and empty". This guide says what "modern" means for this
game, the shared parts every menu is built from, and a layout plan for each screen being redesigned. It sits on top of
`docs/art-style.md` (outlines, ramps, light from the top left), which still holds for every pixel.

The canvas is 327 x 150 game px, shown at 8x on an iPhone 16 Pro held sideways (one game px = 2.67 CSS px). The
Dynamic Island and the rounded corners eat about 22 px at each side (`s.L`, `s.R`) and the home bar about 8 px at the
bottom (`s.B`): plan every screen for about **283 x 142** of safe space. The top bar's middle is kept clear for the
HTML gear button (`kit.hudZone()`).

## What "modern" means here

1. **One focal point per screen, big and alive.** Every screen has one hero thing, drawn large and animated: the hero
   full-body at 3x on a lit stage, the skill tree's glowing paths, the chest on the shrine's altar, the region's map.
   Everything else is smaller and quieter, and placed around it. If a screenshot has no obvious first place for the
   eye, it fails.
2. **Fewer words.** Icons, bars, pips and short labels (one to three words) instead of sentences. A sentence only
   appears after a tap, in a detail sheet (`Sheet`), or where reading it is the point (a companion's perks: the
   playtester likes reading what they do, so that text stays, set as cards). Numbers sit on meters, not in prose.
3. **Depth, not boxes.** A painted backdrop in layers (sky or wall, far silhouettes, near props, a floor), a light
   source (a spotlight cone and its floor pool, a crystal glow, firelight), a vignette darkening the edges, and rarity
   glows behind anything rare. Detail sits on **glass plates** (dark, translucent, a lit top edge) over the scene, not
   on opaque navy panels. The old full-width navy panel is never the main look of a redesigned screen.
4. **Motion.** A screen animates in (the backdrop fades, the focal thing rises or scales in with a slight overshoot,
   the details follow in a 40 ms stagger). Idle: the hero breathes (two-frame idle), auras pulse, motes drift, light
   flickers. Every press sinks 1-2 px and flashes; a success bursts particles and rings. Rewards always get particles.
5. **One shared component set** (`src/engine/view/ui-modern.ts`, below), used by every redesigned screen. A new screen
   adds what it needs there (append new exported functions at the end of the file) rather than drawing its own
   private variant.
6. **Large type.** Bold scale 1 (7 px caps, about 19 CSS px on the phone) is the smallest size for anything the player
   must read to act: labels, buttons, names on cards. Bold scale 2 for the screen's name or the focal thing's name. The
   small font (5 px caps) only for secondary detail: a number under an icon, a sheet's body text, a caption. Never two
   lines of small text where one bold word would do.

## Tokens

- **Depths:** a redesigned camp screen draws its backdrop image at `D.ui - 0.004` (over the camp, under the
  screen's own graphics), its graphics on the kit's layers (`kit.gUi`, `kit.gOver`, `kit.gTop`), and its sprites at
  `D.icons`. Effects go on `kit.fx` (the camp's particles, rings, floats, flashes).
- **Colour:** each screen has a theme (a `StageTheme`: sky, far, near, floor, light and accent colours). Rarity colours
  are `TIER_INFO[tier].face` everywhere (the aura, frames, banners). Accent text: gold `0xffe680` for what you earn,
  green `0x8af06a` for done/good, red `0xff6a5a` for refused, the theme's light colour for highlights.
- **Spacing:** 4 px between related things, 8 px between groups, 3 px inside a card's frame. Hit targets are at least
  14 x 14 game px (37 CSS px).
- **Motion:** screen enter 220-300 ms `easeBack`; stagger 40 ms per item; a press shows for 140 ms (`notePress` /
  `isPressed`); an idle loop is 900-1400 ms; nothing loops faster than 300 ms except sparkles. Everything animates from
  `now` (performance.now, faked in screenshot tests) and seeds, never `Math.random` per frame unless the result is
  only cosmetic noise that the camp's seeded particles already use.

## The shared components (`src/engine/view/ui-modern.ts`, art in `src/engine/art-ui-stage.ts`)

| Part | What it is |
| --- | --- |
| `ensureStage(scene, theme)` / `drawStage(kit, theme, now, o)` | A painted 327 x 150 backdrop per `StageTheme` (sky bands, far and near silhouettes, a floor with a stage disc), painted once on first use; drawn with its light cone, floor pool, drifting motes and the vignette. Themes are data (`STAGE_THEMES`); a screen adds its own theme there. |
| `vignette(g, s, k)` | Darkens the edges and corners in stepped bands. |
| `spotlight(g, cx, topY, floorY, wTop, wBot, col, a)` | A stepped light cone and its floor pool (draw on an ADD-blend layer or with low alpha). |
| `aura(g, cx, cy, rx, ry, tier, now)` | A rarity glow behind a hero, companion, chest or prize: stepped ellipses in the tier's colours, rising motes, the top tiers' twinkles. |
| `glass(g, r, o)` | The detail plate: translucent ink, a soft shadow, a lit top edge, an optional accent rim. |
| `iconCard(kit, layer, r, o, now)` | A square card: an emblem (any draw callback), a coloured frame (tier or accent), a label under it, selected glow, pressed sink, a badge. The kit, the perks, the shop items... |
| `meter(g, texts, r, frac, o)` | A chunky labelled bar: icon, label, value, fill ramp, notches, a glow when full. |
| `pips(g, x, y, n, lit, o)` | N pips in a row (stars, seals, dots): lit ones bright, the next one pulsing. |
| `ring(g, cx, cy, r, frac, o)` | A round meter (completion %, pity). |
| `bigButton(kit, g, texts, r, label, face, now, o)` | The screen's main action: tall (18-20 px), a sheen that sweeps across now and then, a pulsing halo, a price inset. |
| `infoButton(g, texts, r, now)` | A round "i" that opens a `Sheet`. |
| `Sheet` | A detail sheet: slides up over the screen on a glass plate, a title, wrapped body lines, closes on any tap outside it. |
| `enterK(now, at, i)` | The stagger: 0 -> 1 for item `i` of a screen opened at `at`. |
| `bigName(texts, s, x, y, col, o)` | Bold scale 2 with an extrusion: the screen's focal name. |
| `SwipePager` | A stage that pages with a horizontal swipe: the press held until let go (a tap if it stayed put), the focal thing following the finger, a page turn past `SWIPE_PAGE_PX` or on a flick, else a snap back (`offset(now)`). The companions screen uses it; the hero select has its own copy of the same logic. |

The camp kit (`camp-kit.ts`) keeps its buttons, counters, frames, toasts and the `CampFx` particles; the modern parts
use them.

## Layout plans (Part 2)

Coordinates are game px inside the safe area (`L` to `R`, 0 to `B`); "the stage" is the left part of the screen.

### Hero select

- **Focal:** the hero full-body at 3x (their fight idle frames, breathing) standing on a round stage at about
  (L + 64, B - 18), lit by a spotlight from above, a rarity aura behind them. The backdrop is themed by the hero's style
  (Blade: a castle yard with banners; Shadow: moonlit rooftops; Guardian: a stone gate with torches; Marksman: a dusk
  forest; Brute: a quarry; Controller: an ice cave; Summoner: a glowing grove; Bomber: a workshop).
- **Paging:** big arrows either side of the stage and a horizontal swipe on it; the hero slides out and the next slides
  in with a dust puff on landing. The small face strip stays in the top bar for quick jumps.
- **Right column** (from about L + 132): the name (bold 2), the title (small), the rarity and style chips; stars as five
  big stars with a shard meter under them; the level as "Lv 8" and an XP meter; mastery as four seals (lit when done).
  Tapping the stars or the seals opens their `Sheet` (what each star gives; the four goals and what they unlock).
- **The kit** as four icon cards in a row (signature, green ability, passive, finisher), each an emblem and a one-word
  label; a tap opens the card's `Sheet` (its name, the full line with numbers, what it does to the bar).
- **Actions:** a big Pick button (green, pulsing; gold "Picked" with a check) at the bottom right; Skills (blue, a
  gold "!" when there are points) beside it; Stats as a small icon button.
- **Not met yet:** the hero as a dark silhouette on a dim stage, "?" over them, a gold chip with how they're found;
  Pick reads "Locked" and shakes.

### Skill tree

- **Focal:** the tree itself on a themed backdrop (the hero's style theme, darker): three branches grow up from a root
  at the bottom centre of the tree area, five nodes each, bottom to top. Nodes are big emblems (18 x 18; the capstone
  a 22 x 22 crest with a gold rim, rays and a slow sparkle). Paths link root -> node 1 -> ... -> capstone.
- **Paths:** unlearned paths are dark grooves; learned ones glow in the branch's colour with a slow pulse running
  along them; the next learnable node pulses and its path is drawn dashed and bright.
- **Learning:** tap a node, then Learn: an energy pulse runs from the last lit node (or the root) along the path, the
  emblem bursts alight (ring, particles, a rising chime), and the points counter ticks down.
- **Detail:** a glass card on the right (about 100 px wide): the node's emblem, name, one line of what it does, the
  branch's name; the big Learn button at its foot (or "Learned", or what it needs).
- **Top bar:** Back, the hero faces, the points counter (a big star and a number), Reset.

### Companions (reworked in round 7 to match the hero select)

- **Focal (the stage, left, the hero select's width):** the companion at 3x, centred on a low mossy stump in a moonlit
  grove (the moon behind its head), a lamp's light in its own colour on it, its rarity aura behind it, fireflies;
  fliers hover and flap, walkers breathe. A tap: a hop, its attack pose, a chirp, a ring. Not met: a rim-lit
  silhouette with a "?" on a dim stage.
- **Paging:** big arrows either side and a swipe on the stage (`SwipePager`): it slides out, the next hops in and
  lands (dust for a walker, a flutter for a flier). The strip of round tokens in the top bar (silhouettes when not
  met, a check on those along) jumps straight to one; it shrinks to 15 or 13 px so twelve still fit.
- **Along (the stage's foot):** two sockets (the second padlocked until the Companion Perch: a tap rattles it and a
  tip says "Build the Perch") and the big Equip/Unequip (Along, Locked).
- **The column:** a glass head with the name (bold 2) and its rarity chip, the stars (pips, a shard meter under them)
  and the level (an XP meter); then **what it does**, read as cards on one glass plate: the attack, then each perk (an
  icon, the name in its colour, the description in bold). Every description shows in full when they all fit; when it's
  crowded (three perks on a phone) the attack shrinks to one row and each perk shows its short line with a chevron.
  A tap on any card opens its `Sheet` (the full line, what stars do to it); the stars, the level and the name open
  theirs. The words are built in one place: `view/companion-cards.ts`.

### Camp upgrades (in the camp scene)

- No list screen: each upgrade is an object in the camp, and buying it changes the camp. Before it's bought its spot
  shows a faint ghost outline with a small hammer marker; tapping it opens a glass card (name, one line, price, Build).
  After: a build puff (dust, hammer clangs) and the object stands there for good, lit by the fire.
- Objects: Companion Perch (a wooden perch by the log; the second companion sits on it), Lucky Stone (a glowing stone
  by the tent), War Table (a table with a map and pins), Reroll Charm (a charm hanging from the tent pole that turns in
  the wind), Map Table (a lantern-lit table with a rolled map), Training Dummy (the dummy by the shrine, as now).
- The "Upgrades" screen becomes the camp in build mode: the dim lifts, the ghosts pulse, a short banner says what to do.

### Completion tracker

- **Focal:** a region card: the region's map painted on parchment in a wooden frame, its act sites marked; on it,
  wax seals and checkmarks for what's done (a flag on each cleared act's site, crown seals for mini-bosses, a skull
  seal on the boss's site, scroll seals for bounties, chest seals for treasures, star seals for events), dim empty
  sockets for what's left.
- A ring meter with the region's % beside the map; under it, the 100% reward (the region chest and gems) on a pedestal,
  glowing more as the % climbs. Tapping a seal names it ("Bounties 2/3").
- Other regions as banner tabs down the side (locked ones as "???").

### Shrine

- **Focal:** a painted shrine (a stone arch, candles, runes, a purple crystal light) with the Rare chest on an altar at
  its centre, bobbing in the crystal's light.
- **Pity** as a crystal vial beside the altar that fills with light toward the guaranteed Legendary, with "N left"
  under it; the top pity as a thinner second vial.
- **Odds** behind an `infoButton` (a `Sheet` with the tier bars).
- **One big action:** "Open" with the gem price, under the altar: it pays and opens the chest right there (the opening
  sequence below). Short of gems, it shakes and shows what's missing.

### Chest inventory

- **Focal:** the chests as objects, big, side by side on a lit stone floor in a vault (a torch on each side): the Hero
  chest, the Rare chest and the Region chest, each with its own art, a count badge, a glow when one is waiting, dark
  and dusty when none are.
- Tap a chest to open one; "Open all" when more than one waits (they open one after another, then a summary).

### The chest opening (Part 3)

- The screen darkens; the chest drops in and slams down (dust, a thud, the screen shakes); it shakes in growing
  pulses; cracks of light leak from its seams; the glow climbs through the rarity colours (grey, green, blue, purple,
  orange, red, cyan, prismatic) one step per pulse and stops at the prize's tier (higher tier = more steps, bigger
  shakes, longer). Then the lid bursts: a flash, rays, particles; the prize rises as a dark silhouette rimmed in its
  tier's light, then fills in with a white flash; a rarity banner, the name, and a fanfare sized to the tier.
- A tap during the build-up jumps to the next step (fast-forward, never skipping the reveal); "Open all" chains them.

## Checking a screen

Render each redesigned screen to a screenshot (the Playwright screenshot tests, 874 x 402 at 3x) and check:
1. Is there one obvious focal point, big and alive?
2. Could any sentence be a label, an icon or a meter? Is every must-read word bold scale 1 or bigger?
3. Is there depth (backdrop layers, light, vignette, glow), and no flat navy box as the main look?
4. Does it animate in, idle, react to presses, burst on rewards?
5. Does it use the shared parts (frames, buttons, meters, sheets) like the other screens?
6. Does everything fit inside the safe area with nothing cut off or overlapping at 8x?
