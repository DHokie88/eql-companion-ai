import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import {
  defaultSpellModifierPreferences,
  SPELL_MODIFIER_MODEL_VERSION,
  type SpellModifierContext,
  type SpellModifierPreferences
} from '../../shared/spellModifiers'
import type { ModifierProfiles, ModifierProfileStore } from './modifierProfiles'
import { validateModifierUpdate } from './modifierValidation'

export interface ModifierSelection {
  installation: string
  character: { name: string; server: string } | null
}
export type ModifierFacts = Pick<SpellModifierContext, 'ranks' | 'inventory' | 'warnings'>
export interface ModifierContextDependencies {
  selection(): ModifierSelection
  read(selection: ModifierSelection): Promise<ModifierFacts>
  store: ModifierProfileStore
  changed(revision: string): void
  log(error: unknown): void
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]))
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}

function selectionKey(selection: ModifierSelection): string {
  return digest({ installation: resolve(selection.installation).replaceAll('\\', '/').toLowerCase(),
    name: selection.character?.name.toLowerCase() ?? null, server: selection.character?.server.toLowerCase() ?? null })
}

function unavailable(error?: unknown): ModifierFacts {
  return { ranks: null, inventory: { state: 'missing', exportedAt: null, candidates: [], warnings: [] },
    warnings: error === undefined ? [] : ['Character modifier inputs are unavailable. Refresh after the engine is ready.'] }
}

/** Epochs guard reads; content digests guard calculations. A repeated cast changes neither model. */
export class SpellModifierCoordinator {
  private invalidation = 1
  private completed = 0
  private pending: Promise<void> | null = null
  private context: SpellModifierContext | null = null
  private selection: string | null = null
  private profiles: ModifierProfiles = {}
  private profilesLoaded = false
  private sessionProfiles: ModifierProfiles = {}
  private stopped = false
  private updateTail: Promise<unknown> = Promise.resolve()

  constructor(private readonly deps: ModifierContextDependencies) {}

  inputsChanged(): void {
    if (this.stopped) return
    this.invalidation++
    void this.get().catch((error: unknown) => this.deps.log(error))
  }

  async get(): Promise<SpellModifierContext> {
    while (!this.stopped) {
      const current = selectionKey(this.deps.selection())
      if (this.completed === this.invalidation && this.selection === current && this.context !== null) {
        return structuredClone(this.context)
      }
      this.pending ??= this.refresh().finally(() => { this.pending = null })
      await this.pending
    }
    throw new Error('Spell modifier context has stopped')
  }

  update(input: unknown): Promise<SpellModifierContext> {
    const update = validateModifierUpdate(input)
    const run = this.updateTail.then(async () => {
      const context = await this.get()
      if (context.revision !== update.expectedRevision) throw new Error('Spell modifier context changed; refresh and try again')
      if (context.character === null && update.preferences.mode === 'mine') throw new Error('Select a character to show detected spell values')
      const key = selectionKey(this.deps.selection())
      if (this.selection !== key) throw new Error('Spell modifier context changed; refresh and try again')
      await this.savePreferences(key, context.character !== null, update.preferences)
      this.invalidation++
      const next = await this.get()
      if (this.selection !== key) throw new Error('Spell modifier character changed while saving')
      return next
    })
    this.updateTail = run.catch(() => undefined)
    return run
  }

  stop(): void { this.stopped = true; this.invalidation++ }

  private async loadProfiles(): Promise<void> {
    if (this.profilesLoaded) return
    try { this.profiles = await this.deps.store.load() } catch (error) { this.deps.log(error) }
    this.profilesLoaded = true
  }

  private async savePreferences(key: string, persist: boolean, preferences: SpellModifierPreferences): Promise<void> {
    const copy = structuredClone(preferences)
    if (!persist) { this.sessionProfiles = { ...this.sessionProfiles, [key]: copy }; return }
    const profiles = { ...this.profiles, [key]: copy }
    await this.deps.store.save(profiles)
    this.profiles = profiles
  }

  private async refresh(): Promise<void> {
    await this.loadProfiles()
    while (!this.stopped) {
      const token = this.invalidation
      const selection = structuredClone(this.deps.selection())
      const key = selectionKey(selection)
      let facts = unavailable()
      try { if (selection.character !== null) facts = await this.deps.read(selection) } catch (error) {
        this.deps.log(error)
        facts = unavailable(error)
      }
      if (token !== this.invalidation || key !== selectionKey(this.deps.selection())) continue
      const preferences = (selection.character === null ? this.sessionProfiles[key] : this.profiles[key]) ?? defaultSpellModifierPreferences()
      const character = selection.character === null ? null : { ...selection.character, key }
      const value = { modelVersion: SPELL_MODIFIER_MODEL_VERSION, character, preferences, ...facts }
      // Export timestamps are provenance. Rewriting identical gear must not re-rank the catalog.
      const revision = digest({ key, ...value, inventory: { ...value.inventory, exportedAt: undefined } })
      const next = { revision, ...value }
      const changed = JSON.stringify(this.context) !== JSON.stringify(next)
      this.context = next
      this.selection = key
      this.completed = token
      if (changed) this.deps.changed(revision)
      if (token === this.invalidation) return
    }
  }
}
