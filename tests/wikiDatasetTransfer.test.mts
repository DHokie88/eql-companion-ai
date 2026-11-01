import { parseStatsBlock } from '../src/shared/itemStats'
import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_DECODED_BYTES,
  MAX_GZIP_BYTES,
  MAX_MANIFEST_BYTES,
  WIKI_CACHE_FILE_NAME,
  WIKI_DATASET_MANIFEST_URL,
  loadWikiDatasetFromDisk,
  parseStoredWikiCache,
  refreshWikiDatasetOnDisk,
  resolveWikiCacheFile,
  type WikiDatasetCache,
  type WikiDecode,
  type TransferDeps
} from '../src/main/wikiDatasetTransfer'

const CHECKED = '2026-11-01T18:00:00.000Z'
const VERSION = '20261101T123256Z-52e0eb8675bc'
const GENERATED = '2026-11-01T12:32:58+00:00'
const PACK = 'eqlwiki-eye-of-zomm-data.json.gz'
const PACK_URL = 'https://raw.githubusercontent.com/Maergoth/EQL-EOZ/dataset/eqlwiki-eye-of-zomm-data.json.gz'

interface RawItem {
  name: string
  stats?: Record<string, number>
}

function rawDataset(items: RawItem[] = [{ name: 'Rusted Sword', stats: { ac: 2, 'unlisted-stat': 7 } }]): unknown {
  return {
    meta: { schemaVersion: 3, version: VERSION, generatedAt: GENERATED, sample: false },
    zones: [{ name: 'Plane of Sky' }, { name: 'Netherbian Lair' }],
    npcs: [{ name: 'a bat', zone: 'Plane of Sky' }],
    items
  }
}

function decodeOk(value: unknown, manifest: { version: string; generatedAt: string; sha256: string }, checkedAt: string): WikiDatasetCache {
  const raw = value as { zones: unknown[]; npcs: unknown[]; items: RawItem[] }
  const items: WikiDatasetCache['items'] = Object.create(null)
  for (const item of raw.items) {
    items[item.name.toLowerCase()] = { page: item.name, name: item.name, stats: { ...parseStatsBlock(''), ...item.stats } }
  }
  return {
    schemaVersion: 1,
    version: manifest.version,
    generatedAt: manifest.generatedAt,
    checkedAt,
    sha256: manifest.sha256,
    items,
    npcCount: raw.npcs.length,
    zoneCount: raw.zones.length,
    sourceItemCount: raw.items.length,
    identityConflicts: [{ key: 'dup', pages: ['A', 'B'] }],
    quarantinedItems: [{ page: 'A', stats: { ...parseStatsBlock(''), 'kept-stat': 1 } }]
  }
}

function packageOf(payload: unknown, pack = PACK): { manifest: unknown; gzip: Buffer; sha: string } {
  const gzip = gzipSync(Buffer.from(JSON.stringify(payload)))
  const sha = createHash('sha256').update(gzip).digest('hex')
  const manifest = {
    schemaVersion: 1,
    product: 'EQLWiki - Eye of Zomm',
    version: VERSION,
    generatedAt: GENERATED,
    pack,
    encoding: 'gzip',
    sha256: sha,
    bytes: gzip.length,
    source: 'EQLWiki',
    url: 'https://evil.example/not-used.json.gz'
  }
  return { manifest, gzip, sha }
}

function jsonResponse(body: Buffer | string, status = 200, extraHeaders: Record<string, string> = {}): Response {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body)
  const headers = new Headers(extraHeaders)
  if (!headers.has('content-length')) headers.set('content-length', String(bytes.length))
  return new Response(bytes, { status, headers })
}

function mockFetch(manifestBody: Buffer | string, payload?: Buffer, opts: { manifestStatus?: number; payloadStatus?: number } = {}): {
  fetchImpl: typeof fetch
  calls: { url: string; init: RequestInit }[]
} {
  const calls: { url: string; init: RequestInit }[] = []
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url)
    calls.push({ url: href, init: init ?? {} })
    if (href === WIKI_DATASET_MANIFEST_URL) {
      return jsonResponse(manifestBody, opts.manifestStatus ?? 200)
    }
    if (payload && href === PACK_URL) return jsonResponse(payload, opts.payloadStatus ?? 200)
    return jsonResponse('no', 404)
  }) as typeof fetch
  return { fetchImpl, calls }
}

function deps(fetchImpl: typeof fetch, decode: WikiDecode = decodeOk, extra: TransferDeps = {}): TransferDeps {
  return { fetchImpl, decode, ...extra }
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'wiki-dataset-'))
}

test('valid payload verifies sha256 before gunzip, writes a sealed cache, and keeps unknown stats', async () => {
  const packed = packageOf(rawDataset())
  let gunzipMax = 0
  let hashedBeforeInflate = false
  const dir = tempDir()
  try {
    const { fetchImpl, calls } = mockFetch(JSON.stringify(packed.manifest), packed.gzip)
    const result = await refreshWikiDatasetOnDisk(dir, CHECKED, deps(fetchImpl, decodeOk, {
      gunzip: (buffer, max) => {
        gunzipMax = max
        const actual = createHash('sha256').update(buffer).digest('hex')
        hashedBeforeInflate = actual === packed.sha
        return gunzipSync(buffer)
      }
    }))
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.summary.items, 1)
    assert.equal(result.summary.npcs, 1)
    assert.equal(result.summary.zones, 2)
    assert.equal(result.summary.sha256, packed.sha)
    assert.equal(gunzipMax, MAX_DECODED_BYTES)
    assert.equal(hashedBeforeInflate, true)
    assert.equal(calls.length, 2)
    assert.equal(calls[0].url, WIKI_DATASET_MANIFEST_URL)
    assert.equal(calls[1].url, PACK_URL)
    assert.equal(calls[0].init.redirect, 'error')
    assert.equal(calls[0].init.credentials, 'omit')
    assert.deepEqual(readdirSync(dir), [WIKI_CACHE_FILE_NAME])
    const loaded = await loadWikiDatasetFromDisk(dir)
    assert.equal(loaded?.items['rusted sword'] && (loaded.items['rusted sword'] as unknown as { stats: Record<string, number> }).stats['unlisted-stat'], 7)
    assert.equal(loaded?.identityConflicts?.length, 1)
    assert.equal(loaded?.quarantinedItems?.[0] && (loaded.quarantinedItems[0] as unknown as { stats: Record<string, number> }).stats['kept-stat'], 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('bad sha256 does not gunzip and retains the last good file', async () => {
  const packed = packageOf(rawDataset())
  const manifest = { ...(packed.manifest as object), sha256: 'a'.repeat(64), bytes: packed.gzip.length }
  const dir = tempDir()
  const file = resolveWikiCacheFile(dir)
  writeFileSync(file, Buffer.from('LAST-GOOD'))
  let inflated = 0
  try {
    const { fetchImpl } = mockFetch(JSON.stringify(manifest), packed.gzip)
    const result = await refreshWikiDatasetOnDisk(dir, CHECKED, deps(fetchImpl, decodeOk, {
      gunzip: () => {
        inflated += 1
        return Buffer.from('{}')
      }
    }))
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.retained, true)
    assert.match(result.error, /SHA-256/)
    assert.equal(inflated, 0)
    assert.equal(readFileSync(file).toString(), 'LAST-GOOD')
    assert.equal(readdirSync(dir).some((name) => name.includes('.tmp')), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('schema and sample payloads are rejected before decode and keep the last good file', async () => {
  const dir = tempDir()
  const file = resolveWikiCacheFile(dir)
  writeFileSync(file, Buffer.from('LAST-GOOD'))
  const cases = [
    { ...rawDataset() as object, items: 'nope' },
    { ...(rawDataset() as object), meta: { schemaVersion: 3, sample: true, version: VERSION, generatedAt: GENERATED } },
    { ...(rawDataset() as object), meta: { schemaVersion: 2, sample: false, version: VERSION, generatedAt: GENERATED } }
  ]
  try {
    for (const payload of cases) {
      const packed = packageOf(payload)
      let decoded = 0
      const { fetchImpl } = mockFetch(JSON.stringify(packed.manifest), packed.gzip)
      const result = await refreshWikiDatasetOnDisk(dir, CHECKED, deps(fetchImpl, () => {
        decoded += 1
        return decodeOk(payload, { version: VERSION, generatedAt: GENERATED, sha256: packed.sha }, CHECKED)
      }))
      assert.equal(result.ok, false)
      assert.equal(decoded, 0)
      assert.equal(readFileSync(file).toString(), 'LAST-GOOD')
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('manifest, declared gzip, and decompression caps reject before a bad cache is installed', async () => {
  const dir = tempDir()
  const file = resolveWikiCacheFile(dir)
  writeFileSync(file, Buffer.from('LAST-GOOD'))
  try {
    const oversized = Buffer.from(`{"pad":"${'a'.repeat(MAX_MANIFEST_BYTES)}"}`)
    const bigFetch = mockFetch(oversized)
    const big = await refreshWikiDatasetOnDisk(dir, CHECKED, deps(bigFetch.fetchImpl))
    assert.equal(big.ok, false)
    if (!big.ok) assert.match(big.error, /size limit/)
    assert.equal(bigFetch.calls.length, 1)

    const declared = packageOf(rawDataset())
    const declaredManifest = { ...(declared.manifest as object), bytes: MAX_GZIP_BYTES + 1 }
    const declaredFetch = mockFetch(JSON.stringify(declaredManifest), declared.gzip)
    const declaredResult = await refreshWikiDatasetOnDisk(dir, CHECKED, deps(declaredFetch.fetchImpl))
    assert.equal(declaredResult.ok, false)
    assert.equal(declaredFetch.calls.length, 1)

    const bomb = gzipSync(Buffer.alloc(50_000, 0))
    const bombManifest = {
      schemaVersion: 1,
      version: VERSION,
      generatedAt: GENERATED,
      pack: PACK,
      encoding: 'gzip',
      sha256: createHash('sha256').update(bomb).digest('hex'),
      bytes: bomb.length
    }
    let sawCap = 0
    const bombFetch = mockFetch(JSON.stringify(bombManifest), bomb)
    const bombResult = await refreshWikiDatasetOnDisk(dir, CHECKED, deps(bombFetch.fetchImpl, decodeOk, {
      maxDecodedBytes: 1024,
      gunzip: (buffer, max) => {
        sawCap = max
        return gunzipSync(buffer, { maxOutputLength: max })
      }
    }))
    assert.equal(sawCap, 1024)
    assert.equal(bombResult.ok, false)
    if (!bombResult.ok) assert.match(bombResult.error, /decompressed payload exceeded/)
    assert.equal(readFileSync(file).toString(), 'LAST-GOOD')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a body that never finishes hits the deadline and a failed fetch retains the last good file', async () => {
  const dir = tempDir()
  const file = resolveWikiCacheFile(dir)
  writeFileSync(file, Buffer.from('LAST-GOOD'))
  try {
    const packed = packageOf(rawDataset())
    const hangFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url)
      if (href === WIKI_DATASET_MANIFEST_URL) return jsonResponse(JSON.stringify(packed.manifest))
      return new Response(
        new ReadableStream({
          start(controller) {
            const abort = (): void => controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' }))
            if (init?.signal?.aborted) abort()
            else init?.signal?.addEventListener('abort', abort, { once: true })
          }
        }),
        { status: 200, headers: { 'content-length': String(packed.gzip.length) } }
      )
    }) as typeof fetch
    const started = Date.now()
    const hung = await Promise.race([
      refreshWikiDatasetOnDisk(dir, CHECKED, deps(hangFetch, decodeOk, { payloadDeadlineMs: 40 })),
      new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('deadline test hung')), 2000))
    ])
    assert.equal(hung.ok, false)
    if (!hung.ok) assert.match(hung.error, /deadline/)
    assert.ok(Date.now() - started < 2000)
    assert.equal(readFileSync(file).toString(), 'LAST-GOOD')

    const failFetch = (async () => {
      throw new Error('connect ECONNREFUSED')
    }) as typeof fetch
    const failed = await refreshWikiDatasetOnDisk(dir, CHECKED, deps(failFetch))
    assert.equal(failed.ok, false)
    if (!failed.ok) assert.equal(failed.error, 'Wiki dataset request failed.')
    assert.equal(readFileSync(file).toString(), 'LAST-GOOD')

    const redirectFetch = (async () => {
      throw new TypeError('redirect mode is set to error')
    }) as typeof fetch
    const redirected = await refreshWikiDatasetOnDisk(dir, CHECKED, deps(redirectFetch))
    assert.equal(redirected.ok, false)
    if (!redirected.ok) assert.match(redirected.error, /redirect was refused/)
    assert.equal(readFileSync(file).toString(), 'LAST-GOOD')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('pack filenames and cache directories cannot traverse, and extra manifest URLs are ignored', async () => {
  const dir = tempDir()
  const payload = rawDataset()
  try {
    for (const pack of ['../evil.json.gz', 'https://evil.example/a.json.gz', '/tmp/a.json.gz', 'nested/a.json.gz']) {
      const packed = packageOf(payload, pack)
      const { fetchImpl, calls } = mockFetch(JSON.stringify(packed.manifest), packed.gzip)
      const result = await refreshWikiDatasetOnDisk(dir, CHECKED, deps(fetchImpl))
      assert.equal(result.ok, false)
      if (!result.ok) assert.match(result.error, /invalid pack filename/)
      assert.equal(calls.length, 1)
      assert.equal(calls[0].url, WIKI_DATASET_MANIFEST_URL)
    }
    const escaped = `${dir}/sandbox/../../etc`
    await assert.rejects(() => refreshWikiDatasetOnDisk(escaped, CHECKED, deps(mockFetch('{}').fetchImpl)), /cache directory is invalid/)
    const outside = join(tmpdir(), `wiki-outside-${process.pid}`)
    assert.equal(existsSafe(outside), false)

    const stored = parseStoredWikiCache({
      schemaVersion: 1,
      version: VERSION,
      generatedAt: GENERATED,
      checkedAt: CHECKED,
      sha256: 'ab'.repeat(32),
      npcCount: 0,
      zoneCount: 0,
      items: { sword: { page: 'Sword', stats: { ...parseStatsBlock(''), ac: 1, 'kept-stat': 4 } } }
    })
    assert.equal((stored.items.sword as unknown as { stats: Record<string, number> }).stats['kept-stat'], 4)
    assert.throws(() => parseStoredWikiCache({ ...stored, path: '/etc/passwd', items: {} }), /rejected/)
    assert.equal(existsSafe('/etc/passwd-from-wiki-test'), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a failed save removes its temp file and does not replace a last-good directory entry', async () => {
  const dir = tempDir()
  const file = resolveWikiCacheFile(dir)
  mkdirSync(file)
  try {
    let fetches = 0
    const fetchImpl = (async () => {
      fetches += 1
      return jsonResponse('no', 500)
    }) as typeof fetch
    const result = await refreshWikiDatasetOnDisk(dir, CHECKED, deps(fetchImpl))
    assert.equal(fetches, 0)
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /could not be saved/)
    assert.equal(readdirSync(dir).some((name) => name.endsWith('.tmp')), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('declared byte mismatch does not gunzip', async () => {
  const packed = packageOf(rawDataset())
  const manifest = { ...(packed.manifest as object), bytes: packed.gzip.length + 1 }
  let inflated = 0
  const { fetchImpl } = mockFetch(JSON.stringify(manifest), packed.gzip)
  const dir = tempDir()
  try {
    const result = await refreshWikiDatasetOnDisk(dir, CHECKED, deps(fetchImpl, decodeOk, {
      gunzip: () => {
        inflated += 1
        return Buffer.from('{}')
      }
    }))
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /declared byte count/)
    assert.equal(inflated, 0)
    assert.equal(readdirSync(dir).includes(WIKI_CACHE_FILE_NAME), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('missing cache loads as no dataset', async () => {
  const dir = tempDir()
  try {
    assert.equal(await loadWikiDatasetFromDisk(dir), null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

function existsSafe(file: string): boolean {
  try {
    readFileSync(file)
    return true
  } catch {
    return false
  }
}
