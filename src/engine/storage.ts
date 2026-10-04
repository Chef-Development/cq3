// localStorage helpers. Every access is wrapped: storage can be missing or throw (private mode, quota).
import { cloneTuning, DEFAULT_SETTINGS, DEFAULT_TUNING, mergeKnown, tuningDiff, type Settings, type Tuning } from '../core/tuning';

// v2: only values changed from the defaults are stored, so new defaults reach players.
const TUNING_KEY = 'cq3.tuning.v2';
// v2: the finisher became a swipe by default, so older saved settings drop their finisher choice.
const SETTINGS_KEY = 'cq3.settings.v2';
const OLD_SETTINGS_KEY = 'cq3.settings.v1';

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
