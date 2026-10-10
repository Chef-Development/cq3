// The relic pick's upright cards (view/relic-ui.ts relicCardUpright): every relic's name and words fit a card at the
// pick's size on a phone (874x402 @3x: the safe area leaves 283 px, three cards of 84 x 90) and on a desktop.
import { describe, expect, it } from 'vitest';
import { RELICS } from '../../src/data/relics';
import { relicText } from '../../src/core/relics';
import { cloneTuning } from '../../src/core/tuning';
import { uprightLines } from '../../src/engine/view/relic-ui';

describe('the relic pick: upright cards', () => {
  const t = cloneTuning();
  it('every relic fits a card: its name in two lines at most, its words in the room under it', () => {
    const bad = RELICS.filter((r) => !uprightLines(r.name, relicText(t, r.id), 84, 90).fits).map((r) => r.id);
    expect(bad).toEqual([]);
  });
  it('a new player first pick (two wider cards) fits too', () => {
    const bad = RELICS.filter((r) => !uprightLines(r.name, relicText(t, r.id), 129, 90).fits).map((r) => r.id);
    expect(bad).toEqual([]);
  });
});
