import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { spawn } from 'node:child_process'
import { SPELL_SOURCE_FILES, type SpellRankingResult, type SpellSearchResult } from '../src/shared/spellLibrary'
import { SpellLibraryStorage, spellInstallId } from '../src/main/spellLibrary/storage'
import { SpellLibraryQueries } from '../src/main/spellLibrary/queries'
import { spellDifferences } from '../src/main/spellLibrary/differences'
import { spellRow, storageFixture, syntheticCatalog } from './spellLibrarySynthetic.mts'

test('immutable content-addressed history records A > B > A and parser upgrades independently', () => {
  const f = storageFixture()
  try {
    const a = syntheticCatalog(), b = syntheticCatalog([spellRow(1, 'Synthetic Bolt', 20)])
    const first = f.storage.publish({ root: f.root, reason: 'startup', parserVersion: '1', ...a })
    const second = f.storage.publish({ root: f.root, reason: 'manual', parserVersion: '1', ...b })
    const rollback = f.storage.publish({ root: f.root, reason: 'game-launch', parserVersion: '1', ...a })
    assert.equal(first.observation.outcome, 'baseline')
    assert.equal(second.observation.outcome, 'changed')
    assert.equal(second.observation.counts.interpreted, 1)
    assert.equal(rollback.observation.outcome, 'rollback')
    assert.equal(rollback.dataset.snapshotId, first.dataset.snapshotId)
    assert.equal(rollback.observation.previousSnapshotId, second.dataset.snapshotId)
    const upgraded = f.storage.publish({ root: f.root, reason: 'startup', parserVersion: '2', ...a })
    assert.equal(upgraded.observation.outcome, 'parser-upgrade')
    assert.equal(upgraded.dataset.contentId, first.dataset.contentId)
    assert.notEqual(upgraded.dataset.snapshotId, first.dataset.snapshotId)
    const same = f.storage.publish({ root: f.root, reason: 'manual', parserVersion: '2', ...a })
    assert.equal(same.observation.outcome, 'unchanged')
    assert.equal(f.storage.observations(first.dataset.installId).total, 5)
    assert.equal(f.storage.db.prepare('SELECT count(*) AS n FROM revisions').get()?.n, 2, 'a parser upgrade shares unchanged immutable records')
    assert.equal(f.storage.db.prepare('SELECT count(*) AS n FROM snapshots').get()?.n, 3)
    assert.ok(existsSync(first.materializedDir), 'writer leaves old generations until coordinator releases readers')
  } finally { f.close() }
})

test('string-only, unmodeled raw, format, added and removed changes remain distinguishable', () => {
  const f = storageFixture()
  try {
    const a = syntheticCatalog([spellRow(), spellRow(2, 'Synthetic Removed')])
    const b = syntheticCatalog([spellRow(), spellRow(3, 'Synthetic Added')], 'Updated description')
    const first = f.storage.publish({ root: f.root, reason: 'startup', parserVersion: '1', ...a })
    const second = f.storage.publish({ root: f.root, reason: 'manual', parserVersion: '1', ...b })
    assert.deepEqual(second.observation.counts, { added: 1, removed: 1, changed: 1, interpreted: 1, rawOnly: 0 })
    const queries = new SpellLibraryQueries(f.storage)
    const args = { installId: first.dataset.installId, query: { id: 1, beforeSnapshotId: first.dataset.snapshotId, afterSnapshotId: second.dataset.snapshotId } }
    const changed = queries.handle('beforeAfter', args) as { differences: { field: string; kind: string }[] }
    assert.ok(changed.differences.some((diff) => diff.field === 'description' && diff.kind === 'interpreted'))
    const raw = spellRow(); raw[160] = 'unmodeled-data'
    const third = f.storage.publish({ root: f.root, reason: 'manual', parserVersion: '1', ...syntheticCatalog([raw, spellRow(3, 'Synthetic Added')], 'Updated description') })
    assert.equal(third.observation.counts.rawOnly, 1)
    assert.equal(third.observation.counts.interpreted, 0)
    const layout = structuredClone(a.records[0]); layout.layout = 174; layout.rawFields.splice(74, 0, 'extra')
    assert.ok(spellDifferences(a.records[0], layout).some((diff) => diff.kind === 'format'))
  } finally { f.close() }
})

test('archived byte-exact sources reconstruct after cleanup; other installs cannot query a snapshot', () => {
  const f = storageFixture()
  try {
    const a = syntheticCatalog()
    const result = f.storage.publish({ root: f.root, reason: 'startup', parserVersion: '1', ...a })
    assert.equal(f.storage.cleanup([]), 1)
    assert.equal(existsSync(result.materializedDir), false)
    const restored = f.storage.materialize(result.dataset.installId, result.dataset.snapshotId)
    for (const name of SPELL_SOURCE_FILES) assert.deepEqual(readFileSync(join(restored.materializedDir, name)), a.capture.sources[name])
    assert.ok(readdirSync(join(f.options.storageDir, 'sources')).every((name) => name.endsWith('.gz')))
    const other = join(f.directory, 'other-game'); mkdirSync(other)
    assert.throws(() => f.storage.dataset(spellInstallId(other), result.dataset.snapshotId), /installation/)
    const shared = f.storage.publish({ root: other, reason: 'installation-change', parserVersion: '1', ...a })
    assert.equal(shared.dataset.contentId, result.dataset.contentId)
    assert.equal(shared.dataset.snapshotId, result.dataset.snapshotId)
    assert.notEqual(shared.dataset.installId, result.dataset.installId)
    assert.equal(f.storage.db.prepare('SELECT count(*) AS n FROM revisions').get()?.n, 1)
    assert.throws(() => f.storage.cleanup([f.directory]), /outside/)
    assert.equal(f.storage.cleanup([shared.materializedDir]), 1)
    assert.ok(existsSync(shared.materializedDir))
  } finally { f.close() }
})

test('failed imports roll back membership and current pointer; diagnostic history preserves prior valid dataset', () => {
  const f = storageFixture()
  try {
    const a = f.storage.publish({ root: f.root, reason: 'startup', parserVersion: '1', ...syntheticCatalog() })
    f.storage.db.exec("CREATE TRIGGER fail_test BEFORE INSERT ON members WHEN NEW.spell_id=999 BEGIN SELECT RAISE(ABORT, 'injected import failure'); END;")
    assert.throws(() => f.storage.publish({ root: f.root, reason: 'manual', parserVersion: '1', ...syntheticCatalog([spellRow(999)]) }), /injected/)
    assert.equal(f.storage.active(a.dataset.installId)?.snapshotId, a.dataset.snapshotId)
    assert.equal(f.storage.db.prepare('SELECT count(*) AS n FROM snapshots').get()?.n, 1)
    assert.equal(readdirSync(join(f.options.storageDir, 'materialized')).length, 1)
    f.storage.recordFailure(f.root, 'manual', 'injected failure')
    const latest = f.storage.observations(a.dataset.installId).observations[0]
    assert.equal(latest.outcome, 'error')
    assert.equal(latest.snapshotId, a.dataset.snapshotId)
    const duplicated = syntheticCatalog(); duplicated.records.push(duplicated.records[0])
    assert.throws(() => f.storage.publish({ root: f.root, reason: 'manual', parserVersion: '1', ...duplicated }), /duplicate/)
  } finally { f.close() }
})

test('WAL reader pins a consistent snapshot while writer publishes; reopening restores the valid current dataset', () => {
  const f = storageFixture()
  let reader: SpellLibraryStorage | undefined
  try {
    const a = f.storage.publish({ root: f.root, reason: 'startup', parserVersion: '1', ...syntheticCatalog() })
    reader = new SpellLibraryStorage(f.options, true)
    reader.readConsistent(() => {
      assert.equal(reader?.active(a.dataset.installId)?.snapshotId, a.dataset.snapshotId)
      f.storage.publish({ root: f.root, reason: 'manual', parserVersion: '1', ...syntheticCatalog([spellRow(1, 'Changed')]) })
      assert.equal(reader?.active(a.dataset.installId)?.snapshotId, a.dataset.snapshotId)
    })
    assert.notEqual(reader.active(a.dataset.installId)?.snapshotId, a.dataset.snapshotId)
    assert.equal(reader.db.prepare('PRAGMA foreign_keys').get()?.foreign_keys, 1)
    assert.equal(reader.db.prepare('PRAGMA journal_mode').get()?.journal_mode, 'wal')
  } finally { reader?.close(); f.close() }
})

test('search paginates the full catalog and rankings find strongest spells beyond the visible page', () => {
  const f = storageFixture()
  try {
    const rows = Array.from({ length: 320 }, (_, index) => spellRow(index + 1, 'Duplicate Name', 10, index + 1))
    rows[319][14] = '0'
    const periodic = spellRow(999, 'Synthetic Periodic', 10, 100); periodic[11] = '5'
    const unsupported = spellRow(1000, 'Synthetic Unknown'); unsupported[172] = '1|0|-100|0|777|0'
    const result = f.storage.publish({ root: f.root, reason: 'startup', parserVersion: '1', ...syntheticCatalog([...rows, periodic, unsupported]) })
    const queries = new SpellLibraryQueries(f.storage), installId = result.dataset.installId
    const page = queries.handle('search', { installId, query: { page: 2, pageSize: 200 } }) as SpellSearchResult
    assert.equal(page.total, 322); assert.equal(page.records.length, 122); assert.equal(page.records[0].id, 201)
    const rank = queries.handle('rank', { installId, query: { level: 60, metric: 'damage', ranking: 'amount', limit: 3 } }) as SpellRankingResult
    assert.equal(rank.scanned, 322); assert.equal(rank.direct[0].id, 319)
    assert.equal(rank.periodic[0].id, 999); assert.equal(rank.zeroMana[0].id, 320)
    assert.equal(rank.excludedCount, 1); assert.equal(rank.excluded[0].id, 1000)
    assert.throws(() => queries.handle('search', { installId, query: { pageSize: 50000 } }), /pageSize/)
    assert.throws(() => queries.handle('rank', { installId, query: { level: '60', metric: 'damage', ranking: 'amount' } }), /level/)
    assert.throws(() => queries.handle('detail', { installId, query: { id: 1, sourcePath: 'secret' } }), /Unknown query/)
    assert.throws(() => queries.handle('detail', { installId, query: { id: NaN } }), /spell ID/)
  } finally { f.close() }
})

test('corrupt archived sources fail materialization without publishing or leaking partial generations', () => {
  const f = storageFixture()
  try {
    const result = f.storage.publish({ root: f.root, reason: 'startup', parserVersion: '1', ...syntheticCatalog() })
    const hash = result.dataset.hashes['spells_us.txt']
    writeFileSync(join(f.options.storageDir, 'sources', `${hash}.gz`), 'corrupt')
    assert.throws(() => f.storage.materialize(result.dataset.installId, result.dataset.snapshotId))
    assert.equal(readdirSync(join(f.options.storageDir, 'materialized')).length, 1)
    assert.equal(f.storage.active(result.dataset.installId)?.snapshotId, result.dataset.snapshotId)
  } finally { f.close() }
})

test('a writer process killed during publication leaves the previous active snapshot intact', async () => {
  const f = storageFixture()
  try {
    const baseline = f.storage.publish({ root: f.root, reason: 'startup', parserVersion: '1', ...syntheticCatalog() })
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
      import { DatabaseSync } from 'node:sqlite';
      const db = new DatabaseSync(process.argv[1]);
      db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;');
      db.prepare('UPDATE installs SET current_snapshot=NULL WHERE id=?').run(process.argv[2]);
      process.stdout.write('ready');
      process.stdin.resume();
    `, f.options.databasePath, baseline.dataset.installId], { stdio: ['pipe', 'pipe', 'pipe'] })
    const exited = new Promise<void>((resolve) => { child.once('exit', () => resolve()) })
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Crash fixture writer did not begin its transaction')), 10_000)
        child.once('error', (error) => { clearTimeout(timer); reject(error) })
        child.stdout.once('data', () => { clearTimeout(timer); resolve() })
      })
    } finally { child.kill('SIGKILL'); await exited }
    assert.equal(f.storage.active(baseline.dataset.installId)?.snapshotId, baseline.dataset.snapshotId)
    assert.equal(f.storage.observations(baseline.dataset.installId).total, 1)
  } finally { f.close() }
})
