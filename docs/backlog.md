# Backlog: meta-game seen in the reference (deferred)

## Next round (left from playtest round 8; details in docs/orchestrator-report.md and docs/decisions.md)

1. **Before a public debut:** hide the title's Test lab button (behind `?lab` or a gear-panel switch; L12); record
   clips in clean capture mode; a last fresh-eyes pass on the first 10 minutes.
2. **The playtester's Test lab report** on round 8 (mood and maturity on the iPhone first).
3. **Hero parity in Regions 4-5:** Vesper trails in a few boss acts (C19-C21: the skill trees, Rowan's defensive
   branch); a 100-run read of all sixteen heroes there (Sable +18 / Neve -15 / Dell -19 in Act 13 are first reads).
4. **A newcomer's calmer first Act 1 map** (one pack, no merchant; first10 F24): bring it back with `bot.test.ts`'s
   fight-length band and `remix.test.ts`'s sample re-measured, not loosened (L13).
5. **Region 6** (its story is drafted in data, off).
6. **Review leftovers:** the bag's full redesign, the region card's light parchment, act-map tags over other nodes,
   the keyboard ring over a button's "!" badge, the Mythic heroes' five crowded kit labels.
7. **A CI boot check** before publishing (L10), and load time re-measured after round 8's art.
8. **Review 5's notes on the final build** (05:12, read-only): the small "s" still reads like a "z"; on the loot screen
   "Level up!" and "Tap to continue" share a strip (the prompt looks disabled); the treasure reveal flips to the fight
   HUD and an empty bar; the stack callout "x1!" lands on "Perfect!" and "Block!" clips under the act plate; the first
   finisher's cinematic keeps the HUD buttons and stray numbers on screen (the moment people clip); tip cards' "Tap to
   continue" sits on their top border and covers titles; Pip's portrait still round and bright; the relic pick's
   stage; the hero select's candy kit cards and "Green" label; the bounty board's sprite; the act map's "?" and
   "Trader" tags and unexplained pack arrows; a "+" by Rowan on the world map that reads as a crosshair; "Tap" wording
   on desktop.


**Done in M4a:** relics (rule-changing run picks with synergy tags, unlocks and a relic log), a second hero (Sable,
two cursors) with a hero select at the camp, hero levels (1-30) and a skill tree per hero, a soundtrack per act.
The reference's hero roster (more heroes, Lvl Up priced in gems) and companions are still to come.

**Done in M3b:** gear (6 slots, 6 rarities, 10 stats, sets, signature boss drops), the camp with the bag and the
forge (upgrade, reroll, salvage), coins kept between runs, farming cleared acts. The **shrine** (the gacha) stands at
the camp, locked ("coming soon"): it is the next meta feature.

The playtester shared screenshots of the reference game's meta layer and chose to leave it for a later
milestone. Build these with original art and names only.

- **Currencies:** coins (already dropped by enemies in M1), gems, and keys, shown top right outside combat.
- **Loot chests:** an inventory of chest types (common, rare currency, gem) with counts, a description and an
  Open button.
- **Chest opening:** a big chest on a stage; "tap the chest to roll" spins a slot-machine reel of prizes
  that slows and lands on one, then a reveal with light rays ("You won 10 gems!").
- **Kingdom map:** the reference's main map is an illustrated island with regions as landmarks, padlocks on
  locked regions, flags on cleared ones, a kingdom level, timed rewards, and buttons for upgrades, chests,
  loadout and shop. *M3a built our own version of the map itself* (a painted island kingdom, Greenmarch playable,
  locked regions, a flag per act cleared, the Great Pendulum's weights counter). Still to come: the kingdom level,
  timed rewards and those buttons.
- **Loadout:** pick a hero, a companion and an item, each with a level.
- **Heroes:** a scroll-style roster you page through with arrows. Each hero has a level, a one-line bio,
  three ability icons (the first unlocked, the rest locked/grey), four stats (attack, finisher charge, HP,
  combo power) and a "Lvl Up" button priced in gems, or Get/Locked for heroes you don't own yet. Heroes
  differ in kit, e.g. a sky-diving lancer, a gun-and-sword sailor, a fire mage, an ice brute.
- **Companions:** the same scroll roster for pets (e.g. a wolf, a dragon and a golden dragon, a little
  mech), each with a level, a joke bio, a role tag (e.g. "Damage"), three ability icons (first unlocked) and
  Lvl Up (gems) or Get/Locked. M1's Pip would become the first companion.
- **Upgrades:** a tree unlocked by kingdom level, where coins buy permanent stat upgrades (e.g. "+15% combo
  power", attack, health).
- **Combat extras already in M1:** heal on kill, coins from kills, companion (Pip), boss marker, stage
  banner, level-clear chest.
