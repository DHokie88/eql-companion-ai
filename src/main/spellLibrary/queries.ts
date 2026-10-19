import type {
  ClientSpellRecord, SpellBeforeAfterResult, SpellChangesResult, SpellComparisonResult,
  SpellDataset, SpellHistoryResult, SpellRankingResult, SpellSearchResult, SpellSummary,
  SpellTimelineResult, SpellCalculation, SpellMetric
} from '../../shared/spellLibrary'
import { WorkerSpellEvaluation, spellEvaluationScope, type SpellCalculator } from './workerEvaluation'
import { searchCatalog } from './searchCatalog'
import { SEARCH_QUERY_FIELDS } from './browseQuery'
import { SpellAnalysisQueries } from './analysisQueries'
import { SpellQueryCache } from './queryCache'
import { changeKind, spellDifferences } from './differences'
import { SpellLibraryStorage } from './storage'
import { integerArg, objectArgs, stringArg } from './workerProtocol'
import { classesArg, levelArg, metricArg, optionalText, pageArgs, queryObject, requiredSnapshotArg, snapshotArg, spellId } from './queryValidation'
import type { SpellModifierContext } from '../../shared/spellModifiers'
import type { SpellByLevelResult, SpellRankingsResult } from '../../shared/spellAnalysis'

/** Cached arithmetic survives identical exports; displayed evidence still follows the latest export. */
function refreshInstrumentProvenance<T extends SpellSearchResult>(result: T, context?: SpellModifierContext): T {
  if (!context) return result
  const highlights = result.highlights?.flatMap((entry) => entry.record ? [entry.record] : []) ?? []
  for (const row of [...result.records, ...highlights]) {
    const calculations = [...row.calculations ?? [], ...('calculation' in row ? [row.calculation as SpellCalculation] : [])]
    for (const calculation of calculations) {
      const instrument = calculation.modifiers?.instrument
      if (instrument) instrument.exportedAt = context.inventory.exportedAt
    }
  }
  return result
}

export function spellSummary(record: ClientSpellRecord): SpellSummary {
  const { id, name, rank, classes, mana, category, subcategory, beneficial, target } = record
  return { id, name, rank, classes, mana, category, subcategory, beneficial, target }
}
function available(record: ClientSpellRecord, classes: ReturnType<typeof classesArg>, level?: number): boolean {
  if (!classes?.length && level === undefined) return true
  return record.classes.some((entry) => (!classes?.length || classes.includes(entry.code)) && (level === undefined || entry.level <= level))
}
function hpCalculations(record: ClientSpellRecord, level: number, calculate: SpellCalculator): SpellCalculation[] {
  if (!record.effects.some((e) => [0, 79, 100, 101, 334].includes(e.spa))) return []
  return [calculate(record, level, record.beneficial ? 'healing' : 'damage')]
}
function amount(calculation: SpellCalculation, ranking: 'amount' | 'efficiency'): number {
  return (ranking === 'efficiency' ? calculation.perMana : calculation.total) ?? -Infinity
}
function ranked(values: SpellCalculation[], ranking: 'amount' | 'efficiency', limit: number): SpellCalculation[] {
  return values.sort((a, b) => amount(b, ranking) - amount(a, ranking) || a.id - b.id).slice(0, limit)
}
interface RankedGroups {
  direct: SpellCalculation[]; periodic: SpellCalculation[]; zeroMana: SpellCalculation[]; excluded: SpellCalculation[]
  eligible: number; excludedCount: number
}
function collectRank(record: ClientSpellRecord, options: { level: number; metric: SpellMetric; limit: number }, groups: RankedGroups, calculate: SpellCalculator): void {
  const calculation = calculate(record, options.level, options.metric)
  if (calculation.total === null || calculation.total <= 0) {
    groups.excludedCount++
    if (groups.excluded.length < options.limit) groups.excluded.push(calculation)
    return
  }
  groups.eligible++
  if (calculation.mana === 0) { groups.zeroMana.push(calculation); return }
  if (calculation.perTick !== null && calculation.perTick > 0) groups.periodic.push(calculation)
  else groups.direct.push(calculation)
}

/** A request pins one read transaction. Even a concurrent publication cannot mix snapshots. */
export class SpellLibraryQueries {
  private evaluation: WorkerSpellEvaluation
  private analysis: SpellAnalysisQueries
  private cache = new SpellQueryCache()
  constructor(readonly storage: SpellLibraryStorage) {
    this.evaluation = new WorkerSpellEvaluation(storage)
    this.analysis = new SpellAnalysisQueries(storage, this.evaluation)
  }
  handle(method: string, input: unknown): unknown {
    const args = objectArgs(input)
    const installId = stringArg(args.installId, 'installId')
    if (!/^i-[a-f0-9]{64}$/.test(installId)) throw new Error('Invalid installId')
    return this.storage.readConsistent(() => this.dispatch(method, installId, args))
  }
  private dispatch(method: string, installId: string, args: Record<string, unknown>): unknown {
    const query = args.query
    const handlers: Record<string, () => unknown> = {
      active: () => this.storage.active(installId), status: () => this.storage.status(installId),
      search: () => this.search(installId, query, args.modifiers), detail: () => this.detail(installId, query, args.modifiers),
      compare: () => this.compare(installId, query, args.modifiers), rank: () => this.rank(installId, query, args.modifiers),
      rankings: () => this.analysisQuery('rankings', installId, args), byLevel: () => this.analysisQuery('byLevel', installId, args),
      focusOptions: () => this.focusOptions(installId, query), history: () => this.history(installId, query),
      changes: () => this.changes(installId, query), beforeAfter: () => this.beforeAfter(installId, query), timeline: () => this.timeline(installId, query)
    }
    if (!Object.hasOwn(handlers, method)) throw new Error('Unknown spell query method')
    return handlers[method]()
  }
  private analysisQuery(method: 'rankings' | 'byLevel', installId: string, args: Record<string, unknown>): unknown {
    const query = queryObject(args.query, [...SEARCH_QUERY_FIELDS, 'categoryTab', 'group', 'view', 'throughLevel'])
    const dataset = this.dataset(installId, query)
    this.evaluation.calculator(dataset, query, args.modifiers)
    const context = args.modifiers as SpellModifierContext | undefined
    // Inventory export time is UI provenance, not an effective calculation input.
    const effectiveContext = context ? { ...context, inventory: { ...context.inventory, exportedAt: undefined } } : undefined
    const key = this.cache.key(method, { installId, dataset, query, context: effectiveContext })
    const cached = this.cache.get(key)
    if (cached !== undefined) return refreshInstrumentProvenance(cached as SpellRankingsResult | SpellByLevelResult, context)
    const result = this.analysis[method](dataset, query, args.modifiers)
    this.cache.set(key, result)
    return result
  }
  private dataset(installId: string, query: Record<string, unknown>): SpellDataset | null {
    const snapshot = snapshotArg(query.snapshotId)
    return snapshot ? this.storage.dataset(installId, snapshot) : this.storage.active(installId)
  }
  private search(installId: string, input: unknown, context: unknown): SpellSearchResult {
    const query = queryObject(input, SEARCH_QUERY_FIELDS)
    const dataset = this.dataset(installId, query)
    const calculate = this.evaluation.calculator(dataset, query, context)
    const result = searchCatalog(this.storage, dataset, query, { calculate, mechanics: dataset ? this.evaluation.mechanics(dataset) : undefined })
    const highlights = result.highlights?.flatMap((entry) => entry.record ? [entry.record] : []) ?? []
    if (dataset) for (const row of [...result.records.flatMap((row) => [row, ...row.line?.alternatives ?? []]), ...highlights]) {
      const record = this.storage.record(dataset.snapshotId, row.id)
      if (record) row.rankEvidence = this.evaluation.rankEvidence(dataset, record, context)
    }
    return result
  }
  private detail(installId: string, input: unknown, context: unknown) {
    const query = queryObject(input, ['snapshotId', 'id', 'level', 'evaluation', 'analysis'])
    const id = spellId(query.id)
    const dataset = this.dataset(installId, query)
    const record = dataset ? this.storage.record(dataset.snapshotId, id) : null
    const calculate = this.evaluation.calculator(dataset, query, context)
    const presentation = record && query.level !== undefined ? this.evaluation.presentation(dataset, { record, level: levelArg(query.level), query, context }) : undefined
    return { dataset, record, presentation, rankEvidence: record ? this.evaluation.rankEvidence(dataset, record, context) : null, ...((query.evaluation !== undefined || query.analysis !== undefined) && record ? { calculations: hpCalculations(record, levelArg(query.level), calculate) } : {}) }
  }
  private compare(installId: string, input: unknown, context: unknown): SpellComparisonResult {
    const query = queryObject(input, ['snapshotId', 'ids', 'level', 'metric', 'evaluation', 'analysis'])
    if (!Array.isArray(query.ids) || query.ids.length > 4) throw new Error('Compare at most four spells')
    const ids = [...new Set(query.ids.map(spellId))]
    const level = levelArg(query.level)
    const metric = metricArg(query.metric)
    const dataset = this.dataset(installId, query)
    const calculate = this.evaluation.calculator(dataset, query, context)
    const results: SpellCalculation[] = []
    const rankEvidence: NonNullable<SpellComparisonResult['rankEvidence']> = {}
    if (dataset) for (const id of ids) {
      const record = this.storage.record(dataset.snapshotId, id)
      if (record) { results.push(calculate(record, level, metric)); rankEvidence[String(id)] = this.evaluation.rankEvidence(dataset, record, context) }
    }
    return { dataset, level, scope: spellEvaluationScope(query), results, rankEvidence }
  }
  private rank(installId: string, input: unknown, context: unknown): SpellRankingResult {
    const query = queryObject(input, ['snapshotId', 'classes', 'level', 'metric', 'ranking', 'limit', 'evaluation'])
    const level = levelArg(query.level)
    const metric = metricArg(query.metric)
    const classes = classesArg(query.classes)
    const limit = integerArg(query.limit ?? 25, 'limit', 1, 200)
    if (query.ranking !== 'amount' && query.ranking !== 'efficiency') throw new Error('Invalid ranking')
    const dataset = this.dataset(installId, query)
    const calculate = this.evaluation.calculator(dataset, query, context)
    const groups: RankedGroups = { direct: [], periodic: [], zeroMana: [], excluded: [], eligible: 0, excludedCount: 0 }
    let scanned = 0
    if (dataset) for (const record of this.storage.records(dataset.snapshotId)) {
      scanned++
      if (!available(record, classes, level)) continue
      const sign = metric === 'damage' ? -1 : 1
      if (record.beneficial !== (metric === 'healing') || !record.effects.some((e) => [0, 79, 100, 101, 334].includes(e.spa) && e.base * sign > 0)) continue
      collectRank(record, { level, metric, limit }, groups, calculate)
    }
    const rankedDirect = ranked(groups.direct, query.ranking, limit), rankedPeriodic = ranked(groups.periodic, query.ranking, limit)
    return { dataset, level, scope: spellEvaluationScope(query), results: [...rankedDirect, ...rankedPeriodic],
      scanned, eligible: groups.eligible, direct: rankedDirect, periodic: rankedPeriodic,
      zeroMana: ranked(groups.zeroMana, 'amount', limit), excluded: groups.excluded, excludedCount: groups.excludedCount }
  }
  private focusOptions(installId: string, input: unknown) {
    const query = queryObject(input, ['text', 'page'])
    const text = optionalText(query.text, 'text') ?? ''
    const page = integerArg(query.page ?? 1, 'page', 1, 1000000)
    const dataset = this.storage.active(installId)
    if (!dataset) return { datasetId: null, total: 0, records: [] }
    return { datasetId: dataset.snapshotId, ...this.evaluation.catalog(dataset).focusOptions(text, page) }
  }
  private history(installId: string, input: unknown): SpellHistoryResult {
    const query = queryObject(input, ['page', 'pageSize'])
    const { page, pageSize } = pageArgs(query)
    const observations = this.storage.observations(installId, page, pageSize)
    const status = this.storage.status(installId)
    return { dataset: status.dataset, snapshots: this.storage.snapshots(installId), observations: observations.observations,
      totalObservations: observations.total, storageBytes: status.storageBytes }
  }
  private pair(installId: string, query: Record<string, unknown>): [SpellDataset, SpellDataset] {
    return [this.storage.dataset(installId, requiredSnapshotArg(query.beforeSnapshotId)),
      this.storage.dataset(installId, requiredSnapshotArg(query.afterSnapshotId))]
  }
  private changes(installId: string, input: unknown): SpellChangesResult {
    const query = queryObject(input, ['beforeSnapshotId', 'afterSnapshotId', 'page', 'pageSize', 'id'])
    const { page, pageSize } = pageArgs(query)
    const id = query.id === undefined ? undefined : spellId(query.id)
    const [before, after] = this.pair(installId, query)
    const prior = new Map(Array.from(this.storage.records(before.snapshotId), (record) => [record.id, record]))
    const changes: SpellChangesResult['changes'] = []
    let total = 0
    const add = (old: ClientSpellRecord | null, next: ClientSpellRecord | null): void => {
      const record = next ?? old
      if (!record || (id !== undefined && id !== record.id)) return
      const differences = spellDifferences(old, next, before.parserVersion !== after.parserVersion)
      if (!differences.length) return
      if (total >= (page - 1) * pageSize && changes.length < pageSize) {
        changes.push({ id: record.id, name: record.name, kind: changeKind(differences), fields: differences.length })
      }
      total++
    }
    for (const record of this.storage.records(after.snapshotId)) {
      add(prior.get(record.id) ?? null, record); prior.delete(record.id)
    }
    for (const record of prior.values()) add(record, null)
    return { dataset: this.storage.active(installId), before, after, total, changes }
  }
  private beforeAfter(installId: string, input: unknown): SpellBeforeAfterResult {
    const query = queryObject(input, ['id', 'beforeSnapshotId', 'afterSnapshotId'])
    const id = spellId(query.id)
    const [prior, next] = this.pair(installId, query)
    const before = this.storage.record(prior.snapshotId, id), after = this.storage.record(next.snapshotId, id)
    return { dataset: this.storage.active(installId), before, after,
      differences: spellDifferences(before, after, prior.parserVersion !== next.parserVersion) }
  }
  private timeline(installId: string, input: unknown): SpellTimelineResult {
    const query = queryObject(input, ['id'])
    const id = spellId(query.id)
    const entries: SpellTimelineResult['entries'] = []
    for (const observation of this.storage.allObservations(installId)) {
      const record = observation.snapshotId ? this.storage.record(observation.snapshotId, id) : null
      entries.push({ observation, record: record ? spellSummary(record) : null })
    }
    return { dataset: this.storage.active(installId), entries }
  }
}
