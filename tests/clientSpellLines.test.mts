// CAPTURED SPELL LINES — the conservative grouping behind the "Best in line" browse switch
// (src/shared/clientSpellLines.ts). Lines come from the EQEmu displayNameId stack, not from
// name or recast-time guesses; oversized or ambiguous lines stay uncollapsed.
//
// Everything here is pure: no Electron, no fixtures beyond the synthetic fixture, never skips.
//
// Run: `npm test`.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SpellLibraryQueries } from '../src/main/spellLibrary/queries'
import { bestSpellLines, spellLineCandidate } from '../src/shared/clientSpellLines'
import { clientSpellTypeLabel } from '../src/shared/clientSpellBrowse'
import type { SpellSearchQuery, SpellSearchResult } from '../src/shared/spellLibrary'
import { spellRow, storageFixture, syntheticCatalog } from './spellLibrarySynthetic.mts'

function ward(id: number, name: string, strength: number, level = 1): string[] {
  const row = spellRow(id, name, strength)
  row[28] = '1'; row[11] = '3'; row[12] = '500'; row[165] = '9001'; row[47] = String(level)
  row[172] = `1|10|0|0|100|0$4|1|${strength}|0|100|0`
  return row
}
function fixture(rows: string[][]) {
  const f = storageFixture(), source = syntheticCatalog(rows, 'A ward for up to %T allies.')
  const published = f.storage.publish({ root: f.root, reason: 'startup', parserVersion: '1', ...source })
  const queries = new SpellLibraryQueries(f.storage)
  return { ...f, source, search: (query: SpellSearchQuery = {}) => queries.handle('search', { installId: published.dataset.installId, query }) as SpellSearchResult }
}
test('Best in line selects strongest eligible AC before pagination, preserves IDs and weaker search matches', () => {
  const f = fixture([ward(11, 'Small Ward', 20), ward(18, 'Middle Ward', 65, 20), ward(19, 'Large Ward', 85, 48)])
  const install = publishedInstall(f)
  try {
    const query = { bestInLine: true, level: 50, sortBy: 'name' as const, pageSize: 1 }
    const result = f.search(query)
    assert.equal(result.total, 1); assert.equal(result.matchingRecords, 3)
    assert.equal(result.records[0].id, 19)
    assert.deepEqual(result.records[0].line?.alternatives.map((r) => r.id), [18, 11])
    assert.match(result.records[0].line!.reason, /base effect strength/)
    assert.equal(f.search({ ...query, maxLevel: 30 }).records[0].id, 18)
    assert.equal(f.search({ ...query, text: 'Small' }).records[0].id, 11)
    assert.equal(f.search({ bestInLine: false }).total, 3)
    assert.equal(f.storage.observations(install).total, 1, 'UI grouping does not publish snapshots')
  } finally { f.close() }
})
function publishedInstall(f: ReturnType<typeof fixture>): string { return f.search().dataset!.installId }

test('captured poison DoT lines collapse hybrids with counters but preserve independent lines and area labels', () => {
  const rows = [spellRow(101, 'Test Small Poison'), spellRow(102, 'Test Large Poison'), spellRow(103, 'Test Other Poison')]
  for (const row of rows) { row[11] = '5'; row[12] = '2'; row[165] = '5001'; row[29] = '4'; row[172] = '1|36|5|0|100|0$2|79|-10|0|100|0$3|0|-20|0|100|0' }
  rows[1][172] = '1|36|10|0|100|0$2|79|-20|0|100|0$3|0|-40|0|100|0'
  rows[2][165] = '5002'
  const f = fixture(rows)
  try {
    const result = f.search({ bestInLine: true, level: 50 })
    assert.equal(result.total, 2)
    assert.deepEqual(result.records.find((r) => r.id === 102)?.line?.alternatives.map((r) => r.id), [101])
    const area = { ...f.source.records[0], target: 8, aoeDurationMs: 5, fields: { ...f.source.records[0].fields, aeMaxTargets: 4 } }
    assert.equal(clientSpellTypeLabel(area), 'AoE4 DoT')
    assert.equal(spellLineCandidate(area, 50), null, 'unverified repeated applications are not grouped')
  } finally { f.close() }
})

test('ambiguous or incompatible definitions are not collapsed by category, name or equal recast time', () => {
  const rows = [ward(1, 'AC one', 20), ward(2, 'AC two', 60), ward(3, 'AC three', 90), ward(4, 'AC four', 100)]
  rows[1][172] = '5|1|60|0|100|0' // different slot
  rows[2][30] = '6' // self vs single target
  rows[3][172] = '4|1|100|0|100|0$5|69|50|0|100|0' // additional effect
  const dot = spellRow(5, 'Dot'); dot[11] = '5'; dot[165] = '9001'
  const otherDot = [...dot]; otherDot[0] = '6'; otherDot[1] = 'Other Dot'; otherDot[165] = '9002'
  const rain = spellRow(7, 'Rain'); rain[13] = '7500'; rain[30] = '8'; rain[165] = '9001'
  const secondRain = [...rain]; secondRain[0] = '8'; secondRain[1] = 'Second Rain'
  const f = fixture([...rows, dot, otherDot, rain, secondRain])
  try {
    assert.equal(f.search({ bestInLine: true, level: 50 }).total, 8)
    assert.ok(f.search({ bestInLine: true }).records.every((r) => !r.line))
    const record = f.source.records[0]
    for (const override of [{ classes: [] }, { effects: [{ ...record.effects[1], calc: 999 }] }, { fields: { ...record.fields, displayNameId: 0 } }, { fields: { ...record.fields, recourse: 10 } }]) assert.equal(spellLineCandidate({ ...record, ...override }, 50), null)
  } finally { f.close() }
})
test('uniform type metadata and description sorting cover all matches, not the visible page', () => {
  const f = fixture([ward(1, 'Ward', 20), spellRow(2, 'Bolt')])
  try {
    const page = f.search({ pageSize: 1, sortBy: 'description' })
    assert.equal(page.matchingTypes!.length, 2)
    assert.equal(f.search({ type: 'other', pageSize: 1 }).matchingTypes!.length, 1)
    assert.doesNotMatch(page.records[0].description!, /%T/)
    assert.equal(f.search({ hpFilter: 'damage' }).records[0].id, 2)
    assert.equal(f.search({ hpFilter: 'healing' }).total, 0)
    assert.throws(() => f.search({ bestInLine: 'yes' } as never), /Invalid bestInLine/)
  } finally { f.close() }
})
test('large lines stay uncollapsed so a page cannot push an entire catalog to the renderer', () => {
  const records = syntheticCatalog(Array.from({ length: 33 }, (_, i) => ward(i + 1, `Ward ${i}`, i + 1))).records
  const candidates = new Map(records.map((r) => [r.id, spellLineCandidate(r, 50)!]))
  assert.equal(bestSpellLines(records, candidates).length, 33)
})
