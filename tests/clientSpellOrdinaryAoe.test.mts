import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateClientSpell } from '../src/shared/clientSpellCalculations'
import { analyzeClientSpell, SpellMechanicsCatalog } from '../src/shared/clientSpellAnalysis'
import { SpellModifierCatalog, evaluateModifiedSpell } from '../src/shared/clientSpellModifiers'
import { clientSpellTypeLabel, matchesSpellType } from '../src/shared/clientSpellBrowse'
import type { ClientSpellRecord } from '../src/shared/spellLibrary'
import type { SpellModifierContext } from '../src/shared/spellModifiers'
import { ordinaryAoeRows } from './helpers/ordinaryAoeFixtures.mts'
import { modifierContext } from './helpers/spellModifierFixtures.mts'
import { syntheticCatalog } from './spellLibrarySynthetic.mts'

function fixture(record: ClientSpellRecord) {
  const catalog = { mechanics: new SpellMechanicsCatalog([record]), modifiers: new SpellModifierCatalog([record]) }
  return { catalog, analyze(targets: number | 'maximum' | 'single', context?: SpellModifierContext) {
    return analyzeClientSpell(record, { level: 60, metric: 'damage', classes: [], context,
      analysis: targets === 'single' ? { scope: 'single', targets: 4 } : { scope: 'pack', targets } }, catalog)
  } }
}

test('reported non-rain four/eight-target client spells calculate full damage and one mana cost', () => {
  const records = syntheticCatalog(ordinaryAoeRows()).records
  const expected = [[76, 4], [181, 8], [130, 4], [392, 4]]
  for (const [index, record] of records.entries()) {
    const snapshot = JSON.stringify(record)
    const [damage, cap] = expected[index], { analyze, catalog } = fixture(record)
    const baseline = calculateClientSpell(record, 60, 'damage')
    assert.equal(baseline.total, damage, record.name)
    assert.equal(baseline.perMana, Math.round(damage / record.mana * 1e6) / 1e6)
    assert.deepEqual(baseline.reasons, [])
    assert.equal(analyze('single').total, damage)
    assert.equal(analyze(2).total, damage * 2)
    const maximum = analyze('maximum')
    assert.equal(maximum.total, damage * cap)
    assert.equal(maximum.perMana, Math.round(damage * cap / record.mana * 1e6) / 1e6)
    assert.equal(maximum.mana, record.mana)
    assert.equal(analyze(100).total, maximum.total)
    assert.deepEqual([maximum.analysis?.waves, maximum.analysis?.hits, maximum.analysis?.deliveryKind], [1, cap, 'aoe'])
    for (const mechanics of [undefined, catalog.mechanics]) {
      assert.equal(matchesSpellType(record, `aoe${cap}`, mechanics), true)
      assert.equal(clientSpellTypeLabel(record, mechanics), index === 2 ? 'AoE4 DoT' : `AOE${cap}`)
    }
    assert.equal(JSON.stringify(record), snapshot, 'calculation preserves captured source fields')
  }
  const cloud = calculateClientSpell(records[2], 60, 'damage')
  assert.deepEqual([cloud.instant, cloud.perTick, cloud.durationTicks, cloud.ticks], [20, 5, 21, 22])
  assert.equal(fixture(records[3]).analyze('maximum').analysis?.timing.deliveryMs, 0, 'instant SPA79 does not inherit a wave or DoT window')
})

test('ordinary AOE modifiers retain finite baselines and scale them into the selected scope', () => {
  const record = syntheticCatalog(ordinaryAoeRows()).records[0]
  const context = modifierContext()
  context.preferences.mode = 'emulate'; context.preferences.emulation.rank = 5; context.preferences.emulation.focus = 'none'
  const { analyze, catalog } = fixture(record)
  const modified = evaluateModifiedSpell(record, { level: 60, metric: 'damage', classes: [], context }, catalog.modifiers)
  assert.equal(modified.modifiers?.baseline.total, 76)
  assert.equal(modified.total, 98)
  const maximum = analyze('maximum', context)
  assert.equal(maximum.total, 392)
  assert.equal(maximum.modifiers?.baseline.total, 304)
  assert.equal(maximum.modifiers?.baseline.perMana, Math.round(304 / 84 * 1e6) / 1e6)
  assert.equal(maximum.analysis?.singleTargetTotal, 98)
})

test('unrecognized or repeated windows and tiny markers without area/cap evidence stay excluded', () => {
  const pillar = syntheticCatalog(ordinaryAoeRows()).records[0]
  const cases = [
    ...[1, 6, 11, 1000, 7500].map((aoeDurationMs) => ({ ...pillar, aoeDurationMs })),
    ...[5, 10].flatMap((aoeDurationMs) => [
      { ...pillar, aoeDurationMs, target: 5 },
      { ...pillar, aoeDurationMs, fields: { ...pillar.fields, aeMaxTargets: 0 } }
    ])
  ]
  for (const record of cases) {
    const calculation = calculateClientSpell(record, 60, 'damage')
    assert.equal(calculation.total, null)
    assert.match(calculation.reasons.join(' '), /Repeated-wave timing/)
    const { analyze, catalog } = fixture(record)
    assert.ok(catalog.mechanics.resolve(record).reason)
    assert.equal(analyze('maximum').total, null)
    assert.equal(matchesSpellType(record, 'aoe4', catalog.mechanics), false)
  }
})
