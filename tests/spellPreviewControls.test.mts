import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultSpellModifierPreferences } from '../src/shared/spellModifiers'
import { selectSpellPreviewRank, toggleShowMine } from '../src/shared/spellPreviewControls'

test('changing group rank replaces every override and turns Show mine off without changing observations', () => {
  const before = { ...defaultSpellModifierPreferences(), mode: 'mine' as const, targets: 3,
    emulation: { rank: 9, ranks: { 659: { name: 'Example', rank: 2 } }, focus: 'selected' as const, focusIds: [9] } }
  const snapshot = JSON.stringify(before)
  const next = selectSpellPreviewRank(before, 5)
  assert.equal(next.mode, 'emulate')
  assert.equal(next.emulation.rank, 5)
  assert.deepEqual(next.emulation.ranks, {})
  assert.equal(next.emulation.focus, 'detected')
  assert.deepEqual(next.emulation.focusIds, [])
  assert.equal(next.targets, 3)
  assert.equal(JSON.stringify(before), snapshot)
  assert.deepEqual(toggleShowMine(toggleShowMine(before, true), false).emulation, before.emulation)
  assert.equal(toggleShowMine(next, true).mode, 'mine')
  assert.equal(toggleShowMine(toggleShowMine(next, true), false).emulation.rank, 5)
  assert.equal(selectSpellPreviewRank(before, 0).mode, 'client')
  for (const rank of [-1, 1.5, 11, NaN]) assert.throws(() => selectSpellPreviewRank(before, rank))
})
