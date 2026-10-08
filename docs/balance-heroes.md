## Playtest round 7, the parity pass: hero parity at 75% (Rowan, the act curve and the styles kept)

The brief: every hero within +/-10 of Rowan in every act at the 75% player. Rowan stays the reference (the Part 6
heroes are tuned against him at 75%), so he, the act curve and **every style number** are as round 7 left them: the
Part 6 heroes take all six other styles (Summoner, Marksman, Brute, Controller, Bomber, Guardian), so a style number
would move them too. Every change is in one hero's own kit numbers (`tuning.kits.<id>`) or soft strengths
(`src/data/heroes.ts`).

Measured with `npm run campaign` at 75%, all three regions, **400 runs per hero: two samples of 200** (`SEED=1`, the
seeds of every earlier table, and `SEED=2`, the next 200). The noise is bigger than the earlier tables said: the
two samples of the same numbers differ by up to 11 points an act (Vesper's Act 6 before: 35% and 46%), and a gap to
Rowan by up to 12 (Hollis's Act 9 after: +21 and +9), so a 200-run gap is good to about +/-9 and a 400-run gap to about
+/-6. Each act's first try, the gap to Rowan in brackets (Rowan's row: the region boss's first fight in brackets).

| Hero | Act 1 | Act 2 | Act 3 (boss) | Act 4 | Act 5 | Act 6 (boss) | Act 7 | Act 8 | Act 9 (boss) |
|---|---|---|---|---|---|---|---|---|---|
| Rowan (Blade) | 100% | 85% | 64% (67%) | 85% | 68% | 58% (60%) | 88% | 70% | 56% (56%) |
| Sable (Shadow) | 100% (0) | 84% (-1) | 68% (+4) | 91% (+6) | 80% (**+12**) | 52% (-6) | 93% (+5) | 65% (-5) | 58% (+2) |
| Neve (Controller) | 100% (0) | 79% (-6) | 77% (**+13**) | 85% (0) | 66% (-2) | 59% (+1) | 81% (-7) | 75% (+5) | 49% (-7) |
| Moss (Summoner) | 98% (-2) | 81% (-4) | 70% (+6) | 93% (+8) | 71% (+3) | 52% (-6) | 95% (+7) | 70% (0) | 69% (**+13**) |
| Tam (Bomber) | 100% (0) | 91% (+6) | 74% (+10) | 93% (+8) | 78% (+10) | 53% (-5) | 96% (+8) | 75% (+5) | 64% (+8) |
| Hollis (Guardian) | 100% (0) | 84% (-1) | 76% (**+12**) | 93% (+8) | 66% (-2) | 51% (-7) | 89% (+1) | 69% (-1) | 71% (**+15**) |
| Vesper (Marksman) | 100% (0) | 90% (+5) | 74% (+10) | 91% (+6) | 73% (+5) | 49% (-9) | 84% (-4) | 67% (-3) | 57% (+1) |
| Torva (Brute) | 100% (0) | 89% (+4) | 74% (+10) | 82% (-3) | 81% (**+13**) | 53% (-5) | 88% (0) | 69% (-1) | 66% (+10) |

**6 of 56 hero-acts outside +/-10 (was 19 of 56 on the same 400 runs; the mean gap 5.2 points, was 8.7; the largest
15, was 31).** Before, on the same seeds (round 7's kits on the merged build):

| Hero | Act 1 | Act 2 | Act 3 (boss) | Act 4 | Act 5 | Act 6 (boss) | Act 7 | Act 8 | Act 9 (boss) |
|---|---|---|---|---|---|---|---|---|---|
| Rowan (Blade) | 100% | 85% | 64% (67%) | 85% | 68% | 58% (60%) | 88% | 70% | 56% (56%) |
| Sable (Shadow) | 100% (0) | 84% (-1) | 68% (+4) | 91% (+6) | 80% (**+12**) | 52% (-6) | 93% (+5) | 65% (-5) | 58% (+2) |
| Neve (Controller) | 100% (0) | 78% (-7) | 71% (+7) | 82% (-3) | 59% (-9) | 45% (**-13**) | 78% (-10) | 75% (+5) | 48% (-8) |
| Moss (Summoner) | 100% (0) | 88% (+3) | 90% (**+26**) | 97% (**+12**) | 80% (**+12**) | 73% (**+15**) | 97% (+9) | 79% (+9) | 87% (**+31**) |
| Tam (Bomber) | 100% (0) | 92% (+7) | 80% (**+16**) | 94% (+9) | 82% (**+14**) | 56% (-2) | 96% (+8) | 80% (+10) | 71% (**+15**) |
| Hollis (Guardian) | 100% (0) | 92% (+7) | 92% (**+28**) | 98% (**+13**) | 75% (+7) | 65% (+7) | 97% (+9) | 79% (+9) | 81% (**+25**) |
| Vesper (Marksman) | 100% (0) | 90% (+5) | 79% (**+15**) | 88% (+3) | 71% (+3) | 41% (**-17**) | 89% (+1) | 67% (-3) | 58% (+2) |
| Torva (Brute) | 100% (0) | 96% (**+11**) | 84% (**+20**) | 91% (+6) | 84% (**+16**) | 62% (+4) | 94% (+6) | 80% (+10) | 75% (**+19**) |

**Why the heroes led (the bot's first fight with each region boss, 100-120 runs, `DIAG` in a scratch probe):** a
boss's red hits for about 35% of max HP, so a boss fight turns on how many reds get through, and at 75% Rowan is at
the edge: at the Boar King he lets 2.4 through (dies at 3.3) and comes in without his revive in 15% of runs. The others
let fewer through by different routes:
- Moss 1.3: a Barkback stopped a red every 32 s and Overgrowth's vines slowed the reds for 3 s after every finisher.
- Hollis 1.4: he killed the boss in 41 s (Rowan 54): Rampart's Guard multiplier (x1.2 a charge) made a single-target
  finisher 2-2.8x; and each red hurt 28% less (Iron Hide 10%, his strength against Brutes: the bosses of Acts 3, 4, 7
  and 9 are all brutes).
- Torva: his Wind-Up stun **cancels the special the boss is telling** (`Combat.stun`), so every green hit at a boss
  took a Charge, a Roll Out or a Chain Lash off the bar; the stun's length hardly mattered, only that there was one
  (0.25 s left the table at +18 / +18 / +15 in Acts 3, 5 and 9).
- Tam: kegs knock reds off the bar: at Matron (Act 5) he took 0.6 reds a fight to Rowan's 1.1.
- Vesper's Act 3: Piercing Shot hits the Boar King's piglets for half every Power Shot.
- Neve and Vesper trailed in the second region: Rowan has +15% against Frost foes there, and they had nothing.

What changed (each kept where it moved its acts toward Rowan in the probes, 100-200 runs, and in the 400-run table):
1. **Moss:** a Barkback rests 96 s after it stops a red (was 32; it braces at once on a Rally, or half that after its
   call: about one red a fight); Thornlings jab for 20% (30%); Overgrowth's vines last 1 s at x0.8 speed (3 s, x0.7).
2. **Hollis:** Shield Slam 30% / 60% on a Perfect (40 / 80); Iron Hide 5% (10); Brace 1.5 s (3); Rampart's wall 1 s
   (2) and its Guard x0.4 a charge (x1.2); attack share 0.82 (0.9); his soft strength guards against **Flyers** (was
   Brutes). The Brace and Piercing Shot texts read their numbers now.
3. **Tam:** Big Bang drops 1 keg (3); HP 85 (95).
4. **Torva:** Wind-Up no longer stuns (`stunSec` 0, was 1; the slider stays); Quake knocks reds back 0.03 (0.08);
   Wind-Up from x1.5 (1.7); Earthsplitter's calm 0.4 s (1.2); Unstoppable 4% a hit (8%); HP 100 (108); attack 0.8
   (0.86).
5. **Neve:** a second soft strength, takes 25% less from Frost foes (only the second region has them); Glacier x0.8
   (0.7).
6. **Vesper:** a second soft strength, +25% damage to Frost foes; Piercing Shot hits the foe behind for 25% (50%);
   +20% damage to Flyers (25%).
7. Sable, Rowan, the acts and the styles: unchanged.

Tried and dropped (no move beyond the noise, or the wrong acts moved): Hollis's wall at 0.5 s or none, Guard x0.3,
slams 20 / 40%, HP 85-90, attack 0.78 or 0.86, no Avalanche (skill), shorter Long Rampart / Wall Up; Moss's Barkback
at 48-64 s, swarm strength 15%, HP 78; Tam's Wide Blast at 25%, attack 0.85, 2 kegs (Act 5 stayed +19); Torva's stun
at 0.25-0.5 s (it still cancels), calm 0.6 s alone; Vesper's pins 1.5 s (Act 6 fell to -17), Volley x1.5, a frost
guard instead of damage, frost damage in place of flyer damage (Act 7 fell to -14), attack 1.08, HP 108; Neve's frost
damage instead of the guard, casters instead of beasts, Glacier x0.75, x0.9 or Flash Freeze 50% (the last two lift
Act 3 to +15-18).

**Still outside +/-10** (400 runs):
- **Hollis, Acts 3 and 9 (+12, +15):** at Bellows he lets 1.5 reds through to Rowan's 2.5 with the same reds sent,
  and no kit number moves it (his wall at 0.5 s, slams 20 / 40% with HP 90, attack 0.78 or 0.86, the Bulwark's damage
  off, his wall skills shorter, Avalanche off: 65-77% in Act 9 on 100 runs, Rowan 53%): it's the Guardian style
  (shared with a Part 6 hero) and his skill tree (in a third of runs Avalanche's stun cancels Bellows's specials; Long
  Rampart adds 2 s of wall).
- **Neve, Act 3 (+13):** she leads only at the Boar King: +15% against Beasts (the Boar King and his piglets), and
  Glacier x0.8 (for the second region) lifted it from +7; x0.75 took Act 9 to -11 and Act 3 only to +12.
- **Moss, Act 9 (+13):** his +25% against Swarms meets the third region's cinderlings and stoker imps on the way to
  Bellows.
- **Torva, Act 5 (+13):** +10 and +17 on the two samples (likely Earthsplitter: it clears every block off the bar,
  Matron's holds and webs too).
- **Sable, Act 5 (+12):** unchanged hero; +20% against Casters in the caster-heavy second region.

The Boar King is where Rowan is weakest against everyone (every hero is +4 to +13 in Act 3): he uses his revive before
the boss more often and has no tool against the reds that reach him. Closing the Act 3 gaps further belongs to Rowan or
the Boar King, which would move the Part 6 reference: left as it is for now.

## Playtest round 7: the anti-spam rules, the curve re-aimed at a 75% player

Measured with `npm run campaign` (all three regions; a fresh profile per run, camp between regions), **75% player,
200 runs per hero**, the same seeds for every hero. Each act's first try, the gap to Rowan in brackets (Rowan's row:
the region boss's first fight in brackets). At 200 runs a gap is good to about +/-5 (two runs of the same numbers moved up to 5-8
points an act this round).

| Hero | Act 1 | Act 2 | Act 3 (boss) | Act 4 | Act 5 | Act 6 (boss) | Act 7 | Act 8 | Act 9 (boss) |
|---|---|---|---|---|---|---|---|---|---|
| Rowan (Blade) | 100% | 85% | 63% (66%) | 87% | 73% | 59% (62%) | 89% | 71% | 52% (52%) |
| Sable (Shadow) | 100% (0) | 83% (-2) | 66% (+3) | 94% (+7) | 82% (+9) | 51% (-8) | 92% (+3) | 66% (-5) | 61% (+9) |
| Neve (Controller) | 100% (0) | 78% (-7) | 74% (**+11**) | 82% (-5) | 61% (**-12**) | 42% (**-17**) | 81% (-8) | 72% (+1) | 54% (+2) |
| Moss (Summoner) | 100% (0) | 93% (+8) | 90% (**+27**) | 97% (+10) | 81% (+8) | 74% (**+15**) | 99% (+10) | 84% (**+13**) | 83% (**+31**) |
| Tam (Bomber) | 100% (0) | 90% (+5) | 78% (**+15**) | 94% (+7) | 82% (+9) | 56% (-3) | 97% (+8) | 83% (**+12**) | 72% (**+20**) |
| Hollis (Guardian) | 100% (0) | 93% (+8) | 94% (**+31**) | 99% (**+12**) | 76% (+3) | 68% (+9) | 95% (+6) | 79% (+8) | 81% (**+29**) |
| Vesper (Marksman) | 100% (0) | 92% (+7) | 77% (**+14**) | 86% (-1) | 68% (-5) | 34% (**-25**) | 88% (-1) | 68% (-3) | 54% (+2) |
| Torva (Brute) | 100% (0) | 94% (+9) | 85% (**+22**) | 92% (+5) | 89% (**+16**) | 64% (+5) | 93% (+4) | 80% (+9) | 70% (**+18**) |

**Not every hero is within +/-10 of Rowan at 75%: 18 of 56 hero-acts are outside, most of them at the region bosses
(Acts 3 and 9).** Those gaps were there before this round's rules: the round 6 build played at 75% (same seeds, 200
runs; Rowan 100 / 81 / 44 | 81 / 78 / 68 | 69 / 42 / 44) had **30 of 56 outside**:

| Hero (round 6 build, 75%) | Act 2 | Act 3 | Act 4 | Act 5 | Act 6 | Act 7 | Act 8 | Act 9 |
|---|---|---|---|---|---|---|---|---|
| Sable | +7 | **+37** | **+13** | **+17** | **+11** | **+21** | **+21** | **+30** |
| Neve | -10 | +9 | -3 | **-13** | **-15** | 0 | +7 | -2 |
| Moss | **+11** | **+39** | **+17** | **+13** | **+19** | **+26** | **+20** | **+32** |
| Tam | +10 | +9 | **+11** | +10 | -3 | **+20** | **+14** | **+12** |
| Hollis | +8 | **+43** | **+18** | +6 | **+11** | **+25** | **+24** | **+38** |
| Vesper | **+12** | +2 | +8 | -2 | **-12** | +2 | +1 | **+13** |
| Torva | **+11** | **+15** | +6 | **+14** | -1 | **+13** | +10 | +9 |

(Act 1: every hero within 1.) So the 85% parity (round 6) doesn't hold at 75%; the rules narrowed most gaps (Sable
from +37 to +3 in Act 3; Moss and Hollis by 5-15 an act) and made three worse: Vesper in Act 6 (-12 -> -25) and Act 3
(+2 -> +14), Torva in Act 9 (+9 -> +18), Tam in Act 3 (+9 -> +15).

**Why, from the bot's boss fights** (each region's last boss, 30-40 first fights per hero): the boss's reds hit for
about a third of max HP, so the fight turns on how many get through. Rowan (and Sable) let about 2.3 a fight through at
75% and lose ~110% of max HP (revive and heals included); Moss lets 0.8-1.6 through (a Barkback stops one, Overgrowth's
vines slow them), Hollis about 1 and each hurts less (Iron Hide, and his soft strength guards against brutes: both the
Boar King and the third region's boss are brutes). At 85% Rowan let fewer through and the kits were level.

What changed for parity this round (each kept only where it moved the gaps the right way, within the noise):
- **Moss:** a Barkback rests 32 s after stopping a red (was 16), HP 85 (was 90).
- **Hollis:** Iron Hide 10% (was 20%), Rampart's wall 2 s (was 3).
- **Tam:** a keg knocks reds within 0.09 of the bar off (was 0.12), HP 95 (was 100).
- **Torva:** Heavy hits x1.5 (was 1.6), Wind-Up's smash from x1.7 (was 1.8).
- Tried and dropped (no effect beyond the noise at the bosses): Moss's Barkback resting 40-60 s, Thornling 0.24,
  ally power 0.1; Hollis's slams 0.3 / 0.6, Iron Hide 5%, Bulwark 0.3 a charge; Tam's kegs x0.95; Torva's Quake 0.04,
  calm 0.6 s; Vesper's Volley pins 3.5 s (Act 6 stayed at -21).

The gap is Rowan's own at the bosses at 75% (he has no tool against the reds that get through), not a hero running
away: next round's hero pass should give him one (a red stopped at the left end now and then, or a lighter boss red),
then re-aim the region bosses for him, and look again at Neve and Vesper in the second region (its boss).

## Playtest round 6: the kits reworked, Act 2's foes tougher, Vesper's last-act gap closed

Measured with `npm run campaign` (REGIONS=2: Greenmarch from a fresh profile, camp, then the second region's fresh run
with what was earned), 85% player, **300 runs per hero** (the same seeds for every hero). Each act's first try; the
gap to Rowan in brackets. At 100 runs two runs of the same numbers differed by up to 8-14 points per act (the round 5
table's own warning), so every call below was checked at 300 (a gap is then good to about +/-4).

| Hero | Act 1 | Act 2 | Act 3 (boss) | Act 4 | Act 5 | Act 6 (boss) |
|---|---|---|---|---|---|---|
| Rowan (Blade) | 100% | 84% | 70% (77%) | 89% | 77% | 62% (66%) |
| Sable (Shadow) | 100% (0) | 88% (+4) | 77% (+7) | 96% (+7) | 85% (+8) | 68% (+6) |
| Neve (Controller) | 99% (-1) | 85% (+1) | 75% (+5) | 91% (+2) | 80% (+3) | 63% (+1) |
| Moss (Summoner) | 98% (-2) | 83% (-1) | 80% (+10) | 98% (+9) | 84% (+7) | 69% (+7) |
| Tam (Bomber) | 100% (0) | 85% (+1) | 67% (-3) | 93% (+4) | 77% (0) | 58% (-4) |
| Hollis (Guardian) | 99% (-1) | 86% (+2) | 76% (+6) | 98% (+9) | 81% (+4) | 72% (+10) |
| Vesper (Marksman) | 100% (0) | 90% (+6) | 74% (+4) | 96% (+7) | 81% (+4) | 59% (**-3**) |
| Torva (Brute) | 100% (0) | 93% (+9) | 68% (-2) | 95% (+6) | 77% (0) | 59% (-3) |

Every hero is within +/-10 of Rowan in every act (the biggest gaps: Moss +10 in Act 3, Hollis +10 in Act 6). The
same seeds with the old kits (100 runs, after the Act 2 change) had Vesper -22 in Act 6, Moss +10 to +13 in the
second region, Neve -12 in Act 3. What changed, and why (each one in docs/decisions.md, 45-58):

- **Act 2's foes** have x1.7 HP (was x1.4), its first rows a wave fewer, the Ruin Golem's base HP 1900 (decision 45).
  Rowan's guards in `tests/unit/bot.test.ts` hold: Act 2 first try 81% at the guard's seeds, its fights 25 s.
- **Vesper's Act 6 gap (-20 for two rounds) is closed (-3).** The bot's fights by the boss's phase showed it wasn't
  her damage (every damage change had been tried) but reds: she took about 60% more red damage than Rowan, most of it
  in the first phase, where the boss rains icicles (still reds on a fuse). Every other finisher knocks them off the
  bar; her Volley keeps the reds to pin them, but a pin couldn't hold an icicle, so they all struck. Now the Volley
  pins icicles too (their fuse waits), and the bot times a tap on a pinned or slowed red for where it will be when it
  moves again (it aimed at the pinned spot and was late when the pin ran out; this helps Neve's Glacier and Moss's
  vines too). Her first-phase red damage halved (101 -> 49 a fight). Her new targets and the crowded-bar Patience
  rule (decision 51) add a little on top.
- **Moss** (allies scale with the Companion stat, Thornling 30%) ran 15-20 ahead at the bosses: removing one ally
  at a time in the bot's boss fights, the Barkback was worth the most (+21 points: it stops nearly every red that
  gets past him), then the Glowmoth, the vines and the Thornling; his attack share moved nothing (0.62 -> 0.55: the
  same). A Barkback rests 16 s after a block (was 8), vines slow reds to x0.7 (was x0.5), HP 90 (was 95), Glowmoth
  0.4% (the buff to 0.6% reverted; it grows with power), `allyComp` 0.15 (0.3 at first).
- **Hollis** (every block slams, full Guard sets off a Bulwark) came out +13 in Acts 4-5: the Bulwark is 40% attack
  per charge (50% at first) and his HP 95 (was 100).
- **Neve** (half-meter ice, Glacier holds reds and slows the whole bar), **Torva** (the smash grows with the combo:
  x1.8 + 0.04 a combo), **Sable** (the dash lands slow), **Tam** (Turnabout replaces Stockpile) and the Newt burn
  needed no number changes: all within +/-10 as first written.

How the measure moves: `npm run campaign` uses the same seeds for every hero (the round 5 table used `region-tune`,
whose seeds differ per hero), so its rows aren't comparable one to one with the tables below; the gaps are.

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
