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
const relayout = () => {
  app.relayout();
  if (game.canvas) applyCanvasLayout(game.canvas, app.layout);
  // DOM HUD buttons are pixel art too: size them in game pixels.
  rootStyle.setProperty('--gpx', `${app.layout.scale / app.layout.dpr}px`);
  rootStyle.setProperty('--game-top', `${app.layout.top}px`);
};
game.events.once(Phaser.Core.Events.READY, relayout);
// Debug/test handle (used by the Playwright smoke test).
(window as unknown as { __cq3: unknown }).__cq3 = {
  app,
  game,
  get ready() {
    return app.sceneReady;
  },
};
window.addEventListener('resize', relayout);
window.addEventListener('orientationchange', () => window.setTimeout(relayout, 250));
window.visualViewport?.addEventListener('resize', relayout);

document.addEventListener('visibilitychange', () => {
  const now = performance.now();
  app.hidden = document.hidden;
  if (document.hidden && app.run.phase === 'fight') app.userPaused = true;
  app.syncClock(now);
  ui.refreshHud();
});

const ui = installDebug(app);
installInput(app, getScene, ui);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
