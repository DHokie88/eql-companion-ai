import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseInventoryDump } from '../src/main/outputs/inventoryParse'
import { bardInstrumentInventory } from '../src/main/spellLibrary/bardInstrumentInventory'
import { readModifierInventory } from '../src/main/spellLibrary/modifierInventory'
import type { ItemDbEntry, ItemDbFile } from '../src/main/itemsDb'
import type { ItemStatBlock } from '../src/shared/itemStats'

const header = 'Location\tName\tID\tCount\tSlots'
function stats(extra: Partial<ItemStatBlock> = {}): ItemStatBlock {
  return { flags: [], stats: [], saves: [], effects: [], exaltationSlots: [], extras: [], ...extra }
}
function catalog(entries: Record<string, ItemDbEntry>): ItemDbFile {
  return { scrapedAt: '', source: 'Synthetic instrument fixtures', count: Object.keys(entries).length, items: entries }
}
function dump(rows: string[]) { return parseInventoryDump([header, ...rows].join('\n')) }
function row(location: string, name: string) { return `${location}\t${name}\t1\t1\t10` }
const items = catalog({
  blade: { page: 'Blade', stats: stats() },
  bag: { page: 'Bag', stats: stats() },
  lute: { page: 'Lute', stats: stats({ flags: ['String Resonance: 14'] }) },
  drums: { page: 'Drums', stats: stats({ effects: [{ kind: 'focus', name: 'Percussion Resonance: 14' }] }) },
  horn: { page: 'Horn', stats: stats({ effects: [{ kind: 'focus', name: 'Brass Resonance 13' }] }) },
  voice: { page: 'Voice', stats: stats({ effects: [{ kind: 'focus', name: 'Amplification II' }] }) }
})

test('equipped and bagged instruments retain provenance and installed focus exaltations only', () => {
  const evidence = bardInstrumentInventory(dump([
    row('Primary', 'Blade +3'), row('Primary-Slot7', 'Drums (Exaltation)'),
    row('Primary-Slot8', 'Horn (Exaltation)'), row('Secondary', 'Lute'),
    row('General 1', 'Bag'), row('General 1-Slot1', 'Horn'),
    row('General 1-Slot2', 'Blade'), row('General 1-Slot2-Slot7', 'Voice (Exaltation)'),
    row('General 2', 'Drums'), row('General 3', 'Voice (Exaltation)')
  ]), items)
  assert.deepEqual(evidence.sources.map(({ item, location, equipped, effect }) => ({ item, location, equipped, effect })), [
    { item: 'Drums (Exaltation)', location: 'Primary-Slot7', equipped: true, effect: 'Percussion Resonance 14' },
    { item: 'Lute', location: 'Secondary', equipped: true, effect: 'String Resonance 14' },
    { item: 'Horn', location: 'General 1-Slot1', equipped: false, effect: 'Brass Resonance 13' },
    { item: 'Voice (Exaltation)', location: 'General 1-Slot2-Slot7', equipped: false, effect: 'Amplification II' },
    { item: 'Drums', location: 'General 2', equipped: false, effect: 'Percussion Resonance 14' }
  ])
  assert.deepEqual(evidence.warnings, [])
})

test('bank, depot, keyring, other sections, orphan sockets and empty hosts grant no instrument', () => {
  const evidence = bardInstrumentInventory(dump([
    row('Bank1', 'Drums'), row('SharedBank1', 'Lute'), row('Personal-Depot1', 'Horn'),
    row('Primary-Slot7', 'Voice (Exaltation)'), row('General 1-Slot1', 'Lute'),
    row('Secondary', 'Empty'), row('Secondary-Slot7', 'Drums (Exaltation)'),
    'KeyRing\tName\tID', 'Equipment\tLute\t1',
    'Hoard\tName\tID\tCount\tSlots', row('Primary', 'Horn'), row('General 1', 'Drums')
  ]), items)
  assert.deepEqual(evidence.sources, [])
  assert.match(evidence.warnings.join(' '), /Orphan inventory rows/)
})

test('native resonance stats in flags, extras, stat pairs and raw blocks are exact and deduplicated', () => {
  const native = catalog({
    instrument: { page: 'Instrument', stats: stats({
      flags: ['String Resonance: 14'], extras: ['Wind Resonance: 12', 'Not Wind Resonance: 99'],
      stats: [{ key: 'BRASS RESONANCE', value: '13' }]
    }), statsBlock: 'String Resonance: 14\nPercussion Resonance: 15\nString Resonance: XIV\nClick Effect: Singing Resonance 99' }
  })
  const evidence = bardInstrumentInventory(dump([row('Secondary', 'Instrument')]), native)
  assert.deepEqual(evidence.sources.map((source) => source.effect), [
    'String Resonance 14', 'Wind Resonance 12', 'Brass Resonance 13', 'Percussion Resonance 15'
  ])
  assert.ok(evidence.sources.every((source) => source.basis === 'resonance stat'))
  assert.match(evidence.warnings.join(' '), /could not be decoded/)
})

test('click, worn, proc and combat effects never become passive instrument evidence', () => {
  const effects = catalog({
    test: { page: 'Test', stats: stats({ effects: [
      { kind: 'click', name: 'String Resonance 90' }, { kind: 'worn', name: 'String Resonance 91' },
      { kind: 'proc', name: 'String Resonance 92' }, { kind: 'combat', name: 'String Resonance 93' },
      { kind: 'effect', name: 'String Resonance 94' },
      { kind: 'focus', name: ' String Resonance II ' }, { kind: 'focus', name: 'Singing Resonance: 12' },
      { kind: 'focus', name: 'All Songs of the Test' }, { kind: 'focus', name: '' }
    ] }) }
  })
  const evidence = bardInstrumentInventory(dump([row('Primary', 'Test')]), effects)
  assert.deepEqual(evidence.sources.map((source) => source.effect), ['String Resonance II', 'Singing Resonance 12', 'All Songs of the Test'])
})

test('item, host and effect required levels are retained at the strongest explicit requirement', () => {
  const levels = catalog({
    host: { page: 'Host', stats: stats({ stats: [{ key: 'REQUIRED LEVEL', value: '45' }] }) },
    donor: { page: 'Donor', stats: stats({ extras: ['Req Level: 35'], effects: [
      { kind: 'focus', name: 'Brass Resonance 14', reqLevel: 40 },
      { kind: 'focus', name: 'Wind Resonance 15', reqLevel: 55 }
    ] }) },
    carried: { page: 'Carried', statsBlock: 'Required Level: 60\nString Resonance: 16' },
    bag: { page: 'Bag', stats: stats({ stats: [{ key: 'REQUIRED LEVEL', value: '99' }] }) }
  })
  const evidence = bardInstrumentInventory(dump([
    row('Primary', 'Host'), row('Primary-Slot7', 'Donor (Exaltation)'),
    row('General 1', 'Bag'), row('General 1-Slot1', 'Carried')
  ]), levels)
  assert.deepEqual(evidence.sources.map(({ effect, requiredLevel }) => ({ effect, requiredLevel })), [
    { effect: 'Brass Resonance 14', requiredLevel: 45 }, { effect: 'Wind Resonance 15', requiredLevel: 55 },
    { effect: 'String Resonance 16', requiredLevel: 60 }
  ])
})

test('missing catalog and modifier data stay visible with bounded warnings and no inferred resonance', () => {
  const incomplete = catalog({ blank: { page: 'Blank' }, ...items.items })
  const evidence = bardInstrumentInventory(dump([
    row('Primary', 'Missing Host'), row('Primary-Slot7', 'Drums (Exaltation)'),
    row('Secondary', 'Blank'), row('General 1', 'Bag'), row('General 1-Slot1', 'Lute'),
    ...Array.from({ length: 12 }, (_, index) => row(`General 1-Slot${index + 2}`, `Unknown ${index}`)),
    'Chest\tMalformed'
  ]), incomplete)
  assert.deepEqual(evidence.sources.map((source) => source.item), ['Lute'])
  assert.equal(evidence.warnings.length, 3)
  assert.match(evidence.warnings.join(' '), /Missing Host/)
  assert.match(evidence.warnings.join(' '), /and 8 more/)
  assert.match(evidence.warnings.join(' '), /no modifier data: Blank/)
  assert.match(evidence.warnings.join(' '), /could not be read/)
})

test('modifier inventory attaches separate instrument evidence without adding bag items to worn focus', () => {
  const character = { name: 'Synthetic', server: 'test' }
  const path = 'C:/Fixture/Synthetic_test-Inventory.txt'
  const inventory = readModifierInventory(character, {
    status: () => ({ path, updatedAt: '2026-10-18T00:00:00Z' }),
    load: () => ({ path, loadedAt: '2026-10-18T00:00:00Z', dump: dump([row('General 1', 'Lute')]) }), items
  })
  assert.equal(inventory.state, 'ready')
  assert.deepEqual(inventory.candidates, [])
  assert.equal(inventory.instruments?.sources[0].effect, 'String Resonance 14')
  assert.equal(inventory.instruments?.sources[0].equipped, false)
  assert.equal(inventory.exportedAt, '2026-10-18T00:00:00Z')
})
