import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseInventoryDump } from '../src/main/outputs/inventoryParse'
import { modifierFocusCandidates } from '../src/main/planner/modifierFocusCandidates'
import { readModifierInventory, type ModifierInventoryReader } from '../src/main/spellLibrary/modifierInventory'
import { modifierRanks } from '../src/main/spellLibrary/modifierRanks'
import type { ItemDbFile } from '../src/main/itemsDb'

const character = { name: 'Alpha', server: 'freeport' }
const header = 'Location\tName\tID\tCount\tSlots\n'
const items: ItemDbFile = { scrapedAt: '', source: 'synthetic fixture', count: 3, items: {
  mask: { page: 'Mask', stats: { effects: [{ kind: 'focus', name: 'Improved Damage II' }] } },
  charm: { page: 'Charm', stats: { effects: [{ kind: 'focus', name: 'Unmodeled Focus IX' }] } },
  robe: { page: 'Robe', stats: { effects: [] } }
} }
function reader(text: string, path = 'C:/EQ/Alpha_freeport-Inventory.txt'): ModifierInventoryReader {
  return { status: () => ({ path, updatedAt: '2026-10-18T01:00:00Z' }),
    load: () => ({ path, loadedAt: '2026-10-18T01:00:00Z', dump: parseInventoryDump(text) }), items }
}

test('equipped bodies and focus sockets retain exact names, including unsupported focus families', () => {
  const dump = parseInventoryDump(header + [
    'Face\tMask +3\t1\t1\t10', 'Face-Slot7\tCharm (Exaltation)\t2\t1\t10',
    'Face-Slot8\tMask (Exaltation)\t1\t1\t10', 'General 1\tCharm\t2\t1\t10',
    'General 1-Slot7\tCharm (Exaltation)\t2\t1\t10', 'Chest\tRobe\t3\t1\t10'
  ].join('\n'))
  assert.deepEqual(modifierFocusCandidates(dump, items), { candidates: [
    { effect: 'Improved Damage II', item: 'Mask' }, { effect: 'Unmodeled Focus IX', item: 'Charm (Exaltation)' }
  ], warnings: [] })
})

test('unknown equipped items preserve an explicit coverage warning', () => {
  const inventory = readModifierInventory(character, reader(header + 'Face\tUnknown Mask\t9\t1\t10'))
  assert.equal(inventory.state, 'ready')
  assert.deepEqual(inventory.candidates, [])
  assert.match(inventory.warnings.join(' '), /Unknown Mask/)
})

test('a valid export with no focus differs from missing and malformed exports', () => {
  const valid = readModifierInventory(character, reader(header + 'Chest\tRobe\t3\t1\t10'))
  assert.equal(valid.state, 'ready'); assert.deepEqual(valid.candidates, []); assert.deepEqual(valid.warnings, [])
  const absent = readModifierInventory(character, { ...reader(''), status: () => ({ path: null, updatedAt: null }) })
  assert.equal(absent.state, 'missing'); assert.equal(absent.exportedAt, null)
  const malformed = readModifierInventory(character, reader('unrecognized export'))
  assert.equal(malformed.state, 'error'); assert.equal(malformed.exportedAt, '2026-10-18T01:00:00Z')
})

test('other-character exports and the unselected state are never used as equipment evidence', () => {
  let loads = 0
  const source = reader(header + 'Face\tMask\t1\t1\t10', 'C:/EQ/Beta_freeport-Inventory.txt')
  const observed = { ...source, load: () => { loads++; return source.load(character) } }
  assert.equal(readModifierInventory(character, observed).state, 'missing')
  assert.equal(readModifierInventory(null, observed).state, 'missing')
  assert.equal(loads, 0)
})

test('supported legacy filenames still belong to the explicitly selected character', () => {
  for (const path of ['C:/EQ/ALPHA_FREEPORT-INVENTORY.TXT', 'C:/EQ/Alpha-Inventory.txt']) {
    assert.equal(readModifierInventory(character, reader(header, path)).state, 'ready')
  }
})

test('read-time failures and partially malformed rows remain visible', () => {
  const source = reader(header)
  const failed = readModifierInventory(character, { ...source, load: () => null })
  assert.equal(failed.state, 'error'); assert.match(failed.warnings[0], /outputfile inventory/)
  const partial = readModifierInventory(character, reader(header + 'Face\tMask\t1\t1\t10\nChest\tRobe'))
  assert.equal(partial.state, 'ready'); assert.match(partial.warnings.join(' '), /incomplete/)
})

test('rank projection distinguishes unavailable state from an empty valid observed map', () => {
  assert.equal(modifierRanks(null), null)
  assert.deepEqual(modifierRanks({}), {})
  assert.equal(modifierRanks({ strike: { name: 'Strike', rank: 99 } }), null)
  assert.equal(modifierRanks({ strike: { name: 'Strike', rank: 4.5 } }), null)
  assert.deepEqual(modifierRanks({ strike: { name: 'Strike', rank: 9, lastAt: 10 } }), { strike: { name: 'Strike', rank: 9 } })
})
