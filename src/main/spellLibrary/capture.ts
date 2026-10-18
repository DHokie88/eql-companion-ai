import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join, resolve } from 'node:path'
import { SPELL_SOURCE_FILES, type SpellSourceFile } from '../../shared/spellLibrary'

export type SpellSourceBytes = Record<SpellSourceFile, Buffer>
export type SpellSourceHashes = Record<SpellSourceFile, string>
export interface CapturedSpellBundle { sources: SpellSourceBytes; hashes: SpellSourceHashes }
export interface CaptureOptions {
  stableMs?: number
  retryDelays?: number[]
  wait?: (milliseconds: number) => Promise<void>
  onAttempt?: (attempt: number) => void
}
export const CAPTURE_RETRY_DELAYS = [2000, 5000, 10000, 30000]
const wait = async (milliseconds: number): Promise<void> =>
  await new Promise((done) => setTimeout(done, milliseconds))

export function sourceHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}
export function bundleHashes(sources: SpellSourceBytes): SpellSourceHashes {
  return Object.fromEntries(SPELL_SOURCE_FILES.map((name) => [name, sourceHash(sources[name])])) as SpellSourceHashes
}
function hashesMatch(a: SpellSourceHashes, b: SpellSourceHashes): boolean {
  return SPELL_SOURCE_FILES.every((name) => a[name] === b[name])
}
async function readSources(root: string): Promise<SpellSourceBytes> {
  const entries = await Promise.all(SPELL_SOURCE_FILES.map(async (name) => {
    const bytes = await fs.readFile(join(root, name))
    if (!bytes.length) throw new Error(`The client source ${name} is empty`)
    return [name, bytes] as const
  }))
  return Object.fromEntries(entries) as SpellSourceBytes
}

/** Always read full bytes: equal size and mtime do not prove equal client files. */
async function captureAttempt(root: string, options: CaptureOptions): Promise<CapturedSpellBundle> {
  const first = bundleHashes(await readSources(root))
  await (options.wait ?? wait)(options.stableMs ?? 1000)
  const sources = await readSources(root)
  const hashes = bundleHashes(sources)
  if (!hashesMatch(first, hashes)) throw new Error('Client spell sources are still changing')
  // Copy into our own buffers before a final full read of the originals. No caller receives a
  // buffer that is still backed by a mutable game file or an unverified on-disk copy.
  const copied = Object.fromEntries(SPELL_SOURCE_FILES.map((name) => [name, Buffer.from(sources[name])])) as SpellSourceBytes
  if (!hashesMatch(hashes, bundleHashes(await readSources(root)))) {
    throw new Error('Client spell sources changed during capture')
  }
  return { sources: copied, hashes }
}

export async function captureClientSpellBundle(root: string, options: CaptureOptions = {}): Promise<CapturedSpellBundle> {
  const absoluteRoot = resolve(root)
  const delays = options.retryDelays ?? CAPTURE_RETRY_DELAYS
  for (let attempt = 0; ; attempt++) {
    options.onAttempt?.(attempt)
    try {
      return await captureAttempt(absoluteRoot, options)
    } catch (error) {
      if (attempt >= delays.length) throw error
      await (options.wait ?? wait)(delays[attempt])
    }
  }
}
