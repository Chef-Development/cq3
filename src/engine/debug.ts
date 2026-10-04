// Debug / tuning panel (DOM). Every change applies live and is saved to localStorage.
import { cloneTuning, DEFAULT_SETTINGS, getPath, mergeKnown, setPath, sliderGroups, type Settings } from '../core/tuning';
import type { App } from './app';
import { runCalibration } from './calibrate';
import { saveNow } from './storage';

type Opt<T> = [T, string];

export interface DebugUi {
  togglePanel(): void;
  refreshHud(): void;
}

export function installDebug(app: App): DebugUi {
  const root = document.getElementById('debug')!;
  const pauseBtn = document.getElementById('btn-pause')!;
  const gearBtn = document.getElementById('btn-gear')!;

  const refreshHud = () => {
    pauseBtn.classList.toggle('on', app.userPaused);
    pauseBtn.setAttribute('aria-pressed', String(app.userPaused));
  };

  const toast = (msg: string) => {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    window.setTimeout(() => t.remove(), 1400);
  };

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  const decimals = (step: number) => (step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step) - 1e-9)));

  let rebuild = () => {};

  const build = () => {
    root.innerHTML = '';
    const head = el('div', 'dbg-head');
    head.appendChild(el('div', 'dbg-title', 'TUNING'));
    const play = el('button', 'dbg-btn', app.playWhilePanelOpen ? '❚❚ Pause' : '▶ Play');
    play.onclick = () => {
      app.playWhilePanelOpen = !app.playWhilePanelOpen;
      app.syncClock(performance.now());
      play.textContent = app.playWhilePanelOpen ? '❚❚ Pause' : '▶ Play';
    };
    const close = el('button', 'dbg-btn', '✕');
    close.setAttribute('aria-label', 'Close');
    close.onclick = () => setOpen(false);
    head.append(play, close);
    root.appendChild(head);

    const body = el('div', 'dbg-body');
    root.appendChild(body);

    const section = (title: string) => {
      const s = el('details', 'dbg-sec');
      s.open = title === 'Modes' || title === 'Jump to';
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

    const modes = section('Modes');
    seg(modes, 'Empty tap', 'mode', [
      ['classic', 'Classic'],
      ['relaxed', 'Relaxed'],
    ]);
    seg(modes, 'Finisher', 'finisherInput', [
      ['button', 'Button'],
      ['swipe', 'Swipe up'],
    ]);
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

    const jump = section('Jump to');
    const jg = el('div', 'dbg-grid');
    app.tuning.levels.forEach((lvl, li) =>
      lvl.stages.forEach((stage, si) => {
        const names = stage.map((k) => app.tuning.enemies[k]?.name ?? k).join(' + ');
        const b = el('button', 'dbg-btn', `${lvl.name.replace(/level /i, 'L')}: ${names}`);
        b.onclick = () => {
          app.setPhase(() => app.run.startLevel(li, si));
          setOpen(false);
        };
        jg.appendChild(b);
      }),
    );
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
    const copy = el('button', 'dbg-btn', 'Copy tuning as JSON');
    copy.onclick = () => copyText(JSON.stringify({ tuning: app.tuning, settings: app.settings }, null, 2)).then((ok) => toast(ok ? 'Copied!' : 'Copy failed'));
    const load = el('button', 'dbg-btn', 'Paste JSON…');
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
    const resetT = el('button', 'dbg-btn', 'Reset tuning');
    resetT.onclick = () => {
      if (!window.confirm('Reset all tuning numbers to defaults?')) return;
      mergeKnown(app.tuning, cloneTuning());
      app.tuning.levels = cloneTuning().levels;
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
    tg.append(copy, load, resetT, resetS);
    tools.appendChild(tg);
    body.appendChild(el('div', 'dbg-foot', 'Keys: Space tap · F finisher · P pause · ` panel'));
  };

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
      for (const e of c.enemies)
        if (e.key === m[1] && e.alive) {
          e.hp = Math.max(1, Math.round((e.hp / e.maxHp) * v));
          e.maxHp = v;
        }
    }
    if (path === 'hero.maxHp') {
      const H = app.run.hero;
      H.hp = Math.min(H.hp, v + H.bonusMaxHp);
    }
  };

  const setOpen = (open: boolean) => {
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

  return { togglePanel: () => setOpen(!app.panelOpen), refreshHud };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:0;top:0;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}
