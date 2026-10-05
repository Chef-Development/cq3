// Debug / tuning panel (DOM). Every change applies live and is saved to localStorage. At the top: the player's
// accuracy (as the balance bot measures it) and its history, with a Copy button for the playtester.
import { AIM_WINDOW_MS, estimateAccuracy, MIN_SAMPLES } from '../core/accuracy';
import { TYPICAL_ACCURACY } from '../core/bot';
import { impactFeel, impactWeight } from '../core/impact';
import { cloneTuning, DEFAULT_SETTINGS, getPath, IMPACT_SOUND_SLIDERS, mergeKnown, setPath, sliderGroups, type Settings } from '../core/tuning';
import { heroFor } from '../core/run';
import type { App } from './app';
import { SFX } from './audio';
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
      () => app.relayout(),
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
    const mg = el('div', 'dbg-grid');
    for (const [name, label] of [
      ['battle', 'Music: battle theme'],
      ['boss', 'Music: boss theme'],
      ['map', 'Music: map theme'],
    ] as const) {
      const b = el('button', 'dbg-btn', label);
      b.onclick = () => {
        app.audio.unlock();
        app.audio.setTrack(name);
      };
      mg.appendChild(b);
    }
    lab.appendChild(mg);
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
    app.run.region.acts.forEach((act, a) => {
      const b = el('button', 'dbg-btn', `Act ${a + 1}: ${act.name} (map)`);
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

  /**
   * "Your accuracy" (top of the panel, open): the running estimate from the recent taps, measured exactly as the
   * balance bot defines accuracy, the act-by-act history, and a Copy button for the playtester to send it.
   */
  function accuracySection(parent: HTMLElement): void {
    const sec = el('details', 'dbg-sec dbg-acc');
    sec.open = true;
    sec.appendChild(el('summary', undefined, 'Your accuracy'));
    parent.appendChild(sec);
    const log = app.profile.acc;
    const e = estimateAccuracy(app.tuning, log.recent);
    const target = TYPICAL_ACCURACY;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const lateness = (b: number) => (Math.abs(b) < 1 ? 'right on time on average' : `${Math.round(Math.abs(b))} ms ${b > 0 ? 'late' : 'early'} on average`);
    const date = (at: number) => new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const top = el('div', 'acc-top');
    const big = el('div', `acc-big${e ? (e.acc >= target ? ' good' : e.acc < target - 0.1 ? ' low' : '') : ' none'}`, e ? pct(e.acc) : '--');
    const meta = el('div', 'acc-meta');
    if (e) meta.appendChild(el('div', 'acc-line', `from ${e.n} recent taps · timing spread ±${Math.round(e.sd)} ms · ${lateness(e.bias)}`));
    else {
      const have = log.recent.filter((x) => Math.abs(x) <= AIM_WINDOW_MS).length;
      meta.appendChild(el('div', 'acc-line', `Play a few fights to measure it: it needs ${MIN_SAMPLES} clear taps at plain yellow blocks (${have} so far).`));
    }
    // a meter: your accuracy against the 70% the game is tuned for
    const bar = el('div', 'acc-bar');
    const fill = el('div', 'acc-fill');
    fill.style.width = `${Math.round((e?.acc ?? 0) * 100)}%`;
    const mark = el('div', 'acc-mark');
    mark.style.left = `${Math.round(target * 100)}%`;
    mark.appendChild(el('span', undefined, `tuned for ${pct(target)}`));
    bar.append(fill, mark);
    meta.appendChild(bar);
    const copyBtn = el('button', 'dbg-btn acc-copy', 'Copy');
    copyBtn.onclick = () => {
      const hist = log.history
        .slice(-6)
        .reverse()
        .map((h) => `Act ${h.act + 1} ${pct(h.acc)} (${h.n} taps, ±${h.sd} ms, ${h.bias >= 0 ? '+' : ''}${h.bias} ms, ${date(h.at)})`)
        .join('; ');
      const now = e ? `${pct(e.acc)} from ${e.n} taps (spread ±${Math.round(e.sd)} ms, raw ±${Math.round(e.rawSd)} ms, ${e.bias >= 0 ? '+' : ''}${Math.round(e.bias)} ms)` : `not enough taps yet (${log.recent.length})`;
      const line = `CQ3 accuracy ${date(Date.now())}: ${now}; calibration ${app.settings.calibrationMs} ms${hist ? `; acts: ${hist}` : ''}`;
      copyText(line).then((ok) => toast(ok ? 'Copied!' : 'Copy failed'));
    };
    top.append(big, meta, copyBtn);
    sec.appendChild(top);

    if (log.history.length) {
      const list = el('ul', 'acc-hist');
      for (const h of log.history.slice().reverse()) {
        const li = el('li', h.acc >= target ? 'good' : h.acc < target - 0.1 ? 'low' : undefined);
        li.textContent = `Act ${h.act + 1} cleared · ${pct(h.acc)} · ${h.n} taps · ${date(h.at)}`;
        list.appendChild(li);
      }
      sec.appendChild(list);
    } else sec.appendChild(el('div', 'dbg-note', 'Clear an act to start your history (one entry per act cleared).'));
    sec.appendChild(
      el('div', 'dbg-note', `Same measure as the balance bot: the share of plain yellow blocks you hit at the starting speed. The game is tuned for ${pct(target)}.`),
    );
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
