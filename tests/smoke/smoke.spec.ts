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

  // Tuning panel opens; every Sound lab button plays without errors; it closes again.
  await page.click('#btn-gear');
  await expect(page.locator('#debug')).toBeVisible();
  const lab = page.locator('details', { has: page.locator('summary', { hasText: 'Sound lab' }) });
  const buttons = lab.locator('.dbg-grid button');
  expect(await buttons.count()).toBeGreaterThan(25);
  for (let i = 0; i < (await buttons.count()); i++) await buttons.nth(i).click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { __cq3: { app: { audio: { ctx: { state: string } | null } } } }).__cq3.app.audio.ctx?.state)).toBe('running');
  await page.click('#btn-gear');
  await expect(page.locator('#debug')).toBeHidden();

  await page.screenshot({ path: 'test-results/smoke.png' });
  expect(errors).toEqual([]);
});

test('a run survives a reload: Continue picks it back up', async ({ page }) => {
  type W = { __cq3: { ready: boolean; app: Record<string, unknown> } };
  await page.goto('/cq3/');
  await page.waitForFunction(() => (window as unknown as W).__cq3?.ready === true);
  await page.mouse.click(437, 200); // no save yet: any tap starts a new run
  await page.evaluate(() => {
    const app = (window as unknown as { __cq3: { app: any } }).__cq3.app;
    app.setPhase(() => app.run.startLevel(0, 2));
    app.run.hero.hp = 42;
    app.run.combat.enemies[0].hp = 99;
    window.dispatchEvent(new Event('pagehide')); // iOS: the app is switched away and later reloaded
  });
  await page.reload();
  await page.waitForFunction(() => (window as unknown as W).__cq3?.ready === true);
  const info = await page.evaluate(() => {
    const app = (window as unknown as { __cq3: { app: any } }).__cq3.app;
    return { phase: app.run.phase, saved: !!app.savedRun, layout: app.layout };
  });
  expect(info.phase).toBe('title');
  expect(info.saved).toBe(true);
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'test-results/title-continue.png' });
  // tap the Continue button (game px 111, 101)
  const l = info.layout;
  await page.mouse.click(l.left + (111 * l.cssW) / 327, l.top + (101 * l.cssH) / 150);
  const after = await page.evaluate(() => {
    const app = (window as unknown as { __cq3: { app: any } }).__cq3.app;
    return { phase: app.run.phase, stage: app.run.stageIndex, hp: app.run.hero.hp, enemyHp: app.run.combat.enemies[0].hp, waiting: app.awaitingBegin };
  });
  expect(after).toEqual({ phase: 'fight', stage: 2, hp: 42, enemyHp: 99, waiting: true });

  // the boss stage switches the music to the boss theme, and the next level switches it back
  const track = () => page.evaluate(() => (window as unknown as { __cq3: { app: any } }).__cq3.app.audio.currentTrack);
  await page.evaluate(() => {
    const app = (window as unknown as { __cq3: { app: any } }).__cq3.app;
    app.setPhase(() => app.run.startLevel(0, 3));
  });
  await expect.poll(track).toBe('boss');
  await page.evaluate(() => {
    const app = (window as unknown as { __cq3: { app: any } }).__cq3.app;
    app.setPhase(() => app.run.startLevel(1));
  });
  await expect.poll(track).toBe('battle');
});
