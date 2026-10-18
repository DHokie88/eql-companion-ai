// Compatibility projection of the active, validated spell-library revision.
// Full ID-keyed records and durable caches live in the library's SQLite workers.
import { Worker } from 'node:worker_threads'
import { join, resolve } from 'node:path'
import { effectiveEqRoot } from '../log/config'
import { logError } from '../errorLog'
import { resetLevelUnlocksCache } from '../data/levelUnlocks'
import type { SpellResistTable } from '../../shared/resistTypes'
import type { ResistTableWorkerReply } from '../resistTableWorker'

export const SPELL_RESIST_CACHE_VERSION = 6
export type SpellTableState = 'loading' | 'ok' | 'missing' | 'unloadable'
let loaded: SpellResistTable | null = null
let state: SpellTableState = 'loading'
let root: string | null = null
let revision = 'unavailable'
let sourceMtime: number | null = null
const rootKey = (value: string): string => resolve(value).replace(/\\/g, '/').toLowerCase()

export function spellsUsPath(): string { return join(effectiveEqRoot(), 'spells_us.txt') }
export function spellTableRevision(): string { return revision }

/** Root changes invalidate the projection immediately; same-install refreshes keep the old handle. */
export function selectSpellInstallation(nextRoot: string): void {
  const next = rootKey(nextRoot)
  if (root === next) return
  root = next
  loaded = null
  state = 'loading'
  revision = `${next}:pending`
  sourceMtime = null
  resetLevelUnlocksCache()
}

export function prepareCapturedSpellTable(path: string): Promise<SpellResistTable> {
  return new Promise((resolveTable, reject) => {
    const worker = new Worker(join(__dirname, 'resistTableWorker.js'), { workerData: { path, utf8: true } })
    let settled = false
    const finish = (reply?: ResistTableWorkerReply, error?: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (reply?.ok && reply.table) resolveTable(reply.table)
      else reject(error ?? new Error(reply?.error ?? 'Captured spell projection could not be loaded'))
      void worker.terminate()
    }
    const timer = setTimeout(() => finish(undefined, new Error('Captured spell projection timed out')), 120_000)
    worker.on('message', (reply: ResistTableWorkerReply) => finish(reply))
    worker.on('error', (error) => { logError('main:resistTable', error); finish(undefined, error) })
    worker.on('exit', () => finish())
  })
}

/** Called only after the coordinator verifies its installation/generation still owns activation. */
export function activateCapturedSpellTable(nextRoot: string, snapshotId: string, table: SpellResistTable, observedAt: string): void {
  if (root !== rootKey(nextRoot)) return
  loaded = table
  revision = `${root}:${snapshotId}`
  sourceMtime = Date.parse(observedAt)
  state = 'ok'
  resetLevelUnlocksCache()
}

export function spellTable(): Promise<SpellResistTable | null> { return Promise.resolve(spellTableNow()) }
export function spellTableNow(): SpellResistTable | null {
  return root === null || root === rootKey(effectiveEqRoot()) ? loaded : null
}
export function spellTableStatus(): { state: SpellTableState; path: string } { return { state, path: spellsUsPath() } }
export function spellsUsMtime(): number | null { return sourceMtime }
/** Tests can still supply a projection without files or workers. */
export function installSpellTable(table: SpellResistTable | null, why: SpellTableState = 'unloadable'): void {
  loaded = table
  root = null
  revision = `test:${Date.now()}`
  state = table ? 'ok' : why
}
