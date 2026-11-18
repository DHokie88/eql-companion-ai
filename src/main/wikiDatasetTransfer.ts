// Bounded Eye of Zomm dataset transfer. Network, decompression, JSON, normalization,
// and cache files stay here so a worker thread can run them off the log tail.
// The manifest URL is fixed. Callers cannot supply a URL, a cache filename, or a redirect policy.

import { fetchBytes, withDeadline, inflate } from './wikiDatasetDownload'
import { createHash } from 'node:crypto'
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'

import {
  WikiDatasetError, publicError, resolveWikiCacheFile, parseStoredWikiCache,
  optionalCacheFields, sealItems, isPlainObject, requireVersion, requireGeneratedAt,
  requireCheckedAt, requireSha256, requireCount
} from './wikiDatasetCache'
export { publicError, resolveWikiCacheFile, parseStoredWikiCache } from './wikiDatasetCache'

export const WIKI_DATASET_MANIFEST_URL =
  'https://raw.githubusercontent.com/Maergoth/EQL-EOZ/dataset/manifest.json'
export const WIKI_CACHE_DIR_NAME = 'wiki-dataset'
export const WIKI_CACHE_FILE_NAME = 'wiki-dataset.json'
export const MAX_MANIFEST_BYTES = 64 * 1024
export const MAX_GZIP_BYTES = 32 * 1024 * 1024
export const MAX_DECODED_BYTES = 256 * 1024 * 1024
export const MANIFEST_DEADLINE_MS = 8_000
export const PAYLOAD_DEADLINE_MS = 45_000

const PACK_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.json\.gz$/
const TMP_NAME = /^\.wiki-dataset\.json\.\d+\.\d+\.[a-z0-9]+\.tmp$/

import type { WikiDatasetCache } from '../shared/wikiDataset'
export type { WikiDatasetCache } from '../shared/wikiDataset'
export interface WikiDatasetSummary {
  version: string
  generatedAt: string
  checkedAt: string
  sha256: string
  items: number
  npcs: number
  zones: number
  identityConflicts: number
  quarantinedItems: number
}

export type WikiRefreshResult =
  | { ok: true; summary: WikiDatasetSummary }
  | { ok: false; error: string; retained: true }

export type WikiWorkerResponse =
  | { id: number; ok: true; kind: 'load'; cache: WikiDatasetCache | null }
  | { id: number; ok: true; kind: 'refresh'; refresh: WikiRefreshResult }
  | { id: number; ok: false; kind: 'load' | 'refresh'; error: string }

export interface WikiManifestIdentity {
  version: string
  generatedAt: string
  sha256: string
}

export type WikiDecode = (
  value: unknown,
  manifest: WikiManifestIdentity,
  checkedAt: string
) => WikiDatasetCache | Promise<WikiDatasetCache>

export type WikiGunzip = (buffer: Buffer, maxOutputLength: number) => Buffer

export interface TransferDeps {
  fetchImpl?: typeof fetch
  gunzip?: WikiGunzip
  decode?: WikiDecode
  maxDecodedBytes?: number
  manifestDeadlineMs?: number
  payloadDeadlineMs?: number
}

interface ValidManifest extends WikiManifestIdentity {
  packUrl: string
  bytes: number
}

export function singleFlight<T>(slot: { current: Promise<T> | null }, run: () => Promise<T>): Promise<T> {
  if (slot.current) return slot.current
  const flight = run().finally(() => {
    if (slot.current === flight) slot.current = null
  })
  slot.current = flight
  return flight
}

export function replyOnce(state: { sent: boolean }, send: (message: unknown) => void, message: unknown): void {
  if (state.sent) return
  state.sent = true
  send(message)
}

export async function loadWikiDatasetFromDisk(cacheDir: string): Promise<WikiDatasetCache | null> {
  const cacheFile = resolveWikiCacheFile(cacheDir)
  let info: { size: number }
  try {
    info = await stat(cacheFile)
  } catch (err) {
    if (isEnoent(err)) return null
    throw new WikiDatasetError('Saved wiki dataset could not be read.')
  }
  if (info.size > MAX_DECODED_BYTES) throw new WikiDatasetError('Saved wiki dataset exceeds the size limit.')
  let bytes: Buffer
  try {
    bytes = await readFile(cacheFile)
  } catch {
    throw new WikiDatasetError('Saved wiki dataset could not be read.')
  }
  if (bytes.length > MAX_DECODED_BYTES) throw new WikiDatasetError('Saved wiki dataset exceeds the size limit.')
  let parsed: unknown
  try {
    parsed = JSON.parse(bytes.toString('utf8'))
  } catch {
    throw new WikiDatasetError('Saved wiki dataset is not valid JSON.')
  }
  return parseStoredWikiCache(parsed)
}

export async function refreshWikiDatasetOnDisk(
  cacheDir: string,
  checkedAt: string,
  deps: TransferDeps = {}
): Promise<WikiRefreshResult> {
  const cacheFile = resolveWikiCacheFile(cacheDir)
  const stamp = requireCheckedAt(checkedAt)
  try {
    const info = await stat(cacheFile)
    if (!info.isFile()) {
      return { ok: false, error: 'Wiki dataset cache could not be saved.', retained: true }
    }
  } catch (err) {
    if (!isEnoent(err)) return { ok: false, error: 'Saved wiki dataset could not be read.', retained: true }
  }
  try {
    const fetchImpl = deps.fetchImpl ?? globalThis.fetch
    const manifest = await downloadManifest(fetchImpl, deps.manifestDeadlineMs ?? MANIFEST_DEADLINE_MS)
    // Only a cache that passes the usual disk validation may stand in for a download.
    // A corrupt cache can still be repaired with a fresh, verified pack.
    const saved = await loadWikiDatasetFromDisk(cacheDir).catch(() => null)
    if (saved?.sha256 === manifest.sha256) {
      return { ok: true, summary: { ...summarize(saved), checkedAt: stamp } }
    }
    const cache = await downloadWikiDataset(manifest, stamp, deps, fetchImpl)
    try {
      await writeCacheAtomically(cacheFile, cache)
    } catch {
      throw new WikiDatasetError('Wiki dataset cache could not be saved.')
    }
    return { ok: true, summary: summarize(cache) }
  } catch (err) {
    return { ok: false, error: publicError(err), retained: true }
  }
}

export function summarize(cache: WikiDatasetCache): WikiDatasetSummary {
  return {
    version: cache.version,
    generatedAt: cache.generatedAt,
    checkedAt: cache.checkedAt,
    sha256: cache.sha256,
    items: new Set(Object.values(cache.items).map((item) => item.page)).size,
    npcs: cache.npcCount,
    zones: cache.zoneCount,
    identityConflicts: cache.identityConflicts?.length ?? 0,
    quarantinedItems: cache.quarantinedItems?.length ?? 0
  }
}

async function downloadManifest(fetchImpl: typeof fetch, deadlineMs: number): Promise<ValidManifest> {
  const bytes = await withDeadline(deadlineMs, (signal) =>
    fetchBytes(fetchImpl, WIKI_DATASET_MANIFEST_URL, { maxBytes: MAX_MANIFEST_BYTES }, signal)
  )
  return parseManifest(parseJson(bytes, 'manifest'))
}

async function downloadWikiDataset(
  manifest: ValidManifest,
  checkedAt: string,
  deps: TransferDeps,
  fetchImpl: typeof fetch
): Promise<WikiDatasetCache> {
  const gunzip = deps.gunzip ?? defaultGunzip
  const decode = deps.decode ?? defaultDecode
  const maxDecoded = deps.maxDecodedBytes ?? MAX_DECODED_BYTES
  const payloadDeadline = deps.payloadDeadlineMs ?? PAYLOAD_DEADLINE_MS

  const compressed = await withDeadline(payloadDeadline, async (signal) => {
    const bytes = await fetchBytes(fetchImpl, manifest.packUrl, { maxBytes: manifest.bytes, declaredBytes: manifest.bytes }, signal)
    if (bytes.length !== manifest.bytes) {
      throw new WikiDatasetError('Wiki dataset manifest declared byte count does not match the download.')
    }
    return bytes
  })
  const actual = createHash('sha256').update(compressed).digest('hex')
  if (actual !== manifest.sha256) {
    throw new WikiDatasetError('Downloaded wiki dataset failed SHA-256 verification.')
  }
  const inflated = inflate(compressed, maxDecoded, gunzip)
  if (inflated.length > maxDecoded) {
    throw new WikiDatasetError('Wiki dataset decompressed payload exceeded the size limit.')
  }
  const payload = parseJson(inflated, 'payload')
  assertRawDataset(payload)
  const identity: WikiManifestIdentity = {
    version: manifest.version,
    generatedAt: manifest.generatedAt,
    sha256: manifest.sha256
  }
  let decoded: WikiDatasetCache
  try {
    decoded = await decode(payload, identity, checkedAt)
  } catch (err) {
    if (err instanceof WikiDatasetError) throw err
    throw new WikiDatasetError(`Wiki dataset payload was rejected: ${publicError(err)}`)
  }
  return acceptDecodedCache(decoded, identity, checkedAt)
}

function defaultGunzip(buffer: Buffer, maxOutputLength: number): Buffer {
  return gunzipSync(buffer, { maxOutputLength })
}

async function defaultDecode(
  value: unknown,
  manifest: WikiManifestIdentity,
  checkedAt: string
): Promise<WikiDatasetCache> {
  const mod = (await import('./wikiDatasetCodec')) as {
    decodeWikiDataset: WikiDecode | ((value: unknown, manifest: WikiManifestIdentity, checkedAt: string) => Promise<WikiDatasetCache>)
  }
  return mod.decodeWikiDataset(value, manifest, checkedAt)
}

function parseManifest(value: unknown): ValidManifest {
  if (!isPlainObject(value)) throw new WikiDatasetError('Wiki dataset manifest is not an object.')
  if (value.schemaVersion !== 1) throw new WikiDatasetError('Wiki dataset manifest schema is not supported.')
  if (value.encoding !== 'gzip') throw new WikiDatasetError('Wiki dataset manifest encoding is not gzip.')
  const version = requireVersion(value.version)
  const generatedAt = requireGeneratedAt(value.generatedAt)
  const sha256 = requireSha256(value.sha256)
  if (typeof value.pack !== 'string' || !PACK_NAME.test(value.pack)) {
    throw new WikiDatasetError('Wiki dataset manifest contains an invalid pack filename.')
  }
  const bytes = value.bytes
  if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_GZIP_BYTES) {
    throw new WikiDatasetError('Wiki dataset manifest declared byte count is invalid.')
  }
  return { version, generatedAt, sha256, bytes, packUrl: resolvePackUrl(value.pack) }
}

function resolvePackUrl(pack: string): string {
  const base = new URL(WIKI_DATASET_MANIFEST_URL)
  let url: URL
  try {
    url = new URL(pack, base)
  } catch {
    throw new WikiDatasetError('Wiki dataset manifest contains an invalid pack filename.')
  }
  const directory = base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1)
  if (
    url.origin !== base.origin ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    url.pathname !== `${directory}${pack}`
  ) {
    throw new WikiDatasetError('Wiki dataset manifest contains an invalid pack filename.')
  }
  return url.toString()
}

function assertRawDataset(value: unknown): asserts value is { zones: unknown[]; npcs: unknown[]; items: unknown[] } {
  if (!isPlainObject(value)) throw new WikiDatasetError('Wiki dataset payload is not an object.')
  if (!isPlainObject(value.meta)) throw new WikiDatasetError('Wiki dataset payload is missing meta.')
  if (value.meta.schemaVersion !== 3) throw new WikiDatasetError('Wiki dataset payload schema is not supported.')
  if (value.meta.sample === true) throw new WikiDatasetError('Wiki dataset payload is a sample and cannot be installed.')
  if (!Array.isArray(value.zones) || !Array.isArray(value.npcs) || !Array.isArray(value.items)) {
    throw new WikiDatasetError('Wiki dataset payload is missing zones, npcs, or items.')
  }
}

function acceptDecodedCache(cache: WikiDatasetCache, manifest: WikiManifestIdentity, checkedAt: string): WikiDatasetCache {
  if (!isPlainObject(cache)) throw new WikiDatasetError('Wiki dataset payload was rejected.')
  if (cache.schemaVersion !== 1) throw new WikiDatasetError('Wiki dataset cache schema is not supported.')
  if (cache.version !== manifest.version || cache.sha256 !== manifest.sha256) {
    throw new WikiDatasetError('Wiki dataset payload does not match the manifest.')
  }
  if (cache.checkedAt !== checkedAt) throw new WikiDatasetError('Wiki dataset cache timestamp was rejected.')
  const generatedAt = requireGeneratedAt(cache.generatedAt)
  return {
    schemaVersion: 1,
    version: manifest.version,
    generatedAt,
    checkedAt,
    sha256: manifest.sha256,
    items: sealItems(cache.items),
    ...optionalCacheFields(cache),
    npcCount: requireCount(cache.npcCount),
    zoneCount: requireCount(cache.zoneCount)
  }
}

function parseJson(buffer: Buffer, label: 'manifest' | 'payload'): unknown {
  try {
    return JSON.parse(buffer.toString('utf8'))
  } catch {
    throw new WikiDatasetError(
      label === 'manifest' ? 'Wiki dataset manifest is not valid JSON.' : 'Wiki dataset payload is not valid JSON.'
    )
  }
}

async function writeCacheAtomically(cacheFile: string, cache: WikiDatasetCache): Promise<void> {
  const dir = dirname(cacheFile)
  if (relative(dir, cacheFile) !== WIKI_CACHE_FILE_NAME) {
    throw new WikiDatasetError('Wiki dataset cache path escaped its directory.')
  }
  await mkdir(dir, { recursive: true })
  const tmp = resolve(dir, `.${WIKI_CACHE_FILE_NAME}.${process.pid}.${Date.now()}.${nonce()}.tmp`)
  if (relative(dir, tmp).split(/[\\/]/).length !== 1 || !TMP_NAME.test(relative(dir, tmp))) {
    throw new WikiDatasetError('Wiki dataset cache could not be saved.')
  }
  const payload = JSON.stringify(cache)
  let handle: Awaited<ReturnType<typeof open>> | null = null
  let renamed = false
  try {
    handle = await open(tmp, 'w', 0o600)
    await handle.writeFile(payload, 'utf8')
    await handle.sync()
    await handle.close()
    handle = null
    await rename(tmp, cacheFile)
    renamed = true
  } finally {
    if (handle) await handle.close().catch(() => { /* Cleanup cannot replace the original result. */ })
    if (!renamed) await rm(tmp, { force: true }).catch(() => { /* Cleanup cannot replace the original result. */ })
  }
}

function isEnoent(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT')
}

function nonce(): string {
  return Math.random().toString(36).slice(2, 10)
}
