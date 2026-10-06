## Playtest round 5: more foes per fight in Greenmarch, the heroes re-levelled

Greenmarch's fights now come in more waves (Act 1: 3-5, Act 2: 4-6, Act 3: 4-7), and the Ruin Golem has 2100 HP
(was 2300; the extra waves made Act 2 harder for Rowan than for anyone else). Measured like the M5 table below
(`npm run region-tune`, 85% player, 100 runs per hero, the same seeds for every hero; each act's first try, the
boss's first fight in brackets; the gap to Rowan in brackets after it):

| Hero | Act 1 | Act 2 | Act 3 (boss) | Act 4 | Act 5 | Act 6 (boss) |
|---|---|---|---|---|---|---|
| Rowan (Blade) | 100% | 87% | 73% (78%) | 88% | 77% | 65% (66%) |
| Sable (Shadow) | 100% (0) | 96% (+9) | 73% (0) | 99% (+11) | 86% (+9) | 62% (-3) |
| Neve (Controller) | 98% (-2) | 89% (+2) | 69% (-4) | 96% (+8) | 76% (-1) | 69% (+4) |
| Moss (Summoner) | 100% (0) | 87% (0) | 83% (+10) | 99% (+11) | 84% (+7) | 69% (+4) |
| Tam (Bomber) | 99% (-1) | 94% (+7) | 79% (+6) | 97% (+9) | 86% (+9) | 66% (+1) |
| Hollis (Guardian) | 100% (0) | 84% (-3) | 80% (+7) | 98% (+10) | 71% (-6) | 70% (+5) |
| Vesper (Marksman) | 100% (0) | 89% (+2) | 67% (-6) | 93% (+5) | 77% (0) | 45% (**-20**) |
| Torva (Brute) | 100% (0) | 97% (+10) | 73% (0) | 98% (+10) | 79% (+2) | 59% (-6) |

41 of 42 hero-acts are within about +/-10 of Rowan (four sit at +10/+11, where Act 4 nears 100% for everyone;
two runs of the same numbers differ by up to 8 points at 100 runs). What changed, and why:

- **Moss** (the playtester saw few greens): a Summoner's every 5th yellow comes green (about twice the greens). That
  put him +13 to +19 ahead in the second region, mostly at its bosses (his allies' steady damage loses nothing at a
  phase gate, and every Rally re-braced his Barkback). Now a Rally leaves a resting Barkback alone, and HP 95, attack
  share 0.62, Thornling 0.22, Barkback rest 8 s, Glowmoth 0.4%, Deep Roots +4%, Overgrowth +10% per ally.
- **Torva** (the playtester: foes "couldn't really damage me"): Quake 0.08 (was 0.15), Wind-Up stun 1 s (was 1.5),
  Earthsplitter's calm 1.2 s (was 2). Those barely moved the bot's numbers (Act 2 stayed 94-98%): her cushion was the
  Brute's wide yellows (fewer misses, and misses are most of the HP an 85% player loses). Brute yellows are x1.15
  (was x1.3), her attack share 0.86 (was 0.9). Trimming her HP 108 -> 100 or Unstoppable moved nothing beyond noise.
- **Vesper** fell behind with the longer fights (Act 3 -13, Act 6 -19): HP 115, attack share 1.13, and a Power Shot
  keeps the Focus the foe didn't need (a nearly dead foe, a phase gate). Greenmarch and the second region's first two
  acts are level now; **Act 6 is still about 20 points behind** and none of these moved it: a larger Focus cap (9x:
  39%), more of each hit (0.88: 46%), more attack (1.22: 45%), her Volley clearing reds like the others (52%). Her
  first fight with that boss is the gap (47% against Rowan's 66%), with HP going in about the same. Worth a look at
  how a Marksman plays that boss's phases (yellows become holds, the cursor is mirrored), in the bot and in the kit.

The Test lab's hero fights (six waves at Act 2's numbers, a fresh lab hero at level 5 with a Rare kit): the 85% bot
takes 26-42 s and wins 93-100% of them; at Act 3's numbers it lost about half (Rowan included). Guarded in
`tests/unit/lab.test.ts`.

## M5: the heroes, the second region, Rowan's branches, gems and chests

Measured with `npm run region-tune` (Greenmarch played once per seed from a fresh profile, then camp, then the second
region's fresh run from the end-of-Greenmarch hero) and `npm run campaign`, 85% player, 100 runs per hero (same seeds
for every hero and branch). "First try" = the act cleared without a defeat; "boss" = its boss's (or mini-boss's) first
fight won. `tests/unit/bot-region2.test.ts` guards the second region's targets with Rowan.

**What the bot learned this session:** holds (pressed at the near edge; let go when the cursor looks past the far
end, 25 ms late on average, 1.2x its tap spread, an early lift on half its lapse rate: an 85% player drops about 1
hold in 15), each hero's finisher read (who it kills), the third region's bar rules, and a
camp visit between regions (every Rare chest its gems buy, every chest opened, the camp upgrades it can afford, its
rarest companions brought along). Patches (ice, snow, a dash) it reads through the cursor's travel time like a
person; kegs, frozen blocks and allies are plain taps or passive.

### The second region, from a typical end-of-Greenmarch hero (Rowan)

| Target (85% player) | Result (Rowan, 100 runs) |
|---|---|
| Act 4 (the region's Act 1) ~90% first try | **91%** (mini-boss first fight 91%) |
| Act 5 (Act 2) ~75% first try | **69%** (mini-boss 72%) |
| Act 6 (Act 3) ~60% first try | **60%** |
| The boss's first fight ~55-65% | **64%** (98% clear Act 6 within 6 tries) |

Normal fights take 16-22 s, the mini-bosses about a minute, the boss 40 s; the hero comes into the region at level
~9.5 and meets its boss at ~13. The act numbers (`acts[3..5]`): HP x4.2 / x7.2 / x7.6, attack x9 / x15.5 / x14.5; the
Act 5 mini-boss has 2700 HP. Greenmarch for Rowan stays where it was: 100% / 91% / 72% first try, the Boar King's
first fight 79% (its HP 4600 -> 4800 after the heroes rework).

### Every hero against Rowan (first try per act; target: within +/-10 points)

| Hero | Act 1 | Act 2 | Act 3 (boss) | Act 4 | Act 5 | Act 6 (boss) |
|---|---|---|---|---|---|---|
| Rowan (Blade) | 100% | 91% | 72% (79%) | 91% | 69% | 60% (64%) |
| Sable (Shadow) | 100% (0) | 91% (0) | 70% (-2) | 97% (+6) | 81% (**+12**) | 57% (-3) |
| Neve (Controller) | 100% (0) | 86% (-5) | 73% (+1) | 95% (+4) | 71% (+2) | 62% (+2) |
| Moss (Summoner) | 100% (0) | 84% (-7) | 82% (+10) | 98% (+7) | 71% (+2) | 70% (+10) |
| Tam (Bomber) | 100% (0) | 93% (+2) | 71% (-1) | 92% (+1) | 77% (+8) | 61% (+1) |
| Hollis (Guardian) | 99% (-1) | 94% (+3) | 82% (+10) | 97% (+6) | 75% (+6) | 64% (+4) |
| Vesper (Marksman) | 100% (0) | 85% (-6) | 70% (-2) | 94% (+3) | 76% (+7) | 54% (-6) |
| Torva (Brute) | 100% (0) | 97% (+6) | 75% (+3) | 96% (+5) | 85% (**+15**) | 52% (-8) |

40 of 42 hero-acts are within +/-10 of Rowan; Sable and Torva run ahead in Act 5 (its mini-boss: Rowan, alone among
them, has no edge there). Rows for Neve, Moss, Tam, Hollis and Vesper were measured with the Act 5 mini-boss at 3000
HP (their Act 5 is a few points higher now, like Rowan's +5). What it took: each hero's base HP and attack share
(`tuning.kits`), Moss's allies (shorter stay, weaker thorns and moths, smaller Overgrowth), Hollis's Rampart and Iron
Hide, Tam's Blast Shield, Neve's Glacier and beast edge, Vesper's HP and Volley, and Rowan's second soft strength
(+15% to frost foes: the second region's foes mostly carry that tag, Greenmarch's none).

### Rowan's branches (none clearly the safest)

The bot goes down one branch first (rolled per profile); first try per act with each first branch:

| First branch | Act 2 | Act 3 (boss) | Act 4 | Act 5 | Act 6 (boss) |
|---|---|---|---|---|---|
| Blade (attack, crits) | 91% | 74% (77%) | 88% | 71% | 59% |
| Bulwark (blocking) | 100% | 68% (74%) | 94% | 61% | 59% |
| Momentum (combo, finisher) | 87% | 72% (83%) | 91% | 61% | 57% |

Before: Bulwark was the safe pick in Greenmarch (+8-10 points in Act 3, M4a's report) and, once Rowan's Blade rule and
Knight's Resolve came in, Momentum was in the second region (71% in Act 6 against 45-49%). Now: Bulwark's Stout +12% HP
(was 8) and Plate Training +10 Defense (was 5), its Shield Wall bubble recharges every 6 blocked reds (was once a
fight at 5), Momentum's Rhythm +10% meter (was 15), Blade's Executioner at 35% HP (was 30). The capstones only come
at level 10, so Greenmarch is barely touched by them. Branch subsets here are 19-46 runs each: differences under ~10
points are noise.

### Gems and chests (one Rare chest per region from gems alone)

| | Greenmarch | The Frostpeaks |
|---|---|---|
| Gems earned by a story run (85%, achievements included) | 237-299 (Rowan 237) | 203-238 (Rowan 213) |
| Rare chests that buys at 240 gems | about 1.0-1.2 | about 0.9-1.0 |

Where gems come from (`tuning.gems`): each act's first clear 15, each mini-boss's first kill 15, the region boss's 35
(later kills 3), each bounty 5, each hidden treasure 8, a region at 100% 60, achievements (one-off), and elites' gem
pouches (8% of elites, 5 gems). A completionist adds the 60 for 100% (and the region chest).

Chest odds (`tuning.chests`; a hero is never below Rare, a tier with nothing in it falls to the best tier below):

| Tier | Hero chest (bosses, bounties, elites) | Rare chest (shrine, 240 gems) | Region chest (100%) |
|---|---|---|---|
| Common | 40% | - | - |
| Uncommon | 30% | - | - |
| Rare | 20% | 60% | - |
| Epic | 8% | 30% | 55% |
| Legendary | 1.8% | 8.5% | 35% |
| Mythic | 0.15% | 1.2% | 8% |
| Celestial | 0.04% | 0.25% | 1.6% |
| Divine | 0.01% | 0.05% | 0.4% |

The shrine's pity: a Legendary or better within 30 Rare chests (soft pity from the 20th: the Legendary+ odds climb 50%
a chest), a Celestial or better within 120. A chest holds a hero half the time (else a companion), and a quarter of
plain hero chests hold 3-6 shards for something you own instead. Drops: a region boss's first kill always drops a hero
chest (later kills 35%), a mini-boss's likewise (25%), a bounty 30%, an elite 4%. A story run through a region opens
about four hero chests and one Rare chest.

### The third region (Rowan, from a typical end-of-second-region hero)

| Target (85% player) | Result (Rowan, 100 runs) |
|---|---|
| Act 7 (the region's Act 1) ~85% first try | **89%** |
| Act 8 (Act 2) ~70% first try | **70%** (mini-boss 72%) |
| Act 9 (Act 3) ~55% first try | **52%** |
| The boss's first fight ~50-60% | **52%** |

93 of 100 runs won both earlier regions; the hero arrives at level ~14 and meets the boss at ~17. Act numbers
(`acts[6..8]`): HP x8.6 / x8.8 / x10.5, attack x16.5 / x17 / x24; the Act 7 mini-boss 4000 HP / 19 attack, the boss
8400 / 19. Guarded by `tests/unit/bot-region3.test.ts`. Only Rowan was measured here (the other heroes' parity was
tuned on the first two regions).
