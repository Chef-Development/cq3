// The boot check (the lead's, round 8), kept in the repo so CI can run it after the build: the built game boots at
// phone and desktop size with no page errors and reaches the title, the world map and the first story box.
//   npx vite preview --port 4173 --strictPort &   then   node scripts/boot-check.mjs 4173     (npm run boot-check -- 4173)
import { chromium } from '@playwright/test';
const port = process.argv[2] ?? '4190';
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
let bad = 0;
for (const [name, opt] of [['phone', { viewport: { width: 874, height: 402 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }], ['desk', { viewport: { width: 1440, height: 900 } }]]) {
  const ctx = await b.newContext(opt);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  try {
    await page.goto(`http://localhost:${port}/cq3/`);
    await page.waitForFunction(() => window.__cq3?.ready === true, null, { timeout: 90000 });
    await page.evaluate(() => { const p = window.__cq3.app.profile; p.tipsOff = true; p.worldTour = true; });
    await page.waitForTimeout(1500);
    const tap = async (x, y) => { const l = await page.evaluate('window.__cq3.app.layout'); await page.mouse.click(l.left + (x * l.cssW) / 327, l.top + (y * l.cssH) / 150); };
    await tap(163, 75);
    await page.waitForFunction(() => window.__cq3.app.run.phase === 'world', null, { timeout: 20000 });
    await page.waitForTimeout(800);
    const gm = await page.evaluate(() => window.__cq3.app.view.worldMap.greenmarch());
    await tap(gm.x, gm.y);
    await page.waitForFunction(() => window.__cq3.app.run.phase === 'scene', null, { timeout: 20000 });
  } catch (e) { errs.push('FLOW: ' + e.message.split('\n')[0]); }
  console.log(name, errs.length ? 'ERRORS: ' + errs.slice(0, 5).join(' | ') : 'ok');
  if (errs.length) bad++;
  await ctx.close();
}
await b.close();
process.exit(bad ? 1 : 0);
