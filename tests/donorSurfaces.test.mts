import assert from 'node:assert/strict'
import test from 'node:test'
import { slotLeaders } from '../src/renderer/src/features/build/slotPicks'
import { factionRows } from '../src/renderer/src/features/character/factionRows'
import { resizedColumnWidth } from '../src/renderer/src/features/gear/gearColumnWidths'
import { climbsFromLevels, nextAaPlan } from '../src/renderer/src/features/leveling/levelDonor'
import { knowledgeTags } from '../src/renderer/src/features/loot/lootChipTags'
import { examineNumbers, lootMaySend } from '../src/renderer/src/features/loot/lootSend'
import { picksFromRankings } from '../src/renderer/src/features/leveling/spellPicks'
import { nextRaceUnlock } from '../src/renderer/src/features/character/raceUnlocks'
import { coverageGaps, noteDraft } from '../src/renderer/src/features/community/coverageDraft'
import { startZones } from '../src/renderer/src/features/quests/questStart'
import { macroSend } from '../src/shared/worth'
import { classUnlockRows } from '../src/renderer/src/features/posky/classUnlocks'
import type { QuestProgress } from '../src/renderer/src/features/posky/useProgress'
import type { FactionSnap } from '../src/shared/factionTypes'
import type { GearRow } from '../src/shared/planner/gear'
import type { LevelingSnap } from '../src/shared/types'

test('the leveling log prices the next AA rank and a reincarnation climb', () => {
  const state: LevelingSnap = {
    levels: [{ ts: 1, level: 50 }, { ts: 10, level: 1 }, { ts: 40, level: 50 }],
    aaGains: [{ ts: 100, amount: 24, nowHave: 5 }],
    aaSpends: [{ ts: 90, ability: 'Mnemonic Retention 2', cost: 3, rank: 2 }],
    aaPotions: []
  }
  const plan = nextAaPlan(state, 100)
  assert.equal(plan?.ability, 'Mnemonic Retention')
  assert.equal(plan?.cost, 3)
  assert.equal(plan?.shortfall, 0)
  const climbs = climbsFromLevels(state.levels)
  assert.equal(climbs.length, 1)
  assert.equal(climbs[0]?.ms, 30)
})

test('class unlocks report the donor remaining count', () => {
  const quest = (name: string, turnIns: number): QuestProgress => ({
    key: `${name}:${String(turnIns)}`, className: 'Paladin', name, items: [], haveCount: 0, needCount: 1,
    ratio: 0, missing: [], turnIns
  })
  const rows = classUnlockRows([quest('a', 0), quest('b', 1)], [])
  assert.equal(rows.find((row) => row.className === 'Paladin')?.remaining, 1)
})

test('loot chips and faction rows use the donor tag and standing rules', () => {
  assert.deepEqual(knowledgeTags({ quest: true, tradeskill: true, noDrop: true }), ['quest', 'tradeskill', 'no drop'])
  const snap: FactionSnap = {
    v: 1,
    factions: { guards: { display: 'Guards', delta: 12, hits: 1, maxed: 0, bottomed: 0, firstTs: 1, lastTs: 2 } },
    recent: []
  }
  assert.equal(factionRows(snap)[0]?.delta, 12)
})

test('a gear column drag stays inside the track', () => {
  assert.equal(resizedColumnWidth(200, 16, 64), 216)
  assert.equal(resizedColumnWidth(200, -1000, 64), 64)
})

test('the build names the best item in a slot and a spare the classes have beaten', () => {
  const row = (name: string, end: number): GearRow => ({
    key: name.toLowerCase(), name, searchKey: name.toLowerCase(), slots: ['PRIMARY'], classes: ['WAR'], races: [],
    flags: [], quest: false, playerCrafted: false, stats: { END: end }, effects: []
  })
  const steel = row('Steel', 0)
  const iron = row('Iron', 10)
  const leaders = slotLeaders({
    rows: [steel, iron],
    scoreOf: (item) => item.name === 'Steel' ? 5 : 2,
    owned: () => true,
    classes: ['WAR'],
    worn: [iron, steel]
  })
  assert.equal(leaders.primary, 'Steel')
  assert.equal(leaders.valetPrimary, 'Steel')
  assert.equal(leaders.endurance, 10)
  assert.ok(leaders.spare.includes('Iron'))
})

test('spell ranks, races, coverage, quests, examine text, loot send, and macros use the donor rules', () => {
  const picks = picksFromRankings([
    { name: 'Bolt', total: 3, metric: 'damage' },
    { name: 'Pet Bolt', total: 9, metric: 'damage' },
    { name: 'Shield', total: 1, metric: 'heal' }
  ])
  assert.equal(picks.yours, 'Bolt')
  assert.equal(picks.pet, 'Pet Bolt')
  assert.equal(picks.next, 'Pet Bolt')
  assert.equal(picks.mote, 'Pet Bolt')
  assert.equal(nextRaceUnlock([{ id: 'human', label: 'Human' }, { id: 'iksar', label: 'Iksar' }], ['human']), 'Iksar')
  assert.equal(noteDraft('A bat', 'Drops a bone.', false).status, 'draft')
  assert.deepEqual(coverageGaps(['New Helm', 'Old Helm'], ['Old Helm']), ['New Helm'])
  assert.deepEqual(startZones([{ startZone: 'Crushbone', minLevel: 5 }, { startZone: 'Plane of Fear', minLevel: 50 }], 10), ['Crushbone'])
  assert.equal(examineNumbers('AC: 12\nSV Void: 3').AC, 12)
  assert.equal(lootMaySend(2, false).send, false)
  assert.equal(lootMaySend(2, true).send, true)
  assert.equal(macroSend('/pause', false).written, false)
  assert.equal(macroSend('/pause', true).written, true)
})
