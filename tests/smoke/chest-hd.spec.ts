// The sharper chest reveal (a test; view/chest-hd.ts): the reveal drawn on its own canvas over the game's at 2x the
// game's resolution, and the Test lab's "Sharper chest reveal" (old and new side by side, Old / New / Both, Replay).
// Time is faked and Math.random seeded as in screens.spec.ts, so the frames are exact. The screenshots are taken at
// the device's scale (2622 x 1206): at CSS scale a fine pixel (1.33 CSS px) would be resampled away.
import { expect, test, type Page } from './fixtures';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
// (frame by frame on the fake clock, these take a while on a busy machine)
test.describe.configure({ timeout: 150_000 });

const START = new Date('2026-01-01T12:00:00Z').getTime();
const FRAME = 16;

async function frames(page: Page, n: number): Promise<void> {
  for (let i = 0; i < n; i++) await page.clock.runFor(FRAME);
}

/** Load the game on the fake clock (as screens.spec.ts's boot: tips off, the world tour seen). */
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
  for (let i = 0; i < 500 && !(await page.evaluate(() => (window as Any).__cq3?.game.isRunning === true)); i++) await new Promise((r) => setTimeout(r, 20));
  for (let i = 0; i < 120; i++) {
    if (await page.evaluate(() => (window as Any).__cq3?.ready === true)) {
      await page.evaluate(() => {
        const p = (window as Any).__cq3.app.profile;
        p.tipsOff = true;
        p.worldTour = true;
      });
      return;
    }
    await frames(page, 1);
  }
  throw new Error('game never became ready');
}

const shot = { animations: 'disabled' as const, caret: 'hide' as const, scale: 'device' as const, maxDiffPixelRatio: process.env.EXACT ? 0 : 0.002 };

/** The camp open with chests waiting (as screens.spec.ts's meta profile, trimmed to what the vault shows). */
async function vault(page: Page): Promise<(fn: (c: Any, now: number) => unknown) => Promise<unknown>> {
  await boot(page);
  await frames(page, 10);
  await page.evaluate(() => {
    const app = (window as Any).__cq3.app;
    const p = app.profile;
    p.actsCleared = 3;
    p.gems = 412;
    p.chests = { hero: 2, rare: 1, region: 0 };
    p.seen.push('campIntro', 'camp');
    app.newRun();
    app.openCamp();
  });
  await frames(page, 10);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => (window as Any).__cq3.app.storySkip());
    await frames(page, 4);
  }
  await frames(page, 16);
  const camp = (fn: (c: Any, now: number) => unknown) => page.evaluate(`(${fn.toString()})(window.__cq3.app.view.camp, performance.now())`);
  await camp((c, now) => c.go('chests', now));
  await frames(page, 30);
  return camp;
}

/** The fine layer: on screen, its backing size, and whether it lies exactly over the game canvas. */
const layer = (page: Page) =>
  page.evaluate(() => {
    const cv = document.getElementById('hd-layer') as HTMLCanvasElement | null;
    const game = (window as Any).__cq3.game.canvas as HTMLCanvasElement;
    if (!cv) return null;
    const a = cv.getBoundingClientRect();
    const b = game.getBoundingClientRect();
    return { shown: cv.style.display !== 'none', w: cv.width, h: cv.height, over: a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height };
  });

test('the sharper chest reveal: a hero chest builds up, bursts and reveals its prize on the fine layer', async ({ page }) => {
  const camp = await vault(page);
  // the game's own reveal by default: no layer
  expect(await camp((c) => c.chests.opening.view)).toBe('old');
  expect(await layer(page)).toBeNull();
  await camp((c, now) => {
    c.chests.opening.view = 'hd';
    c.chests.reseed(37); // a Legendary hero, new: Fizz (5 steps: grey, green, blue, purple, orange)
    c.chests.openKind('hero', now);
  });
  await frames(page, 120); // the third step (blue): the lid hops, light leaks from the seam
  expect(await layer(page)).toEqual({ shown: true, w: 654, h: 300, over: true });
  await expect(page).toHaveScreenshot('chest-hd-build.png', shot);
  await frames(page, 169); // the prize risen out of the light: a silhouette rimmed in its tier's light
  await expect(page).toHaveScreenshot('chest-hd-silhouette.png', shot);
  await frames(page, 81); // revealed: the ribbon, the name, New hero! and the style
  expect(await camp((c) => c.chests.opening.state.phase)).toBe('done');
  await expect(page).toHaveScreenshot('chest-hd-prize.png', shot);
  // a tap closes it: the layer goes with it, the profile got the hero (it was a real chest)
  await camp((c) => c.tap(150, 100));
  await frames(page, 20);
  expect(await camp((c) => c.chests.opening.active)).toBe(false);
  expect((await layer(page))?.shown).toBe(false);
  expect(await page.evaluate(() => (window as Any).__cq3.app.profile.heroes.fizz.unlocked)).toBe(true);
});

test('the sharper chest reveal: a tap fast-forwards a step, never past the reveal; the Divine demo at its last step', async ({ page }) => {
  const camp = await vault(page);
  await camp((c, now) => {
    c.chests.opening.view = 'hd';
    c.chests.demo(['divine'], 'region', now);
  });
  await frames(page, 30);
  const before = (await camp((c) => c.chests.opening.state)) as Any;
  expect(before).toMatchObject({ phase: 'build', tier: 'divine' });
  // each tap jumps to the next step: eight steps, the charge and the burst, then the reveal, which a tap never skips
  const order = ['build', 'charge', 'burst', 'reveal', 'done'];
  let phase = 'build';
  let taps = 0;
  while (phase !== 'reveal' && taps < 20) {
    await camp((c) => c.tap(150, 100));
    await frames(page, 10);
    taps++;
    const next = ((await camp((c) => c.chests.opening.state)) as Any).phase;
    expect(order.indexOf(next)).toBeGreaterThanOrEqual(order.indexOf(phase));
    phase = next;
  }
  expect({ phase, taps }).toEqual({ phase: 'reveal', taps: 11 });
  // the next tap lands on its end (Tap), the one after closes it
  await camp((c) => c.tap(150, 100));
  await frames(page, 10);
  expect(((await camp((c) => c.chests.opening.state)) as Any).phase).toBe('done');
  await camp((c, now) => {
    c.chests.opening.replay(now);
  });
  await frames(page, 262); // the last step: prismatic
  expect(((await camp((c) => c.chests.opening.state)) as Any).phase).toBe('build');
  await expect(page).toHaveScreenshot('chest-hd-divine.png', shot);
});

test('the sharper chest reveal: Open all, one chest after another, then what came out (the summary on the fine layer)', async ({ page }) => {
  const camp = await vault(page);
  await camp((c) => {
    c.chests.opening.view = 'hd';
    c.chests.reseed(5);
  });
  await camp((c, now) => c.chests.openAll(now));
  for (let i = 0; i < 3; i++) {
    // fast-forward each chest to its end (its steps fire at once), then a tap: the next
    await camp((c) => (c.chests.opening.cur.skip += 1e5));
    await frames(page, 15);
    await camp((c) => c.tap(150, 100));
    await frames(page, 20);
  }
  await frames(page, 40);
  expect(await camp((c) => c.chests.opening.state.phase)).toBe('summary');
  expect((await layer(page))?.shown).toBe(true);
  await expect(page).toHaveScreenshot('chest-hd-summary.png', shot);
  await camp((c) => c.tap(150, 100));
  await frames(page, 20);
  expect(await camp((c) => c.chests.opening.active)).toBe(false);
  expect((await layer(page))?.shown).toBe(false);
});

test('side by side (the Test lab compare): the old reveal in the left half, the new one in the right, one chest', async ({ page }) => {
  // (started directly, not through the lab's buttons: real clicks would move the seeded particles of the old half)
  const camp = await vault(page);
  await camp((c, now) => c.chests.compare(now));
  await frames(page, 100); // the build-up: the second step (green), light leaking from the seams
  expect(await camp((c) => ({ view: c.chests.opening.view, tier: c.chests.opening.state.tier }))).toEqual({ view: 'split', tier: 'rare' });
  await expect(page).toHaveScreenshot('chest-hd-split.png', shot);
  await frames(page, 190); // revealed: the ribbon, the name, New companion!, Next (4) by Replay
  await expect(page).toHaveScreenshot('chest-hd-split-prize.png', shot);
  await camp((c) => c.chests.endCompare());
  await frames(page, 3);
  expect((await layer(page))?.shown).toBe(false);
});

test('the Test lab: Sharper chest reveal opens side by side; Old, New and Both switch it; Replay; Done puts it away', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  await frames(page, 20);
  // the lab from the title: the item is in its new section, in the chests group
  await page.click('#btn-lab');
  await frames(page, 2);
  const item = page.locator('.lab-item[data-id="chestHd"]');
  await expect(item).toBeVisible();
  await expect(item).toContainText('Sharper chest reveal');
  await item.click();
  await frames(page, 2);
  await page.click('.lab-btn.go');
  await frames(page, 40);
  const camp = (fn: (c: Any, now: number) => unknown) => page.evaluate(`(${fn.toString()})(window.__cq3.app.view.camp, performance.now())`);
  // side by side: the old reveal in the left half, the new one in the right, playing the same chest (a demo)
  expect(await camp((c) => ({ view: c.chests.opening.view, compare: !!c.chests.opening.extra, active: c.chests.opening.active }))).toEqual({ view: 'split', compare: true, active: true });
  expect(await camp((c) => c.chests.opening.state.tier)).toBe('rare');
  await frames(page, 60);
  expect((await layer(page))?.shown).toBe(true);
  // the buttons (pressed with the pointer, through the game's input)
  const press = async (id: string) => {
    const pt = (await camp((c) => {
      const out: Record<string, { x: number; y: number }> = {};
      const l = c.kit.app.layout;
      for (const b of c.chests.opening.extra.buttons()) out[b.id] = { x: l.left + ((b.r.x + b.r.w / 2) * l.cssW) / 327, y: l.top + ((b.r.y + b.r.h / 2) * l.cssH) / 150 };
      return out;
    })) as Record<string, { x: number; y: number }>;
    await page.mouse.click(pt[id].x, pt[id].y);
    await frames(page, 3);
  };
  const tierBefore = await camp((c) => c.chests.opening.state.tier);
  await press('hd');
  expect(await camp((c) => c.chests.opening.view)).toBe('hd');
  await press('old');
  expect(await camp((c) => c.chests.opening.view)).toBe('old');
  // (the old one full size: the layer carries only the buttons)
  expect((await layer(page))?.shown).toBe(true);
  await press('split');
  expect(await camp((c) => c.chests.opening.view)).toBe('split');
  // the button taps never fast-forwarded the chest, and Replay plays it again from its slam
  expect(await camp((c) => c.chests.opening.state.tier)).toBe(tierBefore);
  await press('replay');
  expect(await camp((c) => c.chests.opening.state.phase)).toBe('build');
  // Done: the scenario ends, the reveal goes back to the setting's (the old one), the buttons go
  await page.click('#btn-lab-done');
  await frames(page, 10);
  expect(await camp((c) => ({ view: c.chests.opening.view, compare: !!c.chests.opening.extra, active: c.chests.opening.active }))).toEqual({ view: 'old', compare: false, active: false });
  expect((await layer(page))?.shown).toBe(false);
  expect(errors).toEqual([]);
});
