import test from 'node:test'
import assert from 'node:assert/strict'
import { parseClientSpellBundle } from '../src/shared/clientSpellParser'
import { spellDifferences } from '../src/main/spellLibrary/differences'
import { spellBundle, spellFields } from './fixtures/spell-library/synthetic'

for (const layout of [173, 174, 190] as const) {
  test(`full ${layout}-column map joins strings, messages, effects and unmodified fields`, () => {
    const fields = spellFields(101, 'Test Beacon Rk. II', layout)
    fields[60] = 'opaque future value'
    const [record] = parseClientSpellBundle(spellBundle([fields.join('^')]))
    assert.equal(record.id, 101)
    assert.equal(record.name, 'Test Beacon Rk. II')
    assert.equal(record.rank, 'II')
    assert.equal(record.layout, layout)
    assert.deepEqual(record.rawFields, fields)
    assert.deepEqual(record.classes, [{ code: 'WIZ', level: 12 }])
    assert.equal(record.mana, 40)
    assert.equal(record.range, 125.5)
    assert.deepEqual([record.castMs, record.recoveryMs, record.recastMs], [2500, 1500, 6000])
    assert.deepEqual(record.effects, [
      { slot: 1, spa: 79, base: -40, limit: 5, calc: 100, max: 40 },
      { slot: 2, spa: 254, base: 0, limit: 0, calc: 100, max: 0 }
    ])
    assert.equal(record.fields.resistMod, -15)
    assert.equal(record.fields.aeMaxTargets, 8)
    assert.equal(record.fields.recourse, 102)
    assert.equal(record.fields.baseName, 'Test Beacon')
    assert.equal(record.fields.displayName, 'Display Beacon')
    assert.equal(record.fields.reagent1Id, 400)
    assert.equal(record.fields.reagent1Count, 2)
    assert.equal(record.fields.focus1Id, 500)
    assert.equal(record.fields.skillName, 'Evocation')
    assert.equal(record.fields.resistName, 'fire')
    assert.equal(record.fields.targetName, 'single')
    assert.equal(record.fields.effect1, 'Damage 40 hit points once')
    assert.equal(record.category, 'Test category')
    assert.equal(record.subcategory, 'Test subcategory')
    assert.equal(record.messages.you_cast, 'You test.')
    assert.equal(record.messages.fades, 'It fades.')
    assert.match(record.rawDescription, /<BR>/)
    assert.equal(record.description, "Deal 40 points, 5 targets, max 40.\nLasts instant; unknown #12.  'test'")
    if (layout !== 173) assert.equal(record.rawFields[74], '6789')
    if (layout === 190) {
      assert.equal(record.rawFields.length, 190)
      assert.equal(record.rawFields[189], fields[189])
      assert.equal(record.effects[0].calc, 100)
      assert.equal(record.effects[0].max, 40)
      fields[180] = ''
      const [blankColumn] = parseClientSpellBundle(spellBundle([fields.join('^')]))
      assert.equal(blankColumn.layout, 190)
      assert.equal(blankColumn.rawFields[180], '')
      assert.equal(blankColumn.fields.resistMod, -15)
    }
  })
}

test('numeric identities preserve duplicate names, ranks, internal rows and AA levels', () => {
  const rows = [spellFields(101), spellFields(102), spellFields(103, 'Test Beacon III'), spellFields(104, 'Test Internal')]
  rows[1][47] = '254'
  rows[3][47] = '255'
  rows[0][172] = '1|85|104|0|100|0$2|139|-104|0|100|0'
  const parsed = parseClientSpellBundle(spellBundle(rows.map((row) => row.join('^'))))
  assert.deepEqual(parsed.map((record) => record.id), [101, 102, 103, 104])
  assert.equal(parsed[1].classes[0].level, 254)
  assert.equal(parsed[2].rank, 'III')
  assert.deepEqual(parsed[3].classes, [])
  assert.equal(parsed[0].fields.effect1, 'WeaponProc: spell 104 Test Internal')
  assert.match(String(parsed[0].fields.effect2), /spell -104 Test Internal/)
  assert.equal(parsed[0].fields.recourseName, 'Test Beacon')
})

test('description uses descnum then ID and preserves unresolved tokens', () => {
  const fields = spellFields()
  fields[11] = '7'
  fields[12] = '5'
  const sources = spellBundle([fields.join('^')])
  sources['dbstr_us.txt'] = '45^5^Category\n101^6^Fallback #1 and %z; #12 remains.\n'
  const [record] = parseClientSpellBundle(sources)
  assert.equal(record.description, 'Fallback 40 and up to 5 ticks (30s) (level, capped); #12 remains.')
  assert.equal(record.rawDescription, 'Fallback #1 and %z; #12 remains.')
})

test('string-only edits change decoded detail while preserving the source spell row', () => {
  const sources = spellBundle()
  const [before] = parseClientSpellBundle(sources)
  sources['dbstr_us.txt'] = sources['dbstr_us.txt'].replace('Test category', 'Updated category').replace('Deal #1', 'Inflict #1')
  sources['spells_us_str.txt'] = sources['spells_us_str.txt'].replace('It fades.', 'It ends.')
  const [after] = parseClientSpellBundle(sources)
  assert.deepEqual(before.rawFields, after.rawFields)
  assert.equal(after.category, 'Updated category')
  assert.match(after.description, /^Inflict 40/)
  assert.equal(after.messages.fades, 'It ends.')
})

test('preserves extended slots, decimal magnitudes and unknown SPA codes', () => {
  const fields = spellFields()
  fields[172] = '13|79|-123.75|1.5|100|123.75$67|9999|1|0|100|0'
  const [record] = parseClientSpellBundle(spellBundle([fields.join('^')]))
  assert.equal(record.effects[0].base, -123.75)
  assert.equal(record.effects[0].limit, 1.5)
  assert.equal(record.effects[1].slot, 67)
  assert.equal(record.fields.effect67, 'effect 9999 1')
})

test('raw-only unknown-column edits remain available without shifting interpretation', () => {
  const fields = spellFields(101, 'Test Beacon', 174)
  const [before] = parseClientSpellBundle(spellBundle([fields.join('^')]))
  fields[61] = 'changed raw field'
  const [after] = parseClientSpellBundle(spellBundle([fields.join('^')]))
  assert.notDeepEqual(before.rawFields, after.rawFields)
  assert.deepEqual(before.fields, after.fields)
  assert.deepEqual(before.effects, after.effects)
})

const malformedRows = [
  ['unsupported shape', (f: string[]) => f.pop()],
  ['missing name', (f: string[]) => { f[1] = '' }],
  ['bad mana', (f: string[]) => { f[14] = 'NaN' }],
  ['bad class', (f: string[]) => { f[47] = '999' }],
  ['malformed effect', (f: string[]) => { f[172] = '1|0|bad|0|100|0' }],
  ['truncated effect', (f: string[]) => { f[172] = '1|0|-10' }],
  ['duplicate slot', (f: string[]) => { f[172] = '1|0|-10|0|100|10$1|79|-20|0|100|20' }],
  ['unsafe ID', (f: string[]) => { f[0] = '9007199254740992' }]
] as const

for (const [label, mutate] of malformedRows) {
  test(`whole bundle fails atomically on ${label} after a valid row`, () => {
    const invalid = spellFields(102)
    mutate(invalid)
    assert.throws(() => parseClientSpellBundle(spellBundle([spellFields().join('^'), invalid.join('^')])))
  })
}

test('a fractional client duration cap is preserved without truncating or rejecting the bundle', () => {
  const fields = spellFields()
  fields[12] = '20.5'
  const record = parseClientSpellBundle(spellBundle([fields.join('^')]))[0]
  assert.equal(record.durationCap, 20.5)
  assert.equal(record.rawFields[12], '20.5')
})

test('layout 190 reuses the 174 scalar shift and does not reinterpret shared columns', () => {
  const fields = spellFields(101, 'Test Beacon', 190)
  assert.equal(fields.length, 190)
  assert.equal(fields[79], '-15')
  assert.equal(fields[82], '102')
  assert.equal(fields[86], '900')
  assert.equal(fields[87], '45')
  assert.equal(fields[88], '46')
  assert.equal(fields[144], '8')
  assert.equal(fields[166], '901')
  assert.match(fields[189], /^1\|79\|/)
  const [older] = parseClientSpellBundle(spellBundle([spellFields(101, 'Test Beacon', 173).join('^')]))
  const [newer] = parseClientSpellBundle(spellBundle([fields.join('^')]))
  const diffs = spellDifferences(older, newer)
  assert.deepEqual(diffs.map((diff) => diff.field), ['layout'])
  assert.equal(diffs[0].kind, 'format')
})

test('a validated trailing column is kept and a short or unrecognized row fails', () => {
  const trailed = spellFields(101, 'Test Beacon', 190)
  trailed.push('optional-tail')
  const [record] = parseClientSpellBundle(spellBundle([trailed.join('^')]))
  assert.equal(record.layout, 190)
  assert.equal(record.rawFields.at(-1), 'optional-tail')
  assert.equal(record.fields.resistMod, -15)
  assert.deepEqual(record.effects.map((effect) => [effect.slot, effect.base, effect.limit, effect.calc, effect.max]), [
    [1, -40, 5, 100, 40],
    [2, 0, 0, 100, 0]
  ])
  const missing = spellFields(102, 'Test Beacon', 190)
  missing.pop()
  assert.equal(missing.length, 189)
  assert.throws(() => parseClientSpellBundle(spellBundle([missing.join('^')])), /unsupported row layout \(189 fields\)/)
  const malformed = spellFields(103, 'Test Beacon', 190)
  malformed[189] = '1|79|bad|0|100|0'
  assert.throws(() => parseClientSpellBundle(spellBundle([spellFields().join('^'), malformed.join('^')])), /invalid number/)
  const wider174 = spellFields(105, 'Test Beacon', 174)
  wider174.push('optional-tail')
  const [as174] = parseClientSpellBundle(spellBundle([wider174.join('^')]))
  assert.equal(as174.layout, 174)
  assert.equal(as174.rawFields.at(-1), 'optional-tail')
  assert.equal(as174.fields.resistMod, -15)
  assert.equal(as174.effects[0].base, -40)
  const rubbish = new Array<string>(200).fill('0')
  rubbish[0] = '104'
  rubbish[1] = 'Rubbish Row'
  assert.throws(() => parseClientSpellBundle(spellBundle([rubbish.join('^')])), /unsupported row layout \(200 fields\)/)
})

test('exact layouts accept a blank effect pack and trailing columns still need a validated pack', () => {
  for (const layout of [173, 174, 190] as const) {
    const fields = spellFields(101, 'Test Beacon', layout)
    const slot = layout === 190 ? 189 : layout === 174 ? 173 : 172
    fields[slot] = ''
    const [record] = parseClientSpellBundle(spellBundle([fields.join('^')]))
    assert.equal(record.layout, layout)
    assert.deepEqual(record.effects, [])
    fields.push('tail', 'more')
    assert.throws(() => parseClientSpellBundle(spellBundle([fields.join('^')])), /unsupported row layout/)
  }
})

test('empty sources, duplicate IDs and malformed or duplicate joined strings fail', () => {
  for (const file of ['spells_us.txt', 'spells_us_str.txt', 'dbstr_us.txt'] as const) {
    const sources = spellBundle()
    sources[file] = ''
    assert.throws(() => parseClientSpellBundle(sources), /empty source/)
  }
  const duplicated = spellFields().join('^')
  assert.throws(() => parseClientSpellBundle(spellBundle([duplicated, duplicated])), /duplicate spell ID/)
  const sources = spellBundle()
  sources['spells_us_str.txt'] += '101^^^^^\n'
  assert.throws(() => parseClientSpellBundle(sources), /duplicate ID/)
  sources['spells_us_str.txt'] = 'invalid message row'
  assert.throws(() => parseClientSpellBundle(sources), /malformed message/)
  sources['spells_us_str.txt'] = '101^^^^^\n'
  sources['dbstr_us.txt'] = 'not a valid row'
  assert.throws(() => parseClientSpellBundle(sources), /malformed string/)
  sources['dbstr_us.txt'] = '45^5^A\n45^5^B'
  assert.throws(() => parseClientSpellBundle(sources), /duplicate key/)
})
