// Every foe that stands on a map is drawn as its own mini (src/engine/art-minis.ts), never as the crossed swords: the
// later regions' act maps (their fight, elite and boss nodes and the packs roaming them) and the world map's wandering
// foe from a later act (on the road and on its skirmish card). art-minis.ts records any sprite drawn without a mini
// in `window.__cq3.miniMisses`. Playtest round 7: the second region's act maps showed swords for every foe.
import { expect, test, type Page } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const app = (page: Page) => (fn: (a: Any) => unknown) => page.evaluate(`(${fn.toString()})(window.__cq3.app)`);
const misses = (page: Page) => page.evaluate(() => (window as Any).__cq3.miniMisses as string[]);

async function ready(page: Page): Promise<void> {
  await page.goto('/cq3/');
  await page.waitForFunction(() => (window as Any).__cq3?.ready === true);
  await page.evaluate(() => {
    const p = (window as Any).__cq3.app.profile;
    p.tipsOff = true;
    p.worldTour = true;
  });
}

test("the later regions' act maps and the world map's wandering foe: every foe drawn as its own mini", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await ready(page);
  const a = app(page);
  // acts 4-9 (the second region's three, the third's three), two maps each: every foe on them, its packs too
  for (const act of [3, 4, 5, 6, 7, 8])
    for (const k of [0, 1]) {
      const shown = (await page.evaluate(
        ({ act, k }) => {
          const x = (window as Any).__cq3.app;
          const run = x.run;
          x.setPhase(() => {
            run.newRun();
            run.skipScenes();
            run.mapSeed = (run.mapSeed + k * 7919) >>> 0;
            run.enterAct(act);
            run.skipScenes();
          });
          const keys = [...run.map.nodes.flatMap((n: Any) => n.enemies), ...(run.extras?.roamers ?? []).flatMap((r: Any) => r.waves.flat())];
          return { phase: run.phase, act: run.actIndex, sprites: [...new Set(keys.map((key: string) => x.tuning.enemies[key].sprite))] };
        },
        { act, k },
      )) as { phase: string; act: number; sprites: string[] };
      expect(shown.phase).toBe('map');
      expect(shown.act).toBe(act);
      expect(shown.sprites.length, `act ${act + 1}`).toBeGreaterThan(2);
      await page.waitForTimeout(500); // a few frames: every node, the boss at its lair, the roamers
      expect(await misses(page), `act ${act + 1}: foes drawn as the crossed swords`).toEqual([]);
      // and their minis are real textures (painted at boot)
      const missing = (await page.evaluate((sprites) => sprites.filter((s) => !(window as Any).__cq3.app.view.textures.exists(`mfoe_${s}_0`)), shown.sprites)) as string[];
      expect(missing, `act ${act + 1}`).toEqual([]);
    }

  // the world map's wandering foe from a later act: on the road, then its skirmish card (one mini per foe)
  for (const region of [1, 2]) {
    await a((x) => {
      x.profile.actsCleared = 9;
      x.profile.weights = 2;
      x.profile.seen.push('unveil:frostpeaks', 'unveil:ashfell'); // (their reveals already played)
      x.profile.wander.up = true;
    });
    const act = (await page.evaluate((region) => {
      const x = (window as Any).__cq3.app;
      // the wandering foe that comes next follows from how many came before: find one from this region's acts
      for (let n = 0; n < 400; n++) {
        x.profile.wander.n = n;
        const w = x.run.wanderer;
        if (w && w.act >= region * 3 && w.act < region * 3 + 3) return w.act;
      }
      return -1;
    }, region)) as number;
    expect(act, `a wandering foe from region ${region + 1}`).toBeGreaterThanOrEqual(region * 3);
    await a((x) => x.newRun());
    await expect.poll(() => a((x) => x.run.phase)).toBe('world');
    await a((x) => {
      const r = x.view.worldMap.roam.foeRect();
      x.view.worldMap.lookAt(r.x + r.w / 2 + x.view.worldMap.camera().x, r.y + r.h / 2 + x.view.worldMap.camera().y);
    });
    await page.waitForTimeout(400);
    const foe = (await a((x) => x.view.worldMap.roam.foeRect())) as Any;
    expect(foe).not.toBeNull();
    await a((x) => {
      const r = x.view.worldMap.roam.foeRect();
      x.view.worldMap.roam.tap(r.x + r.w / 2, r.y + r.h / 2);
    });
    await page.waitForTimeout(500);
    expect(await a((x) => x.view.worldMap.roam.open)).toBe(true);
    expect(await misses(page), `the wandering foe from act ${act + 1}`).toEqual([]);
    await a((x) => x.setPhase(() => (x.run.phase = 'title')));
  }

  // the check itself: a foe whose sprite has no mini is caught (recorded, and still drawn: as the crossed swords)
  await page.evaluate(() => {
    const x = (window as Any).__cq3.app;
    for (const k of ['rimeImp', 'yetiCub', 'icicleBat']) x.tuning.enemies[k].sprite = 'no-mini-yet';
    x.setPhase(() => {
      x.run.newRun();
      x.run.skipScenes();
      x.run.enterAct(3);
      x.run.skipScenes();
    });
  });
  await page.waitForTimeout(500);
  expect(await misses(page)).toEqual(['no-mini-yet']);
  expect(errors).toEqual([]);
});
