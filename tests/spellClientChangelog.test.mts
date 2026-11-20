import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SpellLibraryQueries } from '../src/main/spellLibrary/queries'
import type { SpellBeforeAfterResult, SpellChangesQuery, SpellChangesResult, SpellHistoryResult } from '../src/shared/spellLibrary'
import { spellRow, storageFixture, syntheticCatalog } from './spellLibrarySynthetic.mts'

function wider(row: string[]): string[] {
  return [...row.slice(0, 74), '0', ...row.slice(74)]
}

test('client update history compares the exact preceding capture with one parser', () => {
  const { root, storage, close } = storageFixture()
  try {
    const oldBolt = spellRow(1, 'Former Bolt', 10)
    oldBolt[43] = '5'
    oldBolt[47] = '255'
    const removed = spellRow(2, 'Removed Spell')
    const raw = spellRow(4, 'Raw Detail')
    const format = spellRow(5, 'Format Detail')
    const unchanged = spellRow(6, 'Unchanged Spell')
    const before = syntheticCatalog([oldBolt, removed, raw, format, unchanged])
    const newRaw = raw.slice()
    newRaw[27] = '1'
    const after = syntheticCatalog([wider(spellRow(1, 'Current Bolt', 20)), spellRow(3, 'Added Spell'),
      wider(newRaw), wider(format), unchanged])

    // Deliberately publish an older interpretation of the same source bytes.
    before.records.find(({ id }) => id === 6)!.mana = 999
    const first = storage.publish({ root, reason: 'startup', parserVersion: '0', ...before })
    const later = storage.publish({ root, reason: 'manual', parserVersion: '2', ...after })
    const common = { beforeSnapshotId: first.dataset.snapshotId, afterSnapshotId: later.dataset.snapshotId }
    const queries = new SpellLibraryQueries(storage)
    const run = (method: string, query: object) => queries.handle(method, { installId: first.dataset.installId, query })
    const list = (extra: Partial<SpellChangesQuery> = {}) => run('changes', { ...common, clientUpdate: true, ...extra }) as SpellChangesResult

    const main = list()
    assert.deepEqual(main.updateCounts, { added: 1, changed: 1, removed: 1, rawOnly: 1, formatOnly: 1 })
    assert.deepEqual(main.changes.map(({ id, kind }) => [id, kind]), [[3, 'added'], [1, 'interpreted'], [2, 'removed']])
    assert.deepEqual(list({ classes: ['BRD'], text: 'former' }).changes.map(({ id }) => id), [1])
    assert.equal(list({ classes: ['BRD'], text: 'removed' }).total, 0)
    assert.equal(list({ page: 2, pageSize: 1 }).changes[0].id, 1)
    assert.deepEqual(list({ section: 'raw' }).changes.map(({ id, kind }) => [id, kind]), [[4, 'raw-only']])
    assert.deepEqual(list({ section: 'format' }).changes.map(({ id, kind }) => [id, kind]), [[5, 'format']])

    const changes = run('beforeAfter', { ...common, clientUpdate: true, id: 1 }) as SpellBeforeAfterResult
    assert.equal(changes.before?.name, 'Former Bolt')
    assert.equal(changes.after?.name, 'Current Bolt')
    assert.ok(changes.differences.some(({ field, kind }) => field === 'mana' && kind === 'interpreted'))
    assert.deepEqual(changes.technicalDifferences?.map(({ field, kind }) => [field, kind]), [['layout', 'format']])
    const parserOnly = run('beforeAfter', { ...common, clientUpdate: true, id: 6 }) as SpellBeforeAfterResult
    assert.deepEqual(parserOnly.differences, [])
    assert.equal(parserOnly.before?.mana, 10)

    const parser = storage.publish({ root, reason: 'manual', parserVersion: '3', ...after })
    const rollback = storage.publish({ root, reason: 'game-launch', parserVersion: '0', ...before })
    storage.publish({ root, reason: 'manual', parserVersion: '0', ...before })
    storage.recordFailure(root, 'manual', 'Test failure')
    const latest = run('history', { updatesOnly: true, pageSize: 1 }) as SpellHistoryResult
    assert.equal(latest.totalObservations, 2)
    assert.equal(latest.observations[0].id, rollback.observation.id)
    assert.equal(latest.observations[0].previousSnapshotId, parser.dataset.snapshotId)
    const older = run('history', { updatesOnly: true, page: 2, pageSize: 1 }) as SpellHistoryResult
    assert.equal(older.observations[0].id, later.observation.id)
    assert.equal((run('history', {}) as SpellHistoryResult).totalObservations, 6)
  } finally { close() }
})
