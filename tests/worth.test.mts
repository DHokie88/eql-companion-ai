import test from 'node:test'
import assert from 'node:assert/strict'
import { zoneShortName } from '../src/shared/zones'
import { scaleAccuracy, voidAtTier } from '../src/shared/itemUpgrade'
import { parseQuestPage, extractSteps } from '../scripts/sources/questPage'
import { sortLootRows } from '../src/renderer/src/features/loot/lootSort'
import {
  aaPlan,
  canMakeRecipe,
  crawlMarks,
  enduranceScore,
  exaltAudit,
  factionStandings,
  followLoggedLoc,
  gearProgression,
  hangPoint,
  lootTags,
  lootUpload,
  macroSend,
  nextMote,
  ownTimeDps,
  parseExamine,
  petValetPicks,
  pickSpellTable,
  plannedSetAllows,
  procScore,
  procsPerMinute,
  raceUnlockOrder,
  readArchivedHistory,
  reincarnationClimbs,
  respawnAlertAt,
  resizeFraction,
  routeTo,
  searchAchievements,
  searchArchivedFights,
  skillRows,
  spareNames,
  spellLoadout,
  unlockProgress,
  bestInSlot,
  valetPicks,
  voidMoteRank,
  wikiContribution,
  wikiGaps
} from '../src/shared/worth'

test('AA planner prices the ranks still to buy and the hours at the last-24h pace', () => {
  const plan = aaPlan({
    catalog: [{ id: 'bash', name: 'Bash', maxRank: 5, costPerRank: 3 }],
    held: { bash: 1 },
    targets: { bash: 4 },
    unspent: 2,
    pointsLast24h: 24
  })
  assert.equal(plan.cost, 9)
  assert.equal(plan.shortfall, 7)
  assert.equal(plan.etaHours, 7)
})

test('race unlocks put the smallest remaining gap first', () => {
  const order = raceUnlockOrder([
    { race: 'Elf', have: 0, need: 4, factions: [] },
    { race: 'Dwarf', have: 3, need: 4, factions: [{ name: 'Kaladim', fastest: 'turn-ins' }] }
  ])
  assert.deepEqual(order.map((row) => row.race), ['Dwarf', 'Elf'])
})

test('reincarnation climb is the time from the event until level 50', () => {
  const climbs = reincarnationClimbs([
    { kind: 'level', ts: 10, level: 49 },
    { kind: 'reincarnation', ts: 100 },
    { kind: 'level', ts: 250, level: 50 }
  ])
  assert.equal(climbs.length, 1)
  assert.equal(climbs[0].ms, 150)
})

test('proc score uses the 2 ppm model and endurance counts only when the class spends it', () => {
  assert.equal(procsPerMinute(0), 2)
  assert.equal(procScore(60, 0, 1), 0.2)
  assert.equal(procScore(60, 0, 0), 0)
  assert.equal(enduranceScore(15, true), 15)
  assert.equal(enduranceScore(15, false), 0)
  assert.equal(plannedSetAllows(true), false)
  assert.equal(plannedSetAllows(false), true)
})

test('own-time DPS is damage over the row clock, and a lead alert fires before the due time', () => {
  assert.equal(ownTimeDps(80, 4), 20)
  assert.equal(ownTimeDps(80, 0), 0)
  assert.equal(respawnAlertAt(60_000, 15), 45_000)
})

test('combat split stays inside the track', () => {
  assert.equal(resizeFraction(0.5, 10_000, 100, 10), 0.9)
  assert.ok(resizeFraction(0.5, -10_000, 100, 10) >= 0.1)
})

test('Nektropos Castle, Lake Nerius, and the Undercrofts resolve', () => {
  assert.equal(zoneShortName('Nektropos Castle'), 'nektropos')
  assert.equal(zoneShortName('Castle Nektropos'), 'nektropos')
  assert.equal(zoneShortName('Lake Nerius'), 'lakenerius')
  assert.equal(zoneShortName('Nektropos Undercrofts'), 'nektrunder')
})

test('valet, spare, pet valet, and exalt sockets answer the owned-item questions', () => {
  const items = [
    { name: 'Rust', slot: 'Primary', score: 1, classes: ['WAR'], owned: true },
    { name: 'Steel', slot: 'Primary', score: 4, classes: ['WAR'], owned: true },
    { name: 'Summoned', slot: 'Primary', score: 9, classes: ['MAG'], temporary: true, owned: true }
  ]
  const player = valetPicks(items)
  assert.equal(player.get('Primary')?.name, 'Steel')
  assert.equal(bestInSlot(items).get('Primary')?.name, 'Steel')
  assert.deepEqual(spareNames(items), ['Rust'])
  assert.equal(petValetPicks(items, player).get('Primary')?.name, 'Rust')
  assert.deepEqual(exaltAudit([{ slot: 'Head', stone: null, wants: ['Focus'] }, { slot: 'Chest', stone: 'Other', wants: ['Focus'] }]), {
    empty: ['Head'],
    mismatched: ['Chest']
  })
})

test('void motes rank gain times hours, and progression follows level and role', () => {
  const ranked = voidMoteRank([
    { name: 'Low', gain: 1, hoursToReplace: 2 },
    { name: 'High', gain: 3, hoursToReplace: 2 }
  ])
  assert.deepEqual(ranked.map((row) => row.name), ['High', 'Low'])
  assert.equal(ranked[0].score, 6)
  assert.deepEqual(gearProgression([
    { name: 'Crushbone', minLevel: 5, maxLevel: 12, role: 'dps' },
    { name: 'Permafrost', minLevel: 20, maxLevel: 35, role: 'dps' }
  ], 8, 'dps'), ['Crushbone'])
})

test('spell loadout separates the pet, and the next mote is the largest gain', () => {
  const loadout = spellLoadout([
    { name: 'Small', stat: 'hp', amount: 10, pet: false },
    { name: 'Large', stat: 'hp', amount: 40, pet: false },
    { name: 'Pet', stat: 'hp', amount: 5, pet: true }
  ], 'hp')
  assert.deepEqual(loadout, { yours: 'Large', pet: 'Pet' })
  assert.equal(nextMote([{ name: 'Bolt', moteGain: 2 }, { name: 'Shield', moteGain: 9 }]), 'Shield')
})

test('gaps, achievements, unlocks, skills, factions, tags, and recipes', () => {
  assert.deepEqual(wikiGaps(['New'], ['Old']), ['New'])
  assert.equal(searchAchievements([{ group: 'Hunt', name: 'Orc' }], 'orc')[0]?.name, 'Orc')
  assert.equal(searchAchievements([{ group: 'Hunt', name: 'Orc' }], '   ').length, 1)
  assert.equal(unlockProgress([{ family: 'class', label: 'Wizard', have: 2, need: 5 }])[0]?.remaining, 3)
  assert.deepEqual(skillRows([
    { skill: 'Baking', level: 10, ts: 1 },
    { skill: 'Baking', level: 14, ts: 2 }
  ]), [{ skill: 'Baking', level: 14, raises: 2 }])
  assert.equal(factionStandings([{ name: 'Guards', base: 10, adjusted: 40 }])[0]?.delta, 30)
  assert.deepEqual(lootTags({ tradeskill: true, quest: false, noDrop: true }), ['Tradeskill', 'No Drop'])
  assert.equal(canMakeRecipe({ skill: 'Baking', trivial: 50 }, { Baking: 40 }, true), false)
  assert.equal(canMakeRecipe({ skill: 'Baking', trivial: 40 }, { Baking: 40 }, true), true)
})

test('macros and loot upload wait for an explicit yes', () => {
  assert.deepEqual(macroSend('/pause', false), { written: false, body: '/pause' })
  assert.equal(macroSend('/pause', true).written, true)
  assert.equal(lootUpload(3, false).send, false)
  assert.equal(lootUpload(3, true).send, true)
})

test('map follow, route, crawl, examine text, and wiki draft', () => {
  const loc = followLoggedLoc([{ x: 0, y: 0, z: 1 }, { x: 10, y: 0, z: 2 }])
  assert.equal(loc?.x, 10)
  assert.equal(loc?.headingDeg, 0)
  assert.equal(routeTo({ x: 0, y: 0 }, { x: 2, y: 0 }, () => false)?.length, 2)
  assert.equal(routeTo({ x: 0, y: 0 }, { x: 2, y: 0 }, (x) => x === 1), null)
  assert.equal(routeTo({ x: 0, y: 0 }, { x: 4, y: 0 }, (x) => x === 1), null)
  assert.equal(crawlMarks(['a bat', 'a rat'], ['A Bat'])[0]?.cleared, true)
  assert.equal(parseExamine('AC: 12\nSV Void: 3').AC, 12)
  assert.equal(wikiContribution({ title: 'A bat', fact: 'Drops a bone.', confirmed: false }).status, 'draft')
  assert.equal(wikiContribution({ title: 'A bat', fact: 'Drops a bone.', confirmed: true }).status, 'ready')
})

test('archived search reads sealed fights and does not rename the live log', () => {
  const hits = searchArchivedFights([
    { id: 'a', name: 'a bat', zone: 'qeynos', startTs: 1 },
    { id: 'b', name: 'a bat', zone: 'qeynos', startTs: 9 }
  ], 'bat')
  assert.equal(hits[0]?.id, 'b')
  assert.deepEqual(searchArchivedFights(hits, '  '), [])
  const read = readArchivedHistory({ count: 4 }, [{ count: 1 }, { count: 1 }], true, 'eqlog_Zarzac.txt')
  assert.equal(read.value.count, 6)
  assert.equal(read.logName, 'eqlog_Zarzac.txt')
  const off = readArchivedHistory({ count: 4 }, [{ count: 1 }], false, 'eqlog_Zarzac.txt')
  assert.equal(off.value.count, 4)
  assert.equal(off.logName, 'eqlog_Zarzac.txt')
})

test('Luclin hair hangs on the actor HAIR_POINT bone, not a suffix match', () => {
  assert.equal(hangPoint('HUM_ACTORDEF', 'HAIR_POINT'), 'HUMHAIR_POINT_DAG')
  assert.equal(hangPoint('HUM', 'HEAD_POINT'), 'HUMHEAD_POINT_DAG')
})

test('listed Void scales and a missing base uses the rank line; generated accuracy does not move', () => {
  const listed = voidAtTier(4, { full: 2, fraction: 0 }, true)
  const ranked = voidAtTier(undefined, { full: 2, fraction: 0 }, true)
  assert.equal(listed, 6)
  assert.equal(ranked, 2)
  assert.equal(voidAtTier(undefined, { full: 2, fraction: 0 }, false), undefined)
  const explicit = scaleAccuracy(10, { full: 2, fraction: 0 }, 'explicit')
  assert.ok(explicit > 10)
  assert.equal(scaleAccuracy(10, { full: 2, fraction: 0 }, 'generated'), 10)
})

test('spell files prefer spells_us.txt and otherwise take the first other suffix', () => {
  assert.equal(pickSpellTable(['spells_de.txt', 'spells_us.txt', 'spells_fr_str.txt']), 'spells_us.txt')
  assert.equal(pickSpellTable(['spells_fr.txt', 'notes.txt', 'spells_de_str.txt', 'spells_de.txt']), 'spells_de.txt')
  assert.equal(pickSpellTable(['readme.txt']), null)
})

test('quest pages read a level-1 heading, a Summary checklist, and Starts In', () => {
  const page = [
    "! '''Starts In:''' [[East Freeport]]",
    '= Talk to the guard =',
    '== Summary ==',
    '* Hail the guard',
    '* Hand in the note'
  ].join('\n')
  const steps = extractSteps(page)
  assert.ok(steps.some((step) => step.includes('Hail the guard')))
  const level1 = extractSteps('= Talk to the guard =\nHail them in East Freeport.\n')
  assert.ok(level1.some((step) => step.includes('Talk to the guard') || step.includes('Hail them')))
  const parsed = parseQuestPage('A small errand', page)
  assert.equal(parsed.startsIn, 'East Freeport')
})

test('loot column sort orders by the clicked column', () => {
  const rows = [
    { item: 'Zed', count: 1, last: 5 },
    { item: 'Ada', count: 9, last: 1 }
  ]
  assert.equal(sortLootRows(rows, 'item')[0]?.item, 'Ada')
  assert.equal(sortLootRows(rows, 'count')[0]?.item, 'Ada')
  assert.equal(sortLootRows(rows, 'recent')[0]?.item, 'Zed')
})
