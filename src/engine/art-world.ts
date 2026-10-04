// World map (placeholder until the painted map lands): the kingdom as an island, Greenmarch playable, the other
// regions locked.
type Add = (key: string, c: HTMLCanvasElement) => void;

export const WORLD_REGIONS: Array<{ id: string; name: string; x: number; y: number; locked: boolean }> = [
  { id: 'greenmarch', name: 'Greenmarch', x: 110, y: 92, locked: false },
  { id: 'frostpeaks', name: 'Frostpeaks', x: 150, y: 40, locked: true },
  { id: 'east', name: '???', x: 240, y: 60, locked: true },
  { id: 'south', name: '???', x: 220, y: 108, locked: true },
];
export const WORLD_CAPITAL = { x: 160, y: 74 };
export const GREENMARCH_FLAGS = [
  { x: 80, y: 96 },
  { x: 104, y: 110 },
  { x: 128, y: 100 },
];

function solid(w: number, h: number, col: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = col;
  ctx.fillRect(0, 0, w, h);
  return c;
}

export function buildWorldArt(add: Add, w: number, h: number): void {
  add('world_map', solid(w, h, '#3a7ab8'));
  add('padlock', solid(15, 17, '#d8901c'));
  add('flag_on', solid(9, 13, '#d03030'));
  add('flag_off', solid(9, 13, '#c8ccd8'));
}
