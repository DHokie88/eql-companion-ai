import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { GearRow } from '../src/shared/planner/gear'
import { gearWeapons, sortGearRows, sortValue, weaponColumnText, WEAPON_GEAR_SORT } from '../src/renderer/src/features/gear/gearFilter'
import { ARMS, BOW, CLUB, CROWN, DAGGER, GREATSWORD, SLOPPY, THELVORN, row } from './gearFilterFixtures.mjs'

const names = (rows: readonly GearRow[]): string[] => rows.map((item) => item.name)

const MISSING_SKILL = row({ key: 'unknown blade', name: 'Unknown Blade', stats: { DMG: 20, DELAY: 10 } })
const MISSING_DELAY = row({ key: 'training blade', name: 'Training Blade', skill: '2H Piercing', stats: { DMG: 20 } })

test('weapon comparison uses known skills and ratio evidence, and leaves unavailable fields blank', () => {
  const weapons = gearWeapons([...ARMS, MISSING_SKILL, MISSING_DELAY])
  assert.deepEqual(names(weapons), names([...ARMS.slice(0, -1), MISSING_SKILL, MISSING_DELAY]))
  const ranked = sortGearRows(weapons, WEAPON_GEAR_SORT)
  assert.equal(ranked[0], MISSING_SKILL, 'the best known ratio ranks first even without a named skill')
  assert.equal(ranked.at(-1), MISSING_DELAY, 'a recognized weapon with no ratio stays visible at the end')
  assert.equal(weaponColumnText(MISSING_SKILL, 'WEAPON_TYPE'), '')
  assert.equal(weaponColumnText(MISSING_SKILL, 'HAND'), '')
  assert.equal(weaponColumnText(MISSING_DELAY, 'HAND'), 'Two-handed')
  assert.equal(sortValue(MISSING_DELAY, 'RATIO'), undefined)
})

test('weapon text columns share the filter vocabulary and sort labels with stable name ties', () => {
  assert.equal(weaponColumnText(DAGGER, 'WEAPON_TYPE'), '1H Piercing')
  assert.equal(weaponColumnText(SLOPPY, 'WEAPON_TYPE'), '1H Slashing')
  assert.equal(weaponColumnText(BOW, 'HAND'), 'Ranged')
  assert.equal(weaponColumnText(THELVORN, 'RATIO'), undefined)
  assert.equal(weaponColumnText(THELVORN, 'PROC'), 'Dismiss Summoned')
  assert.equal(weaponColumnText(CROWN, 'PROC'), '')
  const rows = [MISSING_SKILL, GREATSWORD, THELVORN, BOW, CLUB]
  assert.deepEqual(names(sortGearRows(rows, { key: 'HAND', dir: 'asc' })), names([THELVORN, CLUB, BOW, GREATSWORD, MISSING_SKILL]))
  assert.deepEqual(names(sortGearRows(rows, { key: 'HAND', dir: 'desc' })), names([GREATSWORD, BOW, THELVORN, CLUB, MISSING_SKILL]))
  assert.deepEqual(names(sortGearRows(rows, { key: 'WEAPON_TYPE', dir: 'asc' })), names([CLUB, THELVORN, GREATSWORD, BOW, MISSING_SKILL]))
  assert.deepEqual(names(sortGearRows(rows, { key: 'WEAPON_TYPE', dir: 'desc' })), names([BOW, GREATSWORD, THELVORN, CLUB, MISSING_SKILL]))
})
