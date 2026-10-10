// The UI crawl (team 4, round 8; run by hand through the Playwright lock, never in CI):
//   npm run build && npx vite preview --port 4177 --strictPort &
//   flock /home/user/wt/.pw.lock node scripts/ui-crawl.mjs [minutes=10]      (URL=... SHOTS=dir HEADED=1 DESKTOP=1)
// Plays the real game from a fresh save (New game) through Act 1 at the phone's size: the keyboard's defaults move
// the menus on (Enter: Continue, the first node, the first card, Next...; ui-bot.mjs's way), an in-page player taps
// the bar fast (a tap at most every 110 ms, when the cursor sits on a block worth tapping, about 85% of them), fires
// the finisher when it's ready and holds holds. Once Act 1 is cleared (or the time is up) it opens the camp and visits
// every camp screen and its tabs. All along it records:
//   - page errors and console errors;
//   - the numbers safety net's violations (window.__cq3.textViolations: a long decimal drawn);
//   - foes a map drew without a mini (window.__cq3.miniMisses);
//   - missing textures: every key the game asked Phaser for that doesn't exist (drawn as Phaser's missing-texture box);
//   - text out of bounds: a bitmap text reaching past the canvas's edge, an HTML panel's text wider than its box;
//   - a screen that doesn't change for 40 s (a softlock).
// Exits 1 when it found anything.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const URL = process.env.URL ?? 'http://localhost:4177/cq3/';
const MINUTES = Number(process.argv[2] ?? 10);
const SHOTS = process.env.SHOTS ?? '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

/** In the page: the fight player (as ui-bot.mjs's, faster) and the watchers. */
const INSTALL = () => {
  const w = window;
  if (w.__crawl) return;
  const sc = w.__cq3.game.scene.getScene('fight');
  const C = (w.__crawl = { taps: 0, fins: 0, missingTex: {}, offText: {} });
  // every texture asked for that isn't there (Phaser hands back its missing-texture box)
  const tm = sc.textures;
  const get = tm.get.bind(tm);
  tm.get = (key) => {
    const t = get(key);
    if (typeof key === 'string' && key && !key.startsWith('__') && t && t.key === '__MISSING') C.missingTex[key] = (C.missingTex[key] ?? 0) + 1;
    return t;
  };
  // text past the canvas's edge (checked a few times a second)
  const scan = () => {
    const walk = (o, dx, dy) => {
      if (!o || o.visible === false || o.alpha === 0) return;
      if (o.list) for (const c of o.list) walk(c, dx + (o.x ?? 0), dy + (o.y ?? 0));
      if (o.type === 'BitmapText' && o.text && o.text.trim()) {
        const b = o.getTextBounds(true).global;
        const x0 = b.x + dx;
        const x1 = x0 + b.width;
        const y0 = b.y + dy;
        const y1 = y0 + b.height;
        if (x0 < -1 || y0 < -1 || x1 > 328 || y1 > 151) {
          const k = `${o.text.slice(0, 30)} @ ${Math.round(x0)},${Math.round(y0)} w${Math.round(b.width)}`;
          C.offText[k] = w.__cq3.app.run.phase;
        }
      }
    };
    for (const o of sc.children.list) walk(o, 0, 0);
  };
  setInterval(scan, 300);
  let lastTap = 0;
  let holding = null;
  const good = new Set(['yellow', 'red', 'green', 'shield', 'bomb', 'keg', 'frozen', 'mirror', 'speed', 'ward']);
  const loop = () => {
    requestAnimationFrame(loop);
    const x = w.__cq3?.app;
    const c = x?.run?.combat;
    if (!x || x.run.phase !== 'fight' || !c || c.result || x.userPaused || x.awaitingBegin || x.tipUp || x.storyOverlay) return;
    const now = performance.now();
    if (now < x.introUntil) return;
    if (holding) {
      const b = c.blocks.find((q) => q.id === holding.id);
      if (!b || !c.holding) holding = null;
      return;
    }
    if (c.finisherReady && Math.random() < 0.05) {
      x.finisher();
      C.fins++;
      return;
    }
    if (now - lastTap < 110) return;
    const p = c.cursorPos();
    for (const b of c.blocks) {
      if (Math.abs(p - b.pos) > b.width / 2) continue;
      if (b.kind === 'hold') {
        const r = x.barTap(now);
        lastTap = now;
        C.taps++;
        if (r?.outcome === 'hold') holding = { id: b.id };
        return;
      }
      if (!good.has(b.kind) || Math.random() < 0.15) return;
      x.barTap(now);
      lastTap = now;
      C.taps++;
      return;
    }
  };
  requestAnimationFrame(loop);
};

/** HTML panels whose text is wider than its box (the gear panel, the lab). */
const DOM_OVERFLOW = () => {
  const out = [];
  for (const el of document.querySelectorAll('#debug *, #lab *, #hud *')) {
    if (!(el instanceof HTMLElement) || !el.offsetParent || !el.textContent?.trim() || el.children.length) continue;
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'auto') out.push(`${el.closest('[id]')?.id}: "${el.textContent.trim().slice(0, 40)}" ${el.scrollWidth}>${el.clientWidth}`);
  }
  return out;
};

const desktop = !!process.env.DESKTOP;
const browser = await chromium.launch({ headless: !process.env.HEADED, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext(
  desktop ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } : { viewport: { width: 874, height: 402 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
);
const page = await ctx.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()}`);
});
const t0 = Date.now();
await page.goto(URL);
await page.waitForFunction(() => window.__cq3?.ready === true, null, { timeout: 120_000 });
// New game: a fresh save (as the title's New game leaves it)
await page.evaluate(() => {
  window.__cq3.app.newGame();
});
await page.evaluate(INSTALL);
const ev = (s) => page.evaluate(`(() => { const x = window.__cq3.app; ${s} })()`);
const until = Date.now() + MINUTES * 60_000;
let last = '';
let lastChange = Date.now();
const seen = new Map();
let shot = 0;
while (Date.now() < until) {
  const st = await ev(
    `const c = x.run.combat; return { phase: x.run.phase, act: x.run.actIndex, cleared: x.profile.actsCleared, story: x.storyOverlay, tip: x.tipUp, camp: x.view?.camp?.mode, foes: c ? c.enemies.map((e) => Math.round(e.hp)).join(',') : '', begin: x.awaitingBegin, paused: x.userPaused, node: x.run.node?.id ?? -1 };`,
  );
  if (st.cleared >= 1 && st.phase !== 'fight') break;
  const sig = `${st.phase}|${st.act}|${st.story}|${st.tip}|${st.camp}|${st.foes}|${st.begin}|${st.node}`;
  if (sig !== last) {
    last = sig;
    lastChange = Date.now();
    if (SHOTS && st.phase !== 'fight' && shot < 80) await page.screenshot({ path: `${SHOTS}/play-${String(++shot).padStart(2, '0')}-${st.phase}.png` });
  } else if (Date.now() - lastChange > 40_000) {
    problems.push(`stuck 40 s: ${JSON.stringify(st)}`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/stuck-${Date.now()}.png` });
    lastChange = Date.now();
  }
  seen.set(st.phase, (seen.get(st.phase) ?? 0) + 1);
  if (st.phase === 'camp' && !st.story) await page.keyboard.press('Escape');
  else if (st.phase === 'fight' && !st.begin && !st.tip && !st.story && !st.paused) {
    /* the in-page player */
  } else await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
}
const played = await ev('return { acts: x.profile.actsCleared, phase: x.run.phase, level: x.run.hero.level, items: x.profile.items.length, coins: x.profile.coins }');
console.log(`played ${((Date.now() - t0) / 1000).toFixed(0)} s: ${played.acts} act(s) cleared, now ${played.phase}; level ${played.level}, ${played.items} items`);

// every camp screen and its tabs
const SCREENS = [
  ['home', ''],
  ['bag', ''],
  ['forge', "c.forge.tab = 'upgrade'"],
  ['forge', "c.forge.tab = 'reroll'"],
  ['forge', "c.forge.tab = 'salvage'"],
  ['stats', "c.stats.page = 'main'", 'rowan'],
  ['stats', "c.stats.page = 'all'", 'rowan'],
  ['heroes', '', 'rowan'],
  ['skills', '', 'rowan'],
  ['relics', ''],
  ['pets', ''],
  ['chests', ''],
  ['shrine', ''],
  ['upgrades', ''],
  ['progress', 'c.progress.open(performance.now(), 0)'],
];
await ev('x.storyOverlay = null; if (x.run.phase !== "camp") x.openCamp();');
await page.waitForTimeout(1500);
await ev('x.storyOverlay = null;');
for (const [mode, then, hero] of SCREENS) {
  const before = await page.evaluate(() => ({ ...(window.__crawl.missingTex ?? {}) }));
  try {
    await ev(`const c = x.view.camp; x.storyOverlay = null; c.go('home', performance.now()); c.go('${mode}', performance.now()${hero ? `, '${hero}'` : ''}); ${then};`);
  } catch (e) {
    problems.push(`camp ${mode}: ${e.message.split('\n')[0]}`);
    continue;
  }
  await page.waitForTimeout(1100);
  const after = await page.evaluate(() => ({ ...(window.__crawl.missingTex ?? {}) }));
  const fresh = Object.keys(after).filter((k) => !(k in before));
  if (fresh.length) problems.push(`missing textures on camp ${mode}: ${fresh.join(', ')}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/camp-${mode}${then.includes("'") ? `-${then.split("'")[1]}` : ''}.png` });
}
// the gear panel (HTML)
await page.evaluate(() => document.getElementById('btn-gear')?.click());
await page.waitForTimeout(600);
const dom = await page.evaluate(DOM_OVERFLOW);
for (const d of dom) problems.push(`HTML text wider than its box: ${d}`);
if (SHOTS) await page.screenshot({ path: `${SHOTS}/gear-panel.png` });

const end = await page.evaluate(() => ({
  textViolations: [...(window.__cq3.textViolations ?? [])],
  miniMisses: [...(window.__cq3.miniMisses ?? [])],
  missingTex: window.__crawl.missingTex,
  offText: window.__crawl.offText,
  taps: window.__crawl.taps,
  fins: window.__crawl.fins,
}));
if (end.textViolations.length) problems.push(`long decimals on screen: ${end.textViolations.slice(0, 5).join(' | ')}`);
if (end.miniMisses.length) problems.push(`foes with no map sprite: ${end.miniMisses.join(', ')}`);
for (const [k, n] of Object.entries(end.missingTex)) problems.push(`missing texture: ${k} (asked ${n}x)`);
for (const [k, ph] of Object.entries(end.offText)) problems.push(`text past the canvas's edge (${ph}): ${k}`);
await browser.close();
console.log(`taps ${end.taps}, finishers ${end.fins}; screens (samples): ${JSON.stringify(Object.fromEntries(seen))}`);
const uniq = [...new Set(problems)];
for (const p of uniq) console.log(`  PROBLEM ${p}`);
console.log(uniq.length ? `${uniq.length} problem(s)` : 'no problems');
process.exit(uniq.length ? 1 : 0);
