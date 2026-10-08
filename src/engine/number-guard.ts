// The numbers safety net for the HTML the player reads (the gear panel, the Test lab, the calibration card, toasts):
// every text node added or changed under <body> goes through core/format.ts guardText before it is painted (a
// MutationObserver's callback runs before the next frame), like the canvas's text does in font.ts fontText. The debug
// tuning panel's slider readouts (.dbg-val) and form fields are a developer's raw numbers and are left alone.
//
// Also puts the recorded violations on the test handle: window.__cq3.textViolations (the raw strings),
// window.__cq3.clearTextViolations(), and, when a smoke test exposed one, window.__cq3TextViolation(raw) for each new
// violation as it happens (tests/smoke/fixtures.ts: every spec fails on one).
import { clearTextViolations, guardText, onTextViolation, textViolations } from '../core/format';

/** Developer readouts that keep their raw numbers: the tuning sliders' values, and what is typed into a field. */
const RAW = '.dbg-val, textarea, input, script, style';

function guardNode(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = node as Text;
    if (t.parentElement?.closest(RAW)) return;
    const g = guardText(t.data);
    if (g !== t.data) t.data = g;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE || (node as Element).matches(RAW)) return;
  for (const c of Array.from(node.childNodes)) guardNode(c);
}

export function installNumberGuard(handle: Record<string, unknown>): void {
  handle.textViolations = textViolations;
  handle.clearTextViolations = clearTextViolations;
  onTextViolation((raw) => {
    const f = (window as unknown as { __cq3TextViolation?: (s: string) => unknown }).__cq3TextViolation;
    if (typeof f === 'function') void f(raw);
  });
  if (typeof MutationObserver === 'undefined' || !document.body) return;
  guardNode(document.body);
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') guardNode(r.target);
      else for (const n of Array.from(r.addedNodes)) guardNode(n);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
}
