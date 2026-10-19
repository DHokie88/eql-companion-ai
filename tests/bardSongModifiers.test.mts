import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SpellModifierCatalog, evaluateModifiedSpell } from '../src/shared/clientSpellModifiers'
import { calculateClientSpell } from '../src/shared/clientSpellCalculations'
import { bardSongPresentation } from '../src/shared/bardSongPresentation'
import { describeClientSpell } from '../src/shared/clientSpellDescriptions'
import { analyzeClientSpell, SpellMechanicsCatalog } from '../src/shared/clientSpellAnalysis'
import { bardEffectImpact, bardSongFamily } from '../src/shared/bardSongRules'
import { parseClientSpellBundle } from '../src/shared/clientSpellParser'
import { spellBundle, spellFields } from './fixtures/spell-library/synthetic'
import { effect, modifierContext, modifierSpell } from './helpers/spellModifierFixtures.mts'
import type { BardInstrumentSource } from '../src/shared/bardInstruments'

function song(overrides = {}) {
  const record = modifierSpell({ classes: [{ code: 'BRD', level: 1 }], fields: { skill: 49 }, effects: [effect(0, 9)], beneficial: true, durationFormula: 5, durationCap: 2, ...overrides })
  return { ...record, effects: record.effects.map((entry, i) => ({ ...entry, slot: i + 1 })) }
}
function resonance(id = 800, skill = 49, pct = 140, changes = {}) {
  const record = modifierSpell({ id, name: `Synthetic Resonance ${id}`, classes: [], fields: {}, effects: [effect(413, pct), effect(411, 256), effect(414, skill)], ...changes })
  return { ...record, effects: record.effects.map((entry, i) => ({ ...entry, slot: i + 1 })) }
}
function source(definition, equipped = true, changes = {}): BardInstrumentSource {
  return { effect: definition.name, item: `Instrument ${definition.id}`, location: equipped ? 'Secondary' : 'General 1-Slot1', basis: 'focus effect', equipped, ...changes }
}
function context(sources: BardInstrumentSource[] = []) {
  const value = modifierContext()
  value.preferences.mode = 'mine'; value.inventory.instruments = { sources, warnings: [] }
  value.ranks = { [song().name.toLowerCase()]: { name: song().name, rank: 1 } }
  return value
}
function resolve(record, inputs, definitions = []) { return new SpellModifierCatalog([record, ...definitions]).instruments.resolve(record, inputs, 50) }

test('numeric 140-percent base-effect resonance is 2.4x, not 1.4x or an inferred focus rank', () => {
  const record = song(), focus = resonance(), inputs = context([source(focus)])
  const catalog = new SpellModifierCatalog([record, focus])
  const result = evaluateModifiedSpell(record, { level: 50, metric: 'healing', classes: ['BRD'], context: inputs }, catalog)
  assert.equal(result.modifiers?.instrument?.bestMultiplier, 2.4)
  assert.equal(result.perTick, 21); assert.equal(result.total, 42)
  assert.equal(result.modifiers?.baseline.total, 18)
  assert.equal(result.modifiers?.equippedInstrument?.total, 42)
  assert.equal(result.modifiers?.partial, true); assert.match(result.modifiers!.warnings.join(' '), /AA.*server.*caps/)
})

test('best carried is one strongest alternative; equipped result remains separate and required swaps are explicit', () => {
  const record = song(), worn = resonance(800, 49, 110), bag = resonance(801, 49, 140), wrongSkill = resonance(802, 70, 300)
  const inputs = context([source(worn), source(bag, false), source(wrongSkill, false)])
  const result = resolve(record, inputs, [worn, bag, wrongSkill])!
  assert.equal(result.equippedMultiplier, 2.1); assert.equal(result.bestMultiplier, 2.4)
  assert.equal(result.bestCarried?.effectId, 801); assert.equal(result.bestCarried?.requiresEquip, true)
  const catalog = new SpellModifierCatalog([record, worn, bag])
  const calculated = evaluateModifiedSpell(record, { level: 50, metric: 'healing', classes: ['BRD'], context: inputs }, catalog)
  assert.equal(calculated.modifiers?.equippedInstrument?.total, 36); assert.equal(calculated.total, 42)
})

test('Singing songs do not borrow percussion/string bonuses; a matching singing modifier is separate', () => {
  const record = song({ fields: { skill: 41 } }), drum = resonance(800, 70), lute = resonance(801, 49), singing = resonance(802, 41, 50)
  const inputs = context([source(drum), source(lute)])
  assert.equal(resolve(record, inputs, [drum, lute])?.bestMultiplier, 1)
  inputs.inventory.instruments!.sources.push(source(singing))
  assert.equal(resolve(record, inputs, [drum, lute, singing])?.bestMultiplier, 1.5)
})

test('per-effect explanations scale movement/stat/HP while slow/haste and periodic mana remain unchanged', () => {
  const record = song({ fields: { skill: 41 }, effects: [effect(3, -20), effect(11, 80), effect(4, 10), effect(15, 3)] })
  const focus = resonance(800, 41, 140), inputs = context([source(focus)])
  const result = bardSongPresentation(record, describeClientSpell(record, 50), resolve(record, inputs, [focus])!)
  assert.match(result.effects[0].bestCarried!, /48%/)
  assert.match(result.effects[1].bestCarried!, /Slows attacks by 20%/)
  assert.equal(result.effects[1].impact, 'unchanged')
  assert.match(result.effects[2].bestCarried!, /24/)
  assert.equal(result.effects[3].equipped, result.effects[3].client)
  assert.equal(bardEffectImpact(effect(15, 3), song({ durationFormula: 0 })), 'scales')
})

test('unknown formulas, unknown effects, excessive raw snare and missing caps never become confident final values', () => {
  const record = song({ effects: [effect(3, -80), effect(999, 3), { ...effect(4, 2), calc: 999 }] })
  const focus = resonance(), inputs = context([source(focus)])
  const result = bardSongPresentation(record, describeClientSpell(record, 50), resolve(record, inputs, [focus])!)
  assert.match(result.effects[0].bestCarried!, /effective reduction is unavailable.*server cap/)
  assert.equal(result.effects[1].bestCarried, null); assert.equal(result.effects[1].impact, 'unsupported')
  assert.equal(result.effects[2].bestCarried, null)
  const hpUnknown = song({ effects: [{ ...effect(0, 9), calc: 999 }] })
  assert.equal(evaluateModifiedSpell(hpUnknown, { level: 50, metric: 'healing', classes: ['BRD'], context: inputs }, new SpellModifierCatalog([hpUnknown, focus])).total, null)
})

test('duplicate names including internal records and stale/unsupported definitions never lend another numeric ID their bonus', () => {
  const record = song(), focus = resonance(), duplicate = resonance(801, 70, 100, { name: focus.name })
  const inputs = context([source(focus)])
  const ambiguous = resolve(record, inputs, [focus, duplicate])!
  assert.equal(ambiguous.bestMultiplier, 1); assert.match(ambiguous.warnings.join(' '), /multiple client IDs/)
  const limited = resonance(800, 49, 140, { effects: [effect(413, 140), effect(135, 1)] })
  assert.equal(resolve(record, inputs, [limited])?.bestMultiplier, 1)
  assert.match(resolve(record, inputs, [limited])!.warnings.join(' '), /Unsupported.*limits/)
})

test('spell skill, class mask, item required level and missing numeric definitions constrain qualification', () => {
  const record = song(), focus = resonance(), inputs = context([source(focus, true, { requiredLevel: 60 })])
  assert.equal(resolve(record, inputs, [focus])?.bestMultiplier, 1)
  inputs.inventory.instruments!.sources = [source(focus)]
  const wrongClass = resonance(800, 49, 140, { effects: [effect(413, 140), effect(411, 128), effect(414, 49)] })
  assert.equal(resolve(record, inputs, [wrongClass])?.bestMultiplier, 1)
  const conflicting = resonance(800, 49, 140, { effects: [effect(413, 140), effect(411, 256), effect(411, 128), effect(414, 49)] })
  assert.equal(resolve(record, inputs, [conflicting])?.bestMultiplier, 1)
  for (const unsupportedPct of [Number.NaN, 115, 2.5]) {
    assert.equal(resolve(record, inputs, [resonance(800, 49, unsupportedPct)])?.bestMultiplier, 1)
  }
  inputs.inventory.instruments!.sources = [source(focus, true, { effect: 'String Resonance 14', basis: 'resonance stat' })]
  assert.match(resolve(record, inputs, [])!.warnings.join(' '), /absent from this snapshot/)
})

test('client mode stays byte-identical and missing inventory differs from known no qualifying Singing gear', () => {
  const record = song(), focus = resonance(), inputs = context([source(focus)])
  inputs.preferences.mode = 'client'
  assert.deepEqual(evaluateModifiedSpell(record, { level: 50, metric: 'healing', classes: ['BRD'], context: inputs }, new SpellModifierCatalog([record, focus])), calculateClientSpell(record, 50, 'healing'))
  const missing = context(); missing.inventory.state = 'missing'; delete missing.inventory.instruments
  assert.match(resolve(record, missing)!.warnings.join(' '), /coverage is unknown/)
  assert.doesNotMatch(resolve(record, context())!.warnings.join(' '), /coverage is unknown/)
})

test('both captured layouts reject every nonzero, absent or malformed discipline flag without changing history fields', () => {
  for (const layout of [173, 174] as const) {
    const row = spellFields(1, 'Synthetic Singing Record', layout), index = layout === 174 ? 99 : 98
    row[47] = '255'; row[43] = '1'; row[32] = '41'
    const record = parseClientSpellBundle(spellBundle([row.join('^')]))[0]
    assert.equal(bardSongFamily(record), 'singing')
    for (const flag of ['1', '2', '', 'invalid']) {
      const changed = { ...record, rawFields: [...record.rawFields] }; changed.rawFields[index] = flag
      assert.equal(bardSongFamily(changed), null)
    }
    assert.equal(record.fields.isDiscipline, undefined)
  }
})

test('mote and instrument rounding precede HP focus; contributions and pack-scaled equipped comparison agree', () => {
  const record = song({ beneficial: false, effects: [effect(0, -8)], target: 8, fields: { skill: 49, aeMaxTargets: 4 } })
  const instrument = resonance(), inputs = context([source(instrument, false)])
  inputs.preferences.mode = 'emulate'; inputs.preferences.emulation.rank = 2; inputs.preferences.emulation.focus = 'selected'; inputs.preferences.emulation.focusIds = [900]
  const focus = modifierSpell({ id: 900, name: 'Damage Focus', effects: [effect(124, 10, 20)] })
  const records = [record, instrument, focus]
  const result = analyzeClientSpell(record, { level: 50, metric: 'damage', classes: ['BRD'], context: inputs, analysis: { scope: 'pack', targets: 4 } }, { modifiers: new SpellModifierCatalog(records), mechanics: new SpellMechanicsCatalog(records) })
  assert.ok(Math.abs(result.total! - 19 * 1.15 * 2 * 4) < 1e-8)
  assert.equal(result.analysis?.contributions[0].afterRank, 8); assert.equal(result.analysis?.contributions[0].afterInstrument, 19)
  assert.ok(Math.abs(result.modifiers!.equippedInstrument!.total! - 8 * 1.15 * 2 * 4) < 1e-8)
  assert.ok(Math.abs(result.analysis!.contributions[0].total! - result.total!) < 1e-8)
})
