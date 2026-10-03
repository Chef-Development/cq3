import { expect, test } from '@playwright/test';

interface Cq3Window {
  __cq3?: {
    ready: boolean;
    app: {
      awaitingBegin: boolean;
      layout: { scale: number };
      run: { phase: string; combat: { tick: number } | null };
      lastTap: { outcome: string } | null;
    };
  };
}

test('loads, starts a fight, taps, no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/cq3/');
  await page.waitForFunction(() => (window as Cq3Window).__cq3?.ready === true);

  // iPhone 16 Pro (landscape): 327x150 canvas at 8x.
  expect(await page.evaluate(() => (window as Cq3Window).__cq3!.app.layout.scale)).toBe(8);
  expect(await page.evaluate(() => (window as Cq3Window).__cq3!.app.run.phase)).toBe('title');

  await page.mouse.click(437, 200); // tap to start
  await expect.poll(() => page.evaluate(() => (window as Cq3Window).__cq3!.app.run.phase)).toBe('fight');
  await page.waitForTimeout(150);
  await page.mouse.click(437, 200); // "TAP TO BEGIN!"
  await expect.poll(() => page.evaluate(() => (window as Cq3Window).__cq3!.app.awaitingBegin)).toBe(false);

  for (let i = 0; i < 8; i++) {
    await page.mouse.click(300, 330);
    await page.waitForTimeout(120);
  }
  const state = await page.evaluate(() => {
    const app = (window as Cq3Window).__cq3!.app;
    return { tick: app.run.combat?.tick ?? 0, tap: app.lastTap?.outcome ?? null };
  });
  expect(state.tick).toBeGreaterThan(60);
  expect(state.tap).not.toBeNull();

  // Tuning panel opens and closes without errors.
  await page.click('#btn-gear');
  await expect(page.locator('#debug')).toBeVisible();
  await page.click('#btn-gear');
  await expect(page.locator('#debug')).toBeHidden();

  await page.screenshot({ path: 'test-results/smoke.png' });
  expect(errors).toEqual([]);
});
