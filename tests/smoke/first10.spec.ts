import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from './fixtures';

// The first 10 minutes, played like a newcomer (docs/first-10.md): a wiped profile, tips on, the world map's first
// visit as a new player gets it. A "human" runs inside the page (the in-page timers are real time, so the taps are
// timed like a thumb, not like a test): it taps through the story boxes every ~2 s, reads each tip before tapping it
// away, waits a moment before choosing on the map (a chest when one is offered, else a fight), and plays the fights
// with a person's reaction time and timing error (it aims at the block the cursor reaches next, blocks the reds, lets
// purples pass, swipes a finisher when the meter is full). It records each beat (wall time since New game, the
// fights' clock, the taps so far) and saves a screenshot of each to OUT. Slow by design: minutes, not seconds.
//
//   PORT=4178 F10_OUT=/some/dir F10_SEED=7 npx playwright test tests/smoke/first10.spec.ts
//
// F10_SEED fixes the run (the act map, the fights' and loot's rolls); F10_ACC is the newcomer's accuracy (0.7);
// F10_SKILLS=0 never opens the camp to spend skill points (by default it does, as the balance bot does); F10_DESK=1 at
// desktop size;
// F10_UNTIL=act plays on through Act 1 to its clear (the boss), then Camp (Sable's scene) and the first hero chest
// opened in the vault, instead of stopping at the map after the first chest.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const OUT = process.env.F10_OUT ?? 'test-results/first10';
const SEED = Number(process.env.F10_SEED ?? 7);
const ACC = Number(process.env.F10_ACC ?? 0.7);
const UNTIL = process.env.F10_UNTIL === 'act' ? 'act' : 'chest';
/** Spend skill points at camp as they come (as the balance bot does); F10_SKILLS=0 never opens the camp for them. */
const SKILLS = process.env.F10_SKILLS !== '0';
// F10_DESK=1 plays it at desktop size (1440x900 at 1x, a mouse: no touch)
if (process.env.F10_DESK === '1') test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
/** Stop once these beats are in (or at the time limit). */
const LAST_BEAT = 'chestOpened';

interface Beat {
  id: string;
  wall: number; // s since New game (as the person lives it: reading, walking, wipes included)
  fight: number; // s of fight clock so far (the fights' own time, tips' pauses excluded)
  taps: number; // taps so far (every press: story, tips, map, bar)
  note: string;
}

test('the first 10 minutes: a newcomer from New game to the first chest (beats timed, a screenshot each)', async ({ page }) => {
  test.setTimeout((UNTIL === 'act' ? 30 : 20) * 60_000);
  mkdirSync(OUT, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const shots: string[] = [];
  let shotN = 0;
  const shot = async (name: string) => {
    const file = `${OUT}/${String(++shotN).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: file, scale: 'css' }).catch(() => undefined);
    shots.push(file);
  };
  // the page asks for a screenshot at each beat (and a few during the first finisher)
  const queue: string[] = [];
  await page.exposeFunction('__f10Shot', (name: string) => {
    queue.push(name);
  });

  await page.goto('/cq3/');
  await page.waitForFunction(() => (window as Any).__cq3?.ready === true);
  // a wiped profile (a fresh browser), tips on; the run's seed fixed so the measurement repeats
  await page.evaluate(
    ([seed]) => {
      const x = (window as Any).__cq3.app;
      x.profile.tipsOff = false;
      x.run.mapSeed = (Math.imul(seed, 0x9e3779b1) ^ 0x1234567) >>> 0;
      x.run.randomState = { seed, rng: (seed ^ 0xa5a5a5) >>> 0 };
    },
    [SEED],
  );
  expect(await page.evaluate(() => (window as Any).__cq3.app.canContinue)).toBe(false);
  await page.waitForTimeout(1500); // the title, as a person first sees it
  await shot('title');

  // ---- the newcomer, in the page
  await page.evaluate(
    ([acc, until, skills]) => {
      const w = window as Any;
      const x = w.__cq3.app;
      const view = x.view;
      const P = performance;
      const t0 = P.now();
      const S: Any = { beats: [] as Any[], log: [] as Any[], taps: 0, fightClock: 0, done: false, tips: [] as Any[], counts: {} };
      w.__f10 = S;
      const rnd = (a: number, b: number) => a + (b - a) * Math.random();
      const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
      const fightNow = () => S.fightClock + (x.run.combat ? x.run.combat.time : 0);
      const beat = (id: string, note = '') => {
        if (S.beats.some((b: Any) => b.id === id)) return;
        S.beats.push({ id, wall: +((P.now() - t0) / 1000).toFixed(1), fight: +fightNow().toFixed(1), taps: S.taps, note });
        w.__f10Shot(id);
      };
      const log = (what: string) => S.log.push(`${((P.now() - t0) / 1000).toFixed(1)}s ${what}`);
      S.beat = beat;

      // pointer events at game px (327x150), through the game's own input (input.ts)
      let pid = 100;
      const client = (gx: number, gy: number) => {
        const l = x.layout;
        return { clientX: l.left + (gx * l.cssW) / 327, clientY: l.top + (gy * l.cssH) / 150 };
      };
      const ev = (type: string, id: number, c: Any) => window.dispatchEvent(new PointerEvent(type, { ...c, pointerId: id, bubbles: true, isPrimary: true, pointerType: 'touch' }));
      const tap = (gx: number, gy: number) => {
        const id = ++pid;
        const c = client(gx, gy);
        S.taps++;
        ev('pointerdown', id, c);
        setTimeout(() => ev('pointerup', id, c), 70);
      };
      const swipe = () => {
        const id = ++pid;
        const c = client(200, 115);
        S.taps++;
        ev('pointerdown', id, c);
        // (the flick's first move in the same task: a synthetic event's timeStamp is when it's made, and on a loaded
        // machine a timer 30 ms on fired 300-1200 ms late, past the swipe's 350 ms; a finger's own timestamps don't drift)
        ev('pointermove', id, { clientX: c.clientX + 40, clientY: c.clientY - 40 });
        setTimeout(() => ev('pointermove', id, { clientX: c.clientX + 70, clientY: c.clientY - 60 }), 30);
        setTimeout(() => ev('pointerup', id, { clientX: c.clientX + 70, clientY: c.clientY - 60 }), 60);
      };

      // phases and combat events
      let combatSeen: unknown = null;
      x.phaseListeners.push((prev: string, next: string) => {
        log(`phase ${prev} -> ${next}`);
        if (next === 'world') beat('worldMap');
        if (next === 'scene') beat('intro', x.storyId ?? '');
        if (next === 'scene' && x.storyId === 'road') beat('roadScene'); // Pip's road scene after the first win
        if (next === 'map') beat('firstMap');
        if (next === 'fight' && x.run.combat !== combatSeen) beat('firstFight', (x.run.combat?.enemies ?? []).map((e: Any) => e.key).join('+'));
        if (next === 'loot') beat('firstLoot');
        if (next === 'boost') beat('firstPick');
        if (next === 'treasure') beat('firstChest');
        if (prev === 'treasure' && next !== 'treasure') beat('chestOpened', `${x.run.treasure?.coins ?? 0} coins`);
        if (next === 'map' && S.beats.some((b: Any) => b.id === 'chestOpened')) {
          beat('mapAfterChest');
          if (until === 'chest') S.done = true;
        }
        // (on through the act: each fight won, the elite, the boss, the first hero chest)
        if (prev === 'fight' && x.run.combat?.result === 'won') {
          S.wins = (S.wins ?? 0) + 1;
          if (S.wins > 1) beat(`win${S.wins}`, x.run.node?.type ?? '');
        }
        if (next === 'fight' && x.run.node?.type === 'elite') beat('firstElite');
        if (next === 'fight' && x.run.node?.type === 'boss') beat('bossFight');
        if (prev === 'defeat' && next !== 'defeat') beat('retried', next);
        if (x.profile.chests.hero > 0) beat('heroChest');
      });
      const onEvents = view.onEvents.bind(view);
      let finAt = 0;
      view.onEvents = (events: Any[]) => {
        for (const e of events) {
          S.counts[e.type] = (S.counts[e.type] ?? 0) + 1;
          if (e.type === 'hit' && !e.echo) beat('firstHit', e.kind);
          if (e.type === 'spawn' && (e.kind === 'red' || e.kind === 'shield' || e.kind === 'bomb')) beat('firstRed', `${e.kind}, tip up: ${x.tipUp}`);
          if (e.type === 'block' && !e.echo) beat('firstBlock', `${e.kind}, tips seen: ${x.profile.tips.includes('blockRed')}`);
          if (e.type === 'heroHurt' && e.source === 'red') beat('firstRedTaken');
          if (e.type === 'miss') beat('firstMiss');
          if (e.type === 'finisher' && !finAt) {
            finAt = P.now();
            beat('firstFinisher', `${e.stacks} stack(s)`);
            for (const ms of [250, 700, 1150, 1700, 2300, 3000]) setTimeout(() => w.__f10Shot(`finisher-${ms}ms`), ms);
            // the first finisher's reveal (view/finisher-reveal.ts): the clock held, its name on screen
            setTimeout(() => (S.reveal = { active: !!view.reveal?.active, held: x.holdUntil > P.now() }), 300);
          }
          if (e.type === 'kill') beat('firstKill');
          // the first boss's arc: its first special, then its HP at a half and at a fifth
          const boss = x.run.node?.type === 'boss' ? x.run.combat?.enemies.find((q: Any) => q.alive) : null;
          if (boss) {
            if (e.type === 'telegraph') beat('bossSpecial', boss.key);
            if (boss.hp < boss.maxHp * 0.5) beat('bossHalf', `${Math.round(boss.hp)} of ${boss.maxHp}`);
            if (boss.hp < boss.maxHp * 0.2) beat('bossLow', `${Math.round(boss.hp)} of ${boss.maxHp}`);
          }
        }
        return onEvents(events);
      };

      // the newcomer's timing (core/bot.ts's model: a spread from the accuracy, a reaction time, a thumb's rate)
      const T = x.tuning;
      const half = (T.blocks.attackWidth + T.cursor.widthFrac) / 2 / (1 / T.cursor.basePassSec) + T.judge.graceMs / 1000;
      // the normal quantile of (1 + p) / 2 by bisection on erf (p = the share of plain yellows hit, lapses aside)
      const erf = (z: number) => {
        const t = 1 / (1 + 0.3275911 * Math.abs(z));
        const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
        return z < 0 ? -y : y;
      };
      const p = Math.min(0.999, acc / 0.97);
      let lo = 0;
      let hi = 5;
      for (let i = 0; i < 40; i++) {
        const m = (lo + hi) / 2;
        if (erf(m / Math.SQRT2) < p) lo = m;
        else hi = m;
      }
      const aim = { sigma: half / lo, react: 0.38, reactRed: 0.27, gap: 0.17, lapse: 0.03 };
      S.aim = aim;

      const isRed = (k: string) => k === 'red' || k === 'shield' || k === 'bomb' || k === 'speed';
      let pending: { wall: number; id: number; timer: number } | null = null;
      let busyUntil = 0; // performance.now ms: the person is doing something (reading, reacting)
      let screenKey = '';
      let screenAt = 0;
      let tipSeen: string | null = null;
      let tipAt = 0;
      let readMs = 0;
      let lastStoryKey = '';
      let storyAt = 0;
      let mapReadyAt = 0;
      let finReadyAt = 0;

      const plan = () => {
        const c = x.run.combat;
        const now = P.now();
        const t = x.clock.now(now) / 1000;
        const cpos = c.cursorPosAt(t);
        const dir = ((c.phaseAt(t) % 2) + 2) % 2 < 1 ? 1 : -1;
        const v = c.cursorSpeed() * c.zoneMultAt(cpos);
        const toWall = c.travelTime(cpos, dir > 0 ? 1 : 0, dir);
        let best: Any = null;
        let red: Any = null;
        for (const b of c.blocks) {
          if (b.kind === 'purple' || b.kind === 'mirror') continue;
          const tau = b.vel === 0 ? ((b.pos - cpos) * dir >= 0 ? c.travelTime(cpos, b.pos, dir) : -1) : (b.pos - cpos) / (v * dir - b.vel);
          if (!(tau >= 0) || tau > Math.min(toWall, 0.6)) continue;
          if (b.bornAt > t + tau - (isRed(b.kind) ? aim.reactRed : aim.react)) continue;
          if (!best || tau < best.tau) best = { tau, id: b.id };
          if (isRed(b.kind) && (!red || tau < red.tau)) red = { tau, id: b.id };
        }
        if (!best) return;
        if (red && red.id !== best.id && red.tau - best.tau < aim.gap) best = red;
        const err = Math.random() < aim.lapse ? (Math.random() < 0.5 ? -1 : 1) * rnd(0.08, 0.25) : gauss() * aim.sigma;
        const at = now + Math.max(5, (best.tau + err) * 1000);
        const id = best.id;
        pending = {
          wall: at,
          id,
          timer: window.setTimeout(() => {
            pending = null;
            const cc = x.run.combat;
            if (!cc || x.tipUp || !x.active() || !cc.blocks.some((b: Any) => b.id === id)) return;
            busyUntil = P.now() + aim.gap * 1000;
            tap(163, 128);
          }, at - now),
        };
      };

      const step = () => {
        if (S.done) return;
        const now = P.now();
        const ph = x.run.phase;
        const key = `${ph}|${x.storyId ?? ''}|${x.run.combat ? x.run.combat.enemies.length : ''}`;
        if (key !== screenKey) {
          screenKey = key;
          screenAt = now;
        }
        // a tip: read it, then tap it away
        if (x.tipUp) {
          if (pending) {
            clearTimeout(pending.timer);
            pending = null;
          }
          const id = view.tips.current;
          if (id !== tipSeen) {
            tipSeen = id;
            tipAt = now;
            readMs = rnd(2300, 2900); // two short lines, read
            S.tips.push({ id, wall: +((now - t0) / 1000).toFixed(1) });
            w.__f10Shot(`tip-${id}`);
            log(`tip ${id}`);
          }
          if (now - tipAt > readMs && now > busyUntil) {
            tap(163, 120);
            busyUntil = now + 450;
          }
          return;
        }
        tipSeen = null;
        if (now < busyUntil) return;
        switch (ph) {
          case 'world': {
            if (view.worldMap.touring) return; // watching the glide
            if (now - screenAt < 1500) return; // a look at the map
            const g = view.worldMap.greenmarch();
            tap(g.x, g.y);
            busyUntil = now + 1500;
            return;
          }
          case 'scene': {
            const k = `${x.storyId}|${x.storyBox}`;
            if (k !== lastStoryKey) {
              lastStoryKey = k;
              storyAt = now;
            }
            if (now - storyAt > rnd(1900, 2300)) {
              tap(160, 128);
              storyAt = now; // (still typing: that tap showed the whole box; the next comes ~2 s on)
            }
            return;
          }
          case 'map': {
            if (view.mapView.walking) {
              mapReadyAt = 0;
              return;
            }
            if (!mapReadyAt) mapReadyAt = now;
            if (now - mapReadyAt < 1600) return; // looks at the choices
            // a skill point to spend (the balance bot spends them after every loot): Camp, Skills, learn, back (from
            // the first chest on: the first minutes are timed as a newcomer who hasn't found the camp yet plays them)
            if (skills && S.beats.some((b: Any) => b.id === 'chestOpened') && x.tips.pointsToSpend(x.run)) {
              S.campFor = 'skills';
              log('camp: to spend skill points');
              const cr = view.mapView.campRect();
              tap(cr.x + cr.w / 2, cr.y + cr.h / 2);
              busyUntil = now + 1500;
              mapReadyAt = 0;
              return;
            }
            const choices: number[] = x.run.choices();
            if (!choices.length) return;
            const nodes = choices.map((id) => x.run.map.nodes[id]);
            const low = x.run.hero.hp < 0.5 * (x.run.combat?.maxHp?.() ?? 200);
            const pick =
              nodes.find((n: Any) => n.type === 'treasure') ??
              (low ? nodes.find((n: Any) => n.type === 'rest') : undefined) ??
              nodes.find((n: Any) => n.type === 'fight') ??
              nodes.find((n: Any) => n.type !== 'elite') ??
              nodes[0];
            const [nx, ny] = view.mapView.pos(pick);
            if (!S.beats.some((b: Any) => b.id === 'firstChoice')) beat('firstChoice', `${pick.type} (of ${nodes.map((n: Any) => n.type).join(', ')})`);
            else if (pick.type === 'treasure') beat('chestChoice', `row ${pick.row} (of ${nodes.map((n: Any) => n.type).join(', ')})`);
            log(`map: choose ${pick.type} (${nodes.map((n: Any) => n.type).join(', ')})`);
            tap(nx, ny);
            busyUntil = now + 1200;
            mapReadyAt = 0;
            return;
          }
          case 'fight': {
            const c = x.run.combat;
            if (!c) return;
            if (x.storyOverlay) {
              // a boss's scene mid-fight: read it like the story
              if (now - storyAt > rnd(1900, 2300)) {
                tap(160, 128);
                storyAt = now;
              }
              return;
            }
            if (x.awaitingBegin) {
              if (now - screenAt < 900) return;
              tap(163, 75);
              busyUntil = now + 500;
              if (!S.beats.some((b: Any) => b.id === 'fightBegun')) beat('fightBegun');
              return;
            }
            if (c.result) return;
            if (!x.active()) return;
            // (a newcomer swipes once the game has shown them how: the finisher's tip, or a finisher already fired)
            if (c.finisherReady && (S.tips.some((t: Any) => t.id === 'finisher') || S.beats.some((b: Any) => b.id === 'firstFinisher'))) {
              if (!finReadyAt) finReadyAt = now;
              // (a swipe whose press lands a hit runs the hit's work first: on a loaded machine that alone can outlast
              // the swipe's 350 ms, the synthetic move's timeStamp being when it was made; so it swipes between
              // blocks, as a thumb mostly does, or after 3 s whatever is under the cursor)
              const clear = x.wouldMiss(P.now()) || now - finReadyAt > 3000;
              if (now - finReadyAt > 550 && !pending && clear) {
                swipe();
                busyUntil = now + 400;
                finReadyAt = 0;
              }
              return;
            }
            finReadyAt = 0;
            if (!pending) plan();
            return;
          }
          case 'loot':
            if (now - screenAt > 1800) {
              tap(163, 75);
              busyUntil = now + 900;
            }
            return;
          case 'boost': {
            if (now - screenAt < 2600) return; // reads the three cards
            const r = view.overlays.cardRect(0);
            tap(r.x + r.w / 2, r.y + r.h / 2);
            busyUntil = now + 1200;
            return;
          }
          case 'treasure':
            if (now - screenAt > 900) {
              tap(163, 100);
              busyUntil = now + 900;
            }
            return;
          case 'rest':
          case 'shop':
          case 'event':
          case 'bounty':
            // (the newcomer only walks into these when nothing else is offered: through them by the run's own calls)
            if (now - screenAt > 2500) {
              x.setPhase(() => {
                if (ph === 'rest') x.run.rest();
                else if (ph === 'shop') x.run.leaveShop();
                else if (ph === 'event') {
                  // the first choice it can afford (else the last, usually "walk on"), then on
                  if (x.run.event.outcome < 0 && !x.run.chooseEvent(0)) for (let i = 4; i >= 0 && !x.run.chooseEvent(i); i--);
                  x.run.endEvent();
                }
                else x.run.passQuest();
              });
              log(`left the ${ph} by a call`);
              busyUntil = now + 600;
            }
            return;
          case 'defeat': {
            beat('defeat', `retries ${S.retries ?? 0}`);
            // through Act 1: a newcomer tries again (Retry: the act from its start, found gear and coins kept), twice
            const btn = view.overlays.tipPeek().defeat;
            if (until !== 'act' || (S.retries ?? 0) >= 2) {
              S.done = true;
              return;
            }
            if (!btn || now - screenAt < 2500) return;
            S.retries = (S.retries ?? 0) + 1;
            log(`retry ${S.retries}`);
            tap(btn.retry.x + btn.retry.w / 2, btn.retry.y + btn.retry.h / 2);
            busyUntil = now + 1500;
            return;
          }
          case 'actClear': {
            beat('actClear');
            if (until !== 'act') {
              S.done = true;
              return;
            }
            // the act clear's chest: a tap bursts it (a look first)
            if (!S.actChest) {
              if (now - screenAt > 1500) {
                S.actChest = true;
                tap(163, 90);
              }
              return;
            }
            // what it gave, then Camp (a chest waits there: the boss's hero chest)
            const btn = view.overlays.tipPeek().clear;
            if (!btn) return;
            if (!S.clearAt) {
              S.clearAt = now;
              beat('actClearOpen', `chests waiting ${x.profile.chests.hero + x.profile.chests.rare + x.profile.chests.region}`);
            }
            if (now - S.clearAt > 2600) {
              S.campFor = 'chest';
              tap(btn.camp.x + btn.camp.w / 2, btn.camp.y + btn.camp.h / 2);
              busyUntil = now + 900;
            }
            return;
          }
          case 'camp': {
            // the camp: its scene first (Sable), then the vault and the first hero chest
            const camp = view.camp;
            if (x.storyOverlay) {
              const k = `${x.storyOverlay}|${x.storyBox}`;
              if (k !== lastStoryKey) {
                lastStoryKey = k;
                storyAt = now;
                beat(`campScene`, x.storyOverlay);
              }
              if (now - storyAt > rnd(1900, 2300)) {
                tap(160, 128);
                storyAt = now;
              }
              return;
            }
            if (S.campFor === 'skills') {
              if (camp.mode === 'home') {
                if (now - screenAt < 1200) return;
                camp.go('skills', now);
                busyUntil = now + 1200;
                return;
              }
              if (camp.mode === 'skills') {
                // down one branch (the first with a node learned, else the first), a tap to pick a node and one to learn it
                const sk = camp.skills;
                const tree = sk.tree();
                const learned = sk.prog().skills as string[];
                const first = Math.max(0, tree.findIndex((b: Any) => b.nodes.some((n: Any) => learned.includes(n.id))));
                let n = 0;
                for (let k = 0; k < tree.length; k++)
                  for (const node of tree[(first + k) % tree.length].nodes)
                    if (sk.check(node.id) === 'ok') {
                      sk.sel = node.id;
                      sk.doLearn(now);
                      n++;
                      S.taps += 2;
                    }
                beat('skillsSpent', `${n} node(s)`);
                log(`skills: learned ${n}`);
                S.campFor = null;
                busyUntil = now + 1800; // (watches the node light up)
                setTimeout(() => x.leaveCamp(), 1500);
                return;
              }
              return;
            }
            if (camp.mode === 'home') {
              beat('campHome');
              if (S.chestDone) {
                S.done = true;
                return;
              }
              if (now - screenAt < 1500 || S.vault) return;
              const pl = camp.plates().find((q: Any) => q.id === 'chests');
              if (!pl) return;
              S.vault = true;
              tap(pl.r.x + pl.r.w / 2, pl.r.y + pl.r.h / 2);
              busyUntil = now + 1200;
              return;
            }
            if (camp.mode === 'chests') {
              const ch = camp.chests;
              if (!S.chestTapped) {
                beat('vault');
                if (!S.vaultAt) S.vaultAt = now;
                if (now - S.vaultAt < 1200) return;
                const r = ch.slot(0).open;
                S.chestTapped = true;
                tap(r.x + r.w / 2, r.y + r.h / 2);
                busyUntil = now + 600;
                beat('heroChestOpen');
                return;
              }
              if (ch.revealing) {
                if (ch.opening.state.phase === 'reveal') beat('heroChestReveal', String(ch.opening.state.tier ?? ''));
                // the build-up plays; once the prize is shown, a look, then a tap to close it
                if (ch.opening.state.phase === 'reveal' && !S.revealAt) S.revealAt = now;
                if (S.revealAt && now - S.revealAt > 2500) {
                  tap(163, 75);
                  busyUntil = now + 700;
                }
                return;
              }
              beat('heroChestDone');
              S.chestDone = true;
              S.done = true;
              return;
            }
            return;
          }
        }
      };
      // fights bank their clock when they end
      let lastCombat: Any = null;
      setInterval(() => {
        const c = x.run.combat;
        if (c !== lastCombat) {
          if (lastCombat) S.fightClock += lastCombat.time;
          lastCombat = c;
          if (c) combatSeen = c;
        }
        if (c && c.result === 'won') beat('firstWin');
        try {
          step();
        } catch (e) {
          S.log.push(`error ${(e as Error).message}`);
        }
      }, 40);
    },
    [ACC, UNTIL, SKILLS] as const,
  );

  // ---- New game: the title's tap (a new player's only choice)
  const l = (await page.evaluate('window.__cq3.app.layout')) as { left: number; top: number; cssW: number; cssH: number };
  await page.evaluate(() => (window as Any).__f10.beat('newGame'));
  await page.mouse.click(l.left + (163 * l.cssW) / 327, l.top + (75 * l.cssH) / 150);
  await page.evaluate(() => (window as Any).__f10.taps++);

  // ---- watch: screenshots as the beats come, until the first chest is opened and the map is back
  const start = Date.now();
  let dumped = 0;
  const dump = async () => {
    const res = await page.evaluate(() => {
      const S = (window as Any).__f10;
      return { beats: S.beats, tips: S.tips, log: S.log, counts: S.counts, aim: S.aim, taps: S.taps };
    });
    writeFileSync(`${OUT}/first10.json`, JSON.stringify({ seed: SEED, acc: ACC, wallSec: (Date.now() - start) / 1000, ...res, shots }, null, 2));
    return res as { beats: Beat[]; tips: unknown[]; log: string[]; counts: Record<string, number>; aim: unknown; taps: number };
  };
  for (;;) {
    while (queue.length) await shot(queue.shift()!);
    const s = (await page.evaluate(() => ({ done: (window as Any).__f10.done }))) as { done: boolean };
    if (s.done || Date.now() - start > (UNTIL === 'act' ? 27 : 17) * 60_000) break;
    if (Date.now() - dumped > 5000) {
      dumped = Date.now();
      await dump();
    }
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(600);
  while (queue.length) await shot(queue.shift()!);
  await shot('end');

  const res = await dump();
  console.log(res.beats.map((b) => `${b.id.padEnd(14)} ${String(b.wall).padStart(6)}s wall  ${String(b.fight).padStart(6)}s fight  ${String(b.taps).padStart(4)} taps  ${b.note}`).join('\n'));
  const ids = res.beats.map((b) => b.id);
  // what the first minutes promise (docs/first-10.md): the first chest within 3 minutes of New game (about 1:30 now,
  // the story included), the first finisher revealed by name, and before the chest only the basics' tips (the quiet
  // start: no packs, relic belt, Synergy! or skill point yet)
  const at = (id: string) => res.beats.find((b) => b.id === id);
  if (UNTIL === 'act') for (const id of ['actClear', 'heroChestOpen', 'heroChestReveal']) expect(ids, id).toContain(id);
  expect(at('firstChest')!.wall, 'the first chest, s after New game').toBeLessThan(180);
  expect(await page.evaluate(() => (window as Any).__f10.reveal)).toEqual({ active: true, held: true });
  const early = (res.tips as Array<{ id: string; wall: number }>).filter((t) => t.wall < at('firstChest')!.wall).map((t) => t.id);
  for (const id of ['roamer', 'relicBelt', 'synergy', 'levelUp', 'sparkle']) expect(early, id).not.toContain(id);
  for (const id of ['worldMap', 'intro', 'firstMap', 'firstFight', 'firstHit', 'firstFinisher', 'firstWin', 'firstChest', LAST_BEAT]) expect(ids, id).toContain(id);
  expect(errors).toEqual([]);
});
