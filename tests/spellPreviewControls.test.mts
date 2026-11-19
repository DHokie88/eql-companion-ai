import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultSpellModifierPreferences } from '../src/shared/spellModifiers'
import { selectSpellPreviewRank, toggleShowMine } from '../src/shared/spellPreviewControls'

test('the rank slider and Use my ranks keep per-spell overrides and focus', () => {
  const before = { ...defaultSpellModifierPreferences(), mode: 'mine' as const, targets: 3,
    emulation: { rank: 9, ranks: { 659: { name: 'Example', rank: 2 } }, focus: 'selected' as const, focusIds: [9] } }
  const snapshot = JSON.stringify(before)
  const next = selectSpellPreviewRank(before, 5)
  assert.equal(next.mode, 'emulate')
  assert.equal(next.emulation.rank, 5)
  assert.equal(next.browse?.rank, 5)
  assert.deepEqual(next.emulation.ranks, before.emulation.ranks)
  assert.equal(next.emulation.focus, 'selected')
  assert.deepEqual(next.emulation.focusIds, [9])
  assert.equal(next.targets, 3)
  assert.equal(JSON.stringify(before), snapshot)
  const mine = toggleShowMine(next, true)
  assert.equal(mine.mode, 'mine')
  assert.equal(mine.browse?.useMyRanks, true)
  assert.deepEqual(mine.emulation.ranks, before.emulation.ranks)
  const off = toggleShowMine(mine, false)
  assert.equal(off.browse?.useMyRanks, false)
  assert.deepEqual(off.emulation, mine.emulation)
  const base = selectSpellPreviewRank(before, 0)
  assert.equal(base.mode, 'client')
  assert.equal(base.emulation.rank, 0)
  assert.equal(base.browse?.rank, undefined)
  assert.deepEqual(base.emulation.ranks, before.emulation.ranks)
  assert.equal(base.emulation.focus, 'selected')
  for (const rank of [-1, 1.5, 11, NaN]) assert.throws(() => selectSpellPreviewRank(before, rank))
})
