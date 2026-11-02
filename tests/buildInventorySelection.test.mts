import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { selectBuildInventory } from '../src/renderer/src/features/build/selectBuildInventory'
import type { CharacterLoadout } from '../src/shared/loadouts'
import type { PlannerInventory } from '../src/shared/planner/inventorySlots'

const live: PlannerInventory = { path: 'current', loadedAt: '2026-11-02T02:13:09Z', hosts: [] }
const saved: PlannerInventory = { path: 'saved', loadedAt: '2026-10-01T00:00:00Z', hosts: [] }
const loadout = { id: 'lo1', classes: ['PAL'], capture: { classes: ['PAL'], inventory: saved } } as CharacterLoadout

test('following live uses the latest inventory even when the matching loadout has a saved snapshot', () => {
  assert.equal(selectBuildInventory(loadout, true, 'lo1', live), live)
})

test('a pinned loadout keeps its compatible saved equipment and does not borrow a different class mix', () => {
  assert.equal(selectBuildInventory(loadout, false, 'lo1', live), saved)
  const unsaved = { ...loadout, capture: undefined }
  assert.equal(selectBuildInventory(unsaved, false, 'lo2', live), null)
  assert.equal(selectBuildInventory(unsaved, false, 'lo1', live), live)
})

test('following live reports a missing current export even if an old capture exists', () => {
  assert.equal(selectBuildInventory(loadout, true, 'lo1', null), null)
})
