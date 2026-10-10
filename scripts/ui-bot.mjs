// A bot that plays the built game through its own screens, hunting crashes, stuck screens and text problems (team 4,
// run by hand; never in CI):
//   npm run build && npx vite preview --port 4177 --strictPort &
//   node scripts/ui-bot.mjs [minutes=3] [runs=1]     (URL=http://localhost:4177/cq3/ HEADED=1 SHOTS=dir)
// Each run starts from a fresh save at the phone's size with tips on, and plays on: the keyboard's defaults move
// every menu on (Enter: Continue, the first map node, the first card, Next...; Escape leaves the camp), and in fights
// an in-page player taps when the cursor sits on a block worth tapping (never a purple), fires the finisher when it's
// ready and holds a hold to its end. It reports page errors, console errors, a screen that doesn't change for 40 s
// (a softlock), the numbers safety net's violations (long decimals on screen) and foes drawn without a map sprite.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const URL = process.env.URL ?? 'http://localhost:4177/cq3/';
const MINUTES = Number(process.argv[2] ?? 3);
const RUNS = Number(process.argv[3] ?? 1);
const SHOTS = process.env.SHOTS ?? '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

/** The in-page fight player: a rAF loop that taps through app.barTap at the frame's time (a little human slop). */
const PLAYER = () => {
  const w = window;
  if (w.__bot) return;
  w.__bot = { taps: 0, fins: 0 };
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
      // let go once the cursor is past the hold's far end (or it's gone)
      const b = c.blocks.find((q) => q.id === holding.id);
      if (!b || !c.holding) holding = null;
      return;
    }
    if (c.finisherReady && Math.random() < 0.05) {
      x.finisher();
      w.__bot.fins++;
      return;
    }
    if (now - lastTap < 110) return;
    const p = c.cursorPos();
    for (const b of c.blocks) {
      if (Math.abs(p - b.pos) > b.width / 2) continue;
      if (b.kind === 'hold') {
        const r = x.barTap(now);
        lastTap = now;
        w.__bot.taps++;
        if (r?.outcome === 'hold') holding = { id: b.id };
        return;
      }
      if (!good.has(b.kind) || Math.random() < 0.15) return; // (a 85%-ish player)
      x.barTap(now);
      lastTap = now;
      w.__bot.taps++;
      return;
    }
  };
  requestAnimationFrame(loop);
};

async function playOnce(browser, run) {
  const ctx = await browser.newContext({ viewport: { width: 874, height: 402 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  await page.goto(URL);
  await page.waitForFunction(() => window.__cq3?.ready === true, null, { timeout: 120_000 });
  await page.evaluate(PLAYER);
  const ev = (s) => page.evaluate(`(() => { const x = window.__cq3.app; ${s} })()`);
  const until = Date.now() + MINUTES * 60_000;
  let last = '';
  let lastChange = Date.now();
  const seen = new Map();
  while (Date.now() < until) {
    const st = await ev(
      `const c = x.run.combat; return { phase: x.run.phase, act: x.run.actIndex, story: x.storyOverlay, tip: x.tipUp, camp: x.view?.camp?.mode, tick: c?.tick ?? 0, foes: c ? c.enemies.map((e) => Math.round(e.hp)).join(',') : '', begin: x.awaitingBegin, paused: x.userPaused };`,
    );
    const key = JSON.stringify(st);
    // progress: the phase, the screen, a fight's foes' HP (a fight's ticks alone don't count: a stuck fight still ticks)
    const sig = `${st.phase}|${st.act}|${st.story}|${st.tip}|${st.camp}|${st.foes}|${st.begin}`;
    if (sig !== last) {
      last = sig;
      lastChange = Date.now();
    } else if (Date.now() - lastChange > 40_000) {
      problems.push(`stuck 40 s: ${key}`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/stuck-${run}-${Date.now()}.png` });
      lastChange = Date.now();
    }
    seen.set(st.phase, (seen.get(st.phase) ?? 0) + 1);
    // move the menus on with the keyboard's defaults (the fight plays itself in the page)
    if (st.phase === 'camp' && !st.story) await page.keyboard.press(st.camp === 'home' ? 'Escape' : 'Escape');
    else if (st.phase === 'fight' && !st.begin && !st.tip && !st.story && !st.paused) {
      /* the in-page player */
    } else await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
  }
  const end = await ev(
    'return { textViolations: [...(window.__cq3.textViolations ?? [])], miniMisses: [...(window.__cq3.miniMisses ?? [])], bot: window.__bot, acts: x.profile.actsCleared, level: x.run.hero.level, phase: x.run.phase };',
  );
  if (end.textViolations.length) problems.push(`long decimals on screen: ${end.textViolations.slice(0, 5).join(' | ')}`);
  if (end.miniMisses.length) problems.push(`foes with no map sprite: ${end.miniMisses.join(', ')}`);
  await ctx.close();
  return { run, problems, phases: Object.fromEntries(seen), end };
}

const browser = await chromium.launch({ headless: !process.env.HEADED, args: ['--autoplay-policy=no-user-gesture-required'] });
let bad = 0;
for (let r = 1; r <= RUNS; r++) {
  const res = await playOnce(browser, r);
  bad += res.problems.length;
  console.log(`run ${r}: ${res.end.acts} acts cleared, now ${res.end.phase}; taps ${res.end.bot?.taps ?? 0}, finishers ${res.end.bot?.fins ?? 0}`);
  console.log(`  screens visited (samples): ${JSON.stringify(res.phases)}`);
  for (const p of res.problems) console.log(`  PROBLEM ${p}`);
}
await browser.close();
console.log(bad ? `${bad} problem(s)` : 'no problems');
process.exit(bad ? 1 : 0);
