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
