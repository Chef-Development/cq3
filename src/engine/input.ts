// Pointer/keyboard routing. Bar taps are judged by event.timeStamp (see App.barTap), not by frame. The world map is
// bigger than the screen: there a press becomes a drag (it pans) once it moves a few game px, and is a tap only when
// released in place (view/world.ts); the hero select's stage swipes the same way (view/heroes.ts: the hero follows the
// finger, a swipe pages, a press let go in place is a tap). One cursor for every hero. A press on a hold block starts a hold: lifting that
// finger releases it (judged at the lift's timeStamp), and a hold is never a finisher swipe. Taps on the HUD's relic
// belt open the relic panel (the fight pauses) and are never judged as bar taps. While a tip card is up (view/tips.ts)
// a tap only dismisses it: never a bar tap, a finisher, or a press of whatever is under it.
import { isSwipe, swipeAllowed } from '../core/swipe';
import type { App } from './app';
import { installFocus } from './focus';
import { fightLive, isTapKey, keyAction, noteKeyboardPlay } from './keys';
import { clientToGame, GAME_H, GAME_W } from './layout';
import type { FightScene } from './scene';
import { inRect } from './view/shared';

/** How long a press on the top middle takes to bring the hidden buttons back (the clean capture). */
export const CAPTURE_HOLD_MS = 800;

const inUi = (t: EventTarget | null): boolean => t instanceof Element && !!t.closest('[data-ui]');

export function installInput(app: App, getScene: () => FightScene | null, ui: { togglePanel(): void; refreshHud(): void; toggleCapture(): void }): void {
  // A touch that might become a finisher swipe. Taps that land on a block are judged immediately; only a tap
  // that would miss is held back (until it's clearly not a swipe), so a swipe never costs you your stacks.
  let swipe: { id: number; x: number; y: number; ts: number; timer: number; held: boolean } | null = null;
  // the pointer holding a hold block down (its lift releases the hold)
  let holdPointer: number | null = null;
  const pressed = (pointerId: number, r: { outcome: string } | null) => {
    if (r?.outcome === 'hold') holdPointer = pointerId;
  };
  // the pointer pressing (and maybe dragging) the world map
  let worldPress: number | null = null;
  const worldPointer = (e: PointerEvent, end: 'move' | 'up' | 'cancel'): boolean => {
    if (worldPress === null || e.pointerId !== worldPress) return false;
    const scene = getScene();
    const g = clientToGame(app.layout, e.clientX, e.clientY);
    const now = performance.now();
    if (end !== 'move') worldPress = null;
    if (!scene || app.run.phase !== 'world') return true;
    if (end === 'move') scene.worldMap.dragTo(g.x, g.y, now);
    else if (end === 'up') scene.worldMap.releaseAt(g.x, g.y, now);
    else scene.worldMap.cancelPress();
    return true;
  };

  // the pointer pressing (and maybe swiping) a camp screen's stage (the hero select): a tap if it stays put
  let campPress: number | null = null;
  const campPointer = (e: PointerEvent, end: 'move' | 'up' | 'cancel'): boolean => {
    if (campPress === null || e.pointerId !== campPress) return false;
    const scene = getScene();
    const g = clientToGame(app.layout, e.clientX, e.clientY);
    const now = performance.now();
    if (end !== 'move') campPress = null;
    if (!scene || app.run.phase !== 'camp') return true;
    if (end === 'move') scene.campDragTo(g.x, g.y, now);
    else if (end === 'up') scene.campReleaseAt(g.x, g.y, now);
    else scene.campCancelPress();
    return true;
  };

  const resolveSwipeAsTap = () => {
    if (!swipe) return;
    const s = swipe;
    window.clearTimeout(s.timer);
    swipe = null;
    if (s.held) pressed(s.id, app.barTap(s.ts));
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
    if (app.tipUp) {
      scene.tips.tap(now);
      return;
    }
    switch (run.phase) {
      case 'title': {
        if (app.storyOverlay) {
          // the welcome back (a returning player's first launch of this version), over the title
          if (scene.storySkipAt(g.x, g.y)) app.storySkip();
          else if (!scene.storyReveal()) app.storyNext();
          return;
        }
        if (!app.canContinue || app.inLab) return app.newRun(); // nothing earned yet (or the Test lab's look): a tap starts
        // Continue (keeps everything) or New game (tapped twice: erases everything); keyboard: Space/Enter continues
        const pick = clientX < 0 ? 'continue' : scene.titleTap(g.x, g.y);
        if (pick === 'continue') app.continueRun();
        else if (pick === 'new') app.newGame();
        return;
      }
      case 'scene':
        if (now - app.phaseSince < 250) return;
        if (scene.storySkipAt(g.x, g.y)) app.storySkip();
        else if (!scene.storyReveal()) app.storyNext();
        return;
      case 'map': {
        if (scene.overlays.unlockActive()) return scene.overlays.unlockTap();
        if (clientX >= 0 && now - app.phaseSince > 300 && scene.mapView.campAt(g.x, g.y)) return app.openCamp();
        // the secret beside the node Rowan stands on
        if (clientX >= 0 && now - app.phaseSince > 300 && scene.mapView.roam.secretAt(g.x, g.y)) return scene.mapView.roam.openSecret();
        // keyboard: the first choice
        const id = clientX < 0 ? (run.choices()[0] ?? null) : scene.mapNodeAt(g.x, g.y);
        if (id !== null && now - app.phaseSince > 300) scene.chooseNode(id);
        else if (id === null && clientX >= 0) scene.mapView.life.tap(g.x, g.y, now); // a sparkle or a critter (map-life.ts)
        return;
      }
      case 'boost': {
        if (scene.overlays.unlockActive()) return scene.overlays.unlockTap();
        // (each card is live as soon as it has been dealt face up)
        if (now - app.phaseSince < 120) return;
        const i = clientX < 0 ? scene.overlays.takeCard(0) : scene.boostCardAt(g.x, g.y);
        // (a relic flies into the tray first, then the run moves on)
        if (i >= 0) scene.overlays.afterPick(() => app.setPhase(() => run.pickBoost(i)));
        else if (scene.rerollAt(g.x, g.y) && run.rerollBoosts()) scene.onReroll();
        return;
      }
      case 'treasure':
      case 'rest':
      case 'shop':
      case 'event':
      case 'bounty':
        if (scene.overlays.unlockActive()) return scene.overlays.unlockTap();
        if (now - app.phaseSince > 300) scene.nodeTap(clientX < 0 ? -1 : g.x, g.y);
        return;
      case 'actClear': {
        // the first tap bursts the chest; then only the Camp and Next buttons do anything
        if (now - app.phaseSince < 300) return;
        if (scene.overlays.unlockActive()) return scene.overlays.unlockTap();
        const pick = scene.overlays.actClearTap(clientX < 0 ? -1 : g.x, g.y);
        if (pick === 'camp') app.openCamp();
        else if (pick === 'next') app.setPhase(() => run.nextAct());
        return;
      }
      case 'defeat': {
        const pick = scene.overlays.defeatTap(clientX < 0 ? -1 : g.x, g.y);
        if (pick === 'camp') app.openCamp();
        else if (pick === 'retry') app.setPhase(() => run.retry());
        return;
      }
      case 'victory':
        if (now - app.phaseSince > 1500) app.toWorld();
        return;
      case 'world':
        // the world map pans: a press is a tap only if it's released without moving (view/world.ts); the keyboard taps
        if (clientX < 0) {
          if (now - app.phaseSince > 300) scene.worldTap(-1, -1);
        } else if (now - app.phaseSince > 300 || scene.worldMap.touring) {
          worldPress = pointerId;
          scene.worldMap.pressAt(g.x, g.y, now);
        }
        return;
      case 'loot':
        scene.lootTap(clientX < 0 ? -1 : g.x, g.y);
        return;
      case 'camp':
        if (app.storyOverlay) {
          // the smith's intro scene, over the camp
          if (scene.storySkipAt(g.x, g.y)) app.storySkip();
          else if (!scene.storyReveal()) app.storyNext();
          return;
        }
        if (now - app.phaseSince <= 300) return;
        // the hero select's stage swipes: a press there is judged when it's let go (a tap if it stayed put)
        if (clientX >= 0 && scene.campPressAt(g.x, g.y, now)) campPress = pointerId;
        else scene.campTap(clientX < 0 ? -1 : g.x, g.y);
        return;
    }
    if (scene.gallery.active) {
      // the Test lab's Finisher gallery: its controls take every tap (never the bar)
      scene.gallery.tap(clientX < 0 ? -1 : g.x, g.y, now);
      return;
    }
    if (app.storyOverlay) {
      // a boss's mid-fight scene: tap through it (or skip it), then the fight goes on
      if (scene.storySkipAt(g.x, g.y)) app.storySkip();
      else if (!scene.storyReveal()) app.storyNext();
      return;
    }
    // the relic panel (opened from the relic belt): show another relic, or close it and play on
    if (app.userPaused && scene.overlays.relicSel !== null) {
      if (scene.overlays.relicPanelTap(g.x, g.y) === 'close') {
        app.userPaused = false;
        app.syncClock(now);
        ui.refreshHud();
      }
      return;
    }
    if (app.userPaused) {
      // a practice fight's "Back to camp"
      const leave = scene.overlays.pauseLeaveRect();
      if (leave && clientX >= 0 && inRect(leave, g.x, g.y, 2)) {
        app.userPaused = false;
        app.leavePractice();
        ui.refreshHud();
        return;
      }
      app.userPaused = false;
      app.syncClock(now);
      ui.refreshHud();
      return;
    }
    if (app.panelOpen && !app.playWhilePanelOpen) return;
    // the relic belt under the hero plate: the relic panel opens and the fight pauses (never a bar tap)
    const relic = clientX < 0 ? -1 : scene.hud.relicAt(g.x, g.y);
    if (relic >= 0) {
      app.userPaused = true;
      app.syncClock(now);
      ui.refreshHud();
      scene.overlays.openRelics(relic);
      return;
    }
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
      const r = held ? null : app.barTap(ts);
      pressed(pointerId, r);
      // a press that started a hold is never a swipe
      if (!swipeAllowed(!!app.combat?.holding, r?.outcome)) return;
      const wait = Math.min(app.tuning.swipe.maxMs, app.tuning.judge.maxRewindMs - 20);
      swipe = { id: pointerId, x: clientX, y: clientY, ts, held, timer: window.setTimeout(resolveSwipeAsTap, Math.max(0, wait)) };
      return;
    }
    pressed(pointerId, app.barTap(ts));
  };

  const lift = (pointerId: number, ts: number) => {
    if (holdPointer === null || pointerId !== holdPointer) return;
    holdPointer = null;
    app.barRelease(ts);
  };

  // The clean capture's way back: a long press where the gear button sits (the top middle) shows the buttons again.
  let capHold: { id: number; x: number; y: number; at: number; timer: number } | null = null;
  const capRelease = (e: PointerEvent, moved = false) => {
    if (!capHold || e.pointerId !== capHold.id) return;
    if (moved && Math.hypot(e.clientX - capHold.x, e.clientY - capHold.y) < 12) return;
    window.clearTimeout(capHold.timer);
    // (let go after the hold's time, but before its timer could run: a busy main thread runs input first)
    const long = !moved && e.type === 'pointerup' && e.timeStamp - capHold.at >= CAPTURE_HOLD_MS;
    capHold = null;
    if (long) ui.toggleCapture();
  };

  window.addEventListener(
    'pointerdown',
    (e) => {
      if (inUi(e.target)) return;
      e.preventDefault();
      app.audio.unlock();
      if (document.documentElement.classList.contains('clean-capture')) {
        const g = clientToGame(app.layout, e.clientX, e.clientY);
        if (Math.abs(g.x - GAME_W / 2) < 32 && g.y < 22) {
          if (capHold) window.clearTimeout(capHold.timer);
          capHold = { id: e.pointerId, x: e.clientX, y: e.clientY, at: e.timeStamp, timer: window.setTimeout(() => ((capHold = null), ui.toggleCapture()), CAPTURE_HOLD_MS) };
        }
      }
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
    capRelease(e, true);
    if (worldPointer(e, 'move') || campPointer(e, 'move')) return;
    if (swipeCheck(e)) fireSwipe();
  });

  window.addEventListener('pointerup', (e) => {
    capRelease(e);
    app.audio.unlock();
    if (worldPointer(e, 'up') || campPointer(e, 'up')) return;
    lift(e.pointerId, e.timeStamp);
    if (!swipe || e.pointerId !== swipe.id) return;
    if (swipeCheck(e)) fireSwipe();
    else resolveSwipeAsTap();
  });
  window.addEventListener('pointercancel', (e) => {
    capRelease(e);
    if (worldPointer(e, 'cancel') || campPointer(e, 'cancel')) return;
    lift(e.pointerId, e.timeStamp);
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

  // ---- desktop: the keyboard (engine/keys.ts says which key does what) and the focus ring (engine/focus.ts)
  const ring = installFocus(() => focusExtras(app, getScene()), () => app.layout);
  const KEY_ID = -2; // the keyboard's "pointer"
  /** A tap at a game point from the keyboard (the focused button's centre): the same route as a finger, pressed and
   *  let go in place (the world map and the hero select judge a press when it's let go). */
  const tapAt = (gx: number, gy: number, ts: number) => {
    const l = app.layout;
    const cx = l.left + (gx * l.cssW) / GAME_W;
    const cy = l.top + (gy * l.cssH) / GAME_H;
    down(cx, cy, ts, KEY_ID);
    const scene = getScene();
    const now = performance.now();
    if (worldPress === KEY_ID) {
      worldPress = null;
      if (scene && app.run.phase === 'world') scene.worldMap.releaseAt(gx, gy, now);
    }
    if (campPress === KEY_ID) {
      campPress = null;
      if (scene && app.run.phase === 'camp') scene.campReleaseAt(gx, gy, now);
    }
  };
  const togglePause = () => {
    if (app.run.phase !== 'fight') return;
    app.userPaused = !app.userPaused;
    app.syncClock(performance.now());
    ui.refreshHud();
  };
  /** Escape: back out of what's up (a scene is skipped, a sheet or a camp screen closes, the picker or card goes). */
  const back = (ts: number) => {
    const scene = getScene();
    if (!scene) return;
    if (app.tipUp) return scene.tips.tap(performance.now());
    if (app.storyOverlay || app.run.phase === 'scene') return app.storySkip();
    const ph = app.run.phase;
    if (ph === 'fight') return togglePause();
    if (ph === 'world') {
      scene.worldMap.escape();
      return;
    }
    if (ph === 'camp') {
      const c = scene.camp;
      // a sub-screen's Back (a sheet open on it closes first: a tap anywhere closes a sheet); the home's way out
      const r = c.mode === 'home' ? c.band().find((b) => b.id === 'leave')?.r : c.kit.backRect();
      if (r) tapAt(r.x + r.w / 2, r.y + r.h / 2, ts);
    }
  };

  window.addEventListener('keydown', (e) => {
    // Escape closes the gear panel, wherever the focus is in it
    if (e.key === 'Escape' && app.panelOpen) {
      e.preventDefault();
      ui.togglePanel();
      return;
    }
    // a HUD button clicked with the mouse keeps the focus: the keys are the game's again (Space must not re-click it)
    if (e.target instanceof HTMLElement && e.target.closest('#hud')) e.target.blur();
    else if (inUi(e.target)) return;
    const scene = getScene();
    const live = fightLive({
      phase: app.run.phase,
      paused: app.userPaused || (app.panelOpen && !app.playWhilePanelOpen),
      awaitingBegin: app.awaitingBegin,
      tipUp: app.tipUp,
      story: !!app.storyOverlay,
      intro: performance.now() < app.introUntil,
      gallery: !!scene?.gallery.active,
    });
    const act = keyAction(e.key, live ? 'fight' : 'menu', { shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey });
    if (!act) return;
    e.preventDefault();
    // (a key held down repeats: only the arrows and Tab move on while held)
    if (e.repeat && !['left', 'right', 'up', 'down', 'next', 'prev'].includes(act)) return;
    app.audio.unlock();
    switch (act) {
      case 'tap':
        ring.hide();
        noteKeyboardPlay();
        pressed(KEY_ID, app.barTap(e.timeStamp));
        return;
      case 'finisher':
        app.finisher();
        return;
      case 'pause':
        return togglePause();
      case 'panel':
        return ui.togglePanel();
      case 'capture':
        return ui.toggleCapture();
      case 'back':
        ring.hide();
        return back(e.timeStamp);
      case 'press': {
        const at = ring.current();
        if (at) return tapAt(at.x, at.y, e.timeStamp);
        down(-1, -1, e.timeStamp, -1); // no ring: the screen's default (Continue, the first choice, begin...)
        return;
      }
      default:
        ring.move(act);
    }
  });
  // Android's back gesture (or button), in the installed app or a tab: what Escape does (a fight pauses, a scene is
  // skipped, a sheet or a screen closes) instead of leaving the game mid-fight. On the title it leaves as it always
  // did (the trap isn't set again until a tap past the title). iOS has no back gesture in the app.
  if (/Android/i.test(navigator.userAgent)) {
    const trapped = () => (history.state as { cq3Back?: boolean } | null)?.cq3Back === true;
    const trap = () => {
      if (!trapped()) history.pushState({ cq3Back: true }, '');
    };
    trap();
    window.addEventListener('popstate', () => {
      if (app.panelOpen) ui.togglePanel();
      else if (app.run.phase === 'title' && !app.storyOverlay && !app.tipUp) return; // the next back leaves
      else if (app.run.phase === 'fight' && !app.tipUp && !app.storyOverlay) {
        if (!app.userPaused) togglePause();
      } else back(performance.now());
      trap();
    });
    window.addEventListener('pointerdown', () => app.run.phase !== 'title' && trap(), { capture: true });
  }
  window.addEventListener('keyup', (e) => {
    if (isTapKey(e.key)) lift(KEY_ID, e.timeStamp);
  });
  // a mouse or a finger takes over: the ring goes
  window.addEventListener('pointerdown', () => ring.hide(), { capture: true });
}

/** The targets a screen draws without a button: the act map's reachable nodes, the world map's landmarks, the boost
 *  pick's cards. */
function focusExtras(app: App, scene: FightScene | null): Array<{ x: number; y: number; w: number; h: number }> {
  if (!scene) return [];
  const run = app.run;
  if (run.phase === 'map' && !app.storyOverlay) return run.choices().map((id) => scene.mapView.nodeBox(run.map.nodes[id]));
  if (run.phase === 'world') return scene.worldMap.focusTargets();
  // the camp home's plates over the shrine, the chests, practice and the companion (drawn as plates, not buttons)
  if (run.phase === 'camp' && !app.storyOverlay) return scene.camp.focusTargets();
  // the boost pick's cards (drawn as cards, not buttons)
  if (run.phase === 'boost' && !scene.overlays.unlockActive()) return run.boostChoices.map((_, i) => scene.overlays.cardRect(i));
  return [];
}
