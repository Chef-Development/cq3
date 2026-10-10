// The later regions' art in chunks of their own (docs/perf.md, "Region art packs"; team 4, round 8). A first session
// plays Greenmarch: its art is in the main chunk and painted at boot, while each later region's foes, portraits, bar
// pieces, relic icons and fight backdrops come in a pack (`pack-<region>.ts`) that is loaded with import() as the
// game boots (it downloads beside the main chunk and the service worker keeps it), painted in idle slices once the
// title is up (scene.ts), and finished at once on the first screen after the title (App.setPhase -> FightScene
// ensureRegionArt), so no screen past the title ever asks for a texture that isn't there.
//
// A new region's art joins like this:
//   1. its art files (art-<region>.ts, backdrop-<region>.ts...) are imported ONLY by its pack file (and each other):
//      any static import from the main game pulls the whole file back into the main chunk. A small thing the game
//      needs before the pack arrives (a theme list, a palette) lives here or in a small file of its own.
//   2. pack-<region>.ts exports `PACK: RegionArtPack` (below): paint in slices, add the drawn art, name its keys, paint
//      a backdrop; its fight themes go in PACK_THEMES and its loader in LOADERS (here).
//   3. scripts/sw-template.js needs nothing: the build lists every file in dist/ for the precache.
import type Phaser from 'phaser';
import type { Backdrop, Theme } from './backdrop';

export type Add = (key: string, canvas: HTMLCanvasElement) => void;

export interface RegionArtPack {
  id: PackId;
  /** Draw some of the pack's foe art (whole sprites) until `ms` have gone by; true once all of it is drawn. */
  paintSlice(ms: number): boolean;
  /** Add the drawn art as textures (`now`: draw what's left first). A relayout calls it again: fresh copies. */
  addArt(add: Add, now: boolean): void;
  /** Whether a texture key is one of this pack's drawn art (a foe's frame, a portrait, a bar piece). */
  isArtKey(key: string): boolean;
  /** One of the pack's fight themes: its backdrop and light, painted the first time an act needs it. */
  backdrop(scene: Phaser.Scene, theme: Theme, w: number, h: number, ground: number): Backdrop;
  /** The pack's foes' colours (hit sparks, dust: merged into view/shared ENEMY_COL when it arrives). */
  col: Record<string, number>;
}

export type PackId = 'frost' | 'ash';

/** Each pack's chunk. */
const LOADERS: Record<PackId, () => Promise<{ PACK: RegionArtPack }>> = {
  frost: () => import('./pack-frost'),
  ash: () => import('./pack-ash'),
};

/** The fight themes each pack paints (known before it arrives: the stage asks which pack a theme needs). */
const PACK_THEMES: Record<PackId, readonly string[]> = {
  frost: ['pass', 'caves', 'glacier'],
  ash: ['cinder', 'glass', 'forge'],
};

const loaded = new Map<PackId, RegionArtPack>();
const waiting: Array<(p: RegionArtPack) => void> = [];
let all: Promise<void> | null = null;
let failed = 0;

/** Start loading every pack (once). A failed load (offline on a first visit) is tried again the next time it's asked. */
export function loadRegionArt(): Promise<void> {
  if (all && !failed) return all;
  failed = 0;
  all = Promise.all(
    (Object.keys(LOADERS) as PackId[]).map((id) =>
      loaded.has(id)
        ? undefined
        : LOADERS[id]().then(
            (m) => {
              loaded.set(id, m.PACK);
              for (const cb of waiting) cb(m.PACK);
            },
            () => void failed++,
          ),
    ),
  ).then(() => undefined);
  return all;
}

/** Every pack is in (the test handle's `ready` waits for it). */
export const regionArtLoaded = (): boolean => loaded.size === Object.keys(LOADERS).length;

/** The packs loaded so far. */
export const regionPacks = (): RegionArtPack[] => [...loaded.values()];

/** Call `cb` with each pack as it arrives (and at once with those already in). */
export function onRegionPack(cb: (p: RegionArtPack) => void): void {
  waiting.push(cb);
  for (const p of loaded.values()) cb(p);
}

/** The pack that paints a theme's backdrop (null: a theme painted at boot). */
export function packOfTheme(theme: string): PackId | null {
  for (const id of Object.keys(PACK_THEMES) as PackId[]) if (PACK_THEMES[id].includes(theme)) return id;
  return null;
}

/** The pack itself, if it has arrived. */
export const regionPack = (id: PackId): RegionArtPack | null => loaded.get(id) ?? null;

/** Ashfell's themes (the bar uses its own marks there). */
export const isAshTheme = (theme: string): boolean => PACK_THEMES.ash.includes(theme);
