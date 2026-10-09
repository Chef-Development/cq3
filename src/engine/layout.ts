// Integer-scaled, letterboxed canvas placement and safe-area insets in game pixels.
// Landscape: 327x150 game px, 8x device px on an iPhone 16 Pro (2616x1200 of its 2622x1206).
// Big chunky pixels on purpose: about the same on-screen pixel size as the reference game.

export const GAME_W = 327;
export const GAME_H = 150;

export interface ScreenLayout {
  scale: number; // device pixels per game pixel
  dpr: number;
  cssW: number;
  cssH: number;
  left: number;
  top: number;
  // game px hidden behind the notch / Dynamic Island / home indicator
  safeTop: number;
  safeBottom: number;
  safeLeft: number;
  safeRight: number;
}

let probe: HTMLDivElement | null = null;

function insets(): { top: number; bottom: number; left: number; right: number } {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  const n = (v: string) => parseFloat(v) || 0;
  return { top: n(cs.paddingTop), bottom: n(cs.paddingBottom), left: n(cs.paddingLeft), right: n(cs.paddingRight) };
}

export function computeLayout(): ScreenLayout {
  const dpr = window.devicePixelRatio || 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fit = Math.min((vw * dpr) / GAME_W, (vh * dpr) / GAME_H);
  // Largest integer scale that fits; fall back to a fractional fit on tiny windows.
  const scale = fit >= 1 ? Math.floor(fit) : fit;
  const cssW = (GAME_W * scale) / dpr;
  const cssH = (GAME_H * scale) / dpr;
  const left = Math.round((vw * dpr - GAME_W * scale) / 2) / dpr;
  const top = Math.round((vh * dpr - GAME_H * scale) / 2) / dpr;
  const ins = insets();
  const toGame = GAME_W / cssW;
  const gap = { right: vw - (left + cssW), bottom: vh - (top + cssH) };
  return {
    scale,
    dpr,
    cssW,
    cssH,
    left,
    top,
    safeTop: Math.ceil(Math.max(0, ins.top - top) * toGame),
    safeBottom: Math.ceil(Math.max(0, ins.bottom - gap.bottom) * toGame),
    safeLeft: Math.ceil(Math.max(0, ins.left - left) * toGame),
    safeRight: Math.ceil(Math.max(0, ins.right - gap.right) * toGame),
  };
}

/** Same placement and insets: nothing to redo. */
export function sameLayout(a: ScreenLayout, b: ScreenLayout): boolean {
  return (Object.keys(a) as Array<keyof ScreenLayout>).every((k) => a[k] === b[k]);
}

export function applyCanvasLayout(canvas: HTMLCanvasElement, l: ScreenLayout): void {
  const st = canvas.style;
  st.setProperty('position', 'absolute', 'important');
  st.setProperty('left', `${l.left}px`, 'important');
  st.setProperty('top', `${l.top}px`, 'important');
  st.setProperty('width', `${l.cssW}px`, 'important');
  st.setProperty('height', `${l.cssH}px`, 'important');
  st.setProperty('margin', '0', 'important');
}

/** Client (CSS px) -> game px. */
export function clientToGame(l: ScreenLayout, x: number, y: number): { x: number; y: number } {
  return { x: ((x - l.left) * GAME_W) / l.cssW, y: ((y - l.top) * GAME_H) / l.cssH };
}

/**
 * Desktop (or any screen with room around the canvas): a quiet frame instead of plain black. Shown when every margin
 * is at least FRAME_MIN_GPX game px wide; on a phone the canvas fills the screen and there is none.
 */
export const FRAME_MIN_GPX = 6;
export function framed(l: ScreenLayout, vw: number, vh: number): boolean {
  const gpx = l.cssW / GAME_W;
  const m = Math.min(l.left, l.top, vw - l.left - l.cssW, vh - l.top - l.cssH);
  return l.scale >= 1 && m >= FRAME_MIN_GPX * gpx;
}

/** Place the frame around the canvas (or hide it) and mark the page as framed (style.css paints the backdrop). */
export function applyFrame(frame: HTMLElement, l: ScreenLayout): void {
  const on = framed(l, window.innerWidth, window.innerHeight);
  document.documentElement.classList.toggle('framed', on);
  frame.hidden = !on;
  if (!on) return;
  const st = frame.style;
  st.left = `${l.left}px`;
  st.top = `${l.top}px`;
  st.width = `${l.cssW}px`;
  st.height = `${l.cssH}px`;
}
