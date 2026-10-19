/** Compact per-snapshot indexes. Full raw records stay in SQLite; ambiguity
 * detection includes every numeric ID, including internal and NPC records.
 */
import { decodeClientSpellFocus, type ClientSpellFocus } from './clientSpellFocus'
import { spellLineKey } from './spellLines'
import { BardInstrumentCatalog } from './bardInstrumentCatalog'
import type { ClientSpellRecord } from './spellLibrary'
import type { SpellFocusOption, SpellModifierContext } from './spellModifiers'

const nameKey = (name: string): string => name.trim().toLowerCase()
export interface ResolvedModifierRank {
  rank: number | null
  source: 'detected' | 'simulated' | 'unknown'
  warnings: string[]
}
export interface CatalogFocusSource { focus: ClientSpellFocus; item: string }
export interface CatalogFocusSources { sources: CatalogFocusSource[]; warnings: string[]; simulated: boolean }
type ExplicitRank = { rank: number; name: string } | undefined

function append(index: Map<string, number[]>, key: string, id: number): void {
  index.set(key, [...index.get(key) ?? [], id])
}

function validRank(rank: number): boolean { return Number.isInteger(rank) && rank >= 0 && rank <= 10 }

export class SpellModifierCatalog {
  private readonly names = new Map<string, number[]>()
  private readonly lines = new Map<string, number[]>()
  private readonly identities = new Map<number, string>()
  private readonly focuses = new Map<number, ClientSpellFocus>()
  readonly instruments = new BardInstrumentCatalog(this.names)

  constructor(records: Iterable<ClientSpellRecord>) {
    for (const record of records) {
      if (this.identities.has(record.id)) throw new Error(`Duplicate catalog spell ID ${record.id}.`)
      this.identities.set(record.id, record.name)
      append(this.names, nameKey(record.name), record.id)
      append(this.lines, spellLineKey(record.name), record.id)
      this.instruments.add(record)
      const focus = decodeClientSpellFocus(record)
      if (focus) this.focuses.set(record.id, focus)
    }
  }

  focusOptions(text = '', page = 1): { total: number; records: SpellFocusOption[] } {
    const query = text.trim().toLowerCase()
    const values = [...this.focuses.values()].filter((focus) => focus.name.toLowerCase().includes(query) || String(focus.id) === query)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
    const offset = (Math.max(1, Math.trunc(page)) - 1) * 30
    return {
      total: values.length,
      records: values.slice(offset, offset + 30).map((focus) => ({ id: focus.id, name: focus.name, kind: focus.kind, supported: !focus.reason, reason: focus.reason }))
    }
  }

  rank(record: ClientSpellRecord, context: SpellModifierContext): ResolvedModifierRank {
    const warnings: string[] = []
    const emulation = context.preferences.emulation
    if (context.preferences.mode === 'emulate') {
      const explicit = this.explicitRank(record, emulation.ranks[String(record.id)], warnings)
      if (explicit !== null) return { rank: explicit, source: 'simulated', warnings }
      if (emulation.rank !== null && validRank(emulation.rank)) return { rank: emulation.rank, source: 'simulated', warnings }
    }
    const detected = this.observedRank(record, context)
    return { ...detected, warnings: [...warnings, ...detected.warnings] }
  }

  observedRank(record: ClientSpellRecord, context: SpellModifierContext): ResolvedModifierRank {
    const warnings: string[] = []
    const key = spellLineKey(record.name)
    const observation = context.ranks?.[key]
    if (!observation || !validRank(observation.rank)) {
      warnings.push('Mote rank is unknown; the partial estimate assumes the client base amount.')
      return { rank: null, source: 'unknown', warnings }
    }
    if (this.lines.get(key)?.length !== 1 || nameKey(observation.name) !== nameKey(record.name)) {
      warnings.push('The observed mote-rank name matches multiple client IDs or classic spell lines; no upgrade was assumed.')
      return { rank: null, source: 'unknown', warnings }
    }
    return { rank: observation.rank, source: 'detected', warnings }
  }

  private explicitRank(record: ClientSpellRecord, explicit: ExplicitRank, warnings: string[]): number | null {
    if (!explicit) return null
    if (nameKey(explicit.name) !== nameKey(record.name)) {
      warnings.push('The saved spell-rank override names a different catalog record and was ignored.')
      return null
    }
    if (validRank(explicit.rank)) return explicit.rank
    warnings.push('The saved mote-rank override is invalid and was ignored.')
    return null
  }

  focusSources(context: SpellModifierContext): CatalogFocusSources {
    const emulation = context.preferences.emulation
    if (context.preferences.mode === 'emulate' && emulation.focus !== 'detected') {
      const sources: CatalogFocusSource[] = []
      const warnings: string[] = []
      if (emulation.focus === 'selected') {
        for (const id of new Set(emulation.focusIds)) this.selectedFocus(id, sources, warnings)
      }
      return { sources, warnings, simulated: true }
    }
    return this.detectedFocusSources(context)
  }

  private selectedFocus(id: number, sources: CatalogFocusSource[], warnings: string[]): void {
    const focus = this.focuses.get(id)
    if (focus) sources.push({ focus, item: 'Simulated focus' })
    else warnings.push(`Selected focus ID ${id} is unavailable or is not a damage/healing focus in this dataset.`)
  }

  private detectedFocusSources(context: SpellModifierContext): CatalogFocusSources {
    const sources: CatalogFocusSource[] = []
    const inventory = context.inventory
    const warnings = [...inventory.warnings]
    if (inventory.state !== 'ready') warnings.push('Worn focus is unknown until a valid inventory output is available; no focus was assumed.')
    if (inventory.state !== 'ready') return { sources, warnings, simulated: false }
    for (const candidate of inventory.candidates) {
      if (this.instruments.handles(candidate.effect)) continue
      const ids = this.names.get(nameKey(candidate.effect)) ?? []
      if (ids.length !== 1) {
        warnings.push(`${candidate.item}: focus ${candidate.effect} ${ids.length ? 'has multiple client IDs' : 'is absent from this dataset'} and was not applied.`)
        continue
      }
      const focus = this.focuses.get(ids[0])
      if (focus) sources.push({ focus, item: candidate.item })
      else warnings.push(`${candidate.item}: ${candidate.effect} is outside the supported damage/healing focus model.`)
    }
    return { sources, warnings, simulated: false }
  }
}
