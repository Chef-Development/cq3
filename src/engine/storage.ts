// localStorage helpers. Every access is wrapped: storage can be missing or throw (private mode, quota).
import { cloneTuning, DEFAULT_SETTINGS, DEFAULT_TUNING, mergeKnown, tuningDiff, type Settings, type Tuning } from '../core/tuning';

// v2: only values changed from the defaults are stored, so new defaults reach players.
const TUNING_KEY = 'cq3.tuning.v2';
const SETTINGS_KEY = 'cq3.settings.v1';

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
  } catch {
    /* ignore */
  }
}
