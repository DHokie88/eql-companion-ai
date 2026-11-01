import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { refreshWikiDatasetOnDisk, loadWikiDatasetFromDisk, parseStoredWikiCache,
  WIKI_CACHE_FILE_NAME, WIKI_DATASET_MANIFEST_URL } from '../src/main/wikiDatasetTransfer'

const checkedAt = '2026-11-01T18:00:00.000Z'
function sourceFixture(): { gzip: Buffer; manifest: object; fetchImpl: typeof fetch } {
  const item = (wikiTitle: string, name = wikiTitle) => ({ wikiTitle, name,
    displayLines: ['MAGIC ITEM', 'Slot: PRIMARY', 'AC: 2', 'Class: WAR', 'Unknown stat: 7'], revisionId: 123 })
  const payload = { meta: { schemaVersion: 3, sample: false, generatedAt: '2026-11-01T12:32:52+00:00' },
    zones: [{ name: 'Qeynos' }], npcs: [],
    items: [item('Useful sword', 'Sword alias'), item('Rune Casing'), item('Rune casing')] }
  const gzip = gzipSync(JSON.stringify(payload))
  const manifest = { schemaVersion: 1, version: 'fixture-v1', generatedAt: '2026-11-01T12:32:58+00:00',
    sha256: createHash('sha256').update(gzip).digest('hex'), pack: 'data.json.gz', bytes: gzip.length, encoding: 'gzip' }
  const fetchImpl = (async (url) => new Response(String(url) === WIKI_DATASET_MANIFEST_URL
    ? JSON.stringify(manifest) : gzip)) as typeof fetch
  return { gzip, manifest, fetchImpl }
}

test('real codec and transport preserve source time, page counts, aliases, evidence and identity quarantine on reload', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wiki-integration-'))
  try {
    const result = await refreshWikiDatasetOnDisk(dir, checkedAt, sourceFixture())
    assert.equal(result.ok, true)
    if (!result.ok) throw new Error(result.error)
    assert.equal(result.summary.generatedAt, '2026-11-01T12:32:52+00:00')
    assert.equal(result.summary.items, 1) // alias is not another item
    assert.equal(result.summary.quarantinedItems, 2)
    assert.equal(result.summary.identityConflicts, 1)
    const loaded = await loadWikiDatasetFromDisk(dir)
    assert.equal(loaded?.sourceItemCount, 3)
    assert.equal(loaded?.items['sword alias'].page, 'Useful sword')
    assert.equal(loaded?.items['useful sword'].wikiDataset?.revisionId, 123)
    assert.ok(loaded?.items['useful sword'].statsBlock?.includes('Unknown stat: 7'))
    assert.equal(loaded?.quarantinedItems?.length, 2)
    assert.equal(loaded?.items['rune casing'], undefined)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('failed fetch cannot restore stale bytes over a concurrent newer cache', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wiki-concurrent-'))
  const file = join(dir, WIKI_CACHE_FILE_NAME)
  try {
    await writeFile(file, 'old')
    const result = await refreshWikiDatasetOnDisk(dir, checkedAt, { fetchImpl: (async () => {
      await writeFile(file, 'newer writer')
      throw new Error('offline')
    }) as typeof fetch })
    assert.equal(result.ok, false)
    assert.equal(await readFile(file, 'utf8'), 'newer writer')
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('malformed saved item identities and stat arrays fail closed', async () => {
  const cache = { schemaVersion: 1, version: 'v1', generatedAt: checkedAt, checkedAt,
    sha256: 'a'.repeat(64), npcCount: 0, zoneCount: 1, items: { broken: { page: 123 } } }
  assert.throws(() => parseStoredWikiCache(cache), /page/)
  cache.items.broken = { page: 'Sword', stats: { flags: null } } as never
  assert.throws(() => parseStoredWikiCache(cache), /stat arrays/)
})
