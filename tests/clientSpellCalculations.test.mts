import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateClientSpell, CLIENT_SPELL_CALCULATION_SCOPE } from '../src/shared/clientSpellCalculations'
import { parseClientSpellBundle } from '../src/shared/clientSpellParser'
import type { ClientSpellRecord } from '../src/shared/spellLibrary'
import { spellBundle, spellFields } from './fixtures/spell-library/synthetic'

function spell(overrides: Partial<ClientSpellRecord> = {}): ClientSpellRecord {
  return { ...parseClientSpellBundle(spellBundle())[0], ...overrides }
}

function hp(calc: number, base = -100, max = 0, spa = 79) {
  return { slot: 1, spa, base, limit: 0, calc, max }
}

test('instant SPA 79 stays instant on a duration spell and combines with timed SPA 0', () => {
  const record = spell({ durationFormula: 7, durationCap: 5, effects: [hp(100, -50), { ...hp(103, -20, 100, 0), slot: 2 }] })
  const result = calculateClientSpell(record, 20, 'damage')
  assert.deepEqual([result.instant, result.perTick, result.ticks, result.total, result.perMana], [50, 60, 5, 350, 8.75])
  assert.deepEqual(result.reasons, [])
})

test('SPA 0 without duration is one hit; healing requires beneficial positive HP', () => {
  const damage = calculateClientSpell(spell({ effects: [hp(101, -100, 120, 0)] }), 50, 'damage')
  assert.deepEqual([damage.instant, damage.perTick, damage.ticks, damage.total], [120, 0, 0, 120])
  const healing = spell({ beneficial: true, effects: [hp(102, 100, 150)] })
  assert.equal(calculateClientSpell(healing, 30, 'healing').total, 130)
  assert.equal(calculateClientSpell(healing, 30, 'damage').total, null)
  assert.equal(calculateClientSpell(spell({ effects: [hp(100, 10)] }), 30, 'healing').total, null)
})

const formulaCases: [number, number, number][] = [
  [0, 20, 100], [100, 20, 100], [1, 20, 120], [10, 20, 300],
  [101, 21, 110], [102, 20, 120], [103, 20, 140], [104, 20, 160], [105, 20, 180], [106, 20, 200],
  [109, 23, 105], [110, 35, 105], [119, 23, 102], [121, 23, 107], [143, 23, 117],
  [111, 20, 124], [112, 30, 148], [113, 40, 160], [114, 50, 190], [115, 20, 135], [116, 30, 160], [117, 40, 178], [118, 50, 220],
  [124, 55, 105], [125, 55, 110], [126, 55, 115], [127, 55, 120], [128, 55, 125], [129, 55, 150], [130, 55, 175], [131, 55, 200], [132, 55, 225],
  [139, 35, 102], [140, 35, 105], [141, 35, 107]
]

for (const [formula, level, expected] of formulaCases) {
  test(`client formula ${formula} evaluates at level ${level}`, () => {
    const result = calculateClientSpell(spell({ effects: [hp(formula)] }), level, 'damage')
    assert.equal(result.total, expected)
    assert.deepEqual(result.reasons, [])
  })
}

test('formula 110 uses standalone level/6, without changing the old wiki-overlay reader', () => {
  assert.equal(calculateClientSpell(spell({ effects: [hp(110, -24)] }), 60, 'damage').total, 34)
})

test('caps apply to increasing and decreasing magnitudes before all excluded modifiers', () => {
  assert.equal(calculateClientSpell(spell({ effects: [hp(103, -100, 150)] }), 50, 'damage').total, 150)
  assert.equal(calculateClientSpell(spell({ effects: [hp(102, -100, 50)] }), 20, 'damage').total, 80)
  assert.equal(calculateClientSpell(spell({ effects: [hp(102, -100, 50)] }), 80, 'damage').total, 50)
  assert.equal(calculateClientSpell(spell({ effects: [hp(111)] }), 1, 'damage').total, 100)
  assert.equal(calculateClientSpell(spell({ effects: [hp(124)] }), 50, 'damage').total, 100)
  assert.equal(calculateClientSpell(spell({ effects: [hp(139)] }), 10, 'damage').total, 100)
})

const durationCases: [number, number][] = [
  [0, 0], [1, 10], [2, 15], [3, 630], [4, 50], [5, 2], [6, 12], [7, 21], [8, 31], [9, 52],
  [10, 73], [11, 720], [12, 5], [13, 94], [14, 115], [15, 310], [220, 220]
]

for (const [formula, ticks] of durationCases) {
  test(`client duration formula ${formula} supports full-duration totals`, () => {
    const result = calculateClientSpell(spell({ durationFormula: formula, effects: [hp(100, -10, 0, 0)] }), 21, 'damage')
    assert.equal(result.ticks, ticks)
    assert.equal(result.total, formula === 0 ? 10 : 10 * ticks)
  })
}

test('duration truncation, low-level minimums and positive duration caps', () => {
  assert.equal(calculateClientSpell(spell({ durationFormula: 1, effects: [hp(100, -10, 0, 0)] }), 1, 'damage').ticks, 1)
  assert.equal(calculateClientSpell(spell({ durationFormula: 12, effects: [hp(100, -10, 0, 0)] }), 1, 'damage').ticks, 1)
  assert.equal(calculateClientSpell(spell({ durationFormula: 3, durationCap: 7, effects: [hp(100, -10, 0, 0)] }), 21, 'damage').total, 70)
})

test('zero-mana spells keep amount but have no efficiency value', () => {
  const result = calculateClientSpell(spell({ mana: 0, effects: [hp(100, -123.75)] }), 20, 'damage')
  assert.equal(result.total, 123.75)
  assert.equal(result.perMana, null)
  assert.deepEqual(result.reasons, [])
  assert.match(result.restrictions.join(' '), /Zero mana/)
})

test('unsupported or random formulas exclude the entire result instead of a partial sum', () => {
  for (const formula of [11, 99, 107, 108, 120, 123, 144, 4001]) {
    const result = calculateClientSpell(spell({ effects: [hp(100), { ...hp(formula), slot: 2 }] }), 30, 'damage')
    assert.equal(result.total, null)
    assert.equal(result.instant, null)
    assert.match(result.reasons.join(' '), new RegExp(`Unsupported effect formula: ${formula}`))
  }
})

test('untimed/unknown durations and repeated waves explain exclusion', () => {
  for (const formula of [16, 50, 51]) {
    const result = calculateClientSpell(spell({ durationFormula: formula }), 30, 'damage')
    assert.equal(result.total, null)
    assert.match(result.reasons.join(' '), /Unsupported or untimed duration/)
  }
  const result = calculateClientSpell(spell({ aoeDurationMs: 3000 }), 30, 'damage')
  assert.equal(result.total, null)
  assert.match(result.reasons.join(' '), /Repeated-wave timing/)
})

test('non-HP effects and server modifiers are not silently folded into HP totals', () => {
  const record = spell({ effects: [hp(100), { ...hp(100, -900, 0, 59), slot: 2 }], target: 10 })
  record.fields.targetName = 'undead'
  const result = calculateClientSpell(record, 30, 'damage')
  assert.equal(result.total, 100)
  assert.match(result.restrictions.join(' '), /undead/)
  assert.match(result.restrictions.join(' '), /Recourse effects are not included/)
  assert.match(result.restrictions.join(' '), /other effects/)
  assert.match(CLIENT_SPELL_CALCULATION_SCOPE, /one target/)
  assert.match(CLIENT_SPELL_CALCULATION_SCOPE, /not a ceiling/)
})

test('SPA 100 HoT, complete-heal SPA and unsupported HP models explain absent metrics', () => {
  for (const spa of [100, 101, 334]) {
    const result = calculateClientSpell(spell({ beneficial: true, effects: [hp(100, 50, 0, spa)] }), 20, 'healing')
    assert.equal(result.total, null)
    assert.match(result.reasons.join(' '), /No matching healing HP effect/)
  }
})

test('formula results do not depend on rank label, gear or class names', () => {
  const plain = spell({ effects: [hp(103)], rank: null })
  const modified = { ...plain, rank: 'VIII', fields: { ...plain.fields, focus: 300, AA: 1000 } }
  assert.equal(calculateClientSpell(plain, 50, 'damage').total, calculateClientSpell(modified, 50, 'damage').total)
})

test('invalid caster levels are explicit exclusions', () => {
  for (const level of [0, -1, 1.5, NaN, Infinity, 256]) {
    const result = calculateClientSpell(spell(), level, 'damage')
    assert.equal(result.total, null)
    assert.match(result.reasons.join(' '), /Caster level/)
  }
})

test('174 source columns feed the same calculation without reading shifted decoys', () => {
  const fields = spellFields(101, 'Test Beacon', 174)
  const [record] = parseClientSpellBundle(spellBundle([fields.join('^')]))
  assert.equal(calculateClientSpell(record, 20, 'damage').total, 40)
})
