import test from 'node:test'
import assert from 'node:assert/strict'
import { availableOwnedTier, recommendedGearTier, type GearOwnershipMap } from '../src/renderer/src/features/gear/gearOwnership'
import { upgradeStateForTier } from '../src/shared/itemUpgrade'
import { scaleGearRow } from '../src/shared/planner/gearScale'
import type { GearRow } from '../src/shared/planner/gear'
import { upgradesFor } from '../src/shared/build/optimizer'

test('upgrade candidates use the highest unequipped copy and never treat an exaltation as a copy', () => {
  const map: GearOwnershipMap = new Map([['breastplate', {
    facts: [{ place: 'equipped', tier: 10, count: 1 }, { place: 'keyring', tier: 6, count: 1 }, { place: 'bank', tier: 4, count: 1 }],
    exaltations: 1, owned: true, looted: true, lootedNotInDump: false
  }], ['higher', { facts: [{ place: 'keyring', tier: 8, count: 1 }], exaltations: 0, owned: true, looted: true, lootedNotInDump: false }],
  ['low', { facts: [{ place: 'bank', tier: 3, count: 1 }], exaltations: 0, owned: true, looted: true, lootedNotInDump: false }],
  ['gem-only', { facts: [], exaltations: 1, owned: false, looted: false, lootedNotInDump: false }]])
  assert.equal(availableOwnedTier(map, 'breastplate'), 6)
  assert.equal(availableOwnedTier(map, 'gem-only'), undefined)
  assert.equal(availableOwnedTier(null, 'breastplate'), undefined)
  assert.equal(recommendedGearTier(map, 'breastplate'), 6)
  assert.equal(recommendedGearTier(map, 'higher'), 8)
  assert.equal(recommendedGearTier(map, 'low'), 5)
  assert.equal(recommendedGearTier(map, 'unowned'), 5)
})

test('an owned +6 breastplate can beat a +5 candidate in the overall upgrade ranking', () => {
  const row = (name: string, AC: number): GearRow => ({ key: name, name, searchKey: name,
    slots: ['CHEST'], classes: [], races: ['ALL'], flags: [], quest: false, playerCrafted: false,
    stats: { AC }, effects: [] })
  const owned = scaleGearRow(row('owned', 26), upgradeStateForTier(6))
  const candidate = scaleGearRow(row('candidate', 25), upgradeStateForTier(5))
  const result = upgradesFor([candidate, owned], new Map([['ANY2', null]]), ['ANY2'], { classes: [], weights: { AC: 1 } })
  assert.equal(result[0].options[0].row.name, 'owned')
})
