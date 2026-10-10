// Numbers on screen (playtest round 7: "massive floating point numbers still show up sometimes: healing values,
// upgrades"). Every screen and state of the game, rendered with awkward numbers provoked on purpose (a hero at
// 61.0004 HP, foes at 137.35 max HP, heals of 12.3456, fractional gear stats, relic and skill numbers, multipliers
// like 1.15 x 1.3, partial XP, a purse of 1234.5678 coins): after each one, the text the game drew may hold no number
// with two or more decimals (the safety net, src/core/format.ts guardText, records every one it had to round; the
// shared fixture also fails any test on one).
import { expect, test, type Page } from './fixtures';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const app = (page: Page) => (fn: (a: Any) => unknown) => page.evaluate(`(${fn.toString()})(window.__cq3.app)`);

async function ready(page: Page): Promise<void> {
  await page.goto('/cq3/');
  await page.waitForFunction(() => (window as Any).__cq3?.ready === true);
  await page.evaluate(() => {
    const p = (window as Any).__cq3.app.profile;
    p.tipsOff = true;
    p.worldTour = true;
  });
}

/** Let a screen draw for a moment, then: no long decimal was drawn since the last check. */
async function check(page: Page, where: string, ms = 450): Promise<void> {
  await page.waitForTimeout(ms);
  const v = (await page.evaluate(() => {
    const h = (window as Any).__cq3;
    const out = (h.textViolations as string[]).slice();
    h.clearTextViolations();
    return out;
  })) as string[];
  expect(v, `long decimals drawn: ${where}`).toEqual([]);
}

/** Beat every wave of the fight on screen (each foe left a sliver, a finisher), like a quick player would. */
async function winFight(page: Page): Promise<void> {
  for (let k = 0; k < 12; k++) {
    const done = await page.evaluate(() => {
      const x = (window as Any).__cq3.app;
      const c = x.run.combat;
      if (!c || c.result || x.run.phase !== 'fight') return true;
      for (const e of c.enemies) if (e.alive) (e.uses = e.uses.map(() => 1)), (e.hp = 0.5);
      c.stacks = Math.max(1, c.stacks);
      x.finisher();
      return false;
    });
    if (done) return;
    await page.waitForTimeout(1600);
  }
}

/** Run `body` in the page with `x` = the app and the helpers below. */
const run = (page: Page, body: string) => page.evaluate(`(() => { const x = window.__cq3.app; ${HELPERS}; ${body} })()`);

/** In-page helpers: the awkward profile and numbers, and a few shortcuts. */
const HELPERS = `
  const t = x.tuning;
  const p = x.profile;
  const now = () => performance.now();
  const camp = () => x.view.camp;
  // everything unlocked, with awkward amounts: partial XP, a fractional purse, gems and scrap
  const messyProfile = () => {
    p.allUnlocked = true;
    p.smithMet = p.sableMet = p.neveMet = true;
    p.actsCleared = Math.max(p.actsCleared, 4);
    p.weights = Math.max(p.weights, 1);
    for (const id of ['frostpeaks', 'ashfell', 'duskmire']) if (!p.seen.includes('unveil:' + id)) p.seen.push('unveil:' + id);
    Object.keys(p.heroes).forEach((id, i) => {
      const h = p.heroes[id];
      h.unlocked = true;
      h.xp = 1700.4567 + i * 133.37;
      h.stars = 1 + (i % 5);
    });
    Object.keys(p.pets).forEach((id, i) => {
      p.pets[id].owned = true;
      p.pets[id].xp = 900.1234 + i * 77.77;
    });
    p.coins = 1234.5678;
    p.gems = 777.777;
    p.scrap = 55.555;
    p.chests = { hero: 2, rare: 1, region: 1 };
    p.camp = ['dummy', 'perch'];
    p.petsOn = ['pip', 'mote'];
    p.relicsNew = [];
  };
  // the numbers the texts print: relics', skill nodes', kits', styles', boosts', shop and rest shares, bounty pay
  const messyTexts = () => {
    for (const k of Object.keys(t.relics.n)) t.relics.n[k] = t.relics.n[k] * 1.15 * 1.3 + 0.0123;
    for (const k of Object.keys(t.skills.n)) t.skills.n[k] = t.skills.n[k] * 1.15 * 1.3 + 0.0123;
    Object.assign(t.boosts, { maxHp: 23.456, damage: 0.1234, crit: 0.0567, critDmg: 0.2345, comboPower: 1.2345, pet: 3.456 });
    t.hero.abilityCritBonus = 0.1234;
    Object.assign(t.kits.sable, { abilitySec: 3.456, silentStep: 0.2345 });
    Object.assign(t.kits.neve, { abilitySec: 2.345, iceMeter: 0.4567 });
    t.kits.moss.roots = 0.0456;
    Object.assign(t.kits.hollis, { slam: 0.4321, ironHide: 0.2345 });
    Object.assign(t.kits.torva, { unstoppable: 0.0789, windUpBase: 1.15 * 1.3 });
    Object.assign(t.styles, { bladeFill: 0.2345, chainStep: 0.0789, heavyMult: 1.15 * 1.3 });
    Object.assign(t.levels, { star2Atk: 0.0678, star4Hp: 0.0912 });
    Object.assign(t.map, { potionHeal: 0.4123, restHeal: 0.3456 });
    Object.assign(t.quests, { coins: 33.333, healthy: 0.7777 });
    t.gems.region = 61.234;
    t.chests.softPity = 20.5;
  };
  // the hero in a run: 61.0004 HP, every stat fractional, 1.15 x 1.3 crit damage, a fractional purse
  const messyHero = () => {
    const H = x.run.hero;
    Object.assign(H, { bonusMaxHp: 37.35, bonusDmg: 0.1234, bonusCrit: 0.0456, bonusCritDmg: 0.15 * 1.3, bonusComboPower: 1.2345, bonusPet: 2.345, bonusAtk: 1.2345, hp: 61.0004 });
    x.run.coins = 1234.5678;
  };
  // foes at 137.35 max HP, 61.0004 left
  const messyFoes = () => {
    for (const e of x.run.combat.enemies) {
      e.maxHp = 137.35;
      e.hp = Math.min(e.hp, 61.0004);
    }
  };
  // a stop of this type on the map's first row (a fresh path: no roamer on the way)
  const stop = (type) => {
    x.setPhase(() => {
      x.run.path = [];
      x.run.phase = 'map';
      const id = x.run.choices()[0];
      const n = x.run.map.nodes[id];
      n.type = type;
      if (type === 'event') n.event = n.event || 'herbalist';
      x.run.chooseNode(id);
    });
  };
  // what combat could emit, fractional: the view must print it whole
  const emit = (...events) => x.run.combat.events.push(...events);
`;

/** A run on the act map (no roamers in the way unless asked), the awkward numbers set. */
async function onMap(page: Page, o: { roamers?: boolean; act?: number } = {}): Promise<void> {
  await run(
    page,
    `
    messyProfile();
    messyTexts();
    if (!${!!o.roamers}) t.roam.packsFirst = t.roam.packsLast = t.roam.merchant = 0;
    x.setPhase(() => {
      x.run.newRun();
      x.run.skipScenes();
      if (${o.act ?? 0}) { x.run.enterAct(${o.act ?? 0}); x.run.skipScenes(); }
    });
    messyHero();
  `,
  );
}

test('numbers: the title, the world map (an act card, the picker, the region chip, the wandering foe)', async ({ page }) => {
  await ready(page);
  await run(page, 'messyProfile(); messyTexts();');
  await check(page, 'the title');
  await run(page, 'p.wander.fights = 99; x.newRun();');
  await check(page, 'the world map', 900);
  await run(page, 'const w = x.view.worldMap; const s = w.actSpot(1); w.tap(s.x, s.y);');
  await check(page, 'the world map: an act card');
  await run(page, 'const w = x.view.worldMap; const g = w.greenmarch(); w.tap(g.x, g.y);');
  await check(page, 'the world map: the act picker');
  await run(page, 'x.newRun(); const w = x.view.worldMap; const c = w.regionChip(); if (c) w.tap(c.r.x + c.r.w / 2, c.r.y + c.r.h / 2);');
  await check(page, 'the world map: the region chip and its picker');
  await run(page, 'x.newRun(); const w = x.view.worldMap; const r = w.roam.foeRect(); if (r) w.tap(r.x + r.w / 2, r.y + r.h / 2);');
  await check(page, 'the world map: the wandering foe and its card');
});

test('numbers: the act map (every stop, the roamers, the bounty tracker), Coin Rush; rest, shop, an event, a treasure', async ({ page }) => {
  test.setTimeout(90_000);
  await ready(page);
  await onMap(page, { roamers: true });
  await check(page, 'the act map with its roamers', 900);
  // the bounty board, then its tracker beside the coins (part done)
  await run(page, `stop('bounty');`);
  await check(page, 'the bounty board');
  await run(page, `x.setPhase(() => x.run.takeQuest()); if (x.run.quest) x.run.quest.n = 7.777;`);
  await check(page, 'the act map: the bounty tracker');
  await run(page, `for (const n of x.run.map.nodes) if (n.row > 0 && n.type !== 'boss') n.type = ['fight', 'elite', 'treasure', 'rest', 'shop', 'event', 'rush'][n.id % 7];`);
  await check(page, 'the act map: every kind of stop');
  // a Coin Rush: the clock on the foe's plate, coins per hit
  await run(page, `t.rush.sec = 3.456; stop('rush'); x.begin();`);
  for (let i = 0; i < 6; i++) {
    await run(page, `x.barTap(performance.now());`);
    await page.waitForTimeout(120);
  }
  await check(page, 'a Coin Rush');
  await expect.poll(() => app(page)((x) => x.run.phase), { timeout: 12_000 }).toBe('map');
  await check(page, "a Coin Rush: time's up", 300);
  // the rest: HP 61.0004 of 137 (+37.35), the heal a share of it
  await run(page, `stop('rest');`);
  await check(page, 'the rest');
  await run(page, `x.view.nodes.tap(-1, -1);`);
  await check(page, 'the rest: resting', 900);
  // the shop: stat cards, a relic, the potion, the reroll; the purse 1234.5678
  await run(page, `messyHero(); stop('shop'); x.run.shop[0] = { kind: 'boost', offer: { id: 'critDmg', rarity: 'rare' }, price: 61.234, sold: false }; x.run.shop[1] = { kind: 'boost', offer: { id: 'heal', rarity: 'epic' }, price: 45.5, sold: false };`);
  await check(page, 'the shop', 700);
  await run(page, `x.run.shop.forEach((s, i) => { if (s.kind === 'potion') x.run.buy(i); });`);
  await check(page, 'the shop: a potion bought');
  // an event: its choices and their costs, then an outcome
  await run(page, `x.setPhase(() => x.run.leaveShop()); messyHero(); stop('event');`);
  await check(page, 'an event');
  await run(page, `x.setPhase(() => x.run.chooseEvent(0));`);
  await check(page, 'an event: its outcome');
  // a treasure chest
  await run(page, `x.setPhase(() => { x.run.event = null; }); messyHero(); stop('treasure');`);
  await check(page, 'a treasure', 700);
  await run(page, `x.view.overlays.treasureTap();`);
  await check(page, 'a treasure: opened', 1200);
});

test('numbers: a fight (hits, crits, blocks, heals from a relic, a companion and gear, a finisher, kills), then a defeat', async ({ page }) => {
  test.setTimeout(90_000);
  await ready(page);
  await onMap(page);
  await run(page, `x.run.hero.relics = ['photosynthesis', 'vampiricFang', 'luckyPenny', 'glassEdge']; x.setPhase(() => x.run.chooseNode(x.run.choices()[0])); messyHero(); x.run.hero.bonusCrit = 1; x.begin(); messyFoes();`);
  await check(page, 'a fight: its HUD', 700);
  for (let i = 0; i < 10; i++) {
    await run(page, `x.barTap(performance.now()); messyFoes();`);
    await page.waitForTimeout(110);
  }
  await check(page, 'a fight: hits and crits');
  // a red blocked; heals in shares (a relic's, gear's, a companion's): the hero 0.3456 under full HP
  await run(page, `const c = x.run.combat; c.spawnBlock('red', c.cursorPos()); x.barTap(performance.now());`);
  await run(page, `const c = x.run.combat; const H = x.run.hero; H.hp = c.maxHp() - 0.3456; c.healPerk(12.3456, 'photosynthesis');`);
  await check(page, 'a fight: a block, a heal that tops up HP');
  // what combat could emit as fractions: hits, heals, hurts, coins, perks, pecks, gear effects
  await run(
    page,
    `const c = x.run.combat; const e = c.enemies.find((q) => q.alive) || c.enemies[0];
    emit({ type: 'heal', amount: 12.3456 }, { type: 'gearFx', fx: 'secondWind', amount: 12.3456, enemyId: 0 }, { type: 'perk', id: 'photosynthesis', amount: 3.456, enemyId: 0 },
      { type: 'enemyHeal', enemyId: e.id, amount: 12.3456 }, { type: 'heroHurt', damage: 7.777, source: 'perk', enemyId: 0, perk: 'glassEdge' },
      { type: 'heroHurt', damage: 9.8765, source: 'miss', enemyId: 0 }, { type: 'enemyHurt', enemyId: e.id, damage: 12.3456, crit: true, source: 'bomb' },
      { type: 'coins', amount: 2.345, id: 'luckyPenny' }, { type: 'perk', id: 'luckyPenny', amount: 2.345, enemyId: e.id },
      { type: 'pet', pet: 'pip', enemyId: e.id, damage: 4.5678, crit: false }, { type: 'gearFx', fx: 'riposte', amount: 6.789, enemyId: e.id });`,
  );
  await check(page, 'a fight: fractional heals, hurts, coins and blows', 900);
  // a companion's heal (Mote's Mend) and a gear set's (the Greenwarden's kill heal)
  await run(page, `const c = x.run.combat; x.run.hero.hp = c.maxHp() - 10.5; c.healPerk(c.maxHp() * 0.0123, 'mend'); c.healPerk(c.maxHp() * 0.0345, 'greenwarden');`);
  await check(page, 'a fight: a companion and a gear heal');
  // the relic panel (paused), then on
  await run(page, `x.userPaused = true; x.syncClock(performance.now()); x.view.overlays.openRelics(0);`);
  await check(page, 'a fight: paused, the relic panel', 700);
  await run(page, `x.view.overlays.relicPanelTap(0, 0); x.userPaused = false; x.syncClock(performance.now());`);
  // a finisher at three stacks, then kills
  await run(page, `const c = x.run.combat; c.stacks = 3; x.finisher();`);
  await check(page, 'a fight: a finisher', 1500);
  await run(page, `const c = x.run.combat; for (const e of c.enemies) if (e.alive) e.hp = 0.5; x.barTap(performance.now());`);
  await check(page, 'a fight: kills', 900);
  // a defeat: a fresh fight, the hero at 0.6543 HP with no revive, a red that gets through
  await run(page, `x.setPhase(() => { x.run.path = []; x.run.phase = 'map'; x.run.chooseNode(x.run.choices()[0]); }); x.begin(); messyFoes(); const c = x.run.combat; x.run.hero.revives = 0; x.run.hero.hp = 0.6543; c.spawnBlock('red', 0.05);`);
  await expect.poll(() => app(page)((x) => x.run.phase), { timeout: 12_000 }).toBe('defeat');
  await check(page, 'a defeat', 1200);
});

test('numbers: a won fight: the loot, the boost pick (every stat card), the stat rain into the next fight, relic picks, the act clear and the region victory', async ({ page }) => {
  test.setTimeout(120_000);
  await ready(page);
  await onMap(page);
  // (Act 1's first win would bring Pip's road scene before the map: seen, so the pick goes straight on)
  await run(page, `x.profile.seen.push('scene:road'); x.setPhase(() => x.run.chooseNode(x.run.choices()[0])); messyHero(); x.begin(); messyFoes();`);
  await winFight(page);
  await expect.poll(() => app(page)((x) => x.run.phase), { timeout: 15_000 }).toMatch(/loot|boost/);
  await check(page, 'the loot', 1500);
  // the boost pick: every stat card, at each rarity, previewed on the messy hero
  const cards = [
    ['maxHp', 'damage', 'crit'],
    ['critDmg', 'comboPower', 'pet'],
    ['heal', 'heal', 'maxHp'],
  ];
  for (const [i, ids] of cards.entries()) {
    const rarities = ['common', 'rare', 'epic'];
    await run(page, `x.setPhase(() => { x.run.loot = []; x.run.offerBoosts(false, 'map'); }); messyHero(); x.run.boostChoices = ${JSON.stringify(ids)}.map((id, k) => ({ id, rarity: ${JSON.stringify(rarities)}[(k + ${i}) % 3] }));`);
    await check(page, `the boost pick: ${ids.join(', ')}`, 1100);
  }
  // relic cards with their numbers
  await run(page, `x.setPhase(() => x.run.offerBoosts(false, 'map')); x.run.boostChoices = [{ id: 'relic', rarity: 'common', relic: 'photosynthesis' }, { id: 'relic', rarity: 'rare', relic: 'ironRhythm' }, { id: 'relic', rarity: 'epic', relic: 'overcharge' }];`);
  await check(page, 'a relic pick', 1100);
  // a stat card picked: its gain rains into the HUD at the next fight
  await run(page, `x.run.boostChoices = [{ id: 'critDmg', rarity: 'epic' }]; x.setPhase(() => x.run.pickBoost(0));`);
  await check(page, 'the boost picked');
  await run(page, `x.run.hero.bonusMaxHp += 12.3456; x.setPhase(() => x.run.debugFight(0, ['bandit', 'slime'], 'fight', x.run.hero)); x.begin(); messyFoes();`);
  await check(page, 'the next fight: the stat gain on the HUD', 1600);
  await run(page, `x.run.hero.bonusCritDmg += 0.1234; x.run.hero.bonusDmg += 0.0456; const c = x.run.combat; c.stacks = 2; x.finisher();`);
  await check(page, 'the next fight: a finisher');
  // the act clear (the build, the XP bar, the accuracy) and the region victory
  await run(page, `x.setPhase(() => { x.run.boostThen = 'actClear'; x.run.phase = 'boost'; x.run.boostChoices = [{ id: 'damage', rarity: 'common' }]; }); x.run.actXpGained = 123.456; x.setPhase(() => x.run.pickBoost(0));`);
  await check(page, 'the act clear', 1200);
  await run(page, `x.view.overlays.actClearTap(-1, -1);`);
  await check(page, 'the act clear: the chest, the XP, the coins', 2600);
  await run(page, `x.setPhase(() => { x.run.actIndex = 2; x.run.phase = 'victory'; });`);
  await check(page, 'the region victory', 2000);
});

test('numbers: the camp: home, bag, forge (each tab), stats (both pages), relic log', async ({ page }) => {
  test.setTimeout(90_000);
  await ready(page);
  await run(page, `messyProfile(); messyTexts(); p.relics = []; x.newRun(); x.openCamp();`);
  await run(page, `p.relics = Object.keys(t.relics.n).slice(0, 30);`);
  await check(page, 'the camp', 900);
  await run(page, `camp().go('bag', now()); const it = p.items.find((i) => !Object.values(p.equipped).includes(i.uid)) || p.items[0]; if (it) camp().bag.sel = it.uid;`);
  await check(page, 'the bag with an item picked (its compare lines)', 800);
  for (const tab of ['upgrade', 'reroll', 'salvage']) {
    await run(page, `camp().go('home', now()); camp().go('forge', now()); camp().forge.tab = '${tab}';`);
    await check(page, `the forge: ${tab}`, 800);
  }
  // an upgrade landing: the toast's stats before -> after
  await run(page, `const f = camp().forge; f.tab = 'upgrade'; p.scrap = 9999.99; p.coins = 99999.99; const r = f.mainRect(); f.tap(r.x + r.w / 2, r.y + r.h / 2, now());`);
  await check(page, 'the forge: an upgrade, its toast', 1300);
  for (const pg of ['main', 'all']) {
    await run(page, `camp().go('home', now()); camp().go('stats', now(), 'rowan'); camp().stats.page = '${pg}';`);
    await check(page, `the stats: ${pg}`, 800);
  }
  await run(page, `camp().go('home', now()); camp().go('relics', now()); camp().relics.select('photosynthesis', now());`);
  await check(page, 'the relic log', 800);
});

test('numbers: the camp: every hero and their sheets, every skill tree', async ({ page }) => {
  test.setTimeout(150_000);
  await ready(page);
  await run(page, `messyProfile(); messyTexts(); x.newRun(); x.openCamp(); camp().go('heroes', now(), 'rowan');`);
  await check(page, 'the hero select', 900);
  const heroes = (await app(page)((x) => Object.keys(x.profile.heroes))) as string[];
  for (const id of heroes) {
    await run(page, `const h = camp().heroes; h.sheet.open && h.tap(0, 0, now()); h.show('${id}', now());`);
    await check(page, `the hero select: ${id}`, 600);
    for (const kind of ['signature', 'ability', 'passive', 'finisher', 'stars', 'mastery', 'level', 'info']) {
      await run(page, `const h = camp().heroes; h.openSheet('${kind}', now());`);
      await check(page, `the hero select: ${id}'s ${kind} sheet`, 350);
    }
  }
  // every hero's tree, each node selected (its text with its number, a stat node's before -> after)
  for (const id of heroes) {
    await run(page, `camp().go('home', now()); camp().go('skills', now(), '${id}');`);
    await check(page, `the skill tree: ${id}`, 500);
    const nodes = (await run(page, `return camp().skills.tree().flatMap((b) => b.nodes.map((n) => n.id));`)) as string[];
    for (const n of nodes) {
      await run(page, `camp().skills.select('${n}', now());`);
      await check(page, `the skill tree: ${id}'s ${n}`, 120);
    }
  }
});

test('numbers: the camp: companions, chests and an opening, the shrine (odds, pity), build mode, completion for each region', async ({ page }) => {
  test.setTimeout(120_000);
  await ready(page);
  await run(page, `messyProfile(); messyTexts(); x.newRun(); x.openCamp();`);
  const pets = (await app(page)((x) => Object.keys(x.profile.pets))) as string[];
  for (const id of pets) {
    await run(page, `camp().go('home', now()); camp().go('pets', now(), undefined, '${id}');`);
    await check(page, `the companions: ${id}`, 600);
  }
  await run(page, `camp().go('home', now()); camp().go('chests', now());`);
  await check(page, 'the chests', 800);
  await run(page, `camp().chests.reseed(37); camp().chests.openKind('hero', now());`);
  await check(page, 'a chest opening', 2500);
  await run(page, `camp().chests.opening && camp().chests.opening.cur && (camp().chests.opening.cur.skip += 1e5);`);
  await check(page, 'a chest opening: the prize', 1500);
  await run(page, `camp().tap(150, 100); x.storySkip && x.storySkip(); camp().go('home', now()); camp().go('shrine', now());`);
  await check(page, 'the shrine', 900);
  await run(page, `const r = camp().shrine.oddsRect(); camp().tap(r.x + 5, r.y + 5);`);
  await check(page, 'the shrine: its odds', 700);
  await run(page, `camp().tap(5, 140); camp().shrine.showPity(now());`);
  await check(page, 'the shrine: its pity', 700);
  for (const id of ['perch', 'luckyStone', 'warTable', 'rerollCharm', 'mapTable', 'dummy']) {
    await run(page, `camp().go('home', now()); camp().go('upgrades', now()); camp().upgrades.select('${id}', now());`);
    await check(page, `build mode: ${id}`, 600);
  }
  for (const r of [0, 1, 2]) {
    await run(page, `p.regions.greenmarch = { bounties: [0, 2], treasures: [1], events: ['herbalist'], chest: false }; camp().go('home', now()); camp().go('progress', now()); camp().progress.open(now(), ${r});`);
    await check(page, `completion: region ${r + 1}`, 900);
  }
  // the region card's Atlas pages, read from a treasure seal
  await run(page, `p.pages = [0, 1]; camp().go('home', now()); camp().go('progress', now()); camp().progress.open(now(), 0); camp().progress.showPage(now(), 1);`);
  await check(page, 'completion: the Atlas pages found', 900);
});

test('numbers: the gear panel and the Test lab list', async ({ page }) => {
  await ready(page);
  await run(page, `messyProfile(); messyTexts(); p.acc.recent = Array.from({ length: 60 }, (_, i) => ((i * 37) % 41) - 20 + 0.123); p.acc.history = [{ at: Date.now(), act: 0, acc: 0.8765, n: 61, sd: 23.456, bias: -4.567 }];`);
  await page.click('#btn-gear');
  await expect(page.locator('#debug')).toBeVisible();
  await check(page, 'the gear panel');
  await page.click('#btn-gear');
  await page.click('#btn-lab');
  await expect(page.locator('#lab')).toBeVisible();
  await check(page, 'the Test lab list');
  // the numbers scenario: a fight with healing relics and Mote, then a stat pick on the hero who fought
  await page.click('.lab-item[data-id="numbersHeals"]');
  await page.click('.lab-btn.go');
  await expect.poll(() => app(page)((x) => x.run.phase)).toBe('fight');
  await run(page, `x.begin(); x.run.hero.hp = 61.0004; x.run.hero.bonusMaxHp = 37.35; x.run.hero.bonusCritDmg = 0.15 * 1.3; messyFoes();`);
  for (let i = 0; i < 8; i++) {
    await run(page, `x.barTap(performance.now());`);
    await page.waitForTimeout(110);
  }
  await check(page, 'the lab fight: heals');
  await winFight(page);
  await expect.poll(() => app(page)((x) => x.run.phase), { timeout: 15_000 }).toBe('boost');
  await check(page, 'the lab fight: the stat pick', 1100);
  await run(page, `x.setPhase(() => x.run.pickBoost(0));`);
  await expect(page.locator('#lab[data-view="rate"]')).toBeVisible();
  expect(await app(page)((x) => x.run.phase)).toBe('camp');
  await check(page, 'the lab: its rating card');
});
