import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createDiscordLoader, datasetNames } from '../discordReferenceLoader'
import { discordIndex } from './discord'

type DiscordIndex = Awaited<ReturnType<typeof discordIndex>>
const warning = 'The refreshed Discord data could not be loaded. Showing the last usable snapshot.'
async function boundedRead(path: string, max: number): Promise<Buffer> {
  if ((await stat(path)).size > max) throw new Error('Discord reference file is too large')
  const bytes = await readFile(path)
  if (bytes.length > max) throw new Error('Discord reference file is too large')
  return bytes
}
function sha(bytes: Buffer): string { return createHash('sha256').update(bytes).digest('hex') }
function checkTime(value: unknown): string | null {
  const refresh = value as { lastCheckedAt?: unknown }
  if (!refresh || (refresh.lastCheckedAt !== null && (typeof refresh.lastCheckedAt !== 'string' || !Number.isFinite(Date.parse(refresh.lastCheckedAt))))) throw new Error('Invalid Discord check time')
  return refresh.lastCheckedAt
}
async function readGeneration(root: string, sums: Buffer): Promise<DiscordIndex> {
  const hashes = JSON.parse(sums.toString('utf8')) as { algorithm?: string; files?: Record<string, string> }
  if (hashes.algorithm !== 'sha256' || !hashes.files) throw new Error('Invalid Discord checksums')
  const files: Record<string, unknown> = {}
  let totalBytes = 0
  const names = ['manifest', 'refresh', ...datasetNames, ...(hashes.files['runtime/mustRead.json'] ? ['mustRead'] : [])]
  for (const name of names) {
    const relative = `runtime/${name}.json`
    const bytes = await boundedRead(join(root, relative), ['manifest', 'refresh', 'mustRead'].includes(name) ? 1_000_000 : 256 * 1024 * 1024)
    totalBytes += bytes.length
    if (totalBytes > 350 * 1024 * 1024) throw new Error('Discord runtime package is too large')
    if (sha(bytes) !== hashes.files[relative]) throw new Error('Discord reference checksum mismatch')
    files[name] = JSON.parse(bytes.toString('utf8')) as unknown
  }
  // A publication racing the reads cannot produce a mixed generation.
  if (!(await boundedRead(join(root, 'SHA256SUMS.json'), 100_000)).equals(sums)) throw new Error('Discord snapshot changed during loading')
  const lastCheckedAt = checkTime(files.refresh)
  const readers = Object.fromEntries(datasetNames.map(name => [name, () => Promise.resolve(files[name])])) as Parameters<typeof createDiscordLoader>[0]
  const loader = createDiscordLoader(readers, () => Promise.resolve(files.manifest))
  if ((await loader.allProblems()).length) throw new Error('Invalid Discord runtime data')
  const index = await discordIndex(loader, files.mustRead ?? { schemaVersion: 1, generatedAt: new Date().toISOString(), entries: [] })
  index.snapshot.lastCheckedAt = lastCheckedAt
  return index
}

/** Verify a complete published generation before replacing a usable index. */
export function createRuntimeDiscord() {
  let cached: { root: string; identity: string; index: DiscordIndex } | undefined
  let fallback: Promise<DiscordIndex> | undefined
  let pending: { root: string; value: Promise<DiscordIndex> } | undefined
  async function bundled(): Promise<DiscordIndex> {
    fallback ??= discordIndex().catch((error: unknown) => { fallback = undefined; throw error })
    return fallback
  }
  async function read(root: string): Promise<DiscordIndex> {
    try {
      const sums = await boundedRead(join(root, 'SHA256SUMS.json'), 100_000)
      const identity = sha(sums)
      if (cached?.root === root && cached.identity === identity) return cached.index
      const index = await readGeneration(root, sums)
      cached = { root, identity, index }
      return index
    } catch (error) {
      const previous = cached?.root === root ? cached.index : await bundled()
      const absent = (error as NodeJS.ErrnoException).code === 'ENOENT'
      return { ...previous, snapshot: { ...previous.snapshot, refreshWarning: absent && !cached
        ? 'Using bundled Discord data. No scheduled snapshot is available for this game folder.' : warning } }
    }
  }
  return (root: string): Promise<DiscordIndex> => {
    // Share validation when worker requests overlap for the same folder.
    if (pending?.root === root) return pending.value
    const value = read(root).finally(() => { if (pending?.value === value) pending = undefined })
    pending = { root, value }
    return value
  }
}
