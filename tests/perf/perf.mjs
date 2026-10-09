// Load time and frame times at iPhone-like settings, run by hand (docs/perf.md):
//   npm run build && npx vite preview --port 4177 &   then   node tests/perf/perf.mjs [runs]
// (URL=http://localhost:4177/cq3/ by default.) Chrome DevTools Protocol: the CPU slowed 4x and a "Fast 4G" network
// (165 ms latency, 9 Mbps down, 1.5 Mbps up, the DevTools preset's numbers), a fresh cache each load. It prints the
// built chunks' sizes (raw and gzip), the time to the title being ready for a tap, the time to the first fight (as
// fast as the screens take input, through the app's own calls), and the frame times over 10 s of a fight (Space taps
// every 140 ms) and of the world map (panned with drags). Each load measure is the median of `runs` (default 3).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const URL = process.env.URL ?? 'http://localhost:4177/cq3/';
const RUNS = Number(process.argv[2] ?? 3);
const CPU = Number(process.env.CPU ?? 4);
const NET = { offline: false, latency: 165, downloadThroughput: (9e6 / 8) * 0.9, uploadThroughput: (1.5e6 / 8) * 0.9 };

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function bundle() {
  const dir = 'dist/assets';
  const rows = readdirSync(dir)
    .filter((f) => /\.(js|css)$/.test(f))
    .map((f) => {
      const buf = readFileSync(join(dir, f));
      return { f, raw: statSync(join(dir, f)).size, gz: gzipSync(buf, { level: 9 }).length };
    })
    .sort((a, b) => b.raw - a.raw);
  console.log('\n## Bundle (dist/assets)\n\n| chunk | raw | gzip |\n|---|---|---|');
  for (const r of rows) console.log(`| ${r.f} | ${kb(r.raw)} | ${kb(r.gz)} |`);
  const t = rows.reduce((a, r) => ({ raw: a.raw + r.raw, gz: a.gz + r.gz }), { raw: 0, gz: 0 });
  console.log(`| **total** | **${kb(t.raw)}** | **${kb(t.gz)}** |`);
}

/** A page with the throttles on (a fresh context: nothing cached). */
async function throttled(browser) {
  const ctx = await browser.newContext({ viewport: { width: 874, height: 402 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', NET);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  // the moment the scene is ready (the title takes taps), from navigation start
  await page.addInitScript(() => {
    const w = window;
    const poll = () => {
      if (w.__cq3?.ready === true) w.__perfReady = performance.now();
      else requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });
  return { ctx, page, cdp };
}

async function loadOnce(browser) {
  const { ctx, page } = await throttled(browser);
  await page.goto(URL, { waitUntil: 'commit' });
  await page.waitForFunction(() => typeof window.__perfReady === 'number', null, { timeout: 120_000, polling: 50 });
  const ready = await page.evaluate(() => window.__perfReady);
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd };
  });
  // into the first fight as fast as the screens let us: a new run, the region's intro skipped, the first node
  await page.evaluate(() => {
    const x = window.__cq3.app;
    x.profile.tipsOff = true;
    x.profile.worldTour = true;
    x.newRun();
  });
  await page.waitForFunction(() => window.__cq3.app.run.phase === 'world', null, { polling: 20 });
  await page.evaluate(() => window.__cq3.app.startRegion());
  for (let i = 0; i < 40; i++) {
    const ph = await page.evaluate(() => {
      const x = window.__cq3.app;
      if (x.run.phase === 'scene' || x.storyOverlay) x.storySkip();
      if (x.run.phase === 'map' && performance.now() - x.phaseSince > 320) x.view.chooseNode(x.run.choices()[0]);
      return x.run.phase;
    });
    if (ph === 'fight') break;
    await page.waitForTimeout(50);
  }
  await page.waitForFunction(() => window.__cq3.app.run.phase === 'fight', null, { polling: 20, timeout: 60_000 });
  const fight = await page.evaluate(() => performance.now());
  await ctx.close();
  return { ready, fight, dcl: nav.dcl, load: nav.load };
}

/** Frame times (ms) over `secs` while `drive` runs. */
async function frames(page, secs, drive) {
  await page.evaluate(() => {
    const w = window;
    w.__ft = [];
    let last = performance.now();
    const f = (t) => {
      w.__ft.push(t - last);
      last = t;
      if (!w.__ftStop) requestAnimationFrame(f);
    };
    w.__ftStop = false;
    requestAnimationFrame(f);
  });
  const until = Date.now() + secs * 1000;
  while (Date.now() < until) await drive();
  const ft = await page.evaluate(() => {
    window.__ftStop = true;
    return window.__ft.slice(2);
  });
  const s = [...ft].sort((a, b) => a - b);
  const pct = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  const mean = ft.reduce((a, b) => a + b, 0) / ft.length;
  return { n: ft.length, fps: 1000 / mean, mean, p50: pct(0.5), p95: pct(0.95), p99: pct(0.99), max: s[s.length - 1], over20: ft.filter((d) => d > 20).length / ft.length, over33: ft.filter((d) => d > 34).length / ft.length };
}

async function frameRuns(browser) {
  const { ctx, page } = await throttled(browser);
  await page.goto(URL);
  await page.waitForFunction(() => window.__cq3?.ready === true, null, { timeout: 120_000 });
  await page.evaluate(() => {
    const x = window.__cq3.app;
    x.profile.tipsOff = true;
    x.profile.worldTour = true;
    x.settings.godMode = true;
    x.setPhase(() => x.run.debugFight(1, ['boar', 'archer', 'shaman'], 'fight', x.run.hero));
    x.begin();
  });
  await page.waitForTimeout(1500);
  const fight = await frames(page, 10, async () => {
    await page.keyboard.press('Space');
    await page.waitForTimeout(140);
  });
  await page.evaluate(() => {
    const x = window.__cq3.app;
    x.settings.godMode = false;
    x.toWorld();
  });
  await page.waitForTimeout(2500);
  let dir = 1;
  const world = await frames(page, 10, async () => {
    await page.mouse.move(437, 200);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(437 + dir * i * 30, 200 - dir * i * 5);
    await page.mouse.up();
    dir = -dir;
    await page.waitForTimeout(400);
  });
  await ctx.close();
  return { fight, world };
}

const fmt = (r) => `${r.fps.toFixed(1)} fps | ${r.p50.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.p99.toFixed(1)} | ${r.max.toFixed(0)} | ${(r.over20 * 100).toFixed(1)}% | ${(r.over33 * 100).toFixed(1)}%`;

bundle();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const loads = [];
for (let i = 0; i < RUNS; i++) loads.push(await loadOnce(browser));
console.log(`\n## Load (CPU ${CPU}x, Fast 4G, no cache; median of ${RUNS})\n\n| measure | ms |\n|---|---|`);
console.log(`| DOMContentLoaded | ${median(loads.map((l) => l.dcl)).toFixed(0)} |`);
console.log(`| load event | ${median(loads.map((l) => l.load)).toFixed(0)} |`);
console.log(`| title ready for a tap | ${median(loads.map((l) => l.ready)).toFixed(0)} |`);
console.log(`| first fight on screen | ${median(loads.map((l) => l.fight)).toFixed(0)} |`);
console.log(`(each run: ${loads.map((l) => `${l.ready.toFixed(0)}/${l.fight.toFixed(0)}`).join(', ')})`);
const fr = await frameRuns(browser);
console.log(`\n## Frames over 10 s (CPU ${CPU}x)\n\n| scene | rate | p50 ms | p95 ms | p99 ms | max ms | > 20 ms | > 34 ms |\n|---|---|---|---|---|---|---|---|`);
console.log(`| fight (Space every 140 ms) | ${fmt(fr.fight)} |`);
console.log(`| world map (dragged) | ${fmt(fr.world)} |`);
await browser.close();
