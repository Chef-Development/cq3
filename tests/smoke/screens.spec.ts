// Screenshot regression tests. Time is faked (Playwright clock, paused and stepped one frame at a time) and
// Math.random is seeded, so every run renders the same pixels. After an intentional visual change, refresh
// the baselines with `npm run screens:update` and look at the new PNGs before committing them.
import { expect, test, type Page } from '@playwright/test';

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
async function firstFight(page: Page, relics: string[], hero: 'rowan' | 'sable' = 'rowan', taught = true): Promise<void> {
  await page.evaluate(
    ([relics, hero, taught]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as any).__cq3.app;
      const p = app.profile;
      if (hero === 'sable') {
        p.sableMet = true;
        p.heroes.sable.unlocked = true;
        p.heroes.sable.xp = 900;
      }
      p.hero = hero;
      p.twinTaught = taught;
      app.setPhase(() => {
        app.run.newRun();
        app.run.skipScenes();
        app.run.hero.relics = relics;
        app.run.chooseNode(app.run.choices()[0]);
      });
    },
    [relics, hero, taught] as const,
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

test("Sable: the two tap zones on her first fight, then her two cursors' bar", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await firstFight(page, ['powderKeg', 'sharpshooter', 'overcharge'], 'sable', false);
  await frames(page, 50);
  await expect(page).toHaveScreenshot('twin-tutorial.png', shot);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    app.profile.twinTaught = true;
    app.begin();
  });
  await frames(page, 75);
  await expect(page).toHaveScreenshot('sable-bar.png', shot);
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
