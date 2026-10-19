import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluateModifiedSpell, SpellModifierCatalog } from '../src/shared/clientSpellModifiers'
import { defaultSpellModifierPreferences, type SpellModifierContext } from '../src/shared/spellModifiers'
import { spellRow, syntheticCatalog } from './spellLibrarySynthetic.mts'
import { spellPreviewTargets } from '../src/shared/spellAnalysis'

test('rank 0-X uses separate direct, tick and duration rules without equipment', () => {
  const direct = spellRow(1, 'Test direct', 20, 100)
  const hybrid = spellRow(2, 'Test hybrid'); hybrid[11] = '7'; hybrid[12] = '10'
  hybrid[172] = '1|79|-40|0|100|0$2|0|-100|0|100|0'
  const records = syntheticCatalog([direct, hybrid]).records
  const catalog = new SpellModifierCatalog(records)
  const totals = [1040, 1175, 1210, 1355, 1393, 1547, 1588, 1750, 1795, 1966, 2014]
  for (let rank = 0; rank <= 10; rank++) {
    const preferences = defaultSpellModifierPreferences()
    preferences.mode = 'emulate'; preferences.emulation.rank = rank; preferences.emulation.focus = 'none'
    const context: SpellModifierContext = { revision: 'test', modelVersion: '6', character: null, preferences,
      ranks: {}, inventory: { state: 'ready', exportedAt: null, candidates: [], warnings: [] }, warnings: [] }
    const options = { context, rankOnly: true, level: 10, classes: ['WIZ'] as const, metric: 'damage' as const }
    const input = { ...options, classes: [...options.classes] }
    assert.equal(evaluateModifiedSpell(records[0], input, catalog).total, 100 + 6 * rank)
    const dot = evaluateModifiedSpell(records[1], input, catalog)
    assert.equal(dot.perTick, 100 + 3 * rank)
    assert.equal(dot.total, totals[rank], `hybrid total at rank ${rank}`)
    assert.equal(dot.modifiers?.focus, null)
  }
})
test('old maximum and oversized target preferences become eight-enemy preview scenarios', () => {
  assert.deepEqual([undefined, 'maximum', 100, 8, 4, 1].map((n) => spellPreviewTargets(n as number | 'maximum' | undefined)), [4, 8, 8, 8, 4, 1])
})
