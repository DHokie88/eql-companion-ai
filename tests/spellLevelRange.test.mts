import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LEVEL_MAX } from '../src/renderer/src/features/leveling/viewedLevel'
import { automaticBrowseMax, browseLevelCaption, commitBrowseLevel, stepBrowseLevel } from '../src/renderer/src/features/spells/spellLevelRange'

test('automatic Max uses the latest /who, then the stated level, and never treats a gap as 0', () => {
  assert.deepEqual(automaticBrowseMax(60, 12), { level: 60, source: 'who' })
  assert.deepEqual(automaticBrowseMax(undefined, 48), { level: 48, source: 'stated' })
  assert.deepEqual(automaticBrowseMax(0, null), { level: LEVEL_MAX, source: 'fallback' })
  assert.deepEqual(automaticBrowseMax(255, 70), { level: LEVEL_MAX, source: 'fallback' })
  assert.equal(LEVEL_MAX, 65)
  assert.match(browseLevelCaption('who', 60), /\/who · 60/)
  assert.match(browseLevelCaption('fallback', 65), /No known character level/)
})

test('browse level edits clamp, reject inversion, and keep whole numbers', () => {
  assert.equal(stepBrowseLevel(0, -1, 65, 'min'), 0)
  assert.equal(stepBrowseLevel(65, 1, 0, 'max'), 65)
  assert.equal(stepBrowseLevel(25, 1, 25, 'min'), 25)
  assert.equal(stepBrowseLevel(10, 1, 25, 'min'), 11)
  assert.deepEqual(commitBrowseLevel('70', 0, 'max'), { ok: true, value: 65 })
  assert.deepEqual(commitBrowseLevel('26', 25, 'min'), { ok: false, error: 'Minimum spell level must not exceed maximum spell level.' })
  assert.deepEqual(commitBrowseLevel('1.5', 65, 'max'), { ok: false, error: 'Enter a whole spell level.' })
  assert.deepEqual(commitBrowseLevel('0', 65, 'min'), { ok: true, value: 0 })
})
