import type { ClientSpellRecord, SpellDataset, SpellSummary } from '../../shared/spellLibrary'
import { SPELL_ANALYSIS_MODEL_VERSION, type SpellAnalysisSort, type SpellByLevelResult, type SpellRankingRow, type SpellRankingsResult } from '../../shared/spellAnalysis'
import { compareSpellValues, matchesSpellType, minimumSpellLevel, spellBrowseSortValue } from '../../shared/clientSpellBrowse'
import { analysisArg, ANALYSIS_SORTS, choiceArg, RANKING_CATEGORIES } from './analysisValidation'
import { matchesSpellSearch, SEARCH_QUERY_FIELDS, spellSearchOptions } from './browseQuery'
import { catalogSummary } from './searchCatalog'
import { levelArg, pageArgs, queryObject } from './queryValidation'
import type { SpellModifierContext } from '../../shared/spellModifiers'
import type { SpellLibraryStorage } from './storage'
import type { SpellCalculator, WorkerSpellEvaluation } from './workerEvaluation'

interface RankingGroups { ranked: SpellRankingRow[]; zeroMana: SpellRankingRow[]; excluded: SpellRankingRow[] }

function coreSortValues(row: SpellRankingRow) {
  return { id: row.id, name: row.name, level: row.learnedLevel ?? null, amount: row.calculation.total, mana: row.mana, efficiency: row.calculation.perMana }
}
function timingSortValues(row: SpellRankingRow) {
  const analysis = row.calculation.analysis
  return { rate: analysis?.timing.rate ?? null, cast: analysis?.timing.castMs ?? null, recovery: analysis?.timing.recoveryMs ?? null,
    recast: analysis?.timing.recastMs ?? null, duration: analysis?.timing.deliveryMs ?? null }
}
function sortValue(row: SpellRankingRow, field: SpellAnalysisSort): string | number | null {
  const analysis = row.calculation.analysis
  return { ...coreSortValues(row), ...timingSortValues(row), ticks: row.calculation.ticks,
    waves: analysis?.waves ?? null, targets: analysis?.effectiveTargets ?? null, hits: analysis?.hits ?? null }[field]
}
function bestRow(rows: SpellRankingRow[], field: 'efficiency' | 'amount' | 'rate'): SpellRankingRow | null {
  let best: SpellRankingRow | null = null
  for (const row of rows) {
    const value = sortValue(row, field)
    if (value === null) continue
    if (best === null || compareSpellValues(value, sortValue(best, field), 'desc') < 0 ||
      (value === sortValue(best, field) && row.id < best.id)) best = row
  }
  return best
}
function addRow(groups: RankingGroups, row: SpellRankingRow): void {
  if (row.calculation.total === null || row.calculation.total <= 0) groups.excluded.push(row)
  else if (row.mana === 0) groups.zeroMana.push(row)
  else groups.ranked.push(row)
}
function countCategories(record: ClientSpellRecord, counts: SpellRankingsResult['counts']): void {
  for (const category of RANKING_CATEGORIES) if (matchesSpellType(record, category)) counts[category]++
}
function facets(record: ClientSpellRecord, options: ReturnType<typeof spellSearchOptions>, result: { categories: Set<string>; subcategories: Set<string> }): void {
  if (record.category) result.categories.add(record.category)
  if (record.subcategory && (!options.category || record.category === options.category)) result.subcategories.add(record.subcategory)
}
function rankingOptions(input: unknown) {
  const query = queryObject(input, [...SEARCH_QUERY_FIELDS.filter((field) => field !== 'type'), 'categoryTab', 'group'])
  const level = levelArg(query.level)
  const category = choiceArg(query.categoryTab, 'ranking category', RANKING_CATEGORIES)
  const sortBy = choiceArg(query.sortBy ?? 'efficiency', 'ranking sort', ANALYSIS_SORTS)
  const direction = choiceArg(query.direction ?? 'desc', 'sort direction', ['asc', 'desc'] as const)
  const group = choiceArg(query.group ?? 'ranked', 'ranking group', ['ranked', 'zero-mana', 'excluded'] as const)
  if (!analysisArg(query.analysis)) throw new Error('Rankings require spell analysis settings')
  return { query, level, category, sortBy, direction, group,
    filters: spellSearchOptions({ ...query, sortBy: 'id', direction }), ...pageArgs({ ...query, pageSize: query.pageSize ?? 40 }) }
}
function byLevelOptions(input: unknown) {
  const query = queryObject(input, [...SEARCH_QUERY_FIELDS, 'view', 'throughLevel'])
  const base = spellSearchOptions({ ...query, sortBy: query.sortBy ?? 'level' })
  const level = levelArg(query.level)
  const view = choiceArg(query.view, 'level view', ['at', 'upcoming'] as const)
  const requestedEnd = levelArg(query.throughLevel ?? Math.min(255, level + 10))
  const throughLevel = view === 'at' ? level : requestedEnd
  if (throughLevel < level) throw new Error('Through level must not precede the selected level')
  const start = view === 'at' ? level : level + 1
  const min = Math.max(start, base.minLevel ?? start)
  const max = Math.min(throughLevel, base.maxLevel ?? throughLevel)
  const empty = min > max
  const filters = { ...base, allLevels: true, minLevel: min, maxLevel: max }
  return { query, level, throughLevel, empty, filters, ...pageArgs({ ...query, pageSize: query.pageSize ?? 40 }) }
}

/** Catalog-wide scans and calculations run only in the read worker, on one pinned snapshot. */
export class SpellAnalysisQueries {
  constructor(private readonly storage: SpellLibraryStorage, private readonly evaluation: WorkerSpellEvaluation) {}

  rankings(dataset: SpellDataset | null, input: unknown, context: unknown): SpellRankingsResult {
    const options = rankingOptions(input)
    const calculate = this.evaluation.calculator(dataset, options.query, context)
    const result = this.rankingRows(dataset, options, calculate)
    const groups = result.groups
    const rows = options.group === 'zero-mana' ? groups.zeroMana : groups[options.group]
    rows.sort((a, b) => compareSpellValues(sortValue(a, options.sortBy), sortValue(b, options.sortBy), options.direction) || a.id - b.id)
    const eligible = [...groups.ranked, ...groups.zeroMana]
    return { dataset, total: rows.length, page: options.page, pageSize: options.pageSize,
      records: rows.slice((options.page - 1) * options.pageSize, options.page * options.pageSize),
      categories: [...result.categories].sort(), subcategories: [...result.subcategories].sort(), counts: result.counts,
      groupCounts: { ranked: groups.ranked.length, zeroMana: groups.zeroMana.length, excluded: groups.excluded.length },
      highlights: [{ kind: 'efficiency', record: bestRow(groups.ranked, 'efficiency') },
        { kind: 'amount', record: bestRow(eligible, 'amount') }, { kind: 'rate', record: bestRow(eligible, 'rate') }],
      contextRevision: (context as SpellModifierContext | undefined)?.revision ?? null, modelVersion: SPELL_ANALYSIS_MODEL_VERSION, level: options.level }
  }

  private rankingRows(dataset: SpellDataset | null, options: ReturnType<typeof rankingOptions>, calculate: SpellCalculator) {
    const groups: RankingGroups = { ranked: [], zeroMana: [], excluded: [] }
    const result = { groups, categories: new Set<string>(), subcategories: new Set<string>(), counts: { dd: 0, dot: 0, aoe: 0, heal: 0, hot: 0 } }
    if (dataset) for (const record of this.storage.records(dataset.snapshotId)) {
      facets(record, options.filters, result)
      if (!matchesSpellSearch(record, options.filters)) continue
      countCategories(record, result.counts)
      if (!matchesSpellType(record, options.category)) continue
      const calculation = calculate(record, options.level, record.beneficial ? 'healing' : 'damage')
      addRow(groups, { ...catalogSummary(record, options.filters.classes), calculation, calculations: [calculation] })
    }
    return result
  }

  byLevel(dataset: SpellDataset | null, input: unknown, context: unknown): SpellByLevelResult {
    const options = byLevelOptions(input)
    const calculate = this.evaluation.calculator(dataset, options.query, context)
    const rows: SpellSummary[] = [], result = { categories: new Set<string>(), subcategories: new Set<string>() }
    if (dataset && !options.empty) for (const record of this.storage.records(dataset.snapshotId)) {
      facets(record, options.filters, result)
      if (!matchesSpellSearch(record, options.filters)) continue
      const learned = minimumSpellLevel(record.classes, options.filters.classes)
      if (learned === null) continue
      rows.push({ ...catalogSummary(record, options.filters.classes), description: record.description,
        detectedRank: this.evaluation.detectedRank(dataset, record, context),
        calculations: this.byLevelCalculations(record, learned, options.query, calculate) })
    }
    rows.sort((a, b) => compareSpellValues(spellBrowseSortValue(a, options.filters.sortBy, options.filters.selected),
      spellBrowseSortValue(b, options.filters.sortBy, options.filters.selected), options.filters.direction) || a.id - b.id)
    return { dataset, total: rows.length, page: options.page, pageSize: options.pageSize,
      records: rows.slice((options.page - 1) * options.pageSize, options.page * options.pageSize),
      categories: [...result.categories].sort(), subcategories: [...result.subcategories].sort(),
      level: options.level, throughLevel: options.throughLevel, contextRevision: (context as SpellModifierContext | undefined)?.revision ?? null }
  }

  private byLevelCalculations(record: ClientSpellRecord, level: number, query: Record<string, unknown>, calculate: SpellCalculator) {
    if (query.analysis === undefined && query.evaluation === undefined && query.sortBy !== 'amount' && query.sortBy !== 'efficiency') return undefined
    return record.effects.some((effect) => [0, 79, 100, 101, 334].includes(effect.spa))
      ? [calculate(record, level, record.beneficial ? 'healing' : 'damage')] : []
  }
}
