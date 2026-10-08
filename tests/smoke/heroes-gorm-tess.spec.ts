// Gorm and Tess (Part 6) on screen: their kits on the bar (Gorm's Rockfall readout, his Roar's dusted reds,
// Landslide's rubble; Tess's Stopwatch holding the reds under their clock faces, her Slow Time's hourglasses, the
// reds she winds back), their finisher shows mid-flurry, their hero select pages, and the chest reveal (the game's own
// and the sharper one, side by side). Time is faked and Math.random seeded like screens.spec.ts, so the pixels stay
// the same every run; refresh with `npx playwright test heroes-gorm-tess --update-snapshots` and look at the PNGs.
import { expect, test, type Page } from './fixtures';

const START = new Date('2026-01-01T12:00:00Z').getTime();
const FRAME = 16;

async function frames(page: Page, n: number): Promise<void> {
  for (let i = 0; i < n; i++) await page.clock.runFor(FRAME);
}

/** Load the game on the fake clock, tips off (like screens.spec.ts's boot). */
async function boot(page: Page): Promise<void> {
  await page.clock.install({ time: START });
  await page.clock.pauseAt(START + 1000);
  await page.addInitScript(() => {
    let s = 0x2f6b9a1d;
    Math.random = () => {
      let t = (s = (s + 0x6d2b79f5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (let i = 0; i < 500 && !(await page.evaluate(() => (window as any).__cq3?.game.isRunning === true)); i++) await new Promise((r) => setTimeout(r, 20));
  for (let i = 0; i < 120; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (await page.evaluate(() => (window as any).__cq3?.ready === true)) {
      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = (window as any).__cq3.app.profile;
        p.tipsOff = true;
        p.worldTour = true;
      });
      return;
    }
    await frames(page, 1);
  }
  throw new Error('game never became ready');
}

const shot = { animations: 'disabled' as const, caret: 'hide' as const, maxDiffPixelRatio: process.env.EXACT ? 0 : 0.002 };

/** A fight as `hero`, begun, the foes' own attacks stopped and the bar cleared (a test lays out the bar it shows). */
async function stagedFight(page: Page, hero: string): Promise<void> {
  await page.evaluate((hero) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    app.profile.allUnlocked = true;
    app.profile.hero = hero;
    app.setPhase(() => {
      app.run.newRun();
      app.run.skipScenes();
      app.run.chooseNode(app.run.choices()[0]);
    });
  }, hero);
  await frames(page, 20);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.evaluate(() => (window as any).__cq3.app.begin());
  await frames(page, 40);
  await bar(page, 'c.spawning = false; c.specialsOn = false; for (const b of c.blocks.slice()) c.removeBlock(b, "perk"); for (const e of c.enemies) { e.maxHp *= 20; e.hp = e.maxHp; }');
  await frames(page, 25);
}

/** Run `body` in the page with `c` = the fight, `app`, `view` (the scene) and `foe` (the front foe). */
const bar = (page: Page, body: string) => page.evaluate(`(() => { const app = window.__cq3.app; const c = app.run.combat; const view = app.view; const foe = c.frontEnemy(); ${body} })()`);

test('Gorm: his Rockfall readout (a pip a hit), a Rockfall landing on the bar (the boulder onto the red it shoves), a Roar dusting the reds', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, 'gorm');
  // two hits toward the next Rockfall: the readout on the bar's tab and the plate; the third yellow under the cursor
  await bar(page, `c.perk.rockfall = 2; c.spawnBlock('red', 0.62, foe.id); c.spawnBlock('red', 0.86, foe.id); c.spawnBlock('yellow', 0.3); c.setCursor(0.18, 1);`);
  await frames(page, 12);
  await expect(page).toHaveScreenshot('gorm-readout.png', shot);
  // the hit before it, then the Rockfall itself: heavy, its boulder flies onto the nearest red, which is shoved back
  await bar(page, `c.perk.rockfall = 3; const y = c.blocks.find((b) => b.kind === 'yellow'); c.setCursor(y.pos, 1); app.barTap(performance.now());`);
  await frames(page, 7);
  await expect(page).toHaveScreenshot('gorm-rockfall.png', shot);
  // a green: the Roar (rings of sound, the foes flinch), every red on the bar dusted over and slowed
  await bar(page, `const g = c.spawnBlock('green', c.cursorPos() + 0.12); c.setCursor(g.pos, 1); app.barTap(performance.now());`);
  await frames(page, 10);
  await expect(page).toHaveScreenshot('gorm-roar.png', shot);
});

test("Gorm's Landslide: the boulders rolling through the foes mid-flurry; then the rubble over the bar's right end, a red slowed crossing it", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, 'gorm');
  await bar(page, `c.addEnemy('wolf'); view.fighters.addEnemies(c);`);
  await frames(page, 50);
  await bar(page, `for (const e of c.enemies) { e.maxHp *= 20; e.hp = e.maxHp; } c.spawnBlock('red', 0.55, foe.id); c.spawnBlock('red', 0.8, foe.id); c.stacks = 3; c.meter = 0;`);
  await frames(page, 6);
  await bar(page, `app.finisher();`);
  await frames(page, 44);
  await expect(page).toHaveScreenshot('gorm-finisher.png', shot);
  await frames(page, 30);
  await bar(page, `c.spawnBlock('red', 0.95, foe.id); c.spawnBlock('yellow', 0.4);`);
  await frames(page, 20);
  await expect(page).toHaveScreenshot('gorm-rubble.png', shot);
});

test('Tess: her Stopwatch readout filling; the Stopwatch rung (the reds held under clock faces, the frame ticking like a clock); Slow Time (hourglasses); Rewind winding reds back', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, 'tess');
  await bar(page, `c.perk.tick = 11; c.spawnBlock('red', 0.6, foe.id); c.spawnBlock('red', 0.85, foe.id); c.spawnBlock('yellow', 0.3); c.setCursor(0.18, 1);`);
  await frames(page, 12);
  await expect(page).toHaveScreenshot('tess-readout.png', shot);
  // the hit that fills it: time stops (for a blink: kits.tess.stopSec)
  await bar(page, `c.perk.tick = c.tuning.kits.tess.stopEvery - 1; const y = c.blocks.find((b) => b.kind === 'yellow'); c.setCursor(y.pos, 1); app.barTap(performance.now());`);
  await frames(page, 9);
  await expect(page).toHaveScreenshot('tess-stopwatch.png', shot);
  // once it runs out: a green, Slow Time: the reds tick slowly under their hourglasses
  await frames(page, 70);
  await bar(page, `for (const b of c.blocks.slice()) c.removeBlock(b, 'perk'); c.spawnBlock('red', 0.7, foe.id); const g = c.spawnBlock('green', 0.3); c.setCursor(g.pos, 1); app.barTap(performance.now()); c.spawnBlock('red', 0.95, foe.id);`);
  await frames(page, 16);
  await expect(page).toHaveScreenshot('tess-slow-time.png', shot);
});

test("Tess's Rewind: the great clock behind the foes spinning backwards, rewind arrows wheeling round them mid-flurry; the reds wound back to the far end", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await stagedFight(page, 'tess');
  await bar(page, `c.addEnemy('crow'); view.fighters.addEnemies(c);`);
  await frames(page, 50);
  await bar(page, `for (const e of c.enemies) { e.maxHp *= 20; e.hp = e.maxHp; } const a = c.spawnBlock('red', 0.3, foe.id); a.from = 0.96; const b = c.spawnBlock('red', 0.5, foe.id); b.from = 0.96; c.stacks = 3; c.meter = 0;`);
  await frames(page, 6);
  await bar(page, `app.finisher();`);
  await frames(page, 44);
  await expect(page).toHaveScreenshot('tess-finisher.png', shot);
});

test('the hero select: Gorm and Tess on their stages, their kit cards', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    const p = app.profile;
    p.actsCleared = 2;
    p.smithMet = true;
    p.sableMet = true; // (Sable has joined: her scene doesn't play over the camp)
    p.heroes.sable.unlocked = true;
    p.heroes.gorm.unlocked = true;
    p.heroes.gorm.xp = 900;
    p.heroes.gorm.stars = 2;
    p.heroes.tess.unlocked = true;
    p.heroes.tess.xp = 300;
    app.newRun();
    app.openCamp();
  });
  await frames(page, 30);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const camp = (fn: (c: any, now: number) => void) => page.evaluate(`(${fn.toString()})(window.__cq3.app.view.camp, performance.now())`);
  await camp((c, now) => c.go('heroes', now, 'gorm'));
  await frames(page, 40);
  await expect(page).toHaveScreenshot('hero-select-gorm.png', shot);
  await camp((c, now) => c.heroes.show('tess', now));
  await frames(page, 40);
  await expect(page).toHaveScreenshot('hero-select-tess.png', shot);
  // Tess's finisher card: its sheet
  await camp((c, now) => {
    const r = c.heroes.kitCards()[3].r;
    c.heroes.tap(r.x + r.w / 2, r.y + r.h / 2, now);
  });
  await frames(page, 20);
  await expect(page).toHaveScreenshot('hero-select-tess-sheet.png', shot);
});

test("a hero chest's reveal with Gorm in it (Legendary), the game's own and the sharper one side by side", async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    const p = app.profile;
    p.actsCleared = 2;
    p.smithMet = true;
    p.sableMet = true;
    p.heroes.sable.unlocked = true;
    app.newRun();
    app.openCamp();
  });
  await frames(page, 30);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const camp = (fn: (c: any, now: number) => void) => page.evaluate(`(${fn.toString()})(window.__cq3.app.view.camp, performance.now())`);
  await camp((c, now) => c.go('chests', now));
  await frames(page, 30);
  await camp((c, now) => {
    c.chests.opening.view = 'split';
    const prize = (id: string, tier: string) => ({ kind: 'hero', prize: { kind: 'hero', id, tier, fresh: true, shards: 0, starsUp: 0 }, before: { stars: 1, shards: 0 }, after: { stars: 1, shards: 0 }, demo: true });
    c.chests.opening.playDemo([prize('gorm', 'legendary'), prize('tess', 'epic')], now);
  });
  await frames(page, 30);
  await camp((c) => (c.chests.opening.cur.skip += 1e5));
  await frames(page, 30);
  await expect(page).toHaveScreenshot('chest-gorm.png', shot);
  await camp((c) => c.tap(150, 100));
  await frames(page, 30);
  await camp((c) => (c.chests.opening.cur.skip += 1e5));
  await frames(page, 30);
  await expect(page).toHaveScreenshot('chest-tess.png', shot);
});

test('the camp: Gorm and Tess by the fire (their camp poses), Tess picked', async ({ page }) => {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).__cq3.app;
    const p = app.profile;
    p.actsCleared = 2;
    p.smithMet = true;
    p.sableMet = true;
    p.heroes.sable.unlocked = true;
    p.heroes.gorm.unlocked = true;
    p.heroes.tess.unlocked = true;
    p.hero = 'tess';
    p.seen.push('meetGorm', 'meetTess');
    app.newRun();
    app.openCamp();
  });
  await frames(page, 70);
  await expect(page).toHaveScreenshot('camp-gorm-tess.png', shot);
});
