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

/** Load the game. Tips are off unless asked for (`tips`), so they never pop over the other tests' screens; so is the
 *  world map's first-visit reveal (`tour`). */
async function ready(page: Page, o: { tips?: boolean; tour?: boolean } = {}): Promise<void> {
  await page.goto('/cq3/');
  await page.waitForFunction(() => (window as Any).__cq3?.ready === true);
  await page.evaluate(
    ([tips, tour]) => {
      const p = (window as Any).__cq3.app.profile;
      p.tipsOff = !tips;
      p.worldTour = !tour;
    },
    [!!o.tips, !!o.tour],
  );
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
    x.run.combat.enemies[0].hp = 77; // under every Act 1 foe's max HP (the map, so the foe, is random per launch)
    window.dispatchEvent(new Event('pagehide')); // iOS: the app is switched away and later reloaded
  });
  await page.reload();
  await page.waitForFunction(() => (window as Any).__cq3?.ready === true);
  expect(await a((x) => ({ phase: x.run.phase, saved: !!x.savedRun }))).toEqual({ phase: 'title', saved: true });
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'test-results/title-continue.png' });
  await tapGame(page, 111, 101); // the Continue button
  const after = await a((x) => ({ phase: x.run.phase, path: x.run.path.length, hp: x.run.hero.hp, enemyHp: x.run.combat.enemies[0].hp, waiting: x.awaitingBegin }));
  expect(after).toEqual({ phase: 'fight', path: 1, hp: 42, enemyHp: 77, waiting: true });

  // the Bandit Captain brings his own theme; back on the map, Act 1's theme plays (its calm arrangement)
  const track = () => a((x) => x.audio.currentTrack);
  await a((x) => x.setPhase(() => x.run.debugFight(0, ['captain'], 'boss', x.run.hero)));
  await expect.poll(track).toBe('captain');
  await a((x) => x.setPhase(() => x.run.retry()));
  await expect.poll(track).toBe('act1');
  expect(await a((x) => x.audio.currentMusic.arrangement)).toBe('calm');
});

test('gear: loot after a win goes in the bag; act clear -> camp -> next act; defeat -> camp -> retry; the act picker', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await ready(page);
  const a = app(page);
  const phase = () => a((x) => x.run.phase);
  /** Beat every wave of the current fight at once. */
  const winFight = async () => {
    for (let k = 0; k < 12; k++) {
      const done = await a((x) => {
        const c = x.run.combat;
        if (!c || c.result) return true;
        for (const e of c.enemies) if (e.alive) (e.uses = e.uses.map(() => 1)), (e.hp = 1);
        c.stacks = Math.max(1, c.stacks);
        x.finisher();
        return false;
      });
      if (done) break;
      await page.waitForTimeout(1600);
    }
  };
  const tapRect = async (r: { x: number; y: number; w: number; h: number }) => tapGame(page, r.x + r.w / 2, r.y + r.h / 2);

  // a fight: win it, the loot screen shows what dropped (it's already in the bag), then the boost pick
  await a((x) => {
    x.startRegion();
    x.storySkip();
    x.storySkip();
    x.setPhase(() => x.run.chooseNode(x.run.choices()[0]));
    x.begin();
  });
  await winFight();
  await expect.poll(phase, { timeout: 15_000 }).toMatch(/loot|boost/);
  if ((await phase()) === 'loot') {
    expect(await a((x) => x.run.loot.every((i: Any) => x.profile.items.some((p: Any) => p.uid === i.uid)))).toBe(true);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'test-results/loot.png' });
    for (let i = 0; i < 6 && (await phase()) === 'loot'; i++) {
      await tapGame(page, 163, 75);
      await page.waitForTimeout(700);
    }
  }
  await expect.poll(phase).toBe('boost');
  await page.waitForTimeout(700);
  await tapRect((await a((x) => x.view.overlays.cardRect(0))) as Any);
  await expect.poll(phase).toBe('map');

  // the mini-boss: its loot, the boost, then the act clear with Camp and Next
  await a((x) => {
    x.setPhase(() => x.run.debugFight(0, ['captain'], 'boss', x.run.hero));
    x.begin();
  });
  await winFight();
  await expect.poll(phase, { timeout: 15_000 }).toBe('loot');
  await a((x) => x.setPhase(() => x.run.collectLoot()));
  await a((x) => x.setPhase(() => x.run.pickBoost(0)));
  expect(await phase()).toBe('actClear');
  expect(await a((x) => x.profile.actsCleared)).toBe(1);
  await page.waitForTimeout(800);
  await tapGame(page, 163, 100); // the chest bursts
  await page.waitForTimeout(900);
  const clear = (await a((x) => x.view.overlays.clearButtons())) as Any;
  await tapRect(clear.camp);
  await expect.poll(phase).toBe('camp');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/camp.png' });
  await a((x) => x.leaveCamp());
  await expect.poll(phase).toBe('actClear');
  // the act's first clear unlocked relics: a "New relic unlocked!" card each comes up over the screen; a tap each
  await expect.poll(() => a((x) => x.view.overlays.unlockActive()), { timeout: 5000 }).toBe(true);
  for (let i = 0; i < 6 && ((await a((x) => x.run.newRelics.length)) as number) > 0; i++) {
    await page.waitForTimeout(500);
    await tapGame(page, 163, 75);
  }
  expect(await a((x) => x.run.newRelics.length)).toBe(0);
  await page.waitForTimeout(300);
  await tapRect(clear.next);
  await expect.poll(phase).toBe('scene');
  expect(await a((x) => x.run.actIndex)).toBe(1);

  // a defeat: Camp, back, Retry
  await a((x) => {
    x.setPhase(() => x.run.skipScenes()); // Sable's arrival at the camp, then the act's opening
    x.setPhase(() => x.run.chooseNode(x.run.choices()[0]));
    x.begin();
    const c = x.run.combat;
    x.run.hero.revives = 0;
    x.run.hero.hp = 1;
    c.spawnBlock('red', 0.05);
  });
  await expect.poll(phase, { timeout: 10_000 }).toBe('defeat');
  await page.waitForTimeout(900);
  const def = (await a((x) => x.view.overlays.defeatButtons())) as Any;
  await tapRect(def.camp);
  await expect.poll(phase).toBe('camp');
  await a((x) => x.leaveCamp());
  await expect.poll(phase).toBe('defeat');
  await page.waitForTimeout(300);
  await tapRect(def.retry);
  await expect.poll(phase).toBe('map');

  // the world map: Greenmarch opens the act picker (an act is cleared); Act 1 can be replayed
  await a((x) => x.toWorld());
  await page.waitForTimeout(500);
  const gm = (await a((x) => x.view.worldMap.greenmarch())) as { x: number; y: number };
  await tapGame(page, gm.x, gm.y);
  await expect.poll(() => a((x) => x.view.worldMap.pickerOpen)).toBe(true);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/act-picker.png' });
  await tapRect((await a((x) => x.view.worldMap.playButton(1))) as Any);
  await expect.poll(phase).toBe('scene');
  expect(await a((x) => x.run.actIndex)).toBe(1);
  expect(errors).toEqual([]);
});

test('world map: the first visit glides over the world (a tap skips it); a drag pans it and starts nothing; an act landmark opens its card and Play starts it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await ready(page, { tour: true });
  const a = app(page);
  const phase = () => a((x) => x.run.phase);
  const cam = async () => (await a((x) => x.view.worldMap.camera())) as { x: number; y: number };
  await tapGame(page, 163, 75); // no save: a tap starts a new run on the kingdom's world map
  await expect.poll(phase).toBe('world');
  await expect.poll(() => a((x) => x.view.worldMap.touring)).toBe(true);
  await page.waitForTimeout(400);
  await tapGame(page, 163, 75); // any tap skips the reveal, and does nothing else
  await expect.poll(() => a((x) => x.view.worldMap.touring)).toBe(false);
  expect(await a((x) => x.profile.worldTour)).toBe(true);
  const home = await cam();
  expect(home).toEqual(await a((x) => ((h: number[]) => ({ x: h[0], y: h[1] }))(x.view.worldMap.home())));
  expect(await phase()).toBe('world');

  // a drag that starts on a landmark pans the map (it glides on a little) and starts nothing
  const l = (await page.evaluate('window.__cq3.app.layout')) as { left: number; top: number; cssW: number; cssH: number };
  const css = (x: number, y: number): [number, number] => [l.left + (x * l.cssW) / 327, l.top + (y * l.cssH) / 150];
  const spot0 = (await a((x) => x.view.worldMap.actSpot(0))) as { x: number; y: number };
  const [sx, sy] = css(spot0.x, spot0.y);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) {
    await page.mouse.move(sx - k * 12, sy - k * 3);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const moved = await cam();
  expect(moved.x).toBeGreaterThan(home.x + 20);
  expect(await phase()).toBe('world');
  expect(await a((x) => ({ sel: x.view.worldMap.selected, picker: x.view.worldMap.pickerOpen }))).toEqual({ sel: null, picker: false });
  await page.screenshot({ path: 'test-results/world-dragged.png' });

  // a tap on an act's landmark (where it is now): its card; Play starts the story
  const spot = (await a((x) => x.view.worldMap.actSpot(0))) as { x: number; y: number };
  await tapGame(page, spot.x, spot.y);
  await expect.poll(() => a((x) => x.view.worldMap.selected)).toBe(0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/world-act-card.png' });
  const play = (await a((x) => x.view.worldMap.cardPlay())) as { x: number; y: number; w: number; h: number };
  await tapGame(page, play.x + play.w / 2, play.y + play.h / 2);
  await expect.poll(phase).toBe('scene');
  expect(await a((x) => x.storyId)).toBe('intro');
  expect(errors).toEqual([]);
});

test('relics: pick one after a fight, its icon is on the HUD belt next fight, a tap there opens the relic panel', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await ready(page);
  const a = app(page);
  const phase = () => a((x) => x.run.phase);
  const tapRect = async (r: { x: number; y: number; w: number; h: number }) => tapGame(page, r.x + r.w / 2, r.y + r.h / 2);

  // win the first fight
  await a((x) => {
    x.startRegion();
    x.storySkip();
    x.storySkip();
    x.setPhase(() => x.run.chooseNode(x.run.choices()[0]));
    x.begin();
  });
  for (let k = 0; k < 12 && (await phase()) === 'fight'; k++) {
    await a((x) => {
      const c = x.run.combat;
      if (!c || c.result) return;
      for (const e of c.enemies) if (e.alive) (e.uses = e.uses.map(() => 1)), (e.hp = 1);
      c.stacks = Math.max(1, c.stacks);
      x.finisher();
    });
    await page.waitForTimeout(1600);
  }
  await expect.poll(phase, { timeout: 15_000 }).toMatch(/loot|boost/);
  if ((await phase()) === 'loot') await a((x) => x.setPhase(() => x.run.collectLoot()));
  await expect.poll(phase).toBe('boost');
  // the first card is a relic: pick it with a tap
  await a((x) => (x.run.boostChoices[0] = { id: 'relic', rarity: 'rare', relic: 'ironRhythm' }));
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/relic-pick.png' });
  await tapRect((await a((x) => x.view.overlays.cardRect(0))) as Any);
  await expect.poll(phase).toBe('map');
  expect(await a((x) => x.run.hero.relics)).toContain('ironRhythm');

  // the next fight (a fight for sure: the map is random per launch): the relic's icon sits on the belt under the hero plate
  await a((x) => {
    x.setPhase(() => x.run.debugFight(0, ['slime'], 'fight', x.run.hero));
    x.begin();
  });
  await page.waitForTimeout(900);
  const belt = (await a((x) => x.view.hud.relicBelt())) as Any;
  expect(belt.slots.map((s: Any) => s.id)).toContain('ironRhythm');
  await page.screenshot({ path: 'test-results/relic-belt.png' });

  // a tap on it pauses the fight and opens the relic panel on that relic (not a bar tap); Resume plays on
  const slot = belt.slots.find((s: Any) => s.id === 'ironRhythm');
  const lastTap = await a((x) => x.lastTap);
  await tapRect(slot.r);
  await expect.poll(() => a((x) => ({ paused: x.userPaused, sel: x.view.overlays.relicSel }))).toEqual({ paused: true, sel: belt.slots.indexOf(slot) });
  expect(await a((x) => x.lastTap)).toEqual(lastTap);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/relic-panel.png' });
  await tapRect((await a((x) => x.view.overlays.relicResume())) as Any);
  await expect.poll(() => a((x) => ({ paused: x.userPaused, sel: x.view.overlays.relicSel }))).toEqual({ paused: false, sel: null });
  expect(errors).toEqual([]);
});

// iOS opens a home-screen app upright and turns it sideways as it launches: the resize event can come before the
// new size is readable, or not at all. The layout must still settle on the real screen, without any events.
test('launch: the layout catches up with a viewport that changes without a resize event', async ({ page }) => {
  await page.addInitScript(() => {
    const block = (e: Event) => e.stopImmediatePropagation();
    window.addEventListener('resize', block, true);
    window.addEventListener('orientationchange', block, true);
    window.visualViewport?.addEventListener('resize', block, true);
    delete (window as Any).ResizeObserver; // the worst case: nothing announces the change at all
  });
  await page.setViewportSize({ width: 402, height: 874 });
  await ready(page);
  const a = app(page);
  expect(await a((x) => x.layout.scale)).toBe(3);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect.poll(() => a((x) => x.layout.scale), { timeout: 3000 }).toBe(8);
  const l = (await a((x) => x.layout)) as { cssW: number; left: number };
  const box = await page.locator('#game canvas').boundingBox();
  expect(box?.width).toBeCloseTo(l.cssW, 1);
  expect(box?.x).toBeCloseTo(l.left, 1);
});

test('the act map has a Camp button: the camp mid-act, then back to the same spot on the map', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  const a = app(page);
  const tapRect = async (r: { x: number; y: number; w: number; h: number }) => tapGame(page, r.x + r.w / 2, r.y + r.h / 2);
  await a((x) => {
    x.startRegion();
    x.run.skipScenes();
  });
  await expect.poll(() => a((x) => x.run.phase)).toBe('map');
  await page.waitForTimeout(400);
  await tapRect((await a((x) => x.view.mapView.campRect())) as Any);
  await expect.poll(() => a((x) => ({ phase: x.run.phase, from: x.run.campFrom }))).toEqual({ phase: 'camp', from: 'map' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/camp-from-map.png' });
  const leave = ((await a((x) => x.view.camp.band())) as Array<{ id: string; r: Any; label: string }>).find((b) => b.id === 'leave')!;
  expect(leave.label).toBe('Act 1 map');
  await tapRect(leave.r);
  await expect.poll(() => a((x) => ({ phase: x.run.phase, path: x.run.path.length }))).toEqual({ phase: 'map', path: 0 });
  expect(errors).toEqual([]);
});

test('living maps: a tap on a sparkle pays a coin or two, once (not again after a reload); the world map has one too', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await ready(page);
  const a = app(page);
  const sure = () => a((x) => Object.assign(x.tuning.life, { mapChance: 1, worldChance: 1, delayMin: 0, delayMax: 0 }));
  const sparkle = () => a((x) => x.view.mapView.life.sparkleRect()) as Promise<{ x: number; y: number; w: number; h: number } | null>;
  await sure();
  // Act 1, one node in (an act's first step never has one): walk there and come back to the map
  await a((x) => {
    x.startRegion();
    x.run.skipScenes();
    x.setPhase(() => {
      x.run.path = [x.run.choices()[0]];
      x.run.phase = 'map';
    });
  });
  await expect.poll(() => a((x) => x.run.phase)).toBe('map');
  await expect.poll(sparkle).not.toBeNull();
  const r = (await sparkle())!;
  const coins = (await a((x) => x.run.coins)) as number;
  await tapGame(page, r.x + r.w / 2, r.y + r.h / 2);
  await expect.poll(() => a((x) => x.run.coins)).toBeGreaterThan(coins);
  const paid = ((await a((x) => x.run.coins)) as number) - coins;
  expect(paid).toBeGreaterThanOrEqual(1);
  expect(paid).toBeLessThanOrEqual(2);
  // the tap went to the sparkle: Rowan stays where he is
  expect(await a((x) => ({ phase: x.run.phase, path: x.run.path.length, walking: x.view.mapView.walking }))).toEqual({ phase: 'map', path: 1, walking: false });
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'test-results/sparkle-pop.png' });
  expect(await sparkle()).toBeNull();
  await tapGame(page, r.x + r.w / 2, r.y + r.h / 2); // nothing there now
  await page.waitForTimeout(100);
  expect(await a((x) => x.run.coins)).toBe(coins + paid);
  // a reload puts Rowan back on the same step: its sparkle stays picked up
  await a(() => window.dispatchEvent(new Event('pagehide')));
  await page.reload();
  await page.waitForFunction(() => (window as Any).__cq3?.ready === true);
  await page.evaluate(() => ((window as Any).__cq3.app.profile.tipsOff = true));
  await sure();
  await a((x) => x.continueRun());
  await expect.poll(() => a((x) => ({ phase: x.run.phase, path: x.run.path.length }))).toEqual({ phase: 'map', path: 1 });
  await page.waitForTimeout(600);
  expect(await sparkle()).toBeNull();
  expect(await a((x) => x.run.coins)).toBe(coins + paid);
  // the world map: this visit's sparkle, out at sea, into the purse
  await a((x) => x.newRun());
  await expect.poll(() => a((x) => x.run.phase)).toBe('world');
  const sea = async () => (await a((x) => x.view.worldMap.life.sparkleOnScreen())) as { x: number; y: number } | null;
  await expect.poll(sea).not.toBeNull();
  await page.waitForTimeout(400);
  const w = (await sea())!;
  const purse = (await a((x) => x.profile.coins)) as number;
  await tapGame(page, w.x, w.y);
  await expect.poll(() => a((x) => x.profile.coins)).toBeGreaterThan(purse);
  expect(await a((x) => x.run.phase)).toBe('world');
  expect(errors).toEqual([]);
});

test('New game (tapped twice on the title) wipes everything, keeping the settings; Continue keeps it all', async ({ page }) => {
  // progress saved before the load: two acts cleared, coins, Rowan at a level; a calibrated tap offset; no run saved
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return; // only before the first load (not after New game's reload)
    sessionStorage.setItem('seeded', '1');
    const hero = (unlocked: boolean, xp: number) => ({ unlocked, xp, skills: [] });
    const p = { v: 3, actsCleared: 2, coins: 321, smithMet: true, sableMet: true, hero: 'rowan', heroes: { rowan: hero(true, 900), sable: hero(true, 0) }, tips: ['welcomeM4a'] };
    localStorage.setItem('cq3.profile.v2', JSON.stringify(p));
    localStorage.setItem('cq3.settings.v2', JSON.stringify({ calibrationMs: 37 }));
  });
  await ready(page);
  const a = app(page);
  // anything earned: the title offers Continue / New game (no run in progress: Continue goes to the world map)
  expect(await a((x) => ({ phase: x.run.phase, saved: !!x.savedRun, can: x.canContinue }))).toEqual({ phase: 'title', saved: false, can: true });
  await page.waitForTimeout(700); // the buttons ease in
  await page.screenshot({ path: 'test-results/title-new-game.png' });
  // one tap on New game only arms it
  await tapGame(page, 228, 101);
  await page.waitForTimeout(200);
  expect(await a((x) => ({ phase: x.run.phase, acts: x.profile.actsCleared }))).toEqual({ phase: 'title', acts: 2 });
  await page.screenshot({ path: 'test-results/title-new-game-armed.png' });
  // the second tap erases everything and starts from the top
  await Promise.all([page.waitForEvent('load'), tapGame(page, 228, 101)]);
  await page.waitForFunction(() => (window as Any).__cq3?.ready === true);
  expect(await a((x) => ({ acts: x.profile.actsCleared, coins: x.profile.coins, xp: x.profile.heroes.rowan.xp, sable: x.profile.sableMet, save: !!x.savedRun, can: x.canContinue, cal: x.settings.calibrationMs }))).toEqual({
    acts: 0,
    coins: 0,
    xp: 0,
    sable: false,
    save: false,
    can: false,
    cal: 37,
  });
  // the gear panel's Start over does the same (asked twice)
  await a((x) => {
    x.profile.coins = 50;
    x.saveProfile();
  });
  let asked = 0;
  page.on('dialog', (d) => {
    asked++;
    void d.accept();
  });
  await page.click('#btn-gear');
  await expect(page.locator('#debug')).toBeVisible();
  await Promise.all([page.waitForEvent('load'), page.locator('#debug button', { hasText: 'Start over' }).click()]);
  await page.waitForFunction(() => (window as Any).__cq3?.ready === true);
  expect(asked).toBe(2);
  expect(await a((x) => ({ coins: x.profile.coins, cal: x.settings.calibrationMs }))).toEqual({ coins: 0, cal: 37 });
});

test('camp: learn a skill and reset, pick Sable on the hero select, read a new relic', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  // a profile saved before the load: Act 1 cleared (Sable has joined), Rowan at level 5 (two skill points), a new relic
  await page.addInitScript(() => {
    const hero = (unlocked: boolean, xp: number) => ({ unlocked, xp, skills: [] });
    const p = { v: 3, actsCleared: 1, smithMet: true, sableMet: true, hero: 'rowan', heroes: { rowan: hero(true, 400), sable: hero(true, 0) }, relics: ['shortFuse'], relicsNew: ['shortFuse'] };
    localStorage.setItem('cq3.profile.v2', JSON.stringify(p));
  });
  await ready(page);
  const a = app(page);
  const tapRect = async (r: { x: number; y: number; w: number; h: number }) => tapGame(page, r.x + r.w / 2, r.y + r.h / 2);
  const saved = async () => JSON.parse(((await page.evaluate(() => localStorage.getItem('cq3.profile.v2'))) as string) ?? '{}');
  const mode = () => a((x) => x.view.camp.mode);
  const band = async () => (await a((x) => x.view.camp.band())) as Array<{ id: string; r: Any }>;
  expect(await a((x) => x.profile.heroes.rowan.xp)).toBe(400);
  await a((x) => {
    x.newRun();
    x.openCamp();
  });
  await expect.poll(() => a((x) => x.run.phase)).toBe('camp');
  expect(await a((x) => x.storyOverlay)).toBeNull(); // Sable has already joined: no scene
  await page.waitForTimeout(500);

  // Skills: the first node to learn is picked; Learn spends a point (saved), Reset (a second tap confirms) refunds it
  await tapRect((await band()).find((b) => b.id === 'skills')!.r);
  await expect.poll(mode).toBe('skills');
  await page.waitForTimeout(400);
  expect(await a((x) => x.view.camp.skills.sel)).toBe('keenEdge');
  await tapRect((await a((x) => x.view.camp.skills.learnRect())) as Any);
  await expect.poll(() => a((x) => x.profile.heroes.rowan.skills.join())).toBe('keenEdge');
  expect((await saved()).heroes.rowan.skills).toEqual(['keenEdge']);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/skills.png' });
  await tapRect((await a((x) => x.view.camp.skills.resetRect())) as Any);
  await page.waitForTimeout(250);
  expect(await a((x) => x.profile.heroes.rowan.skills.length)).toBe(1); // the first tap only arms it
  await tapRect((await a((x) => x.view.camp.skills.resetRect())) as Any);
  await expect.poll(() => a((x) => x.profile.heroes.rowan.skills.length)).toBe(0);
  expect((await saved()).heroes.rowan.skills).toEqual([]);
  await tapRect((await a((x) => x.view.camp.kit.backRect())) as Any);
  await expect.poll(mode).toBe('home');
  await page.waitForTimeout(400);

  // the hero chip opens the hero select; Sable's tab, then Pick: Sable fights next (at their own level, with their skills)
  await tapRect((await a((x) => x.view.camp.chipRect())) as Any);
  await expect.poll(mode).toBe('heroes');
  await page.waitForTimeout(400);
  await tapRect((await a((x) => x.view.camp.heroes.tabs().find((t: Any) => t.id === 'sable').r)) as Any);
  await expect.poll(() => a((x) => x.view.camp.heroes.view)).toBe('sable');
  await page.waitForTimeout(300);
  await tapRect((await a((x) => x.view.camp.heroes.buttons().pick)) as Any);
  await expect.poll(() => a((x) => x.profile.hero)).toBe('sable');
  expect(await a((x) => x.run.hero.build.id)).toBe('sable');
  expect((await saved()).hero).toBe('sable');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/heroes.png' });
  await tapRect((await a((x) => x.view.camp.kit.backRect())) as Any);
  await expect.poll(mode).toBe('home');
  await page.waitForTimeout(400);

  // the relic log: the new relic wears a NEW tag until it's looked at
  await tapRect((await band()).find((b) => b.id === 'relics')!.r);
  await expect.poll(mode).toBe('relics');
  await page.waitForTimeout(500);
  await tapRect((await a((x) => x.view.camp.relics.cell(1))) as Any); // Short Fuse, second in the log
  await expect.poll(() => a((x) => x.view.camp.relics.sel)).toBe('shortFuse');
  expect(await a((x) => x.profile.relicsNew.length)).toBe(0);
  expect((await saved()).relicsNew).toEqual([]);
  await page.screenshot({ path: 'test-results/relics.png' });
  await a((x) => x.leaveCamp());
  await expect.poll(() => a((x) => x.run.phase)).toBe('world');
  expect(errors).toEqual([]);
});

// ------------------------------------------------------------------ tips ("teach it slowly") and the welcome back

test('tips: the first map and fight teach as they go; a tap only dismisses a tip; a reload never repeats one; the first red stops the fight', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await ready(page, { tips: true });
  const a = app(page);
  const tip = () => a((x) => x.view.tips.current);
  expect(await a((x) => x.storyId)).toBeNull(); // a new player gets no welcome back
  // the first map: its tip comes up; the tap that dismisses it doesn't walk to the spot under it
  await a((x) => {
    x.startRegion();
    x.setPhase(() => x.run.skipScenes());
  });
  await expect.poll(tip, { timeout: 5000 }).toBe('map');
  await page.waitForTimeout(450);
  await page.screenshot({ path: 'test-results/tip-map.png' });
  const [nx, ny] = (await a((x) => x.view.mapView.pos(x.run.map.nodes[x.run.choices()[0]]))) as [number, number];
  await tapGame(page, nx, ny);
  await expect.poll(tip).toBeNull();
  await page.waitForTimeout(500);
  expect(await a((x) => ({ phase: x.run.phase, path: x.run.path.length, walking: x.view.mapView.walking }))).toEqual({ phase: 'map', path: 0, walking: false });

  // the first fight: "tap yellow" comes up before TAP TO BEGIN, and the fight's clock doesn't run
  await a((x) => x.setPhase(() => x.run.debugFight(0, ['slime'], 'fight', x.run.hero)));
  await expect.poll(tip, { timeout: 5000 }).toBe('tapYellow');
  expect(await a((x) => ({ waiting: x.awaitingBegin, up: x.tipUp }))).toEqual({ waiting: true, up: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/tip-first-fight.png' });
  expect(await a((x) => x.run.combat.tick)).toBe(0);
  // a tap on the bar dismisses it: not a bar tap, and the fight still waits for TAP TO BEGIN
  await tapGame(page, 163, 120);
  await expect.poll(tip).toBeNull();
  expect(await a((x) => ({ waiting: x.awaitingBegin, tick: x.run.combat.tick, tap: x.lastTap, up: x.tipUp }))).toEqual({ waiting: true, tick: 0, tap: null, up: false });
  const saved = JSON.parse(((await page.evaluate(() => localStorage.getItem('cq3.profile.v2'))) as string) ?? '{}');
  expect(saved.tips).toEqual(expect.arrayContaining(['map', 'tapYellow']));

  // a reload: the tips seen never come back
  await page.reload();
  await page.waitForFunction(() => (window as Any).__cq3?.ready === true);
  await a((x) => x.setPhase(() => x.run.debugFight(0, ['slime'], 'fight', x.run.hero)));
  await page.waitForTimeout(1500);
  expect(await tip()).toBeNull();
  expect(await a((x) => x.awaitingBegin)).toBe(true);

  // the first red (the other fight tips already seen): its tip stops the fight until a tap; that tap isn't judged
  await a((x) => {
    x.profile.tips.push('purple', 'green', 'special', 'finisher', 'comboBreak');
    x.begin();
  });
  await page.waitForTimeout(400);
  await a((x) => x.run.combat.spawnBlock('red', 0.85));
  await expect.poll(tip, { timeout: 5000 }).toBe('blockRed');
  const t0 = (await a((x) => x.run.combat.tick)) as number;
  await page.waitForTimeout(500);
  expect(await a((x) => ({ tick: x.run.combat.tick, active: x.active() }))).toEqual({ tick: t0, active: false });
  await page.screenshot({ path: 'test-results/tip-red.png' });
  const lastTap = await a((x) => x.lastTap);
  await tapGame(page, 163, 120);
  await expect.poll(tip).toBeNull();
  expect(await a((x) => x.lastTap)).toEqual(lastTap);
  await expect.poll(() => a((x) => x.run.combat.tick), { timeout: 3000 }).toBeGreaterThan(t0);
  expect(errors).toEqual([]);
});

test("welcome back: a returning player's first launch plays Pip's scene over the title, once", async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // a profile saved by an earlier version (no tips yet): Act 1 cleared, Sable has joined
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const hero = (unlocked: boolean, xp: number) => ({ unlocked, xp, skills: [] });
    const p = { v: 3, actsCleared: 1, smithMet: true, sableMet: true, hero: 'rowan', heroes: { rowan: hero(true, 300), sable: hero(true, 0) } };
    localStorage.setItem('cq3.profile.v2', JSON.stringify(p));
  });
  await page.goto('/cq3/');
  await page.waitForFunction(() => (window as Any).__cq3?.ready === true);
  const a = app(page);
  expect(await a((x) => ({ phase: x.run.phase, story: x.storyId }))).toEqual({ phase: 'title', story: 'welcomeBack' });
  // played the moment it starts (saved); the basics' tips are marked seen, the new systems' are not
  const saved = JSON.parse(((await page.evaluate(() => localStorage.getItem('cq3.profile.v2'))) as string) ?? '{}');
  expect(saved.tips).toEqual(expect.arrayContaining(['welcomeM4a', 'map', 'tapYellow', 'camp']));
  expect(saved.tips).not.toContain('relicPick');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/welcome-back.png' });
  // taps go through the scene (never the title under it), then the title is back
  for (let i = 0; i < 10 && (await a((x) => x.storyId)); i++) {
    await tapGame(page, 163, 75);
    await page.waitForTimeout(250);
  }
  expect(await a((x) => ({ phase: x.run.phase, story: x.storyId }))).toEqual({ phase: 'title', story: null });
  // no tip comes up over the title
  await page.waitForTimeout(600);
  expect(await a((x) => x.view.tips.current)).toBeNull();
  // once: a reload doesn't play it again
  await page.reload();
  await page.waitForFunction(() => (window as Any).__cq3?.ready === true);
  await page.waitForTimeout(300);
  expect(await a((x) => x.storyId)).toBeNull();
  expect(errors).toEqual([]);
});

/** In-page helpers for the map extras (evaluated with `x` = the app): paths that meet a roamer, or none. */
const EXTRAS = `
  const run = x.run;
  const meets = (prefix, id) => run.roamFor(prefix).roamers.find((r) => r.at === id || r.next === id) || null;
  /** A path from the start to node id that meets no roamer on the way (the last step too, unless allowed). */
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
  /** The first step that meets a roamer of this kind: the path before it, and the node. */
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
  /** A meeting with a roamer of this kind, on this map or (when its roamers can't be met) another map of the act. */
  const meetSomewhere = (kind) => {
    for (let k = 0; k < 40; k++) {
      const m = findMeet(kind);
      if (m) return m;
      run.mapSeed = (run.mapSeed + 7919) >>> 0;
      run.enterAct(run.actIndex);
    }
    return null;
  };
`;
const extras = (page: Page, body: string) => page.evaluate(`(() => { const x = window.__cq3.app; ${EXTRAS}; ${body} })()`);

test('map extras: an ambush, the merchant, Coin Rush, a bounty and its tracker, the secret cache, the world skirmish', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await ready(page);
  const a = app(page);
  const phase = () => a((x) => x.run.phase);
  const tapRect = async (r: { x: number; y: number; w: number; h: number }) => tapGame(page, r.x + r.w / 2, r.y + r.h / 2);
  const winFight = async () => {
    for (let k = 0; k < 12; k++) {
      const done = await a((x) => {
        const c = x.run.combat;
        if (!c || c.result) return true;
        for (const e of c.enemies) if (e.alive) (e.uses = e.uses.map(() => 1)), (e.hp = 1);
        c.stacks = Math.max(1, c.stacks);
        x.finisher();
        return false;
      });
      if (done) break;
      await page.waitForTimeout(1600);
    }
  };
  /** Through the loot and the pick, back to the map (or wherever the pick leads). */
  const collect = async () => {
    await expect.poll(phase, { timeout: 15_000 }).toMatch(/loot|boost|map/);
    for (let i = 0; i < 8 && (await phase()) === 'loot'; i++) {
      await tapGame(page, 163, 75);
      await page.waitForTimeout(700);
    }
    if ((await phase()) === 'boost') {
      await page.waitForTimeout(700);
      await tapRect((await a((x) => x.view.overlays.cardRect(0))) as Any);
      await expect.poll(phase).not.toBe('boost');
    }
  };
  await a((x) => {
    x.startRegion();
    x.run.skipScenes();
  });
  await expect.poll(phase).toBe('map');

  // an ambush: a tap on the node a pack would meet Rowan on; its foes join the fight
  const at = (await extras(
    page,
    `const m = meetSomewhere('pack'); x.setPhase(() => { run.path = m.prefix; run.phase = 'map'; }); return { node: m.node, pos: x.view.mapView.pos(run.map.nodes[m.node]), own: run.map.nodes[m.node].waves.length, pack: run.roamFor().roamers.find((r) => r.kind === 'pack' && (r.at === m.node || r.next === m.node)).waves.length };`,
  )) as { node: number; pos: [number, number]; own: number; pack: number };
  await page.waitForTimeout(500);
  await tapGame(page, at.pos[0], at.pos[1]);
  await expect.poll(phase, { timeout: 5000 }).toBe('fight');
  expect(await a((x) => !!x.run.ambush)).toBe(true);
  expect(await a((x) => x.run.combat.waves.length)).toBe(at.own + at.pack);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/ambush.png' });
  await a((x) => x.begin());
  await winFight();
  await collect();
  expect(await a((x) => x.run.roamFor().roamers.filter((r: Any) => r.kind === 'pack').length)).toBe(0); // Act 1's one pack is gone

  // the merchant: her small shop, then the node's own stop
  await extras(page, `x.setPhase(() => run.retry()); const m = meetSomewhere('merchant'); x.setPhase(() => { run.path = m.prefix; run.phase = 'map'; run.coins = 400; run.chooseNode(m.node); });`);
  await expect.poll(phase).toBe('shop');
  expect(await a((x) => x.run.merchant)).toBe(true);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/merchant.png' });
  await a((x) => x.setPhase(() => x.run.leaveShop()));
  expect(await a((x) => x.run.merchant)).toBe(false);

  // (from here on the map has no roamers: the walks go straight to the stops)
  await extras(page, `x.tuning.roam.packsFirst = x.tuning.roam.packsLast = x.tuning.roam.merchant = 0; x.setPhase(() => { run.enterAct(0); run.skipScenes(); });`);
  // Coin Rush (on a short clock): taps knock coins out of the sack; time's up, back to the map with them
  await extras(page, `x.tuning.rush.sec = 3; x.setPhase(() => run.retry()); const id = run.extras.rush[0]; const p = clearPath(id); x.setPhase(() => { run.path = p.slice(0, -1); run.phase = 'map'; run.chooseNode(id); });`);
  await expect.poll(phase).toBe('fight');
  expect(await a((x) => x.run.rushing)).toBe(true);
  const coins = (await a((x) => x.run.coins)) as number;
  await a((x) => x.begin());
  for (let i = 0; i < 10; i++) {
    await a((x) => x.barTap(performance.now()));
    await page.waitForTimeout(140);
  }
  await page.screenshot({ path: 'test-results/rush.png' });
  await expect.poll(phase, { timeout: 10_000 }).toBe('map');
  expect(await a((x) => x.run.coins)).toBeGreaterThanOrEqual(coins);
  expect(await a((x) => x.run.node.type)).toBe('rush');

  // a bounty: the board's Take it, then the tracker on the map
  await extras(page, `x.setPhase(() => run.retry()); const id = run.extras.bounty[0]; const p = clearPath(id); x.setPhase(() => { run.path = p.slice(0, -1); run.phase = 'map'; run.chooseNode(id); });`);
  await expect.poll(phase).toBe('bounty');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/bounty.png' });
  await tapRect((await a((x) => x.view.stops.button(0))) as Any);
  await expect.poll(phase).toBe('map');
  expect(await a((x) => x.run.quest?.n)).toBe(0);
  await page.waitForTimeout(500);
  expect(await a((x) => x.view.mapView.roam.trackerRect())).not.toBeNull();

  // the secret: standing at its node, the rock lights up; a tap opens the cache
  await extras(page, `x.setPhase(() => run.retry()); const id = run.extras.secret; const p = clearPath(id, true); x.setPhase(() => { run.path = p; run.phase = 'map'; });`);
  await page.waitForTimeout(600);
  const rock = (await a((x) => x.view.mapView.roam.secretRect())) as Any;
  expect(rock).not.toBeNull();
  await tapRect(rock);
  await expect.poll(phase).toBe('treasure');
  expect(await a((x) => x.run.treasure.secret)).toBe(true);
  for (let i = 0; i < 6 && (await phase()) === 'treasure'; i++) {
    await tapGame(page, 163, 100);
    await page.waitForTimeout(700);
  }
  await collect();
  expect(await a((x) => x.run.secretFound)).toBe(true);

  // the world map: a wandering foe on the road; its card; Fight: a skirmish, then back to the world map
  await a((x) => {
    x.profile.actsCleared = 1;
    x.profile.wander.fights = 99;
    x.newRun();
  });
  await expect.poll(phase).toBe('world');
  await page.waitForTimeout(500);
  const foe = (await a((x) => x.view.worldMap.roam.foeRect())) as Any;
  expect(foe).not.toBeNull();
  await tapRect(foe);
  await page.waitForTimeout(400);
  expect(await a((x) => x.view.worldMap.roam.open)).toBe(true);
  await page.screenshot({ path: 'test-results/skirmish-card.png' });
  await tapRect((await a((x) => x.view.worldMap.roam.btn(0))) as Any);
  await expect.poll(phase).toBe('fight');
  expect(await a((x) => !!x.run.skirmish)).toBe(true);
  expect(await a((x) => x.profile.wander)).toEqual({ fights: 0, n: 1, up: false });
  await a((x) => x.begin());
  await winFight();
  await collect();
  await expect.poll(phase).toBe('world');
  expect(await a((x) => x.run.wanderer)).toBeNull();
  expect(errors).toEqual([]);
});

test.describe('updates', () => {
  // (the page's own requests, not the service worker's: it lets version.txt through to the network anyway)
  test.use({ serviceWorkers: 'block' });
  test('back in front, a newer deploy reloads the app (never mid-fight); the same build stays', async ({ page }) => {
    let live = '';
    await page.route('**/version.txt*', (r) => r.fulfill({ status: 200, contentType: 'text/plain', body: live }));
    await ready(page);
    const a = app(page);
    let loads = 0;
    page.on('load', () => loads++);
    const backInFront = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    // the build it runs: the gear panel's foot says
    await page.click('#btn-gear');
    live = (await page.evaluate(() => [...document.querySelectorAll('.dbg-foot')].map((e) => e.textContent ?? '').find((t) => t.startsWith('Build '))!.replace(/^Build /, ''))) as string;
    await page.click('#btn-gear');
    expect(live).toMatch(/^([0-9a-f]{7}|dev) /);
    // the same build deployed: nothing happens
    await backInFront();
    await page.waitForTimeout(500);
    expect(loads).toBe(0);
    // a newer one, mid-fight: it waits
    await a((x) => {
      x.startRegion();
      x.storySkip();
      x.storySkip();
      x.setPhase(() => x.run.chooseNode(x.run.choices()[0]));
    });
    live = 'abcdef0 Jan 1 00:00 UTC';
    await backInFront();
    await page.waitForTimeout(500);
    expect(loads).toBe(0);
    // ...and on the map it reloads, the run saved: Continue is offered
    await a((x) => x.setPhase(() => x.run.retry()));
    await expect.poll(() => a((x) => x.run.phase)).toBe('map');
    await Promise.all([page.waitForEvent('load'), backInFront()]);
    await page.waitForFunction(() => (window as Any).__cq3?.ready === true);
    expect(await a((x) => ({ phase: x.run.phase, saved: !!x.savedRun }))).toEqual({ phase: 'title', saved: true });
  });
});
