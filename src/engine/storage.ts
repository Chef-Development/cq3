// localStorage helpers. Every access is wrapped: storage can be missing or throw (private mode, quota).
import { readProgress, type Progress } from '../core/progress';
import { readSave, type RunSave } from '../core/save';
import { cloneTuning, DEFAULT_SETTINGS, DEFAULT_TUNING, mergeKnown, tuningDiff, type Settings, type Tuning } from '../core/tuning';

// Only values changed from the defaults are stored, so new defaults reach players. v3: every enemy and act was
// rebalanced (waves of foes, a player-calibrated bot), so changes saved against the old numbers are dropped.
const TUNING_KEY = 'cq3.tuning.v3';
const OLD_TUNING_KEY = 'cq3.tuning.v2';
// v2: the finisher became a swipe by default, so older saved settings drop their finisher choice.
const SETTINGS_KEY = 'cq3.settings.v2';
const OLD_SETTINGS_KEY = 'cq3.settings.v1';
// The run in progress (see core/save.ts; the save carries its own version, older ones are dropped).
const RUN_KEY = 'cq3.run.v3';
const OLD_RUN_KEY = 'cq3.run.v1';
// Progress across runs (see core/progress.ts).
const PROGRESS_KEY = 'cq3.progress.v1';

function read(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function loadTuning(): Tuning {
  const t = cloneTuning();
  try {
    window.localStorage.removeItem(OLD_TUNING_KEY);
  } catch {
    /* ignore */
  }
  const saved = read(TUNING_KEY);
  if (saved) mergeKnown(t, saved);
  return t;
}

export function loadSettings(): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS };
  const saved = read(SETTINGS_KEY);
  if (saved) mergeKnown(s, saved);
  else {
    const old = read(OLD_SETTINGS_KEY) as Record<string, unknown> | null;
    if (old) {
      delete old.finisherInput;
      mergeKnown(s, old);
    }
  }
  return s;
}

let timer: number | undefined;
export function saveSoon(t: Tuning, s: Settings): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => saveNow(t, s), 250);
}

export function saveNow(t: Tuning, s: Settings): void {
  window.clearTimeout(timer);
  write(TUNING_KEY, tuningDiff(t, DEFAULT_TUNING) ?? {});
  write(SETTINGS_KEY, s);
  try {
    window.localStorage.removeItem('cq3.tuning.v1');
    window.localStorage.removeItem(OLD_SETTINGS_KEY);
  } catch {
    /* ignore */
  }
}

/** The saved run, if there is one this build can resume. */
export function loadRunSave(t: Tuning): RunSave | null {
  return readSave(read(RUN_KEY), t);
}

export function writeRunSave(s: RunSave): void {
  write(RUN_KEY, s);
  try {
    window.localStorage.removeItem(OLD_RUN_KEY);
  } catch {
    /* ignore */
  }
}

export function clearRunSave(): void {
  try {
    window.localStorage.removeItem(RUN_KEY);
  } catch {
    /* ignore */
  }
}

export function loadProgress(): Progress {
  return readProgress(read(PROGRESS_KEY));
}

export function writeProgress(p: Progress): void {
  write(PROGRESS_KEY, p);
}
