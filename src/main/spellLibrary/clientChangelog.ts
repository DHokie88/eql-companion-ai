import { indexClientSpellBundle } from '../../shared/clientSpellParser'
import {
  SPELL_SOURCE_FILES, type ClientSpellRecord, type SpellBeforeAfterResult, type SpellChangesResult,
  type SpellChangeSummary, type SpellClass, type SpellDataset, type SpellSourceFile, type SpellUpdateCounts,
  type SpellUpdateSection
} from '../../shared/spellLibrary'
import { changeKind, spellDifferences } from './differences'
import type { SpellLibraryStorage } from './storage'

type SpellIndex = ReturnType<typeof indexClientSpellBundle>

interface ChangeRow {
  summary: SpellChangeSummary
  names: string[]
}

interface ChangeList {
  counts: SpellUpdateCounts
  sections: Record<SpellUpdateSection, ChangeRow[]>
}

interface ComparedCaptures {
  key: string
  before: SpellIndex
  after: SpellIndex
  list?: ChangeList
}

export interface SpellUpdateFilters {
  page: number
  pageSize: number
  section: SpellUpdateSection
  id?: number
  text?: string
  classes?: SpellClass[]
}

function summarize(before: ClientSpellRecord | null, after: ClientSpellRecord | null): ChangeRow | null {
  const record = after ?? before
  if (!record) return null
  const differences = spellDifferences(before, after)
  if (!differences.length) return null
  const nonFormat = differences.filter((difference) => difference.kind !== 'format')
  const kind = nonFormat.length ? changeKind(nonFormat) : 'format'
  const otherClasses = before?.classes.filter(({ code }) => !record.classes.some((entry) => entry.code === code)) ?? []
  const fields = differences.filter((difference) => difference.kind === kind).map((difference) => difference.field)
  const names = before && after && before.name !== after.name ? [after.name, before.name] : [record.name]
  return { names: names.map((name) => name.toLowerCase()), summary: {
    id: record.id, name: record.name, kind, fields: differences.length,
    changedFields: fields, classes: [...record.classes, ...otherClasses]
  } }
}

function buildChangeList(before: SpellIndex, after: SpellIndex): ChangeList {
  const sections: ChangeList['sections'] = { spells: [], raw: [], format: [] }
  const counts: SpellUpdateCounts = { added: 0, changed: 0, removed: 0, rawOnly: 0, formatOnly: 0 }
  for (const id of new Set([...before.ids(), ...after.ids()])) {
    const row = summarize(before.record(id), after.record(id))
    if (!row) continue
    switch (row.summary.kind) {
      case 'added': counts.added++; sections.spells.push(row); break
      case 'removed': counts.removed++; sections.spells.push(row); break
      case 'interpreted':
      case 'parser-upgrade': counts.changed++; sections.spells.push(row); break
      case 'raw-only': counts.rawOnly++; sections.raw.push(row); break
      case 'format': counts.formatOnly++; sections.format.push(row); break
    }
  }
  for (const rows of Object.values(sections)) rows.sort((a, b) =>
    a.summary.name.localeCompare(b.summary.name) || a.summary.id - b.summary.id)
  return { counts, sections }
}

function matches(row: ChangeRow, { id, text, classes }: SpellUpdateFilters): boolean {
  if (id !== undefined && row.summary.id !== id) return false
  if (classes?.length && !row.summary.classes?.some(({ code }) => classes.includes(code))) return false
  return !text || row.names.some((name) => name.includes(text))
}

/** Keep only the last comparison. Capture content is immutable, and parsing uses one column map for both sides. */
export class SpellClientChangelog {
  private cached: ComparedCaptures | undefined
  constructor(private readonly storage: SpellLibraryStorage) {}

  private index(dataset: SpellDataset): SpellIndex {
    const decoder = new TextDecoder('utf-8', { fatal: true })
    const sources = Object.fromEntries(SPELL_SOURCE_FILES.map((file) =>
      [file, decoder.decode(this.storage.readArchivedSource(dataset.hashes[file]))])) as Record<SpellSourceFile, string>
    return indexClientSpellBundle(sources)
  }

  private comparison(before: SpellDataset, after: SpellDataset): ComparedCaptures {
    const key = `${before.contentId}:${after.contentId}`
    if (this.cached?.key !== key) this.cached = { key, before: this.index(before), after: this.index(after) }
    return this.cached
  }

  changes(before: SpellDataset, after: SpellDataset, filters: SpellUpdateFilters): Pick<SpellChangesResult, 'total' | 'changes' | 'updateCounts'> {
    const comparison = this.comparison(before, after)
    const list = comparison.list ??= buildChangeList(comparison.before, comparison.after)
    const rows = list.sections[filters.section].filter((row) => matches(row, filters))
    const offset = (filters.page - 1) * filters.pageSize
    return { total: rows.length, changes: rows.slice(offset, offset + filters.pageSize).map((row) => row.summary), updateCounts: list.counts }
  }

  detail(before: SpellDataset, after: SpellDataset, id: number): Omit<SpellBeforeAfterResult, 'dataset'> {
    const comparison = this.comparison(before, after)
    const previous = comparison.before.record(id)
    const next = comparison.after.record(id)
    const differences = spellDifferences(previous, next)
    const technicalDifferences = differences.filter(({ kind }) => kind === 'raw-only' || kind === 'format')
    return { before: previous, after: next, differences, technicalDifferences }
  }
}
