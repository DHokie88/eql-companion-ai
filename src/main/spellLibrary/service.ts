import { join, resolve } from 'node:path'
import type { SpellCheckReason, SpellDataset, SpellLibraryStatus, SpellObservation } from '../../shared/spellLibrary'
import { SpellWorkerRpc } from './rpc'
import type { SpellResistTable } from '../../shared/resistTypes'
import { setSpellActivation } from './activation'
import type { SpellModifierContext } from '../../shared/spellModifiers'
import { evaluationArg } from './queryValidation'

interface Published { dataset: SpellDataset; observation?: SpellObservation; materializedDir: string }
interface SavedStatus { dataset: SpellDataset | null; installId: string; storageBytes: number; checkedAt: string | null }
export interface SpellRpc { call<T>(method: string, args?: unknown): Promise<T>; stop(): void }
export interface SpellLibraryDeps {
  modifierContext?: () => Promise<SpellModifierContext>
  userData: string
  workerDirectory: string
  root: () => string
  changed: (status: SpellLibraryStatus) => void
  activateEngine: (root: string, snapshotId: string, directory: string) => Promise<boolean>
  log: (error: unknown) => void
  selectInstallation: (root: string) => void
  prepareReference: (path: string) => Promise<SpellResistTable>
  installReference: (root: string, snapshotId: string, table: SpellResistTable, observedAt: string) => void
  createWorker?: (role: 'writer' | 'reader') => SpellRpc
}

/** Owns checks and reader generations; neither worker can reset a session or choose an installation. */
export class SpellLibraryService {
  private writer: SpellRpc
  private reader: SpellRpc
  private generation = 0
  private installId = ''
  private desired: (Published & { root: string; generation: number }) | null = null
  private engineDirectory: string | null = null
  private engineLeases = new Set<string>()
  private checking: Promise<SpellLibraryStatus> | null = null
  private queued: SpellCheckReason | null = null
  private stopped = false
  private current: SpellLibraryStatus = {
    phase: 'idle', dataset: null, installation: null, checkedAt: null,
    message: 'No spell baseline captured yet.', error: null, storageBytes: 0
  }
  constructor(private readonly deps: SpellLibraryDeps) {
    const storageDir = join(deps.userData, 'spells')
    const data = { storageDir, databasePath: join(storageDir, 'catalog.sqlite') }
    this.writer = deps.createWorker?.('writer') ?? new SpellWorkerRpc(join(deps.workerDirectory, 'spellLibraryWriter.js'), data, (p) => {
      if (this.checking && this.current.installation === this.deps.root()) this.publish({ phase: p.phase, message: p.message })
    })
    this.reader = deps.createWorker?.('reader') ?? new SpellWorkerRpc(join(deps.workerDirectory, 'spellLibraryQuery.js'), data, () => { /* Read workers send no progress. */ })
    setSpellActivation(() => this.replayActivation())
  }
  status(): SpellLibraryStatus { return this.current }
  private publish(patch: Partial<SpellLibraryStatus>): void {
    if (this.stopped) return
    this.current = { ...this.current, ...patch }
    this.deps.changed(this.current)
  }
  private chooseRoot(root: string): void {
    if (this.current.installation === root) return
    this.generation++
    this.installId = ''
    this.desired = null
    this.deps.selectInstallation(root)
    this.publish({ installation: root, dataset: null, checkedAt: null, phase: 'checking', error: null,
      message: 'Checking this installation for a saved spell catalog…' })
  }
  async start(): Promise<void> {
    try {
      await this.writer.call('init')
      if (this.stopped) return
      await this.check('startup')
    } catch (error) { this.fail(error) }
  }
  /** Simultaneous launches/manual checks share a capture. A root change always gets its own check. */
  check(reason: SpellCheckReason): Promise<SpellLibraryStatus> {
    const root = this.deps.root()
    const rootChanged = this.current.installation !== root
    this.chooseRoot(root)
    if (this.checking) {
      // Terminal status can reach a consumer just before the preceding promise's finalizer.
      // A new user request at that boundary must capture again rather than return old bytes.
      if (this.current.phase === 'ready' || this.current.phase === 'error') {
        return this.checking.then(() => this.check(reason))
      }
      if (rootChanged) this.queued = 'installation-change'
      else if (reason === 'game-launch' && this.current.phase !== 'checking') this.queued ??= 'game-launch'
      return this.checking
    }
    this.checking = this.run(root, reason, this.generation).finally(() => {
      this.checking = null
      if (this.stopped) return
      const queued = this.queued
      this.queued = null
      if (queued) void this.check(queued)
      else void this.cleanup()
    })
    return this.checking
  }
  private owns(root: string, generation: number): boolean {
    return !this.stopped && generation === this.generation && root === this.deps.root()
  }
  private async run(root: string, reason: SpellCheckReason, generation: number): Promise<SpellLibraryStatus> {
    try {
      await this.restore(root, generation)
      if (!this.owns(root, generation)) return this.current
      this.publish({ phase: 'checking', error: null, message: 'Hashing all three client files and capturing a stable bundle…' })
      const published = await this.writer.call<Published>('check', { root, reason })
      if (!this.owns(root, generation)) return this.current
      if (published.dataset.snapshotId !== this.current.dataset?.snapshotId) await this.activate(published, root, generation)
      if (!this.owns(root, generation)) return this.current
      const status = await this.writer.call<SavedStatus>('status', { root })
      if (!this.owns(root, generation)) return this.current
      this.installId = published.dataset.installId
      this.publish({ phase: 'ready', error: null, dataset: published.dataset, checkedAt: status.checkedAt,
        storageBytes: status.storageBytes, message: published.observation?.message ?? 'Spell catalog is up to date.' })
    } catch (error) { if (this.owns(root, generation)) this.fail(error) }
    return this.current
  }
  private async restore(root: string, generation: number): Promise<void> {
    const saved = await this.writer.call<SavedStatus>('status', { root })
    if (!this.owns(root, generation)) return
    this.installId = saved.installId
    this.publish({ storageBytes: saved.storageBytes, checkedAt: saved.checkedAt })
    if (this.current.dataset || !saved.dataset) return
    try {
      const restored = await this.writer.call<Published>('materialize', {
        installId: saved.dataset.installId, snapshotId: saved.dataset.snapshotId
      })
      if (this.owns(root, generation)) await this.activate(restored, root, generation)
    } catch (error) {
      if (this.owns(root, generation)) this.publish({ dataset: saved.dataset })
      throw error
    }
  }
  private async activate(published: Published, root: string, generation: number): Promise<void> {
    this.publish({ phase: 'activating', message: 'Preparing spell references for the captured revision…' })
    const table = await this.deps.prepareReference(join(published.materializedDir, 'spells_us.txt'))
    if (!this.owns(root, generation)) return
    const previous = this.desired
    this.desired = { ...published, root, generation }
    const desired = this.desired
    try { await this.replayActivation() }
    catch (error) { if (this.desired === desired) this.desired = previous; throw error }
    if (!this.owns(root, generation)) return
    this.deps.installReference(root, published.dataset.snapshotId, table, published.dataset.firstObserved)
    this.publish({ dataset: published.dataset })
  }
  async replayActivation(): Promise<void> {
    const desired = this.desired
    if (!desired || !this.owns(desired.root, desired.generation)) return
    this.engineLeases.add(desired.materializedDir)
    try {
      if (await this.deps.activateEngine(desired.root, desired.dataset.snapshotId, desired.materializedDir)) {
        if (this.desired === desired) this.engineDirectory = desired.materializedDir
      }
    } catch (error) {
      // The engine may not have attached a character yet. Its successful attach replays this handle.
      const code = (error as { code?: string }).code
      if (code !== 'unavailable') throw error
    } finally { this.engineLeases.delete(desired.materializedDir) }
  }
  private fail(error: unknown): void {
    this.deps.log(error)
    this.publish({ phase: 'error', checkedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error),
      message: this.current.dataset ? 'Refresh failed. Using the last valid captured catalog.' : 'Could not capture a spell baseline. Check the EQ installation and try again.' })
  }
  async query<T>(method: string, query: unknown = {}): Promise<T> {
    const root = this.deps.root()
    if (root !== this.current.installation) void this.check('installation-change')
    const generation = this.generation
    if (!this.installId) {
      await this.writer.call('init')
      const saved = await this.writer.call<SavedStatus>('status', { root })
      if (!this.owns(root, generation)) throw new Error('EQ installation changed. Please retry the query.')
      this.installId = saved.installId
    }
    const scoped = this.scopeQuery(method, query)
    const modifiers = await this.modifiersFor(query)
    if (!this.owns(root, generation)) throw new Error('EQ installation changed. Please retry the query.')
    const result = await this.reader.call<T>(method, { installId: this.installId, query: scoped, ...(modifiers ? { modifiers } : {}) })
    if (!this.owns(root, generation)) throw new Error('EQ installation changed. Please retry the query.')
    if (modifiers && (await this.deps.modifierContext?.())?.revision !== modifiers.revision) {
      throw new Error('Spell modifier inputs changed. Refresh the results.')
    }
    return result
  }
  private async modifiersFor(query: unknown): Promise<SpellModifierContext | undefined> {
    if (!query || typeof query !== 'object' || Array.isArray(query)) return undefined
    const options = evaluationArg((query as Record<string, unknown>).evaluation)
    if (!options) return undefined
    const context = await this.deps.modifierContext?.()
    if (context?.revision !== options.contextRevision || context.preferences.mode !== options.mode) {
      throw new Error('Spell modifier inputs changed. Refresh the results.')
    }
    if (options.mode === 'mine' && !context.character) throw new Error('Select a character to use Show mine.')
    return context
  }
  private scopeQuery(method: string, query: unknown): unknown {
    if (!query || typeof query !== 'object' || Array.isArray(query)) return query
    if (!this.current.dataset || !['search', 'detail', 'compare', 'rank'].includes(method)) return query
    const q = query as Record<string, unknown>
    return { ...q, snapshotId: q.snapshotId ?? this.current.dataset.snapshotId }
  }
  private async cleanup(): Promise<void> {
    if (this.stopped || this.checking) return
    const retainDirectories = [...this.engineLeases, this.engineDirectory, this.desired?.materializedDir]
      .filter((p): p is string => typeof p === 'string').map((p) => resolve(p))
    try { await this.writer.call('cleanup', { retainDirectories }) } catch (error) { this.deps.log(error) }
  }
  stop(): void {
    this.stopped = true
    this.generation++
    setSpellActivation(null)
    this.writer.stop()
    this.reader.stop()
  }
}
