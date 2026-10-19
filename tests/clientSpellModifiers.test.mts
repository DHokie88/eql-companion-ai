import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateClientSpell } from '../src/shared/clientSpellCalculations'
import { evaluateModifiedSpell, SpellModifierCatalog } from '../src/shared/clientSpellModifiers'
import { scaleSpellDamage, scaleSpellHeal } from '../src/shared/spellScale'
import { effect, modifierContext, modifierFocus, modifierSpell } from './helpers/spellModifierFixtures.mts'

function evaluate(record = modifierSpell(), context = modifierContext(), others = [], metric = 'damage') {
  return evaluateModifiedSpell(record, { level: 50, metric, classes: ['WIZ'], context }, new SpellModifierCatalog([record, ...others]))
}

function emulation(changes = {}) {
  const context = modifierContext()
  return { ...context, preferences: { mode: 'emulate', emulation: { ...context.preferences.emulation, ...changes } } }
}

test('client mode returns exactly the baseline calculation, without modifier metadata', () => {
  const record = modifierSpell()
  const context = emulation({ rank: 10, focus: 'selected', focusIds: [9001] })
  context.preferences.mode = 'client'
  assert.deepEqual(evaluate(record, context, [modifierFocus()]), calculateClientSpell(record, 50, 'damage'))
})

test('base and rank I are identity for damage/healing; every supported rank uses measured rules', () => {
  for (const rank of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const damage = evaluate(modifierSpell(), emulation({ rank, focus: 'none' }))
    const healing = evaluate(modifierSpell({ beneficial: true, effects: [effect(0, 100)] }), emulation({ rank, focus: 'none' }), [], 'healing')
    assert.equal(damage.total, scaleSpellDamage(100, rank))
    assert.equal(healing.total, scaleSpellHeal(100, rank))
    assert.equal(damage.modifiers?.rank, rank)
  }
})

test('mote rounding occurs per HP slot before instant/periodic aggregation and after client caps', () => {
  const record = modifierSpell({ effects: [effect(79, -8), effect(0, -8)], durationFormula: 7, durationCap: 3 })
  const result = evaluate(record, emulation({ rank: 2, focus: 'none' }))
  assert.deepEqual([result.instant, result.perTick, result.ticks, result.total], [8, 8, 3, 32])
  const capped = modifierSpell({ effects: [{ ...effect(0, -100), calc: 103, max: 150 }] })
  assert.equal(evaluate(capped, emulation({ rank: 5, focus: 'none' })).total, 195)
})

test('exact per-ID simulation beats global simulation and can preview below detected IX', () => {
  const record = modifierSpell()
  const context = emulation({ rank: 7, focus: 'none', ranks: { 101: { name: record.name, rank: 5 } } })
  context.ranks['synthetic bolt'].rank = 9
  assert.equal(evaluate(record, context).total, 130)
  delete context.preferences.emulation.ranks['101']
  assert.equal(evaluate(record, context).total, 142)
  context.preferences.mode = 'mine'
  assert.equal(evaluate(record, context).total, 154)
  assert.equal(evaluate(record, context).modifiers?.simulated, false)
})

test('duplicate names including internal records and collapsed classic lines never borrow observed mote ranks', () => {
  const record = modifierSpell()
  const context = modifierContext({ ranks: { 'synthetic bolt': { name: record.name, rank: 9 } } })
  for (const duplicate of [modifierSpell({ id: 102, classes: [] }), modifierSpell({ id: 102, name: 'Synthetic Bolt II' })]) {
    const result = evaluate(record, context, [duplicate])
    assert.equal(result.total, 100)
    assert.equal(result.modifiers?.rankSource, 'unknown')
    assert.match(result.modifiers?.warnings.join(' ') ?? '', /multiple client IDs or classic spell lines/)
  }
  const classic = modifierSpell({ name: 'Synthetic Bolt II' })
  assert.equal(evaluate(classic, modifierContext({ ranks: null })).total, 100)
  assert.equal(evaluate(classic, modifierContext({ ranks: null })).modifiers?.rank, null)
  assert.equal(evaluate(classic, context).modifiers?.rank, null, 'a lone classic II record cannot borrow the base-name observation')
})

test('manual numeric rank overrides remain valid on duplicate names and stale names are explained', () => {
  const record = modifierSpell()
  const context = emulation({ rank: null, focus: 'none', ranks: { 101: { name: record.name, rank: 5 } } })
  assert.equal(evaluate(record, context, [modifierSpell({ id: 102 })]).total, 130)
  context.preferences.emulation.ranks['101'].name = 'Old record name'
  const result = evaluate(record, context)
  assert.equal(result.total, 100)
  assert.match(result.modifiers?.warnings.join(' ') ?? '', /different catalog record/)
})

test('unknown rank is a partial baseline assumption instead of invented ownership', () => {
  const result = evaluate(modifierSpell(), modifierContext({ ranks: null }))
  assert.equal(result.total, 100)
  assert.equal(result.modifiers?.partial, true)
  assert.equal(result.modifiers?.rankSource, 'unknown')
  assert.match(result.modifiers?.warnings.join(' ') ?? '', /unknown.*client base/)
})

test('best qualifying focus uses midpoint, stable numeric ID tie break, and never adds bonuses', () => {
  const focuses = [modifierFocus(), modifierFocus([], { id: 9002, name: 'Synthetic Focus III' })]
  const context = emulation({ rank: 5, focus: 'selected', focusIds: [9002, 9001] })
  const result = evaluate(modifierSpell(), context, focuses)
  assert.equal(result.total, 130 * 1.105)
  assert.equal(result.modifiers?.focus?.id, 9001)
  assert.deepEqual(result.modifiers?.range, { min: 130 * 1.01, max: 130 * 1.2 })
  assert.equal(result.modifiers?.focus?.item, 'Simulated focus')
  assert.equal(result.modifiers?.simulated, true)
})

test('focus follows rank on each slot while duration, mana, target, cast inputs and source record stay unchanged', () => {
  const record = modifierSpell({ durationFormula: 7, durationCap: 3, effects: [effect(79, -8), effect(0, -8)] })
  const before = structuredClone(record)
  const result = evaluate(record, emulation({ rank: 2, focus: 'selected', focusIds: [9001] }), [modifierFocus()])
  assert.deepEqual([result.instant, result.perTick, result.total], [8 * 1.105, 8 * 1.105, 32 * 1.105])
  assert.equal(result.perMana, Math.round(result.total / record.mana * 1_000_000) / 1_000_000)
  assert.equal(result.mana, record.mana)
  assert.equal(result.target, record.target)
  assert.deepEqual(record, before)
  assert.match(result.restrictions.join(' '), /client mana cost/)
})

test('focus qualification is preserved on simulations and zero-mana never creates efficiency', () => {
  const focus = modifierFocus([effect(136, -5)])
  assert.equal(evaluate(modifierSpell(), emulation({ rank: 5, focus: 'selected', focusIds: [9001] }), [focus]).total, 130)
  const zero = evaluate(modifierSpell({ mana: 0 }), emulation({ rank: 5, focus: 'selected', focusIds: [9001] }), [modifierFocus()])
  assert.equal(zero.total, 130 * 1.105)
  assert.equal(zero.perMana, null)
})

test('detected focus keeps item provenance, exact rank-bearing joins and distinguishes missing inventory from no focus', () => {
  const context = modifierContext()
  context.inventory.candidates = [{ effect: 'synthetic focus ii', item: 'Synthetic Mask' }]
  const result = evaluate(modifierSpell(), context, [modifierFocus()])
  assert.equal(result.total, 110.5)
  assert.equal(result.modifiers?.focus?.item, 'Synthetic Mask')
  assert.equal(result.modifiers?.partial, false)
  context.inventory.candidates[0].effect = 'Synthetic Focus'
  assert.match(evaluate(modifierSpell(), context, [modifierFocus()]).modifiers?.warnings.join(' ') ?? '', /absent from this dataset/)
  context.inventory.candidates = []
  assert.equal(evaluate(modifierSpell(), context).modifiers?.partial, false)
  context.inventory.state = 'missing'
  assert.equal(evaluate(modifierSpell(), context).modifiers?.partial, true)
})

test('ambiguous, unresolved, unsupported and unknown-classification focus cannot silently apply', () => {
  const context = modifierContext()
  context.inventory.candidates = [{ effect: 'Synthetic Focus II', item: 'Synthetic Mask' }]
  const ambiguous = [modifierFocus(), modifierFocus([], { id: 9002 })]
  assert.match(evaluate(modifierSpell(), context, ambiguous).modifiers?.warnings.join(' ') ?? '', /multiple client IDs/)
  assert.equal(evaluate(modifierSpell(), context, ambiguous).total, 100)
  const unsupported = [modifierFocus([effect(348, 1)])]
  assert.equal(evaluate(modifierSpell(), context, unsupported).total, 100)
  assert.equal(evaluate(modifierSpell(), context, unsupported).modifiers?.partial, true)
  const unknown = evaluate(modifierSpell({ mana: 0 }), context, [modifierFocus([effect(311, 0)])])
  assert.match(unknown.modifiers?.warnings.join(' ') ?? '', /classification is unknown/)
})

test('focus none and selected are separate from detected equipment and warnings', () => {
  const context = emulation({ rank: 5, focus: 'none' })
  context.inventory.state = 'missing'
  assert.equal(evaluate(modifierSpell(), context).modifiers?.partial, false)
  context.preferences.emulation.focus = 'detected'
  assert.equal(evaluate(modifierSpell(), context).modifiers?.partial, true)
  context.preferences.mode = 'mine'
  context.preferences.emulation.focus = 'none'
  assert.equal(evaluate(modifierSpell(), context).modifiers?.partial, true)
})

test('modifiers never enable unsupported HP formulas, durations or repeated waves', () => {
  for (const overrides of [{ effects: [{ ...effect(0, -100), calc: 999 }] }, { durationFormula: 999, durationCap: 20.5 }, { aoeDurationMs: 1000 }]) {
    const result = evaluate(modifierSpell(overrides), emulation({ rank: 10, focus: 'selected', focusIds: [9001] }), [modifierFocus()])
    assert.equal(result.total, null)
    assert.ok(result.reasons.length)
  }
})

test('unknown non-song bard skills stay excluded and context model/revision are carried to every result', () => {
  const result = evaluate(modifierSpell({ classes: [{ code: 'BRD', level: 1 }] }), emulation({ rank: 5, focus: 'none' }))
  assert.equal(result.modifiers?.partial, true)
  assert.match(result.modifiers?.warnings.join(' ') ?? '', /instrument modifiers are not modeled/)
  assert.equal(result.modifiers?.contextRevision, 'context-a')
  assert.equal(result.modifiers?.modelVersion, '1')
})

test('catalog options paginate thirty, preserve numeric identities, and expose unsupported layouts', () => {
  const catalog = new SpellModifierCatalog(Array.from({ length: 35 }, (_, n) => modifierFocus([], { id: n + 1, name: `Focus ${n + 1}`, effects: [effect(124, 1, 20), ...n === 0 ? [effect(348, 1)] : []] })))
  assert.equal(catalog.focusOptions().total, 35)
  assert.equal(catalog.focusOptions().records.length, 30)
  assert.equal(catalog.focusOptions('', 2).records.length, 5)
  assert.equal(catalog.focusOptions('1').records.find((row) => row.id === 1)?.supported, false)
  assert.throws(() => new SpellModifierCatalog([modifierSpell(), modifierSpell()]), /Duplicate catalog spell ID/)
})
