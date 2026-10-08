// localStorage helpers. Every access is wrapped: storage can be missing or throw (private mode, quota).
import { readProfile, type Profile } from '../core/profile';
import { migrateSave, readSave, type RunSave } from '../core/save';
import { cloneTuning, DEFAULT_SETTINGS, DEFAULT_TUNING, mergeKnown, tuningDiff, type Settings, type Tuning } from '../core/tuning';

// Only values changed from the defaults are stored, so new defaults reach players. v3: every enemy and act was
// rebalanced (waves of foes, a player-calibrated bot), so changes saved against the old numbers are dropped.
const TUNING_KEY = 'cq3.tuning.v3';
const OLD_TUNING_KEY = 'cq3.tuning.v2';
// v2: the finisher became a swipe by default, so older saved settings drop their finisher choice.
const SETTINGS_KEY = 'cq3.settings.v2';
const OLD_SETTINGS_KEY = 'cq3.settings.v1';
// The run in progress (see core/save.ts; the save carries its own version, older ones are dropped).
const OLD_RUN_KEY = 'cq3.run.v1';
// The profile, kept across runs (see core/profile.ts): progress, the bag and gear, coins, scrap, bad-luck counters,
// the accuracy log. v1 was the progress alone; it is migrated.
const OLD_PROGRESS_KEY = 'cq3.progress.v1';

/**
 * Which save the profile and the run go to: the real game's ('main'), or the Test lab's ('lab': its own profile and
 * run keys, so the lab never reads or writes the real ones; leaving the lab switches back). Tuning and settings are
 * shared. The lab's ratings live in a key of their own (LAB_STATE_KEY), kept across reloads.
 */
export type StorageSlot = 'main' | 'lab';
const SLOT_KEYS: Record<StorageSlot, { profile: string; run: string }> = {
  main: { profile: 'cq3.profile.v2', run: 'cq3.run.v3' },
  lab: { profile: 'cq3.lab.profile', run: 'cq3.lab.run' },
};
export const LAB_STATE_KEY = 'cq3.lab.ratings';
/** The Test lab fights' timing samples (the lab report's accuracy counts them with the real game's). */
export const LAB_ACC_KEY = 'cq3.lab.acc';
let slot: StorageSlot = 'main';

/** The profile and run keys of a slot (the current one by default). */
export const storageKeys = (s: StorageSlot = slot): { profile: string; run: string } => SLOT_KEYS[s];
export const storageSlot = (): StorageSlot => slot;
export function setStorageSlot(s: StorageSlot): void {
  slot = s;
}

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

/** The saved run, if there is one this build can resume. An older save is migrated (a v4 save's coins go into the
 *  profile's purse) and both are written back at once, so it happens only once. */
export function loadRunSave(t: Tuning, profile: Profile): RunSave | null {
  const raw = read(storageKeys().run);
  const data = migrateSave(raw, profile);
  if (data !== raw) {
    write(storageKeys().run, data);
    writeProfile(profile);
  }
  return readSave(data, t);
}

/** "Start over" erased the progress and the page is reloading: until it does, nothing writes the old one back. */
let erased = false;

/** Start over: erase the profile (progress, gear, coins, levels, relics) and the run in progress. Tuning and settings
 *  (calibration, sound) stay. The caller reloads the page. (Always the real game's save: the app leaves the lab first.) */
export function eraseProgress(): void {
  erased = true;
  for (const key of [SLOT_KEYS.main.profile, OLD_PROGRESS_KEY, SLOT_KEYS.main.run, OLD_RUN_KEY]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export function writeRunSave(s: RunSave): void {
  if (erased) return;
  write(storageKeys().run, s);
  if (slot === 'main')
    try {
      window.localStorage.removeItem(OLD_RUN_KEY);
    } catch {
      /* ignore */
    }
}

export function clearRunSave(): void {
  try {
    window.localStorage.removeItem(storageKeys().run);
  } catch {
    /* ignore */
  }
}

export function loadProfile(t?: Tuning): Profile {
  const p = read(storageKeys().profile);
  return readProfile(p ?? (slot === 'main' ? read(OLD_PROGRESS_KEY) : null), t);
}

export function writeProfile(p: Profile): void {
  if (erased) return;
  write(storageKeys().profile, p);
  if (slot === 'main')
    try {
      window.localStorage.removeItem(OLD_PROGRESS_KEY);
    } catch {
      /* ignore */
    }
}

/** The Test lab's ratings and its spoiler switch (raw; core/lab.ts readLabState checks it). */
export const loadLabState = (): unknown => read(LAB_STATE_KEY);
export const writeLabState = (v: unknown): void => write(LAB_STATE_KEY, v);
/** The lab fights' accuracy log (raw; core/accuracy.ts readAccuracyLog checks it). */
export const loadLabAcc = (): unknown => read(LAB_ACC_KEY);
export const writeLabAcc = (v: unknown): void => write(LAB_ACC_KEY, v);

// ------------------------------------------------------------------ the chest reveal (a test, not shown to players)

/**
 * Which chest reveal the game plays: its own ('old', the default) or the sharper test drawn on a finer grid ('hd',
 * view/chest-hd.ts). Not in the gear panel: the Test lab compares them side by side; the rollout flips the default.
 */
export type ChestRevealMode = 'old' | 'hd';
const CHEST_REVEAL_KEY = 'cq3.chestReveal';
/** A stored value as a mode: anything but 'hd' is the old reveal. */
export const readChestReveal = (v: unknown): ChestRevealMode => (v === 'hd' ? 'hd' : 'old');
export const loadChestReveal = (): ChestRevealMode => readChestReveal(read(CHEST_REVEAL_KEY));
export const saveChestReveal = (m: ChestRevealMode): void => write(CHEST_REVEAL_KEY, m);
