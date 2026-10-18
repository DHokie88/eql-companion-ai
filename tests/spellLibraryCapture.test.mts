import assert from 'node:assert/strict'
import { readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { captureClientSpellBundle, CAPTURE_RETRY_DELAYS } from '../src/main/spellLibrary/capture'
import { SpellLibraryWriter } from '../src/main/spellLibrary/writerWorker'
import { spellInstallId } from '../src/main/spellLibrary/storage'
import type { SpellCheckResult } from '../src/main/spellLibrary/workerProtocol'
import { spellRow, storageFixture, syntheticCatalog, writeCatalog } from './spellLibrarySynthetic.mts'

test('independent message and description edits are detected even with identical sizes and timestamps', async () => {
  const f = storageFixture()
  try {
    writeCatalog(f.root)
    const baseline = await captureClientSpellBundle(f.root, { wait: async () => undefined })
    for (const name of ['spells_us_str.txt', 'dbstr_us.txt'] as const) {
      const path = join(f.root, name), stamp = statSync(path), original = readFileSync(path, 'utf8')
      writeFileSync(path, name === 'spells_us_str.txt' ? original.replace('You cast.', 'You test.') : original.replace('Synthetic description', 'Synthetic Description'))
      utimesSync(path, stamp.atime, stamp.mtime)
      assert.equal(statSync(path).size, stamp.size)
      const changed = await captureClientSpellBundle(f.root, { wait: async () => undefined })
      assert.notEqual(changed.hashes[name], baseline.hashes[name])
      assert.equal(changed.hashes['spells_us.txt'], baseline.hashes['spells_us.txt'])
      writeFileSync(path, original)
    }
  } finally { f.close() }
})

test('capture requires one second stability and hashes full files despite same mtime/size', async () => {
  const f = storageFixture()
  try {
    writeCatalog(f.root)
    const waits: number[] = []
    const first = await captureClientSpellBundle(f.root, { wait: async (ms) => { waits.push(ms) } })
    assert.deepEqual(waits, [1000])
    const path = join(f.root, 'spells_us.txt'), metadata = statSync(path)
    const prior = readFileSync(path)
    writeFileSync(path, prior.toString().replace('Synthetic Bolt', 'Synthetic Colt'))
    utimesSync(path, metadata.atime, metadata.mtime)
    assert.equal(statSync(path).size, metadata.size)
    const second = await captureClientSpellBundle(f.root, { wait: async () => undefined })
    assert.notEqual(second.hashes['spells_us.txt'], first.hashes['spells_us.txt'])
    assert.equal(second.hashes['spells_us_str.txt'], first.hashes['spells_us_str.txt'])
  } finally { f.close() }
})

test('changing files retry with exact backoff and only return the final stable triple', async () => {
  const f = storageFixture()
  try {
    writeCatalog(f.root)
    const waits: number[] = []
    let mutated = false
    const result = await captureClientSpellBundle(f.root, { wait: async (ms) => {
      waits.push(ms)
      if (ms === 1000 && !mutated) { mutated = true; writeCatalog(f.root, syntheticCatalog([spellRow(2, 'Replacement')])) }
    } })
    assert.deepEqual(waits, [1000, 2000, 1000])
    assert.equal(result.sources['spells_us.txt'].toString().startsWith('2^Replacement'), true)
  } finally { f.close() }
})

test('incomplete bundle retries every configured delay and fails; no partial capture succeeds', async () => {
  const f = storageFixture()
  try {
    const waits: number[] = [], attempts: number[] = []
    await assert.rejects(captureClientSpellBundle(f.root, {
      wait: async (ms) => { waits.push(ms) }, onAttempt: (attempt) => { attempts.push(attempt) }
    }))
    assert.deepEqual(waits, CAPTURE_RETRY_DELAYS)
    assert.deepEqual(attempts, [0, 1, 2, 3, 4])
  } finally { f.close() }
})

test('writer preserves active valid data after malformed refresh and records an error observation', async () => {
  const f = storageFixture()
  const writer = new SpellLibraryWriter(f.options, { wait: async () => undefined, retryDelays: [] })
  try {
    writeCatalog(f.root)
    const first = await writer.handle('check', { root: f.root, reason: 'startup' }) as SpellCheckResult
    assert.equal(first.dataset.recordCount, 1)
    writeFileSync(join(f.root, 'spells_us.txt'), 'broken file')
    await assert.rejects(writer.handle('check', { root: f.root, reason: 'manual' }), /unsupported row layout/)
    const active = await writer.handle('active', { root: f.root }) as SpellCheckResult['dataset']
    assert.equal(active.snapshotId, first.dataset.snapshotId)
    assert.equal(f.storage.observations(first.dataset.installId).observations[0].outcome, 'error')
    assert.equal(f.storage.observations(first.dataset.installId).observations[0].previousSnapshotId, first.dataset.snapshotId)
    const status = await writer.handle('status', { root: join(f.directory, 'never-imported') }) as { installId: string; dataset: unknown }
    assert.equal(status.installId, spellInstallId(join(f.directory, 'never-imported')))
    assert.equal(status.dataset, null)
  } finally { writer.close(); f.close() }
})

test('writer captures string-file-only updates as a new snapshot without discarding prior bytes', async () => {
  const f = storageFixture()
  const writer = new SpellLibraryWriter(f.options, { wait: async () => undefined, retryDelays: [] })
  try {
    writeCatalog(f.root)
    const first = await writer.handle('check', { root: f.root, reason: 'startup' }) as SpellCheckResult
    const path = join(f.root, 'dbstr_us.txt')
    writeFileSync(path, readFileSync(path, 'utf8').replace('Synthetic description', 'New client description'))
    const second = await writer.handle('check', { root: f.root, reason: 'manual' }) as SpellCheckResult
    assert.notEqual(second.dataset.snapshotId, first.dataset.snapshotId)
    assert.equal(second.dataset.hashes['spells_us.txt'], first.dataset.hashes['spells_us.txt'])
    assert.equal(second.observation.counts.interpreted, 1)
    assert.match(readFileSync(join(first.materializedDir, 'dbstr_us.txt'), 'utf8'), /Synthetic description/)
    assert.match(readFileSync(join(second.materializedDir, 'dbstr_us.txt'), 'utf8'), /New client description/)
  } finally { writer.close(); f.close() }
})
