// Bar callouts: the player's eyes are on the timing bar, so when the hero's kit, their style's rule, a Summoner's ally
// or a companion does something, a short word pops just above the bar where it happened ("Dash!", "Guard 3", "Rock!",
// "Thorn!") and drifts up as it fades. Relics and skill nodes keep their names in the HUD's lane (fighters.ts
// perkLabel); these are the hero's own doings. Each word has a mark in front: the hero's style icon in the hero's
// colour (STYLE_LOOK), a paw in the companion's colour (PET_COL) or a leaf in the ally's (ALLY_COL). They never flood:
// the same thing shows at most every ~450 ms (the allies, who act on their own every second or so, much less), at most
// three at once, stacked so they never overlap each other, the tap's judgement ("Perfect!") or the combo counter.
//
// Also here: the style readout's twin as a tab on the bar's left end (view/style-chip.ts; it pulses when its value
// changes). The bar's own "ready" marks (a blocker standing at the left end, Wind-Up's glow, Oil Can's Perfect zones)
// are painted by view/bar.ts. Everything animates from performance.now (the fake clock in screenshot tests).
import type Phaser from 'phaser';
import type { Combat, CombatEvent } from '../../core/combat';
import { mult, signed, whole } from '../../core/format';
import { guardOf } from '../../core/styles';
import type { CompanionId } from '../../data/companions';
import { heroDef, type AllyKind, type HeroId } from '../../data/heroes';
import type { FightScene } from '../scene';
import { textWidth } from '../font';
import { pix, pixSize, STYLE_LOOK } from './camp-kit';
import { FOE_ICONS } from './icons';
import { ALLY_COL, PERK_PET, PET_COL } from './party';
import { glow, rows } from './pixels';
import { perkName, perkSource } from './relic-ui';
import { drawStyleChip, styleState } from './style-chip';
import { clamp01, ease, INK, mix, WHITE, type Rect } from './shared';
import { TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;

/** A callout's life: it pops (white for a moment), rises RISE px and fades over its last stretch. */
const LIFE_MS = 650;
const RISE = 5;
/** The same callout (or word) at most this often. */
const GAP_MS = 450;
/** At most this many on screen; lanes are this many px apart (a bold line and a pixel). */
const MAX_ON = 3;
const LANE_H = 11;
const LANES = 3;
/** How far a callout may step aside (from a judgement, another callout, the readout) before it takes the lane above. */
const MAX_SHIFT = 70;
/** The widest word (a fallback name longer than this isn't shown). */
const MAX_W = 46;
/** A callout waits for the judgement's pop (it shows at 2x for this long) when it would land on it. */
const JUDGE_POP_MS = 90;

/**
 * The words, by perk id (plus a few kit actions that aren't 'perk' events: 'dash', 'keg' for a keg's blast, the
 * allies' calls 'call:<kind>' and the green ability 'ability:<hero>'). Short game words, 7 letters at most.
 */
export const CALLOUT_WORDS: Record<string, string> = {
  // Rowan
  resolve: 'Resolve',
  wideSweep: 'Sweep!',
  'ability:rowan': 'Focus!',
  // Sable
  dash: 'Dash!',
  chain: 'Chain',
  smokeVeil: 'Saved!',
  afterimage: 'Dodge!',
  fangAndClaw: 'Claw!',
  twinFang: '+Stack',
  'ability:sable': 'Veil!',
  // Neve (and her style's rule)
  flashFreeze: 'Freeze!',
  glacier: 'Frozen!',
  bigFreeze: 'Ice!',
  bend: 'Slow!',
  'ability:neve': 'Chill',
  // Moss and the allies
  rally: 'Rally!',
  thornling: 'Thorn!',
  barkback: 'Bark!',
  glowmoth: 'Heal!',
  seedling: 'Seed!',
  'call:thornling': '+Thorn',
  'call:barkback': '+Bark',
  'call:glowmoth': '+Moth',
  'call:seedling': '+Seed',
  // Tam
  fuseUp: '+Keg',
  bigBang: 'Kegs!',
  keg: 'Blast!',
  turnabout: 'Flip!',
  // Hollis (and his style's Guard)
  guardUp: 'Guard',
  shieldSlam: 'Slam!',
  bulwark: 'Bulwark',
  avalanche: 'Stun!',
  'ability:hollis': 'Brace!',
  // Vesper
  powerShot: 'Shot!',
  pierce: 'Pierce',
  volley: 'Volley',
  patience: 'Snipe!',
  // Torva ("x2.6": Wind-Up's smash, its multiplier)
  quake: 'Quake!',
  windUp: 'xN',
  secondSwing: '+Stack',
  'ability:torva': 'Wind-Up',
  // part6:A
  // part6:B
  // Yara (her spirits; 'Stag!' is each of the Great Spirit's strikes)
  spiritWolf: 'Bite!',
  spiritTortoise: 'Shell!',
  wispSwarm: 'Wisps',
  spiritStag: 'Stag!',
  'call:spiritWolf': '+Wolf',
  'call:spiritTortoise': '+Shell',
  'call:wispSwarm': '+Wisps',
  greatSpirit: 'Spirit!',
  kinship: 'Kinship',
  spiritStampede: 'Charge!',
  // Dell
  luckyShot: 'Lucky!',
  ricochetShot: 'Bounce!',
  pocketful: 'Kept!',
  pebbleStorm: 'Knock!',
  // part6:C
  // part6:D
  // the companions ("+N": the coins found)
  luckyFoot: '+N',
  owlWatch: 'Peck!',
  emberBite: 'Burn!',
  oilCan: 'Oiled!',
  rockWall: 'Rock!',
  starlight: 'Star!',
  mend: 'Mend!',
  goldHoard: '+N',
  fireBreath: 'Fire!',
  chillBite: 'Frost',
  snowDash: 'Frost',
};

/** Perks that happen where reds land (a blocker took one, a hit taken): their word shows at the bar's left end. */
const AT_LEFT = new Set(['resolve', 'afterimage', 'rockWall', 'barkback']);
/** Kit perks that are gear, not the hero: never called out (their names show in the lane). */
const GEAR_PERKS = new Set(['rimewalker', 'sanctuary', 'emberwright']);
/** The allies' own doings: they act every second or so, so at most one of them shows per BUCKET_MS.ally (and each
 *  kind at most every ALLY_KIND_MS); a call, a Rally and a Barkback's block always show. */
const ALLY_DOINGS = new Set(['thornling', 'glowmoth', 'seedling']);
const ALLY_KIND_MS = 2800;
/** Each bucket shows at most one callout this often: the allies' doings; the companions' perks (two companions'
 *  perks together never pile up; Rock Wall taking a red always shows). */
const BUCKET_MS: Record<Bucket, number> = { ally: 1200, pet: 900 };
/** Perks that tick on their own (a burn each second) or come with nearly every tap (Flurry's Snow Dash on each
 *  block, a green ability on each green: the cursor's tint shows that one running): shown at most this often. */
const SLOW_GAP: Record<string, number> = {
  emberBite: 2500,
  shieldSlam: 1600,
  mend: 2000,
  snowDash: 1500,
  chillBite: 1200,
  'ability:rowan': 2000,
  'ability:sable': 2000,
  'ability:neve': 2000,
  'ability:hollis': 2000,
  'ability:torva': 2000,
};
/** Skill nodes that change what a hero's own move does on the bar get a word too (the rest keep the lane). */
const SKILL_WORDS = new Set(['bigFreeze', 'turnabout', 'avalanche']);
/** Perks with no word: a Bulwark's blow on each foe (the Bulwark's own word covers them). */
const NO_WORD = new Set(['bulwarkBlow']);
/** The perks that are coins found (gold words). */
const COIN_PERKS = new Set(['luckyFoot', 'goldHoard']);
// ---- Yara and Dell (Part 6): the Tortoise's shell takes reds at the left end; the spirits' own doings share the
// allies' bucket (the stag strikes every second); a crit with spirits out shows now and then
AT_LEFT.add('spiritTortoise');
NO_WORD.add('spiritStag'); // (the stag's strikes show on every foe; 'Spirit!' names its coming)
for (const id of ['spiritWolf', 'wispSwarm', 'spiritStag']) ALLY_DOINGS.add(id);
Object.assign(SLOW_GAP, { kinship: 1800, pocketful: 1500 });

/** The style readout's tab shows its empty state (dim pips or gauge waiting to fill) for these styles. */
const EMPTY_TAB = new Set(['guardian', 'marksman', 'summoner']);

/** A paw print (a companion's mark), drawn in the companion's colour with an ink rim. */
const PAW = ['p.p.p', '.....', '.ppp.', 'ppppp', '.ppp.'];

type Mark = { kind: 'style'; icon: string } | { kind: 'paw' | 'leaf'; col: number } | null;
type Bucket = 'ally' | 'pet';

interface Pending {
  id: string;
  word: string;
  col: number;
  mark: Mark;
  /** Bar position (0..1), 'left' (where reds land), or null (where the tap was, else the cursor). */
  pos: number | 'left' | null;
  /** The throttle bucket it shares with its kind (beyond its own id): the allies' doings, or the companions' perks. */
  bucket?: Bucket;
  /** Shows even if its bucket is busy (it still marks the bucket). */
  always?: boolean;
  /** The side it would rather step aside to (-1 left, 1 right; by default the side behind the cursor). */
  side?: number;
}

interface Callout {
  id: string;
  word: string;
  col: number;
  mark: Mark;
  x: number;
  lane: number;
  w: number;
  at: number;
  /** It rises (not when it sits under the combo counter). */
  rise: boolean;
  /** A newer callout took its spot while it was fading: it goes quickly from this time. */
  cut?: number;
}

export class Callouts {
  private g: G | null = null;
  private gTab: G | null = null;
  private texts: TextPool;
  private tabTexts: TextPool;
  private live: Callout[] = [];
  private pend: Pending[] = [];
  /** When each id (and bucket) last showed. */
  private last = new Map<string, number>();
  /** This batch's context: where the tap landed, where blocks just spawned, where a trap was burnt off. */
  private tapPos: number | null = null;
  private spawnPos = new Map<string, number>();
  private trapPos: number | null = null;
  /** The style readout's tab: its last value (a change pulses it), when it last changed, where it was drawn. */
  private tabKey = '';
  private tabAt = -1e9;
  private tabRect: Rect | null = null;
  private tabFight: unknown = null;
  private tabIn = -1e9;

  /** Where the style tab was drawn last frame (null while it isn't showing): what's stored flies into it. */
  get tab(): Rect | null {
    return this.tabRect;
  }

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, 25.2);
    // (the tab sits over the bar's blocks but under its cursor, which may pass over it at the left end)
    this.tabTexts = new TextPool(s, 11.25);
  }

  /** A new layout: the graphics (kept across layouts, like the HUD's), nothing in flight. */
  build(): void {
    this.g ??= this.s.add.graphics().setDepth(25.1);
    this.gTab ??= this.s.add.graphics().setDepth(11.2);
    this.newFight();
  }

  /** A new fight: nothing in flight, the throttles and the tab start over. */
  newFight(): void {
    this.live = [];
    this.pend = [];
    this.last.clear();
    this.tabKey = '';
    this.tabRect = null;
    this.endBatch();
  }

  private endBatch(): void {
    this.pend = [];
    this.tapPos = null;
    this.spawnPos.clear();
    this.trapPos = null;
  }

  // ------------------------------------------------------------------ events

  /** The hero's style's colour and icon (one hero per style). */
  private heroLook(c: Combat): { col: number; mark: Mark } {
    const look = STYLE_LOOK[heroDef(c.heroId as HeroId).style];
    return { col: look.face[0], mark: { kind: 'style', icon: look.icon } };
  }

  /** Who a perk belongs to and how its callout looks; null when it isn't the hero's own (a relic, a skill node, gear). */
  private lookOf(c: Combat, id: string): { word: string; col: number; mark: Mark; bucket?: Bucket; always?: boolean } | null {
    if (GEAR_PERKS.has(id) || NO_WORD.has(id) || (perkSource(id) !== 'kit' && !SKILL_WORDS.has(id))) return null;
    let word = CALLOUT_WORDS[id];
    if (word === undefined) {
      // a kit part without a word yet: its name, when it fits
      const name = perkName(id);
      if (textWidth(name, 1, true) > MAX_W) return null;
      word = name;
    }
    const pet = PERK_PET[id];
    if (pet) {
      const col = PET_COL[pet as CompanionId];
      return { word, col: COIN_PERKS.has(id) ? 0xffe680 : col, mark: { kind: 'paw', col }, bucket: 'pet', always: id === 'rockWall' };
    }
    if (id === 'rally') return { word, col: 0xffe680, mark: { kind: 'leaf', col: 0x9af06a }, always: true };
    if (id in ALLY_COL) {
      const col = ALLY_COL[id as AllyKind];
      return { word, col: mix(col, WHITE, 0.25), mark: { kind: 'leaf', col }, bucket: ALLY_DOINGS.has(id) ? 'ally' : undefined, always: id === 'barkback' || id === 'spiritTortoise' };
    }
    return { word, ...this.heroLook(c) };
  }

  /** Every event of a batch comes through here (scene.onEvents); the callouts it makes go up in flush(). */
  onEvent(e: CombatEvent): void {
    const c = this.s.app.run.combat;
    if (!c) return;
    switch (e.type) {
      case 'hit':
      case 'block':
      case 'miss':
      case 'chip':
      case 'wardBreak':
      case 'counter':
      case 'trap':
      case 'holdStart':
        this.tapPos = e.pos;
        break;
      case 'spawn': {
        const b = c.blocks.find((x) => x.id === e.id);
        if (b) this.spawnPos.set(e.kind, b.pos);
        break;
      }
      case 'remove':
        if (e.kind === 'purple' && e.reason === 'perk') this.trapPos = e.pos;
        break;
      case 'perk': {
        const look = this.lookOf(c, e.id);
        if (!look) break;
        let word = look.word;
        if (e.id === 'guardUp') word = `Guard ${whole(Math.max(1, guardOf(c), e.amount))}`;
        else if (e.id === 'windUp') word = e.amount > 0 ? mult(e.amount / 100) : 'Smash!';
        else if (e.id === 'chain') word = `Chain ${whole(Math.max(2, e.amount))}`;
        else if (COIN_PERKS.has(e.id)) word = signed(Math.max(1, e.amount));
        let pos: Pending['pos'] = e.pos ?? (AT_LEFT.has(e.id) ? 'left' : null);
        if (pos === null && (e.id === 'seedling' || e.id === 'starlight')) pos = this.spawnPos.get('green') ?? null;
        if (pos === null && e.id === 'fuseUp') pos = this.spawnPos.get('keg') ?? null;
        if (pos === null && e.id === 'fireBreath') pos = this.trapPos;
        this.pend.push({ id: e.id, word, col: look.col, mark: look.mark, pos, bucket: look.bucket, always: look.always });
        break;
      }
      case 'coins':
        // Sunny's Gold Hoard (no perk event of its own): the extra coins a kill dropped
        if (e.id === 'goldHoard') this.pend.push({ id: e.id, word: signed(e.amount), col: 0xffe680, mark: { kind: 'paw', col: PET_COL.sunny }, pos: null, bucket: 'pet' });
        break;
      case 'dash':
        // Shadow Dash: where it started (the cursor bursts away from there, so the word sits behind it)
        this.pend.push({ id: 'dash', word: CALLOUT_WORDS.dash, ...this.heroLook(c), pos: e.from, side: e.to >= e.from ? -1 : 1 });
        break;
      case 'explode':
        // one of the hero's own kegs blew
        if (e.own) this.pend.push({ id: 'keg', word: CALLOUT_WORDS.keg, ...this.heroLook(c), pos: e.pos });
        break;
      case 'ally':
        // (the Great Spirit's coming names itself: 'Spirit!', its perk)
        if (e.action === 'call' && e.kind !== 'spiritStag') {
          const col = ALLY_COL[e.kind];
          this.pend.push({ id: `call:${e.kind}`, word: CALLOUT_WORDS[`call:${e.kind}`] ?? '+Ally', col: mix(col, WHITE, 0.25), mark: { kind: 'leaf', col }, pos: null, bucket: 'ally', always: true });
        }
        break;
      case 'ability': {
        // the green ability: named on each green (Moss's call, Tam's keg and Vesper's shot name themselves)
        const word = CALLOUT_WORDS[`ability:${c.heroId}`];
        if (word) this.pend.push({ id: `ability:${c.heroId}`, word, ...this.heroLook(c), col: mix(0x9af0a0, this.heroLook(c).col, 0.35), pos: null });
        break;
      }
    }
  }

  /** The batch is in: merge what belongs together, throttle, place and pop the callouts. */
  flush(): void {
    const s = this.s;
    const c = s.app.run.combat;
    if (!c || !this.pend.length) return this.endBatch();
    const now = performance.now();
    // Sable: the Chain grows on the same Perfect that dashes: one word for both ("Dash x3")
    const dash = this.pend.find((p) => p.id === 'dash');
    const chain = this.pend.find((p) => p.id === 'chain');
    if (dash && chain) {
      dash.word = `Dash x${chain.word.replace(/\D/g, '')}`;
      this.pend.splice(this.pend.indexOf(chain), 1);
    }
    for (const p of this.pend) {
      if (!this.allowed(p, now)) continue;
      const pos = p.pos === 'left' ? 0 : (p.pos ?? this.tapPos ?? c.cursorPos());
      this.place(p, s.barView.x(Math.max(0, Math.min(1, pos))), now);
    }
    this.endBatch();
  }

  /** The throttles: the same id (or word in the same colour) at most every GAP_MS; one per bucket (the allies' doings,
   *  the companions' perks) at a time, the allies' doings each far less often. */
  private allowed(p: Pending, now: number): boolean {
    const since = (key: string) => now - (this.last.get(key) ?? -1e9);
    const gap = SLOW_GAP[p.id] ?? (p.bucket === 'ally' && !p.always ? ALLY_KIND_MS : GAP_MS);
    // (a number that changed is news: "Dash x3" right after "Dash x2", "Guard 3" after "Guard 2")
    const key = /\d/.test(p.word) && !p.word.startsWith('+') ? `${p.id}:${p.word}` : p.id;
    if (since(key) < gap) return false;
    if (since(`w:${p.word}:${p.col}`) < GAP_MS) return false;
    if (p.bucket && !p.always && since(`b:${p.bucket}`) < BUCKET_MS[p.bucket]) return false;
    this.last.set(key, now);
    this.last.set(`w:${p.word}:${p.col}`, now);
    if (p.bucket) this.last.set(`b:${p.bucket}`, now);
    return true;
  }

  /** The width of a callout's mark (and the pixel after it). */
  private markW(m: Mark): number {
    if (!m) return 0;
    if (m.kind === 'style') return pixSize(m.icon)[0] + 1;
    return m.kind === 'paw' ? PAW[0].length + 3 : 10;
  }

  /** Lane `i`'s text box top (bold text: 10 px tall); lane 0 sits on the bar's frame. */
  private laneY(i: number): number {
    return this.s.bar.y - 15 - i * LANE_H;
  }

  /**
   * Find it a spot: in the lowest lane where, stepped aside at most MAX_SHIFT px from where it happened, it overlaps
   * nothing (the callouts showing, the tap's judgement, the style readout's tab, the combo counter), inside the safe
   * area. With every lane busy, the oldest callout makes room.
   */
  private place(p: Pending, x0: number, now: number): void {
    const s = this.s;
    const w = this.markW(p.mark) + textWidth(p.word, 1, true);
    const lo = s.L + 2 + w / 2;
    const hi = s.R - 2 - w / 2;
    const judge = s.fx.judgeShown(now);
    const combo = s.hud.comboRect;
    // the cursor's top cap pokes up into lane 0: step aside from it, behind it rather than where it's about to run
    // (a callout there would be run over while it shows)
    const c = s.app.run.combat;
    const cx = c ? s.barView.x(c.cursorPos()) : -1e9;
    const dir = c ? c.cursorDirAt(c.time) : 1;
    const run = c ? c.cursorSpeed() * s.bar.w * LIFE_MS * 0.0006 : 0;
    const [r0, r1] = dir > 0 ? [cx, cx + run] : [cx - run, cx];
    const side = p.side ?? -dir;
    // (a side asked for outright weighs more than the cursor's)
    const sideCost = p.side ? 15 : 0.5;
    const tab = this.tabSlot(c);
    let at = now;
    // (a judgement still popping at 2x: wait for it)
    if (judge && now - judge.born < JUDGE_POP_MS && Math.abs(judge.x - x0) < judge.w + w / 2 + 2) at = judge.born + JUDGE_POP_MS;
    // callouts already fading give way: a newer one may take their spot (they go quickly)
    const fading = (k: Callout) => !!k.cut || now - k.at > LIFE_MS * 0.55;
    // the lowest lane wins unless its spot is a long step aside or in the cursor's way
    let best: { x: number; lane: number; d: number } | null = null;
    for (let lane = 0; lane < LANES; lane++) {
      const y0 = this.laneY(lane) - RISE;
      const y1 = this.laneY(lane) + 10;
      const busy: Array<[number, number]> = [];
      for (const k of this.live) if (k.lane === lane && !fading(k)) busy.push([k.x - k.w / 2, k.x + k.w / 2]);
      if (judge && lane <= 1) busy.push([judge.x - judge.w / 2, judge.x + judge.w / 2]);
      if (lane === 0) busy.push([cx - 5, cx + 5]);
      if (tab && tab.y < y1 && tab.y + tab.h + 1 > y0) busy.push([tab.x - 1, tab.x + tab.w + 1]);
      // lane 0 fits under the combo counter (it doesn't rise there); the lanes above go round it
      if (combo && lane > 0 && combo.y < y1 && combo.y + combo.h > y0) busy.push([combo.x, combo.x + combo.w]);
      const clear = (x: number) => x >= lo - 0.01 && x <= hi + 0.01 && busy.every(([a, b]) => x + w / 2 + 2 <= a || x - w / 2 - 2 >= b);
      const fit = (x: number) => Math.max(lo, Math.min(hi, x));
      const tries = [fit(x0)];
      for (const [a, b] of busy) tries.push(a - w / 2 - 2, b + w / 2 + 2, fit(a - w / 2 - 2), fit(b + w / 2 + 2));
      for (const x of tries) {
        // (stepping aside to the side behind the cursor, or to the side asked for)
        const inWay = lane === 0 && x + w / 2 > r0 && x - w / 2 < r1;
        const d = Math.abs(x - x0) + ((x - x0) * side < 0 ? sideCost : 0) + lane * 40 + (inWay ? 10 : 0);
        if (Math.abs(x - x0) <= MAX_SHIFT + Math.max(0, lo - x0) + Math.max(0, x0 - hi) && clear(x) && (!best || d < best.d)) best = { x, lane, d };
      }
    }
    if (!best) {
      // every lane is busy round here: the oldest goes, this one takes lane 0 where it happened
      this.live.shift();
      best = { x: Math.max(lo, Math.min(hi, x0)), lane: 0, d: 0 };
    }
    const x = Math.round(best.x);
    // the fading ones it lands on go now
    for (const k of this.live) if (k.lane === best.lane && !k.cut && Math.abs(k.x - x) < (k.w + w) / 2 + 2) k.cut = now;
    const rise = !(best.lane === 0 && combo && x - w / 2 < combo.x + combo.w && x + w / 2 > combo.x);
    this.live.push({ id: p.id, word: p.word, col: p.col, mark: p.mark, x, lane: best.lane, w, at, rise });
    while (this.live.length > MAX_ON) this.live.shift();
  }

  // ------------------------------------------------------------------ frame

  draw(now: number): void {
    const s = this.s;
    const g = this.g;
    const gt = this.gTab;
    if (!g || !gt) return;
    g.clear();
    gt.clear();
    this.texts.begin();
    this.tabTexts.begin();
    const c = s.app.run.combat;
    if (c && s.fightHud()) {
      if (s.app.run.phase === 'fight') this.drawTab(gt, c, now);
      else this.tabRect = null;
      this.drawCallouts(g, now);
    } else {
      this.live = [];
      this.tabRect = null;
    }
    this.texts.end();
    this.tabTexts.end();
  }

  private drawCallouts(g: G, now: number): void {
    // a newer tap's judgement takes precedence: the callouts it pops onto go
    const judge = this.s.fx.judgeShown(now);
    if (judge)
      for (const k of this.live)
        if (!k.cut && k.lane <= 1 && judge.born > k.at + 1 && Math.abs(k.x - judge.x) < (k.w + judge.w) / 2 + 1) k.cut = now;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const k = this.live[i];
      const age = now - k.at;
      const cutK = k.cut ? (now - k.cut) / 90 : 0;
      if (age > LIFE_MS || cutK >= 1) {
        this.live.splice(i, 1);
        continue;
      }
      if (age < 0) continue;
      const q = age / LIFE_MS;
      const a = (q < 0.62 ? 1 : 1 - (q - 0.62) / 0.38) * (1 - cutK);
      const pop = age < 70;
      const y = this.laneY(k.lane) - (k.rise ? Math.round(RISE * ease(clamp01(age / 420))) : 0) - (pop ? 1 : 0);
      const x0 = Math.round(k.x - k.w / 2);
      const mw = this.markW(k.mark);
      // the pop: a flash of white behind it
      if (pop) glow(g, { x: x0, y: y + 1, w: k.w, h: 8 }, mix(k.col, WHITE, 0.5), 0.7 * (1 - age / 70), 2);
      this.drawMark(g, k.mark, x0, y, a);
      this.texts.text(k.word, x0 + mw, y, pop ? mix(k.col, WHITE, 0.7) : k.col, { bold: true, alpha: a });
    }
  }

  /** A callout's mark, vertically centred on its word's capitals. */
  private drawMark(g: G, m: Mark, x: number, y: number, a: number): void {
    if (!m) return;
    if (m.kind === 'style') {
      const [, h] = pixSize(m.icon);
      pix(g, m.icon, x, y + Math.round((9 - h) / 2), a);
      return;
    }
    const shape = m.kind === 'paw' ? PAW : FOE_ICONS.leaf;
    const top = y + Math.round((9 - shape.length) / 2);
    const left = x + 1;
    g.fillStyle(INK, a);
    shape.forEach((r, yy) => {
      for (let xx = 0; xx < r.length; xx++) if (r[xx] !== '.') g.fillRect(left + xx - 1, top + yy - 1, 3, 3);
    });
    g.fillStyle(m.col, a);
    shape.forEach((r, yy) => {
      for (let xx = 0; xx < r.length; xx++) if (r[xx] !== '.') g.fillRect(left + xx, top + yy, 1, 1);
    });
  }

  /** Where the style tab sits: on the bar's frame just right of the left end's column (where the blockers stand and
   *  reds land), under the combo counter. */
  private tabHome(): { x: number; y: number } {
    return { x: this.s.bar.x + 5, y: this.s.bar.y - 14 };
  }

  /** The room the style tab takes (kept free for it even while it has nothing to show, so a callout never ends up
   *  under it when it appears); null for a style without one. */
  private tabSlot(c: Combat | null): Rect | null {
    if (this.tabRect) return this.tabRect;
    if (!c || !styleState(this.s, c)) return null;
    const h = this.tabHome();
    return { x: h.x, y: h.y, w: 30, h: 10 };
  }

  /**
   * The style readout's twin as a tab on the bar's left end (sitting on its frame, under the combo counter): what the
   * style has stored, the empty pips or gauge waiting to fill for Guard, Focus and the allies. It slides up out of the
   * frame as the fight starts and pulses (a white flash, a hop) whenever its value changes.
   */
  private drawTab(g: G, c: Combat, now: number): void {
    const s = this.s;
    if (c !== this.tabFight) {
      this.tabFight = c;
      this.tabIn = now + 380;
      this.tabKey = '';
    }
    const st = styleState(s, c);
    const style = heroDef(c.heroId as HeroId).style;
    const show = !!st && (!st.empty || EMPTY_TAB.has(style));
    if (!st || !show) {
      this.tabRect = null;
      if (this.tabKey) this.tabKey = 'hidden';
      return;
    }
    // (a new value, or showing again: it pulses; not as the fight starts)
    if (st.key !== this.tabKey) {
      if (this.tabKey) this.tabAt = now;
      this.tabKey = st.key;
    }
    const ik = clamp01((now - this.tabIn) / 220);
    if (ik <= 0) {
      this.tabRect = null;
      return;
    }
    const pk = (now - this.tabAt) / 260;
    const hop = pk >= 0 && pk < 1 ? Math.round(Math.sin(pk * Math.PI) * 2) : 0;
    const home = this.tabHome();
    const y = home.y + Math.round((1 - ease(ik)) * 6) - hop;
    const r = drawStyleChip(s, g, this.tabTexts, c, home.x, y, now, { empty: true, alpha: ik });
    this.tabRect = r;
    if (r && pk >= 0 && pk < 1) {
      glow(g, r, STYLE_LOOK[style].face[0], 0.7 * (1 - pk), 2);
      rows(g, r.x, r.y, r.w, r.h, 1, WHITE, 0.55 * (1 - pk) * (1 - pk));
    }
  }
}
