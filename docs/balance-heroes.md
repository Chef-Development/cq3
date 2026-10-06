## M5: the heroes, the second region, Rowan's branches, gems and chests

Measured with `npm run region-tune` (Greenmarch played once per seed from a fresh profile, then camp, then the second
region's fresh run from the end-of-Greenmarch hero) and `npm run campaign`, 85% player, 100 runs per hero (same seeds
for every hero and branch). "First try" = the act cleared without a defeat; "boss" = its boss's (or mini-boss's) first
fight won. `tests/unit/bot-region2.test.ts` guards the second region's targets with Rowan.

**What the bot learned this session:** holds (pressed at the near edge; let go when the cursor looks past the far
end, 25 ms late on average, 1.2x its tap spread, an early lift on half its lapse rate: an 85% player drops about 1
hold in 15), each hero's finisher read (who it kills), linked pairs (it goes for the partner within the beat), and a
camp visit between regions (every Rare chest its gems buy, every chest opened, the camp upgrades it can afford, its
rarest companions brought along). Patches (ice, snow, a dash) it reads through the cursor's travel time like a
person; kegs, frozen blocks and allies are plain taps or passive.

@@PARITY@@

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
