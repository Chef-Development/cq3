# The game's name (playtest round 8)

"Combo Quest 3" was a working title. The new name has to fit the living-map story (`docs/story-bible.md`), read well
as a pixel logo, fit a home-screen label (short form at most 12 letters), and not collide with an existing game.
Each name was web-searched (2026-10-09) for games with that name and for trademarks; what turned up is noted below.
These are web searches, not a registry search: before anything public, check the USPTO and UK IPO registers (classes 9
and 41) for the pick.

| # | Name | Short form | Fit | What the search found | Verdict |
|---|---|---|---|---|---|
| 1 | **The Unerased** | Unerased | The premise's hook: Rowan is the one thing on the map the Mapmaker can't erase. It names the mystery without spoiling its answer, and it reads as a promise: whatever he rubs out, something stays. | No game, novel or app with this title. Near names only: *Unremembered* (a novel trilogy), *The Erasure Initiative* (a novel), *Erasure* (a small itch.io game). | **Recommended** |
| 2 | The Living Map | Living Map | Says the premise plainly; friendly. | No game. But **Living Map** is a UK wayfinding software company with a "Living Map Platform™" (digital maps for King's Cross, hospitals, museums), and *Livlymaps* is a map app: the same broad software class. A descriptive phrase that's hard to own. | Runner-up |
| 3 | Atlas Unwritten | Atlas | Evocative, but the story is about *redrawing*, not unwriting. | No exact title. "Atlas" is crowded: *Atlas* (Grapeshot's pirate MMO, 2018), Atlas Games (a tabletop publisher); *Unwritten: That Which Happened* and *The Book of Unwritten Tales* (1-2) use the other half. | Too crowded |
| 4 | Fair Copy | Fair Copy | A mapmaker's term for the clean final draft, and the villain's goal. Clever, but most players won't know the phrase, and it reads like paperwork. | No game or app found; only "fair use" law pages and an itch.io prototype called *Fair Port*. | Keep as the villain's plan |
| 5 | Mapbound | Mapbound | Fits the world map; says little about the story. | No exact title. Near: *Map Map: A Game About Maps* (Steam), *MountBound* (itch.io). | Possible, generic |
| 6 | Margin Knight | MarginKnight | The Margin is where the story ends. But "margin" sounds like money, and the word only pays off at the very end. | No game. Near: *Mage Knight* (board game, 2011), *Bucket Knight* (Xbox, 2020). | Too obscure |
| 7 | Inkbound | Inkbound | Fits the ink. | **Taken:** *Inkbound*, Shiny Shoe's co-op roguelike (Steam Early Access May 2023, 1.0 April 2024). "Ink-" is crowded too: *Inkulinati*, *Inkborn*. | Rejected |
| 8 | Redrawn | Redrawn | Fits the edits. | **Taken:** *ReDrawn: The Painted Tower* (Big Fish Games, 2021; Epic Games Store), and a fan remake *Moving Pictures: REDRAWN*. | Rejected |

Also checked and dropped: "Atlas Knight" (no exact game, but the same crowded "Atlas", and an itch.io *Knight* by
Atlas Games Studio), "Inkmarch" (no game; the "Ink-" crowd above).

## Recommendation: **The Unerased**

It's the only name on the list that is about Rowan as well as the world, it is unused as far as the search can see, and
it carries the story's tone: earnest, a little mysterious, hopeful. On the title screen it pairs with the key image of
the opening: a knight standing in a land gone blank, the only thing left drawn. The runner-up, **The Living Map**, is
clearer but descriptive and close to an existing mapping-software brand.

`src/data/brand.ts`: `GAME_NAME = 'The Unerased'`, `GAME_SHORT = 'Unerased'`. The page title and the install name
(`index.html`, `public/manifest.webmanifest`) follow it.

## Sources
- [Living Map: King's Cross press release](https://livingmap.com/blog/press-release-living-map-elevates-visitor-experience-at-kings-cross-with-innovative-digital-wayfinding-map), [Living Map: about](https://www.livingmap.com/about-us), [Livlymaps](https://mwm.ai/apps/livlymaps/1570971117)
- [Atlas (video game), Wikipedia](https://en.wikipedia.org/wiki/Atlas_(video_game)), [Atlas Games, Wikipedia](https://en.wikipedia.org/wiki/Atlas_Games), [Unwritten (PC Gamer)](https://www.pcgamer.com/unwritten), [The Book of Unwritten Tales 2, Wikipedia](https://en.wikipedia.org/wiki/The_Book_of_Unwritten_Tales_2)
- [Fair Port (itch.io)](https://common-beef.itch.io/fair-port)
- [Map Map: A Game About Maps (Steam)](https://store.steampowered.com/app/2702260/Map_Map__A_Game_About_Maps/), [MountBound (itch.io)](https://matrixge.itch.io/mountbound)
- [Mage Knight, Wikipedia](https://en.wikipedia.org/wiki/Mage_Knight), [Bucket Knight (Xbox)](https://xbox.com/en-ZA/games/store/1/9N1C7P5KGLRK)
- [Inkbound (Gematsu)](https://gematsu.com/games/inkbound), [Inkbound 1.0 (RPGamer)](https://rpgamer.com/2024/02/inkbound-fully-releasing-in-april/), [Inkulinati (TrueAchievements)](https://i1.trueachievements.com/news/inkulinati-full-release)
- [ReDrawn: The Painted Tower (Big Fish)](https://bigfishgames.com/us/en/game/redrawn.html), [ReDrawn (Epic Games Store)](https://store.epicgames.com/p/redrawn-the-painted-tower-collectors-edition-dfbc54)
- [Erasure (itch.io)](https://njaramillo.itch.io/erasure), [The Erasure Initiative](https://thegreatestbooks.org/books/105792)
- [Knight by Atlas Games Studio (itch.io)](https://atlasgamesstudio.itch.io/knight)
