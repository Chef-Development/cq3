// The art audit (docs/art-audit/README.md): renders a contact sheet of every texture group the game paints (sprites,
// portraits, backdrops per act, maps, icons, UI) and screenshots of the main screens, so each can be scored against
// the art bible (docs/art-style.md). Not part of any test suite: run it by hand against a running server.
//
//   npx vite --port 4175 --strictPort &            # or any dev/preview server serving /cq3/
//   PORT=4175 node scripts/art-audit.mjs           # writes docs/art-audit/now/*.png
//   PORT=4175 OUT=docs/art-audit/after node scripts/art-audit.mjs sheets   # only the sheets ('screens' for screens)
//   GROUP=icons-skills ... sheets                   # one sheet
//
// Sheets: every texture of a group on a neutral ground at a whole-number scale, labelled by key (one frame per key; a
// group too big for one sheet is split). Screens: the game at phone size (874x402 CSS px), shown at 1x per screen.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const PORT = Number(process.env.PORT ?? 4175);
const OUT = (process.env.OUT ?? 'docs/art-audit/now').replace(/\/$/, '');
const only = process.argv[2] ?? 'all';
mkdirSync(OUT, { recursive: true });

const HEROES = ['hero', 'sable', 'neve', 'moss', 'tam', 'hollis', 'vesper', 'torva', 'solenne', 'wren', 'yara', 'dell', 'gorm', 'tess', 'fizz', 'brann'];
const GREEN = ['slime', 'slimelet', 'bigslime', 'boar', 'piglet', 'bandit', 'crow', 'archer', 'shaman', 'wolf', 'beetle', 'knight', 'captain', 'golem', 'boarking', 'rumbleback', 'rumbleback2', 'hobnob', 'dummy', 'coinsack'];
const FROST = ['rimeimp', 'iciclebat', 'yeticub', 'snowogre', 'frostweaver', 'icewraith', 'hailcaller', 'glaciertortoise', 'drifttroll', 'aurorawisp', 'frostknight', 'rimehorn', 'matron', 'glacia', 'glacia2', 'glacia3'];
const ASH = ['cinderling', 'cinderkite', 'cragcrab', 'obsidianox', 'glassblower', 'prismbat', 'glassmantis', 'kilnwarden', 'stokerimp', 'magmaeel', 'forgehand', 'chainsentinel', 'bellows', 'bellows2', 'bellows3'];
const pre = (names) => new RegExp(`^(${names.join('|')})_(idle0|idle1|windup|attack|hurt|dead|.*)$`);

/** Sheet groups: a name, which keys, the scale, and the sheet's width in px. Order = the README's order. */
const GROUPS = [
  { name: 'heroes-a', re: pre(HEROES.slice(0, 8)), scale: 2, width: 1400 },
  { name: 'heroes-b', re: pre(HEROES.slice(8)), scale: 2, width: 1400 },
  { name: 'foes-greenmarch', re: pre(GREEN), scale: 2, width: 1400 },
  { name: 'foes-frostpeaks', re: pre(FROST), scale: 1, width: 1400 },
  { name: 'foes-ashfell', re: pre(ASH), scale: 1, width: 1400 },
  { name: 'companions-allies', re: /^(comp_|pip_|ally_|mpip)/, scale: 2, width: 1400 },
  { name: 'portraits', re: /^(portrait_|camp_|smith_)/, scale: 2, width: 1400 },
  { name: 'map-sprites', re: /^(mfoe_|m(row|sab|neve|moss|tam|hollis|vesper|torva|solenne|wren|yara|dell|gorm|tess|fizz|brann)_|mn_|maplair_|mapicon_|flag_|ma_|life_|padlock)/, scale: 3, width: 1400 },
  { name: 'icons-skills', re: /^skill_/, scale: 3, width: 1400 },
  { name: 'icons-relics-items', re: /^(relic_|item_|tag_|keg_|rarity_|icicle_|ember_|mirror_|glass_)/, scale: 3, width: 1400 },
  { name: 'backdrops', re: /^(bg_|frame_)/, scale: 1, width: 1340 },
  { name: 'stage-light', re: /^(st_grade|st_rays|fg_\w+_0$|clouds)/, scale: 1, width: 1340 },
  { name: 'world-map', re: /^world_map$/, scale: 1, width: 980 },
  { name: 'world-pieces', re: /^wm_(?!sea\d)/, scale: 1, width: 1400 },
  { name: 'ui-chrome', re: /^(panel|barframe|logo$|crest|chest_|hchest_|shrine_|vault_|title_)/, scale: 2, width: 1400 },
];

/** Screens: a name and what to run in the page (x = the app) before the shot, and how long to wait. */
const SCREENS = [
  { name: 'title', js: '', wait: 1600 },
  { name: 'world', js: 'x.newRun()', wait: 1800 },
  { name: 'map-act1', js: 'x.setPhase(() => { x.run.newRun(); x.run.skipScenes(); })', wait: 1200 },
  { name: 'map-act4', js: 'x.setPhase(() => { x.run.newRun(); x.run.skipScenes(); x.run.enterAct(3); x.run.skipScenes(); })', wait: 1200 },
  { name: 'map-act7', js: 'x.setPhase(() => { x.run.newRun(); x.run.skipScenes(); x.run.enterAct(6); x.run.skipScenes(); })', wait: 1200 },
  ...[
    [0, 'slime'],
    [1, 'archer'],
    [2, 'boarKing'],
    [3, 'rimeImp'],
    [4, 'frostWeaver'],
    [5, 'glacia'],
    [6, 'cinderling'],
    [7, 'glassMantis'],
    [8, 'bellows'],
  ].map(([act, foe]) => ({
    name: `fight-act${act + 1}`,
    js: `x.setPhase(() => x.run.debugFight(${act}, ['${foe}'], 'fight', x.run.hero))`,
    wait: 1500,
  })),
  { name: 'camp', js: 'x.newRun(); x.openCamp()', wait: 1500 },
  { name: 'heroes', js: "x.newRun(); x.openCamp(); x.view.camp.go('heroes', performance.now(), 'rowan')", wait: 1500 },
  { name: 'companions', js: "x.newRun(); x.openCamp(); x.view.camp.go('pets', performance.now(), undefined, 'pip')", wait: 1500 },
  { name: 'shrine', js: "x.newRun(); x.openCamp(); x.view.camp.go('shrine', performance.now())", wait: 1500 },
  { name: 'vault', js: "x.newRun(); x.openCamp(); x.view.camp.go('chests', performance.now())", wait: 1500 },
  { name: 'progress', js: "x.newRun(); x.openCamp(); x.view.camp.go('progress', performance.now()); x.view.camp.progress.open(performance.now(), 0)", wait: 1500 },
  { name: 'story', js: "x.setPhase(() => { x.run.newRun(); })", wait: 1500 },
];

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

async function open(o = {}) {
  const ctx = await browser.newContext({ viewport: { width: 874, height: 402 }, deviceScaleFactor: o.dpr ?? 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  page error:', e.message));
  await page.addInitScript((profile) => {
    try {
      localStorage.clear();
      if (profile) localStorage.setItem('cq3.profile.v2', JSON.stringify(profile));
    } catch {
      /* ignore */
    }
  }, o.profile ?? null);
  await page.goto(`http://localhost:${PORT}/cq3/`);
  for (let i = 0; i < 300; i++) {
    if (await page.evaluate(() => window.__cq3?.ready === true)) break;
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => {
    const p = window.__cq3.app.profile;
    p.tipsOff = true;
    p.worldTour = true;
  });
  return { ctx, page };
}

async function sheets() {
  const { ctx, page } = await open();
  // everything painted lazily: the world, the third region, every fight backdrop
  await page.evaluate(() => {
    const s = window.__cq3.app.view;
    s.ensureWorldArt?.();
    s.ensureAshArt?.();
    for (const t of ['pass', 'caves', 'glacier', 'cinder', 'glass', 'forge']) s.stage.ensure(t);
  });
  for (const gr of GROUPS.filter((g) => !process.env.GROUP || g.name === process.env.GROUP)) {
    const url = await page.evaluate(
      ({ src, flags, scale, width, name }) => {
        const re = new RegExp(src, flags);
        const tm = window.__cq3.game.textures;
        const keys = tm.getTextureKeys().filter((k) => re.test(k)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
        if (!keys.length) return null;
        const items = keys.map((k) => {
          const img = tm.get(k).getSourceImage();
          return { k, img, w: img.width * scale, h: img.height * scale };
        });
        const pad = 6;
        const lab = 11;
        // shelf-pack the cells left to right
        let x = pad;
        let y = pad + 18;
        let rowH = 0;
        const placed = [];
        for (const it of items) {
          const cw = Math.max(it.w, 40);
          if (x + cw + pad > width) {
            x = pad;
            y += rowH + lab + pad;
            rowH = 0;
          }
          placed.push({ ...it, x, y });
          x += cw + pad;
          rowH = Math.max(rowH, it.h);
        }
        const H = y + rowH + lab + pad;
        const c = document.createElement('canvas');
        c.width = width;
        c.height = H;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#2b2838';
        ctx.fillRect(0, 0, width, H);
        ctx.fillStyle = '#e8e0f0';
        ctx.font = 'bold 13px monospace';
        ctx.fillText(`${name} (${keys.length}, x${scale})`, pad, 14);
        ctx.font = '9px monospace';
        for (const p of placed) {
          ctx.fillStyle = '#3a3650';
          ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.drawImage(p.img, p.x, p.y, p.w, p.h);
          ctx.fillStyle = '#a8a0c0';
          const short = p.k.length > Math.max(6, Math.floor(Math.max(p.w, 40) / 5.5)) ? p.k.slice(0, Math.floor(Math.max(p.w, 40) / 5.5)) : p.k;
          ctx.fillText(short, p.x, p.y + p.h + 9);
        }
        return c.toDataURL('image/png');
      },
      { src: gr.re.source, flags: gr.re.flags, scale: gr.scale, width: gr.width, name: gr.name },
    );
    if (!url) {
      console.log('  (no textures)', gr.name);
      continue;
    }
    writeFileSync(`${OUT}/sheet-${gr.name}.png`, Buffer.from(url.split(',')[1], 'base64'));
    console.log('  sheet', gr.name);
  }
  await ctx.close();
}

async function screens() {
  // a player some way in: two regions open, Sable and Neve met, the camp's first upgrades
  for (const sc of SCREENS) {
    const { ctx, page } = await open();
    await page.evaluate(() => {
      const p = window.__cq3.app.profile;
      p.allUnlocked = true;
      p.smithMet = p.sableMet = p.neveMet = true;
      p.actsCleared = Math.max(p.actsCleared, 4);
      p.weights = Math.max(p.weights, 1);
      for (const id of ['frostpeaks', 'ashfell']) if (!p.seen.includes('unveil:' + id)) p.seen.push('unveil:' + id);
      for (const id of Object.keys(p.pets)) p.pets[id].owned = true;
      p.camp = ['dummy', 'perch'];
    });
    if (sc.js) await page.evaluate(`(() => { const x = window.__cq3.app; ${sc.js}; })()`);
    await page.waitForTimeout(sc.wait);
    await page.screenshot({ path: `${OUT}/screen-${sc.name}.png` });
    console.log('  screen', sc.name);
    await ctx.close();
  }
}

if (only === 'all' || only === 'sheets') await sheets();
if (only === 'all' || only === 'screens') await screens();
await browser.close();
console.log('wrote', OUT);
