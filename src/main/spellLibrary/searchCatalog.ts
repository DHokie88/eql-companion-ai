import type { SpellMechanicsCatalog } from '../../shared/clientSpellMechanics'
import type { SpellRankingRow } from '../../shared/spellAnalysis'
import type { ClientSpellRecord, SpellDataset, SpellMetric, SpellSearchResult, SpellSummary } from '../../shared/spellLibrary'
import { clientSpellType, clientSpellTypeLabel, compareSpellValues, minimumSpellLevel, spellBrowseSortValue, spellTypeLabel } from '../../shared/clientSpellBrowse'
import { matchesSpellSearch, spellSearchOptions } from './browseQuery'
import { levelArg, pageArgs } from './queryValidation'
import type { SpellLibraryStorage } from './storage'
import type { SpellCalculator } from './workerEvaluation'
import { clientSpellDescription } from '../../shared/clientSpellDescriptions'
import { spellLineCandidate, type SpellLineCandidate } from '../../shared/clientSpellLines'
import { bestCatalogSpellLines } from './bestSpellLines'

const CALCULATED_SORTS = new Set(['amount', 'efficiency', 'rate', 'cast', 'recovery', 'recast', 'duration', 'ticks', 'waves', 'targets', 'hits'])
type SearchOptions = ReturnType<typeof spellSearchOptions>
interface EvaluationDependencies { calculate: SpellCalculator; mechanics?: SpellMechanicsCatalog }

export function catalogSummary(record: ClientSpellRecord, classes: SearchOptions['classes'], mechanics?: SpellMechanicsCatalog, level?: number): SpellSummary {
  const { id, name, rank, mana, category, subcategory, beneficial, target, castMs, recoveryMs, recastMs } = record
  return { id, name, rank, classes: record.classes, mana, category, subcategory, beneficial, target, castMs, recoveryMs, recastMs, description: clientSpellDescription(record, level),
    learnedLevel: minimumSpellLevel(record.classes, classes), spellType: clientSpellType(record, mechanics), typeLabel: clientSpellTypeLabel(record, mechanics) }
}
function evaluate(record: ClientSpellRecord, row: SpellSummary, level: number, input: { calculate: SpellCalculator; metric?: SpellMetric }): void {
  row.calculations = record.effects.some((e) => [0, 79, 100, 101, 334].includes(e.spa))
    ? [input.calculate(record, level, input.metric ?? (record.beneficial ? 'healing' : 'damage'))] : []
}

function addTypes(row: SpellSummary, types: Set<string>): void {
  if (row.spellType) types.add(row.spellType)
  if (row.typeLabel && /^AOE[1-9]\d*$/.test(row.typeLabel)) types.add(row.typeLabel.toLowerCase())
}
function addCandidate(record: ClientSpellRecord, row: SpellSummary, candidates: Map<number, SpellLineCandidate>, options: SearchOptions): void {
  if (!options.bestInLine) return
  const candidate = spellLineCandidate(record, options.level ?? 50, row.calculations?.[0]?.modifiers?.rank ?? null)
  if (candidate) candidates.set(record.id, candidate)
}
function collect(storage: SpellLibraryStorage, dataset: SpellDataset | null, options: SearchOptions, input: { evaluateRow: (record: ClientSpellRecord, row: SpellSummary) => void; mechanics?: SpellMechanicsCatalog }) {
  const matches: SpellSummary[] = [], categories = new Set<string>(), subcategories = new Set<string>(), types = new Set<string>()
  const candidates = new Map<number, SpellLineCandidate>()
  const sourceRecords = new Map<number, ClientSpellRecord>()
  if (dataset) for (const record of storage.records(dataset.snapshotId)) {
    if (record.category) categories.add(record.category)
    if (record.subcategory && (!options.category || record.category === options.category)) subcategories.add(record.subcategory)
    if (!matchesSpellSearch(record, { ...options, type: undefined }, input.mechanics)) continue
    const row = catalogSummary(record, options.classes, input.mechanics, options.level)
    addTypes(row, types)
    if (options.type && !matchesSpellSearch(record, options, input.mechanics)) continue
    input.evaluateRow(record, row)
    addCandidate(record, row, candidates, options)
    if (options.bestInLine) sourceRecords.set(record.id, record)
    matches.push(row)
  }
  const typeOptions = [...types].sort().map((value) => ({ value: value as NonNullable<SpellSummary['spellType']>, label: spellTypeLabel(value as NonNullable<SpellSummary['spellType']>) }))
  return { matches, candidates, sourceRecords, categories: [...categories].sort(), subcategories: [...subcategories].sort(), typeOptions }
}

function resultGroup(row: SpellSummary, metric: SpellMetric): 'ranked' | 'zeroMana' | 'excluded' {
  const calculation = row.calculations?.[0]
  if (calculation?.metric !== metric || calculation.total === null || calculation.total <= 0) return 'excluded'
  return row.mana === 0 ? 'zeroMana' : 'ranked'
}
function groupedRows(rows: SpellSummary[], metric: SpellMetric) {
  const groups: Record<'ranked' | 'zeroMana' | 'excluded', SpellSummary[]> = { ranked: [], zeroMana: [], excluded: [] }
  for (const row of rows) groups[resultGroup(row, metric)].push(row)
  return groups
}
function highlight(rows: SpellSummary[], kind: 'efficiency' | 'amount' | 'rate'): SpellRankingRow | null {
  let best: SpellSummary | null = null
  const selected = new Set<number>()
  for (const row of rows) {
    const value = spellBrowseSortValue(row, kind, selected)
    if (value === null) continue
    if (!best || compareSpellValues(value, spellBrowseSortValue(best, kind, selected), 'desc') < 0 ||
      (value === spellBrowseSortValue(best, kind, selected) && row.id < best.id)) best = row
  }
  return best?.calculations?.[0] ? { ...best, calculation: best.calculations[0] } : null
}
function summaryGroups(rows: SpellSummary[], options: SearchOptions) {
  const groups = groupedRows(rows, options.metric), eligible = [...groups.ranked, ...groups.zeroMana]
  return { groups, groupCounts: { ranked: groups.ranked.length, zeroMana: groups.zeroMana.length, excluded: groups.excluded.length },
    highlights: options.includeHighlights ? [
      { kind: 'efficiency' as const, record: highlight(groups.ranked, 'efficiency') },
      { kind: 'amount' as const, record: highlight(eligible, 'amount') },
      { kind: 'rate' as const, record: highlight(eligible, 'rate') }
    ] : undefined }
}

function evaluationOptions(query: Record<string, unknown>, options: SearchOptions, calculate: SpellCalculator) {
  const requested = CALCULATED_SORTS.has(options.sortBy) || query.group !== undefined || options.includeHighlights
    || query.evaluation !== undefined || query.analysis !== undefined
  const all = options.bestInLine || CALCULATED_SORTS.has(options.sortBy) || query.group !== undefined || options.includeHighlights
  const level = requested ? levelArg(query.level) : options.bestInLine ? levelArg(query.level ?? 50) : undefined
  return { all, level, calculate, metric: query.metric === undefined ? undefined : options.metric }
}
function evaluatePage(storage: SpellLibraryStorage, dataset: SpellDataset | null, rows: SpellSummary[], evaluation: ReturnType<typeof evaluationOptions>): void {
  if (evaluation.all || evaluation.level === undefined || !dataset) return
  for (const row of rows) {
    const record = storage.record(dataset.snapshotId, row.id)
    if (record) evaluate(record, row, evaluation.level, evaluation)
  }
}
/** Sort the complete filtered catalog in the query worker, then evaluate just the requested page when possible. */
export function searchCatalog(storage: SpellLibraryStorage, dataset: SpellDataset | null, query: Record<string, unknown>, dependencies: EvaluationDependencies): SpellSearchResult {
  const { calculate, mechanics } = dependencies, options = spellSearchOptions(query)
  const { page, pageSize } = pageArgs(query)
  const evaluation = evaluationOptions(query, options, calculate)
  const { matches, candidates, sourceRecords, ...facets } = collect(storage, dataset, options, { mechanics, evaluateRow: (record, row) => {
    if (evaluation.all && evaluation.level !== undefined) evaluate(record, row, evaluation.level, evaluation)
  } })
  const choices = options.bestInLine ? bestCatalogSpellLines(matches, sourceRecords, candidates, options) : matches
  const summary = evaluation.all ? summaryGroups(choices, options) : undefined
  const group = options.group === 'zero-mana' ? 'zeroMana' : options.group
  const rows = !summary || group === 'all' ? choices : summary.groups[group]
  const matching = group === 'all' ? matches : matches.filter((row) => resultGroup(row, options.metric) === group)
  rows.sort((a, b) => compareSpellValues(spellBrowseSortValue(a, options.sortBy, options.selected),
    spellBrowseSortValue(b, options.sortBy, options.selected), options.direction) || a.id - b.id)
  const records = rows.slice((page - 1) * pageSize, page * pageSize)
  evaluatePage(storage, dataset, records.flatMap((row) => [row, ...row.line?.alternatives ?? []]), evaluation)
  return { dataset, total: rows.length, page, pageSize, records, ...facets,
    matchingRecords: matching.length,
    matchingTypes: [...new Set(matching.map((row) => row.typeLabel ?? row.spellType ?? ''))].sort(),
    matchingCategories: [...new Set(matching.map((row) => row.category ?? ''))].sort(),
    ...(summary ? { groupCounts: summary.groupCounts, highlights: summary.highlights } : {}) }
}
