// Perk bench: each relic and skill node alone on a typical Act 3 hero, against the same fights without it (the same
// seeds). An Act 3 normal fight (4 waves, row 4) and the Boar King. Shows what each perk adds: fight length, HP lost
// (all of it, and from foes), combo, finisher share, crits. Measurement only.
// RUNS=60 ACC=0.85 npx vitest run --config vitest.balance.config.ts tests/balance/perks.run.ts
import type { HeroId } from '../../src/data/heroes';
import { it } from 'vitest';
import { RELICS, type RelicId } from '../../src/data/relics';
import { SKILL_TREES } from '../../src/data/skills';
import { fight, type FightStats } from '../../src/core/bot';
import { newHero } from '../../src/core/combat';
import { emptyLoadout } from '../../src/core/gear';
import { xpForLevel } from '../../src/core/heroes';
import { newProfile } from '../../src/core/profile';
import { Rng } from '../../src/core/rng';
import { Run } from '../../src/core/run';
import { cloneTuning, DEFAULT_SETTINGS, mergeKnown, type Tuning } from '../../src/core/tuning';

const RUNS = Number(process.env.RUNS ?? 60);
const ACC = Number(process.env.ACC ?? 0.85);
const ATK = Number(process.env.HERO_ATK ?? 22); // run attack gains going into Act 3 (kills)
const HP = Number(process.env.HERO_HP ?? 110);
const DEF = Number(process.env.HERO_DEF ?? 15);
const LEVEL = Number(process.env.LEVEL ?? 8);
const BOSS = process.env.BOSS !== '0';
const HERO = (process.env.HERO ?? 'rowan') as HeroId;
const WAVES = [['wolf', 'wolf', 'archer'], ['beetle', 'boar'], ['boar', 'bandit'], ['wolf', 'wolf', 'shaman']];

interface Variant {
  name: string;
  relics: RelicId[];
  skills: string[];
}

function play(t: Tuning, v: Variant, boss: boolean, seed: number): FightStats {
  const p = newProfile();
  p.actsCleared = 3;
  p.hero = HERO;
  p.heroes[HERO].unlocked = true;
  p.heroes[HERO].xp = xpForLevel(t, LEVEL);
  p.heroes[HERO].skills = v.skills.slice();
  const run = new Run(t, { ...DEFAULT_SETTINGS }, seed, p);
  const gear = emptyLoadout();
  gear.stats.def = DEF;
  gear.stats.critChance = 0.04;
  Object.defineProperty(run, 'gear', { get: () => gear });
  const hero = newHero(t);
  hero.bonusAtk = ATK;
  hero.bonusMaxHp = HP;
  hero.relics = v.relics.slice();
  run.debugFight(2, boss ? ['boarKing'] : WAVES[0], boss ? 'boss' : 'fight', hero);
  if (!boss) {
    run.node!.waves = WAVES.map((w) => w.slice());
    run.node!.row = 4;
    run.startFight();
  }
  run.hero.hp = 1e6;
  run.refreshGear();
  return fight(run, run.combat!, new Rng(seed ^ 0x9e37), { accuracy: ACC, seed });
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const foe = (f: FightStats) => (f.hpBy.red ?? 0) + (f.hpBy.bomb ?? 0) + (f.hpBy.trap ?? 0) + (f.hpBy.counter ?? 0);

it('perk bench', () => {
  const t = cloneTuning();
  mergeKnown(t, JSON.parse(process.env.TUNE ?? '{}'));
  // BUILD=relic,relic,...: every variant carries these too, and each is also left out once (its worth in the build)
  const build = (process.env.BUILD ?? '').split(',').filter(Boolean) as RelicId[];
  const variants: Variant[] = [{ name: build.length ? '(the build)' : '(none)', relics: build.slice(), skills: [] }];
  for (const r of build) variants.push({ name: `- ${r}`, relics: build.filter((x) => x !== r), skills: [] });
  if (process.env.SINGLES !== '0') for (const r of RELICS) if (!build.includes(r.id)) variants.push({ name: r.id, relics: [...build, r.id], skills: [] });
  if (process.env.SKILLS !== '0') for (const b of SKILL_TREES[HERO]) for (let k = 0; k < b.nodes.length; k++) variants.push({ name: `${b.id}:${b.nodes[k].id}`, relics: build.slice(), skills: b.nodes.slice(0, k + 1).map((n) => n.id) });
  const extra = (process.env.COMBOS ?? 'chainReaction+verdantSurge,sweeper+crescendo,hoarder+overcharge,sharpshooter+weakSpot+ricochet,unbroken+sweeper').split(',').filter(Boolean);
  for (const c of extra) variants.push({ name: c, relics: [...build, ...(c.split('+').filter((x) => RELICS.some((r) => r.id === x)) as RelicId[])], skills: c.split('+').filter((x) => !RELICS.some((r) => r.id === x)) });
  const rows: string[] = [];
  let base: { sec: number; bsec: number } | null = null;
  for (const v of variants) {
    const fs = Array.from({ length: RUNS }, (_, i) => play(t, v, false, 1000 + i));
    const bs = BOSS ? Array.from({ length: Math.round(RUNS / 2) }, (_, i) => play(t, v, true, 5000 + i)) : [];
    const sec = avg(fs.filter((f) => f.won).map((f) => f.seconds));
    const bsec = avg(bs.filter((f) => f.won).map((f) => f.seconds));
    base ??= { sec, bsec };
    rows.push(
      `${v.name.padEnd(34)} fight ${sec.toFixed(1)}s (${(((base.sec / sec) - 1) * 100).toFixed(0).padStart(4)}% dps) lost ${(100 * avg(fs.map((f) => f.hpLost / f.maxHp))).toFixed(1).padStart(5)}% foes ${(100 * avg(fs.map((f) => foe(f) / f.maxHp))).toFixed(1).padStart(5)}% landed ${avg(fs.map((f) => f.redsTaken)).toFixed(2)} combo ${avg(fs.map((f) => f.avgCombo)).toFixed(1).padStart(5)}/${avg(fs.map((f) => f.peakCombo)).toFixed(0).padStart(3)} fin ${(100 * avg(fs.map((f) => f.finisherDamage / Math.max(1, f.damage)))).toFixed(0).padStart(3)}% crit ${(100 * avg(fs.map((f) => f.crits / Math.max(1, f.hits)))).toFixed(0).padStart(3)}%` +
        (BOSS ? ` | boss won ${(100 * bs.filter((f) => f.won).length / bs.length).toFixed(0).padStart(3)}% ${bsec.toFixed(1)}s fin ${avg(bs.map((f) => f.finishers)).toFixed(1)} (max ${avg(bs.map((f) => f.maxStackFinishers)).toFixed(1)}) share ${(100 * avg(bs.map((f) => f.finisherDamage / Math.max(1, f.damage)))).toFixed(0)}% misses ${avg(bs.map((f) => f.misses)).toFixed(1)} combo ${avg(bs.map((f) => f.avgCombo)).toFixed(0)} (${(((base.bsec / bsec) - 1) * 100).toFixed(0).padStart(4)}%) lost ${(100 * avg(bs.map((f) => f.hpLost / f.maxHp))).toFixed(0).padStart(4)}% foes ${(100 * avg(bs.map((f) => foe(f) / f.maxHp))).toFixed(0).padStart(4)}%` : ''),
    );
  }
  process.stderr.write(`${rows.join('\n')}\n`);
}, 3_600_000);
