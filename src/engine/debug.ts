// Debug / tuning panel (DOM). Every change applies live and is saved to localStorage. At the top: the player's
// accuracy (as the balance bot measures it) and its history, with a Copy button for the playtester.
import { pct, whole } from '../core/format';
import { REGIONS } from '../data/regions';
import { accuracyCopyLine, AIM_WINDOW_MS, estimateAccuracy, MIN_SAMPLES } from '../core/accuracy';
import { TYPICAL_ACCURACY } from '../core/bot';
import { impactFeel, impactWeight } from '../core/impact';
import { cloneTuning, DEFAULT_SETTINGS, getPath, IMPACT_SOUND_SLIDERS, mergeKnown, setPath, sliderGroups, type Settings } from '../core/tuning';
import { heroFor } from '../core/run';
import type { App } from './app';
import { MUSIC_PIECES, SFX, type MusicPiece } from './audio';
import { runCalibration } from './calibrate';
import { copyText, toast } from './clipboard';
import { loadCleanCapture, saveCleanCapture, saveNow } from './storage';
import { setAllUnlocked } from '../core/roster';
import { type MotionPref } from '../core/a11y';
import { A11Y, setA11y } from './a11y';

type Opt<T> = [T, string];

export interface DebugUi {
  togglePanel(): void;
  refreshHud(): void;
  /** The clean capture on or off (C on a keyboard; a long press where the gear button sits brings it back). */
  toggleCapture(): void;
}

export function installDebug(app: App, testLab?: { open(): void }): DebugUi {
  const root = document.getElementById('debug')!;
  const pauseBtn = document.getElementById('btn-pause')!;
  const gearBtn = document.getElementById('btn-gear')!;

  // the clean capture: the gear and Test lab buttons hidden for recording clips (style.css html.clean-capture)
  let capture = loadCleanCapture();
  const applyCapture = () => document.documentElement.classList.toggle('clean-capture', capture);
  applyCapture();
  const setCapture = (on: boolean) => {
    capture = on;
    saveCleanCapture(on);
    applyCapture();
    if (on) {
      setOpen(false);
      toast('Clean capture: hold the top middle to undo');
    }
  };

  // full screen (a browser tab on Android or a desktop; an iPhone's Safari has none and an installed app already is):
  // one listener keeps whichever panel is open in step
  let fullscreenSync: (() => void) | null = null;
  document.addEventListener('fullscreenchange', () => fullscreenSync?.());
  const canFullscreen = (): boolean => !!document.fullscreenEnabled && !matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;

  const refreshHud = () => {
    pauseBtn.classList.toggle('on', app.userPaused);
    pauseBtn.setAttribute('aria-pressed', String(app.userPaused));
  };

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  const decimals = (step: number) => (step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step) - 1e-9)));

  let rebuild = () => {};
  /** The Sound lab's music choice (kept while the panel is rebuilt). */
  const labMusic: { piece: MusicPiece | null; combo: number } = { piece: null, combo: 0 };

  const build = () => {
    root.innerHTML = '';
    const head = el('div', 'dbg-head');
    head.appendChild(el('div', 'dbg-title', 'OPTIONS'));
    const play = el('button', 'dbg-btn', app.playWhilePanelOpen ? '❚❚ Pause' : '▶ Play');
    play.onclick = () => {
      app.playWhilePanelOpen = !app.playWhilePanelOpen;
      app.syncClock(performance.now());
      play.textContent = app.playWhilePanelOpen ? '❚❚ Pause' : '▶ Play';
    };
    const close = el('button', 'dbg-btn', '✕');
    close.setAttribute('aria-label', 'Close');
    close.onclick = () => setOpen(false);
    // the Test lab: short scenarios of what's new, on a save of its own (engine/lab.ts)
    const labBtn = el('button', 'dbg-btn lab-open', 'Test lab');
    labBtn.onclick = () => {
      setOpen(false);
      testLab?.open();
    };
    head.append(labBtn, play, close);
    root.appendChild(head);

    const body = el('div', 'dbg-body');
    root.appendChild(body);

    const section = (title: string) => {
      const s = el('details', 'dbg-sec');
      s.open = title === 'Modes' || title === 'Jump to' || title === 'Sound lab';
      s.appendChild(el('summary', undefined, title));
      body.appendChild(s);
      return s;
    };

    const seg = <K extends keyof Settings>(parent: HTMLElement, label: string, key: K, opts: Opt<Settings[K]>[], after?: () => void) => {
      const row = el('div', 'dbg-row');
      row.appendChild(el('span', 'dbg-label', label));
      const g = el('div', 'dbg-seg');
      const btns = opts.map(([v, text]) => {
        const b = el('button', 'dbg-segbtn', text);
        b.onclick = () => {
          app.settings[key] = v;
          btns.forEach((x, i) => x.classList.toggle('on', opts[i][0] === v));
          app.save();
          after?.();
        };
        b.classList.toggle('on', app.settings[key] === v);
        return b;
      });
      g.append(...btns);
      row.appendChild(g);
      parent.appendChild(row);
    };

    accuracySection(body);

    const modes = section('Modes');
    seg(modes, 'Empty tap', 'mode', [
      ['classic', 'Classic'],
      ['relaxed', 'Relaxed'],
    ]);
    seg(
      modes,
      'Finisher',
      'finisherInput',
      [
        ['swipe', 'Swipe'],
        ['button', 'Button'],
      ],
      () => app.relayout(true),
    );
    seg(modes, 'Combo tiers', 'comboTiers', [
      [false, 'Off'],
      [true, 'On'],
    ]);
    seg(modes, 'Targeting', 'targeting', [
      ['auto', 'Auto'],
      ['tap', 'Tap'],
    ]);
    seg(modes, 'God mode', 'godMode', [
      [false, 'Off'],
      [true, 'On'],
    ]);
    seg(
      modes,
      'Sound',
      'muted',
      [
        [false, 'On'],
        [true, 'Off'],
      ],
      () => app.applyAudioSettings(),
    );
    seg(
      modes,
      'Music',
      'music',
      [
        [true, 'On'],
        [false, 'Off'],
      ],
      () => app.applyAudioSettings(),
    );
    seg(
      modes,
      'Silent switch',
      'audioIgnoresSilentSwitch',
      [
        [true, 'Ignore'],
        [false, 'Obey'],
      ],
      () => app.applyAudioSettings(),
    );

    // the clean capture (not a setting of the game: kept on its own, storage.ts)
    {
      const row = el('div', 'dbg-row');
      row.appendChild(el('span', 'dbg-label', 'Clean capture'));
      const g = el('div', 'dbg-seg');
      const off = el('button', 'dbg-segbtn', 'Off');
      const on = el('button', 'dbg-segbtn', 'On');
      off.classList.toggle('on', !capture);
      on.classList.toggle('on', capture);
      off.onclick = () => setCapture(false);
      on.id = 'capture-on';
      on.onclick = () => setCapture(true);
      g.append(off, on);
      row.appendChild(g);
      modes.appendChild(row);
      modes.appendChild(el('div', 'dbg-note', 'Hides this gear button and the Test lab for recording clips. Hold the top middle of the screen (or press C) to bring them back.'));
    }
    // accessibility (engine/a11y.ts; kept on their own, storage.ts): marks on the reds, less motion
    {
      const pick = <T,>(label: string, opts: Array<[T, string]>, now: () => T, set: (v: T) => void, note?: string) => {
        const row = el('div', 'dbg-row');
        row.appendChild(el('span', 'dbg-label', label));
        const g = el('div', 'dbg-seg');
        for (const [v, name] of opts) {
          const b = el('button', 'dbg-segbtn', name);
          b.classList.toggle('on', now() === v);
          b.onclick = () => {
            set(v);
            for (const o of Array.from(g.children)) o.classList.toggle('on', o === b);
          };
          g.appendChild(b);
        }
        row.appendChild(g);
        modes.appendChild(row);
        if (note) modes.appendChild(el('div', 'dbg-note', note));
      };
      pick('Block marks', [[false, 'Off'], [true, 'On']], () => A11Y.settings.marks, (v) => setA11y({ marks: v }), 'A mark on every red block, so no block is told apart by its colour alone.');
      pick(
        'Motion',
        [['auto', 'Auto'], ['less', 'Less'], ['full', 'Full']],
        () => A11Y.settings.motion,
        (v: MotionPref) => setA11y({ motion: v }),
        'Less: no screen shake, softer flashes. Auto follows the device.',
      );
    }
    if (canFullscreen()) {
      const row = el('div', 'dbg-row');
      row.appendChild(el('span', 'dbg-label', 'Full screen'));
      const g = el('div', 'dbg-seg');
      const off = el('button', 'dbg-segbtn', 'Off');
      const on = el('button', 'dbg-segbtn', 'On');
      fullscreenSync = () => {
        off.classList.toggle('on', !document.fullscreenElement);
        on.classList.toggle('on', !!document.fullscreenElement);
      };
      fullscreenSync();
      on.onclick = () => void enterFullscreen();
      off.onclick = () => void (document.fullscreenElement && document.exitFullscreen().catch(() => undefined));
      g.append(off, on);
      row.appendChild(g);
      modes.appendChild(row);
    }

    // Sound lab: play every sound effect and tune the impact layers by ear, on the phone
    const lab = section('Sound lab');
    lab.appendChild(el('div', 'dbg-note', 'Tap to play. Impacts are listed lightest first. Turn the phone up and try with and without headphones.'));
    const lg = el('div', 'dbg-grid');
    for (const e of SFX) {
      const b = el('button', e.tier ? 'dbg-btn impact' : 'dbg-btn', e.label);
      b.onclick = () => {
        const a = app.audio;
        a.unlock();
        const ctx = a.ctx;
        if (!ctx) return;
        const at = ctx.currentTime + 0.03;
        e.play(a, at);
        if (e.tier) {
          const feel = impactFeel(app.tuning, impactWeight(app.tuning, e.tier, e.stacks ?? 1));
          a.duckMusic(feel.duck, feel.duckMs, at);
        }
      };
      lg.appendChild(b);
    }
    lab.appendChild(lg);
    musicLab(lab);
    for (const sd of IMPACT_SOUND_SLIDERS)
      slider(lab, sd.label, sd.min, sd.max, sd.step, () => getPath(app.tuning, sd.path), (v) => {
        setPath(app.tuning, sd.path, v);
        app.save();
      });

    const jump = section('Jump to');
    const jg = el('div', 'dbg-grid');
    const go = (fn: () => void) => {
      app.setPhase(fn);
      setOpen(false);
    };
    // (later regions' names and foes are a surprise: their acts show by number only)
    const secret = (a: number) => a >= REGIONS[0].acts.length;
    app.run.region.acts.forEach((act, a) => {
      const b = el('button', 'dbg-btn', secret(a) ? `Act ${a + 1} (map)` : `Act ${a + 1}: ${act.name} (map)`);
      // arrive with the upgrades a player would have earned on the way
      b.onclick = () =>
        go(() => {
          app.run.hero = heroFor(app.tuning, a);
          app.run.enterAct(a);
        });
      jg.appendChild(b);
    });
    // a fight against each enemy, in the act it first shows up in
    const seen = new Set<string>();
    app.run.region.acts.forEach((act, a) => {
      if (secret(a)) return;
      const groups: Array<[string[], 'fight' | 'elite' | 'boss']> = [
        ...[...act.fights.early, ...act.fights.late].map((g): [string[], 'fight'] => [g, 'fight']),
        ...act.elites.map((g): [string[], 'elite'] => [g, 'elite']),
        [act.boss, 'boss'],
      ];
      for (const [g, type] of groups) {
        const key = g[0];
        if (seen.has(key)) continue;
        seen.add(key);
        const enemies = key === 'wolf' ? ['wolf', 'wolf'] : type === 'fight' ? [key] : g;
        const names = enemies.map((k) => app.tuning.enemies[k]?.name ?? k).join(' + ');
        const b = el('button', 'dbg-btn', `A${a + 1}: ${names}`);
        b.onclick = () => go(() => app.run.debugFight(a, enemies, type, heroFor(app.tuning, a)));
        jg.appendChild(b);
      }
    });
    jump.appendChild(jg);

    const cal = section('Calibration');
    const calRow = slider(cal, 'Offset (ms, + = you tap late)', -200, 300, 1, () => app.settings.calibrationMs, (v) => {
      app.settings.calibrationMs = v;
      app.save();
    });
    const calBtn = el('button', 'dbg-btn wide', 'Calibrate: tap along to a metronome');
    calBtn.onclick = () => {
      app.audio.unlock();
      runCalibration(app, () => {
        calRow.sync();
      });
    };
    cal.appendChild(calBtn);

    for (const group of sliderGroups(app.tuning)) {
      const sec = section(group.title);
      for (const s of group.sliders)
        slider(sec, s.label, s.min, s.max, s.step, () => getPath(app.tuning, s.path), (v) => {
          setPath(app.tuning, s.path, v);
          onTuningChanged(s.path, v);
          app.save();
        });
    }

    const tools = section('Export');
    tools.open = true;
    const tg = el('div', 'dbg-grid');
    const copy = el('button', 'dbg-btn', 'Copy game numbers');
    copy.onclick = () => copyText(JSON.stringify({ tuning: app.tuning, settings: app.settings }, null, 2)).then((ok) => toast(ok ? 'Copied!' : 'Copy failed'));
    const load = el('button', 'dbg-btn', 'Paste game numbers…');
    load.onclick = () => {
      const raw = window.prompt('Paste tuning JSON');
      if (!raw) return;
      try {
        const obj = JSON.parse(raw) as { tuning?: unknown; settings?: unknown };
        mergeKnown(app.tuning, obj.tuning ?? obj);
        if (obj.settings) mergeKnown(app.settings, obj.settings);
        saveNow(app.tuning, app.settings);
        app.applyAudioSettings();
        rebuild();
        toast('Loaded');
      } catch {
        toast('Invalid JSON');
      }
    };
    const resetT = el('button', 'dbg-btn', 'Reset game numbers');
    resetT.onclick = () => {
      if (!window.confirm('Reset all tuning numbers to defaults?')) return;
      mergeKnown(app.tuning, cloneTuning());
      saveNow(app.tuning, app.settings);
      rebuild();
      toast('Tuning reset');
    };
    const resetS = el('button', 'dbg-btn', 'Reset settings');
    resetS.onclick = () => {
      if (!window.confirm('Reset modes and calibration?')) return;
      Object.assign(app.settings, DEFAULT_SETTINGS);
      saveNow(app.tuning, app.settings);
      app.applyAudioSettings();
      rebuild();
      toast('Settings reset');
    };
    const over = el('button', 'dbg-btn', 'Start over');
    over.onclick = () => {
      // the same as the title's New game: erases it all (twice asked: it can't be undone)
      if (!window.confirm('Start over? This erases ALL progress: acts, gear, coins, scrap, heroes, skills and relics.')) return;
      if (!window.confirm('Really erase everything? There is no undo.')) return;
      app.startOver();
    };
    // the tips ("teach it slowly"): turn them off, or see every one again
    const tipsLabel = () => (app.profile.tipsOff ? 'Tips: off' : 'Tips: on');
    const tips = el('button', 'dbg-btn', tipsLabel());
    tips.onclick = () => {
      app.setTipsOff(!app.profile.tipsOff);
      tips.textContent = tipsLabel();
    };
    const again = el('button', 'dbg-btn', 'Show tips again');
    again.onclick = () => {
      app.showTipsAgain();
      tips.textContent = tipsLabel();
      toast('Tips will show again');
    };
    // every hero and companion to try out (a toggle: off puts things back as they were; it never earns achievements)
    const allLabel = () => (app.profile.allUnlocked ? 'Unlock all heroes and companions: on' : 'Unlock all heroes and companions: off');
    const all = el('button', 'dbg-btn', allLabel());
    all.onclick = () => {
      setAllUnlocked(app.profile, !app.profile.allUnlocked);
      app.saveProfile();
      app.run.refreshGear();
      all.textContent = allLabel();
      toast(app.profile.allUnlocked ? 'Every hero and companion unlocked' : 'Back to the ones you have');
    };
    tg.append(copy, load, resetT, resetS, tips, again, all, over);
    tools.appendChild(tg);
    body.appendChild(el('div', 'dbg-foot', 'Keys: Space tap · F finisher · P pause · ` panel'));
    body.appendChild(el('div', 'dbg-foot', `Version ${typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'}`));
  };

  /**
   * "Your accuracy" (top of the panel, open): the running estimate from the recent taps, measured exactly as the
   * balance bot defines accuracy, the act-by-act history, and a Copy button for the playtester to send it.
   */
  function accuracySection(parent: HTMLElement): void {
    const sec = el('details', 'dbg-sec dbg-acc');
    sec.open = true;
    sec.appendChild(el('summary', undefined, 'Your accuracy'));
    parent.appendChild(sec);
    const log = app.realProfile.acc; // (the real game's, also from inside the Test lab)
    const e = estimateAccuracy(app.tuning, log.recent);
    const target = TYPICAL_ACCURACY;
    const lateness = (b: number) => (Math.abs(b) < 1 ? 'right on time on average' : `${whole(Math.abs(b))} ms ${b > 0 ? 'late' : 'early'} on average`);
    const date = (at: number) => new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const top = el('div', 'acc-top');
    const big = el('div', `acc-big${e ? (e.acc >= target ? ' good' : e.acc < target - 0.1 ? ' low' : '') : ' none'}`, e ? pct(e.acc) : '--');
    const meta = el('div', 'acc-meta');
    if (e) meta.appendChild(el('div', 'acc-line', `from ${whole(e.n)} recent taps · timing spread ±${whole(e.sd)} ms · ${lateness(e.bias)}`));
    else {
      const have = log.recent.filter((x) => Math.abs(x) <= AIM_WINDOW_MS).length;
      meta.appendChild(el('div', 'acc-line', `Play a few fights to measure it: it needs ${MIN_SAMPLES} taps on plain yellows (${have} so far).`));
    }
    // a meter: your accuracy against the accuracy the game is tuned for (TYPICAL_ACCURACY)
    const bar = el('div', 'acc-bar');
    const fill = el('div', 'acc-fill');
    fill.style.width = `${Math.round((e?.acc ?? 0) * 100)}%`;
    const mark = el('div', 'acc-mark');
    mark.style.left = `${Math.round(target * 100)}%`;
    mark.appendChild(el('span', undefined, `tuned for ${pct(target)}`));
    bar.append(fill, mark);
    meta.appendChild(bar);
    const copyBtn = el('button', 'dbg-btn acc-copy', 'Copy');
    copyBtn.onclick = () => copyText(accuracyCopyLine(app.tuning, log, app.settings.calibrationMs)).then((ok) => toast(ok ? 'Copied!' : 'Copy failed'));
    top.append(big, meta, copyBtn);
    sec.appendChild(top);

    if (log.history.length) {
      const list = el('ul', 'acc-hist');
      for (const h of log.history.slice().reverse()) {
        const li = el('li', h.acc >= target ? 'good' : h.acc < target - 0.1 ? 'low' : undefined);
        li.textContent = `Act ${h.act + 1} cleared · ${pct(h.acc)} · ${whole(h.n)} taps · ${date(h.at)}`;
        list.appendChild(li);
      }
      sec.appendChild(list);
    } else sec.appendChild(el('div', 'dbg-note', 'Clear an act to start your history.'));
    sec.appendChild(
      el('div', 'dbg-note', `The share of plain yellows you hit at the starting speed. The game is tuned for ${pct(target)}.`),
    );
  }

  /**
   * The music in the Sound lab: every piece (an act's map and fight arrangements crossfade like in the game), the
   * fight layers at a chosen combo, each region's boss per phase (MUSIC_PIECES; Regions 2 and 3 are labelled by act,
   * not by name). It plays instead of the game's music until the panel closes (or "Game's music").
   */
  function musicLab(parent: HTMLElement): void {
    parent.appendChild(el('div', 'dbg-note', "Music: tap a piece. Pick a combo to hear the fight layers join (drums, bass, lead). The game's music comes back when the panel closes."));
    const play = () => {
      const p = labMusic.piece;
      if (!p) return;
      app.audio.unlock();
      app.audio.audition(p.track, { intense: p.intense, combo: labMusic.combo, phase: p.phase ?? 1 });
    };
    // the piece playing is lit like a picked segment
    const mark = (b: HTMLElement, on: boolean) => {
      b.style.background = on ? '#ff9a2a' : '';
      b.style.color = on ? 'var(--ink)' : '';
    };
    const grid = el('div', 'dbg-grid');
    const btns = MUSIC_PIECES.map((p) => {
      const b = el('button', 'dbg-btn', p.label);
      b.onclick = () => {
        labMusic.piece = p;
        btns.forEach((x, i) => mark(x, MUSIC_PIECES[i] === p));
        play();
      };
      mark(b, app.audio.auditioning && labMusic.piece === p);
      grid.appendChild(b);
      return b;
    });
    const back = el('button', 'dbg-btn', "Game's music");
    back.onclick = () => {
      app.audio.audition(null);
      btns.forEach((x) => mark(x, false));
    };
    grid.appendChild(back);
    parent.appendChild(grid);
    const m = app.tuning.music;
    const row = el('div', 'dbg-row');
    row.appendChild(el('span', 'dbg-label', 'Combo'));
    const seg = el('div', 'dbg-seg');
    const combos = [0, m.drumsAt, m.bassAt, m.leadAt];
    const cbtns = combos.map((c) => {
      const b = el('button', 'dbg-segbtn', String(c));
      b.onclick = () => {
        labMusic.combo = c;
        cbtns.forEach((x, i) => x.classList.toggle('on', combos[i] === c));
        play();
      };
      b.classList.toggle('on', labMusic.combo === c);
      return b;
    });
    seg.append(...cbtns);
    row.appendChild(seg);
    parent.appendChild(row);
  }

  function slider(parent: HTMLElement, label: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void) {
    const row = el('div', 'dbg-row slider');
    const top = el('div', 'dbg-slabel');
    const name = el('span', undefined, label);
    const val = el('span', 'dbg-val');
    top.append(name, val);
    const input = el('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    const d = decimals(step);
    const sync = () => {
      const v = get();
      input.value = String(v);
      val.textContent = v.toFixed(d);
    };
    input.oninput = () => {
      const v = Number(Number(input.value).toFixed(d));
      set(v);
      val.textContent = v.toFixed(d);
    };
    sync();
    row.append(top, input);
    parent.appendChild(row);
    return { sync };
  }

  const onTuningChanged = (path: string, v: number) => {
    const c = app.run.combat;
    const m = /^enemies\.(\w+)\.hp$/.exec(path);
    if (m && c) {
      const n = app.run.node;
      const hp = Math.max(1, Math.round(v * app.run.actScale.hpMult * (1 + app.tuning.map.rowHp * (n?.row ?? 0))));
      for (const e of c.enemies)
        if (e.key === m[1] && e.alive) {
          e.hp = Math.max(1, Math.round((e.hp / e.maxHp) * hp));
          e.maxHp = hp;
        }
    }
    if (path === 'hero.maxHp') {
      const H = app.run.hero;
      H.hp = Math.min(H.hp, v + H.bonusMaxHp);
    }
  };

  const setOpen = (open: boolean) => {
    if (!open) app.audio.audition(null); // the Sound lab's music hands back to the game's
    app.panelOpen = open;
    root.hidden = !open;
    gearBtn.classList.toggle('on', open);
    if (open) build();
    app.syncClock(performance.now());
  };

  rebuild = () => {
    if (app.panelOpen) build();
  };

  gearBtn.addEventListener('click', () => {
    app.audio.unlock();
    setOpen(!app.panelOpen);
  });
  pauseBtn.addEventListener('click', () => {
    app.audio.unlock();
    if (app.run.phase !== 'fight') return;
    app.userPaused = !app.userPaused;
    app.syncClock(performance.now());
    refreshHud();
  });

  return { togglePanel: () => setOpen(!app.panelOpen), refreshHud, toggleCapture: () => setCapture(!capture) };
}

/** Full screen from a tap (the gear panel), and on a phone held upright, sideways (Android allows the lock in full
 *  screen; elsewhere it's refused and nothing happens). The layout follows by itself (main.ts relayouts on resize). */
async function enterFullscreen(): Promise<void> {
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    return;
  }
  try {
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
  } catch {
    /* a desktop, or a browser without the lock */
  }
}
