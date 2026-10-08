// Pointer/keyboard routing. Bar taps are judged by event.timeStamp (see App.barTap), not by frame. The world map is
// bigger than the screen: there a press becomes a drag (it pans) once it moves a few game px, and is a tap only when
// released in place (view/world.ts); the hero select's stage swipes the same way (view/heroes.ts: the hero follows the
// finger, a swipe pages, a press let go in place is a tap). One cursor for every hero. A press on a hold block starts a hold: lifting that
// finger releases it (judged at the lift's timeStamp), and a hold is never a finisher swipe. Taps on the HUD's relic
// belt open the relic panel (the fight pauses) and are never judged as bar taps. While a tip card is up (view/tips.ts)
// a tap only dismisses it: never a bar tap, a finisher, or a press of whatever is under it.
import { isSwipe, swipeAllowed } from '../core/swipe';
import type { App } from './app';
import { clientToGame } from './layout';
import type { FightScene } from './scene';
import { inRect } from './view/shared';

const inUi = (t: EventTarget | null): boolean => t instanceof Element && !!t.closest('[data-ui]');

export function installInput(app: App, getScene: () => FightScene | null, ui: { togglePanel(): void; refreshHud(): void }): void {
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
        if (!app.canContinue) return app.newRun(); // nothing earned yet: a tap starts
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
    if (worldPointer(e, 'move') || campPointer(e, 'move')) return;
    if (swipeCheck(e)) fireSwipe();
  });

  window.addEventListener('pointerup', (e) => {
    app.audio.unlock();
    if (worldPointer(e, 'up') || campPointer(e, 'up')) return;
    lift(e.pointerId, e.timeStamp);
    if (!swipe || e.pointerId !== swipe.id) return;
    if (swipeCheck(e)) fireSwipe();
    else resolveSwipeAsTap();
  });
  window.addEventListener('pointercancel', (e) => {
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

  // Desktop testing: Space/J/K = tap (held down on a hold block: released on key up), F/Up = finisher, P/Esc = pause,
  // ` = tuning panel.
  window.addEventListener('keydown', (e) => {
    if (e.repeat || inUi(e.target)) return;
    app.audio.unlock();
    const k = e.key;
    if (k === ' ' || k === 'j' || k === 'k' || k === 'Enter') {
      e.preventDefault();
      if (app.run.phase === 'fight' && !app.userPaused && !app.awaitingBegin && !app.tipUp && !getScene()?.gallery.active) pressed(-2, app.barTap(e.timeStamp));
      else down(-1, -1, e.timeStamp, -1);
    } else if (k === 'f' || k === 'ArrowUp') app.finisher();
    else if (k === 'p' || k === 'Escape') {
      app.userPaused = !app.userPaused;
      app.syncClock(performance.now());
      ui.refreshHud();
    } else if (k === '`') ui.togglePanel();
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'j' || e.key === 'k' || e.key === 'Enter') lift(-2, e.timeStamp);
  });
}
