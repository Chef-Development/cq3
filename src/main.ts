import Phaser from 'phaser';
import './style.css';
import { App } from './engine/app';
import { installDebug } from './engine/debug';
import { installInput } from './engine/input';
import { installLab } from './engine/lab';
import { installNumberGuard } from './engine/number-guard';
import { hudButtonImages } from './engine/chrome';
import { applyCanvasLayout, applyFrame, GAME_H, GAME_W } from './engine/layout';
import { FightScene } from './engine/scene';
import { MINI_MISSES } from './engine/art-minis';
import { loadRegionArt, regionArtLoaded } from './engine/region-art';
import { chestHdLoaded, loadChestHd } from './engine/view/chest-opening';
import { loadSettings, loadTuning } from './engine/storage';

// the later regions' art packs download beside the boot (region-art.ts, docs/perf.md)
void loadRegionArt();
void loadChestHd(); // (the sharper chest reveal: a chunk of its own too)

const app = new App(loadTuning(), loadSettings());

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  pixelArt: true,
  backgroundColor: '#000000',
  banner: false,
  disableContextMenu: true,
  scale: { mode: Phaser.Scale.NONE },
  input: { keyboard: false, mouse: false, touch: false, gamepad: false },
  audio: { noAudio: true },
});

game.scene.add('fight', FightScene, true, { app });
const getScene = () => game.scene.getScene('fight') as FightScene | null;

const rootStyle = document.documentElement.style;
// the quiet frame around the canvas when the window has room (desktop): layout.ts applyFrame, style.css #frame
const frame = document.createElement('div');
frame.id = 'frame';
frame.hidden = true;
document.body.insertBefore(frame, document.body.firstChild);
for (const [k, v] of Object.entries(hudButtonImages())) rootStyle.setProperty(`--img-${k}`, `url(${v})`);
/** Put the canvas (and the frame round it, and the DOM buttons' pixel size) where the current layout says. */
const place = () => {
  if (game.canvas) applyCanvasLayout(game.canvas, app.layout);
  applyFrame(frame, app.layout);
  // DOM HUD buttons are pixel art too: size them in game pixels.
  rootStyle.setProperty('--gpx', `${app.layout.scale / app.layout.dpr}px`);
  rootStyle.setProperty('--game-top', `${app.layout.top}px`);
  // the safe right edge of the game (CSS px from the window's right): the title puts the gear button in its corner
  const L = app.layout;
  rootStyle.setProperty('--game-right', `${Math.max(0, window.innerWidth - (L.left + L.cssW)) + (L.safeRight * L.cssW) / 327}px`);
};
const relayout = (force = false) => {
  if (app.relayout(force)) place();
};
// the canvas exists now: place it (the scene laid itself out in create(); repainting every texture again here cost a
// second of the title's first moments: docs/perf.md)
game.events.once(Phaser.Core.Events.READY, () => {
  app.relayout();
  place();
});
// Debug/test handle (used by the Playwright smoke test).
const handle: Record<string, unknown> = {
  app,
  game,
  /** The title is up and the later regions' art packs have arrived (a test may jump anywhere at once). */
  get ready() {
    return app.sceneReady && regionArtLoaded() && chestHdLoaded();
  },
  /** Foe sprites a map asked for that have no mini (drawn as the crossed swords): the tests expect none. */
  miniMisses: MINI_MISSES,
};
(window as unknown as { __cq3: unknown }).__cq3 = handle;
// the numbers safety net's record (textViolations) on the handle, and the HTML panels' text guarded like the canvas's
installNumberGuard(handle);
// iOS opens a home-screen app upright and turns it sideways as it launches. Its resize events can come before
// the new size is readable, or not at all, and the safe-area insets settle late too. So any hint of a change is
// re-checked a few times over the next two seconds, and a slow watch catches whatever no event announced
// (relayout is a no-op unless the measured layout actually changed).
const settle = () => {
  relayout();
  for (const ms of [50, 150, 300, 600, 1000, 2000]) window.setTimeout(() => relayout(), ms);
};
settle();
window.addEventListener('resize', settle);
window.addEventListener('orientationchange', settle);
window.visualViewport?.addEventListener('resize', settle);
window.addEventListener('pageshow', settle);
if ('ResizeObserver' in window) new ResizeObserver(settle).observe(document.getElementById('game')!);
window.setInterval(() => {
  if (!document.hidden) relayout();
}, 500);

/**
 * A home-screen app can sit in the background for days, still running the build it loaded. Back in front, it asks
 * for the deployed build's label (dist/version.txt) and, if it differs from its own, reloads to pick up the new one
 * (the run is saved first, so Continue picks it back up). Never mid-fight: that waits for the next time.
 */
async function checkForUpdate(): Promise<void> {
  if (!import.meta.env.PROD) return;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.txt?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const live = (await res.text()).trim();
    if (!live || live === __BUILD__ || live.length > 80) return;
    if (document.hidden || app.run.phase === 'fight') return;
    app.saveRun();
    window.location.reload();
  } catch {
    /* offline: next time */
  }
}

document.addEventListener('visibilitychange', () => {
  const now = performance.now();
  if (!document.hidden) void checkForUpdate();
  app.hidden = document.hidden;
  if (!document.hidden) settle(); // back from the app switcher: it may have turned while away
  if (document.hidden && app.run.phase === 'fight') app.userPaused = true;
  app.syncClock(now);
  // iOS often reloads a home-screen app after you switch away: save the run as it stands
  if (document.hidden) app.saveRun();
  ui.refreshHud();
});
window.addEventListener('pagehide', () => app.saveRun());

const lab = installLab(app, getScene);
const ui = installDebug(app, lab);
installInput(app, getScene, ui);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
