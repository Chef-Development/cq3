// UI chrome textures (panel, buttons): original pixel art generated at boot.
import type Phaser from 'phaser';

/** Bottom panel: a wooden band holding the bar, over a stone strip (CQ2-style composition, original art). */
export function buildPanel(scene: Phaser.Scene, w: number, h: number, bandH: number): void {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const fill = (x: number, y: number, ww: number, hh: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, ww, hh);
  };
  let seed = 41;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // wood planks
  fill(0, 0, w, bandH, '#7a4a28');
  const plankH = Math.ceil(bandH / 3);
  for (let p = 0; p < 3; p++) {
    const y0 = p * plankH;
    fill(0, y0, w, 1, '#94603a');
    fill(0, y0 + plankH - 1, w, 1, '#4e2c14');
    for (let i = 0; i < 40; i++) fill(Math.floor(rnd() * w), y0 + 2 + Math.floor(rnd() * (plankH - 4)), 3 + Math.floor(rnd() * 8), 1, '#6a3e20');
    for (let x = (p * 37) % 70; x < w; x += 70) {
      fill(x, y0, 1, plankH, '#4e2c14');
      fill(x + 3, y0 + 3, 1, 1, '#3a200e');
      fill(x - 4, y0 + plankH - 4, 1, 1, '#3a200e');
    }
  }
  fill(0, 0, w, 2, '#2e1a0c');
  fill(0, 2, w, 1, '#b07a48');
  // stone strip
  fill(0, bandH, w, h - bandH, '#5c5c68');
  fill(0, bandH, w, 2, '#2a2a32');
  fill(0, bandH + 2, w, 1, '#8a8a96');
  for (let row = 0; bandH + 3 + row * 9 < h; row++) {
    const y0 = bandH + 3 + row * 9;
    fill(0, y0 + 8, w, 1, '#44444e');
    for (let x = (row % 2) * 9; x < w; x += 18) {
      fill(x, y0, 1, 8, '#44444e');
      fill(x + 1, y0, 16, 1, '#6c6c78');
    }
  }
  if (scene.textures.exists('panel')) scene.textures.remove('panel');
  scene.textures.addCanvas('panel', c);
}
