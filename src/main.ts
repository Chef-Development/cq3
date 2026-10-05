import Phaser from 'phaser';
import './style.css';
import { App } from './engine/app';
import { installDebug } from './engine/debug';
import { installInput } from './engine/input';
import { hudButtonImages } from './engine/chrome';
import { applyCanvasLayout, GAME_H, GAME_W } from './engine/layout';
import { FightScene } from './engine/scene';
import { loadSettings, loadTuning } from './engine/storage';

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
for (const [k, v] of Object.entries(hudButtonImages())) rootStyle.setProperty(`--img-${k}`, `url(${v})`);
const relayout = (force = false) => {
  if (!app.relayout(force)) return;
  if (game.canvas) applyCanvasLayout(game.canvas, app.layout);
  // DOM HUD buttons are pixel art too: size them in game pixels.
  rootStyle.setProperty('--gpx', `${app.layout.scale / app.layout.dpr}px`);
  rootStyle.setProperty('--game-top', `${app.layout.top}px`);
};
game.events.once(Phaser.Core.Events.READY, () => relayout(true));
// Debug/test handle (used by the Playwright smoke test).
(window as unknown as { __cq3: unknown }).__cq3 = {
  app,
  game,
  get ready() {
    return app.sceneReady;
  },
};
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

document.addEventListener('visibilitychange', () => {
  const now = performance.now();
  app.hidden = document.hidden;
  if (!document.hidden) settle(); // back from the app switcher: it may have turned while away
  if (document.hidden && app.run.phase === 'fight') app.userPaused = true;
  app.syncClock(now);
  // iOS often reloads a home-screen app after you switch away: save the run as it stands
  if (document.hidden) app.saveRun();
  ui.refreshHud();
});
window.addEventListener('pagehide', () => app.saveRun());

const ui = installDebug(app);
installInput(app, getScene, ui);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
