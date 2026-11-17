import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gearOwnershipOf, isOwned, ownedUpgradeState, type GearOwnershipMap } from '../src/renderer/src/features/gear/gearOwnership'
import { DEFAULT_GEAR_FILTERS, filterGearRows, scaleAll, sortGearRows } from '../src/renderer/src/features/gear/gearFilter'
import type { GearRow } from '../src/shared/planner/gear'

const row: GearRow = { key: 'sword', name: 'Sword', searchKey: 'sword', slots: ['PRIMARY'], classes: [], races: [], flags: [], quest: false, playerCrafted: false, effects: [], stats: { DMG: 20, DELAY: 25 } }
const facts = { facts: [{ place: 'equipped' as const, tier: 2, count: 1 }, { place: 'bank' as const, tier: 5, count: 1 }], exaltations: 0, owned: true, looted: true, lootedNotInDump: false }
const map: GearOwnershipMap = new Map([['sword', facts], ['looted', gearOwnershipOf([], true)]])

test('owned tier uses the highest wearable copy and cannot infer partial progress', () => {
  assert.deepEqual(ownedUpgradeState(map, row), { full: 5, fraction: 0 })
  assert.equal(ownedUpgradeState(map, { key: 'looted' }), null)
  assert.equal(isOwned(map, { key: 'looted' }), false)
  assert.equal(isOwned(map, row), true)
  const exaltationOnly = new Map([['gem', { ...facts, facts: [], owned: false, exaltations: 1 }]])
  assert.equal(isOwned(exaltationOnly, { key: 'gem' }), false)
  assert.equal(ownedUpgradeState(null, row), null)
  assert.deepEqual(ownedUpgradeState(new Map([['sword', { ...facts, facts: [{ place: 'bank', count: 1 }] }]]), row), { full: 0, fraction: 0 })
})

test('per-item tiers change the actual table numbers and do not mutate base rows', () => {
  const other = { ...row, key: 'other' }
  const simulation = { full: 2, fraction: 0 }
  const scaled = scaleAll([row, other], simulation, (r) => ownedUpgradeState(map, r) ?? simulation)
  assert.ok(scaled[0].stats.DMG! > scaled[1].stats.DMG!)
  assert.equal(row.stats.DMG, 20)
  assert.equal(sortGearRows([...scaled].reverse(), { key: 'DMG', dir: 'desc' })[0].key, 'sword')
  assert.deepEqual(filterGearRows([row, other], { ...DEFAULT_GEAR_FILTERS, ownedOnly: true }, { isOwned: (r) => isOwned(map, r) }).map((r) => r.key), ['sword'])
})
