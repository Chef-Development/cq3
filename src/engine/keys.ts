// Desktop keys (pure: no DOM, unit-tested in tests/unit/keys.test.ts). Two modes:
// - 'fight' (a live fight: the bar is running, nothing over it): Space, J or K taps the bar (judged by the key event's
//   timeStamp mapped to sim time, exactly like a pointer tap; held down on a hold block, the key's release lets go),
//   F, Enter or Up fires the finisher (the mouse's swipe works too), P or Escape pauses.
// - 'menu' (everything else, a paused fight included): the arrows move a focus ring between the screen's buttons, Tab
//   and Shift+Tab step through them in reading order, Enter or Space presses (with no ring up: the screen's default,
//   as before), Escape (or Backspace) goes back or closes, P pauses a fight.
// Anywhere: ` opens the gear panel, C toggles the clean capture (no gear or debug buttons, for recording clips).
// Phones never see any of this: there is no keyboard to press.

export type KeyAct =
  | 'tap'
  | 'finisher'
  | 'pause'
  | 'press'
  | 'back'
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'next'
  | 'prev'
  | 'panel'
  | 'capture';

export type KeyMode = 'fight' | 'menu';

export interface KeyMods {
  shift?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  meta?: boolean;
}

/** What a key does (null: nothing, and the browser keeps it). Shortcuts with Ctrl, Alt or Cmd are the browser's. */
export function keyAction(key: string, mode: KeyMode, mods: KeyMods = {}): KeyAct | null {
  if (mods.ctrl || mods.alt || mods.meta) return null;
  const k = key.length === 1 ? key.toLowerCase() : key;
  if (k === '`') return 'panel';
  if (k === 'c') return 'capture';
  if (mode === 'fight') {
    if (k === ' ' || k === 'j' || k === 'k') return 'tap';
    if (k === 'f' || k === 'Enter' || k === 'ArrowUp') return 'finisher';
    if (k === 'p' || k === 'Escape') return 'pause';
    return null;
  }
  switch (k) {
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'Tab':
      return mods.shift ? 'prev' : 'next';
    case 'Enter':
    case ' ':
    case 'j':
    case 'k':
      return 'press';
    case 'Escape':
    case 'Backspace':
      return 'back';
    case 'p':
      return 'pause';
  }
  return null;
}

/** The keys that tap the bar: their release lets go of a hold. */
export const isTapKey = (key: string): boolean => key === ' ' || key === 'j' || key === 'k' || key === 'J' || key === 'K';

/** Whether a fight is live for the keyboard: the bar runs and nothing sits over it (a pause, the first "tap to
 *  begin", a tip card, a story box, the enemy walking in, the lab's gallery). */
export function fightLive(o: { phase: string; paused: boolean; awaitingBegin: boolean; tipUp: boolean; story: boolean; intro: boolean; gallery: boolean }): boolean {
  return o.phase === 'fight' && !o.paused && !o.awaitingBegin && !o.tipUp && !o.story && !o.intro && !o.gallery;
}

/** Whether this session has played with a keyboard (a tap key pressed in a fight): the finisher's prompt then names
 *  its key ("PRESS F!", view/hud.ts). A phone never sets it. */
let keyboardPlayed = false;
export const keyboardUsed = (): boolean => keyboardPlayed;
export function noteKeyboardPlay(): void {
  keyboardPlayed = true;
}
