# Fight events for the view (playtest round 6)

What the combat core (`src/core/`) now emits or exposes for the fight's drawing and sound. Names are stable: draw
from these. Everything else about events is in `CombatEvent` (`src/core/combat.ts`). "Perk event" = `{ type: 'perk',
id, amount, enemyId, pos? }` (from `c.perkFx`); a perk's blow on a foe is a perk event followed by an `enemyHurt` with
`source: 'perk'`.

## Changed for every perk blow

- **`enemyHurt.perk?: string`** (new, optional): which perk struck (`'shieldSlam'`, `'bulwarkBlow'`, `'emberBite'`,
  `'thornling'`, `'powerShot'`...). Set on every `c.strike(...)`; absent for taps, bombs, finishers and pets. Use it to
  style a damage number per source.
- **`c.strike(e, dmg, id, crit?, pos?)`**: the perk event now carries `pos` (where on the bar it came from) when the
  caller knows it (Shield Slam, Wide Slam, Bulwark blows).
- **`{ type: 'hitStop', ms }`** now also comes from perks with their own freeze (`c.hitStopFor(ms)`): a Shield Slam
  (`tuning.juice.slamStopMs`, 35 ms) and a Bulwark (`juice.bulwarkStopMs`, 110 ms). The sim (cursor, reds) is frozen
  for `ms`; scale the scene's own freeze/shake with the impact tiers below.
- **Impact tiers** (`core/impact.ts`): new `'slam'` (weight 0.35: between block and crit) and `'bulwark'` (0.82:
  between a 5-stack finisher and a kill). `IMPACT_TIERS` has 10 entries now.

## Hollis (Guardian): the block is his moment

- **Shield Slam, every block**: after each `block` event (a plain one too; a cracked shield too), a perk event
  `'shieldSlam'` (amount = damage, enemyId = the red's owner, pos = the block) and its `enemyHurt` (`perk:
  'shieldSlam'`), then a `hitStop` (35 ms). A Perfect block's slam is bigger (`kits.hollis.slamPerfect` vs `slam`; the
  `block` event just before says `perfect`). Look: a shield-bash bolt from the hero to the owner, a chunky metal
  number (bigger/brighter for a Perfect), the tier `'slam'`. Sound: `audio.shieldCounter(perfect)` (SFX ids
  `shieldCounter`, `shieldCounterPerfect`) over the block's own clang.
- **Guard** (style readout): still `c.perk.guard` (0..`guardMax(c)`: 5, 7 at 3 stars), `'guardUp'` perk event per
  charge (amount = Guard now). Hits **no longer spend it** (the old `'guard'` "Bash!" event is gone).
- **Bulwark**: at full Guard the next block or hit sets it off. Perk event `'bulwark'` (amount = charges spent, pos =
  the block/hit) = the moment; then one `'bulwarkBlow'` strike per living foe (perk event + `enemyHurt` with `perk:
  'bulwarkBlow'`), then `hitStop` 110 ms. Look: a big shield shockwave from the hero across every foe, impact tier
  `'bulwark'` (2 white frames, music duck), Guard pips flash and empty. Sound: `audio.bulwark()` (SFX id `bulwark`).
  "Bulwark ready" = `guardOf(c) >= guardMax(c)` (from `core/styles`): worth a ready glow on the Guard tab.
- Skill nodes around it: `'deepGuard'` (perk event after a Bulwark), `'avalanche'` (a Bulwark stuns every foe: perk
  event + `stun` events), `'retaliate'` (amount = Guard stored: the slam was boosted), `'heavySlam'`, `'wideSlam'`
  (strikes on the other foes, pos = the block).

## Neve (Controller)

- **Glacier** (finisher): every red on the bar is **frozen solid where it is**, not turned to ice: each red keeps
  `kind` red/shield/bomb/speed with `chill > 0` and `chillMult === 0` for `kits.neve.glacierSec` (2.5 s); one at the
  left end and an icicle (`still`) wait too. Perk event `'glacier'` (amount = reds frozen). Look: a hard ice coat on
  each red (the current 'pin' frost style is close; make it read as frozen solid), cracking as it thaws.
- **Whole bar slowed**: Glacier lays three `'slow'` zones (`zoneOn` events): the middle patch (`slowWidth`, life
  `slowSec` 4 s) and the two ends (`[0, lo]`, `[hi, 1]`, life `glacierBarSec` 1.5 s). So the whole bar is slow for
  1.5 s, then only the middle. (5 stars: one zone over the whole bar for 4 s.)
- **Big Freeze** (skill node): after Glacier, every red becomes a frozen block (`remove` reason `'perk'`, `spawn` kind
  `'frozen'`, `iceBlock` event) to smash; perk event `'bigFreeze'` (amount = how many).
- Cold Snap no longer gives shattered ice a green's meter (no event change).

## Tam (Bomber): Turnabout (skill node)

- Big Bang with Turnabout turns every red into one of her kegs where it was: `remove` (reason `'perk'`) of the red,
  `spawn` of a `'keg'`, and a perk event `'turnabout'` (enemyId = the red's owner, pos = where) per red. Look: the
  red flips into a keg with a puff (they're her kegs: hit to blast every foe).

## Torva (Brute): Wind-Up grows with the combo

- The smash multiplier is `windUpMult(c)` (`core/kit-fx`): `windUpBase + windUpStep x combo`, up to `windUpMax`
  (1.8 + 0.04/combo, max x4). While armed (`c.perk.windUp === 1`), the bar's wind-up mark can show it live (e.g.
  "x2.6"). When it lands, the `'windUp'` perk event's **amount = the multiplier x100** (e.g. 260). Show the number.

## Vesper (Marksman): targets

- **`Block.target: boolean`** (new): `true` on every green spawned on a Marksman's bar (they come x1.35 wide:
  `styles.targetWidth`). A green fires the stored Focus as a Power Shot. Draw them as targets (a ring/reticle on the
  green; brighter when Focus is full, `focusOf(c) >= focusCap(c)` from `core/styles`).
- **Patience on a crowded bar**: at full Focus with no green on the bar (or only behind a mirror shard), a Perfect hit
  fires the shot (a crit). Perk event `'patience'` (amount = damage, pos = the hit), with the `'powerShot'` strike
  (`enemyHurt.perk: 'powerShot'`, `crit: true`).
- **Volley** now pins icicles too (`still` reds: `chill > 0`, `chillMult === 0`, their fuse waits), and a red pinned
  at the left end waits instead of striking. The arrow-pinned look should cover icicles.

## Moss (Summoner): allies scale with the Companion stat

- `allyPower(c)` (`core/styles`): 1 for a fresh hero, +`kits.moss.allyComp` per Companion point above a fresh hero's
  (as a share of it). Thornling jabs and Glowmoth heals scale with it (a Barkback still stops one red, a Seedling plants
  one green).
- **`ally` events** gain optional fields: `power` (on `'call'` and `'act'`) and `amount` (on `'act'`: a Thornling's
  damage, a Glowmoth's heal; 0 for a brace or a seed). Look: allies a bit bigger/brighter with power (e.g. a glow
  from 1.3), the act's number over the ally or its target.

## Sable (Shadow): the dash lands slow

- After a `dash` event, a `'land'` zone (`zoneOn` kind `'land'`) runs from the landing spot (`dash.to`) toward the
  block the dash aimed at, ending at its near edge; inside it the cursor runs at `kits.sable.landMult` (x0.5) for about
  `kits.sable.landSec` (0.3 s). It goes (`zoneOff`) once the cursor is through it. **New zone kind `'land'`**: today
  `drawPatch` draws nothing for it and the cursor tints as if in snow. Look: the streak's afterimage settling, a soft
  "brake" glow ahead of the cursor, the target block highlighted. (The `'dash'` zone is unchanged.)

## Newt (companion): a burn per foe

- **`Enemy.burn`** (seconds left), **`Enemy.burnDps`** (damage a second), **`Enemy.burnTick`** (seconds to the next
  tick): set by a Newt bite on its target (refreshed by the next bite), 0 when not burning. Each second a tick is an
  `'emberBite'` strike (perk event + `enemyHurt` with `perk: 'emberBite'`). Draw flames on every foe with `burn > 0`
  (bigger with `burnDps`), and the tick numbers in ember orange.
- The old `c.perk.burnFoe` / `c.perk.burnTicks` are still kept for the last foe bitten (the current flames read
  them), but move to `e.burn`: several foes can burn at once now.
