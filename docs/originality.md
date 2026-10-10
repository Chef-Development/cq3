# Originality audit against Combo Quest 2 (team 4, round 8)

The game was inspired by Combo Quest 2 (Tapinator, iOS, June 2016; a sequel to Combo Quest, 2014). The standing
rule: the timing-bar fight is the inspiration on purpose (the playtester asked for it), but every name, picture,
sound and screen is our own. This audit lists what we name things, what the reference is known to have, and what was
too close.

## What we know of the reference

No fan wiki or name list was reachable (searches return only store listings and reviews; the store pages, TouchArcade
and guide sites are blocked from this machine), so names were checked by search and against what the store listing
and docs/backlog.md (the playtester's screenshots of the reference's meta layer) say:

- **Store listing**: 20 heroes "to find and upgrade" (examples: magical golems, speedy ninjas, sharp-shooting
  gunslingers), 20 companions (robots, dragons, lions, "even a chef"), 90+ levels, an endless mode, "beat levels,
  hunt bounties, and recruit your heroes"; leveling a hero costs gems.
- **The first game**: a knight wins back a crown a dragon stole; three steeds; a leaderboard.
- **docs/backlog.md**: currencies coins, gems and keys (top right); chests (common, rare currency, gem) with counts and
  an Open button; "tap the chest to roll": a slot-machine reel that lands on a prize, light rays, "You won 10 gems!";
  the kingdom map: an illustrated island with regions as landmarks, **padlocks on locked regions, flags on cleared
  ones**, a kingdom level, timed rewards, buttons for upgrades, chests, loadout and shop; a loadout (hero, companion,
  item); a scroll roster paged with arrows (level, a one-line bio, three ability icons with the locked ones grey, four
  stats: **attack, finisher charge, HP, combo power**, "Lvl Up" priced in gems, Get/Locked); companions on the same
  roster with **a joke bio and a role tag ("Damage")**; an upgrade tree by kingdom level ("+15% combo power"). Hero
  examples: a sky-diving lancer, a gun-and-sword sailor, a fire mage, an ice brute; companions: a wolf, **a dragon and a
  golden dragon**, a little mech.

## Our names (checked: none found in connection with Combo Quest)

- **The game**: "The Unerased" (src/data/brand.ts; the shortlist is docs/names.md). The page title and the
  home-screen name still said "Combo Quest 3" / "CQ3": **changed** (below).
- **Heroes (16)**: Rowan (Junior Knight), Sable, Neve (Frost Mage), Moss (Grove Caller), Tam (Sapper), Hollis
  (Shieldwarden), Vesper (Dusk Ranger), Torva (Hammer Brute), Solenne (Dawnblade), Wren (Rooftop Runner), Yara (Spirit
  Caller), Dell (Slinger), Gorm (Stonefist), Tess (Timekeeper), Fizz (Alchemist), Brann (Bellwarden). Finishers:
  Whirlwind, Twin Fang, Glacier, Overgrowth, Big Bang, Rampart, Volley, Earthsplitter, Sunfall, Rooftop Drop, Spirit
  Stampede, Pebble Storm, Landslide, Rewind, Grand Reaction, Great Bell. Styles: Blade, Shadow, Guardian, Marksman,
  Brute, Controller, Summoner, Bomber.
- **Companions (12)**: Pip (owl), Bun (rabbit), Newt (salamander), Sprocket (clockwork), Brick (rock pup), Flurry (snow
  fox), Mote (star wisp), Sunny (drake whelp), Burr (hedgehog), Lark (songbird), Gloam (night cat), Nimbus; their perks
  (Owl Watch, Lucky Foot, Ember Bite, Oil Can, Rock Wall, Chill Bite, Snow Dash, Starlight, Mend, Gold Hoard, Fire
  Breath, Warm Glow, Prickly, Wake-up Song, Night Eyes, Tide, Calm Seas).
- **People**: Mags the smith; King Aldric the Third (a line of the golem's).
- **Places**: The Kingdom, Greenmarch (Meadow Road, Old Ruins, the third act), the later regions (named in
  docs/content-bible.md; checked, not listed here: spoilers), the Great Pendulum and its weights.
- **First region's foes**: Slime, Slimelet, Big Slime, Crow, Boar, Bandit, Bandit Captain, Hedge Knight, Goblin
  Archer, Mushroom Shaman, Shell Beetle, Ruin Golem, Wolf, Boar King, Piglet, Coin Sack, Training Dummy. The later
  regions' foes (about 40): checked, listed in docs/content-bible.md.
- **Items**: ~60 gear pieces (Squire Shortsword, Hedge Saber, Woodcutter Axe, Thornspear... Wyrmfang), the
  Greenwarden and Rimewalker sets, the signature drops' effects (Powder Monkey, Stoneblood, Royal Charge, Tick Tock...),
  54 relics in region 1-2 (Powder Keg, Glass Edge, Hunting Owl, Purple Pact, Hot Cocoa...) and the third region's, the
  camp upgrades (Companion Perch, Lucky Stone, War Table, Reroll Charm, Training Dummy, Map Table), achievements.
- **UI words**: coins, gems, scrap; hero chest, Rare chest, region chest; the bag, the forge, the shrine, the vault,
  the camp; Pick, Picked, Skills, Equip, Along, Locked; TAP TO BEGIN, SWIPE!, Level up!; rarities Common to Divine.

## Too close: changed in this round (team 4)

| what | was | now | why |
|---|---|---|---|
| a stat's name (gear, skill nodes, stat cards) | Combo Power | **Finisher Might** (short: Might) | the reference's hero stat, word for word ("combo power") |
| companion role tag (Pip, Sunny) | Damage | **Lookout** (Pip), **Fire** (Sunny) | the reference's companion card shows a role tag "Damage" |
| Sable's title | Shadow Ninja | **Shadow Thief** | the reference sells "speedy ninjas"; Sable is a fast-running thief in our story |
| the page title and the home-screen name | Combo Quest 3 / CQ3 | read from `src/data/brand.ts` at build (now "The Unerased" / "Unerased") | the sequel's name on the phone's home screen |

## Too close or worth a look: for the owning teams

1. **World map: a flag per cleared act and padlocks on locked lands** (art-world.ts, view/world.ts; art team). This
   is exactly what the reference's kingdom map showed. Our veils already say "locked"; suggest dropping the padlock and
   replacing the cleared-act flags with something of the game's own (the act's landmark coming back to life: its
   colours filling in, a lantern lit, a small banner of our own shape), not a flag.
2. **Sunny is "a golden drake whelp"** (art-companions.ts; art team): the reference's companions include "a dragon
   and a golden dragon". Recolour Sunny away from gold (ember-red, moss-green or a dusk violet), and keep the hoarding
   joke in the bio.
3. **Companion and hero cards: a joke one-line bio + a role tag + kit icons + a grey "Locked"** follow the reference's
   roster card closely in structure (the art and words are ours). Suggest (UI owner) the role tag goes (the perk cards
   already say what it does) and the locked button says where to find them ("In hero chests", what the tap already
   floats) instead of "Locked".
4. **"Bounties"** (the act map's board, the "Bounty Hunter" achievement, "Bounties" on the region card, a tip): the
   reference's listing says "hunt bounties". The word is common in games and ours are feats (block reds, reach a
   combo, clean waves), not hunts; if the lead wants it gone, "Dares" fits them ("Dare board", "Daredevil: finish 5
   dares", "Dares 2/3"): 8 player-facing strings in data/meta.ts, data/tips.ts, view/map.ts, overlays.ts,
   progress.ts, chests.ts, core/completion.ts (several teams' files: not changed tonight).
5. **The first hero is a knight** (Rowan, "Junior Knight"), like the first game's hero who chases a crown-stealing
   dragon. The archetype is generic and our story is different (time stopped, the Great Pendulum); keep, but never
   give the story a stolen crown or a dragon thief.
6. **The fight screen** (hero left, foes right, the bar across the bottom band, the meter under it, yellow hits and
   red blocks) is the genre the playtester asked for. Everything on it is drawn by us; keep it that way: no
   reference screenshots as tracing guides, and new bar pieces get our own shapes (holds, drifts, links, ice already do).
7. Copy lines for the planning chat still say "CQ3 Test lab report" / "CQ3 accuracy" (lab report and gear panel):
   internal, not on the game's screens; rename with the final name.

## Not close (checked)

Our chests open without a reel (one chest, one prize, built up step by step: view/chest-opening.ts); no keys, no
loadout screen, no kingdom level, no timed rewards, no endless mode, no gem-priced levels (heroes level from XP); camp
upgrades are objects that add options, not a "+15%" tree; the currency trio is coins, gems and scrap.
