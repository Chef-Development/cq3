// The keyboard's focus ring (desktop). Every button a screen draws asks `isPressed(rect)` (view/ui.ts) to know whether
// to show sunk; once a key has been pressed that also notes the rect here, so the buttons on screen are the ones the
// last frame drew, on every screen, with no list to keep up to date. The act map's reachable nodes and the world map's
// landmarks and Rowan's plate are added on top (they are drawn without a button). The ring is a DOM box over the
// canvas, in game pixels (a gold line with an ink edge, like the game's own outlines); it shows only after an arrow or
// Tab and hides at the first mouse or touch press. Pressing the focused target taps its centre (input.ts).
import { cycle, step, track, usable, type FocusDir, type FRect } from './focus-nav';
import { GAME_H, GAME_W, type ScreenLayout } from './layout';

let noting = false;
let pending: FRect[] = [];
let frame: FRect[] = [];

/** A button drawn this frame (from view/ui.ts isPressed; ignored until a key has been pressed). */
export function noteTarget(r: FRect): void {
  if (noting) pending.push({ x: r.x, y: r.y, w: r.w, h: r.h });
}

export interface FocusRing {
  /** Arrows and Tab: move the ring (the first press shows it on the first target). */
  move(dir: FocusDir | 'next' | 'prev'): void;
  /** The focused target's centre in game px, or null (no ring up). */
  current(): { x: number; y: number } | null;
  /** Hide the ring (a mouse or touch press). */
  hide(): void;
  readonly shown: boolean;
}

/**
 * Start noting targets (the first key press) and run the ring. `extras` adds the screen's targets drawn without a
 * button (map nodes, world landmarks); `layout` places the ring over the canvas.
 */
export function installFocus(extras: () => FRect[], layout: () => ScreenLayout): FocusRing {
  const ring = document.createElement('div');
  ring.id = 'focus-ring';
  ring.hidden = true;
  document.body.appendChild(ring);
  let cur: FRect | null = null;
  let shown = false;
  let running = false;
  let queued: Array<FocusDir | 'next' | 'prev'> = [];

  const targets = (): FRect[] => usable([...frame, ...extras()], GAME_W, GAME_H);

  const place = () => {
    if (!shown || !cur) {
      ring.hidden = true;
      return;
    }
    const l = layout();
    const k = l.cssW / GAME_W;
    const pad = 2;
    ring.hidden = false;
    const st = ring.style;
    st.left = `${l.left + (cur.x - pad) * k}px`;
    st.top = `${l.top + (cur.y - pad) * k}px`;
    st.width = `${(cur.w + pad * 2) * k}px`;
    st.height = `${(cur.h + pad * 2) * k}px`;
  };

  const apply = (dir: FocusDir | 'next' | 'prev') => {
    const ts = targets();
    const next = dir === 'next' || dir === 'prev' ? cycle(ts, shown ? cur : null, dir === 'next' ? 1 : -1) : step(ts, shown ? cur : null, dir);
    if (next) cur = { ...next };
    shown = !!cur;
    place();
  };

  const tick = () => {
    frame = pending;
    pending = [];
    if (queued.length) {
      const q = queued;
      queued = [];
      for (const d of q) apply(d);
    } else if (shown && cur) {
      // follow the target as it animates; it went away (the screen changed): the ring waits for the next key
      const t = track(targets(), cur);
      if (t) cur = { ...t };
      else shown = false;
      place();
    }
    window.requestAnimationFrame(tick);
  };

  const start = () => {
    if (running) return;
    running = true;
    noting = true;
    window.requestAnimationFrame(tick);
  };

  return {
    move(dir) {
      start();
      // (the very first key: nothing has been noted yet, so the move waits a frame for the screen to draw)
      if (!frame.length && !shown) queued.push(dir);
      else apply(dir);
    },
    current() {
      if (!shown || !cur) return null;
      return { x: cur.x + cur.w / 2, y: cur.y + cur.h / 2 };
    },
    hide() {
      shown = false;
      cur = null;
      place();
    },
    get shown() {
      return shown;
    },
  };
}
