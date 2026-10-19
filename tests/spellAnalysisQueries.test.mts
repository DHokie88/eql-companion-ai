import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SpellLibraryQueries } from '../src/main/spellLibrary/queries'
import { SpellQueryCache } from '../src/main/spellLibrary/queryCache'
import type { SpellByLevelResult, SpellRankingsQuery, SpellRankingsResult } from '../src/shared/spellAnalysis'
import type { SpellComparisonResult, SpellDetailResult, SpellSearchResult } from '../src/shared/spellLibrary'
import { defaultSpellModifierPreferences, type SpellModifierContext } from '../src/shared/spellModifiers'
import { spellRow, storageFixture, syntheticCatalog } from './spellLibrarySynthetic.mts'

const single = { scope: 'single', targets: 4 } as const
function observedContext(): SpellModifierContext {
  const preferences = defaultSpellModifierPreferences()
  preferences.mode = 'emulate'; preferences.emulation.rank = 5; preferences.emulation.focus = 'none'
  return { revision: 'synthetic-inputs', modelVersion: '1', character: { key: 'synthetic', name: 'Synthetic', server: 'test' },
    preferences, ranks: { 'synthetic bolt': { name: 'Synthetic Bolt', rank: 9 } },
    inventory: { state: 'ready', exportedAt: null, candidates: [], warnings: [] }, warnings: [] }
}
function fixture(rows: string[][], description?: string) {
  const f = storageFixture(), source = f.storage.publish({ root: f.root, reason: 'startup', parserVersion: '1', ...syntheticCatalog(rows, description) })
  const queries = new SpellLibraryQueries(f.storage)
  return { ...f, dataset: source.dataset, call<T>(method: string, query: unknown, modifiers?: SpellModifierContext): T {
    return queries.handle(method, { installId: source.dataset.installId, query, modifiers }) as T
  }, rankings(query: Partial<SpellRankingsQuery> = {}, modifiers?: SpellModifierContext) {
    return queries.handle('rankings', { installId: source.dataset.installId,
      query: { level: 50, classes: ['WIZ'], categoryTab: 'dd', analysis: single, ...query }, modifiers }) as SpellRankingsResult
  } }
}
const ids = (result: { records: { id: number }[] }): number[] => result.records.map((r) => r.id)

test('detail and By level resolve maximum targets while preserving captured source history', () => {
  const row = spellRow(1, 'Synthetic Area Song'); row[143] = '8'
  const f = fixture([row], 'Binds up to %T nearby enemies.')
  try {
    const detail = f.call<SpellDetailResult>('detail', { id: 1, level: 50 })
    assert.equal(detail.presentation?.description, 'Binds up to 8 nearby enemies.')
    assert.equal(detail.record?.description, 'Binds up to %T nearby enemies.')
    const levels = f.call<SpellByLevelResult>('byLevel', { level: 1, classes: ['WIZ'], view: 'at' })
    assert.equal(levels.records[0].description, detail.presentation?.description)
    assert.equal(f.storage.observations(f.dataset.installId).total, 1)
  } finally { f.close() }
})

test('rankings sort the entire eligible catalog before paging and default to paid efficiency', () => {
  const rows = Array.from({ length: 45 }, (_, i) => spellRow(i + 1, `Bolt ${i + 1}`, 10, 10 + i))
  const free = spellRow(90, 'Free Bolt', 0, 1000), excluded = spellRow(91, 'Unsupported Bolt')
  excluded[172] = '1|0|-100|0|999|0'
  const f = fixture([...rows, free, excluded])
  try {
    const first = f.rankings(), second = f.rankings({ page: 2 })
    assert.equal(first.pageSize, 40); assert.equal(first.total, 45)
    assert.deepEqual(ids(first).slice(0, 3), [45, 44, 43]); assert.deepEqual(ids(second), [5, 4, 3, 2, 1])
    assert.deepEqual(first.groupCounts, { ranked: 45, zeroMana: 1, excluded: 1 })
    assert.deepEqual(first.counts, { dd: 47, dot: 0, aoe: 0, heal: 0, hot: 0 })
    assert.equal(first.highlights.find((h) => h.kind === 'efficiency')?.record?.id, 45)
    assert.equal(first.highlights.find((h) => h.kind === 'amount')?.record?.id, 90)
    const zero = f.rankings({ group: 'zero-mana' })
    assert.deepEqual(ids(zero), [90]); assert.equal(zero.records[0].calculation.perMana, null)
    const unsupported = f.rankings({ group: 'excluded' })
    assert.deepEqual(ids(unsupported), [91]); assert.ok(unsupported.records[0].calculation.reasons.length > 0)
    assert.equal(f.storage.observations(f.dataset.installId).total, 1)
  } finally { f.close() }
})

test('all ranking columns have deterministic ties and unknown rates remain last in either direction', () => {
  const first = spellRow(1, 'A Bolt'), second = spellRow(2, 'B Bolt'), unknown = spellRow(3, 'No cycle')
  first[8] = '2000'; second[8] = '1000'
  const f = fixture([first, second, unknown])
  try {
    assert.deepEqual(ids(f.rankings({ sortBy: 'rate', direction: 'desc' })), [2, 1, 3])
    assert.deepEqual(ids(f.rankings({ sortBy: 'rate', direction: 'asc' })), [1, 2, 3])
    assert.deepEqual(ids(f.rankings({ sortBy: 'amount' })), [1, 2, 3])
    for (const sortBy of ['id', 'name', 'level', 'mana', 'efficiency', 'cast', 'recovery', 'recast', 'duration', 'ticks', 'waves', 'targets', 'hits'] as const) {
      assert.equal(f.rankings({ sortBy }).total, 3)
    }
  } finally { f.close() }
})

test('ranking category counts and highlights honor Browse filters, class union and level bounds', () => {
  const dd = spellRow(1, 'Damage'), dot = spellRow(2, 'Damage Periodic'), area = spellRow(3, 'Area Damage')
  const heal = spellRow(4, 'Healing'), hot = spellRow(5, 'Healing Periodic'), future = spellRow(6, 'Future')
  const dual = spellRow(7, 'Dual Class')
  dot[11] = '7'; dot[12] = '3'; area[30] = '8'; area[143] = '4'
  heal[28] = '1'; heal[172] = '1|0|100|0|100|0'
  hot[28] = '1'; hot[11] = '7'; hot[12] = '3'; hot[172] = '1|0|100|0|100|0'
  future[47] = '60'; dual[37] = '1'; dual[47] = '20'
  const f = fixture([dd, dot, area, heal, hot, future, dual])
  try {
    assert.deepEqual(f.rankings().counts, { dd: 3, dot: 1, aoe: 1, heal: 1, hot: 1 })
    assert.deepEqual(ids(f.rankings({ categoryTab: 'aoe', analysis: { scope: 'pack', targets: 4 } })), [3])
    assert.deepEqual(ids(f.rankings({ categoryTab: 'heal', polarity: 'beneficial' })), [4])
    assert.equal(f.rankings({ mana: 'free' }).highlights[0].record, null)
    assert.deepEqual(ids(f.rankings({ text: '1' })), [1])
    assert.equal(f.rankings({ effect: 124 }).total, 0)
    assert.deepEqual(ids(f.rankings({ classes: ['CLR', 'WIZ'], minLevel: 10, maxLevel: 30 })), [])
    assert.deepEqual(ids(f.rankings({ classes: ['WIZ'], minLevel: 10, maxLevel: 30 })), [7])
    assert.equal(f.rankings({ allLevels: true, maxLevel: 60 }).counts.dd, 4)
    assert.deepEqual(f.rankings({ category: 'Damage', subcategory: 'Direct' }).categories, ['Damage'])
  } finally { f.close() }
})

test('optional analysis agrees across rankings, Browse, details and Compare while omitted requests remain unchanged', () => {
  const row = spellRow(1, 'Synthetic Bolt', 10, 100); row[8] = '2000'; row[30] = '8'; row[143] = '4'
  const f = fixture([row]), modifiers = observedContext()
  const evaluation = { mode: 'emulate', contextRevision: modifiers.revision, classes: ['WIZ'] }
  const analysis = { scope: 'pack', targets: 4 }
  try {
    const rank = f.rankings({ categoryTab: 'aoe', evaluation, analysis } as SpellRankingsQuery, modifiers).records[0].calculation
    const detail = f.call<SpellDetailResult>('detail', { id: 1, level: 50, evaluation, analysis }, modifiers)
    const compare = f.call<SpellComparisonResult>('compare', { ids: [1], level: 50, metric: 'damage', evaluation, analysis }, modifiers)
    const browse = f.call<SpellSearchResult>('search', { level: 50, evaluation, analysis }, modifiers)
    assert.deepEqual(rank, detail.calculations?.[0]); assert.deepEqual(rank, compare.results[0]); assert.deepEqual(rank, browse.records[0].calculations?.[0])
    assert.equal(rank.analysis?.scope, 'aggregate pack total'); assert.equal(rank.analysis?.contextRevision, modifiers.revision)
    assert.equal(rank.modifiers?.rank, 5); assert.ok(rank.total! > 400)
    const legacy = f.call<SpellComparisonResult>('compare', { ids: [1], level: 50, metric: 'damage' })
    assert.equal(legacy.results[0].total, 100); assert.equal(legacy.results[0].analysis, undefined)
    assert.equal(f.call<SpellDetailResult>('detail', { id: 1 }).calculations, undefined)
    assert.equal(f.storage.snapshots(f.dataset.installId).length, 1)
  } finally { f.close() }
})

test('By level groups earliest eligible class levels and detected rank ignores simulated rank overrides', () => {
  const now = spellRow(1, 'Synthetic Bolt'), soon = spellRow(2, 'Soon'), last = spellRow(3, 'Last'), later = spellRow(4, 'Later')
  const dual = spellRow(5, 'Dual'), duplicate = spellRow(6, 'Soon'), internal = spellRow(7, 'Internal')
  now[47] = '20'; soon[47] = '21'; last[47] = '30'; later[47] = '31'; dual[37] = '1'; dual[47] = '22'
  duplicate[47] = '21'; internal[47] = '255'
  const f = fixture([now, soon, last, later, dual, duplicate, internal]), modifiers = observedContext()
  modifiers.ranks!['soon'] = { name: 'Soon', rank: 10 }
  const evaluation = { mode: 'emulate', contextRevision: modifiers.revision, classes: ['WIZ'] }
  try {
    const at = f.call<SpellByLevelResult>('byLevel', { level: 20, classes: ['WIZ'], view: 'at', evaluation, analysis: single }, modifiers)
    assert.deepEqual(ids(at), [1]); assert.equal(at.records[0].detectedRank, 9)
    assert.deepEqual(ids(f.call<SpellByLevelResult>('byLevel', { level: 20, throughLevel: 30, classes: ['WIZ'], view: 'at' })), [1])
    assert.equal(at.records[0].calculations?.[0].modifiers?.rank, 5)
    assert.equal(at.records[0].calculations?.[0].analysis?.level, 20)
    assert.equal(at.records[0].description, 'Synthetic description')
    const upcoming = f.call<SpellByLevelResult>('byLevel', { level: 20, classes: ['CLR', 'WIZ'], view: 'upcoming' }, modifiers)
    assert.deepEqual(ids(upcoming), [2, 6, 3]); assert.equal(upcoming.throughLevel, 30)
    assert.deepEqual(upcoming.records.map((r) => r.learnedLevel), [21, 21, 30])
    const nameSorted = f.call<SpellByLevelResult>('byLevel', { level: 20, classes: ['WIZ'], view: 'upcoming', sortBy: 'name', direction: 'asc' })
    assert.deepEqual(ids(nameSorted), [5, 3, 2, 6], 'By level honors the selected full-catalog sort before pagination')
    assert.equal(upcoming.records[0].detectedRank, null, 'duplicate names never inherit a detected mote upgrade')
    const edited = f.call<SpellByLevelResult>('byLevel', { level: 20, throughLevel: 31, classes: ['WIZ'], view: 'upcoming', pageSize: 2, page: 2 })
    assert.deepEqual(ids(edited), [5, 3]); assert.equal(edited.total, 5)
    assert.equal(f.call<SpellByLevelResult>('byLevel', { level: 255, view: 'upcoming' }).total, 0)
  } finally { f.close() }
})

test('rankings and By level validate bounded analysis settings and cache contexts do not leak or stale', () => {
  const f = fixture([spellRow()]), modifiers = observedContext()
  try {
    for (const query of [{ analysis: { scope: 'pack', targets: 0 } }, { analysis: { scope: 'pack', targets: 101 } },
      { analysis: { scope: 'pack', targets: 1.5 } }, { analysis: { scope: 'pack', targets: 'all' } },
      { analysis: { scope: 'pack', targets: 4, sql: 'SELECT 1' } }, { categoryTab: 'buff' }, { group: 'anything' }, { sortBy: 'bad' }]) {
      assert.throws(() => f.rankings(query as Partial<SpellRankingsQuery>))
    }
    assert.throws(() => f.call('byLevel', { level: 50, throughLevel: 40, view: 'upcoming' }), /Through level/)
    assert.throws(() => f.rankings({ minLevel: 40, maxLevel: 10 }), /Minimum spell level/)
    const query = { evaluation: { mode: 'emulate', contextRevision: modifiers.revision, classes: ['WIZ'] } } as Partial<SpellRankingsQuery>
    const first = f.rankings(query, modifiers)
    first.records[0].calculation.total = -1
    assert.ok(f.rankings(query, modifiers).records[0].calculation.total! > 0, 'cached results cannot be mutated by callers')
    const next = structuredClone(modifiers); next.revision = 'changed'; next.preferences.emulation.rank = 10
    assert.ok(f.rankings({ evaluation: { ...query.evaluation!, contextRevision: next.revision } }, next).records[0].calculation.total! >
      f.rankings(query, modifiers).records[0].calculation.total!)
    assert.throws(() => f.rankings(query, next), /inputs changed/)
    const updated = spellRow(); updated[172] = '1|0|-200|0|100|0'
    f.storage.publish({ root: f.root, reason: 'manual', parserVersion: '1', ...syntheticCatalog([updated]) })
    assert.equal(f.rankings().records[0].calculation.total, 200)
    assert.equal(f.rankings({ snapshotId: f.dataset.snapshotId }).records[0].calculation.total, 100)
  } finally { f.close() }
})

test('By level amount sorting evaluates client values even without modifier or analysis options', () => {
  const f = fixture([spellRow(1, 'Mid', 10, 80), spellRow(2, 'Low', 10, 50), spellRow(3, 'High', 10, 135)])
  try {
    assert.deepEqual(ids(f.call<SpellByLevelResult>('byLevel', { level: 1, classes: ['WIZ'], view: 'at', sortBy: 'amount', direction: 'desc' })), [3, 1, 2])
  } finally { f.close() }
})

test('bounded query cache keys all settings and evicts the least recently used result', () => {
  const cache = new SpellQueryCache(2), a = cache.key('rankings', { a: 1, b: 2 })
  assert.equal(a, cache.key('rankings', { b: 2, a: 1 }))
  assert.notEqual(a, cache.key('rankings', { a: 1, b: 3 }))
  assert.notEqual(a, cache.key('byLevel', { a: 1, b: 2 }))
  cache.set(a, { value: 1 }); cache.set('b', { value: 2 }); cache.get(a); cache.set('c', { value: 3 })
  assert.equal(cache.get('b'), undefined); assert.deepEqual(cache.get(a), { value: 1 })
})

test('unchanged queries and provenance-only inventory rewrites do not rescan the catalog', () => {
  const f = fixture([spellRow()]), modifiers = observedContext()
  const original = f.storage.records.bind(f.storage)
  let scans = 0
  f.storage.records = (snapshotId: string) => { scans++; return original(snapshotId) }
  try {
    const query = { evaluation: { mode: 'emulate', contextRevision: modifiers.revision, classes: ['WIZ'] } } as Partial<SpellRankingsQuery>
    f.rankings(query, modifiers)
    const before = scans
    f.rankings(query, modifiers)
    const refreshed = structuredClone(modifiers); refreshed.inventory.exportedAt = '2026-10-18T20:00:00Z'
    f.rankings(query, refreshed)
    assert.equal(scans, before)
    f.rankings({ ...query, analysis: { scope: 'pack', targets: 8 } }, modifiers)
    assert.ok(scans > before)
  } finally { f.close() }
})

test('cached bard rankings, highlights and By level refresh export provenance without another scan', () => {
  const row = spellRow(1, 'Synthetic String Recovery', 10, 4)
  row[47] = '255'; row[43] = '50'; row[32] = '49'; row[28] = '1'; row[11] = '5'; row[12] = '2'; row[172] = '1|0|4|0|100|0'
  const f = fixture([row]), context = observedContext()
  context.inventory.instruments = { sources: [], warnings: [] }
  context.inventory.exportedAt = '2026-10-18T10:00:00Z'
  const evaluation = { mode: 'emulate', contextRevision: context.revision, classes: ['BRD'] } as const
  const ranking = { classes: ['BRD'], categoryTab: 'hot', evaluation } as Partial<SpellRankingsQuery>
  const byLevel = { classes: ['BRD'], level: 50, view: 'at', analysis: single, evaluation }
  const original = f.storage.records.bind(f.storage)
  let scans = 0
  f.storage.records = (snapshotId: string) => { scans++; return original(snapshotId) }
  try {
    assert.equal(f.rankings(ranking, context).records[0].calculation.modifiers?.instrument?.exportedAt, context.inventory.exportedAt)
    f.call('byLevel', byLevel, context)
    const before = scans, refreshed = structuredClone(context)
    refreshed.inventory.exportedAt = '2026-10-18T20:00:00Z'
    const ranked = f.rankings(ranking, refreshed)
    assert.equal(ranked.records[0].calculation.modifiers?.instrument?.exportedAt, refreshed.inventory.exportedAt)
    assert.equal(ranked.highlights[0].record?.calculation.modifiers?.instrument?.exportedAt, refreshed.inventory.exportedAt)
    const levels = f.call<SpellByLevelResult>('byLevel', byLevel, refreshed)
    assert.equal(levels.records[0].calculations?.[0].modifiers?.instrument?.exportedAt, refreshed.inventory.exportedAt)
    assert.equal(scans, before)
  } finally { f.close() }
})
