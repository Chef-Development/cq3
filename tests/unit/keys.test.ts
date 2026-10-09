import { describe, expect, it } from 'vitest';
import { fightLive, isTapKey, keyAction } from '../../src/engine/keys';
import { cycle, readingOrder, step, track, usable } from '../../src/engine/focus-nav';

describe('desktop keys', () => {
  it('in a live fight: Space/J/K tap, F/Enter/Up fire the finisher, P/Escape pause', () => {
    for (const k of [' ', 'j', 'k', 'J']) expect(keyAction(k, 'fight')).toBe('tap');
    for (const k of ['f', 'F', 'Enter', 'ArrowUp']) expect(keyAction(k, 'fight')).toBe('finisher');
    for (const k of ['p', 'Escape']) expect(keyAction(k, 'fight')).toBe('pause');
    // the arrows and Tab don't move a ring in a fight
    expect(keyAction('ArrowLeft', 'fight')).toBeNull();
    expect(keyAction('Tab', 'fight')).toBeNull();
  });

  it('in menus: arrows and Tab move the ring, Enter/Space press, Escape goes back', () => {
    expect(keyAction('ArrowLeft', 'menu')).toBe('left');
    expect(keyAction('ArrowRight', 'menu')).toBe('right');
    expect(keyAction('ArrowUp', 'menu')).toBe('up');
    expect(keyAction('ArrowDown', 'menu')).toBe('down');
    expect(keyAction('Tab', 'menu')).toBe('next');
    expect(keyAction('Tab', 'menu', { shift: true })).toBe('prev');
    expect(keyAction('Enter', 'menu')).toBe('press');
    expect(keyAction(' ', 'menu')).toBe('press');
    expect(keyAction('Escape', 'menu')).toBe('back');
    expect(keyAction('Backspace', 'menu')).toBe('back');
    expect(keyAction('p', 'menu')).toBe('pause');
    expect(keyAction('f', 'menu')).toBeNull();
  });

  it('anywhere: ` opens the panel and C the clean capture; the browser keeps its shortcuts', () => {
    for (const m of ['fight', 'menu'] as const) {
      expect(keyAction('`', m)).toBe('panel');
      expect(keyAction('c', m)).toBe('capture');
      expect(keyAction('C', m)).toBe('capture');
      expect(keyAction('c', m, { ctrl: true })).toBeNull();
      expect(keyAction('c', m, { meta: true })).toBeNull();
      expect(keyAction(' ', m, { alt: true })).toBeNull();
    }
    expect(keyAction('x', 'menu')).toBeNull();
  });

  it('the tap keys let go of a hold; the fight is live only with nothing over it', () => {
    expect(isTapKey(' ')).toBe(true);
    expect(isTapKey('k')).toBe(true);
    expect(isTapKey('Enter')).toBe(false);
    const base = { phase: 'fight', paused: false, awaitingBegin: false, tipUp: false, story: false, intro: false, gallery: false };
    expect(fightLive(base)).toBe(true);
    for (const k of ['paused', 'awaitingBegin', 'tipUp', 'story', 'intro', 'gallery'] as const) expect(fightLive({ ...base, [k]: true })).toBe(false);
    expect(fightLive({ ...base, phase: 'map' })).toBe(false);
  });
});

describe('focus order', () => {
  // the camp's band: four buttons on a row, a fifth far right; a chip and a button on a row above
  const band = [
    { x: 4, y: 130, w: 30, h: 15, id: 'bag' },
    { x: 38, y: 130, w: 30, h: 15, id: 'forge' },
    { x: 72, y: 131, w: 30, h: 15, id: 'skills' },
    { x: 106, y: 130, w: 30, h: 15, id: 'relics' },
    { x: 260, y: 130, w: 60, h: 15, id: 'leave' },
  ];
  const top = [
    { x: 100, y: 4, w: 40, h: 14, id: 'camp' },
    { x: 4, y: 4, w: 60, h: 18, id: 'chip' },
  ];
  const all = [...band, ...top];
  const id = (r: { id: string } | null) => r?.id ?? null;

  it('reading order: rows top to bottom, left to right (a pixel of wobble stays in its row)', () => {
    expect(readingOrder(all).map((r) => r.id)).toEqual(['chip', 'camp', 'bag', 'forge', 'skills', 'relics', 'leave']);
  });

  it('Tab cycles in reading order and wraps; Shift+Tab goes back', () => {
    expect(id(cycle(all, null, 1))).toBe('chip');
    expect(id(cycle(all, null, -1))).toBe('leave');
    expect(id(cycle(all, band[3], 1))).toBe('leave');
    expect(id(cycle(all, band[4], 1))).toBe('chip');
    expect(id(cycle(all, top[1], -1))).toBe('leave');
    expect(cycle([], null, 1)).toBeNull();
  });

  it('arrows: the nearest target that way, straight ahead first; nothing that way keeps the ring', () => {
    expect(id(step(all, null, 'right'))).toBe('chip'); // no ring yet: the first
    expect(id(step(all, band[0], 'right'))).toBe('forge');
    expect(id(step(all, band[3], 'right'))).toBe('leave');
    expect(id(step(all, band[1], 'left'))).toBe('bag');
    expect(step(all, band[0], 'left')).toBeNull();
    expect(id(step(all, band[0], 'up'))).toBe('chip');
    expect(id(step(all, band[3], 'up'))).toBe('camp');
    expect(id(step(all, top[0], 'down'))).toBe('relics');
    expect(step(all, band[2], 'down')).toBeNull();
  });

  it('the ring follows a target that moved a little (popping in), and lets go of one that went', () => {
    const moved = all.map((r) => ({ ...r, y: r.y + 3 }));
    expect(id(track(moved, band[2]))).toBe('skills');
    expect(track(top, band[2])).toBeNull();
  });

  it('only targets on screen, big enough to press, each once', () => {
    const W = 327;
    const H = 150;
    const rs = [
      { x: 10, y: 10, w: 20, h: 10 },
      { x: 10, y: 10, w: 20, h: 10 }, // the same button drawn twice
      { x: -40, y: 10, w: 20, h: 10 }, // panned off screen
      { x: 50, y: 50, w: 2, h: 2 }, // a dot
      { x: 300, y: 140, w: 40, h: 20 }, // half on screen (its centre too)
    ];
    expect(usable(rs, W, H).length).toBe(2);
  });
});
