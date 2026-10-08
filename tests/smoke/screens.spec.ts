// Screenshot regression tests. Time is faked (Playwright clock, paused and stepped one frame at a time) and
// Math.random is seeded, so every run renders the same pixels. After an intentional visual change, refresh
// the baselines with `npm run screens:update` and look at the new PNGs before committing them.
import { expect, test, type Page } from './fixtures';

interface Cq3Window {
  __cq3?: {
    ready: boolean;
    game: { isRunning: boolean };
    app: {
      setPhase(fn: () => void): void;
      begin(): void;
      barTap(ts: number): void;
      storySkip(): void;
      newRun(): void;
      run: { newRun(): void; skipScenes(): void; chooseNode(id: number): boolean; choices(): number[]; enterAct(i: number): void; coins: number };
    };
  };
}

const START = new Date('2026-01-01T12:00:00Z').getTime();
const FRAME = 16;

/** Step the paused clock one 16 ms frame at a time. */
async function frames(page: Page, n: number): Promise<void> {
  for (let i = 0; i < n; i++) await page.clock.runFor(FRAME);
}

/** Load the game on the fake clock. Tips are off (their own tests turn them on: `tips`), so they never pop over the
 *  other screens; so is the world map's first-visit reveal. */
async function boot(page: Page, o: { tips?: boolean } = {}): Promise<void> {
  // install the fake clock first, so the init script below wraps the faked performance.now
  await page.clock.install({ time: START });
  await page.clock.pauseAt(START + 1000);
  await page.addInitScript(() => {
    // mulberry32, seeded: procedural art, particles and ambient motion come out the same every run
    let s = 0x2f6b9a1d;
    Math.random = () => {
      let t = (s = (s + 0x6d2b79f5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    // The fake clock starts a few real ms after install, which varies run to run. Re-base performance.now to 0
    // and drive rAF from (fake) setTimeout on a 16 ms grid of that re-based time, so frames land identically.
    const fakeNow = performance.now.bind(performance);
    const t0 = fakeNow();
    const now = () => fakeNow() - t0;
    performance.now = now;
    window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(now()), 16 - (now() % 16)) as unknown as number;
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.goto('/cq3/');
  // Phaser boots on real async image loads: wait in real time (fake time frozen) until its loop is armed,
  // so the first frame always lands on the same fake timestamp.
  for (let i = 0; i < 500 && !(await page.evaluate(() => (window as Cq3Window).__cq3?.game.isRunning === true)); i++)
    await new Promise((r) => setTimeout(r, 20));
  for (let i = 0; i < 120; i++) {
    if (await page.evaluate(() => (window as Cq3Window).__cq3?.ready === true)) {
      await page.evaluate((on) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = (window as any).__cq3.app.profile;
        p.tipsOff = !on;
        p.worldTour = true;
      }, !!o.tips);
      return;
    }
    await frames(page, 1);
  }
  throw new Error('game never became ready');
}

const shot = { animations: 'disabled' as const, caret: 'hide' as const, maxDiffPixelRatio: process.env.EXACT ? 0 : 0.002 };

test('title screen', async ({ page }) => {
  await boot(page);
  await frames(page, 30);
  await expect(page).toHaveScreenshot('title.png', shot);
});

test('kingdom world map', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => (window as Cq3Window).__cq3!.app.newRun());
  await frames(page, 30);
  await expect(page).toHaveScreenshot('world.png', shot);
});

test('world map: panned to the locked lands, one of them tapped (its fog thins, its name shows)', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => (window as Cq3Window).__cq3!.app.newRun());
  await frames(page, 20);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = (window as any).__cq3.app.view.worldMap;
    w.lookAt(778, 95);
    const c = w.camera();
    w.tap(812 - c.x, 142 - c.y); // Ashfell's padlock
  });
  await frames(page, 50);
  await expect(page).toHaveScreenshot('world-locked.png', shot);
});

test('world map: an act landmark selected (its card, a ring round it)', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stockProfile(page);
  await page.evaluate(() => (window as Cq3Window).__cq3!.app.newRun());
  await frames(page, 30);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = (window as any).__cq3.app.view.worldMap;
    const s = w.actSpot(1);
    w.tap(s.x, s.y);
  });
  await frames(page, 45);
  await expect(page).toHaveScreenshot('world-act-selected.png', shot);
});

test('world map: the second region unveiled (its three landmarks, Rowan at its first act, the region chip), and its act picker', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    app.profile.actsCleared = 3;
    app.profile.weights = 1;
    app.profile.sableMet = true;
    app.profile.seen.push('unveil:frostpeaks'); // its reveal already played
    app.newRun();
  });
  await frames(page, 40);
  await expect(page).toHaveScreenshot('world-second-region.png', shot);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = (window as any).__cq3.app.view.worldMap;
    const g = w.greenmarch();
    w.tap(g.x, g.y);
  });
  await frames(page, 30);
  await expect(page).toHaveScreenshot('act-picker-second.png', shot);
});

test("world map: the second region's first reveal (the view glides there, its veil thins away, its name card)", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    app.profile.actsCleared = 3;
    app.profile.weights = 1;
    app.profile.sableMet = true;
    app.newRun();
  });
  await frames(page, 100);
  await expect(page).toHaveScreenshot('world-second-reveal.png', shot);
});

test('world map: the far lands beyond the sea under their fog (one tapped); with more weights home their fog thins and lifts', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => (window as Cq3Window).__cq3!.app.newRun());
  await frames(page, 20);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = (window as any).__cq3.app.view.worldMap;
    w.lookAt(1040, 110);
    const c = w.camera();
    w.tap(1060 - c.x, 100 - c.y); // a far land
  });
  await frames(page, 40);
  await expect(page).toHaveScreenshot('world-far-lands.png', shot);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    app.profile.weights = 6; // the first far land's fog lifted, the next one's thinning, the rest still fogged
    app.view.worldMap.lookAt(1040, 75);
  });
  await frames(page, 130);
  await expect(page).toHaveScreenshot('world-far-lifting.png', shot);
});

test('story scene and map', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => {
    const app = (window as Cq3Window).__cq3!.app;
    app.setPhase(() => app.run.newRun());
  });
  await frames(page, 160); // the first box has typed itself out
  await expect(page).toHaveScreenshot('story.png', shot);
  await page.evaluate(() => {
    const app = (window as Cq3Window).__cq3!.app;
    app.setPhase(() => app.run.skipScenes());
  });
  await frames(page, 30);
  await expect(page).toHaveScreenshot('map.png', shot);
});

test('Act 3 map', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => {
    const app = (window as Cq3Window).__cq3!.app;
    app.setPhase(() => {
      app.run.newRun();
      app.run.skipScenes();
      app.run.enterAct(2);
      app.run.skipScenes();
      app.run.coins = 87;
    });
  });
  await frames(page, 30);
  await expect(page).toHaveScreenshot('map-act3.png', shot);
});

// the later regions' act maps: each foe stands on its node as its own mini (they showed crossed swords: round 7)
for (const [act, name] of [
  [3, 'map-act4.png'],
  [6, 'map-act7.png'],
] as const)
  test(`Act ${act + 1} map (a later region's foes on their nodes, a pack roaming, the boss before its lair)`, async ({ page }) => {
    await boot(page);
    await frames(page, 10);
    await page.evaluate((act) => {
      const app = (window as Cq3Window).__cq3!.app;
      app.setPhase(() => {
        app.run.newRun();
        app.run.skipScenes();
        app.run.enterAct(act);
        app.run.skipScenes();
        app.run.coins = 87;
      });
    }, act);
    await frames(page, 30);
    expect(await page.evaluate(() => (window as unknown as { __cq3: { miniMisses: string[] } }).__cq3.miniMisses)).toEqual([]);
    await expect(page).toHaveScreenshot(name, shot);
  });

test('living maps: critters and a sparkle on the act map, its pop; gulls and a sparkle at sea', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    Object.assign(app.tuning.life, { mapChance: 1, worldChance: 1, delayMin: 1, delayMax: 1 });
    app.setPhase(() => {
      app.run.newRun();
      app.run.skipScenes();
      app.run.path = [app.run.choices()[0]]; // an act's first step never has a sparkle
      app.run.phase = 'map';
    });
  });
  await frames(page, 190); // the sparkle has glinted, a rabbit is out, the hawk circles
  await expect(page).toHaveScreenshot('map-life.png', shot);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const life = (window as any).__cq3.app.view.mapView.life;
    const r = life.sparkleRect();
    life.tap(r.x + r.w / 2, r.y + r.h / 2);
  });
  await frames(page, 14);
  await expect(page).toHaveScreenshot('map-sparkle-pop.png', shot);
  await page.evaluate(() => (window as Cq3Window).__cq3!.app.newRun());
  await frames(page, 130);
  await expect(page).toHaveScreenshot('world-life.png', shot);
});

test('fight', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => {
    const app = (window as Cq3Window).__cq3!.app;
    app.setPhase(() => {
      app.run.newRun();
      app.run.skipScenes();
      app.run.chooseNode(app.run.choices()[0]);
    });
  });
  await frames(page, 20);
  await page.evaluate(() => (window as Cq3Window).__cq3!.app.begin());
  await frames(page, 75);
  await expect(page).toHaveScreenshot('fight.png', shot);
  // a run of taps, frozen mid-hit: slashes, sparks, numbers and the combo all on screen
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => (window as Cq3Window).__cq3!.app.barTap(performance.now()));
    await frames(page, 9);
  }
  await page.evaluate(() => (window as Cq3Window).__cq3!.app.barTap(performance.now()));
  await frames(page, 4);
  await expect(page).toHaveScreenshot('fight-hit.png', shot);
});

/** A fixed profile with gear (the same every run): a few items of each rarity, some worn, coins and scrap. */
async function stockProfile(page: Page): Promise<void> {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    const p = app.profile;
    const mk = (base: string, rarity: string, ilvl: number, bonus: Array<[string, number]>, effect: string | null = null, plus = 0) => {
      const it = { uid: p.nextUid++, base, rarity, ilvl, plus, bonus: bonus.map(([stat, q]) => ({ stat, q })), effect, locked: false, fresh: true, rerolls: 0, found: ++p.found };
      p.items.push(it);
      return it;
    };
    const w = mk('hedgeSaber', 'rare', 12, [['critChance', 0.6], ['hp', 0.3]], null, 3);
    mk('captainsCutlass', 'legendary', 8, [['critDmg', 0.7], ['luck', 0.2], ['def', 0.5]], 'cutlass');
    const a = mk('wardenMail', 'epic', 13, [['atk', 0.5], ['steady', 0.8], ['luck', 0.4]]);
    mk('wardenHood', 'rare', 12, [['meterGain', 0.5], ['atk', 0.1]]);
    mk('pendulumShard', 'mythic', 24, [['atk', 0.9], ['hp', 0.9], ['critChance', 0.5], ['luck', 0.3]], 'pendulum');
    const c = mk('clover', 'uncommon', 4, [['hp', 0.5]]);
    for (const [b, r] of [
      ['shortsword', 'common'],
      ['leatherCap', 'uncommon'],
      ['paddedVest', 'common'],
      ['wornBoots', 'uncommon'],
      ['owlCharm', 'rare'],
      ['ringmail', 'common'],
      ['potHelm', 'uncommon'],
      ['hobnails', 'common'],
      ['footpadShiv', 'rare'],
    ] as const)
      mk(b, r, 6, r === 'common' ? [] : [['hp', 0.5]]);
    p.equipped.weapon = w.uid;
    p.equipped.armor = a.uid;
    p.equipped.trinket1 = c.uid;
    p.coins = 640;
    p.scrap = 48;
    p.actsCleared = 2;
    p.smithMet = true;
    p.sableMet = true; // Act 1 is cleared: Sable has joined (sitting by the camp's fire)
    p.heroes.sable.unlocked = true;
  });
}

/** On top of stockProfile: both heroes' levels and skills (Rowan with a point to spend), relics unlocked, two new. */
async function heroProfile(page: Page): Promise<void> {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (window as any).__cq3.app.profile;
    p.heroes.rowan.xp = 1700;
    p.heroes.rowan.skills = ['keenEdge', 'steadyAim', 'stout'];
    p.heroes.sable.xp = 700;
    p.relics = ['shortFuse', 'mirrorGuard', 'chainReaction', 'ricochet', 'huntingOwl'];
    p.relicsNew = ['ricochet', 'huntingOwl'];
  });
}

test('camp, bag and forge', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stockProfile(page);
  await page.evaluate(() => {
    const app = (window as Cq3Window).__cq3!.app as unknown as { newRun(): void; openCamp(): void };
    app.newRun();
    app.openCamp();
  });
  await frames(page, 60);
  await expect(page).toHaveScreenshot('camp.png', shot);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    app.view.camp.go('bag', performance.now());
  });
  await frames(page, 40);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    app.view.camp.bag.sel = app.profile.items[1].uid; // the Captain's Cutlass, against the Hedge Saber worn
  });
  await frames(page, 30);
  await expect(page).toHaveScreenshot('bag.png', shot);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    app.view.camp.go('home', performance.now());
    app.view.camp.go('forge', performance.now());
  });
  await frames(page, 40);
  await expect(page).toHaveScreenshot('forge.png', shot);
});

test('loot reveal: a Legendary card', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stockProfile(page);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    app.setPhase(() => {
      app.run.newRun();
      app.run.skipScenes();
      app.run.chooseNode(app.run.choices()[0]);
    });
    app.begin();
    const p = app.profile;
    app.run.loot = [p.items[3], p.items[1]]; // a Rare hood, then the Legendary cutlass
    app.setPhase(() => (app.run.phase = 'loot'));
  });
  await frames(page, 150);
  await expect(page).toHaveScreenshot('loot-card.png', shot);
});

test('world map: the act picker', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stockProfile(page);
  await page.evaluate(() => (window as Cq3Window).__cq3!.app.newRun());
  await frames(page, 30);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = (window as any).__cq3.app.view.worldMap;
    const g = w.greenmarch();
    w.tap(g.x, g.y);
  });
  await frames(page, 30);
  await expect(page).toHaveScreenshot('act-picker.png', shot);
});

test('camp: hero select, skill tree, relic log', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stockProfile(page);
  await heroProfile(page);
  await page.evaluate(() => {
    const app = (window as Cq3Window).__cq3!.app as unknown as { newRun(): void; openCamp(): void };
    app.newRun();
    app.openCamp();
  });
  await frames(page, 30);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const camp = (fn: (c: any, now: number) => void) => page.evaluate(`(${fn.toString()})(window.__cq3.app.view.camp, performance.now())`);
  await camp((c, now) => c.go('heroes', now, 'sable'));
  await frames(page, 40);
  await expect(page).toHaveScreenshot('hero-select.png', shot);
  // a chest hero not met yet (a rim-lit silhouette on a dim stage, how they're found, Locked)
  await camp((c, now) => c.heroes.show('vesper', now));
  await frames(page, 30);
  await expect(page).toHaveScreenshot('hero-select-locked.png', shot);
  await camp((c, now) => {
    c.go('home', now);
    c.go('skills', now);
    c.skills.select('followThrough', now);
  });
  await frames(page, 40);
  await expect(page).toHaveScreenshot('skill-tree.png', shot);
  await camp((c, now) => {
    c.go('home', now);
    c.go('relics', now);
    c.relics.select('overdrive', now);
  });
  await frames(page, 40);
  await expect(page).toHaveScreenshot('relic-log.png', shot);
});

test('camp: the hero select with a kit card sheet open; a skill node being learned (its energy mid-run)', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stockProfile(page);
  await heroProfile(page);
  await page.evaluate(() => {
    const app = (window as Cq3Window).__cq3!.app as unknown as { newRun(): void; openCamp(): void };
    app.newRun();
    app.openCamp();
  });
  await frames(page, 30);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const camp = (fn: (c: any, now: number) => void) => page.evaluate(`(${fn.toString()})(window.__cq3.app.view.camp, performance.now())`);
  // Rowan's finisher card tapped: its sheet slides up over the column
  await camp((c, now) => c.go('heroes', now, 'rowan'));
  await frames(page, 40);
  await camp((c, now) => {
    const r = c.heroes.kitCards()[3].r;
    c.heroes.tap(r.x + r.w / 2, r.y + r.h / 2, now);
  });
  await frames(page, 20);
  await expect(page).toHaveScreenshot('hero-select-kit-sheet.png', shot);
  // Skills: Follow-Through learned, the energy running up its path from Steady Aim
  await camp((c, now) => {
    c.go('home', now);
    c.go('skills', now);
    c.skills.select('followThrough', now);
  });
  await frames(page, 40);
  await camp((c, now) => {
    const r = c.skills.learnRect();
    c.skills.tap(r.x + r.w / 2, r.y + r.h / 2, now);
  });
  await frames(page, 18);
  await expect(page).toHaveScreenshot('skill-tree-learning.png', shot);
});

/** On top of stockProfile: the shared progression (M5): gems, waiting chests, heroes and companions from chests. */
async function metaProfile(page: Page): Promise<void> {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (window as any).__cq3.app.profile;
    p.gems = 412;
    p.chests = { hero: 2, rare: 1, region: 0 };
    p.pity = { rare: 22, top: 70 };
    p.heroes.moss.unlocked = true;
    p.heroes.moss.stars = 2;
    p.heroes.moss.shards = 7;
    p.heroes.tam.unlocked = true;
    p.heroes.rowan.xp = 1700;
    p.pets.bun.owned = true;
    p.pets.sunny.owned = true;
    p.pets.sunny.xp = 900;
    p.pets.flurry.owned = true;
    p.pets.flurry.stars = 3;
    p.pets.flurry.shards = 12;
    p.camp = ['dummy', 'perch'];
    p.petsOn = ['pip', 'sunny'];
    p.mastery = ['rowanLv5'];
    p.regions.greenmarch = { bounties: [0, 2], treasures: [1], events: ['herbalist'], chest: false };
  });
}

/** The camp open on the meta profile (`fn` runs in the page with the camp view and the time). */
async function metaCamp(page: Page): Promise<(fn: (c: unknown, now: number) => void) => Promise<unknown>> {
  await boot(page);
  await frames(page, 10);
  await stockProfile(page);
  await metaProfile(page);
  await page.evaluate(() => {
    const app = (window as Cq3Window).__cq3!.app as unknown as { newRun(): void; openCamp(): void };
    app.newRun();
    app.openCamp();
  });
  await frames(page, 30);
  return (fn) => page.evaluate(`(${fn.toString()})(window.__cq3.app.view.camp, performance.now())`);
}

test('camp: the heroes met since, chests waiting, the shrine open, a companion along, the Training Dummy', async ({ page }) => {
  await metaCamp(page);
  await frames(page, 40);
  await expect(page).toHaveScreenshot('camp-heroes.png', shot);
});

test('camp: a hero chest opens (the slam, the build-up through the rarity colours, the burst, the silhouette, the reveal)', async ({ page }) => {
  const camp = await metaCamp(page);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any, now) => c.go('chests', now));
  await frames(page, 40);
  await expect(page).toHaveScreenshot('chests.png', shot);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any, now) => {
    c.chests.reseed(37); // a Legendary hero, new: Fizz (5 steps: grey, green, blue, purple, orange)
    c.chests.openKind('hero', now);
  });
  await frames(page, 120); // the third step (blue): the lid hops, light leaks from the seam
  await expect(page).toHaveScreenshot('chest-build.png', shot);
  await frames(page, 129); // just after the burst
  await expect(page).toHaveScreenshot('chest-burst.png', shot);
  await frames(page, 40); // the prize risen: a silhouette rimmed in its tier's light
  await expect(page).toHaveScreenshot('chest-silhouette.png', shot);
  await frames(page, 51); // revealed: the flash fading, the banner dropping in
  await expect(page).toHaveScreenshot('chest-reveal.png', shot);
  await frames(page, 30);
  await expect(page).toHaveScreenshot('chest-prize.png', shot);
});

test('camp: open all (one chest after another, then what came out), and the Divine demo', async ({ page }) => {
  const camp = await metaCamp(page);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any, now) => {
    c.go('chests', now);
    c.chests.reseed(5);
  });
  await frames(page, 30);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any, now) => c.chests.openAll(now));
  for (let i = 0; i < 3; i++) {
    // fast-forward each chest to its end (its steps fire at once), then a tap: the next
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await camp((c: any) => (c.chests.opening.cur.skip += 1e5));
    await frames(page, 15);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await camp((c: any) => c.tap(150, 100));
    await frames(page, 20);
  }
  await frames(page, 40);
  await expect(page).toHaveScreenshot('chests-summary.png', shot);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any) => c.tap(150, 100));
  await frames(page, 20);
  // (a hero met in there arrives in their scene once it's all closed: skipped here)
  await page.evaluate(() => (window as Cq3Window).__cq3!.app.storySkip());
  await frames(page, 10);
  // the Test lab's demo: a Divine prize forced (nothing granted), at its last step (prismatic)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any, now) => c.chests.demo(['divine'], 'region', now));
  await frames(page, 262);
  await expect(page).toHaveScreenshot('chest-divine.png', shot);
});

test('camp: the shrine (the arch, the chest on its altar, the pity vials, Open with its price), its odds', async ({ page }) => {
  const camp = await metaCamp(page);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any, now) => c.go('shrine', now));
  await frames(page, 40);
  await expect(page).toHaveScreenshot('shrine.png', shot);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any) => {
    const r = c.shrine.oddsRect();
    c.tap(r.x + 5, r.y + 5);
  });
  await frames(page, 24);
  await expect(page).toHaveScreenshot('shrine-odds.png', shot);
});

test('camp: companions (two slots with the Perch), upgrades, region progress', async ({ page }) => {
  const camp = await metaCamp(page);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any, now) => c.go('pets', now, undefined, 'sunny'));
  await frames(page, 40);
  await expect(page).toHaveScreenshot('companions.png', shot);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any, now) => {
    c.go('home', now);
    c.go('upgrades', now);
    c.upgrades.sel = 'luckyStone';
  });
  await frames(page, 40);
  await expect(page).toHaveScreenshot('upgrades.png', shot);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any, now) => {
    c.go('progress', now);
    c.progress.open(now, 0);
  });
  await frames(page, 60);
  await expect(page).toHaveScreenshot('progress.png', shot);
});

test('camp: companions: a walker, Equip (its burst), the page turn, one not met, a card opened, the padlocked socket', async ({ page }) => {
  const camp = await metaCamp(page);
  // Flurry: a walker on the stump, three stars, every card in full
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any, now) => c.go('pets', now, undefined, 'flurry'));
  await frames(page, 40);
  await expect(page).toHaveScreenshot('companions-walker.png', shot);
  // Equip: it hops, rings and stars, and flies into the socket Equip aimed at
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any) => {
    const r = c.pets.equipRect();
    c.tap(r.x + r.w / 2, r.y + r.h / 2);
  });
  await frames(page, 12);
  await expect(page).toHaveScreenshot('companions-equip.png', shot);
  // the next arrow: Flurry slides out, Mote (not met yet) hops in, then stands there as a silhouette
  await frames(page, 60);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any) => {
    const r = c.pets.arrows().next;
    c.tap(r.x + r.w / 2, r.y + r.h / 2);
  });
  await frames(page, 8);
  await expect(page).toHaveScreenshot('companions-paging.png', shot);
  await frames(page, 40);
  await expect(page).toHaveScreenshot('companions-not-met.png', shot);
  // Sunny's Fire Breath card (its short line on a crowded column) opened: the full line in a sheet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any, now) => c.pets.select('sunny', now));
  await frames(page, 40);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any) => {
    const r = c.pets.cards()[2].r;
    c.tap(r.x + r.w / 2, r.y + r.h / 2);
  });
  await frames(page, 20);
  await expect(page).toHaveScreenshot('companions-sheet.png', shot);
  // no Perch yet: one along, the second socket padlocked; tapped, it rattles and says what opens it
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (window as any).__cq3.app.profile;
    p.camp = ['dummy'];
    p.petsOn = ['pip'];
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any, now) => {
    c.go('home', now);
    c.go('pets', now, undefined, 'bun');
  });
  await frames(page, 40);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any) => {
    const r = c.pets.slots()[1];
    c.tap(r.x + r.w / 2, r.y + r.h / 2);
  });
  await frames(page, 12);
  await expect(page).toHaveScreenshot('companions-locked.png', shot);
});

test('camp: build mode (ghosts and hammers over the camp), the Lucky Stone card, then the stone just built by the tent', async ({ page }) => {
  const camp = await metaCamp(page);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (window as any).__cq3.app.profile;
    p.mastery.push('sableActs3'); // Sable's milestone: the Lucky Stone can be built
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any, now) => {
    c.go('upgrades', now);
    c.upgrades.select('luckyStone', now);
  });
  await frames(page, 40);
  await expect(page).toHaveScreenshot('build-card.png', shot);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any, now) => {
    const b = c.upgrades.buyRect();
    c.upgrades.tap(b.x + b.w / 2, b.y + b.h / 2, now);
  });
  await frames(page, 84); // the dust has settled: the stone stands there, sparkling, its name over it
  await expect(page).toHaveScreenshot('build-done.png', shot);
});

test('camp: the region card near 100% (one hidden treasure left: its socket tapped names it)', async ({ page }) => {
  const camp = await metaCamp(page);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (window as any).__cq3.app.profile;
    p.actsCleared = 3;
    p.regions.greenmarch = { bounties: [0, 1, 2], treasures: [0, 2], events: ['herbalist', 'shrine', 'well'], chest: false };
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any, now) => {
    c.go('progress', now);
    c.progress.open(now, 0);
  });
  await frames(page, 60);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any, now) => {
    const m = c.progress.seal('treasures', 1);
    c.progress.tap(m.x, m.y, now);
  });
  await frames(page, 14);
  await expect(page).toHaveScreenshot('progress-near.png', shot);
});

test('camp: the region card with everything done (all 15 seals, 100% and 15/15 agree), then dragged: the map pans', async ({ page }) => {
  // the playtester: "only 11 categories show, the map can't be scrolled, and the chest says 13/15"
  const camp = await metaCamp(page);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (window as any).__cq3.app.profile;
    p.actsCleared = 3;
    p.regions.greenmarch = { bounties: [0, 1, 2], treasures: [0, 1, 2], events: ['herbalist', 'shrine', 'well'], chest: false };
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await camp((c: any, now) => {
    c.go('progress', now);
    c.progress.open(now, 0);
  });
  await frames(page, 60);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const look = () => camp((c: any) => ({ marks: c.progress.markList(), cam: c.progress.camera(), win: c.progress.mapRect() })) as Promise<{ marks: Array<{ key: string; done: boolean; x: number; y: number; vis: number }>; cam: { x: number; y: number }; win: { x: number; y: number; w: number; h: number } }>;
  const before = await look();
  // fifteen marks, every one a lit seal and in view: three of each act's row and three events
  expect(before.marks).toHaveLength(15);
  expect(before.marks.every((m) => m.done && m.vis === 1)).toBe(true);
  expect(before.marks.map((m) => m.key).sort()).toEqual(['acts', 'acts', 'acts', 'boss', 'bounties', 'bounties', 'bounties', 'events', 'events', 'events', 'minis', 'minis', 'treasures', 'treasures', 'treasures']);
  // the ring and the count say what the seals say
  const shown = (await page.evaluate(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((window as any).__cq3.app.view.children.list as any[]).filter((o) => o.type === 'BitmapText' && o.visible).map((o) => o.text as string),
  )) as string[];
  expect(shown).toContain('100%');
  expect(shown).toContain(`${before.marks.filter((m) => m.done).length}/${before.marks.length}`);
  await expect(page).toHaveScreenshot('progress-everything.png', shot);
  // a drag on the map pans it (left and up: the map's east and south margins come into view); the seals go with it
  const l = (await page.evaluate('window.__cq3.app.layout')) as { left: number; top: number; cssW: number; cssH: number };
  const css = (x: number, y: number): [number, number] => [l.left + (x * l.cssW) / 327, l.top + (y * l.cssH) / 150];
  const [sx, sy] = css(before.win.x + before.win.w / 2, before.win.y + before.win.h / 2);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) {
    const [mx, my] = css(before.win.x + before.win.w / 2 - k * 5, before.win.y + before.win.h / 2 - k * 3);
    await page.mouse.move(mx, my);
    await frames(page, 1);
  }
  await page.mouse.up();
  await frames(page, 4);
  const after = await look();
  expect(after.cam.x).toBeGreaterThan(before.cam.x);
  expect(after.cam.y).toBeGreaterThan(before.cam.y);
  const dx = after.cam.x - before.cam.x;
  const dy = after.cam.y - before.cam.y;
  after.marks.forEach((m, i) => expect([m.x, m.y]).toEqual([before.marks[i].x - dx, before.marks[i].y - dy]));
  // a drag is never a tap: no seal named
  await expect(page).toHaveScreenshot('progress-panned.png', shot);
  // a press let go in place is a tap: it names the seal under it
  const seal = after.marks.find((m) => m.key === 'boss')!;
  const [tx, ty] = css(seal.x, seal.y);
  await page.mouse.move(tx, ty);
  await page.mouse.down();
  await page.mouse.up();
  await frames(page, 4);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect(await camp((c: any) => c.progress.tipText())).toBe('Boss 1/1');
  expect((await look()).cam).toEqual(after.cam);
});

test('camp: Sable joins after Act 1', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stockProfile(page);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    app.profile.sableMet = false;
    app.profile.heroes.sable.unlocked = false;
    app.newRun();
    app.openCamp(); // Sable's scene plays over the camp
  });
  await frames(page, 30);
  await page.evaluate(() => (window as Cq3Window).__cq3!.app.storySkip());
  await frames(page, 20); // they appear by the fire in a puff of smoke
  await expect(page).toHaveScreenshot('sable-joins.png', shot);
});

// ------------------------------------------------------------------ relics and Sable (M4a)

/** A run in its first fight (waiting for TAP TO BEGIN), the hero carrying `relics`. */
async function firstFight(page: Page, relics: string[], hero: 'rowan' | 'sable' = 'rowan'): Promise<void> {
  await page.evaluate(
    ([relics, hero]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as any).__cq3.app;
      const p = app.profile;
      if (hero === 'sable') {
        p.sableMet = true;
        p.heroes.sable.unlocked = true;
        p.heroes.sable.xp = 900;
      }
      p.hero = hero;
      app.setPhase(() => {
        app.run.newRun();
        app.run.skipScenes();
        app.run.hero.relics = relics;
        app.run.chooseNode(app.run.choices()[0]);
      });
    },
    [relics, hero] as const,
  );
}

test('relic pick: relic cards, a Synergy! card and a stat card', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await firstFight(page, ['powderKeg', 'sharpshooter']);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    app.begin();
    app.setPhase(() => app.run.offerBoosts(false, 'map'));
    app.run.boostChoices = [
      { id: 'relic', rarity: 'common', relic: 'quickDraw' },
      { id: 'relic', rarity: 'epic', relic: 'mirrorGuard' },
      { id: 'damage', rarity: 'rare' },
    ];
  });
  // mid-deal: a card face up, one flipping, one still sliding out of the deck
  await frames(page, 21);
  await expect(page).toHaveScreenshot('relic-pick-deal.png', shot);
  // dealt: the Synergy! cards send a spark to the relics they match in the tray
  await frames(page, 39);
  await expect(page).toHaveScreenshot('relic-pick.png', shot);
  // picked: the relic flies out of its card into the tray
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    const r = app.view.overlays.cardRect(1);
    if (app.view.boostCardAt(r.x + 20, r.y + 10) === 1) app.view.overlays.afterPick(() => app.setPhase(() => app.run.pickBoost(1)));
  });
  await frames(page, 12);
  await expect(page).toHaveScreenshot('relic-pick-fly.png', shot);
});

test('combo milestone: the counter swells, a burst and a "Combo 25!" stamp as the bass joins', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await firstFight(page, ['powderKeg']);
  await page.evaluate(() => (window as Cq3Window).__cq3!.app.begin());
  await frames(page, 60);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    app.audio.msToNextBeat = () => 0; // (the beat it waits for depends on the real audio clock)
    app.run.combat.combo = 25;
    app.view.hud.comboPopAt = performance.now();
    app.view.hud.lastMilestone = 10;
    app.view.hud.milestone(25);
  });
  await frames(page, 14);
  await expect(page).toHaveScreenshot('combo-flourish.png', shot);
});

test('relic belt and the relic panel in a fight', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await firstFight(page, ['powderKeg', 'sharpshooter', 'ironRhythm', 'photosynthesis', 'luckyPenny']);
  await page.evaluate(() => (window as Cq3Window).__cq3!.app.begin());
  await frames(page, 60);
  await expect(page).toHaveScreenshot('relic-belt.png', shot);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    app.userPaused = true;
    app.syncClock(performance.now());
    app.view.overlays.openRelics(2);
  });
  await frames(page, 30);
  await expect(page).toHaveScreenshot('relic-panel.png', shot);
});

test('act clear: the build, the XP bar, a relic unlocked', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await firstFight(page, ['powderKeg', 'shortFuse', 'sapper', 'quickDraw', 'hoarder', 'sharpshooter']);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    app.begin();
    app.setPhase(() => {
      app.run.boostThen = 'actClear';
      app.run.phase = 'boost';
      app.run.boostChoices = [{ id: 'damage', rarity: 'common' }];
    });
    app.setPhase(() => app.run.pickBoost(0));
  });
  await frames(page, 50);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__cq3.app.view.overlays.actClearTap(-1, -1); // the chest bursts
  });
  await frames(page, 125);
  await expect(page).toHaveScreenshot('act-clear-build.png', shot);
  await frames(page, 40);
  await expect(page).toHaveScreenshot('relic-unlocked.png', shot);
});

test('shop: relic rows, Haggler makes the first buy free', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    // no roamers on this map: the walk to the shop meets nobody on the way
    app.tuning.roam.packsFirst = app.tuning.roam.packsLast = app.tuning.roam.merchant = 0;
    app.setPhase(() => {
      app.run.newRun();
      app.run.skipScenes();
      app.run.hero.relics = ['haggler', 'powderKeg'];
      app.run.coins = 75;
      const m = app.run.map;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shop = m.nodes.find((n: any) => n.type === 'shop');
      const path = [shop.id];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      while (m.nodes[path[0]].row > 0) path.unshift(m.nodes.find((p: any) => p.next.includes(path[0])).id);
      app.run.path = path.slice(0, -1);
      app.run.chooseNode(shop.id);
      app.run.shop[0] = { kind: 'boost', offer: { id: 'relic', rarity: 'rare', relic: 'overcharge' }, price: 60, sold: false };
      app.run.shop[1] = { kind: 'boost', offer: { id: 'relic', rarity: 'common', relic: 'sharpshooter' }, price: 40, sold: false };
      app.run.shop[2] = { kind: 'boost', offer: { id: 'crit', rarity: 'common' }, price: 30, sold: false };
    });
  });
  await frames(page, 50);
  await expect(page).toHaveScreenshot('shop-relics.png', shot);
});

// ------------------------------------------------------------------ the fight view: heroes, allies, companions, the second region's bar

/**
 * A fight as `hero` (act: a global act index, 3-5 are the second region), with `pets` along (two need the Companion
 * Perch): begun, then the foes' own attacks stopped and the bar cleared, so a test lays out exactly the bar it shows.
 */
async function stagedFight(page: Page, o: { hero: string; act?: number; pets?: string[] }): Promise<void> {
  await page.evaluate((o) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    const p = app.profile;
    p.allUnlocked = true;
    p.hero = o.hero;
    if (o.pets) {
      if (!p.camp.includes('perch')) p.camp.push('perch');
      p.petsOn = o.pets;
    }
    app.setPhase(() => {
      app.run.newRun();
      app.run.skipScenes();
      if (o.act) {
        app.run.enterAct(o.act);
        app.run.skipScenes();
      }
      app.run.chooseNode(app.run.choices()[0]);
    });
  }, o);
  await frames(page, 20);
  await page.evaluate(() => (window as Cq3Window).__cq3!.app.begin());
  await frames(page, 40);
  await bar(page, 'c.spawning = false; c.specialsOn = false; for (const b of c.blocks.slice()) c.removeBlock(b, "perk");');
  await frames(page, 25); // the cleared blocks have played out
}

/** Run `body` in the page with `c` = the fight, `app`, `view` (the scene) and `foe` (the front foe). */
const bar = (page: Page, body: string) => page.evaluate(`(() => { const app = window.__cq3.app; const c = app.run.combat; const view = app.view; const foe = c.frontEnemy(); ${body} })()`);

test('Sable: one cursor; a Perfect hit dashes it ahead (its streak), her Chain on the HUD', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await firstFight(page, ['powderKeg', 'sharpshooter', 'overcharge'], 'sable');
  await page.evaluate(() => (window as Cq3Window).__cq3!.app.begin());
  await frames(page, 75);
  await expect(page).toHaveScreenshot('sable-bar.png', shot);
  // two Perfect hits in a row: the cursor dashes ahead after each (it stops a moment's travel before the next block),
  // and the Chain shows x2
  const clear = 'for (const b of c.blocks.slice()) c.removeBlock(b, "perk");';
  await bar(page, `c.spawning = false; ${clear}`);
  await frames(page, 25);
  await bar(page, `c.setCursor(0.12, 1); c.spawnBlock('yellow', 0.12); c.spawnBlock('yellow', 0.62); app.barTap(performance.now());`);
  await frames(page, 20);
  await bar(page, `${clear} c.setCursor(0.3, 1); c.spawnBlock('yellow', 0.3); c.spawnBlock('yellow', 0.96); app.barTap(performance.now());`);
  await frames(page, 9); // mid-burst
  await expect(page).toHaveScreenshot('sable-dash.png', shot);
});

test('the second region: ice and snow patches on the bar (one sliding), the cursor streaking over the ice', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'rowan', act: 3 });
  await bar(
    page,
    `c.addZone('ice', 0.3, 0.18, 0); c.addZone('snow', 0.64, 0.16, 0); const z = c.addZone('ice', 0.86, 0.12, 0); z.vel = 0.04; z.slide = 30;
     c.spawnBlock('yellow', 0.36); c.spawnBlock('yellow', 0.6); c.spawnBlock('green', 0.47);`,
  );
  await frames(page, 14);
  await bar(page, `c.setCursor(0.22, 1);`);
  await frames(page, 5);
  await expect(page).toHaveScreenshot('bar-patches.png', shot);
});

test('the second region: a hold being held (its fill), an iced yellow cracked once', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'rowan', act: 4 });
  await bar(page, `c.spawnBlock('hold', 0.5); const y = c.spawnBlock('yellow', 0.8); y.taps = 3; c.events.push({ type: 'chip', id: y.id, pos: y.pos, left: 3 }); c.spawnBlock('hold', 0.2);`);
  await frames(page, 30);
  // the iced yellow takes a tap (a crack); the hold is pressed right at its near edge (Perfect) and held
  await bar(page, `const y = c.blocks.find((b) => b.kind === 'yellow'); c.setCursor(y.pos, 1); app.barTap(performance.now());`);
  await frames(page, 2);
  await bar(page, `const h = c.blocks.find((b) => b.kind === 'hold' && b.pos > 0.4); c.setCursor(h.pos - h.width / 2, 1); app.barTap(performance.now());`);
  await frames(page, 7);
  await expect(page).toHaveScreenshot('bar-hold.png', shot);
});

test('the second region: a mirror shard (a bounce), icicles marked and one landed (its fuse ring)', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'rowan', act: 5 });
  await bar(
    page,
    `c.spawnBlock('mirror', 0.62, foe.id, undefined, { life: 6, special: true }); c.spawnBlock('red', 0.82, foe.id, undefined, { still: true, fuse: 1.6, special: true });
     view.barView.mark(0.25, 0.9); view.barView.mark(0.45, 0.9); c.spawnBlock('yellow', 0.35); c.setCursor(0.5, 1);`,
  );
  await frames(page, 14);
  await expect(page).toHaveScreenshot('bar-mirror-icicles.png', shot);
});

test("heroes' blocks: kegs, frozen blocks, chilled and pinned reds, a snowball", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'neve', act: 3 });
  await bar(
    page,
    `c.spawnBlock('keg', 0.2); c.spawnBlock('keg', 0.32); c.spawnBlock('frozen', 0.46); const f = c.spawnBlock('frozen', 0.58); c.events.push({ type: 'iceBlock', id: f.id, pos: f.pos });
     const r1 = c.spawnBlock('red', 0.7); r1.chill = 3; r1.chillMult = 0.4; const r2 = c.spawnBlock('red', 0.8); r2.chill = 3; r2.chillMult = 0;
     c.spawnBlock('red', 0.92, foe.id, undefined, { grow: 0.6, speed: 0.6, special: true }); c.setCursor(0.08, 1);`,
  );
  await frames(page, 12);
  await expect(page).toHaveScreenshot('bar-kegs-frozen.png', shot);
});

test('Moss with three allies out (called by green hits), the allies on the HUD', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'moss' });
  for (let i = 0; i < 3; i++) {
    await bar(page, `const p = c.cursorPos(); c.spawnBlock('green', p); app.barTap(performance.now());`);
    await frames(page, 30);
  }
  await frames(page, 60);
  await expect(page).toHaveScreenshot('moss-allies.png', shot);
});

test("bar callouts: Rock Wall ready at the left end, oiled Perfect zones; a Perfect block calls out Guard and the Slam beside the judgement, the Guard tab on the bar; Wind-Up's burning cursor", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'hollis', pets: ['brick', 'sprocket'] });
  // armed and waiting: Brick's slab stands at the left end, Sprocket's oil shows every block's (wider) Perfect zone
  await bar(page, `c.perk.rockReady = 1; c.perk.oil = 1; c.spawnBlock('yellow', 0.3); c.spawnBlock('red', 0.55); c.spawnBlock('yellow', 0.8); c.setCursor(0.42, 1);`);
  await frames(page, 14);
  await expect(page).toHaveScreenshot('bar-ready.png', shot);
  // a Perfect block: "Guard 1" and "Slam!" either side of "Perfect!", the Guard tab on the bar's frame lights a pip
  await bar(page, `const r = c.blocks.find((b) => b.kind === 'red'); c.setCursor(r.pos, 1); app.barTap(performance.now());`);
  await frames(page, 8);
  await expect(page).toHaveScreenshot('bar-callouts.png', shot);
  // Torva's Wind-Up primed (the next yellow hit is the smash): the cursor burns; her Unstoppable stacks on the tab
  await stagedFight(page, { hero: 'torva' });
  await bar(page, `c.perk.windUp = 1; c.perk.unstoppable = 2; c.spawnBlock('yellow', 0.7); c.setCursor(0.45, 1);`);
  await frames(page, 12);
  await expect(page).toHaveScreenshot('bar-windup.png', shot);
});

test('two companions: a walker and a flier beside the hero; the drake breathes on every foe', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'tam', pets: ['brick', 'sunny'] });
  await frames(page, 20);
  await bar(page, `view.fighters.petAttack('sunny', foe.id, 14, false);`);
  await frames(page, 11);
  await expect(page).toHaveScreenshot('two-companions.png', shot);
});

// ------------------------------------------------------------------ on the spot: what perks do shows on what they touch

test("Sable's Shadow Dash lands: the streak, three afterimages of the cursor left along the way, a burst where it lands", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'sable' });
  await bar(page, `c.setCursor(0.12, 1); c.spawnBlock('yellow', 0.12); c.spawnBlock('yellow', 0.78); app.barTap(performance.now());`);
  await frames(page, 15); // just landed
  await expect(page).toHaveScreenshot('sable-dash-land.png', shot);
});

test("Bun's Lucky Foot: a coin pops out of the block just hit and Bun hops; it flies to the coin counter, +1 there", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'rowan', pets: ['bun'] });
  // the 10th hit finds the coin (Bun's own attack, every 5th, comes with it: Bun hops once it's home)
  await bar(page, `c.perk.bunHits = 9; const p = c.cursorPos(); c.spawnBlock('yellow', p); app.barTap(performance.now());`);
  await frames(page, 7);
  await expect(page).toHaveScreenshot('bun-coin.png', shot);
  await frames(page, 41);
  await expect(page).toHaveScreenshot('bun-coin-land.png', shot);
});

test("Mote: Starlight's star streaks down to the green it makes and lands with a twinkle; Mend's starlight heals the hero (+N)", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'rowan', pets: ['mote'] });
  // the 15th combo: a green appears, Mote's star flies to it
  await bar(page, `c.combo = 14; const p = c.cursorPos(); c.spawnBlock('yellow', p); app.barTap(performance.now());`);
  await frames(page, 12);
  await expect(page).toHaveScreenshot('mote-star.png', shot);
  // at 10+ combo, Mend: a mote of light from Mote to the hero, stars twinkling up round them, +1
  await bar(page, `for (const b of c.blocks.slice()) c.removeBlock(b, "perk"); c.combo = 12; c.hero.hp = 60; c.perk.mendT = 4.99;`);
  await frames(page, 30);
  await expect(page).toHaveScreenshot('mote-mend.png', shot);
});

test("Sunny's breath: a wall of fire sweeps across every foe (each struck as it reaches it); Fire Breath burns the traps off the bar", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'tam', pets: ['sunny'] });
  await bar(page, `c.addEnemy('slime'); c.addEnemy('slime'); view.fighters.addEnemies(c);`);
  await frames(page, 60);
  // at 25+ combo with traps on the bar: the next breath (its turn forced) burns them away
  await bar(page, `c.combo = 30; c.spawnBlock('purple', 0.4, foe.id); c.spawnBlock('purple', 0.7, foe.id); c.spawnBlock('yellow', 0.55);`);
  await frames(page, 20);
  await bar(page, `c.petCharges = [99]; const y = c.blocks.find((b) => b.kind === 'yellow'); c.setCursor(y.pos, 1); app.barTap(performance.now());`);
  await frames(page, 24);
  await expect(page).toHaveScreenshot('sunny-breath.png', shot);
});

test("Newt's Ember Bite: the bitten foe burns while the ticks come (flames on it, a small orange number each tick)", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'rowan', pets: ['newt'] });
  await bar(page, `c.petCharges = [99]; const p = c.cursorPos(); c.spawnBlock('yellow', p); app.barTap(performance.now());`);
  await frames(page, 66); // its first tick has landed
  await expect(page).toHaveScreenshot('newt-burn.png', shot);
});

// ---- Part 6 companions (round 7): Burr, Lark, Gloam, Nimbus

test("Burr's Prickly: a red hits the hero, Burr curls up and a fan of spines flies into the foe that threw it", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'rowan', pets: ['burr', 'lark'] });
  await bar(page, `c.spawnBlock('red', 0.05, foe.id); c.spawnBlock('yellow', 0.6); c.setCursor(0.4, 1);`);
  await frames(page, 15);
  await expect(page).toHaveScreenshot('burr-spines.png', shot);
});

test("Lark's Wake-up Song: a note flies to the next yellow and glows on it; hit, it bursts into notes, +3 by the combo", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'rowan', pets: ['burr', 'lark'] });
  await bar(page, `c.combo = 9; c.setCursor(0.6, 1); c.spawnBlock('yellow', 0.6); c.spawnBlock('yellow', 0.3); app.barTap(performance.now());`);
  await frames(page, 30);
  await expect(page).toHaveScreenshot('lark-song.png', shot);
  await bar(page, `const y = c.blocks.find((b) => b.id === c.perk.songNote); c.setCursor(y.pos, 1); app.barTap(performance.now());`);
  await frames(page, 12);
  await expect(page).toHaveScreenshot('lark-encore.png', shot);
});

test("Gloam's Night Eyes: glints in its eyes while ready; a claw swipe rakes the trap and it turns yellow", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'rowan', pets: ['gloam', 'nimbus'] });
  await bar(page, `c.perk.nightReady = 1; c.spawnBlock('yellow', 0.75); c.setCursor(0.2, 1);`);
  await frames(page, 12);
  await expect(page).toHaveScreenshot('gloam-ready.png', shot);
  await bar(page, `c.spawnBlock('purple', 0.5, foe.id);`);
  await frames(page, 6);
  await expect(page).toHaveScreenshot('gloam-swat.png', shot);
});

test("Nimbus: the Tide rolls along the bar carrying the reds back, Calm Seas glows on the cursor; its spray rains on every foe", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'rowan', pets: ['gloam', 'nimbus'] });
  await bar(page, `c.combo = 34; c.spawnBlock('red', 0.3, foe.id); c.spawnBlock('red', 0.62, foe.id); c.spawnBlock('red', 0.86, foe.id); c.spawnBlock('yellow', 0.46); c.setCursor(0.16, -1); c.perk.tideReady = 1;`);
  await frames(page, 15);
  await expect(page).toHaveScreenshot('nimbus-tide.png', shot);
  await bar(page, `for (const b of c.blocks.slice()) c.removeBlock(b, "perk"); c.addEnemy('slime'); c.addEnemy('slime'); view.fighters.addEnemies(c);`);
  await frames(page, 60);
  await bar(page, `view.fighters.petAttack('nimbus', foe.id, 21, false);`);
  await frames(page, 22);
  await expect(page).toHaveScreenshot('nimbus-spray.png', shot);
});

test('camp: the companions screen with the four new ones (a walker, a flier, a black cat on the stump, the sky whale)', async ({ page }) => {
  const camp = await metaCamp(page);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (window as any).__cq3.app.profile;
    for (const id of ['burr', 'lark', 'gloam', 'nimbus']) p.pets[id].owned = true;
    p.pets.lark.stars = 2;
    p.pets.gloam.stars = 3;
    p.pets.gloam.xp = 2400;
    p.pets.nimbus.xp = 900;
  });
  for (const id of ['burr', 'lark', 'gloam', 'nimbus']) {
    await camp(`(c, now) => { c.go('home', now); c.go('pets', now, undefined, '${id}'); }` as unknown as (c: unknown, now: number) => void);
    await frames(page, 40);
    await expect(page).toHaveScreenshot(`companions-${id}.png`, shot);
  }
});

test("perks on what they touch: a box on the block (Turtle Shell), brackets on the foe (Sharpshooter), the cursor kicks (Momentum), smoke where a miss was forgiven", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'sable' });
  await bar(page, `c.spawnBlock('red', 0.5, foe.id); c.spawnBlock('red', 0.72, foe.id); c.setCursor(0.25, 1);`);
  await frames(page, 20);
  await bar(
    page,
    `const r = c.blocks.find((b) => b.kind === 'red'); c.events.push({ type: 'perk', id: 'turtleShell', amount: 0, enemyId: foe.id, pos: r.pos });
     c.events.push({ type: 'perk', id: 'sharpshooter', amount: 0, enemyId: foe.id }); c.events.push({ type: 'perk', id: 'momentum', amount: 40, enemyId: 0 });
     c.events.push({ type: 'miss', pos: 0.88, selfDamage: false }); c.events.push({ type: 'perk', id: 'smokeVeil', amount: 0, enemyId: 0 });`,
  );
  await frames(page, 5);
  await expect(page).toHaveScreenshot('perk-marks.png', shot);
});

test("a new hero's finisher: Glacier rolls a frost wave out, freezes every red solid (iced in) and slows the whole bar a moment; then just its middle, the ice cracking as it thaws", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'neve', act: 3 });
  await bar(page, `c.spawnBlock('red', 0.55); c.spawnBlock('red', 0.8); c.spawnBlock('yellow', 0.3); c.stacks = 2; c.meter = 0;`);
  await frames(page, 4);
  await bar(page, `app.finisher();`);
  await frames(page, 22);
  await expect(page).toHaveScreenshot('finisher-glacier.png', shot);
  await frames(page, 88); // the whole-bar slow is over: the middle patch, the reds' ice cracking
  await expect(page).toHaveScreenshot('finisher-glacier-mid.png', shot);
});

// ------------------------------------------------------------------ round 7: every hero's finisher their own

/**
 * A finisher show caught `at` frames in (mid-flurry by default): the hero against three foes (a flier among them, all
 * tough enough to live through it), two reds and a yellow on the bar, `stacks` banked; `tier` draws it at another
 * rarity (the Test lab gallery's pick).
 */
async function finisherShow(page: Page, hero: string, o: { stacks?: number; tier?: string; at?: number } = {}): Promise<void> {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero });
  await bar(page, `c.addEnemy('wolf'); c.addEnemy('crow'); view.fighters.addEnemies(c);`);
  await frames(page, 50);
  await bar(
    page,
    `for (const e of c.enemies) { e.maxHp *= 20; e.hp = e.maxHp; } c.spawnBlock('red', 0.55, foe.id); c.spawnBlock('red', 0.8, foe.id); c.spawnBlock('yellow', 0.3); c.stacks = ${o.stacks ?? 3}; c.meter = 0; ${o.tier ? `view.fighters.showTier = '${o.tier}';` : ''}`,
  );
  await frames(page, 6);
  await bar(page, `app.finisher();`);
  await frames(page, o.at ?? 40);
}

test('unique finishers, Blade (Rowan): a steel whirlwind sweeps through the foes, crescent cuts on each, the pale steel sky cut by every strike', async ({ page }) => {
  await finisherShow(page, 'rowan');
  await expect(page).toHaveScreenshot('finisher-blade.png', shot);
});

test('unique finishers, Shadow (Sable): out of the shadows onto her target, violet afterimages round it, rifts behind, a moonlit night', async ({ page }) => {
  await finisherShow(page, 'sable');
  await expect(page).toHaveScreenshot('finisher-shadow.png', shot);
});

test('unique finishers, Controller (Neve): frost creeps to the foes, a glacier rises behind them, ice spikes stab up, an aurora and snow', async ({ page }) => {
  await finisherShow(page, 'neve');
  await expect(page).toHaveScreenshot('finisher-controller.png', shot);
});

test('unique finishers, Summoner (Moss): a great tree grows behind the foes, spirit wisps fly in and burst into leaves, a deep grove', async ({ page }) => {
  await finisherShow(page, 'moss');
  await expect(page).toHaveScreenshot('finisher-summoner.png', shot);
});

test('unique finishers, Bomber (Tam): the giant keg among the foes, its fuse burning down, bombs bursting on them, a smoky burning sky', async ({ page }) => {
  await finisherShow(page, 'tam');
  await expect(page).toHaveScreenshot('finisher-bomber.png', shot);
});

test('unique finishers, Guardian (Hollis): his rampart wall stands before him, shields fly into the target, a royal sky of golden rays', async ({ page }) => {
  await finisherShow(page, 'hollis');
  await expect(page).toHaveScreenshot('finisher-guardian.png', shot);
});

test('unique finishers, Marksman (Vesper): a sky of arrows over the foes, reticles locked on them, arrows streaking in, the dusk', async ({ page }) => {
  await finisherShow(page, 'vesper');
  await expect(page).toHaveScreenshot('finisher-marksman.png', shot);
});

test('unique finishers, Brute (Torva): the earth splits from her landing to the foes, magma glowing in the crack, a dust storm', async ({ page }) => {
  await finisherShow(page, 'torva');
  await expect(page).toHaveScreenshot('finisher-brute.png', shot);
});

test("the finisher's rarity scaler: Rowan's whirlwind at 5 stacks drawn at Divine (the gallery's pick): a long build-up, light converging on him, prism sparkles, dark edges", async ({ page }) => {
  await finisherShow(page, 'rowan', { stacks: 5, tier: 'divine', at: 18 });
  await expect(page).toHaveScreenshot('finisher-divine.png', shot);
});

// ------------------------------------------------------------------ round 6: the heroes' new moments, on what they touch

test("Hollis: every block slams a shield into the red's foe (a steel number); full Guard arms a Bulwark (the Guard tab and the cursor glow steel, a shield over it); the next block sets it off, a great shield sweeping every foe", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'hollis' });
  await bar(page, `c.addEnemy('slime'); c.addEnemy('slime'); view.fighters.addEnemies(c);`);
  await frames(page, 50);
  await bar(page, `const r = c.spawnBlock('red', 0.6, foe.id); c.setCursor(r.pos, 1); app.barTap(performance.now());`);
  await frames(page, 11); // the Perfect slam has landed
  await expect(page).toHaveScreenshot('hollis-slam.png', shot);
  await bar(page, `c.perk.guard = c.tuning.styles.guardMax; c.spawnBlock('yellow', 0.8);`);
  await frames(page, 20);
  await expect(page).toHaveScreenshot('hollis-bulwark-ready.png', shot);
  await bar(page, `const r = c.spawnBlock('red', 0.45, foe.id); c.setCursor(r.pos, 1); app.barTap(performance.now());`);
  await frames(page, 12); // the great shield mid-sweep
  await expect(page).toHaveScreenshot('hollis-bulwark.png', shot);
});

test("Neve's Big Freeze: her finisher's frozen reds ice over where they stand, into blocks to smash", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(`window.__cq3.app.profile.heroes.neve.skills = ['bigFreeze']`);
  await stagedFight(page, { hero: 'neve', act: 3 });
  await bar(page, `c.spawnBlock('red', 0.55, foe.id); c.spawnBlock('red', 0.8, foe.id); c.stacks = 2; c.meter = 0;`);
  await frames(page, 6);
  await bar(page, `app.finisher();`);
  await frames(page, 10); // the ice climbing over them
  await expect(page).toHaveScreenshot('neve-big-freeze.png', shot);
});

test("Tam's Turnabout: Big Bang flips each red into a keg where it stood (the red turns edge-on, the keg widens out of it)", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(`window.__cq3.app.profile.heroes.tam.skills = ['turnabout']`);
  await stagedFight(page, { hero: 'tam' });
  await bar(page, `c.spawnBlock('red', 0.55, foe.id); c.spawnBlock('red', 0.8, foe.id); c.spawnBlock('red', 0.35, foe.id); c.stacks = 1; c.meter = 0;`);
  await frames(page, 6);
  await bar(page, `app.finisher();`);
  await frames(page, 4); // the reds narrowing
  await expect(page).toHaveScreenshot('tam-turnabout.png', shot);
  await frames(page, 8); // the kegs out, a puff where each red was
  await expect(page).toHaveScreenshot('tam-turnabout-kegs.png', shot);
});

test("Torva's Wind-Up: the smash's multiplier rides over the cursor (x2.5 at 20 combo) and lands beside the foe it hits", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'torva' });
  await bar(page, `c.perk.windUp = 1; c.combo = 20; c.spawnBlock('yellow', 0.7); c.setCursor(0.45, 1);`);
  await frames(page, 12);
  await expect(page).toHaveScreenshot('torva-windup-mult.png', shot);
  await bar(page, `const y = c.blocks.find((b) => b.kind === 'yellow'); c.setCursor(y.pos, 1); app.barTap(performance.now());`);
  await frames(page, 10);
  await expect(page).toHaveScreenshot('torva-smash.png', shot);
});

test("Vesper's targets on a busy bar: the greens that fire the Focus (a bullseye, breathing brackets; gold at full Focus); Patience: a Perfect fires a full Focus with no green in reach", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'vesper' });
  await bar(
    page,
    `for (const [k, p] of [['green', 0.16], ['yellow', 0.3], ['red', 0.44], ['green', 0.56], ['yellow', 0.68], ['red', 0.82], ['yellow', 0.95]]) c.spawnBlock(k, p, foe.id);
     c.setCursor(0.05, 1);`,
  );
  await frames(page, 14);
  await expect(page).toHaveScreenshot('vesper-targets.png', shot);
  await bar(page, `c.perk.focus = 9999; c.setCursor(0.7, 1);`);
  await frames(page, 10);
  await expect(page).toHaveScreenshot('vesper-targets-full.png', shot);
  await bar(
    page,
    `for (const b of c.blocks.slice()) c.removeBlock(b, "perk"); c.perk.focus = 9999; const y = c.spawnBlock('yellow', 0.5); c.spawnBlock('red', 0.8, foe.id);
     c.setCursor(y.pos, 1); app.barTap(performance.now());`,
  );
  await frames(page, 8);
  await expect(page).toHaveScreenshot('vesper-patience.png', shot);
});

test("Sable's landing: after a Shadow Dash the cursor brakes in a violet landing patch up to the block it aimed at (brackets on it)", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'sable' });
  await bar(page, `c.setCursor(0.12, 1); c.spawnBlock('yellow', 0.12); c.spawnBlock('yellow', 0.78); app.barTap(performance.now());`);
  await frames(page, 8);
  await expect(page).toHaveScreenshot('sable-land-zone.png', shot);
});

// ------------------------------------------------------------------ tips ("teach it slowly")

test('tips: a tip card in a fight (the first red, the fight paused)', async ({ page }) => {
  await boot(page, { tips: true });
  await frames(page, 10);
  // the pre-fight and the other fight tips already seen: the red's is the one that comes up
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__cq3.app.profile.tips.push('tapYellow', 'purple', 'green', 'special', 'finisher', 'comboBreak');
  });
  await firstFight(page, []);
  await page.evaluate(() => (window as Cq3Window).__cq3!.app.begin());
  await frames(page, 30);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__cq3.app.run.combat.spawnBlock('red', 0.85);
  });
  await frames(page, 40);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect(await page.evaluate(() => (window as any).__cq3.app.view.tips.current)).toBe('blockRed');
  await expect(page).toHaveScreenshot('tip-fight.png', shot);
});

test('tips: a tip card at the camp (its first visit)', async ({ page }) => {
  await boot(page, { tips: true });
  await frames(page, 10);
  await stockProfile(page);
  await page.evaluate(() => {
    const app = (window as Cq3Window).__cq3!.app as unknown as { newRun(): void; openCamp(): void };
    app.newRun();
    app.openCamp();
  });
  await frames(page, 70);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect(await page.evaluate(() => (window as any).__cq3.app.view.tips.current)).toBe('camp');
  await expect(page).toHaveScreenshot('tip-camp.png', shot);
});

/** In-page helpers for the map extras (`x` = the app): a path that meets no roamer, the first meeting with one. */
const EXTRAS = `
  const run = x.run;
  const meets = (prefix, id) => run.roamFor(prefix).roamers.find((r) => r.at === id || r.next === id) || null;
  const clearPath = (id, allowLast) => {
    const m = run.map;
    const walk = (prefix) => {
      const here = prefix.length ? m.nodes[prefix[prefix.length - 1]] : null;
      for (const n of here ? here.next : m.rows[0]) {
        if (m.nodes[n].row > m.nodes[id].row) continue;
        const who = meets(prefix, n);
        if (n === id) {
          if (!who || allowLast) return [...prefix, n];
          continue;
        }
        if (who) continue;
        const d = walk([...prefix, n]);
        if (d) return d;
      }
      return null;
    };
    return walk([]);
  };
  const findMeet = (kind) => {
    const m = run.map;
    const walk = (prefix) => {
      const here = prefix.length ? m.nodes[prefix[prefix.length - 1]] : null;
      for (const n of here ? here.next : m.rows[0]) {
        const who = meets(prefix, n);
        if (who && who.kind === kind) return { prefix, node: n };
        if (who) continue;
        const d = walk([...prefix, n]);
        if (d) return d;
      }
      return null;
    };
    return walk([]);
  };
`;
const extras = (page: Page, body: string) => page.evaluate(`(() => { const x = window.__cq3.app; ${EXTRAS}; ${body} })()`);

test('map extras: a pack and its telegraph, the merchant, the bounty board and its tracker, the secret', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await extras(page, `x.setPhase(() => { run.newRun(); run.skipScenes(); }); const id = run.extras.bounty[0]; const p = clearPath(id); x.setPhase(() => { run.path = p.slice(0, -1); run.phase = 'map'; run.chooseNode(id); });`);
  await frames(page, 40);
  await expect(page).toHaveScreenshot('bounty.png', shot);
  await extras(page, `x.setPhase(() => run.takeQuest()); run.quest.n = 0;`);
  await frames(page, 40);
  await expect(page).toHaveScreenshot('map-extras.png', shot);
  await extras(page, `x.setPhase(() => run.retry()); const id = run.extras.secret; const p = clearPath(id, true); x.setPhase(() => { run.path = p; run.phase = 'map'; });`);
  await frames(page, 40);
  await expect(page).toHaveScreenshot('map-secret.png', shot);
});

test('an ambush: the pack joins the fight', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await extras(page, `x.setPhase(() => { run.newRun(); run.skipScenes(); }); const m = findMeet('pack'); x.setPhase(() => { run.path = m.prefix; run.phase = 'map'; run.chooseNode(m.node); });`);
  await frames(page, 30);
  await expect(page).toHaveScreenshot('ambush.png', shot);
});

test("Coin Rush: the sack on the clock, coins flying; time's up", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  // (no roamers on this map: the walk to the Coin Rush meets nobody on the way)
  await extras(page, `x.tuning.rush.sec = 4; x.tuning.roam.packsFirst = x.tuning.roam.packsLast = x.tuning.roam.merchant = 0; x.setPhase(() => { run.newRun(); run.skipScenes(); }); const id = run.extras.rush[0]; const p = clearPath(id); x.setPhase(() => { run.path = p.slice(0, -1); run.phase = 'map'; run.chooseNode(id); });`);
  await frames(page, 20);
  await page.evaluate(() => (window as Cq3Window).__cq3!.app.begin());
  await frames(page, 40);
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => (window as Cq3Window).__cq3!.app.barTap(performance.now()));
    await frames(page, 8);
  }
  await expect(page).toHaveScreenshot('rush.png', shot);
  // the clock runs out (4 s): the haul over the sack
  await frames(page, 150);
  await expect(page).toHaveScreenshot('rush-end.png', shot);
});

test('world map: a wandering foe on the road, and its skirmish card', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    app.profile.actsCleared = 1;
    app.profile.wander.fights = 99;
    app.newRun();
  });
  await frames(page, 40);
  await expect(page).toHaveScreenshot('world-wanderer.png', shot);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = (window as any).__cq3.app.view.worldMap;
    const r = w.roam.foeRect();
    w.tap(r.x + r.w / 2, r.y + r.h / 2);
  });
  await frames(page, 30);
  await expect(page).toHaveScreenshot('world-skirmish.png', shot);
});

test("world map: a wandering foe from the third region, its skirmish card wider for its wide foes", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    Object.assign(app.profile, { actsCleared: 9, weights: 2, sableMet: true });
    app.profile.seen.push('unveil:frostpeaks', 'unveil:ashfell'); // (their reveals already played)
    app.profile.wander = { fights: 99, n: 0, up: true }; // (the first one out: two of the cinder flats' foes, then its elite)
    app.newRun();
  });
  await frames(page, 20);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = (window as any).__cq3.app.view.worldMap;
    const r = w.roam.foeRect();
    const c = w.camera();
    w.lookAt(c.x + r.x + r.w / 2, c.y + r.y + r.h / 2);
  });
  await frames(page, 10);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = (window as any).__cq3.app.view.worldMap;
    const r = w.roam.foeRect();
    w.tap(r.x + r.w / 2, r.y + r.h / 2);
  });
  await frames(page, 30);
  expect(await page.evaluate(() => (window as unknown as { __cq3: { miniMisses: string[] } }).__cq3.miniMisses)).toEqual([]);
  await expect(page).toHaveScreenshot('world-skirmish-wide.png', shot);
});

test('world map: everything on it moves with the map when it pans (nothing follows the camera)', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => (window as Cq3Window).__cq3!.app.newRun());
  await frames(page, 30);
  type Obj = { key: string; x: number; y: number; d: number };
  // every visible image on the world map's layers (under its HUD: the header, buttons and cards from depth 30.8 up),
  // less the screen's vignette (a lighting frame, meant to stay put)
  const objects = () =>
    page.evaluate(() => {
      const w = window as unknown as { __cq3: { game: { scene: { scenes: Array<{ children: { list: unknown[] } }> } } } };
      const out: Array<{ key: string; x: number; y: number; d: number }> = [];
      for (const o of w.__cq3.game.scene.scenes[0].children.list as Array<{ visible: boolean; depth: number; x: number; y: number; texture?: { key: string } }>) {
        const key = o.texture?.key;
        if (!o.visible || !key || key === '__DEFAULT' || o.depth < 30.1 || o.depth >= 30.8 || key === 'wm_vignette') continue;
        out.push({ key, x: o.x, y: o.y, d: o.depth });
      }
      return out;
    });
  const pinned: string[] = [];
  let checked = 0;
  type Cam = { x: number; y: number };
  const wm = 'window.__cq3.app.view.worldMap';
  // look around the map at several moments (flocks, ships and clouds come and go), panning 24 px right each time
  for (const [cx, cy] of [
    [200, 225],
    [480, 75],
    [480, 225],
    [740, 75],
    [740, 225],
    [200, 75],
    [900, 150], // the far sea past the continent and its far lands
  ]) {
    await page.evaluate(`${wm}.lookAt(${cx}, ${cy})`);
    await page.clock.runFor(2500); // a different moment at each spot: flocks, ships and clouds come and go
    await frames(page, 2);
    const c0 = (await page.evaluate(`${wm}.camera()`)) as Cam;
    const before = (await objects()) as Obj[];
    await page.evaluate(`${wm}.lookAt(${cx + 24}, ${cy})`);
    await frames(page, 1);
    const c1 = (await page.evaluate(`${wm}.camera()`)) as Cam;
    expect(c1.x - c0.x).toBe(24);
    const after = (await objects()) as Obj[];
    // there after the pan, 24 px further left (it moved with the map) or still at the same spot (it followed the camera)
    const at = (b: Obj, dx: number, tol: number) => after.some((a) => a.key === b.key && Math.abs(a.x - (b.x + dx)) <= tol && Math.abs(a.y - b.y) <= tol);
    for (const b of before) {
      if (b.x < 30 || b.x > 297 || b.y < 0 || b.y > 150) continue; // stays in view after the pan
      checked++;
      if (!at(b, -24, 2) && at(b, 0, 1)) pinned.push(`${b.key} at ${Math.round(b.x)},${Math.round(b.y)} (depth ${b.d})`);
    }
  }
  expect(checked).toBeGreaterThan(40);
  expect(pinned).toEqual([]);
});

// ------------------------------------------------------------------ the third region's art
// Staged by hand so it's all seen at once without playing there: a contact sheet of its textures over the game, fights
// and act maps with a theme forced on the run (foes standing in with the art's sprite keys), and its land on the world
// map once it's open.

/** Draw textures over the page as a contact sheet: rows of keys, each texture at `scale` device px per game px. */
async function artSheet(page: Page, rows: string[][], scale: number, bg: string): Promise<void> {
  await page.evaluate(
    ({ rows, scale, bg }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scene = (window as any).__cq3.app.view;
      scene.ensureAshArt();
      const tm = scene.textures;
      const c = document.createElement('canvas');
      c.width = window.innerWidth * window.devicePixelRatio;
      c.height = window.innerHeight * window.devicePixelRatio;
      Object.assign(c.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh', zIndex: '99' });
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, c.height);
      const gap = 3 * scale;
      let y = gap;
      for (const row of rows) {
        let x = gap;
        let rh = 0;
        for (const key of row) {
          if (!tm.exists(key)) throw new Error(`missing texture ${key}`);
          const im = tm.get(key).getSourceImage() as HTMLCanvasElement;
          if (x + im.width * scale > c.width - gap) {
            x = gap;
            y += rh + gap;
            rh = 0;
          }
          ctx.drawImage(im, x, y, im.width * scale, im.height * scale);
          x += im.width * scale + gap;
          rh = Math.max(rh, im.height * scale);
        }
        y += rh + gap;
      }
      document.body.appendChild(c);
    },
    { rows, scale, bg },
  );
}

test("map minis: every foe's, both frames, at the phone's 8x (each region's in turn)", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  // the textures art-map.ts painted from art-minis.ts, in its order (the first region's, the second's, the third's)
  const keys = (await page.evaluate(() => Object.keys((window as unknown as { __cq3: { app: { view: { textures: { list: object } } } } }).__cq3.app.view.textures.list).filter((k) => k.startsWith('mfoe_')))) as string[];
  expect(keys.length).toBeGreaterThanOrEqual(70);
  await artSheet(page, [keys], 8, '#5a6a50');
  await expect(page).toHaveScreenshot('map-minis.png', shot);
});

const ASH_FOES = ['cinderling', 'cinderkite', 'cragcrab', 'obsidianox', 'rumbleback', 'glassblower', 'prismbat', 'glassmantis', 'kilnwarden', 'hobnob', 'stokerimp', 'magmaeel', 'forgehand', 'chainsentinel', 'bellows'];

test('the third region: every foe idle and winding up its special, the bosses phase looks and extra poses', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  const foes = ASH_FOES.filter((f) => f !== 'bellows' && f !== 'rumbleback' && f !== 'hobnob');
  await artSheet(
    page,
    [
      foes.flatMap((f) => [`${f}_idle0`, `${f}_tell`]),
      ['rumbleback_idle0', 'rumbleback_tell', 'rumbleback_attack', 'rumbleback_shell', 'rumbleback2_idle0', 'hobnob_idle0', 'hobnob_tell', 'hobnob_guard'],
      ['bellows_idle0', 'bellows_windup', 'bellows2_idle0', 'bellows3_tell'],
    ],
    5,
    '#5a5462',
  );
  await expect(page).toHaveScreenshot('ash-foes.png', shot);
});

test('the third region: portraits, item and relic icons, tag chips, critters, bar pieces, lairs, world landmarks', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__cq3.app.view.ensureWorldArt();
  });
  await frames(page, 2);
  await artSheet(
    page,
    [
      ['portrait_rumbleback', 'portrait_hobnob', 'portrait_bellows', 'maplair_cinder', 'maplair_glass', 'maplair_forge'],
      ['obsidian', 'cleaver', 'sledge', 'ashveil', 'basalthelm', 'ashcoat', 'slagplate', 'pumice', 'firewalk', 'coal', 'pearl', 'wrightcap', 'wrightapron', 'wrightclogs', 'hearthcharm', 'titanmaul', 'bellowsheart'].map((i) => `item_${i}`),
      ['tailwind', 'weathervane', 'warmSprings', 'rebound', 'anchorStone', 'slipstream', 'flotsam', 'moltenCore', 'forgedBond', 'slowMatch', 'hammerTongs', 'spareLink', 'coupling', 'goldRivets', 'snapBack', 'hairTrigger'].map((r) => `relic_${r}`),
      ['tag_drift', 'tag_link', 'ember_mark', 'glass_pane', 'life_lizard_0', 'life_lizard_2', 'life_firebeetle_0', 'life_snail_1', 'life_glowbat_0', 'life_soot_0', 'life_soot_2', 'wm_ashroad', 'wm_glasscave', 'wm_forge0'],
    ],
    9,
    '#3a3440',
  );
  await expect(page).toHaveScreenshot('ash-art.png', shot);
});

/** A practice fight in one of the third region's themes, against stand-ins wearing its foes' sprites. */
async function ashFight(page: Page, theme: string, sprites: string[]): Promise<void> {
  await page.evaluate(
    ({ theme, sprites }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as any).__cq3.app;
      const run = app.run;
      for (const sp of sprites)
        app.tuning.enemies[`art_${sp}`] = { ...JSON.parse(JSON.stringify(app.tuning.enemies.slime)), name: sp, sprite: sp, specials: [], hp: 99999, fly: /kite|bat/.test(sp) ? 13 : 0 };
      Object.defineProperty(run, 'theme', { get: () => theme, configurable: true });
      app.setPhase(() => {
        run.newRun();
        run.skipScenes();
        run.startPractice({ enemies: sprites.map((s: string) => `art_${s}`) });
      });
    },
    { theme, sprites },
  );
  await frames(page, 20);
  await page.evaluate(() => (window as Cq3Window).__cq3!.app.begin());
  await frames(page, 40);
  await bar(page, 'c.spawning = false; c.specialsOn = false; for (const b of c.blocks.slice()) c.removeBlock(b, "perk");');
  await frames(page, 60);
}

for (const [theme, sprites, what] of [
  ['cinder', ['cragcrab', 'cinderkite'], 'the cinder flats'],
  ['glass', ['glassblower', 'prismbat'], 'the glass warrens'],
  ['forge', ['bellows'], 'the black forge, the boss'],
] as const)
  test(`the third region: a fight in ${what}`, async ({ page }) => {
    await boot(page);
    await frames(page, 10);
    await ashFight(page, theme, [...sprites]);
    await expect(page).toHaveScreenshot(`ash-fight-${theme}.png`, shot);
  });

test('the third region: an act map in each theme', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await frames(page, 10);
  for (const [theme, act] of [
    ['cinder', 0],
    ['glass', 1],
    ['forge', 2],
  ] as const) {
    await page.evaluate(
      ({ theme, act }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const app = (window as any).__cq3.app;
        const run = app.run;
        app.setPhase(() => {
          run.newRun();
          run.skipScenes();
          if (act) {
            run.enterAct(act);
            run.skipScenes();
          }
          const get = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(run), 'act')!.get!;
          Object.defineProperty(run, 'act', { get: () => ({ ...get.call(run), theme }), configurable: true });
          Object.defineProperty(run, 'theme', { get: () => theme, configurable: true });
        });
      },
      { theme, act },
    );
    await frames(page, 40);
    await expect(page).toHaveScreenshot(`ash-map-${theme}.png`, shot);
  }
});

test('world map: the third region unveiled (its three landmarks round the volcano, Rowan at its last act), the cave selected', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    app.profile.actsCleared = 8;
    app.profile.weights = 2;
    app.profile.sableMet = true;
    app.profile.seen.push('unveil:frostpeaks', 'unveil:ashfell'); // their reveals already played
    app.newRun();
  });
  await frames(page, 40);
  await expect(page).toHaveScreenshot('ash-world.png', shot);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = (window as any).__cq3.app.view.worldMap;
    w.lookAt(775, 115);
  });
  await frames(page, 10);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = (window as any).__cq3.app.view.worldMap;
    const s = w.actSpot(7);
    w.tap(s.x, s.y);
  });
  await frames(page, 30);
  await expect(page).toHaveScreenshot('ash-world-cave.png', shot);
});

// ------------------------------------------------------------------ Part 6: Fizz and Brann

test("Part 6, Fizz: her flasks on the bar in three brews (fire, frost, spark) and her bandolier tab; a fire flask goes off (flames on the bar, the foes burning); a toss flies to the target", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'fizz' });
  await bar(page, `c.addEnemy('wolf'); view.fighters.addEnemies(c);`);
  await frames(page, 40);
  await bar(page, `c.spawnBlock('keg', 0.3); c.spawnBlock('keg', 0.55); c.spawnBlock('keg', 0.8); c.spawnBlock('red', 0.92, foe.id); c.setCursor(0.12, 1);`);
  await frames(page, 14);
  await expect(page).toHaveScreenshot('fizz-flasks.png', shot);
  await bar(page, `const k = c.blocks.find((b) => b.kind === 'keg'); c.setCursor(k.pos, 1); app.barTap(performance.now());`);
  await frames(page, 6);
  await expect(page).toHaveScreenshot('fizz-fire-flask.png', shot);
  await frames(page, 70);
  await bar(page, `for (const b of c.blocks.slice()) if (b.kind === 'red') c.removeBlock(b, 'perk'); c.perk.brew = 2; const g = c.spawnBlock('green', 0.45); c.setCursor(g.pos, 1); app.barTap(performance.now());`);
  await frames(page, 7);
  await expect(page).toHaveScreenshot('fizz-toss.png', shot);
});

test("Part 6, Brann: every block rings his bell (a sound ring, a little bell over the block, toll pips on the Guard tab); the next hit lands with a bell's boom; Peal echoes a blocked red at every foe", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, { hero: 'brann' });
  await bar(page, `c.addEnemy('wolf'); view.fighters.addEnemies(c);`);
  await frames(page, 40);
  await bar(page, `c.spawnBlock('red', 0.35, foe.id); c.setCursor(0.35, 1); app.barTap(performance.now());`);
  await frames(page, 20);
  await bar(page, `c.spawnBlock('red', 0.5, foe.id); c.setCursor(0.5, 1); app.barTap(performance.now());`);
  await frames(page, 6);
  await expect(page).toHaveScreenshot('brann-toll.png', shot);
  await frames(page, 30);
  await bar(page, `const y = c.spawnBlock('yellow', 0.6); c.setCursor(y.pos, 1); app.barTap(performance.now());`);
  await frames(page, 8);
  await expect(page).toHaveScreenshot('brann-toll-hit.png', shot);
  await frames(page, 40);
  await bar(page, `const g = c.spawnBlock('green', 0.3); c.setCursor(g.pos, 1); app.barTap(performance.now());`);
  await frames(page, 20);
  await bar(page, `c.spawnBlock('red', 0.45, foe.id); c.setCursor(0.45, 1); app.barTap(performance.now());`);
  await frames(page, 9);
  await expect(page).toHaveScreenshot('brann-peal.png', shot);
});

test('Part 6: the hero select shows Fizz (a Bomber in her workshop) and Brann (a Guardian at his gate), their kit cards', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stockProfile(page);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    app.profile.heroes.fizz.unlocked = true;
    app.profile.heroes.brann.unlocked = true;
    app.profile.heroes.brann.stars = 3;
    app.newRun();
    app.openCamp();
  });
  await frames(page, 30);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const camp = (fn: (c: any, now: number) => void) => page.evaluate(`(${fn.toString()})(window.__cq3.app.view.camp, performance.now())`);
  await camp((c, now) => c.go('heroes', now, 'fizz'));
  await frames(page, 40);
  await expect(page).toHaveScreenshot('hero-select-fizz.png', shot);
  await camp((c, now) => c.heroes.show('brann', now));
  await frames(page, 40);
  await expect(page).toHaveScreenshot('hero-select-brann.png', shot);
});

test("Part 6, Fizz's finisher: three flasks hang over the foes, each pouring its brew (fire, frost, spark), on a smoky burning sky", async ({ page }) => {
  await finisherShow(page, 'fizz');
  await expect(page).toHaveScreenshot('finisher-fizz.png', shot);
  await frames(page, 26);
  await expect(page).toHaveScreenshot('finisher-fizz-blow.png', shot);
});

test("Part 6, Brann's finisher: a giant temple bell rings over the target, then drops on it; sound rolls across the stage", async ({ page }) => {
  await finisherShow(page, 'brann');
  await expect(page).toHaveScreenshot('finisher-brann.png', shot);
  await frames(page, 26);
  await expect(page).toHaveScreenshot('finisher-brann-blow.png', shot);
});
