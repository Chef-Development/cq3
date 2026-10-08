// The skill trees of every hero but Rowan (plain data, no logic; Rowan's tree and the format are in skills.ts). Each
// hero has 3 branches built on their style and kit, 5 nodes each, learned in order: two stat nodes, two rule nodes
// that change a rule, and a capstone that changes how you play. '{n}' in a text is the node's number (the live value
// is tuning.skills.n[id]). core/skill-fx-heroes.ts makes the rule nodes and capstones work in fights.

import type { HeroId } from './heroes';
import type { SkillBranch, SkillNode, SkillStat } from './skills';

const stat = (id: string, name: string, s: SkillStat, n: number, text: string): SkillNode => ({ id, name, kind: 'stat', stat: s, n, text });
const rule = (id: string, name: string, text: string, before: string, after: string, n?: number): SkillNode => ({ id, name, kind: 'rule', text, before, after, n });
const cap = (id: string, name: string, text: string, before: string, after: string, n?: number): SkillNode => ({ id, name, kind: 'capstone', text, before, after, n });

const atk = (id: string, name: string, n: number) => stat(id, name, 'atkPct', n, '+{n}% attack.');
const crit = (id: string, name: string, n: number) => stat(id, name, 'critChance', n, '+{n}% crit chance.');
const hp = (id: string, name: string, n: number) => stat(id, name, 'hpPct', n, '+{n}% max HP.');
const def = (id: string, name: string, n: number) => stat(id, name, 'def', n, '+{n} Defense.');
const meter = (id: string, name: string, n: number) => stat(id, name, 'meterGain', n, '+{n}% meter gain.');
const combo = (id: string, name: string, n: number) => stat(id, name, 'comboPower', n, '+{n} combo power.');

export const HERO_TREES: Record<Exclude<HeroId, 'rowan'>, SkillBranch[]> = {
  // ---------------------------------------------------------------- Sable (Shadow): chains, dashes, smoke
  sable: [
    {
      id: 'sableChain',
      name: 'Chain',
      theme: 'Perfect chains',
      nodes: [
        atk('quickHands', 'Quick Hands', 10),
        crit('lightGrip', 'Light Grip', 6),
        rule('sureChain', 'Sure Chain', "A hit that isn't Perfect no longer ends the Chain.", 'A plain hit ends the Chain.', 'Only misses and hits taken end it.'),
        rule('deepCuts', 'Deep Cuts', 'At {n}+ Chain links, Perfect hits always crit.', 'Crits come by chance.', 'Perfects crit at {n}+ links.', 4),
        cap('deathMark', 'Death Mark', 'Twin Fang deals {n}% more per Chain link.', 'Twin Fang ignores your Chain.', '+{n}% Twin Fang per Chain link.', 25),
      ],
    },
    {
      id: 'sableDash',
      name: 'Dash',
      theme: 'Shadow Dash',
      nodes: [
        meter('fleet', 'Fleet', 12),
        combo('sharpFocus', 'Sharp Focus', 1),
        rule('lunge', 'Lunge', 'After a Perfect hit, your next hit deals {n}% more.', 'A Perfect only feeds the Chain.', 'The hit after it deals +{n}%.', 40),
        rule('nightStep', 'Night Step', 'Perfect blocks dash you ahead too.', 'Only Perfect hits dash.', 'Perfect blocks dash as well.'),
        cap('phantomRush', 'Phantom Rush', 'A Perfect cuts down the nearest red, once every {n} s.', 'Every red needs a block.', 'A Perfect cuts a red every {n} s.', 3),
      ],
    },
    {
      id: 'sableSmoke',
      name: 'Smoke',
      theme: 'Smoke Veil',
      nodes: [
        hp('wiry', 'Wiry', 10),
        def('evasion', 'Evasion', 6),
        rule('thickSmoke', 'Thick Smoke', 'Smoke Veil lasts {n} s longer.', 'The smoke clears fast.', 'It lasts {n} s longer.', 1.5),
        rule('vanish', 'Vanish', 'In the smoke, the first red to reach you misses.', 'The smoke only forgives misses.', 'It also dodges one red.'),
        cap('nightCloak', 'Night Cloak', 'In the smoke, your hits crit {n}% more often.', 'The smoke only keeps you safe.', '+{n}% crit while in the smoke.', 50),
      ],
    },
  ],
  // ---------------------------------------------------------------- Neve (Controller): freezing, slowing, patches
  neve: [
    {
      id: 'neveFrost',
      name: 'Frost',
      theme: 'Frozen blocks',
      nodes: [
        atk('frostEdge', 'Frost Edge', 10),
        crit('iceShards', 'Ice Shards', 6),
        rule('brittle', 'Brittle', 'Frozen blocks shatter for {n}% more.', 'A shatter hits hard.', 'Shatters deal +{n}%.', 30),
        rule('bigFreeze', 'Big Freeze', 'Glacier turns every red into ice to shatter.', 'Glacier holds reds in place.', 'Glacier turns reds to ice.'),
        cap('iceAge', 'Ice Age', 'Every block freezes its red.', 'Only some blocks freeze a red.', 'Blocks always freeze reds.'),
      ],
    },
    {
      id: 'neveChill',
      name: 'Chill',
      theme: 'Slowing reds',
      nodes: [
        hp('frostCoat', 'Frost Coat', 8),
        def('rimeGuard', 'Rime Guard', 6),
        rule('longBend', 'Long Bend', 'Bend slows reds {n} s longer.', 'Bend lasts a moment.', 'It lasts {n} s longer.', 1),
        rule('frostAura', 'Frost Aura', 'While Chill is on, reds move {n}% slower.', 'Chill only slows the cursor.', 'It slows reds by {n}% too.', 30),
        cap('coldShoulder', 'Cold Shoulder', 'A slowed red bounces off the wall, once every {n} s.', 'A slowed red still hits you.', 'One bounces off every {n} s.', 6),
      ],
    },
    {
      id: 'neveGlacier',
      name: 'Glacier',
      theme: 'Ice patches',
      nodes: [
        meter('snowfall', 'Snowfall', 12),
        combo('clearMind', 'Clear Mind', 1),
        rule('skater', 'Skater', 'Hits inside a patch deal {n}% more.', 'Patches only change your speed.', 'Hits on a patch deal +{n}%.', 25),
        rule('frostTrail', 'Frost Trail', 'A shatter leaves an ice patch there for {n} s.', 'A shatter leaves nothing behind.', 'It leaves ice for {n} s.', 3),
        cap('blackIce', 'Black Ice', 'Every {n} s, an ice patch forms ahead of the cursor.', 'Ice comes and goes with the land.', 'An ice patch forms every {n} s.', 6),
      ],
    },
  ],
  // ---------------------------------------------------------------- Moss (Summoner): one branch per ally
  moss: [
    {
      id: 'mossThorns',
      name: 'Thorns',
      theme: 'Thornlings',
      nodes: [
        atk('bramble', 'Bramble', 10),
        crit('thistle', 'Thistle', 6),
        rule('quickThorns', 'Quick Thorns', 'Thornlings jab {n}% faster.', 'A Thornling jabs now and then.', 'It jabs {n}% faster.', 50),
        rule('thornRush', 'Thorn Rush', "Thornling jabs fill the meter ({n}% of a hit's).", 'Thornlings only deal damage.', "Each jab fills {n}% of a hit's.", 30),
        cap('rooted', 'Rooted', "A Thornling never leaves once it's called.", 'Every ally leaves after a while.', 'Thornlings stay all fight.'),
      ],
    },
    {
      id: 'mossBark',
      name: 'Bark',
      theme: 'Barkbacks',
      nodes: [
        def('barkskin', 'Barkskin', 6),
        hp('heartwood', 'Heartwood', 10),
        rule('quickBrace', 'Quick Brace', 'Barkbacks brace {n}% faster.', 'A Barkback braces now and then.', 'It braces {n}% faster.', 50),
        rule('splinters', 'Splinters', "A Barkback's block hits every foe for {n}% attack.", 'A Barkback only stops reds.', 'Its block hits all for {n}%.', 60),
        cap('rootCall', 'Root Call', 'Every {n} reds you block call an ally.', 'Only green hits call allies.', 'Every {n} blocks call one too.', 8),
      ],
    },
    {
      id: 'mossBloom',
      name: 'Bloom',
      theme: 'Glowmoths',
      nodes: [
        meter('morningDew', 'Morning Dew', 12),
        combo('blossom', 'Blossom', 1),
        rule('brightMoth', 'Bright Moth', 'Glowmoths heal {n}% more.', 'A Glowmoth heals a little.', 'It heals {n}% more.', 50),
        rule('moonglow', 'Moonglow', "A Glowmoth's light slows every red for {n} s.", 'Glowmoths only heal.', 'Their light slows reds {n} s.', 1),
        cap('pollenBurst', 'Pollen Burst', 'A Rally bursts on every foe for {n}% attack per ally.', 'A Rally only refreshes allies.', 'It bursts for {n}% per ally.', 50),
      ],
    },
  ],
  // ---------------------------------------------------------------- Tam (Bomber): kegs, chains, blasts
  tam: [
    {
      id: 'tamKegs',
      name: 'Kegs',
      theme: 'Keg supply',
      nodes: [
        hp('deepPockets', 'Deep Pockets', 8),
        def('leatherApron', 'Leather Apron', 6),
        rule('turnabout', 'Turnabout', 'Big Bang turns every red into a keg.', 'Big Bang knocks reds off.', 'Big Bang turns reds to kegs.'),
        rule('restock', 'Restock', 'A Perfect hit on a keg drops a new keg.', 'A keg is gone once it blows.', 'A Perfect keg hit drops another.'),
        cap('minefield', 'Minefield', 'A red that runs into a keg sets it off.', 'Reds slide past kegs.', 'Reds set off the kegs they touch.'),
      ],
    },
    {
      id: 'tamChains',
      name: 'Chains',
      theme: 'Chain Fuse',
      nodes: [
        meter('longFuse', 'Long Fuse', 12),
        combo('sparkler', 'Sparkler', 1),
        rule('packedPowder', 'Wide Blast', 'Keg blasts reach {n}% wider.', 'A blast reaches a little way.', 'Blasts reach {n}% wider.', 50),
        rule('shrapnel', 'Shrapnel', 'A keg blast also hits the yellows it reaches.', 'Blasts pass over yellows.', 'Blasts hit the yellows nearby.'),
        cap('powderLine', 'Powder Line', 'Hitting a keg sets off every keg on the bar.', 'Only kegs near a blast go off.', 'Every keg on the bar goes off.'),
      ],
    },
    {
      id: 'tamBlasts',
      name: 'Blasts',
      theme: 'Bigger booms',
      nodes: [
        atk('blackPowder', 'Black Powder', 10),
        crit('hotCoals', 'Hot Coals', 6),
        rule('heavyPowder', 'Heavy Powder', 'Keg blasts deal {n}% more.', 'Blasts deal their usual damage.', 'Blasts deal +{n}% damage.', 40),
        rule('shockwave', 'Shockwave', 'A keg blast knocks every red back {n}% of the bar.', 'Blasts only clear reds nearby.', 'They push every red back {n}%.', 10),
        cap('kaboom', 'Kaboom', 'Every keg blast fills {n}% of the meter.', "Blasts don't fill the meter.", 'Each blast fills {n}% of it.', 10),
      ],
    },
  ],
  // ---------------------------------------------------------------- Hollis (Guardian): guard, counters, walls
  hollis: [
    {
      id: 'hollisGuard',
      name: 'Guard',
      theme: 'Storing Guard',
      nodes: [
        atk('heavyArm', 'Heavy Arm', 10),
        crit('battleReady', 'Battle Ready', 6),
        rule('sureGuard', 'Sure Guard', 'Perfect blocks store {n} more Guard.', 'Each block stores 1 Guard.', 'A Perfect block stores {n} more.', 1),
        rule('deepGuard', 'Deep Guard', 'The Bulwark hits {n}% harder.', 'A Bulwark hits with your Guard.', 'It hits {n}% harder.', 50),
        cap('avalanche', 'Avalanche', 'A Bulwark also stuns every foe for {n} s.', 'A Bulwark only hits.', 'It stuns every foe {n} s.', 1),
      ],
    },
    {
      id: 'hollisCounter',
      name: 'Counter',
      theme: 'Shield Slam',
      nodes: [
        meter('shieldDrill', 'Shield Drill', 12),
        combo('ironStance', 'Iron Stance', 1),
        rule('heavySlam', 'Heavy Slam', 'Shield Slam hits {n}% harder.', 'Shield Slam is a quick jab.', 'It hits {n}% harder.', 50),
        rule('wideSlam', 'Wide Slam', 'Shield Slam also hits every other foe for {n}%.', 'Shield Slam hits one foe.', 'It hits the others for {n}%.', 50),
        cap('retaliate', 'Retaliate', 'Each Guard you store makes slams {n}% harder.', 'Slams ignore your Guard.', '+{n}% slam per Guard stored.', 20),
      ],
    },
    {
      id: 'hollisWall',
      name: 'Wall',
      theme: 'Rampart',
      nodes: [
        hp('ironSkin', 'Iron Skin', 10),
        def('plated', 'Plated', 6),
        rule('longRampart', 'Long Rampart', "Rampart's wall stands {n} s longer.", 'The wall falls fast.', 'It stands {n} s longer.', 2),
        rule('wallUp', 'Wall Up', 'Green hits raise the wall for {n} s.', 'Only Rampart raises the wall.', 'Greens raise it for {n} s.', 1.5),
        cap('echoWall', 'Echo Wall', 'Every {n} reds that bounce off the wall bank a stack.', 'A bounced red just comes back.', 'Every {n} bounces bank a stack.', 3),
      ],
    },
  ],
  // ---------------------------------------------------------------- Vesper (Marksman): focus, perfects, pins
  vesper: [
    {
      id: 'vesperFocus',
      name: 'Focus',
      theme: 'Storing Focus',
      nodes: [
        atk('tautString', 'Taut String', 10),
        combo('steadyDraw', 'Steady Draw', 1),
        rule('fullDraw', 'Full Draw', 'Hits store {n}% more Focus.', 'Hits store a little Focus.', 'They store {n}% more.', 50),
        rule('steadyHand', 'Steady Hand', 'At {n}%+ Focus, your hits always crit.', 'Crits come by chance.', 'Hits crit at {n}%+ Focus.', 60),
        cap('fullQuiver', 'Full Quiver', 'Full Focus fires as a crit and fills {n}% of the meter.', 'Only green hits fire Focus.', 'A full Focus fires and fills {n}%.', 50),
      ],
    },
    {
      id: 'vesperAim',
      name: 'Aim',
      theme: 'Perfect shots',
      nodes: [
        crit('keenEye', 'Keen Eye', 6),
        meter('stillBreath', 'Still Breath', 12),
        rule('cleanShot', 'Clean Shot', "Perfect hits aren't held back by Focus.", 'Focus holds back every hit.', 'Perfect hits deal in full.'),
        rule('watchful', 'Watchful', 'Perfect blocks store Focus too.', 'Only hits store Focus.', 'Perfect blocks store it too.'),
        cap('trickShot', 'Trick Shot', 'Every {n}th Perfect hit fires your Focus as a crit.', 'Only green hits fire Focus.', 'Every {n}th Perfect fires it (crit).', 5),
      ],
    },
    {
      id: 'vesperPins',
      name: 'Pins',
      theme: 'Pinning reds',
      nodes: [
        hp('rangerCloak', 'Ranger Cloak', 8),
        def('leathers', 'Leathers', 6),
        rule('pinningShot', 'Pinning Shot', 'Green hits pin every red for {n} s.', 'Only Volley pins reds.', 'Greens pin reds for {n} s.', 1),
        rule('exposed', 'Exposed', 'Foes with a pinned red take {n}% more damage.', 'A pinned red just waits.', 'Its owner takes +{n}% damage.', 25),
        cap('deadfall', 'Deadfall', 'Blocking a pinned red hits every foe for {n}% attack.', 'A pinned red is just blocked.', 'Blocking one hits all for {n}%.', 60),
      ],
    },
  ],
  // ---------------------------------------------------------------- Torva (Brute): heavy hits, quakes, rage
  torva: [
    {
      id: 'torvaHeavy',
      name: 'Heavy',
      theme: 'Big swings',
      nodes: [
        atk('ironGrip', 'Iron Grip', 10),
        crit('boneBreaker', 'Bone Breaker', 6),
        rule('pulverize', 'Pulverize', 'Stunned foes take {n}% more from you.', 'A stun only stops attacks.', 'Stunned foes take +{n}%.', 40),
        rule('haymaker', 'Haymaker', 'Wind-Up hits {n}% harder.', 'Wind-Up smashes as usual.', 'It hits {n}% harder.', 40),
        cap('wreckingBall', 'Wrecking Ball', 'Every {n}th Perfect hit winds up your next hit.', 'Only green hits wind up.', 'Every {n}th Perfect does too.', 4),
      ],
    },
    {
      id: 'torvaQuake',
      name: 'Quake',
      theme: 'Pushing reds',
      nodes: [
        meter('stomp', 'Stomp', 12),
        combo('rumble', 'Rumble', 1),
        rule('faultLine', 'Fault Line', 'Quakes knock reds {n}% further.', 'A Quake nudges reds back.', 'Reds fly {n}% further.', 60),
        rule('rupture', 'Rupture', 'A Quake also hits every foe for {n}% attack.', 'A Quake only moves reds.', 'It hits all foes for {n}%.', 25),
        cap('landslide', 'Landslide', 'Every {n}th Quake clears every red off the bar.', 'Quakes only push reds back.', 'Every {n}th clears the reds.', 6),
      ],
    },
    {
      id: 'torvaRage',
      name: 'Rage',
      theme: 'Hurt and angry',
      nodes: [
        hp('thickSkin', 'Thick Skin', 10),
        def('scarred', 'Scarred', 6),
        rule('seething', 'Seething', 'Each hit you take adds {n} Unstoppable stacks.', 'A hit taken adds 1 stack.', 'A hit taken adds {n} stacks.', 2),
        rule('payback', 'Payback', 'A red that hits you winds up your next hit.', 'Getting hit only hurts.', 'It winds up your next hit.'),
        cap('berserk', 'Berserk', 'Under half HP, your hits deal {n}% more.', 'Low HP is just a worry.', 'Under half HP, hits deal +{n}%.', 40),
      ],
    },
  ],
  // part6:A
  // ---------------------------------------------------------------- Solenne (Blade): sunrise, gold, the oath
  solenne: [
    {
      id: 'solenneDawn',
      name: 'Dawn',
      theme: 'Sunrise',
      nodes: [
        atk('sunForged', 'Sun-Forged', 10),
        crit('brightEdge', 'Bright Edge', 6),
        rule('earlyLight', 'Early Light', 'Sunrise comes every {n} combo.', 'Sunrise comes every 15 combo.', 'It comes every {n} combo.', 12),
        rule('longMorning', 'Long Morning', 'Sunrise burns {n} s longer.', 'Sunrise burns a few seconds.', 'It burns {n} s longer.', 1),
        cap('solarFlare', 'Solar Flare', 'As Sunrise lights, a flare hits every foe for {n}%.', 'Sunrise only lights the blade.', 'It flares on all foes: {n}%.', 120),
      ],
    },
    {
      id: 'solenneGold',
      name: 'Gold',
      theme: 'Gilded yellows',
      nodes: [
        meter('polish', 'Polish', 12),
        combo('goldLeaf', 'Gold Leaf', 1),
        rule('twinGleam', 'Twin Gleam', 'Green hits gild {n} yellows.', 'A green gilds one yellow.', 'A green gilds {n} yellows.', 2),
        rule('giltStrike', 'Gilt Strike', 'Gilded hits deal {n}% more.', 'A gilded hit deals as usual.', 'Gilded hits deal +{n}%.', 50),
        cap('midasTouch', 'Midas Touch', 'A Perfect on a gilded yellow gilds the next one.', 'Only greens gild yellows.', 'Gilded Perfects gild the next.'),
      ],
    },
    {
      id: 'solenneOath',
      name: 'Oath',
      theme: 'Holding on',
      nodes: [
        hp('dawnplate', 'Dawnplate', 10),
        def('enamel', 'Enamel', 6),
        rule('firmOath', 'Firm Oath', 'Dawn Oath holds from {n} combo.', 'Dawn Oath holds from 30 combo.', 'It holds from {n} combo.', 20),
        rule('sunWard', 'Sun Ward', 'While Sunrise burns, reds deal {n}% less.', 'Sunrise only attacks.', 'Reds deal {n}% less in it.', 15),
        cap('rekindle', 'Rekindle', 'Losing 6+ combo lights Sunrise for {n} s.', 'A break puts the fire out.', 'Losing 6+ lights it for {n} s.', 2),
      ],
    },
  ],
  // ---------------------------------------------------------------- Wren (Shadow): the knife, rooftops, smoke
  wren: [
    {
      id: 'wrenKnife',
      name: 'Knife',
      theme: 'Perfect chains',
      nodes: [
        atk('whetted', 'Whetted', 10),
        crit('quickWrist', 'Quick Wrist', 6),
        rule('nimble', 'Nimble', 'The Chain survives {n} Good hits.', 'The Chain survives one Good hit.', 'It survives {n} Good hits.', 2),
        rule('backstab', 'Backstab', 'At full Chain, your hits deal {n}% more.', 'A full Chain adds its links.', 'Hits at full Chain: +{n}%.', 25),
        cap('knifeStorm', 'Knife Storm', 'Perfects at full Chain hit every foe for {n}%.', 'Your knife finds one foe.', 'Full Chain Perfects hit all.', 50),
      ],
    },
    {
      id: 'wrenRoof',
      name: 'Rooftops',
      theme: 'Dodging reds',
      nodes: [
        meter('fleetfoot', 'Fleetfoot', 12),
        combo('rooftopRun', 'Rooftop Run', 1),
        rule('quickSlip', 'Quick Slip', 'Slip readies after {n} Perfects in a row.', 'Slip needs 4 Perfects.', 'It needs only {n}.', 3),
        rule('tumble', 'Tumble', "A dodge hits the red's owner for {n}% attack.", 'A dodge only saves you.', 'It hits back for {n}%.', 100),
        cap('untouchable', 'Untouchable', 'Slip holds up to {n} dodges.', 'Slip holds one dodge.', 'It holds {n} dodges.', 2),
      ],
    },
    {
      id: 'wrenSmoke',
      name: 'Smoke',
      theme: 'Smoke Pop',
      nodes: [
        hp('scarfWrap', 'Scarf Wrap', 10),
        def('paddedHood', 'Padded Hood', 6),
        rule('longHaze', 'Long Haze', 'Smoke Pop lasts {n} s longer.', 'The smoke clears fast.', 'It lasts {n} s longer.', 1),
        rule('chokingSmoke', 'Choking Smoke', 'Reds in the smoke move {n}% slower.', 'Smoke only softens reds.', 'Reds slow {n}% in it.', 15),
        cap('blindingSmoke', 'Blinding Smoke', 'Green hits blind every foe: no reds for {n} s.', 'Foes see through the smoke.', 'Greens blind all for {n} s.', 0.6),
      ],
    },
  ],
  // part6:B
  // part6:C
  // part6:D
};
