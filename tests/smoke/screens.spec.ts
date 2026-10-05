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

async function boot(page: Page): Promise<void> {
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
    if (await page.evaluate(() => (window as Cq3Window).__cq3?.ready === true)) return;
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
