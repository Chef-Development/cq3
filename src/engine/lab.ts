// The Test lab (DOM, like the gear panel): a list of short scenarios of what's new (src/data/lab.ts), each dropping the
// playtester straight into the right setup on the lab's own save (App.enterLab: its own profile, run and storage
// keys; leaving puts the real game back exactly as it was). After each one, a rating card (Good / Needs work /
// Broken, an optional note); "Copy report" copies every rating and note, the accuracy line and the build. The
// ratings and the spoiler switch persist in their own key (a reload keeps them). Opened from the title's "Test lab"
// button and the gear panel's.
import { secs } from '../core/format';
import { accuracyCopyLine } from '../core/accuracy';
import { LAB_RATINGS, RATING_NAME, labMinutes, labProfile, labReport, labVisible, rateScenario, ratingOf, readLabState, staleRating, startLabScenario, type LabRating, type LabState } from '../core/lab';
import { LAB_EARLIER, LAB_GROUPS, LAB_NEW, type LabScenario } from '../data/lab';
import type { App } from './app';
import { copyText, toast } from './clipboard';
import { GAME_H, GAME_W } from './layout';
import type { FightScene } from './scene';
import { loadLabState, writeLabState } from './storage';

export interface LabUi {
  /** Open the lab (entering it if needed): the list. */
  open(): void;
  /** Leave the lab: the real game as it was. */
  leave(): void;
}

const BUILD = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev';

export function installLab(app: App, getScene: () => FightScene | null): LabUi {
  const root = document.getElementById('lab')!;
  const titleBtn = document.getElementById('btn-lab')!;
  const doneBtn = document.getElementById('btn-lab-done')!;
  let state: LabState = readLabState(loadLabState());
  /** The scenario on screen (null: the list or a card is up, or the lab is closed), and the phase it plays in (once
   *  the lab's run leaves it, the scenario is over). */
  let playing: LabScenario | null = null;
  let home: string = 'camp';

  const save = () => writeLabState(state);

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const button = (cls: string, text: string, fn: () => void): HTMLButtonElement => {
    const b = el('button', cls, text);
    b.onclick = () => {
      app.audio.unlock();
      app.audio.uiClick();
      fn();
    };
    return b;
  };

  // ------------------------------------------------------------------ the list

  const ratedCount = () => labVisible(state.spoilers).filter((s) => ratingOf(state, s)).length;

  function showList(): void {
    root.innerHTML = '';
    root.hidden = false;
    root.dataset.view = 'list';
    const head = el('div', 'lab-head');
    head.appendChild(el('div', 'lab-title', 'TEST LAB'));
    // the time is the New items' (what a session is asked to try); the count says which it means
    const fresh = labVisible(state.spoilers, LAB_NEW);
    const freshRated = fresh.filter((s) => ratingOf(state, s)).length;
    head.appendChild(el('div', 'lab-sub', `New: about ${labMinutes(state.spoilers)} min, ${freshRated}/${fresh.length} rated · all: ${ratedCount()}/${labVisible(state.spoilers).length}`));
    head.appendChild(
      button(`lab-btn${state.spoilers ? ' on' : ''}`, state.spoilers ? 'Hide spoilers' : 'Show spoilers', () => {
        state.spoilers = !state.spoilers;
        save();
        showList();
      }),
    );
    head.appendChild(button('lab-btn lab-copy', 'Copy report', copyReport));
    const x = button('lab-btn', '✕', leave);
    x.setAttribute('aria-label', 'Leave the Test lab');
    head.appendChild(x);
    root.appendChild(head);

    const body = el('div', 'lab-body');
    root.appendChild(body);
    section(body, 'New', LAB_NEW);
    if (LAB_EARLIER.length) section(body, 'Earlier', LAB_EARLIER);
    const foot = el('div', 'lab-foot');
    foot.appendChild(
      button('lab-btn small', 'Clear ratings', () => {
        if (!window.confirm('Clear every rating and note?')) return;
        state.ratings = {};
        save();
        showList();
      }),
    );
    foot.appendChild(el('span', 'lab-ver', `Practice only: nothing here touches your game. Version ${BUILD}`));
    body.appendChild(foot);
  }

  function section(body: HTMLElement, title: string, list: LabScenario[]): void {
    const shown = labVisible(state.spoilers, list);
    if (!shown.length) return;
    body.appendChild(el('div', 'lab-sec', title));
    for (const g of LAB_GROUPS) {
      const items = shown.filter((s) => s.group === g.id);
      if (!items.length) continue;
      body.appendChild(el('div', `lab-group${g.spoiler ? ' spoiler' : ''}`, g.name));
      const grid = el('div', 'lab-grid');
      for (const s of items) {
        const r = ratingOf(state, s);
        // rated before a rework: it asks again
        const redo = !r && !!staleRating(state, s);
        const b = button(`lab-item${r ? ` r-${r.rating}` : ''}${redo ? ' redo' : ''}${s.spoiler ? ' spoiler' : ''}`, '', () => showStart(s));
        b.dataset.id = s.id;
        b.appendChild(el('span', 'lab-name', s.label));
        b.appendChild(el('span', 'lab-meta', secs(s.secs)));
        b.appendChild(el('span', 'lab-badge', r ? RATING_NAME[r.rating] + (r.note ? ' *' : '') : redo ? 'Reworked' : ''));
        grid.appendChild(b);
      }
      body.appendChild(grid);
    }
  }

  /** A card over the dimmed list (or over the game, after a scenario). */
  function card(view: string, overGame = false): HTMLElement {
    root.innerHTML = '';
    root.hidden = false;
    root.dataset.view = view;
    root.classList.toggle('over-game', overGame);
    const c = el('div', 'lab-card');
    root.appendChild(c);
    return c;
  }

  // ------------------------------------------------------------------ a scenario: what to try, then play

  function showStart(s: LabScenario): void {
    root.classList.remove('over-game');
    const c = card('start');
    c.appendChild(el('div', 'lab-card-title', s.label));
    c.appendChild(el('div', 'lab-card-meta', `${LAB_GROUPS.find((g) => g.id === s.group)?.name ?? ''} · about ${secs(s.secs)}${s.spoiler ? ' · Spoiler' : ''}`));
    c.appendChild(el('div', 'lab-try', s.try));
    c.appendChild(el('div', 'lab-hint', "Tap Done (top) when you've seen enough."));
    const row = el('div', 'lab-row');
    row.appendChild(button('lab-btn big go', 'Start', () => start(s)));
    row.appendChild(button('lab-btn big', 'Back', showList));
    c.appendChild(row);
  }

  function start(s: LabScenario): void {
    root.hidden = true;
    root.classList.remove('over-game');
    playing = s;
    home = ''; // (set once it stands where it plays: the phase changes on the way there don't end it)
    app.labRun(labProfile(app.tuning, s), (run) => startLabScenario(run, s, (Date.now() & 0xffffff) | 1));
    home = app.run.phase;
    getScene()?.hud.resetCoins(); // (the coin chip counts the lab's purse, not the last one shown)
    if (s.setup.kind === 'camp') openScreen(s);
    // the Finisher gallery: its controls over the fight (Back ends it, like Done)
    if (s.setup.kind === 'gallery') getScene()?.gallery.open(s, end);
  }

  /** A camp scenario opens its screen over the lab's camp. */
  function openScreen(s: LabScenario): void {
    const camp = getScene()?.camp;
    if (!camp || s.setup.kind !== 'camp' || app.run.phase !== 'camp') return;
    const now = performance.now();
    switch (s.setup.screen) {
      case 'heroes':
        return camp.go('heroes', now, s.setup.hero);
      case 'skills':
        return camp.go('skills', now, s.setup.hero);
      case 'chest':
        return camp.go('chests', now);
      case 'chestDemo':
        // the opening at each tier in turn (a demo: nothing is granted)
        camp.go('chests', now);
        return camp.chests.demo(s.setup.tiers ?? ['rare', 'legendary'], s.setup.chest ?? 'rare', now);
      case 'chestHd':
        // the old reveal and the sharper one side by side (a demo: nothing is granted)
        camp.go('chests', now);
        camp.chests.compare(now);
        return;
      case 'shrine':
        return camp.go('shrine', now);
      case 'companions':
        return camp.go('pets', now);
      case 'upgrades':
        return camp.go('upgrades', now);
      case 'completion':
        camp.go('progress', now);
        return camp.progress.open(now, 0); // (Region 1's card)
      case 'edits':
        return camp.go('edits', now);
    }
  }

  /** Stop the scenario on screen (if any): its fight is walked away from, and the lab's run stands at its camp. */
  function stop(): LabScenario | null {
    const s = playing;
    playing = null;
    getScene()?.camp.chests.endCompare();
    getScene()?.gallery.close();
    if (!s || !app.inLab) return s;
    const run = app.run;
    if (run.phase !== 'camp' || run.practice)
      app.setPhase(() => {
        if (run.practice) run.endPractice(false);
        run.campFrom = 'world';
        run.phase = 'camp';
      });
    run.practiceEnded = null; // (the lab shows what comes next)
    return s;
  }

  /** The scenario is over (its fight ended, its scenes were read, its screen was left, or Done): back to the lab's
   *  camp, and the rating card. */
  function end(): void {
    const s = stop();
    if (s) showRate(s);
  }

  app.phaseListeners.push((prev, next) => {
    if (!app.inLab || !playing || next === prev) return;
    // (a fight that ends in a stat pick plays on through the pick)
    const pick = playing.setup.kind === 'fight' && !!playing.setup.pick;
    if (pick && prev === home && next === 'boost') return;
    if (prev === home || (pick && prev === 'boost')) end();
  });

  // ------------------------------------------------------------------ rating

  function showRate(s: LabScenario): void {
    const c = card('rate', true);
    const old = ratingOf(state, s);
    c.appendChild(el('div', 'lab-card-title', `How was it? ${s.label}`));
    const note = el('textarea', 'lab-note');
    note.placeholder = 'A short note (optional)';
    note.maxLength = 280;
    note.rows = 2;
    note.value = old?.note ?? '';
    const row = el('div', 'lab-row rate');
    for (const r of LAB_RATINGS)
      row.appendChild(
        button(`lab-btn big rate-${r}${old?.rating === r ? ' on' : ''}`, RATING_NAME[r], () => {
          rateScenario(state, s.id, r as LabRating, note.value, Date.now(), s.rev ?? 0);
          save();
          showList();
        }),
      );
    c.appendChild(row);
    c.appendChild(note);
    const more = el('div', 'lab-row');
    more.appendChild(button('lab-btn', 'Play again', () => start(s)));
    more.appendChild(button('lab-btn', 'Skip', showList));
    c.appendChild(more);
  }

  // ------------------------------------------------------------------ the report

  function report(): string {
    const lab = app.labAccuracy().recent.length;
    const acc = `${accuracyCopyLine(app.tuning, app.combinedAccuracy(), app.settings.calibrationMs)}; lab fights: ${lab} taps`;
    return labReport({ state, accuracy: acc, build: BUILD });
  }

  function copyReport(): void {
    void copyText(report()).then((ok) => toast(ok ? 'Report copied!' : 'Copy failed'));
  }

  // ------------------------------------------------------------------ open and leave

  function open(): void {
    state = readLabState(loadLabState());
    // the camp's padlock and a few icons come with the world map's art (painted after boot): finish it now
    getScene()?.ensureWorldArt();
    if (!app.inLab) app.enterLab();
    else stop(); // (opened again mid-scenario, from the gear panel: that scenario stops, unrated)
    getScene()?.hud.resetCoins();
    showList();
  }

  function leave(): void {
    playing = null;
    root.hidden = true;
    root.innerHTML = '';
    app.leaveLab();
    getScene()?.hud.resetCoins();
  }

  titleBtn.addEventListener('click', () => {
    app.audio.unlock();
    app.audio.uiClick();
    open();
  });
  // Done: the playtester has seen enough of the scenario on screen
  doneBtn.addEventListener('click', () => {
    app.audio.unlock();
    app.audio.uiClick();
    end();
  });

  // the title's button sits top left on the title; Done shows while a scenario plays
  let lastPos = '';
  const tick = () => {
    const onTitle = !app.inLab && app.run.phase === 'title' && !app.storyOverlay && !app.panelOpen;
    titleBtn.hidden = !onTitle;
    doneBtn.hidden = !(app.inLab && playing && root.hidden);
    if (onTitle) {
      const l = app.layout;
      const pos = `${l.left + ((l.safeLeft + 4) * l.cssW) / GAME_W}|${l.top + (3 * l.cssH) / GAME_H}`;
      if (pos !== lastPos) {
        lastPos = pos;
        const [x, y] = pos.split('|');
        titleBtn.style.left = `${x}px`;
        titleBtn.style.top = `${y}px`;
      }
    }
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);

  // the test handle (Playwright): the report as it would be copied, and the list's state
  (window as unknown as { __cq3lab: unknown }).__cq3lab = {
    report,
    get playing() {
      return playing?.id ?? null;
    },
    get state() {
      return state;
    },
  };

  return { open, leave };
}
