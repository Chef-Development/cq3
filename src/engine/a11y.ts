// The accessibility settings as the views read them, live (core/a11y.ts has the rules; storage.ts keeps them; the
// gear panel changes them). `A11Y.marks`: the bar marks every red (view/bar.ts). `A11Y.less`: less motion now (the
// setting, or the device's "reduce motion" on 'auto', followed as it changes): no screen shake, camera kick or white
// impact frames, shorter screen flashes (view/effects.ts).
import { lessMotion, type A11ySettings } from '../core/a11y';
import { loadA11y, saveA11y } from './storage';

export const A11Y: { settings: A11ySettings; marks: boolean; less: boolean } = { settings: loadA11y(), marks: true, less: false };

const deviceQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const resolve = () => {
  A11Y.marks = A11Y.settings.marks;
  A11Y.less = lessMotion(A11Y.settings, !!deviceQuery?.matches);
};
resolve();
deviceQuery?.addEventListener?.('change', resolve);

/** Change a setting (the gear panel): kept at once. */
export function setA11y(patch: Partial<A11ySettings>): void {
  A11Y.settings = { ...A11Y.settings, ...patch };
  saveA11y(A11Y.settings);
  resolve();
}
