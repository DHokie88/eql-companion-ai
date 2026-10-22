import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SpellLibraryQueries } from '../src/main/spellLibrary/queries'
import { capturedSpellTimer } from '../src/main/spellLibrary/bestSpellLines'
import type { SpellSearchQuery, SpellSearchResult } from '../src/shared/spellLibrary'
import type { SpellModifierContext } from '../src/shared/spellModifiers'
import { modifierContext } from './helpers/spellModifierFixtures.mts'
import { replacementRow, screenshotReplacementRows } from './helpers/replacementSpellFixtures.mts'
import { spellRow, storageFixture, syntheticCatalog } from './spellLibrarySynthetic.mts'

function fixture(rows: string[][]) {
  const f = storageFixture(), source = syntheticCatalog(rows)
  const published = f.storage.publish({ root: f.root, reason: 'startup', parserVersion: '1', ...source })
  const queries = new SpellLibraryQueries(f.storage)
  return { ...f, source, published, search(query: SpellSearchQuery = {}, modifiers?: SpellModifierContext) {
    return queries.handle('search', { installId: published.dataset.installId, query: { bestInLine: true, ...query }, modifiers }) as SpellSearchResult
  } }
}
const ids = (result: SpellSearchResult) => result.records.map((row) => row.id)

test('existing companion replacement ladders collapse the reported ten AOE rows into six choices', () => {
  const f = fixture(screenshotReplacementRows())
  const query = { level: 23, minLevel: 8, maxLevel: 23, classes: ['DRU', 'PAL', 'WIZ'], hpFilter: 'damage', type: 'dd',
    analysis: { scope: 'pack', targets: 'maximum' }, sortBy: 'efficiency', direction: 'desc', includeHighlights: true } as const
  try {
    const result = f.search(query)
    assert.deepEqual(new Set(ids(result)), new Set([467, 386, 385, 405, 27, 458]))
    assert.equal(result.matchingRecords, 10)
    assert.equal(result.total, 6)
    assert.deepEqual(result.groupCounts, { ranked: 6, zeroMana: 0, excluded: 0 })
    assert.deepEqual(result.records.flatMap((row) => row.line?.alternatives.map((alt) => alt.id) ?? []).sort((a, b) => a - b), [85, 262, 380, 382])
    assert.match(result.records.find((row) => row.id === 458)!.line!.reason, /WIZ replacement line/)
    assert.match(result.records.find((row) => row.id === 467)!.line!.reason, /Spells share recast timer 6/)
    for (const entry of result.highlights!) assert.ok(result.records.some((row) => row.id === entry.record?.id))
    assert.equal(f.search({ ...query, bestInLine: false }).total, 10)
    assert.deepEqual(ids(f.search({ ...query, pageSize: 1, page: 2 })), [result.records[1].id])
    assert.deepEqual(ids(f.search({ ...query, text: 'Column' })), [380], 'filter before grouping keeps older matches discoverable')
    assert.equal(f.storage.observations(f.published.dataset.installId).total, 1)
  } finally { f.close() }
})

test('captured positive timer IDs merge exact shared cooldown choices across geometry, with both layouts and discipline namespaces', () => {
  const first = replacementRow(1, 'Timer first', 1), second = replacementRow(2, 'Timer second', 1, { damage: 150 })
  first[97] = '12'; second[97] = '12'; second[30] = '4'; second.splice(74, 0, '0')
  const discipline = replacementRow(3, 'Discipline separate', 1); discipline[97] = '12'; discipline[98] = '1'
  const other = replacementRow(4, 'Independent cooldown', 1); other[97] = '13'
  const invalid = ['0', '-1', '1.5', 'NaN', '', '9007199254740992'].map((timer, i) => {
    const row = replacementRow(10 + i, `Invalid ${i}`, 1); row[97] = timer; return row
  })
  const f = fixture([first, second, discipline, other, ...invalid])
  try {
    const snapshot = JSON.stringify(f.source.records)
    const result = f.search({ level: 50 })
    assert.equal(result.total, 9)
    assert.deepEqual(result.records.find((row) => row.id === 2)?.line?.alternatives.map((row) => row.id), [1])
    assert.match(result.records.find((row) => row.id === 2)!.line!.reason, /Spells share recast timer 12/)
    assert.deepEqual(f.source.records.map(capturedSpellTimer), ['spell:12', 'spell:12', 'discipline:12', 'spell:13', ...invalid.map(() => null)])
    assert.equal(JSON.stringify(f.source.records), snapshot)
  } finally { f.close() }
})

test('winner uses evaluated amount, efficiency or rate before table sort, target scope and exact spell rank', () => {
  const column = replacementRow(380, 'Column of Frost', 8, { damage: 80 }), pillar = replacementRow(386, 'Pillar of Fire', 15)
  column[14] = '10'; column[143] = '8'; column[8] = '500'; column[10] = '0'
  pillar[14] = '20'; pillar[8] = '2000'; pillar[10] = '0'
  const f = fixture([column, pillar])
  try {
    assert.deepEqual(ids(f.search({ level: 23, sortBy: 'amount', direction: 'asc' })), [386])
    const efficiency = f.search({ level: 23, sortBy: 'efficiency', direction: 'asc', includeHighlights: true })
    assert.deepEqual(ids(efficiency), [380])
    assert.ok(efficiency.highlights!.every((entry) => !entry.record || entry.record.id === 380), 'highlights use collapsed choices')
    assert.deepEqual(ids(f.search({ level: 23, sortBy: 'rate', analysis: { scope: 'single', targets: 4 } })), [380])
    assert.deepEqual(ids(f.search({ level: 23, sortBy: 'amount', analysis: { scope: 'pack', targets: 'maximum' } })), [380])
    assert.deepEqual(ids(f.search({ level: 23, selectedIds: [380], sortBy: 'selected', direction: 'desc' })), [386])
    const context = modifierContext()
    context.preferences.mode = 'emulate'; context.preferences.emulation.rank = 0; context.preferences.emulation.focus = 'none'
    context.preferences.emulation.ranks = { 380: { name: 'Column of Frost', rank: 10 } }
    const evaluation = { mode: 'emulate', contextRevision: context.revision } as const
    assert.deepEqual(ids(f.search({ level: 23, sortBy: 'amount', evaluation }, context)), [380])
    assert.deepEqual(ids(f.search({ level: 10 })), [380])
    assert.deepEqual(ids(f.search({ level: 23, minLevel: 15 })), [386])
    assert.deepEqual(ids(f.search({ level: 10, allLevels: true })), [386])
  } finally { f.close() }
})

test('replacement identity respects eligible classes, target geometry, same-level branches and whole Rune names', () => {
  const column = replacementRow(1, 'Column of Frost', 8), pillar = replacementRow(2, 'Pillar of Fire', 15, { damage: 150 })
  column[41] = '1'; pillar[41] = '1'
  const f = fixture([column, pillar])
  try {
    assert.equal(f.search({ level: 23, classes: ['DRU'] }).total, 2)
    assert.equal(f.search({ level: 23, classes: ['WIZ'] }).total, 1)
    assert.equal(f.search({ level: 5, classes: ['WIZ', 'DRU'] }).total, 2, 'ineligible WIZ class entries cannot supply a replacement line')
  } finally { f.close() }
  const geometry = fixture([column, Object.assign([...pillar], { 30: '41' })])
  try { assert.equal(geometry.search({ level: 23 }).total, 2) } finally { geometry.close() }
  const branch = fixture([replacementRow(3, 'Heroism', 52, { code: 'CLR' }), replacementRow(4, 'Heroic Bond', 52, { code: 'CLR', damage: 150 })])
  try { assert.equal(branch.search({ level: 60 }).total, 2) } finally { branch.close() }
  const rune = fixture([replacementRow(5, 'Rune I', 4, { code: 'ENC' }), replacementRow(6, 'Rune II', 12, { code: 'ENC', damage: 150 })])
  try { assert.deepEqual(ids(rune.search({ level: 60 })), [6]) } finally { rune.close() }
})

test('non-ladder destinations and unrelated same-duration spells remain independent; timer joins do not duplicate families', () => {
  const unrelated = [spellRow(1, 'Unrelated first'), spellRow(2, 'Unrelated second')]
  unrelated.forEach((row) => { row[10] = '1000' })
  const travel = [replacementRow(3, 'Ring of Butcher', 20, { code: 'DRU' }), replacementRow(4, 'Ring of Surefall Glade', 20, { code: 'DRU' })]
  const f = fixture([...unrelated, ...travel])
  try { assert.equal(f.search({ level: 60 }).total, 4) } finally { f.close() }
  const rows = screenshotReplacementRows().filter((row) => [380, 386, 385].includes(Number(row[0])))
  rows[0][97] = '25'; rows[2][97] = '25'
  const merged = fixture(rows)
  try {
    const result = merged.search({ level: 23 })
    assert.equal(result.total, 1)
    assert.equal(result.records[0].line?.alternatives.length, 2)
    assert.match(result.records[0].line!.reason, /replacement line.*Spells share recast timer/s)
  } finally { merged.close() }
})

test('fallback captured DoT lines follow evaluated efficiency while stat lines retain strength ordering', () => {
  const lower = spellRow(10, 'Synthetic small poison', 5, 10), higher = spellRow(11, 'Synthetic large poison', 50, 20)
  for (const row of [lower, higher]) { row[11] = '5'; row[12] = '2'; row[165] = '9001' }
  const f = fixture([lower, higher])
  try {
    assert.deepEqual(ids(f.search({ level: 23, sortBy: 'amount' })), [11])
    assert.deepEqual(ids(f.search({ level: 23, sortBy: 'efficiency', direction: 'asc' })), [10])
    assert.equal(f.search({ level: 23, text: 'no matches' }).total, 0)
  } finally { f.close() }
  const small = replacementRow(12, 'Courage', 1, { code: 'CLR' }), large = replacementRow(13, 'Center', 7, { code: 'CLR' })
  for (const row of [small, large]) { row[28] = '1'; row[11] = '5'; row[12] = '2'; row[13] = '0'; row[165] = '9002' }
  small[172] = '1|1|50|0|100|0'; large[172] = '1|1|20|0|100|0'
  const stats = fixture([small, large])
  try { assert.deepEqual(ids(stats.search({ level: 23, sortBy: 'efficiency' })), [12]) } finally { stats.close() }
  const other = replacementRow(14, 'Different stat line', 5, { code: 'CLR' })
  other[28] = '1'; other[11] = '5'; other[12] = '2'; other[13] = '0'; other[165] = '9003'; other[172] = '1|1|30|0|100|0'
  for (const row of [small, large, other]) row[97] = '12'
  for (const rows of [[small, large, other], [other, large, small]]) {
    const mixed = fixture(rows)
    try {
      assert.deepEqual(ids(mixed.search({ level: 23 })), [13], 'mixed timer groups use one transitive order instead of pair-specific stat comparisons')
    } finally { mixed.close() }
  }
})
