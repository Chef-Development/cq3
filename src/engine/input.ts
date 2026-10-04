// Pointer/keyboard routing. Bar taps are judged by event.timeStamp (see App.barTap), not by frame.
import { isSwipe } from '../core/swipe';
import type { App } from './app';
import { clientToGame } from './layout';
import type { FightScene } from './scene';

const inUi = (t: EventTarget | null): boolean => t instanceof Element && !!t.closest('[data-ui]');

export function installInput(app: App, getScene: () => FightScene | null, ui: { togglePanel(): void; refreshHud(): void }): void {
  // A touch that might become a finisher swipe. Taps that land on a block are judged immediately; only a tap
  // that would miss is held back (until it's clearly not a swipe), so a swipe never costs you your stacks.
  let swipe: { id: number; x: number; y: number; ts: number; timer: number; held: boolean } | null = null;

  const resolveSwipeAsTap = () => {
    if (!swipe) return;
    const s = swipe;
    window.clearTimeout(s.timer);
    swipe = null;
    if (s.held) app.barTap(s.ts);
  };

  const fireSwipe = () => {
    if (!swipe) return;
    window.clearTimeout(swipe.timer);
    swipe = null;
    app.finisher();
  };

  const down = (clientX: number, clientY: number, ts: number, pointerId: number) => {
    const scene = getScene();
    if (!scene || !scene.sys.isActive()) return;
    const now = performance.now();
    const run = app.run;
    const g = clientToGame(app.layout, clientX, clientY);
    switch (run.phase) {
      case 'title': {
        if (!app.savedRun) return app.newRun();
        // a run was saved: Continue or New run (keyboard: Space/Enter continues)
        const pick = clientX < 0 ? 'continue' : scene.titleTap(g.x, g.y);
        if (pick === 'continue') app.continueRun();
        else if (pick === 'new') app.newRun();
        return;
      }
      case 'boost': {
        const i = scene.boostCardAt(g.x, g.y);
        if (i >= 0 && now - app.phaseSince > 400) app.setPhase(() => run.pickBoost(i));
        return;
      }
      case 'levelClear':
        if (now - app.phaseSince > 700 && !scene.levelClearTap()) app.setPhase(() => run.nextLevel());
        return;
      case 'defeat':
        if (now - app.phaseSince > 700) app.setPhase(() => run.retry());
        return;
    }
    if (app.userPaused) {
      app.userPaused = false;
      app.syncClock(now);
      ui.refreshHud();
      return;
    }
    if (app.panelOpen && !app.playWhilePanelOpen) return;
    if (app.awaitingBegin) {
      app.begin();
      return;
    }
    if (now < app.introUntil) {
      // the next enemy is still walking in: a tap starts the fight right away instead of being ignored
      app.skipIntro();
      return;
    }
    if (scene.finisherButtonHit(g.x, g.y) && app.combat?.finisherReady) {
      app.finisher();
      return;
    }
    if (app.settings.targeting === 'tap') {
      const id = scene.enemyAt(g.x, g.y);
      if (id !== null) {
        app.setTarget(id);
        return;
      }
    }
    if (app.settings.finisherInput === 'swipe' && app.combat?.finisherReady) {
      resolveSwipeAsTap();
      const held = app.wouldMiss(ts);
      if (!held) app.barTap(ts);
      const wait = Math.min(app.tuning.swipe.maxMs, app.tuning.judge.maxRewindMs - 20);
      swipe = { id: pointerId, x: clientX, y: clientY, ts, held, timer: window.setTimeout(resolveSwipeAsTap, Math.max(0, wait)) };
      return;
    }
    app.barTap(ts);
  };

  window.addEventListener(
    'pointerdown',
    (e) => {
      if (inUi(e.target)) return;
      e.preventDefault();
      app.audio.unlock();
      down(e.clientX, e.clientY, e.timeStamp, e.pointerId);
    },
    { passive: false },
  );

  const swipeCheck = (e: PointerEvent): boolean => {
    if (!swipe || e.pointerId !== swipe.id) return false;
    const S = app.tuning.swipe;
    return isSwipe(e.clientX - swipe.x, e.clientY - swipe.y, e.timeStamp - swipe.ts, S.minDistPx, S.maxMs);
  };

  window.addEventListener('pointermove', (e) => {
    if (swipeCheck(e)) fireSwipe();
  });

  window.addEventListener('pointerup', (e) => {
    app.audio.unlock();
    if (!swipe || e.pointerId !== swipe.id) return;
    if (swipeCheck(e)) fireSwipe();
    else resolveSwipeAsTap();
  });
  window.addEventListener('pointercancel', (e) => {
    if (swipe && e.pointerId === swipe.id) resolveSwipeAsTap();
  });

  // iOS: no double-tap zoom, pinch zoom, callouts, selection or rubber-banding outside the UI panels.
  const block = (e: Event) => {
    if (!inUi(e.target)) e.preventDefault();
  };
  document.addEventListener('touchstart', block, { passive: false });
  document.addEventListener('touchmove', block, { passive: false });
  document.addEventListener(
    'touchend',
    (e) => {
      app.audio.unlock();
      block(e);
    },
    { passive: false },
  );
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', block);
  document.addEventListener('contextmenu', block);
  document.addEventListener('selectstart', block);

  // Desktop testing: Space/J/K = tap, F/Up = finisher, P/Esc = pause, ` = tuning panel.
  window.addEventListener('keydown', (e) => {
    if (e.repeat || inUi(e.target)) return;
    app.audio.unlock();
    const k = e.key;
    if (k === ' ' || k === 'j' || k === 'k' || k === 'Enter') {
      e.preventDefault();
      if (app.run.phase === 'fight' && !app.userPaused && !app.awaitingBegin) app.barTap(e.timeStamp);
      else down(-1, -1, e.timeStamp, -1);
    } else if (k === 'f' || k === 'ArrowUp') app.finisher();
    else if (k === 'p' || k === 'Escape') {
      app.userPaused = !app.userPaused;
      app.syncClock(performance.now());
      ui.refreshHud();
    } else if (k === '`') ui.togglePanel();
  });
}
