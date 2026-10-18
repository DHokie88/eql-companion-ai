import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeClientSpell, SpellMechanicsCatalog, isAreaTarget } from '../src/shared/clientSpellAnalysis'
import { calculateClientSpell } from '../src/shared/clientSpellCalculations'
import { evaluateModifiedSpell, SpellModifierCatalog } from '../src/shared/clientSpellModifiers'
import { parseClientSpellBundle } from '../src/shared/clientSpellParser'
import { RAIN_PAGES } from '../src/shared/rainSpellResearch'
import { spellBundle, spellFields } from './fixtures/spell-library/synthetic'
import { effect, modifierContext, modifierFocus, modifierSpell } from './helpers/spellModifierFixtures.mts'

function ordinary(overrides = {}) {
  return modifierSpell({ castMs: 1000, recoveryMs: 1500, recastMs: 0, durationFormula: 0, durationCap: 0, aoeDurationMs: 0, target: 5, ...overrides })
}

function analyze(record = ordinary(), overrides = {}, others = []) {
  const options = { level: 50, metric: 'damage', classes: ['WIZ'], analysis: { scope: 'single', targets: 4 }, ...overrides }
  const records = [record, ...others]
  return analyzeClientSpell(record, options, { modifiers: new SpellModifierCatalog(records), mechanics: new SpellMechanicsCatalog(records) })
}

function emulate(changes = {}) {
  const context = modifierContext()
  context.preferences = { mode: 'emulate', emulation: { ...context.preferences.emulation, rank: 5, focus: 'none', ...changes } }
  return context
}

function pack(targets = 4) { return { analysis: { scope: 'pack', targets } } }
function area(cap = 8, overrides = {}) { return ordinary({ target: 8, fields: { aeMaxTargets: cap }, ...overrides }) }
function rain(overrides = {}) { return area(4, { name: 'Frost Storm', aoeDurationMs: 7500, ...overrides }) }
function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`) }

test('ordinary one-target client calculations retain baseline amounts, zero mana and exclusions', () => {
  const records = [ordinary(), ordinary({ mana: 0 }), ordinary({ durationFormula: 7, durationCap: 3 }), ordinary({ effects: [{ ...effect(0, -100), calc: 999 }] })]
  for (const record of records) {
    const baseline = calculateClientSpell(record, 50, 'damage')
    const result = analyze(record)
    const withoutAnalysis = { ...result }
    delete withoutAnalysis.analysis
    withoutAnalysis.restrictions = withoutAnalysis.restrictions.slice(0, -1)
    assert.deepEqual(withoutAnalysis, baseline)
    assert.equal(result.analysis.singleTargetTotal, baseline.total)
    assert.equal(result.analysis.contextRevision, null)
    assert.equal(result.analysis.modelVersion, '2')
  }
})

test('identity modifiers and Base/I preserve all original HP totals', () => {
  for (const rank of [0, 1]) {
    const record = ordinary({ durationFormula: 7, durationCap: 3, effects: [effect(79, -8), { ...effect(0, -8), slot: 2 }] })
    const context = emulate({ rank })
    const result = analyze(record, { context })
    const original = evaluateModifiedSpell(record, { level: 50, metric: 'damage', classes: ['WIZ'], context }, new SpellModifierCatalog([record]))
    assert.equal(result.total, original.total)
    assert.equal(result.total, 32)
    assert.deepEqual(result.modifiers, original.modifiers)
  }
})

test('contributions expose per-effect rank rounding, focus, periodic ticks and totals', () => {
  const record = ordinary({ durationFormula: 7, durationCap: 3, effects: [effect(79, -8), { ...effect(0, -8), slot: 2 }] })
  const context = emulate({ rank: 2, focus: 'selected', focusIds: [9001] })
  const result = analyze(record, { context }, [modifierFocus()])
  assert.deepEqual(result.analysis.contributions.map((row) => [row.clientAmount, row.afterRank, row.periodic, row.ticks, row.hits]), [[8, 8, false, null, 1], [8, 8, true, 3, 1]])
  near(result.analysis.contributions[0].afterFocus, 8 * 1.105)
  near(result.analysis.contributions.reduce((sum, row) => sum + row.total, 0), result.total)
  near(result.total, 32 * 1.105)
  assert.equal(result.modifiers.baseline.total, 32)
  assert.equal(result.analysis.contextRevision, 'context-a')
})

test('exact lower-rank emulation and healing scaling remain independently measured rules', () => {
  const record = ordinary({ beneficial: true, effects: [effect(0, 100)] })
  const context = emulate({ rank: 9, ranks: { 101: { name: record.name, rank: 5 } } })
  const result = analyze(record, { metric: 'healing', context })
  assert.equal(result.total, 115)
  assert.equal(result.modifiers.rank, 5)
  assert.equal(result.analysis.contributions[0].afterRank, 115)
})

test('ordinary AOE applies chosen target count, captured cap and spell maximum with one mana cost', () => {
  const record = area(3, { mana: 10 })
  assert.equal(analyze(record).total, 100)
  const chosen = analyze(record, pack())
  assert.equal(chosen.total, 300)
  assert.equal(chosen.mana, 10)
  assert.equal(chosen.perMana, 30)
  assert.deepEqual([chosen.analysis.requestedTargets, chosen.analysis.effectiveTargets, chosen.analysis.hits, chosen.analysis.hitCap], [4, 3, 3, 3])
  assert.equal(chosen.analysis.scope, 'aggregate pack total')
  assert.equal(chosen.analysis.singleTargetTotal, 100)
  assert.equal(chosen.analysis.packTotal, 300)
  assert.equal(analyze(area(8), pack('maximum')).total, 800)
  assert.equal(analyze(area(8), pack(1)).total, 100)
  assert.equal(analyze(area(8), pack(100)).total, 800)
})

test('ordinary packs scale modifier baselines, focus ranges and each contribution into the same scope', () => {
  const record = area(8, { durationFormula: 7, durationCap: 3, effects: [effect(79, -8), { ...effect(0, -8), slot: 2 }] })
  const result = analyze(record, { ...pack(), context: emulate({ rank: 2, focus: 'selected', focusIds: [9001] }) }, [modifierFocus()])
  near(result.total, 32 * 1.105 * 4)
  assert.equal(result.modifiers.baseline.total, 128)
  near(result.modifiers.range.min, 32 * 1.01 * 4)
  near(result.modifiers.range.max, 32 * 1.2 * 4)
  near(result.analysis.singleTargetTotal, 32 * 1.105)
  near(result.analysis.contributions.reduce((sum, row) => sum + row.total, 0), result.total)
})

test('unknown ordinary AOE caps are explicit partial estimates; maximum does not invent a cap', () => {
  for (const cap of [0, null, -1, '4']) {
    const record = area(cap)
    const chosen = analyze(record, pack())
    assert.equal(chosen.total, 400)
    assert.equal(chosen.analysis.partial, true)
    assert.match(chosen.analysis.warnings.join(' '), /cap is unknown/)
    assert.match(chosen.analysis.capSource, /explicit assumption/)
    const maximum = analyze(record, pack('maximum'))
    assert.equal(maximum.total, null)
    assert.equal(maximum.analysis.singleTargetTotal, 100)
    assert.equal(maximum.analysis.hits, null)
    assert.match(maximum.reasons.join(' '), /no finite target cap/)
    assert.equal(analyze(record).analysis.partial, false)
  }
})

test('verified rain has a whole-cast hit budget, never waves times every target', () => {
  const record = rain({ mana: 10 })
  const single = analyze(record)
  const four = analyze(record, pack())
  assert.equal(single.total, 300)
  assert.equal(four.total, 400)
  assert.equal(four.perMana, 40)
  assert.equal(analyze(record, pack(2)).total, 400)
  assert.equal(analyze(record, pack('maximum')).total, 400)
  assert.deepEqual([single.analysis.waves, single.analysis.hits, four.analysis.waves, four.analysis.hits], [3, 3, 3, 4])
  assert.equal(four.analysis.effectiveTargets, null)
  assert.match(four.analysis.capSource, /whole-cast hit budget/)
  assert.equal(four.analysis.timing.deliveryMs, 7500)
  assert.equal(four.analysis.timing.cycleMs, 8500)
  near(four.analysis.timing.rate, 400 / 8.5)
})

test('rain applies per-hit modifiers before waves and scales its displayed baseline and focus range', () => {
  const result = analyze(rain(), { ...pack(), context: emulate({ rank: 2, focus: 'selected', focusIds: [9001] }) }, [modifierFocus()])
  near(result.total, 112 * 1.105 * 4)
  assert.equal(result.modifiers.baseline.total, 400)
  near(result.modifiers.range.min, 112 * 1.01 * 4)
  near(result.modifiers.range.max, 112 * 1.2 * 4)
  assert.equal(result.analysis.contributions[0].clientAmount, 100)
  assert.equal(result.analysis.contributions[0].afterRank, 112)
  near(result.analysis.contributions[0].total, result.total)
})

test('rain binding requires one exact compatible player identity and never promotes NPC or classic suffix records', () => {
  const record = rain()
  const npc = rain({ id: 999, classes: [] })
  assert.equal(analyze(record, {}, [npc]).total, 300)
  assert.equal(analyze(npc).total, null)
  assert.equal(analyze(record, {}, [rain({ id: 102 })]).total, null)
  for (const name of ['Frost Storm II', 'frost storm', ' Frost Storm', 'Unknown Rain']) {
    assert.equal(analyze(rain({ name })).total, null)
  }
  const catalog = new SpellMechanicsCatalog([record])
  assert.match(catalog.resolve({ ...record, durationCap: 1 }).reason, /captured catalog identity/)
  assert.throws(() => new SpellMechanicsCatalog([record, record]), /Duplicate catalog spell ID/)
})

test('rain layout changes and repeated DoT application remain excluded until separately verified', () => {
  const changes = [
    { target: 4 }, { durationFormula: 7 }, { durationCap: 1 }, { aoeDurationMs: 5000 }, { aoeDurationMs: 0 },
    { fields: { aeMaxTargets: 5 } }, { fields: { aeMaxTargets: 0 } }, { beneficial: true },
    { effects: [effect(100, -100)] }
  ]
  for (const overrides of changes) {
    const result = analyze(rain(overrides), { context: emulate({ rank: 10 }) })
    assert.equal(result.total, null)
    assert.ok(result.reasons.length)
  }
  const dot = area(4, { name: 'Strike of Thunder', aoeDurationMs: 7500, durationFormula: 7, durationCap: 4 })
  assert.equal(analyze(dot, pack()).total, null)
  assert.match(analyze(dot).reasons.join(' '), /Repeated DoT applications/)
})

test('unknown formulas and unsupported HP effects stay excluded with modifiers and target scenarios', () => {
  for (const overrides of [{ effects: [{ ...effect(0, -100), calc: 999 }] }, { effects: [effect(334, -100)] }, { durationFormula: 199 }]) {
    const result = analyze(area(4, overrides), { ...pack(), context: emulate({ rank: 10 }) })
    assert.equal(result.total, null)
    assert.equal(result.analysis.timing.rate, null)
    assert.ok(result.analysis.contributions.every((row) => row.total === null))
  }
})

test('healing remains per recipient even for area targets and pack scenarios', () => {
  const record = area(8, { beneficial: true, effects: [effect(0, 100)], durationFormula: 7, durationCap: 3 })
  const result = analyze(record, { ...pack(), metric: 'healing' })
  assert.equal(result.total, 300)
  assert.equal(result.analysis.scope, 'one-target full cast')
  assert.equal(result.analysis.requestedTargets, 1)
  assert.equal(result.analysis.hits, 1)
  assert.equal(result.analysis.packTotal, null)
})

test('cycle timing uses cast plus the largest of recovery, recast and delivery', () => {
  const samples = [
    [ordinary({ castMs: 2000, recoveryMs: 1500, recastMs: 0 }), 0, 3500],
    [ordinary({ castMs: 2000, recoveryMs: 1500, recastMs: 8000 }), 0, 10000],
    [ordinary({ castMs: 2000, durationFormula: 7, durationCap: 5 }), 30000, 32000],
    [ordinary({ castMs: 2000, recastMs: 40000, durationFormula: 7, durationCap: 5 }), 30000, 42000],
    [ordinary({ effects: [effect(79, -100)], durationFormula: 7, durationCap: 5 }), 0, 2500]
  ]
  for (const [record, delivery, cycle] of samples) {
    const result = analyze(record)
    assert.equal(result.analysis.timing.deliveryMs, delivery)
    assert.equal(result.analysis.timing.cycleMs, cycle)
    near(result.analysis.timing.rate, result.total / (cycle / 1000))
  }
})

test('unknown and zero timing exclude only rate, while zero mana never creates infinite efficiency', () => {
  for (const overrides of [{ castMs: 0, recoveryMs: 0, recastMs: 0 }, { castMs: -1 }, { recastMs: NaN }]) {
    const result = analyze(ordinary(overrides))
    assert.equal(result.total, 100)
    assert.equal(result.analysis.timing.rate, null)
    assert.ok(result.analysis.timing.reason)
    assert.deepEqual(result.reasons, [])
  }
  const free = analyze(area(4, { mana: 0 }), pack())
  assert.equal(free.total, 400)
  assert.equal(free.perMana, null)
  assert.equal(Number.isFinite(free.analysis.timing.rate), true)
})

test('scenario validation excludes invalid target counts without mutating source or modifier context', () => {
  const record = rain()
  const context = emulate()
  const before = structuredClone({ record, context })
  for (const targets of [0, -1, 1.5, 101, Infinity, 'four']) {
    const result = analyze(record, { ...pack(targets), context })
    assert.equal(result.total, null)
    assert.match(result.reasons.join(' '), /whole number/)
  }
  assert.deepEqual({ record, context }, before)
})

test('numeric area target vocabulary includes targeted/PB/directional types, never ordinary single/group healing', () => {
  for (const target of [2, 4, 8, 20, 24, 25, 32, 36, 37, 40, 42, 44, 45, 50]) assert.equal(isAreaTarget(target), true)
  for (const target of [0, 1, 5, 6, 41, 51, 56]) assert.equal(isAreaTarget(target), false)
})

test('both complete client layouts bind captured rain windows and shifted downstream caps identically', () => {
  for (const layout of [173, 174]) {
    const row = spellFields(101, 'Frost Storm')
    row[11] = '0'; row[12] = '0'; row[13] = '7500'; row[30] = '8'; row[143] = '4'
    row[172] = '1|0|-100|0|100|0'
    if (layout === 174) row.splice(74, 0, '6789')
    const [record] = parseClientSpellBundle(spellBundle([row.join('^')]))
    assert.equal(record.layout, layout)
    assert.equal(analyze(record).total, 300)
    assert.equal(analyze(record, pack()).total, 400)
  }
})

test('each researched direct-rain name is bound separately; unknown repeated names gain no default waves', () => {
  const records = RAIN_PAGES.map((page, index) => rain({ id: index + 1, name: page.name }))
  const catalog = new SpellMechanicsCatalog(records)
  for (const record of records) {
    assert.equal(catalog.resolve(record).waves, RAIN_PAGES.find((page) => page.name === record.name).waves)
    assert.equal(catalog.resolve(record).reason, null)
  }
  const unknown = rain({ name: 'Unresearched Storm' })
  assert.equal(new SpellMechanicsCatalog([unknown]).resolve(unknown).waves, 0)
})
