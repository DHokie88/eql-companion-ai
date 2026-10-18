import { DatabaseSync, type StatementSync } from 'node:sqlite'
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
import { randomUUID } from 'node:crypto'
import {
  SPELL_SOURCE_FILES, type ClientSpellRecord, type SpellCheckReason, type SpellDataset,
  type SpellObservation
} from '../../shared/spellLibrary'
import { sourceHash, type CapturedSpellBundle } from './capture'
import { countChanges, emptyCounts, identityHash, stableJson } from './differences'
import { SPELL_SCHEMA } from './schema'
import type { SpellCheckResult, SpellStorageStatus, SpellWorkerData } from './workerProtocol'

interface SnapshotRow { id: string; content_id: string; parser_version: string; first_observed: string; record_count: number; hashes: string }
interface InstallRow { id: string; root: string; current_snapshot: string | null; checked_at: string | null }
interface ObservationRow { id: number; observed_at: string; reason: SpellCheckReason; outcome: SpellObservation['outcome']; snapshot_id: string | null; previous_snapshot_id: string | null; message: string; counts: string }
export interface SpellImportInput {
  root: string; reason: SpellCheckReason; parserVersion: string; capture: CapturedSpellBundle; records: ClientSpellRecord[]
}
export function normalizeSpellRoot(root: string): string {
  const absolute = resolve(root)
  const canonical = existsSync(absolute) ? realpathSync.native(absolute) : absolute
  const normalized = canonical.replace(/[\\/]+$/, '').replace(/\\/g, '/')
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}
export function spellInstallId(root: string): string { return `i-${identityHash(normalizeSpellRoot(root))}` }
function observationFromRow(value: ObservationRow): SpellObservation {
  return {
    id: value.id, observedAt: value.observed_at, reason: value.reason, outcome: value.outcome,
    snapshotId: value.snapshot_id, previousSnapshotId: value.previous_snapshot_id,
    message: value.message, counts: JSON.parse(value.counts) as SpellObservation['counts']
  }
}
function diskBytes(path: string): number {
  if (!existsSync(path)) return 0
  if (statSync(path).isFile()) return statSync(path).size
  return readdirSync(path, { withFileTypes: true }).reduce((sum, item) =>
    sum + (item.isSymbolicLink() ? 0 : diskBytes(join(path, item.name))), 0)
}

/** One writer owns this connection. Query workers open independent read-only WAL connections. */
export class SpellLibraryStorage {
  readonly db: DatabaseSync
  readonly storageDir: string
  private readonly statements = new Map<string, StatementSync>()
  constructor(readonly options: SpellWorkerData, readOnly = false) {
    this.storageDir = resolve(options.storageDir)
    if (!readOnly) { mkdirSync(dirname(options.databasePath), { recursive: true }); mkdirSync(this.storageDir, { recursive: true }) }
    this.db = new DatabaseSync(options.databasePath, { readOnly })
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;')
    if (!readOnly) {
      const version = Number(this.db.prepare('PRAGMA user_version').get()?.user_version ?? 0)
      if (version > 1) throw new Error('Spell library database is newer than this version of Oracle')
      this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;')
      this.db.exec(SPELL_SCHEMA)
    }
  }
  statement(sql: string): StatementSync {
    let statement = this.statements.get(sql)
    if (!statement) { statement = this.db.prepare(sql); this.statements.set(sql, statement) }
    return statement
  }
  close(): void { this.statements.clear(); this.db.close() }
  readConsistent<T>(read: () => T): T {
    this.db.exec('BEGIN')
    try { const value = read(); this.db.exec('COMMIT'); return value }
    catch (error) { this.db.exec('ROLLBACK'); throw error }
  }
  private install(installId: string): InstallRow | undefined {
    return this.statement('SELECT * FROM installs WHERE id=?').get(installId) as unknown as InstallRow | undefined
  }
  ensureInstall(root: string): string {
    const installId = spellInstallId(root)
    this.statement('INSERT OR IGNORE INTO installs(id,root) VALUES(?,?)').run(installId, normalizeSpellRoot(root))
    return installId
  }
  active(installId: string): SpellDataset | null {
    const snapshotId = this.install(installId)?.current_snapshot
    return snapshotId ? this.dataset(installId, snapshotId) : null
  }
  dataset(installId: string, snapshotId: string): SpellDataset {
    const scoped = this.statement('SELECT 1 FROM observations WHERE install_id=? AND snapshot_id=? LIMIT 1').get(installId, snapshotId)
    if (!scoped) throw new Error('Snapshot does not belong to this installation')
    return this.datasetUnchecked(installId, snapshotId)
  }
  private datasetUnchecked(installId: string, snapshotId: string): SpellDataset {
    const value = this.statement('SELECT s.*,c.hashes FROM snapshots s JOIN contents c ON c.id=s.content_id WHERE s.id=?').get(snapshotId) as unknown as SnapshotRow | undefined
    if (!value) throw new Error('Unknown spell snapshot')
    return {
      installId, snapshotId: value.id, contentId: value.content_id, parserVersion: value.parser_version,
      firstObserved: value.first_observed, recordCount: value.record_count,
      hashes: JSON.parse(value.hashes) as SpellDataset['hashes']
    }
  }
  *records(snapshotId: string): Generator<ClientSpellRecord> {
    for (const value of this.statement('SELECT r.record FROM members m JOIN revisions r ON r.id=m.revision_id WHERE m.snapshot_id=? ORDER BY m.spell_id').iterate(snapshotId)) {
      yield JSON.parse(value.record as string) as ClientSpellRecord
    }
  }
  record(snapshotId: string, id: number): ClientSpellRecord | null {
    const value = this.statement('SELECT r.record FROM members m JOIN revisions r ON r.id=m.revision_id WHERE m.snapshot_id=? AND m.spell_id=?').get(snapshotId, id)
    return value ? JSON.parse(value.record as string) as ClientSpellRecord : null
  }
  private archiveSource(hash: string, bytes: Buffer): void {
    const target = join(this.storageDir, 'sources', `${hash}.gz`)
    mkdirSync(dirname(target), { recursive: true })
    if (!existsSync(target)) {
      const compressed = gzipSync(bytes)
      const temporary = `${target}.${randomUUID()}.tmp`
      try { writeFileSync(temporary, compressed, { flag: 'wx' }); renameSync(temporary, target) }
      finally { rmSync(temporary, { force: true }) }
    }
    if (sourceHash(gunzipSync(readFileSync(target))) !== hash) throw new Error('Stored spell source failed its integrity check')
    this.statement('INSERT OR IGNORE INTO source_files(hash,bytes,compressed_bytes) VALUES(?,?,?)')
      .run(hash, bytes.length, statSync(target).size)
  }
  private materializeSources(dataset: SpellDataset): string {
    const directory = join(this.storageDir, 'materialized', `${dataset.snapshotId}-${randomUUID()}`)
    mkdirSync(directory, { recursive: true })
    try {
      for (const name of SPELL_SOURCE_FILES) {
        const hash = dataset.hashes[name]
        if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid archived source hash')
        const bytes = gunzipSync(readFileSync(join(this.storageDir, 'sources', `${hash}.gz`)))
        if (sourceHash(bytes) !== hash) throw new Error('Archived source failed its integrity check')
        writeFileSync(join(directory, name), bytes, { flag: 'wx' })
      }
      return directory
    } catch (error) { rmSync(directory, { recursive: true, force: true }); throw error }
  }
  materialize(installId: string, snapshotId: string): { dataset: SpellDataset; materializedDir: string } {
    const dataset = this.dataset(installId, snapshotId)
    return { dataset, materializedDir: this.materializeSources(dataset) }
  }
  private insertSnapshot(input: SpellImportInput, contentId: string, snapshotId: string, observedAt: string): void {
    this.statement('INSERT OR IGNORE INTO contents(id,hashes) VALUES(?,?)').run(contentId, stableJson(input.capture.hashes))
    this.statement('INSERT INTO snapshots(id,content_id,parser_version,first_observed,record_count) VALUES(?,?,?,?,?)')
      .run(snapshotId, contentId, input.parserVersion, observedAt, input.records.length)
    for (const record of input.records) {
      const hash = identityHash({ parserVersion: input.parserVersion, record })
      this.statement('INSERT OR IGNORE INTO revisions(hash,spell_id,record) VALUES(?,?,?)').run(hash, record.id, stableJson(record))
      const revision = this.statement('SELECT id FROM revisions WHERE hash=?').get(hash)
      if (!revision) throw new Error('Missing spell revision')
      this.statement('INSERT INTO members(snapshot_id,spell_id,revision_id) VALUES(?,?,?)').run(snapshotId, record.id, Number(revision.id))
    }
  }
  private outcome(previous: SpellDataset | null, next: SpellDataset, seen: boolean): SpellObservation['outcome'] {
    if (!previous) return 'baseline'
    if (previous.snapshotId === next.snapshotId) return 'unchanged'
    if (previous.contentId === next.contentId && previous.parserVersion !== next.parserVersion) return 'parser-upgrade'
    return seen ? 'rollback' : 'changed'
  }
  private validateRecords(input: SpellImportInput): void {
    if (!input.records.length) throw new Error('Cannot publish an empty spell catalog')
    const ids = new Set<number>()
    for (const record of input.records) {
      if (!Number.isSafeInteger(record.id) || record.id < 0 || ids.has(record.id)) throw new Error('Invalid or duplicate spell ID')
      ids.add(record.id)
    }
  }
  private archiveCapture(capture: CapturedSpellBundle): void {
    for (const name of SPELL_SOURCE_FILES) {
      if (sourceHash(capture.sources[name]) !== capture.hashes[name]) throw new Error('Capture hash mismatch')
      this.archiveSource(capture.hashes[name], capture.sources[name])
    }
  }
  publish(input: SpellImportInput): SpellCheckResult {
    this.validateRecords(input)
    const installId = this.ensureInstall(input.root)
    const contentId = `c-${identityHash(SPELL_SOURCE_FILES.map((name) => [name, input.capture.hashes[name]]))}`
    const snapshotId = `s-${identityHash({ contentId, parserVersion: input.parserVersion })}`
    const observedAt = new Date().toISOString()
    const previous = this.active(installId)
    const seen = !!this.statement('SELECT 1 FROM observations WHERE install_id=? AND snapshot_id=? LIMIT 1').get(installId, snapshotId)
    const known = !!this.statement('SELECT 1 FROM snapshots WHERE id=?').get(snapshotId)
    const dataset: SpellDataset = { installId, snapshotId, contentId, parserVersion: input.parserVersion,
      firstObserved: observedAt, recordCount: input.records.length, hashes: input.capture.hashes }
    // Validate and materialize before publishing. A disk/corruption failure cannot replace the
    // installation's previously valid pointer. Only the coordinator retires old generations.
    this.archiveCapture(input.capture)
    const materializedDir = this.materializeSources(dataset)
    try {
      this.db.exec('BEGIN IMMEDIATE')
      if (!known) this.insertSnapshot(input, contentId, snapshotId, observedAt)
      const next = this.datasetUnchecked(installId, snapshotId)
      const outcome = this.outcome(previous, next, seen)
      const counts = outcome === 'unchanged' ? emptyCounts() : countChanges(previous ? this.records(previous.snapshotId) : [], input.records, previous?.parserVersion !== next.parserVersion)
      const observation = { observedAt, reason: input.reason, outcome, snapshotId,
        previousSnapshotId: previous?.snapshotId ?? null, message: `${input.records.length} client spells; ${outcome}`, counts }
      const result = this.statement('INSERT INTO observations(install_id,observed_at,reason,outcome,snapshot_id,previous_snapshot_id,message,counts) VALUES(?,?,?,?,?,?,?,?)')
        .run(installId, observedAt, input.reason, outcome, snapshotId, observation.previousSnapshotId, observation.message, stableJson(counts))
      this.statement('UPDATE installs SET current_snapshot=?,checked_at=? WHERE id=?').run(snapshotId, observedAt, installId)
      this.db.exec('COMMIT')
      return { dataset: next, observation: { id: Number(result.lastInsertRowid), ...observation }, materializedDir }
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK')
      rmSync(materializedDir, { recursive: true, force: true })
      throw error
    }
  }
  recordFailure(root: string, reason: SpellCheckReason, message: string): SpellObservation {
    const installId = this.ensureInstall(root)
    const observedAt = new Date().toISOString()
    const snapshotId = this.active(installId)?.snapshotId ?? null
    const counts = emptyCounts()
    const result = this.statement('INSERT INTO observations(install_id,observed_at,reason,outcome,snapshot_id,previous_snapshot_id,message,counts) VALUES(?,?,?,?,?,?,?,?)')
      .run(installId, observedAt, reason, 'error', snapshotId, snapshotId, message, stableJson(counts))
    this.statement('UPDATE installs SET checked_at=? WHERE id=?').run(observedAt, installId)
    return { id: Number(result.lastInsertRowid), observedAt, reason, outcome: 'error', snapshotId, previousSnapshotId: snapshotId, message, counts }
  }
  observations(installId: string, page = 1, pageSize = 50): { observations: SpellObservation[]; total: number } {
    const total = Number(this.statement('SELECT count(*) AS n FROM observations WHERE install_id=?').get(installId)?.n ?? 0)
    const values = this.statement('SELECT * FROM observations WHERE install_id=? ORDER BY id DESC LIMIT ? OFFSET ?').all(installId, pageSize, (page - 1) * pageSize)
    return { total, observations: values.map((value) => observationFromRow(value as unknown as ObservationRow)) }
  }
  *allObservations(installId: string): Generator<SpellObservation> {
    for (const value of this.statement('SELECT * FROM observations WHERE install_id=? ORDER BY id').iterate(installId)) {
      yield observationFromRow(value as unknown as ObservationRow)
    }
  }
  snapshots(installId: string): SpellDataset[] {
    return this.statement('SELECT snapshot_id FROM observations WHERE install_id=? AND snapshot_id IS NOT NULL GROUP BY snapshot_id ORDER BY max(id) DESC').all(installId)
      .map((value) => this.datasetUnchecked(installId, String(value.snapshot_id)))
  }
  status(installId: string): SpellStorageStatus {
    return { installId, dataset: this.active(installId), checkedAt: this.install(installId)?.checked_at ?? null,
      storageBytes: diskBytes(this.storageDir) + (resolve(this.options.databasePath).startsWith(this.storageDir + sep) ? 0 : diskBytes(this.options.databasePath)) }
  }
  /** Called only after main has stopped all readers of retired materialized generations. */
  cleanup(retainDirectories: string[]): number {
    const base = join(this.storageDir, 'materialized')
    const retained = new Set(retainDirectories.map((directory) => resolve(directory)))
    if (!existsSync(base)) return 0
    for (const directory of retained) {
      if (dirname(directory) !== base) throw new Error('Retained generation is outside the materialized source directory')
    }
    let removed = 0
    for (const item of readdirSync(base, { withFileTypes: true })) {
      const path = join(base, item.name)
      if (retained.has(path)) continue
      if (item.isSymbolicLink()) throw new Error('Unexpected symbolic link in materialized sources')
      rmSync(path, { recursive: true, force: true }); removed++
    }
    return removed
  }
}
