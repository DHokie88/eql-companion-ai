import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SpellLibraryQueries } from '../src/main/spellLibrary/queries'
import type { SpellComparisonResult, SpellDetailResult, SpellRankingResult, SpellSearchResult } from '../src/shared/spellLibrary'
import { defaultSpellModifierPreferences, type SpellModifierContext } from '../src/shared/spellModifiers'
import { spellRow, storageFixture, syntheticCatalog } from './spellLibrarySynthetic.mts'

function context(): SpellModifierContext {
  return { revision: 'test-inputs-1', modelVersion: '1', character: { key: 'test', name: 'Test', server: 'test' },
    preferences: { ...defaultSpellModifierPreferences(), mode: 'emulate', emulation: {
      rank: 0, ranks: { '2': { rank: 10, name: 'Synthetic Ember' } }, focus: 'selected', focusIds: [300]
    } }, ranks: {}, inventory: { state: 'ready', exportedAt: '2026-10-18T00:00:00Z', candidates: [], warnings: [] }, warnings: [] }
}
function catalog(focusPercent = 10) {
  const bolt = spellRow(1, 'Synthetic Bolt', 10, 100), ember = spellRow(2, 'Synthetic Ember', 10, 90)
  bolt[32] = '24'; ember[32] = '24'
  const focus = spellRow(300, 'Synthetic Focus')
  focus[47] = '255'
  focus[172] = `1|124|${focusPercent}|20|100|0$2|138|0|0|100|0$3|137|0|0|100|0`
  const excluded = spellRow(3, 'Synthetic Unsupported')
  excluded[172] = '1|0|-100|0|999|0'
  return syntheticCatalog([bolt, ember, focus, excluded])
}

test('browse, details, comparison and exhaustive ranking use identical modifier inputs without changing history', () => {
  const fixture = storageFixture()
  try {
    const source = fixture.storage.publish({ root: fixture.root, reason: 'startup', parserVersion: '1', ...catalog() })
    const queries = new SpellLibraryQueries(fixture.storage), modifiers = context()
    const evaluation = { mode: 'emulate', contextRevision: modifiers.revision, classes: ['WIZ'] }
    const call = <T>(method: string, query: unknown): T => queries.handle(method, { installId: source.dataset.installId, query, modifiers }) as T
    const bare = call<SpellComparisonResult>('compare', { ids: [1, 2], level: 50, metric: 'damage' })
    assert.deepEqual(bare.results.map((r) => r.total), [100, 90])
    assert.equal(bare.results[0].modifiers, undefined)
    const compared = call<SpellComparisonResult>('compare', { ids: [1, 2, 3], level: 50, metric: 'damage', evaluation })
    const second = compared.results.find((r) => r.id === 2)!
    assert.ok(Math.abs(second.total! - 165.6) < 0.00001)
    assert.equal(second.modifiers?.baseline.total, 90)
    assert.equal(second.modifiers?.rank, 10)
    assert.equal(second.modifiers?.focus?.id, 300)
    const rankOnly = call<SpellSearchResult>('search', { level: 50, text: 'Synthetic Ember', evaluation: { ...evaluation, rankOnly: true }, analysis: { scope: 'single', targets: 1 } })
    assert.equal(rankOnly.records[0].calculations?.[0].total, 144, 'rank-only Browse does not multiply the equipment focus midpoint')
    assert.equal(rankOnly.records[0].calculations?.[0].modifiers?.focus, null)
    assert.equal(compared.results.find((r) => r.id === 3)?.total, null)
    const browse = call<SpellSearchResult>('search', { pageSize: 1, level: 50, classes: ['WIZ'], evaluation })
    assert.equal(browse.records.length, 1)
    assert.equal(browse.records[0].calculations?.[0].total, compared.results[0].total)
    const detail = call<SpellDetailResult>('detail', { id: 2, level: 50, evaluation })
    assert.deepEqual(detail.calculations?.[0], second)
    const ranked = call<SpellRankingResult>('rank', { level: 50, classes: ['WIZ'], metric: 'damage', ranking: 'efficiency', limit: 1, evaluation })
    assert.equal(ranked.scanned, 4)
    assert.equal(ranked.direct[0].id, 2) // Beyond the one-row search page.
    assert.deepEqual(ranked.direct[0], second)
    const sorted = call<SpellSearchResult>('search', { pageSize: 1, level: 50, classes: ['WIZ'], evaluation, sortBy: 'amount', direction: 'desc' })
    assert.equal(sorted.records[0].id, 2, 'Browse sorts by the modeled total across every matching page')
    assert.deepEqual(sorted.records[0].calculations?.[0], second)
    assert.equal(fixture.storage.observations(source.dataset.installId).total, 1)
    assert.equal(fixture.storage.snapshots(source.dataset.installId).length, 1)
  } finally { fixture.close() }
})

test('evaluation validates context and rebuilds its numeric focus index after catalog activation', () => {
  const fixture = storageFixture()
  try {
    const first = fixture.storage.publish({ root: fixture.root, reason: 'startup', parserVersion: '1', ...catalog() })
    const queries = new SpellLibraryQueries(fixture.storage), modifiers = context()
    const args = { installId: first.dataset.installId, modifiers,
      query: { ids: [1], level: 50, metric: 'damage', evaluation: { mode: 'emulate', contextRevision: modifiers.revision, classes: ['WIZ'] } } }
    assert.ok((queries.handle('compare', args) as SpellComparisonResult).results[0].total! > 100)
    assert.throws(() => queries.handle('compare', { ...args, modifiers: { ...modifiers, revision: 'stale' } }), /inputs changed/)
    assert.throws(() => queries.handle('compare', { ...args, query: { ...args.query, evaluation: { ...args.query.evaluation, sql: 'SELECT 1' } } }), /Unknown query/)
    const options = queries.handle('focusOptions', { installId: first.dataset.installId, query: { text: 'Synthetic Focus', page: 1 } }) as { total: number; records: { id: number }[] }
    assert.equal(options.total, 1); assert.equal(options.records[0].id, 300)
    const next = catalog(20)
    fixture.storage.publish({ root: fixture.root, reason: 'manual', parserVersion: '1', ...next })
    assert.equal((queries.handle('compare', args) as SpellComparisonResult).results[0].total, 120)
    const history = queries.handle('detail', { installId: first.dataset.installId, query: { id: 1, snapshotId: first.dataset.snapshotId } }) as SpellDetailResult
    assert.equal(history.calculations, undefined)
    assert.equal(history.record?.effects[0].base, -100)
  } finally { fixture.close() }
})
