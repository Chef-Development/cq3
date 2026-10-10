import { expect, test, type Page } from './fixtures';

// Desktop: a 1440x900 window with a mouse and a keyboard (no touch). The canvas keeps its integer scale with a quiet
// frame round it, the keyboard plays a whole first fight (Space taps, F fires the finisher, Escape pauses), the
// arrows move a focus ring between a screen's buttons and Enter presses one, a mouse drag is the finisher's swipe, the
// window relayouts as it's resized, and C (or the gear panel) switches the clean capture.
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });

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

/** Where the focus ring sits, in game px (its centre), or null when it's hidden. */
async function ringAt(page: Page): Promise<{ x: number; y: number } | null> {
  return page.evaluate(() => {
    const r = document.getElementById('focus-ring');
    if (!r || r.hidden) return null;
    const b = r.getBoundingClientRect();
    const l = (window as Any).__cq3.app.layout;
    return { x: ((b.left + b.width / 2 - l.left) * 327) / l.cssW, y: ((b.top + b.height / 2 - l.top) * 150) / l.cssH };
  });
}

test('desktop: framed integer scale, the keyboard plays a fight, focus ring, mouse swipe, resize', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await ready(page);
  const a = app(page);

  // 1440x900 at 1x: 4x integer scale, centred, with the frame round it
  expect(await a((x) => x.layout.scale)).toBe(4);
  await expect(page.locator('#frame')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.classList.contains('framed'))).toBe(true);

  // the title (nothing saved): Enter starts
  expect(await a((x) => x.run.phase)).toBe('title');
  await page.keyboard.press('Enter');
  await expect.poll(() => a((x) => x.run.phase)).toBe('world');
  await page.waitForTimeout(400);

  // the world map: an arrow shows the ring on a target; Enter presses it (Rowan's plate or the first landmark)
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => ringAt(page)).not.toBeNull();
  await page.screenshot({ path: 'test-results/desktop-world.png' });
  for (let i = 0; i < 3 && (await a((x) => x.run.phase)) === 'world'; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
  }
  // the intro's scenes: Escape skips each
  await expect.poll(() => a((x) => x.run.phase)).toBe('scene');
  for (let i = 0; i < 4 && (await a((x) => x.run.phase)) === 'scene'; i++) {
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
  }
  await expect.poll(() => a((x) => x.run.phase)).toBe('map');
  await page.waitForTimeout(400);

  // the act map: Tab puts the ring on a reachable node, Enter walks there: the first fight
  await page.keyboard.press('Tab');
  await expect.poll(() => ringAt(page)).not.toBeNull();
  await page.keyboard.press('Enter');
  await expect.poll(() => a((x) => x.run.phase)).toBe('fight');
  await expect.poll(() => ringAt(page)).toBeNull();
  await page.waitForTimeout(200);
  await page.keyboard.press('Space'); // TAP TO BEGIN
  await expect.poll(() => a((x) => x.awaitingBegin)).toBe(false);
  await a((x) => (x.settings.godMode = true));
  await page.waitForTimeout(800); // (the foe walks in)

  // Space taps the bar (judged at the key's timestamp, like a pointer tap)
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(110);
  }
  const s = (await a((x) => ({ tick: x.run.combat?.tick ?? 0, tap: x.lastTap?.outcome ?? null }))) as { tick: number; tap: string | null };
  expect(s.tick).toBeGreaterThan(60);
  expect(s.tap).not.toBeNull();

  // F fires the finisher
  await a((x) => (x.run.combat.stacks = 2));
  await page.keyboard.press('f');
  await expect.poll(() => a((x) => x.run.combat?.stacks ?? 0)).toBe(0);

  // a mouse drag up the screen is the finisher's swipe (a fresh fight, so the first one's end can't get in the way)
  await a((x) => {
    x.setPhase(() => x.run.debugFight(0, ['wolf', 'wolf'], 'fight', x.run.hero));
    x.begin();
  });
  await page.waitForTimeout(1500);
  await a((x) => (x.run.combat.stacks = 1));
  expect(await a((x) => x.run.combat.finisherReady)).toBe(true);
  await page.mouse.move(720, 600);
  await page.mouse.down();
  await page.mouse.move(720, 520, { steps: 2 });
  await page.mouse.move(720, 420, { steps: 2 });
  await page.mouse.up();
  await expect.poll(() => a((x) => x.run.combat?.stacks ?? 0)).toBe(0);

  // Escape pauses, Escape again plays on
  await page.keyboard.press('Escape');
  expect(await a((x) => x.userPaused)).toBe(true);
  await page.keyboard.press('Escape');
  expect(await a((x) => x.userPaused)).toBe(false);

  // the window is resized: a new integer scale at once, the frame follows
  await page.setViewportSize({ width: 1100, height: 700 });
  await expect.poll(() => a((x) => x.layout.scale)).toBe(3);
  const box = await page.locator('#frame').boundingBox();
  expect(box?.width).toBe(981);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(() => a((x) => x.layout.scale)).toBe(4);
  await page.screenshot({ path: 'test-results/desktop-fight.png' });
  expect(errors).toEqual([]);
});

test('desktop: Space held down holds a hold block, letting go releases it', async ({ page }) => {
  await ready(page);
  const a = app(page);
  await a((x) => {
    x.settings.godMode = true;
    x.setPhase(() => x.run.debugFight(0, ['wolf'], 'fight', x.run.hero));
    x.begin();
  });
  await page.waitForTimeout(1500);
  // The keyboard's wiring, watched at the app: a press that starts a hold (the judge, core/combat.ts, is unit-tested;
  // a headless page's frame timing is too loose to aim a real hold from here) is let go by the key's release, at the
  // release's timestamp; a press that didn't start one has nothing to let go.
  await a((x) => {
    const w = window as Any;
    w.__keyLog = [];
    const tap = x.barTap.bind(x);
    x.barTap = (ts: number) => {
      w.__keyLog.push(['tap', ts]);
      tap(ts);
      return { outcome: w.__holdNext ? 'hold' : 'hit' };
    };
    x.barRelease = (ts: number) => w.__keyLog.push(['release', ts]);
  });
  const log = () => page.evaluate(() => (window as Any).__keyLog as Array<[string, number]>);
  await page.evaluate(() => ((window as Any).__holdNext = true));
  await page.keyboard.down('Space');
  await page.waitForTimeout(250);
  expect((await log()).map((e) => e[0])).toEqual(['tap']); // held: nothing let go yet (no key repeats either)
  await page.keyboard.up('Space');
  const l1 = await log();
  expect(l1.map((e) => e[0])).toEqual(['tap', 'release']);
  expect(l1[1][1] - l1[0][1]).toBeGreaterThan(200); // judged at the key's own moments, a quarter second apart
  // a plain hit: the key's release lets go of nothing
  await page.evaluate(() => ((window as Any).__holdNext = false));
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  expect((await log()).map((e) => e[0])).toEqual(['tap', 'release', 'tap']);
});

test('desktop: the camp by keyboard, Escape backs out', async ({ page }) => {
  await ready(page);
  const a = app(page);
  await a((x) => {
    const p = x.profile;
    p.actsCleared = 3;
    p.seen.push('campIntro', 'camp');
    x.newRun();
    x.openCamp();
  });
  await expect.poll(() => a((x) => x.run.phase)).toBe('camp');
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(100);
    await a((x) => x.storySkip());
  }
  await page.waitForTimeout(500);
  // Tab steps through the camp's buttons; Enter opens the one focused; Escape comes back home
  const seen = new Set<string>();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(60);
    const r = await ringAt(page);
    expect(r).not.toBeNull();
    seen.add(`${Math.round(r!.x)},${Math.round(r!.y)}`);
  }
  expect(seen.size).toBeGreaterThanOrEqual(4);
  await page.screenshot({ path: 'test-results/desktop-camp.png' });
  // the plates over the camp are on the ring too (they aren't buttons): Tab reaches the Shrine's, Enter opens it
  const shrine = (await a((x) => x.view.camp.focusTargets()[0])) as { x: number; y: number; w: number; h: number };
  let onShrine = false;
  for (let i = 0; i < 16 && !onShrine; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(60);
    const r = await ringAt(page);
    onShrine = !!r && Math.abs(r.x - (shrine.x + shrine.w / 2)) < 3 && Math.abs(r.y - (shrine.y + shrine.h / 2)) < 4;
  }
  expect(onShrine).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => a((x) => x.view.camp.mode)).toBe('shrine');
  await page.waitForTimeout(400); // (a screen ignores taps in its first moment: camp.tap)
  await page.keyboard.press('Escape');
  await expect.poll(() => a((x) => x.view.camp.mode)).toBe('home');
  await page.waitForTimeout(400);
  // the band's first button (Bag): the ring goes there with Tab from the start of the band
  await a((x) => x.view.camp.go('bag', performance.now()));
  await expect.poll(() => a((x) => x.view.camp.mode)).toBe('bag');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await expect.poll(() => a((x) => x.view.camp.mode)).toBe('home');
});

test('clean capture: C and the gear panel hide the buttons, a long press brings them back, kept across reloads', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#btn-gear')).toBeVisible();
  await page.keyboard.press('c');
  await expect(page.locator('#btn-gear')).toBeHidden();
  await page.reload();
  await page.waitForFunction(() => (window as Any).__cq3?.ready === true);
  await expect(page.locator('#btn-gear')).toBeHidden(); // kept (storage.ts)
  await page.keyboard.press('c');
  await expect(page.locator('#btn-gear')).toBeVisible();

  // ` opens the gear panel, Escape closes it
  await page.keyboard.press('`');
  await expect(page.locator('#debug')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#debug')).toBeHidden();
  // the gear panel's switch
  await page.click('#btn-gear');
  await page.locator('#debug summary', { hasText: 'Tester tools' }).click();
  await page.locator('#debug summary', { hasText: 'Test modes' }).click();
  await page.click('#capture-on');
  await expect(page.locator('#btn-gear')).toBeHidden();
  await expect(page.locator('#debug')).toBeHidden();
  // a long press where the gear button sat brings everything back
  const l = (await page.evaluate('window.__cq3.app.layout')) as { left: number; top: number; cssW: number; cssH: number };
  await page.mouse.move(l.left + l.cssW / 2, l.top + (8 * l.cssH) / 150);
  await page.mouse.down();
  await page.waitForTimeout(1000);
  await page.mouse.up();
  await expect(page.locator('#btn-gear')).toBeVisible();
});
