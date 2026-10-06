// The balance report: npm run balance. Plays 1,000 whole runs of Greenmarch for a 55%, 70%, 85% and 95% player
// (random node choices on each act's map), prints the table and writes docs/balance.md.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { balance, GREENMARCH_ACTS, playFarm, timingSpread, type ActRow, type FarmResult, TYPICAL_ACCURACY } from '../../src/core/bot';
import { cloneTuning } from '../../src/core/tuning';
import type { RelicId } from '../../src/data/relics';

const RUNS = Number(process.env.RUNS ?? 1000);
const FARM_RUNS = Number(process.env.FARM_RUNS ?? Math.round(RUNS / 3));
const FARMS = 6;
const ACCURACIES = [0.55, 0.7, 0.85, 0.95];
const CONTROL_RUNS = Number(process.env.CONTROL_RUNS ?? Math.round(RUNS / 2));

/** With relics vs the same player with stat cards only. */
function relicsVsControl(rows: ActRow[], control: ActRow[]): string {
  const head = '| Player | Act | First-try clear: relics | stat cards only | Boss first fight won: relics | stat cards only | Relics carried into the boss | Hero level at the boss |';
  const body = control.map((c) => {
    const r = rows.find((x) => x.accuracy === c.accuracy && x.act === c.act)!;
    return `| ${pct(c.accuracy)} | ${c.act + 1} | **${pct(r.firstTry)}** | ${pct(c.firstTry)} | **${pct(r.bossFirstTry)}** | ${pct(c.bossFirstTry)} | ${num(r.relicsAtBoss)} | ${num(r.levelAtBoss)} |`;
  });
  return [head, '|---|---|---|---|---|---|---|---|', ...body].join('\n');
}

/** The Boar King's first fight (70% player) by build name and by relic carried in (most common first). */
function relicWins(r: ActRow): string {
  const rate = (e: { n: number; won: number }) => `${pct(e.won / e.n)} (${e.n})`;
  const builds = Object.entries(r.bossByBuild).sort((a, b) => b[1].n - a[1].n);
  const relics = Object.entries(r.bossByRelic).sort((a, b) => b[1].n - a[1].n);
  const half = Math.ceil(relics.length / 2);
  const rows = Array.from({ length: half }, (_, i) => {
    const a = relics[i];
    const b = relics[i + half];
    return `| ${a[0]} | ${rate(a[1])} | ${b ? b[0] : ''} | ${b ? rate(b[1]) : ''} |`;
  });
  return [
    '| Build (from the top tags) | Boar King first fight won (runs) |',
    '|---|---|',
    ...builds.map(([k, v]) => `| ${k} | ${rate(v)} |`),
    '',
    '| Relic carried in | Won (runs) | Relic carried in | Won (runs) |',
    '|---|---|---|---|',
    ...rows,
  ].join('\n');
}

const pct = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '-');
const sec = (v: number) => (Number.isFinite(v) ? `${Math.round(v)} s` : '-');
const num = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '-');
const pct1 = (v: number) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '-');

function table(rows: ActRow[]): string {
  const head = '| Player | Act | Reached | First-try clear | Clear (6 tries) | Avg tries | Boss first fight won | Fight / elite / boss | HP going into boss | Boss HP / max finisher | Hero attack entering |';
  const sep = '|---|---|---|---|---|---|---|---|---|---|---|';
  const body = rows.map(
    (r) =>
      `| ${pct(r.accuracy)} | ${r.act + 1} | ${pct(r.reached / r.runs)} | **${pct(r.firstTry)}** | ${pct(r.clearRate)} | ${num(r.attempts)} | **${pct(r.bossFirstTry)}** | ${sec(r.fightSec)} / ${sec(r.eliteSec)} / ${sec(r.bossSec)} | ${pct(r.hpAtBoss)} | ${num(r.bossVsMaxFinisher)} | ${num(r.heroAtk)} |`,
  );
  return [head, sep, ...body].join('\n');
}

function losses(rows: ActRow[]): string {
  const head = '| Player | Act | Lost attempts at: fight | elite | boss | Misses per tap | Hits taken per min | Specials per min | Finisher share of damage |';
  const sep = '|---|---|---|---|---|---|---|---|---|';
  const body = rows.map(
    (r) =>
      `| ${pct(r.accuracy)} | ${r.act + 1} | ${r.lostAt.fight ?? 0} | ${r.lostAt.elite ?? 0} | ${r.lostAt.boss ?? 0} | ${pct(r.missRate)} | ${num(r.hitsTakenPerMin)} | ${num(r.specialsPerMin)} | ${pct(r.finisherShare)} |`,
  );
  return [head, sep, ...body].join('\n');
}

/** Farming: the story once with found gear, then the Boar King's act replayed FARMS times, per accuracy. */
function farming(t: ReturnType<typeof cloneTuning>, acc: number) {
  const res: FarmResult[] = Array.from({ length: FARM_RUNS }, (_, r) => playFarm(t, { accuracy: acc, seed: (31337 + r * 7907 + Math.round(acc * 1000)) >>> 0 }, FARMS));
  const forged: FarmResult[] = Array.from({ length: FARM_RUNS }, (_, r) => playFarm(t, { accuracy: acc, seed: (31337 + r * 7907 + Math.round(acc * 1000)) >>> 0 }, FARMS, true));
  const bossOf = (f: FarmResult) => f.story.acts[2]?.attempts.flatMap((a) => a.fights).find((x) => x.type === 'boss');
  const rate = (xs: Array<boolean | null | undefined>) => {
    const ys = xs.filter((x): x is boolean => x !== null && x !== undefined);
    return ys.length ? ys.filter((x) => x).length / ys.length : NaN;
  };
  const story = rate(res.map((f) => bossOf(f)?.won));
  const cleared = res.filter((f) => f.story.acts[2]?.cleared).length / res.length;
  const visits = Array.from({ length: FARMS }, (_, i) => rate(res.map((f) => f.visits[i].bossWon)));
  const visitsForged = Array.from({ length: FARMS }, (_, i) => rate(forged.map((f) => f.visits[i].bossWon)));
  const power = Array.from({ length: FARMS }, (_, i) => res.reduce((n, f) => n + f.visits[i].power, 0) / res.length);
  // what a normal Act 3 fight costs and how long it takes: in the story, and on the first and last forged replay
  const mean = (xs: Array<number | undefined>) => {
    const ys = xs.filter((x): x is number => x !== undefined && Number.isFinite(x));
    return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : NaN;
  };
  const storyFights = res.flatMap((f) => f.story.acts[2]?.attempts.flatMap((a) => a.fights).filter((x) => x.type === 'fight') ?? []);
  const cost = {
    story: mean(storyFights.map((x) => x.hpLost / Math.max(1, x.maxHp))),
    storySec: mean(storyFights.filter((x) => x.won).map((x) => x.seconds)),
    first: mean(forged.map((f) => f.visits[0].hpLostFight)),
    firstSec: mean(forged.map((f) => f.visits[0].fightSec)),
    last: mean(forged.map((f) => f.visits[FARMS - 1].hpLostFight)),
    lastSec: mean(forged.map((f) => f.visits[FARMS - 1].fightSec)),
  };
  return { acc, story, cleared, visits, visitsForged, power, cost };
}

/** What a fight costs and how it goes, per player and act (every fight of every attempt; lengths and DPS of won ones). */
function fightCost(rows: ActRow[]): string {
  const head = '| Player | Act | HP lost per fight / elite / boss | of a fight\'s, the foes\' share | Fight s | Damage per s | Combo (average / peak) | Hits taken per min |';
  const sep = '|---|---|---|---|---|---|---|---|';
  const body = rows.map(
    (r) =>
      `| ${pct(r.accuracy)} | ${r.act + 1} | **${pct(r.hpLostFight)}** / ${pct(r.hpLostElite)} / ${pct(r.hpLostBoss)} | ${pct(r.foesHpFight)} | ${sec(r.fightSec)} | ${Number.isFinite(r.dpsFight) ? Math.round(r.dpsFight) : '-'} | ${num(r.comboFight)} / ${Number.isFinite(r.peakComboFight) ? Math.round(r.peakComboFight) : '-'} | ${num(r.hitsTakenPerMin)} |`,
  );
  return [head, sep, ...body].join('\n');
}

it('balance report', () => {
  const t = cloneTuning();
  const t0 = Date.now();
  const rows = balance(t, ACCURACIES, RUNS);
  const farms = [0.55, 0.7, 0.85].map((a) => farming(t, a));
  // a cautious 85% player: never takes the relics that charge HP
  const CAUTIOUS: RelicId[] = ['clutch', 'glassEdge', 'bloodPrice', 'purplePact'];
  const cautious = balance(t, [0.85], CONTROL_RUNS, 1, 6, GREENMARCH_ACTS, undefined, CAUTIOUS);
  // the control: the same player with stat cards only (no relics), as before M4a
  const off = cloneTuning();
  off.relics.on = 0;
  const control = balance(off, [0.7, 0.85], CONTROL_RUNS);
  const at = (acc: number, act: number) => rows.find((r) => r.accuracy === acc && r.act === act)!;
  const [a1, a2, a3] = [0, 1, 2].map((a) => at(0.85, a));
  const [c1, c2, c3] = [0, 1, 2].map((a) => at(0.7, a));
  const [b1, b2] = [0, 1].map((a) => at(0.55, a));
  const ms = (acc: number) => Math.round(timingSpread(t, acc) * 1000);
  const md = `# Balance report: Region 1, Greenmarch

Generated by \`npm run balance\` (\`tests/balance/balance.run.ts\`, bot in \`src/core/bot.ts\`): ${RUNS} whole runs per
accuracy, ${Math.round((Date.now() - t0) / 1000)} s to run.

**The bot plays like a person, not a machine.** It plays the real simulation at 120 Hz:

- It aims at the next block the cursor will reach (never a purple trap on purpose), blocking a red first when it
  can't get both, and taps at most every 140 ms (a thumb).
- It only taps blocks it has had time to see: a block must have been on the bar 250 ms (reds, which always come in
  from the right end, 175 ms) before the tap.
- Each tap is aimed at the moment the cursor crosses the block's center and is off by a human timing error: a normal
  spread in milliseconds, plus 3% lapses (80-250 ms off). The real judge then decides what the tap lands on. So
  thin blocks, fast reds and a fast cursor are as hard for the bot as for a person: a block the cursor crosses in
  60 ms is missed far more often than one it crosses in 150 ms.
- "Accuracy" names the player: the share of plain yellow blocks they hit at the starting cursor speed. A 55% player
  has a timing spread of ${ms(0.55)} ms, 70% ${ms(0.7)} ms, 85% ${ms(0.85)} ms, 95% ${ms(0.95)} ms (one standard deviation).
- It reads telegraphs like a person: while a Hedge Knight's shield is up it holds off yellow (as often as its
  accuracy), and it waits out a frozen cursor. Spores and shell blocks are just more blocks to tap.
- It cashes in the finisher when waiting for another stack isn't worth the risk of a combo break.
- On the map it picks the next node **at random**. It takes Full Heal when hurt (otherwise the rarest card), always
  rests, buys a potion when hurt and then the rarest cards it can afford, and picks event choices at random.
- It wears the best gear it finds (by item power) as soon as it drops, and salvages Common and Uncommon items when
  the bag fills up. Every run below starts with an empty bag: these are first playthroughs with found gear only.
- A lost act is retried from its start (up to 6 tries), with the hero and coins as they entered it; a cleared act
  carries the hero (healed to full) into the next.
- Fights are runs of foes, one wave after another (Act 1: 2 foes in the first row up to 4 before the boss; Act 2:
  3-5; Act 3: 3-6; an elite comes after an escort). A tap that overlaps an attack always blocks it first.

## Targets (a gentle start, then a ramp; set for the playtester, an ${pct(TYPICAL_ACCURACY)} player, with the gear found on the way)

The curve is aimed at the playtester (\`TYPICAL_ACCURACY\` = ${pct(TYPICAL_ACCURACY)}: their accuracy readout says 80-90%) on a fresh
first playthrough (New game wipes the profile). Until playtest round 4 it was set for a typical 70% player.

| Target | Result |
|---|---|
| Act 1 is a gentle start: the playtester nearly always clears it first try (about 95-100%) | 85% player **${pct(a1.firstTry)}** (70% ${pct(c1.firstTry)}, 55% ${pct(b1.firstTry)}) |
| Act 2: the playtester clears it first try about 80-90% of the time | **${pct(a2.firstTry)}** (70% player ${pct(c2.firstTry)}, 55% ${pct(b2.firstTry)}) |
| The Boar King: the playtester wins the first fight about 60-75% of the time, a cautious one too (never takes the relics that charge HP) | **${pct(a3.bossFirstTry)}**, cautious **${pct(cautious[2].bossFirstTry)}**; ${pct(a3.clearRate)} clear Act 3 within 6 tries (cautious: Act 1 / 2 first try ${pct(cautious[0].firstTry)} / ${pct(cautious[1].firstTry)}) |
| A 70% player can still finish Act 3 with retries and farming | ${pct(c3.clearRate)} clear Act 3 within 6 tries (Boar King first fight ${pct(c3.bossFirstTry)}); farming: the table below |
| Late fights cost HP, from the foes too: an 85% player's HP lost per normal fight rises act over act | ${pct(a1.hpLostFight)} / ${pct(a2.hpLostFight)} / ${pct(a3.hpLostFight)} of max HP; from foes alone ${pct1(a1.foesHpFight)} / ${pct1(a2.foesHpFight)} / ${pct1(a3.foesHpFight)} (cautious player ${pct1(cautious[0].foesHpFight)} / ${pct1(cautious[1].foesHpFight)} / ${pct1(cautious[2].foesHpFight)}); the rest is misses and relic prices |
| Normal fights don't get shorter act over act | ${sec(a1.fightSec)} / ${sec(a2.fightSec)} / ${sec(a3.fightSec)} (85% player), ${sec(c1.fightSec)} / ${sec(c2.fightSec)} / ${sec(c3.fightSec)} (70%); bosses ${sec(a1.bossSec)} / ${sec(a2.bossSec)} / ${sec(a3.bossSec)} (85%) |
| No boss can be one-shot by a max-stack finisher | boss HP / max finisher ${num(a1.bossVsMaxFinisher)} / ${num(a2.bossVsMaxFinisher)} / ${num(a3.bossVsMaxFinisher)}; one-shots ${pct(a1.bossOneShotRate)} / ${pct(a2.bossOneShotRate)} / ${pct(a3.bossOneShotRate)} (each boss has a phase gate that damage can't skip) |

Later acts' reds cross the bar faster (\`acts[i].redSpeed\`: x1 / x1.05 / x1.15): an 85% player blocks nearly every red
at the normal 2.8 s (a red crosses the cursor's path 2-3 times, finishers and kills knock reds off the bar), so enemy HP
and attack alone barely reach them.

## What a fight costs

${fightCost(rows)}

A cautious 85% player (never takes Clutch, Glass Edge, Blood Price or Purple Pact; ${CONTROL_RUNS} runs):

${fightCost(cautious)}

## Gear: the story with found gear alone, and farming the Boar King

Every run starts with an empty bag and wears the best gear it finds (by item power), so the table above is a first
playthrough with found gear only. Then the same profile replays Act 3 ${FARMS} times to farm the Boar King (each replay
starts with the boosts a run typically has by Act 3, plus all the gear; retries allowed), ${FARM_RUNS} players per row.
"Forge" also salvages spare items and upgrades the worn ones between replays.

| Player | Story: Act 3 cleared (6 tries) | Story: Boar King first fight won | ${Array.from({ length: FARMS }, (_, i) => `Replay ${i + 1}`).join(' | ')} | Gear power (replay 1 -> ${FARMS}) |
|---|---|---|${Array.from({ length: FARMS }, () => '---|').join('')}---|
${farms.map((f) => `| ${pct(f.acc)} | ${pct(f.cleared)} | **${pct(f.story)}** | ${f.visits.map((v, i) => `${pct(v)} (forge ${pct(f.visitsForged[i])})`).join(' | ')} | ${Math.round(f.power[0])} -> ${Math.round(f.power[FARMS - 1])} |`).join('\n')}

A farmed replay still costs HP: a normal Act 3 fight's HP lost (share of max HP) and length, in the story and on the
first and last forged replay.

| Player | Story | Replay 1 (forge) | Replay ${FARMS} (forge) |
|---|---|---|---|
${farms.map((f) => `| ${pct(f.acc)} | ${pct(f.cost.story)}, ${sec(f.cost.storySec)} | ${pct(f.cost.first)}, ${sec(f.cost.firstSec)} | ${pct(f.cost.last)}, ${sec(f.cost.lastSec)} |`).join('\n')}

## Relics: win rates

The pick after a fight offers mostly relics (plus at most one stat card); the bot takes Full Heal when hurt, otherwise
the relic that shares the most tags with what it owns (synergy-greedy), then the rarest. Relics change rules, so their
power shows up as wins, not as stats. With relics vs the same player taking stat cards only (${CONTROL_RUNS} runs per row):

${relicsVsControl(rows, control)}

The Boar King's first fight for the playtester (${pct(TYPICAL_ACCURACY)}), by the build the act-clear screen would name and by
each relic carried into the fight (all ${RUNS} runs; a relic's rate counts every run that carried it):

${relicWins(at(TYPICAL_ACCURACY, 2))}

## Results

${table(rows)}

## Where runs are lost

${losses(rows)}

Notes:

- "First-try clear" counts runs that cleared the act without dying (the revive can be used). "Boss first fight won" is
  the share of runs whose first fight against the act's boss was won.
- Act numbers scale enemy HP and attack per act (\`tuning.acts\`), plus ${Math.round(t.map.rowHp * 100)}% more enemy HP per
  map row. HP carries from node to node (kills heal only ${Math.round(t.hero.healOnKill * 100)}%), so rests, potions and Full
  Heal cards matter.
`;
  // the later regions, every hero against Rowan, Rowan's branches, gems and chests: kept by hand from npm run
  // campaign / npm run region-tune (docs/balance-heroes.md), appended so a fresh Region 1 report keeps them
  const extra = existsSync('docs/balance-heroes.md') ? `\n${readFileSync('docs/balance-heroes.md', 'utf8')}` : '';
  writeFileSync('docs/balance.md', md + extra);
  process.stderr.write(`${farms.map((f) => `farm ${f.acc}: story ${pct(f.story)} -> ${f.visits.map(pct).join(' ')} (forge ${f.visitsForged.map(pct).join(' ')})`).join('\n')}\n`);
  process.stderr.write(`${table(rows)}\n${losses(rows)}\n`);
}, 1_800_000);
