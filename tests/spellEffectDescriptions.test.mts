import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clientSpellDescription, describeClientSpell } from '../src/shared/clientSpellDescriptions'
import { clientSpellEffectLabel } from '../src/shared/clientSpellParser'
import { spellRow, syntheticCatalog } from './spellLibrarySynthetic.mts'
import { spellFields, spellBundle } from './fixtures/spell-library/synthetic'
import { parseClientSpellBundle } from '../src/shared/clientSpellParser'

test('maximum-target tokens use captured caps in both layouts without rewriting source descriptions', () => {
  for (const layout of [173, 174] as const) {
    const sources = spellBundle([spellFields(101, 'Synthetic Area Song', layout).join('^')])
    sources['dbstr_us.txt'] = '900^6^Binds up to %T nearby enemies; affects %T targets.\n'
    const record = parseClientSpellBundle(sources)[0], before = JSON.stringify(record)
    assert.equal(describeClientSpell(record, 50).description, 'Binds up to 8 nearby enemies; affects 8 targets.')
    assert.equal(JSON.stringify(record), before)
    assert.match(record.description, /%T/); assert.match(record.rawDescription, /%T/)
  }
})

test('unknown target caps stay explicit, and unrelated description tokens remain untouched', () => {
  // The parser preserves unresolved tokens; display must never invent a finite cap.
  const spell = syntheticCatalog([spellRow()], 'Binds up to %T nearby enemies. %Q %Target').records[0]
  for (const cap of [0, -1, 2.5, null, Number.NaN]) {
    assert.equal(clientSpellDescription({ ...spell, fields: { ...spell.fields, aeMaxTargets: cap } }), 'Binds up to an unspecified number of nearby enemies. %Q %Target')
  }
})

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

test('SPA 98 explains supplemental haste and its ordinary cap for arbitrary spell identities', () => {
  const row = spellRow(182, 'Synthetic Tempo'); row[172] = '1|98|105|0|100|105'
  const record = syntheticCatalog([row]).records[0], before = JSON.stringify(record)
  const effect = describeClientSpell(record, 50).effects[0]
  assert.equal(effect.label, 'Supplemental spell haste (type II)')
  assert.match(effect.text, /Adds 5 percentage points/)
  assert.match(effect.text, /within the normal total-haste cap; adds no speed once that cap is reached/)
  assert.match(effect.text, /strongest source.*instruments do not multiply/)
  assert.match(effect.text, /EQL's exact cap.*require server verification/)
  assert.equal(JSON.stringify(record), before)
  record.effects[0].base = 110; record.effects[0].max = 110
  assert.match(describeClientSpell(record, 50).effects[0].text, /Adds 10 percentage points/)
})

test('SPA 119 uses a direct bonus, while zero, slow and unsupported haste formulas stay distinct', () => {
  const row = spellRow(183, 'Synthetic Speed Effects')
  row[172] = '1|119|25|0|100|25$2|98|100|0|100|100$3|98|90|0|100|90$4|119|-15|0|100|-15$5|98|105|0|999|105'
  const effects = describeClientSpell(syntheticCatalog([row]).records[0], 50).effects
  assert.equal(effects[0].label, 'Overhaste (type III)')
  assert.match(effects[0].text, /Adds 25 percentage points.*after the ordinary total-haste cap.*separate overhaste cap/)
  assert.match(effects[1].text, /No attack-speed change/)
  assert.match(effects[2].text, /Reduces attack speed by 10 percentage points/)
  assert.match(effects[3].text, /Reduces attack speed by 15 percentage points/)
  assert.match(effects[4].text, /unsupported client formula; no estimate is assumed/)
})

test('comparison differences distinguish unknown and zero references', async () => {
  const { spellDifference } = await import('../src/shared/spellAnalysisPresentation')
  assert.deepEqual(spellDifference(150, 100), { absolute: 50, percent: 50 })
  assert.deepEqual(spellDifference(25, 0), { absolute: 25, percent: null })
  assert.deepEqual(spellDifference(null, 100), { absolute: null, percent: null })
})
