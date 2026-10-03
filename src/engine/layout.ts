// Integer-scaled, letterboxed canvas placement and safe-area insets in game pixels.

export const GAME_W = 201;
export const GAME_H = 437;

export interface ScreenLayout {
  scale: number; // device pixels per game pixel
  dpr: number;
  cssW: number;
  cssH: number;
  left: number;
  top: number;
  safeTop: number; // game px covered by notch / status bar
  safeBottom: number; // game px covered by the home indicator
}

let probe: HTMLDivElement | null = null;

function insets(): { top: number; bottom: number } {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  return { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
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
  const bottomGap = vh - (top + cssH);
  return {
    scale,
    dpr,
    cssW,
    cssH,
    left,
    top,
    safeTop: Math.ceil(Math.max(0, ins.top - top) * toGame),
    safeBottom: Math.ceil(Math.max(0, ins.bottom - bottomGap) * toGame),
  };
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
