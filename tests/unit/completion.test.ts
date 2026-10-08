// The region completion tracker (core/completion.ts) and its card's marks (engine/region-sites.ts): every count comes
// from one list of items (the playtester saw 11 seals beside "13/15"), the card stamps exactly one mark per item, all
// fifteen in the opening view, and the map is bigger than its frame (it pans, kept on the map).
import { describe, expect, it } from 'vitest';
import { claimRegionReward, COMPLETION_PARTS, EVENTS_PER_REGION, regionCompletion, type CompletionItem } from '../../src/core/completion';
import { labProfile } from '../../src/core/lab';
import { newProfile, type Profile } from '../../src/core/profile';
import { cloneTuning } from '../../src/core/tuning';
import { EVENTS } from '../../src/data/events';
import { labScenario } from '../../src/data/lab';
import { REGIONS, regionStart } from '../../src/data/regions';
import { clampCamera, OPENING_CAMERA, REGION_MAP_H, REGION_MAP_W, REGION_SITES, REGION_VIEW_H, REGION_VIEW_W, regionMarks, SEAL_R } from '../../src/engine/region-sites';

const t = cloneTuning();

/** Everything in region `r` done: its acts cleared (its boss beaten), every bounty, hidden treasure and event. */
function everything(r: number, p: Profile = newProfile()): Profile {
  const n = REGIONS[r].acts.length;
  p.actsCleared = Math.max(p.actsCleared, regionStart(r) + n);
  p.regions[REGIONS[r].id] = {
    bounties: Array.from({ length: n }, (_, a) => a),
    treasures: Array.from({ length: n }, (_, a) => a),
    events: EVENTS.slice(0, EVENTS_PER_REGION).map((e) => e.id),
    chest: false,
  };
  return p;
}

/** The counts agree with the items: one item per counted thing, each part's have/of counted from them. */
function agrees(c: ReturnType<typeof regionCompletion>): void {
  expect(c.items.length).toBe(c.of);
  expect(c.items.filter((it) => it.done).length).toBe(c.have);
  expect(c.parts.map((x) => x.key)).toEqual(COMPLETION_PARTS.map((x) => x.key));
  for (const part of c.parts) {
    const mine = c.items.filter((it) => it.key === part.key);
    expect(mine.length, part.key).toBe(part.of);
    expect(mine.filter((it) => it.done).length, part.key).toBe(part.have);
  }
  expect(c.parts.reduce((a, x) => a + x.have, 0)).toBe(c.have);
  expect(c.parts.reduce((a, x) => a + x.of, 0)).toBe(c.of);
  expect(c.pct).toBe(c.done ? 100 : Math.floor((c.have / c.of) * 100));
}

describe('region completion: one source for every count', () => {
  it('everything done: 15/15 in every region, every part have == of, 100%, the reward once', () => {
    for (let r = 0; r < REGIONS.length; r++) {
      const p = everything(r);
      const c = regionCompletion(p, r);
      expect(c.of, REGIONS[r].id).toBe(15);
      expect(c.have, REGIONS[r].id).toBe(15);
      for (const part of c.parts) expect(part.have, `${REGIONS[r].id} ${part.key}`).toBe(part.of);
      expect(c.items.every((it) => it.done)).toBe(true);
      expect(c.pct).toBe(100);
      expect(c.done).toBe(true);
      agrees(c);
      expect(claimRegionReward(p, t, r)).toBe(true);
      expect(claimRegionReward(p, t, r)).toBe(false);
    }
  });

  it('15 items per region: 3 acts, 2 mini-bosses, the boss, 3 bounties, 3 hidden treasures, 3 events', () => {
    const c = regionCompletion(newProfile(), 0);
    const count = (k: CompletionItem['key']) => c.items.filter((it) => it.key === k).length;
    expect([count('acts'), count('minis'), count('boss'), count('bounties'), count('treasures'), count('events')]).toEqual([3, 2, 1, 3, 3, 3]);
    expect(c.have).toBe(0);
    agrees(c);
  });

  it('every stage of a playthrough agrees, item by item (the acts, their bounties and treasures, the events)', () => {
    const p = newProfile();
    const log = (p.regions.greenmarch = { bounties: [] as number[], treasures: [] as number[], events: [] as string[], chest: false });
    for (let step = 0; step <= 12; step++) {
      p.actsCleared = Math.min(3, Math.floor(step / 4) + (step % 4 === 3 ? 1 : 0));
      if (step % 3 === 1 && log.bounties.length < 3) log.bounties.push(log.bounties.length);
      if (step % 3 === 2 && log.treasures.length < 3) log.treasures.push(2 - log.treasures.length);
      if (step % 4 === 0 && log.events.length < 4) log.events.push(EVENTS[log.events.length].id);
      const c = regionCompletion(p, 0);
      agrees(c);
      // each act's bounty and treasure is lit by the act it was found in
      for (const it of c.items.filter((x) => x.key === 'bounties')) expect(it.done).toBe(log.bounties.includes(it.n));
      for (const it of c.items.filter((x) => x.key === 'treasures')) expect(it.done).toBe(log.treasures.includes(it.n));
    }
  });

  it("a log entry that isn't one of the region's acts never counts (the count and the seals can't disagree)", () => {
    const p = newProfile();
    p.actsCleared = 1;
    p.regions.greenmarch = { bounties: [1, 4, 7], treasures: [0, 0, 9], events: ['well', 'shrine', 'herbalist', 'merchant'], chest: false };
    const c = regionCompletion(p, 0);
    agrees(c);
    expect(c.parts.find((x) => x.key === 'bounties')!.have).toBe(1);
    expect(c.parts.find((x) => x.key === 'treasures')!.have).toBe(1);
    expect(c.parts.find((x) => x.key === 'events')!.have).toBe(3); // (more than three counts as three)
  });

  it("the Test lab's profiles: near is 13/15 (its boss and last act left), done is 15/15", () => {
    const near = regionCompletion(labProfile(t, labScenario('completionNear')!), 0);
    expect([near.have, near.of]).toEqual([13, 15]);
    expect(near.items.filter((it) => !it.done).map((it) => it.key).sort()).toEqual(['acts', 'boss']);
    agrees(near);
    const done = regionCompletion(labProfile(t, labScenario('completionDone')!), 0);
    expect([done.have, done.of, done.pct]).toEqual([15, 15, 100]);
    agrees(done);
    // everything unlocked (every hero and companion too): every region reads 15/15, 100%
    const all = labProfile(t, labScenario('completionAll')!);
    expect(all.allUnlocked).toBe(true);
    for (let r = 0; r < REGIONS.length; r++) {
      const c = regionCompletion(all, r);
      expect([c.have, c.of, c.pct], REGIONS[r].id).toEqual([15, 15, 100]);
      agrees(c);
    }
  });

  it('"Unlock all heroes and companions" is about heroes and companions: the tracker still counts what was played', () => {
    const p = newProfile();
    p.allUnlocked = true;
    expect(regionCompletion(p, 0).have).toBe(0);
  });
});

describe("the region card's marks", () => {
  it('one mark per counted item, in the same order, lit exactly when the item is done', () => {
    for (let r = 0; r < REGIONS.length; r++) {
      const id = REGIONS[r].id;
      expect(REGION_SITES[id], id).toBeDefined();
      for (const p of [newProfile(), everything(r), labProfile(t, labScenario('completionNear')!)]) {
        const c = regionCompletion(p, r);
        const marks = regionMarks(id, c.items);
        expect(marks.length, id).toBe(c.of);
        expect(marks.map(({ key, n, done }) => ({ key, n, done }))).toEqual(c.items);
        expect(marks.filter((m) => m.done).length).toBe(c.have);
      }
    }
  });

  it('all fifteen in the opening view, none overlapping, every one on the map', () => {
    for (const r of REGIONS) {
      const marks = regionMarks(r.id, regionCompletion(everything(REGIONS.indexOf(r)), REGIONS.indexOf(r)).items);
      for (const m of marks) {
        const where = `${r.id} ${m.key} ${m.n} at ${m.x},${m.y}`;
        expect(m.x - SEAL_R, where).toBeGreaterThanOrEqual(OPENING_CAMERA.x + 1);
        expect(m.x + SEAL_R, where).toBeLessThanOrEqual(OPENING_CAMERA.x + REGION_VIEW_W - 1);
        expect(m.y - SEAL_R, where).toBeGreaterThanOrEqual(OPENING_CAMERA.y + 1);
        expect(m.y + SEAL_R, where).toBeLessThanOrEqual(OPENING_CAMERA.y + REGION_VIEW_H - 1);
      }
      for (let i = 0; i < marks.length; i++)
        for (let j = i + 1; j < marks.length; j++)
          expect(Math.hypot(marks[i].x - marks[j].x, marks[i].y - marks[j].y), `${r.id}: ${marks[i].key} ${marks[i].n} / ${marks[j].key} ${marks[j].n}`).toBeGreaterThanOrEqual(SEAL_R * 2);
    }
  });

  it('the map is bigger than its frame: it pans both ways, and never past its edges', () => {
    expect(REGION_MAP_W).toBeGreaterThan(REGION_VIEW_W);
    expect(REGION_MAP_H).toBeGreaterThan(REGION_VIEW_H);
    expect(clampCamera(-50, -50)).toEqual({ x: 0, y: 0 });
    expect(clampCamera(1e4, 1e4)).toEqual({ x: REGION_MAP_W - REGION_VIEW_W, y: REGION_MAP_H - REGION_VIEW_H });
    expect(clampCamera(OPENING_CAMERA.x, OPENING_CAMERA.y)).toEqual(OPENING_CAMERA);
    // the opening view has room to pan every way
    expect(OPENING_CAMERA.x).toBeGreaterThan(0);
    expect(OPENING_CAMERA.y).toBeGreaterThan(0);
    expect(OPENING_CAMERA.x).toBeLessThan(REGION_MAP_W - REGION_VIEW_W);
    expect(OPENING_CAMERA.y).toBeLessThan(REGION_MAP_H - REGION_VIEW_H);
  });
});
