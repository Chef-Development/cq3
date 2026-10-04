import { expect, test, type Page } from '@playwright/test';

// The test handle main.ts puts on window (loosely typed: the tests poke at the app's state).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const app = (page: Page) => (fn: (a: Any) => unknown) => page.evaluate(`(${fn.toString()})(window.__cq3.app)`);

/** Click a point given in game px (327x150). */
async function tapGame(page: Page, x: number, y: number): Promise<void> {
  const l = (await page.evaluate('window.__cq3.app.layout')) as { left: number; top: number; cssW: number; cssH: number };
  await page.mouse.click(l.left + (x * l.cssW) / 327, l.top + (y * l.cssH) / 150);
}

async function ready(page: Page): Promise<void> {
  await page.goto('/cq3/');
  await page.waitForFunction(() => (window as Any).__cq3?.ready === true);
}

test('loads, plays the intro, walks the map, starts a fight, taps, no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  const a = app(page);

  // iPhone 16 Pro (landscape): 327x150 canvas at 8x.
  expect(await a((x) => x.layout.scale)).toBe(8);
  expect(await a((x) => x.run.phase)).toBe('title');

  await tapGame(page, 163, 75); // no save: a tap starts a new run on the kingdom's world map
  await expect.poll(() => a((x) => x.run.phase)).toBe('world');
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'test-results/world.png' });
  const gm = (await a((x) => x.view.worldMap.greenmarch())) as { x: number; y: number };
  await tapGame(page, gm.x, gm.y); // into Greenmarch: the intro plays
  await expect.poll(() => a((x) => x.run.phase)).toBe('scene');
  expect(await a((x) => x.storyId)).toBe('intro');
  await page.waitForTimeout(300);
  await tapGame(page, 160, 130); // a tap shows the whole box at once...
  await tapGame(page, 160, 130); // ...the next one moves on
  await expect.poll(() => a((x) => x.storyBox)).toBe(1);
  const skip = async () => {
    const R = (await a((x) => 327 - x.layout.safeRight)) as number;
    await tapGame(page, R - 25, 11);
  };
  await skip(); // the intro
  await expect.poll(() => a((x) => x.storyId)).toBe('act1');
  await page.waitForTimeout(300);
  await skip(); // Pip joins
  await expect.poll(() => a((x) => x.run.phase)).toBe('map');
  await page.screenshot({ path: 'test-results/map.png' });

  // walk to the first node of the map: a fight
  await page.waitForTimeout(350);
  const [nx, ny] = (await a((x) => x.view.mapView.pos(x.run.map.nodes[x.run.choices()[0]]))) as [number, number];
  await tapGame(page, nx, ny);
  await expect.poll(() => a((x) => x.run.phase)).toBe('fight');
  await page.waitForTimeout(150);
  await tapGame(page, 163, 75); // "TAP TO BEGIN!"
  await expect.poll(() => a((x) => x.awaitingBegin)).toBe(false);

  for (let i = 0; i < 8; i++) {
    await page.mouse.click(300, 330);
    await page.waitForTimeout(120);
  }
  const state = (await a((x) => ({ tick: x.run.combat?.tick ?? 0, tap: x.lastTap?.outcome ?? null }))) as { tick: number; tap: string | null };
  expect(state.tick).toBeGreaterThan(60);
  expect(state.tap).not.toBeNull();

  // Tuning panel opens; every Sound lab button plays without errors; it closes again.
  await page.click('#btn-gear');
  await expect(page.locator('#debug')).toBeVisible();
  const lab = page.locator('details', { has: page.locator('summary', { hasText: 'Sound lab' }) });
  const buttons = lab.locator('.dbg-grid button');
  expect(await buttons.count()).toBeGreaterThan(40);
  for (let i = 0; i < (await buttons.count()); i++) await buttons.nth(i).click();
  await page.waitForTimeout(300);
  expect(await a((x) => x.audio.ctx?.state)).toBe('running');
  await page.click('#btn-gear');
  await expect(page.locator('#debug')).toBeHidden();

  await page.screenshot({ path: 'test-results/smoke.png' });
  expect(errors).toEqual([]);
});

test('every enemy fights and uses each special without errors', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await ready(page);
  const a = app(page);
  await a((x) => (x.settings.godMode = true));
  const fights = (await a((x) => {
    const out: Array<[number, string[], string]> = [];
    const seen = new Set<string>();
    x.run.region.acts.forEach((act: Any, i: number) => {
      for (const g of [...act.fights.early, ...act.fights.late, ...act.elites, act.boss])
        for (const k of g) {
          if (seen.has(k)) continue;
          seen.add(k);
          const def = x.tuning.enemies[k];
          out.push([i, k === 'wolf' ? ['wolf', 'wolf'] : [k], def.boss ? 'boss' : def.elite ? 'elite' : 'fight']);
        }
    });
    return out;
  })) as Array<[number, string[], string]>;
  expect(fights.length).toBeGreaterThanOrEqual(13);
  for (const [act, enemies, type] of fights) {
    await page.evaluate(([act, enemies, type]) => {
      const x = (window as Any).__cq3.app;
      x.setPhase(() => x.run.debugFight(act, enemies, type, x.run.hero));
      x.begin();
    }, [act, enemies, type] as const);
    await page.waitForTimeout(250);
    const n = (await a((x) => x.run.combat.specialsOf(x.run.combat.enemies[0]).length)) as number;
    for (let i = 0; i < n; i++) {
      // force each special in turn (the boss's phase changes too) and let it play out
      const tell = (await page.evaluate((i) => {
        const x = (window as Any).__cq3.app;
        const c = x.run.combat;
        const e = c.enemies.find((q: Any) => q.alive && c.specialsOf(q).length) ?? c.enemies[0];
        if (!e.alive || c.result) return 0;
        c.telegraph = null;
        c.startTelegraph(e, Math.min(i, c.specialsOf(e).length - 1));
        return c.specialsOf(e)[Math.min(i, c.specialsOf(e).length - 1)].tell;
      }, i)) as number;
      await page.waitForTimeout(tell * 1000 + 400);
      // a boss's phase scene: skip it
      await a((x) => x.storyOverlay && x.storySkip());
    }
    const shown = (await a((x) => x.run.combat.enemies.filter((e: Any) => e.alive).length)) as number;
    expect(shown, enemies.join('+')).toBeGreaterThan(0);
  }
  await page.screenshot({ path: 'test-results/specials.png' });
  expect(errors).toEqual([]);
});

test('a run survives a reload: Continue picks the fight back up', async ({ page }) => {
  await ready(page);
  const a = app(page);
  await a((x) => {
    x.startRegion();
    x.storySkip();
    x.storySkip();
    x.setPhase(() => x.run.chooseNode(x.run.choices()[0]));
    x.run.hero.hp = 42;
    x.run.combat.enemies[0].hp = 99;
    window.dispatchEvent(new Event('pagehide')); // iOS: the app is switched away and later reloaded
  });
  await page.reload();
  await page.waitForFunction(() => (window as Any).__cq3?.ready === true);
  expect(await a((x) => ({ phase: x.run.phase, saved: !!x.savedRun }))).toEqual({ phase: 'title', saved: true });
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'test-results/title-continue.png' });
  await tapGame(page, 111, 101); // the Continue button
  const after = await a((x) => ({ phase: x.run.phase, path: x.run.path.length, hp: x.run.hero.hp, enemyHp: x.run.combat.enemies[0].hp, waiting: x.awaitingBegin }));
  expect(after).toEqual({ phase: 'fight', path: 1, hp: 42, enemyHp: 99, waiting: true });

  // a boss fight switches the music to the boss theme; the map plays its own theme
  const track = () => a((x) => x.audio.currentTrack);
  await a((x) => x.setPhase(() => x.run.debugFight(0, ['captain'], 'boss', x.run.hero)));
  await expect.poll(track).toBe('boss');
  await a((x) => x.setPhase(() => x.run.retry()));
  await expect.poll(track).toBe('map');
});
