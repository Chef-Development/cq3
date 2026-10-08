// The companions screen's words (view/companion-cards.ts) and its Test lab scenario: every perk has a look and a short
// line that fits a phone's card, the cards' wrapping keeps numbers with their units and comes out even, and the lab
// profile shows the screen's range (most companions met, at different levels and stars, one still to find).
import { describe, expect, it } from 'vitest';
import { COMPANIONS, COMPANION_IDS } from '../../src/data/companions';
import { LAB_NEW } from '../../src/data/lab';
import { labProfile } from '../../src/core/lab';
import { petLevel } from '../../src/core/roster';
import { DEFAULT_TUNING } from '../../src/core/tuning';
import { textWidth } from '../../src/engine/font';
import { attackText, cardTextW, companionCards, companionStageW, PERK_LOOK, wrapCard } from '../../src/engine/view/companion-cards';

const t = DEFAULT_TUNING;
// an iPhone 16 Pro held sideways: about 22 game px of safe area each side (docs/ui-style.md); the column right of the
// stage, from 4 px after it to 3 px before the right edge
const L = 22;
const R = 327 - 22;
const COL_W = R - 3 - (L + companionStageW(L, R) + 4);

describe('companion cards', () => {
  it('every perk has its own look and a short line: one bold line on a phone card, a sentence, no numbers', () => {
    for (const c of Object.values(COMPANIONS))
      for (const pk of c.perks) {
        const look = PERK_LOOK[pk.name];
        expect(look, pk.name).toBeDefined();
        expect(textWidth(look.short, 1, true), pk.name).toBeLessThanOrEqual(cardTextW(COL_W, true));
        expect(look.short, pk.name).toMatch(/^[A-Z].*\.$/);
        expect(look.short, pk.name).not.toMatch(/\d/);
      }
  });

  it('a companion reads as its attack, then each perk with its full line', () => {
    for (const id of COMPANION_IDS) {
      const cards = companionCards(id);
      expect(cards[0].kind, id).toBe('attack');
      expect(cards[0].text, id).toContain(`${COMPANIONS[id].every} hits`);
      expect(cards.slice(1).map((c) => c.text), id).toEqual(COMPANIONS[id].perks.map((p) => p.text));
    }
    expect(attackText('sunny')).toBe('Breathes on every foe every 6 hits');
    expect(attackText('pip')).toBe('Pecks every 4 hits');
  });

  it('wrapping keeps a number with its unit, never runs past the width, and ends on more than one lonely word', () => {
    const w = cardTextW(COL_W);
    for (const c of Object.values(COMPANIONS))
      for (const pk of c.perks) {
        const lines = wrapCard(pk.text, w);
        expect(lines.join(' '), pk.name).toBe(pk.text);
        for (const l of lines) expect(textWidth(l, 1, true), `${pk.name}: ${l}`).toBeLessThanOrEqual(w);
        for (const l of lines) expect(l, pk.name).not.toMatch(/(^s[.,:]?$)|(^s[.,:]? )/);
        if (lines.length > 1) expect(lines.at(-1)!.split(' ').length, `${pk.name}: ${lines.join(' / ')}`).toBeGreaterThan(1);
      }
    expect(wrapCard('Bites burn foes for 4 s: half a bite each second.', w).some((l) => l.includes('4 s:'))).toBe(true);
  });
});

describe('the companions screen in the Test lab', () => {
  it('is new this round (reworked: rev 2) and shows its range: most met, levels and stars apart, one to find', () => {
    const s = LAB_NEW.find((x) => x.id === 'companions');
    expect(s).toBeDefined();
    expect(s!.rev).toBe(2);
    expect(s!.setup).toEqual({ kind: 'camp', screen: 'companions' });
    const p = labProfile(t, s!);
    const owned = COMPANION_IDS.filter((id) => p.pets[id].owned);
    expect(owned.length).toBeGreaterThanOrEqual(6);
    expect(COMPANION_IDS.length - owned.length).toBeGreaterThanOrEqual(1);
    expect(new Set(owned.map((id) => petLevel(t, p.pets[id].xp))).size).toBeGreaterThanOrEqual(4);
    expect(new Set(owned.map((id) => p.pets[id].stars)).size).toBeGreaterThanOrEqual(4);
    expect(owned.some((id) => p.pets[id].stars === 5)).toBe(true);
    expect(owned.some((id) => p.pets[id].stars < 5 && p.pets[id].shards > 0)).toBe(true);
    expect(owned.some((id) => COMPANIONS[id].rarity === 'legendary')).toBe(true);
    expect(p.camp).toContain('perch');
  });
});
