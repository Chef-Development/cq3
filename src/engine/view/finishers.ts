// Each hero's finisher show, on top of the shared one in view/fighters.ts (the streaked sky, the flurry of strikes
// between 30% and 70% of the show, the last blow whose number counts up): what the strikes look like, what the last
// blow throws, what the show does on the stage while it plays, and what it does to the bar. Rowan's Whirlwind (a
// tornado through every foe) and Sable's Twin Fang (a leap onto one) are fighters.ts's own; here: Neve's Glacier (a
// frost wave rolls out, the foes ice over, a frost sweep crosses the bar as its reds freeze), Moss's Overgrowth (vines
// burst up under the foes; vines run along the bar), Tam's Big Bang (a huge keg lobbed into the foes, then kegs flying
// onto the bar), Hollis's Rampart (a shield slam on the target; the wall stands at the bar's left end), Vesper's
// Volley (arrows rain on every foe and pin the reds) and Torva's Earthsplitter (a leap, a hammer quake, the bar cracks
// and clears).
import type Phaser from 'phaser';
import { drawKeg } from './bar-kinds';
import type { FightScene } from '../scene';
import { clamp01, ease, rand, WHITE, type EnemyView } from './shared';

type G = Phaser.GameObjects.Graphics;

export type ShowKind = 'whirl' | 'fang' | 'glacier' | 'vines' | 'bang' | 'rampart' | 'volley' | 'quake';
export const SHOW_KIND: Record<string, ShowKind> = { rowan: 'whirl', sable: 'fang', neve: 'glacier', moss: 'vines', tam: 'bang', hollis: 'rampart', vesper: 'volley', torva: 'quake' };
/** Shows where the hero goes to the foe (the rest stay back and cast, throw or shoot). */
export const MELEE: ReadonlySet<ShowKind> = new Set<ShowKind>(['whirl', 'fang', 'rampart', 'quake']);
/** Each show's colours [main, light] for its strikes and last blow. */
const THEME: Record<ShowKind, readonly [number, number]> = {
  whirl: [0x3a8ae8, 0xa8e4ff],
  fang: [0xa060ff, 0xe0c0ff],
  glacier: [0x6ad0f0, 0xe0faff],
  vines: [0x4a9e3a, 0xb4f070],
  bang: [0xff7a2a, 0xffe080],
  rampart: [0x3a6ad8, 0xb8d8ff],
  volley: [0xb07ae0, 0xfff0a0],
  quake: [0xc0803a, 0xffd890],
};

/** What the show does the moment it starts: to the bar (its reds frozen, pinned, cleared, walled) and the stage. */
export function showStart(s: FightScene, kind: ShowKind, heroX: number): void {
  const c = s.app.run.combat;
  const bar = s.barView;
  if (kind === 'glacier') s.later(120, () => bar.sweep('frost'));
  else if (kind === 'quake') bar.sweep('crack');
  else if (kind === 'volley' && c) bar.volley(c);
  else if (kind === 'bang' && c) {
    // Big Bang's kegs: lobbed from her hands onto the bar once the big one has gone off
    const ms = s.fighters.superMs;
    bar.kegsFly(c, heroX + 6, s.ground - 34, ms * 0.82);
  }
}

/** One strike of the flurry on a foe, in the show's own look. */
export function showStrike(s: FightScene, kind: ShowKind, v: EnemyView, st: number, stackCol: number, stackHi: number): void {
  const fx = s.fx;
  const cy = v.y - v.img.displayHeight / 2 + rand(-6, 4);
  const [col, hi] = THEME[kind];
  v.flashUntil = s.anim + 40;
  v.kickAt = s.anim;
  v.kickDist = 4;
  switch (kind) {
    case 'glacier':
      // frost shards stabbing into it
      fx.sparks.push({ x: v.x + rand(-8, 6), y: cy, at: s.anim, size: 9, color: hi });
      fx.chips(v.x, cy, 10, [WHITE, hi, col], 6, 0);
      fx.burst(v.x, cy, hi, 5, true, 1.1, true);
      break;
    case 'vines':
      // vines lash it: green slashes and leaves
      fx.slashes.push({ x: v.x + rand(-4, 4), y: cy, at: s.anim, big: st % 2 === 1, dir: st % 2 ? 1 : -1, color: st % 2 ? hi : col });
      fx.burst(v.x, cy, 0x78a83c, 5, true, 1);
      break;
    case 'bang':
      // little blasts going off on it
      fx.stars.push({ x: v.x + rand(-8, 8), y: cy, at: s.anim, r: 10, color: st % 2 ? hi : col });
      fx.burst(v.x, cy, col, 6, true, 1.2);
      fx.puffs.push({ x: v.x + rand(-6, 6), y: cy, r: rand(3, 6), at: s.anim, life: 360, color: 0x9a94a8 });
      break;
    case 'volley': {
      // an arrow drops out of the sky onto it
      const tx = v.x + rand(-8, 8);
      fx.bolt(tx - 14, cy - 60, tx, cy, 90, hi);
      s.later(90, () => {
        fx.sparks.push({ x: tx, y: cy, at: s.anim, size: 8, color: hi });
        fx.burst(tx, cy, WHITE, 4, true, 1, true);
      });
      break;
    }
    case 'rampart':
      // shield bashes: a blue clang
      fx.ring(v.x - 6, cy, 12, hi, true);
      fx.sparks.push({ x: v.x - 6, y: cy, at: s.anim, size: 9, color: hi });
      fx.burst(v.x - 6, cy, WHITE, 5, true, 1.2, true);
      break;
    case 'quake':
      // hammer blows: the ground jumps under it
      fx.slashes.push({ x: v.x + rand(-4, 4), y: cy, at: s.anim, big: true, dir: st % 2 ? 1 : -1, color: st % 2 ? hi : col });
      fx.rubble(v.x, s.ground, 3, 0.7);
      break;
    default:
      fx.slashes.push({ x: v.x + rand(-4, 4), y: cy, at: s.anim, big: st % 2 === 1, dir: st % 2 ? 1 : -1, color: st % 3 === 2 ? stackHi : stackCol });
      fx.sparks.push({ x: v.x + rand(-8, 4), y: cy, at: s.anim, size: 8, color: stackHi });
      fx.burst(v.x, cy, WHITE, 5, true, 1.3, true);
  }
}

/** The last blow on a foe, in the show's own look (on top of the shared big hit). */
export function showFinal(s: FightScene, kind: ShowKind, v: EnemyView, n: number): void {
  const fx = s.fx;
  const cy = v.y - v.img.displayHeight / 2;
  const [col, hi] = THEME[kind];
  switch (kind) {
    case 'glacier':
      // it ices over: a white-blue flash, ice chips, a frost ring on the ground
      fx.flashes.push({ x: v.x, y: cy, r: 18 + n * 3, at: s.anim });
      fx.chips(v.x, cy, v.img.displayWidth * 0.6, [WHITE, hi, col], 18, 0);
      fx.shock(v.x, s.ground, 30 + n * 6, hi);
      break;
    case 'vines':
      // vines erupt from the ground under it
      for (let i = 0; i < 4; i++) fx.bolt(v.x + rand(-14, 14), s.ground, v.x + rand(-6, 6), cy - rand(0, 10), 120 + i * 30, i % 2 ? hi : col);
      fx.burst(v.x, s.ground - 4, 0x78a83c, 14, true, 1.2);
      break;
    case 'bang':
      fx.stars.push({ x: v.x, y: cy, at: s.anim, r: 34 + n * 4, color: 0xffb030 });
      for (let i = 0; i < 6; i++) fx.puffs.push({ x: v.x + rand(-14, 14), y: cy + rand(-10, 10), r: rand(5, 9), at: s.anim + i * 30, life: 520, color: i % 2 ? 0x8a8494 : 0x5a5466 });
      fx.burst(v.x, cy, 0xff5a1a, 18, true, 1.6);
      break;
    case 'volley':
      for (let i = 0; i < 5; i++) {
        const tx = v.x + rand(-14, 14);
        fx.bolt(tx - 10, cy - 70, tx, cy + rand(-6, 6), 80 + i * 25, i % 2 ? hi : col);
      }
      break;
    case 'rampart':
      fx.ring(v.x - 8, cy, 34, hi, true);
      fx.shock(v.x - 8, s.ground, 40 + n * 6, hi);
      break;
    case 'quake':
      fx.rubble(v.x, s.ground, 10 + n * 2, 1.3);
      fx.shock(v.x, s.ground, 50 + n * 8, hi);
      break;
    default:
      break;
  }
}

/** The quake's landing (Earthsplitter): the hammer hits the ground in front of the hero. */
export function quakeLand(s: FightScene, x: number): void {
  const fx = s.fx;
  fx.shock(x + 14, s.ground, 70, 0xffd890);
  fx.rubble(x + 14, s.ground, 14, 1.4);
  fx.dust(x + 14, s.ground, 12, 0, 1.4);
  fx.shake(4, 260);
}

/**
 * Every frame of a show (stage space, over the actors): Glacier's frost wave rolling out to the foes, Overgrowth's vines
 * climbing under them, Big Bang's big keg arcing into them, Volley's arrows raining on them.
 */
export function drawShow(g: G, s: FightScene, kind: ShowKind, k: number, heroX: number, views: EnemyView[]): void {
  if (k < 0 || k >= 1) return;
  const ground = s.ground;
  if (kind === 'glacier' && k > 0.08 && k < 0.5) {
    // a wall of ice shards rolling from her staff to the foes
    const q = (k - 0.08) / 0.42;
    const far = Math.max(heroX + 40, ...views.map((v) => v.x + 10));
    const x = heroX + 12 + (far - heroX - 12) * ease(q);
    for (let i = 0; i < 9; i++) {
      const h = 6 + ((i * 7) % 11) + Math.round(6 * (1 - q));
      const sx = Math.round(x - i * 5);
      g.fillStyle(i === 0 ? WHITE : 0x9ae8ff, (1 - i / 9) * (1 - q * 0.4));
      g.fillRect(sx, ground - h, 3, h);
      g.fillStyle(WHITE, 0.8 * (1 - i / 9));
      g.fillRect(sx, ground - h, 1, 2);
    }
  } else if (kind === 'vines' && k > 0.1 && k < 0.85) {
    // vines climbing out of the ground under each foe
    const q = clamp01((k - 0.1) / 0.3);
    for (const v of views) {
      const top = v.y - v.img.displayHeight * 0.7 * q;
      for (let j = 0; j < 3; j++) {
        const bx = v.x - 10 + j * 10;
        for (let y = ground; y > top; y -= 1) {
          const x = Math.round(bx + 3 * Math.sin((ground - y) / 5 + j * 2));
          g.fillStyle(j === 1 ? 0x78a83c : 0x2e5a32, 1);
          g.fillRect(x, Math.round(y), 2, 1);
          if ((ground - Math.round(y)) % 9 === 4) {
            g.fillStyle(0xb4d058, 1);
            g.fillRect(x + (j % 2 ? 2 : -2), Math.round(y), 2, 2);
          }
        }
      }
    }
  } else if (kind === 'bang' && k > 0.08 && k < 0.3) {
    // the big keg, lobbed high into the foes
    const q = (k - 0.08) / 0.22;
    const tgt = views.length ? views.reduce((a, v) => a + v.x, 0) / views.length : heroX + 80;
    const x = heroX + 6 + (tgt - heroX - 6) * q;
    const y = ground - 34 - Math.sin(q * Math.PI) * 40 + 20 * q;
    drawKeg(g, Math.round(x - 9), Math.round(y - 12), 18, 24, s.anim);
  } else if (kind === 'volley' && k > 0.1 && k < 0.75) {
    // arrows raining down on every foe
    for (const v of views) {
      for (let i = 0; i < 6; i++) {
        const ph = ((k * 6 + i / 6) % 1) * 1;
        const ax = Math.round(v.x - 16 + ((i * 13) % 32) + ph * 6);
        const ay = Math.round(v.y - v.img.displayHeight - 50 + ph * (v.img.displayHeight + 46));
        g.fillStyle(0x140c1c, 1);
        g.fillRect(ax - 1, ay - 9, 3, 11);
        g.fillStyle(0xd8dce8, 1);
        g.fillRect(ax, ay - 8, 1, 9);
        g.fillStyle(WHITE, 1);
        g.fillRect(ax - 1, ay - 8, 1, 2);
        g.fillRect(ax + 1, ay - 8, 1, 2);
      }
    }
  }
}
