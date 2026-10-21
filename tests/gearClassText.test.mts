import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CLASS_ABBRS, type ClassAbbr } from '../src/shared/classCombo'
import { gearClassText } from '../src/renderer/src/features/gear/gearClassText'

test('empty and full class lists use the existing empty and ALL presentation', () => {
  assert.deepEqual(gearClassText([]), { tokens: [], lines: [], compact: false })
  assert.deepEqual(gearClassText(CLASS_ABBRS), { tokens: ['ALL'], lines: ['ALL'], compact: false })
  assert.deepEqual(gearClassText([...CLASS_ABBRS, 'PAL']), { tokens: ['ALL'], lines: ['ALL'], compact: false })
})

test('complete Tanks and Casters groups occupy their first member position', () => {
  assert.deepEqual(gearClassText(['CLR', 'PAL', 'BRD', 'WAR', 'SHD']),
    { tokens: ['CLR', 'Tanks', 'BRD'], lines: ['CLR Tanks BRD'], compact: false })
  assert.deepEqual(gearClassText(['DRU', 'NEC', 'WIZ', 'CLR', 'ENC', 'MAG']),
    { tokens: ['DRU', 'Casters', 'CLR'], lines: ['DRU Casters CLR'], compact: false })
  const classes: readonly ClassAbbr[] = Object.freeze(['SHD', 'CLR', 'NEC', 'PAL', 'WIZ', 'BRD', 'WAR', 'ENC', 'MAG'])
  assert.deepEqual(gearClassText(classes),
    { tokens: ['Tanks', 'CLR', 'Casters', 'BRD'], lines: ['Tanks CLR Casters BRD'], compact: false })
  assert.deepEqual(classes, ['SHD', 'CLR', 'NEC', 'PAL', 'WIZ', 'BRD', 'WAR', 'ENC', 'MAG'], 'the input is unchanged')
})

test('partial groups never imply a class missing from the item', () => {
  for (const members of [['WAR', 'PAL', 'SHD'], ['WIZ', 'ENC', 'NEC', 'MAG']] as const) {
    for (const missing of members) {
      const partial = members.filter((member) => member !== missing)
      assert.deepEqual(gearClassText(partial), { tokens: partial, lines: [partial.join(' ')], compact: false })
    }
  }
  assert.deepEqual(gearClassText(['WAR', 'ENC', 'PAL', 'MAG']),
    { tokens: ['WAR', 'ENC', 'PAL', 'MAG'], lines: ['WAR ENC PAL MAG'], compact: false })
})

test('five to eight displayed tokens balance over two lines with at most four per line', () => {
  const classes: readonly ClassAbbr[] = ['BER', 'BRD', 'BST', 'CLR', 'DRU', 'MNK', 'RNG', 'ROG']
  assert.equal(gearClassText(classes.slice(0, 4)).compact, false)
  for (let count = 5; count <= 8; count++) {
    const result = gearClassText(classes.slice(0, count))
    const lengths = result.lines.map((line) => line.split(' ').length)
    assert.equal(result.compact, true)
    assert.equal(result.lines.length, 2)
    assert.ok(lengths.every((length) => length <= 4))
    assert.ok(Math.abs(lengths[0] - lengths[1]) <= 1)
    assert.deepEqual(result.lines.join(' ').split(' '), result.tokens)
  }
})

test('the largest incomplete set stays complete and balanced within exactly two compact lines', () => {
  // Missing one member of each group leaves fourteen tokens, the largest uncompressed set.
  const incomplete = CLASS_ABBRS.filter((member) => member !== 'WAR' && member !== 'WIZ')
  const result = gearClassText(incomplete)
  assert.deepEqual(result.tokens, incomplete)
  assert.equal(result.compact, true)
  assert.equal(result.lines.length, 2)
  assert.deepEqual(result.lines.map((line) => line.split(' ').length), [7, 7])
  assert.deepEqual(result.lines.join(' ').split(' '), incomplete)
  for (let count = 0; count <= CLASS_ABBRS.length; count++) {
    assert.ok(gearClassText(CLASS_ABBRS.slice(0, count)).lines.length <= 2, `class count ${count}`)
  }
})
