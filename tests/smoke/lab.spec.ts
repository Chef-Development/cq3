import { expect, test, type Page } from './fixtures';

// The Test lab (engine/lab.ts): opened from the title, a hero scenario and a bar-rule scenario played and rated, the
// report copied, and the real game's save untouched throughout (the lab plays on its own keys).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const app = (page: Page) => (fn: (a: Any) => unknown) => page.evaluate(`(${fn.toString()})(window.__cq3.app)`);

async function ready(page: Page): Promise<void> {
  await page.goto('/cq3/');
  await page.waitForFunction(() => (window as Any).__cq3?.ready === true);
  await page.evaluate(() => {
    const p = (window as Any).__cq3.app.profile;
    p.tipsOff = true;
    p.worldTour = true;
  });
}

/** The real game's keys in localStorage (the lab must never change them). */
const realKeys = (page: Page) =>
  page.evaluate(() => {
    const out: Record<string, string | null> = {};
    for (const k of ['cq3.profile.v2', 'cq3.run.v3']) out[k] = window.localStorage.getItem(k);
    return out;
  });

test('the Test lab: open from the title, play and rate two scenarios, copy the report, leave with the game untouched', async ({ page, context }) => {
  test.setTimeout(90_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  // the real game has some progress (so the title shows Continue / New game) and a save to keep safe
  await ready(page);
  const a = app(page);
  expect(await a((x) => x.run.phase)).toBe('title');
  await a((x) => {
    x.profile.coins = 321;
    x.profile.actsCleared = 1;
    x.saveProfile();
  });
  const before = await realKeys(page);
  expect(before['cq3.profile.v2']).toContain('"coins":321');

  // the title's button opens the lab: the list, grouped, spoilers hidden
  await expect(page.locator('#btn-lab')).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'test-results/lab-title.png' });
  await page.click('#btn-lab');
  await expect(page.locator('#lab')).toBeVisible();
  expect(await a((x) => x.inLab)).toBe(true);
  expect(await page.locator('.lab-item').count()).toBeGreaterThan(15);
  expect(await page.locator('.lab-item.spoiler').count()).toBe(0);
  await expect(page.locator('.lab-group', { hasText: 'Heroes' })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/lab-list.png' });

  // a hero scenario: what to try, then a real fight as Sable with the finisher ready
  await page.click('.lab-item[data-id="sable"]');
  await expect(page.locator('.lab-try')).toBeVisible();
  await page.screenshot({ path: 'test-results/lab-start.png' });
  await page.click('.lab-btn.go');
  await expect.poll(() => a((x) => x.run.phase)).toBe('fight');
  expect(await a((x) => ({ hero: x.run.hero.build.id, practice: !!x.run.practice, safe: x.run.combat.practice, stacks: x.run.combat.stacks }))).toEqual({ hero: 'sable', practice: true, safe: false, stacks: 1 });
  expect(await a((x) => x.profile.coins)).not.toBe(321); // the lab's own profile
  await expect(page.locator('#btn-lab-done')).toBeVisible();
  // her how-to card comes up before TAP TO BEGIN (the lab leaves that one tip on); a tap puts it away
  await expect.poll(() => a((x) => x.view.tips.current), { timeout: 5000 }).toBe('kitSable');
  expect(await a((x) => ({ waiting: x.awaitingBegin, seen: x.profile.tips.includes('kitSable'), off: x.profile.tipsOff }))).toEqual({ waiting: true, seen: true, off: false });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/lab-howto.png' });
  await page.mouse.click(437, 200);
  await expect.poll(() => a((x) => x.view.tips.current)).toBeNull();
  await page.mouse.click(437, 200); // TAP TO BEGIN
  await expect.poll(() => a((x) => x.awaitingBegin)).toBe(false);
  for (let i = 0; i < 6; i++) {
    await page.mouse.click(300, 330);
    await page.waitForTimeout(110);
  }
  expect(await a((x) => x.run.combat.tick)).toBeGreaterThan(30);
  await page.screenshot({ path: 'test-results/lab-fight.png' });
  await page.click('#btn-lab-done');
  // the rating card over the lab's camp
  await expect(page.locator('#lab[data-view="rate"]')).toBeVisible();
  expect(await a((x) => x.run.phase)).toBe('camp');
  await page.fill('.lab-note', 'dash feels quick');
  await page.screenshot({ path: 'test-results/lab-rate.png' });
  await page.click('.lab-btn.rate-good');
  await expect(page.locator('.lab-item[data-id="sable"].r-good')).toBeVisible();

  // a bar-rule scenario: ice patches against the Training Dummy, nothing hurts
  await page.click('.lab-item[data-id="barIce"]');
  await page.click('.lab-btn.go');
  await expect.poll(() => a((x) => x.run.phase)).toBe('fight');
  expect(await a((x) => ({ foe: x.run.combat.enemies[0].key, safe: x.run.combat.practice, ice: !!x.run.combat.bar?.ice }))).toEqual({ foe: 'dummy', safe: true, ice: true });
  await page.mouse.click(437, 200);
  for (let i = 0; i < 4; i++) {
    await page.mouse.click(300, 330);
    await page.waitForTimeout(110);
  }
  await page.click('#btn-lab-done');
  await expect(page.locator('#lab[data-view="rate"]')).toBeVisible();
  await page.click('.lab-btn.rate-work');
  await expect(page.locator('.lab-item[data-id="barIce"].r-work')).toBeVisible();

  // spoilers: one switch shows them
  await page.click('.lab-btn', { hasText: 'Show spoilers' } as Any);
  expect(await page.locator('.lab-item.spoiler').count()).toBeGreaterThan(5);
  await page.click('.lab-btn', { hasText: 'Hide spoilers' } as Any);
  expect(await page.locator('.lab-item.spoiler').count()).toBe(0);

  // the report: every rating and note, the accuracy line, the build
  await page.click('.lab-copy');
  await expect(page.locator('.toast', { hasText: 'Report copied!' })).toBeVisible();
  const report = (await page.evaluate(() => navigator.clipboard.readText())) as string;
  expect(report).toContain('CQ3 Test lab report');
  expect(report).toContain('- Sable: Good - "dash feels quick"');
  expect(report).toContain('- Ice patches: Needs work');
  expect(report).toContain('CQ3 accuracy');
  expect(report).toMatch(/lab fights: \d+ taps/);
  expect(report).toMatch(/Version \S+/);

  // leaving puts the real game back exactly as it was; its save was never touched
  await page.click('.lab-head .lab-btn[aria-label="Leave the Test lab"]');
  await expect(page.locator('#lab')).toBeHidden();
  expect(await a((x) => ({ lab: x.inLab, phase: x.run.phase, coins: x.profile.coins }))).toEqual({ lab: false, phase: 'title', coins: 321 });
  expect(await realKeys(page)).toEqual(before);
  expect(await page.evaluate(() => window.localStorage.getItem('cq3.lab.profile'))).not.toBeNull();

  // a reload keeps the ratings (their own key) and boots the real game
  await page.reload();
  await page.waitForFunction(() => (window as Any).__cq3?.ready === true);
  expect(await page.evaluate(() => (window as Any).__cq3lab.state.ratings.sable.rating)).toBe('good');
  expect(await a((x) => ({ lab: x.inLab, coins: x.profile.coins }))).toEqual({ lab: false, coins: 321 });
  expect(errors).toEqual([]);
});

test('every Test lab scenario starts and ends without errors (spoilers included)', async ({ page }) => {
  test.setTimeout(300_000); // (every session adds items, and the machine is shared: room for a longer list)
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  const a = app(page);
  await page.click('#btn-lab');
  await page.click('.lab-btn', { hasText: 'Show spoilers' } as Any);
  const ids = (await page.locator('.lab-item').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id))) as string[];
  expect(ids.length).toBeGreaterThan(25);
  for (const id of ids) {
    await page.click(`.lab-item[data-id="${id}"]`);
    await page.click('.lab-btn.go');
    await expect(page.locator('#btn-lab-done')).toBeVisible();
    const home = (await a((x) => x.run.phase)) as string;
    expect(['fight', 'camp', 'scene', 'map'], id).toContain(home);
    if (home === 'fight') {
      await page.mouse.click(437, 200); // TAP TO BEGIN
      await page.waitForTimeout(500);
    } else await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/lab-${id}.png` });
    await page.click('#btn-lab-done');
    await expect(page.locator('#lab[data-view="rate"]')).toBeVisible();
    expect(await a((x) => x.run.phase), id).toBe('camp');
    await page.click('.lab-btn', { hasText: 'Skip' } as Any);
    await expect(page.locator('#lab[data-view="list"]')).toBeVisible();
  }
  await page.click('.lab-btn', { hasText: 'Hide spoilers' } as Any);
  // (the later acts' maps drew every foe as its own mini: none fell back to the crossed swords)
  expect(await page.evaluate(() => (window as Any).__cq3.miniMisses)).toEqual([]);
  expect(errors).toEqual([]);
});

// ---- the lab list as a screenshot (fake clock and seeded Math.random, like screens.spec.ts)
const START = new Date('2026-01-01T12:00:00Z').getTime();

async function bootFrozen(page: Page): Promise<void> {
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
    await page.clock.runFor(16);
  }
  throw new Error('game never became ready');
}

test('the Test lab list (screenshot)', async ({ page }) => {
  await bootFrozen(page);
  for (let i = 0; i < 20; i++) await page.clock.runFor(16);
  await page.click('#btn-lab');
  for (let i = 0; i < 20; i++) await page.clock.runFor(16);
  await expect(page.locator('#lab[data-view="list"]')).toBeVisible();
  await expect(page).toHaveScreenshot('lab-list.png', { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: process.env.EXACT ? 0 : 0.002 });
});
