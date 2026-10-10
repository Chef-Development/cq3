// The bot crawl (team 4, round 8): plays the whole campaign with the bot for every hero on several seeds and checks
// invariants after every step, hunting crashes and stuck states rather than balance. Run by hand, never in CI:
//   flock /home/user/wt/.bal.lock nice -n 10 npm run crawl         (HEROES=rowan,sable SEEDS=3 REGIONS=3 OUT=path)
// Per run: a fresh profile, Greenmarch's run, then each later region's fresh run (a camp visit between: chests,
// upgrades, companions) and a skirmish with the world map's wandering foe. Odd seeds play like the balance bot
// (synergy-greedy picks, its shop); even seeds play at random (any pick, any buy, bounties passed or taken, a hero
// switched mid-act now and then) to reach the paths the bot never takes.
// Checked after every run step: no exception; HP, max HP, coins, gems, scrap, XP and levels finite and in range; a map
// always offers a next node; a pick always has cards and taking one moves on; loot always resolves; every step moves
// the run on (a step that changes nothing twice in a row is a stuck screen). Checked every 16 fight ticks: the hero's
// and the foes' HP, the meter, stacks, combo, the cursor and every block's place and width finite and in range. A
// fight still going after 10 minutes of fight time is a stuck fight.
import { writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { botPick, botRun, campVisit, equipBest, fight, spendSkills, TYPICAL_ACCURACY, type BotOptions } from '../../src/core/bot';
import { Combat, heroMaxHp } from '../../src/core/combat';
import { newProfile, type Profile } from '../../src/core/profile';
import { Rng } from '../../src/core/rng';
import type { Run } from '../../src/core/run';
import { cloneTuning, type Tuning } from '../../src/core/tuning';
import { eventById } from '../../src/data/events';
import { HERO_IDS, type HeroId } from '../../src/data/heroes';
import { REGIONS, regionStart } from '../../src/data/regions';

const HERO_LIST = (process.env.HEROES ? process.env.HEROES.split(',') : HERO_IDS) as HeroId[];
const SEEDS = Number(process.env.SEEDS ?? 3);
const REG = Math.min(Number(process.env.REGIONS ?? REGIONS.length), REGIONS.length);
const OUT = process.env.OUT ?? '';

interface Finding {
  what: string;
  where: string;
}
const findings: Finding[] = [];
let where = '';
const flag = (what: string) => {
  findings.push({ what, where });
  if (findings.length > 2000) throw new Error('too many findings');
};
const bad = (v: unknown) => typeof v !== 'number' || !Number.isFinite(v);

// ---- every 16 fight ticks: the fight's numbers
let ticks = 0;
const step0 = Combat.prototype.step;
Combat.prototype.step = function step(this: Combat): void {
  step0.call(this);
  if ((++ticks & 15) !== 0) return;
  const c = this;
  const h = c.hero;
  if (bad(h.hp) || h.hp < -1e-6) flag(`fight: hero HP ${h.hp}`);
  for (const k of ['meter', 'stacks', 'combo', 'time'] as const) if (bad(c[k]) || c[k] < 0) flag(`fight: ${k} ${c[k]}`);
  if (c.meter > 1 + 1e-6) flag(`fight: meter above 1 (${c.meter})`);
  const p = c.cursorPos();
  if (bad(p)) flag(`fight: cursor at ${p}`);
  for (const e of c.enemies) {
    if (bad(e.hp) || bad(e.maxHp) || e.maxHp <= 0) flag(`fight: ${e.key} HP ${e.hp}/${e.maxHp}`);
    else if (e.hp > e.maxHp * 1.0001 + 1e-6) flag(`fight: ${e.key} HP above its max (${e.hp}/${e.maxHp})`);
  }
  for (const b of c.blocks) if (bad(b.pos) || bad(b.width) || b.width <= 0) flag(`fight: ${b.kind} block at ${b.pos} width ${b.width}`);
};

/** After every run step: the run's and the profile's numbers. */
function checkRun(t: Tuning, run: Run): void {
  const p = run.profile;
  const h = run.hero;
  const max = heroMaxHp(t, h);
  if (bad(h.hp) || bad(max) || max <= 0) flag(`run: hero HP ${h.hp}/${max}`);
  else if (h.hp > max + 1e-6 && run.phase !== 'fight') flag(`run: hero HP above max (${h.hp}/${max}) in ${run.phase}`);
  for (const k of ['coins', 'gems', 'scrap'] as const) if (bad(p[k]) || p[k] < 0) flag(`profile: ${k} ${p[k]}`);
  for (const id of HERO_IDS) {
    const hp = p.heroes[id] as unknown as Record<string, unknown>;
    for (const k of ['xp', 'level', 'shards', 'stars']) if (k in hp && bad(hp[k])) flag(`profile: ${id}.${k} ${String(hp[k])}`);
  }
  if (p.items.length > t.gear.bagSize + 8) flag(`profile: bag over its size (${p.items.length})`);
  for (const i of p.items) {
    if (!i || bad(i.ilvl) || bad(i.plus)) flag(`profile: item ${i?.base ?? '?'} level ${i?.ilvl} +${i?.plus}`);
    else for (const b of i.bonus) if (bad(b.q) || b.q < 0 || b.q > 1) flag(`profile: item ${i.base} bonus ${b.stat} roll ${b.q}`);
  }
}

/** A signature of where the run stands: a step that leaves it unchanged twice made no progress. */
const sig = (run: Run) =>
  `${run.phase}|${run.actIndex}|${run.node?.id ?? '-'}|${run.path.length}|${run.boostChoices.length}|${run.loot.length}|${run.combat?.tick ?? 0}|${run.hero.hp}|${run.profile.coins}|${run.quest?.id ?? '-'}|${run.shop?.length ?? 0}`;

/** One attempt at the current act (the bot's playAct, with every step checked; `wild` plays at random). */
function crawlAct(t: Tuning, run: Run, rng: Rng, o: BotOptions, wild: boolean): 'won' | 'lost' | 'stuck' {
  let last = '';
  let same = 0;
  for (let guard = 0; guard < 400; guard++) {
    const ph = run.phase;
    where = `${o.hero} seed ${o.seed} act ${run.actIndex + 1} ${ph}${run.node ? ` (${run.node.type} ${run.node.id})` : ''}`;
    const s = sig(run);
    if (s === last && ++same >= 2) {
      flag(`stuck: no progress in ${ph}`);
      return 'stuck';
    }
    if (s !== last) same = 0;
    last = s;
    if (ph === 'scene') run.skipScenes();
    else if (ph === 'map' && run.secretHere && rng.next() < 0.5) run.openSecret();
    else if (ph === 'map') {
      const ch = run.choices();
      if (!ch.length) {
        flag('stuck: a map with no next node');
        return 'stuck';
      }
      // now and then the random player switches heroes at camp mid-act (the fight reads who's fighting)
      if (wild && rng.next() < 0.05) {
        const others = HERO_IDS.filter((id) => run.profile.heroes[id].unlocked);
        run.profile.hero = others[rng.int(others.length)];
        run.refreshGear();
      }
      if (!run.chooseNode(ch[rng.int(ch.length)])) flag('map: a node offered as a choice could not be chosen');
    } else if (ph === 'fight') {
      const c = run.combat;
      if (!c) {
        flag('fight phase with no fight');
        return 'stuck';
      }
      fight(run, c, rng, o);
      if (run.phase === 'fight' && !c.result) {
        flag(`stuck fight: still going after ${Math.round(c.time)} s (${c.enemies.map((e) => `${e.key} ${Math.round(e.hp)}`).join(', ')})`);
        return 'stuck';
      }
    } else if (ph === 'bounty') {
      if (wild && rng.next() < 0.3) run.passQuest();
      else if (!run.takeQuest()) flag('bounty: the board offers no quest it can take');
    } else if (ph === 'loot') {
      run.collectLoot();
      checkRun(t, run);
      where += ' (after the bag changed what is worn)';
      equipBest(run);
      spendSkills(run, rng);
    } else if (ph === 'boost') {
      if (!run.boostChoices.length) flag('pick: no cards to pick from');
      const cards = run.boostChoices;
      checkRun(t, run);
      where += ' (after the pick)';
      run.pickBoost(wild ? rng.int(Math.max(1, run.boostChoices.length)) : botPick(run, rng, o.accuracy));
      // (a second pick can follow at once: a replay's starting relics, a bounty's; the same cards still up is stuck)
      if (run.phase === 'boost' && run.boostChoices === cards) flag('pick: taking a card did not move on');
    } else if (ph === 'treasure') run.openTreasure();
    else if (ph === 'rest') run.rest();
    else if (ph === 'shop') {
      const order = run.shop.map((_, i) => i);
      if (wild) order.sort(() => rng.next() - 0.5);
      for (const i of order) if (wild ? rng.next() < 0.5 : true) run.buy(i);
      run.leaveShop();
    } else if (ph === 'event') {
      const order = (eventById(run.event?.id ?? '')?.choices ?? []).map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        [order[i], order[j]] = [order[j], order[i]];
      }
      for (const i of order) if (run.chooseEvent(i)) break;
      run.endEvent();
      if (run.phase === 'event') {
        flag('event: no choice could be taken and it did not end');
        run.event = null;
        run.phase = 'map';
      }
    } else if (ph === 'actClear' || ph === 'victory') return 'won';
    else if (ph === 'defeat') return 'lost';
    else {
      flag(`unexpected phase mid-act: ${ph}`);
      return 'stuck';
    }
    checkRun(t, run);
  }
  flag('stuck: 400 steps without the act ending');
  return 'stuck';
}

/** The world map's wandering foe, forced up: one skirmish, then back to the world map. */
function crawlSkirmish(t: Tuning, profile: Profile, rng: Rng, o: BotOptions): void {
  const run = botRun(t, o.seed + 77, profile, 0);
  run.toWorld();
  profile.wander.up = true;
  where = `${o.hero} seed ${o.seed} skirmish`;
  if (!run.startSkirmish()) return flag('skirmish: the wandering foe could not be fought');
  for (let guard = 0; guard < 20 && run.phase !== 'world'; guard++) {
    const ph = run.phase;
    if (ph === 'fight') fight(run, run.combat!, rng, o);
    else if (ph === 'loot') run.collectLoot();
    else if (ph === 'boost') run.pickBoost(0);
    else if (ph === 'defeat') {
      run.toWorld();
      break;
    } else return flag(`skirmish: unexpected phase ${ph}`);
    checkRun(t, run);
  }
  if (run.phase !== 'world') flag(`skirmish: did not end on the world map (${run.phase})`);
}

function crawl(t: Tuning, hero: HeroId, seed: number): { acts: number; result: string } {
  const wild = seed % 2 === 0;
  const o: BotOptions = { accuracy: TYPICAL_ACCURACY + (wild ? -0.05 : 0.05), seed, hero };
  const profile = newProfile();
  if (hero !== 'rowan') {
    profile.heroes[hero].unlocked = true;
    profile.hero = hero;
  }
  const rng = new Rng(seed ^ 0x2545f491);
  let acts = 0;
  for (let r = 0; r < REG; r++) {
    if (r > 0) {
      where = `${hero} seed ${seed} camp before region ${r + 1}`;
      campVisit(t, profile, rng);
      crawlSkirmish(t, profile, rng, o);
    }
    const from = regionStart(r);
    const run = botRun(t, (seed + 15485863 * r) >>> 0, profile, from);
    equipBest(run);
    for (let a = from; a < from + REGIONS[r].acts.length; a++) {
      let res: string = 'lost';
      for (let k = 0; k < 6 && res === 'lost'; k++) {
        if (k > 0) run.retry();
        res = crawlAct(t, run, rng, o, wild);
      }
      if (res !== 'won') return { acts, result: res === 'stuck' ? 'stuck' : `lost act ${a + 1}` };
      acts++;
      if (run.phase === 'actClear') {
        run.nextAct();
        run.skipScenes();
      }
    }
  }
  return { acts, result: 'campaign won' };
}

it('the bot crawl: every hero through the campaign, invariants after every step', () => {
  const t0 = Date.now();
  const lines: string[] = [];
  for (const h of HERO_LIST)
    for (let s = 1; s <= SEEDS; s++) {
      const t = cloneTuning();
      where = `${h} seed ${s}`;
      let out: { acts: number; result: string };
      try {
        out = crawl(t, h, s);
      } catch (e) {
        const err = e as Error;
        flag(`exception: ${err.message} @ ${(err.stack ?? '').split('\n').slice(1, 4).join(' <- ').replace(/\s+/g, ' ')}`);
        out = { acts: -1, result: 'crashed' };
      }
      lines.push(`${h} seed ${s} (${s % 2 ? 'bot' : 'random'}): ${out.result}, ${out.acts} acts cleared`);
      console.log(`${lines[lines.length - 1]}  [${((Date.now() - t0) / 1000).toFixed(0)} s]`);
    }
  // the same finding from many places is listed once, with its count and first place
  const by = new Map<string, { n: number; first: string }>();
  for (const f of findings) {
    const k = f.what.replace(/-?\d+(\.\d+)?(e[-+]?\d+)?/g, '#');
    const e = by.get(k);
    if (e) e.n++;
    else by.set(k, { n: 1, first: `${f.what} @ ${f.where}` });
  }
  const report = [
    `# Bot crawl: ${HERO_LIST.length} heroes x ${SEEDS} seeds, ${REG} regions, ${((Date.now() - t0) / 1000).toFixed(0)} s`,
    '',
    ...lines.map((l) => `- ${l}`),
    '',
    `## Findings (${findings.length}, ${by.size} distinct)`,
    '',
    ...[...by.values()].map((e) => `- x${e.n}: ${e.first}`),
  ].join('\n');
  console.log(report);
  if (OUT) writeFileSync(OUT, `${report}\n`);
  expect(findings.map((f) => f.what)).toEqual([]);
}, 3_600_000);
