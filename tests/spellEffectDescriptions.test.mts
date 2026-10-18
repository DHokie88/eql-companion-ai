import assert from 'node:assert/strict'
import { test } from 'node:test'
import { describeClientSpell } from '../src/shared/clientSpellDescriptions'
import { clientSpellEffectLabel } from '../src/shared/clientSpellParser'
import { spellRow, syntheticCatalog } from './spellLibrarySynthetic.mts'

test('slow details explain movement, attack percentage, duration, human target and casting range at the chosen level', () => {
  const row = spellRow(42, 'Synthetic Binding Song')
  row[4] = '120'; row[11] = '5'; row[12] = '2'; row[29] = '1'
  row[172] = '1|3|-10|0|102|0$2|11|90|0|101|50$3|10|0|0|100|0'
  const record = syntheticCatalog([row]).records[0]
  const before = JSON.stringify(record)
  const detail = describeClientSpell(record, 40)
  assert.match(detail.effects[0].text, /Slows movement by 50%/)
  assert.match(detail.effects[1].text, /Slows attacks by 30%.*70% of normal/)
  assert.match(detail.effects[1].text, /50% slow/)
  assert.equal(detail.effects[2].label, 'Charisma'); assert.equal(detail.effects[2].neutral, true)
  assert.equal(detail.duration, '12 seconds (2 ticks)')
  assert.equal(detail.target, 'single'); assert.equal(detail.resist, 'magic')
  assert.match(detail.range, /Casting range 120 game units/)
  assert.match(describeClientSpell(record, 20).effects[1].text, /Slows attacks by 20%/)
  assert.equal(JSON.stringify(record), before, 'presentation never changes captured data or history')
})

test('haste is a speed increase and unknown formulas keep descriptions without inventing values', () => {
  const row = spellRow(43, 'Synthetic Haste')
  row[172] = '1|11|110|0|100|125$2|3|-10|0|999|0$3|999|10|0|100|0'
  const detail = describeClientSpell(syntheticCatalog([row]).records[0], 30)
  assert.match(detail.effects[0].text, /Increases attack speed by 10%/)
  assert.match(detail.effects[1].text, /unsupported client formula/)
  assert.match(detail.effects[2].label, /Unknown client effect \(SPA 999\)/)
  assert.equal(clientSpellEffectLabel(3), 'Movement speed')
  assert.equal(clientSpellEffectLabel(79), 'Direct health change')
})

test('comparison differences distinguish unknown and zero references', async () => {
  const { spellDifference } = await import('../src/shared/spellAnalysisPresentation')
  assert.deepEqual(spellDifference(150, 100), { absolute: 50, percent: 50 })
  assert.deepEqual(spellDifference(25, 0), { absolute: 25, percent: null })
  assert.deepEqual(spellDifference(null, 100), { absolute: null, percent: null })
})
