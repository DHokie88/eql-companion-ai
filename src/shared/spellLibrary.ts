import type { SpellEvaluationOptions, SpellFocusOptions, SpellModifierApplied, SpellModifierContext, SpellModifierUpdate, SpellRankEvidence } from './spellModifiers'
import type { SpellAnalysis, SpellAnalysisOptions, SpellByLevelQuery, SpellByLevelResult, SpellRankingsQuery, SpellRankingsResult, SpellRankingRow } from './spellAnalysis'
/** Local client catalog contract. Source bytes and filesystem paths never cross this bridge. */
export const SPELL_SOURCE_FILES = ['spells_us.txt', 'spells_us_str.txt', 'dbstr_us.txt'] as const
export type SpellSourceFile = (typeof SPELL_SOURCE_FILES)[number]
export const CLIENT_SPELL_PARSER_VERSION = '1'
export const SPELL_CLASSES = ['WAR', 'CLR', 'PAL', 'RNG', 'SHD', 'DRU', 'MNK', 'BRD', 'ROG', 'SHM', 'NEC', 'WIZ', 'MAG', 'ENC', 'BST', 'BER'] as const
export type SpellClass = (typeof SPELL_CLASSES)[number]
export interface ClientSpellEffect { slot: number; spa: number; base: number; limit: number; calc: number; max: number }
export interface ClientSpellClass { code: SpellClass; level: number }
export interface ClientSpellRecord {
  id: number
  name: string
  rank: string | null
  layout: 173 | 174
  rawFields: string[]
  fields: Record<string, string | number | boolean | null>
  classes: ClientSpellClass[]
  effects: ClientSpellEffect[]
  messages: Record<string, string>
  description: string
  rawDescription: string
  category: string
  subcategory: string
  mana: number
  beneficial: boolean
  target: number
  range: number
  aeRange: number
  castMs: number
  recoveryMs: number
  recastMs: number
  durationFormula: number
  durationCap: number
  aoeDurationMs: number
}
export interface SpellDataset {
  installId: string
  snapshotId: string
  contentId: string
  parserVersion: string
  firstObserved: string
  recordCount: number
  hashes: Record<SpellSourceFile, string>
}
export type SpellCheckReason = 'startup' | 'game-launch' | 'installation-change' | 'manual'
export interface SpellLibraryStatus {
  phase: 'idle' | 'checking' | 'importing' | 'activating' | 'ready' | 'error'
  dataset: SpellDataset | null
  installation: string | null
  checkedAt: string | null
  message: string
  error: string | null
  storageBytes: number
}
export interface SpellQueryContext { snapshotId?: string }
export const SPELL_BROWSE_SORTS = ['id', 'name', 'level', 'classes', 'category', 'subcategory', 'type', 'description', 'amount', 'mana', 'efficiency', 'selected', 'rate', 'cast', 'recovery', 'recast', 'duration', 'ticks', 'waves', 'targets', 'hits'] as const
export type SpellBrowseSort = typeof SPELL_BROWSE_SORTS[number]
export type SpellSortDirection = 'asc' | 'desc'
export type SpellBrowseType = 'dd' | 'dot' | 'aoe' | 'rain' | `aoe${number}` | 'heal' | 'hot' | 'other'
export interface SpellSearchQuery extends SpellQueryContext {
  bestInLine?: boolean
  /** HP families, separate from the metric used to evaluate and order results. */
  hpFilter?: SpellMetric
  group?: 'all' | 'ranked' | 'zero-mana' | 'excluded'
  metric?: SpellMetric
  includeHighlights?: boolean
  analysis?: SpellAnalysisOptions
  minLevel?: number
  maxLevel?: number
  allLevels?: boolean
  subcategory?: string
  type?: SpellBrowseType
  polarity?: 'beneficial' | 'detrimental'
  mana?: 'free' | 'cost'
  sortBy?: SpellBrowseSort
  direction?: SpellSortDirection
  selectedIds?: number[]
  evaluation?: SpellEvaluationOptions
  text?: string
  classes?: SpellClass[]
  level?: number
  category?: string
  effect?: number
  allSpells?: boolean
  page?: number
  pageSize?: number
}
export type SpellSummary = Pick<ClientSpellRecord, 'id' | 'name' | 'rank' | 'classes' | 'mana' | 'category' | 'subcategory' | 'beneficial' | 'target'> & { calculations?: SpellCalculation[]; learnedLevel?: number | null; spellType?: SpellBrowseType; typeLabel?: string; castMs?: number; recoveryMs?: number; recastMs?: number; description?: string; detectedRank?: number | null; rankEvidence?: SpellRankEvidence | null; line?: { key: string; reason: string; alternatives: SpellSummary[] } }
export interface SpellSearchResult {
  dataset: SpellDataset | null
  total: number
  page: number
  pageSize: number
  records: SpellSummary[]
  categories: string[]
  /** Categories across every matching record, before pagination. */
  matchingCategories?: string[]
  matchingTypes?: string[]
  /** Uncollapsed count, so a line never makes matching spells disappear from the count. */
  matchingRecords?: number
  subcategories: string[]
  typeOptions?: { value: SpellBrowseType; label: string }[]
  groupCounts?: { ranked: number; zeroMana: number; excluded: number }
  highlights?: { kind: 'efficiency' | 'amount' | 'rate'; record: SpellRankingRow | null }[]
}
export interface SpellDetailQuery extends SpellQueryContext { id: number; level?: number; evaluation?: SpellEvaluationOptions; analysis?: SpellAnalysisOptions }
export interface SpellDetailResult { dataset: SpellDataset | null; record: ClientSpellRecord | null; calculations?: SpellCalculation[]; presentation?: import('./clientSpellDescriptions').SpellPresentation; rankEvidence?: SpellRankEvidence | null }
export type SpellMetric = 'damage' | 'healing'
export interface SpellCalculation {
  analysis?: SpellAnalysis
  modifiers?: SpellModifierApplied
  id: number
  name: string
  metric: SpellMetric
  mana: number
  target: number
  instant: number | null
  perTick: number | null
  ticks: number | null
  total: number | null
  perMana: number | null
  reasons: string[]
  restrictions: string[]
}
export interface SpellComparisonQuery extends SpellQueryContext { ids: number[]; level: number; metric: SpellMetric; evaluation?: SpellEvaluationOptions; analysis?: SpellAnalysisOptions }
export interface SpellComparisonResult { dataset: SpellDataset | null; level: number; scope: string; results: SpellCalculation[]; rankEvidence?: Record<string, SpellRankEvidence | null> }
export interface SpellRankingQuery extends SpellQueryContext {
  evaluation?: SpellEvaluationOptions
  classes?: SpellClass[]
  level: number
  metric: SpellMetric
  ranking: 'amount' | 'efficiency'
  limit?: number
}
export interface SpellRankingResult extends SpellComparisonResult {
  scanned: number
  eligible: number
  direct: SpellCalculation[]
  periodic: SpellCalculation[]
  zeroMana: SpellCalculation[]
  excluded: SpellCalculation[]
  excludedCount: number
}
export interface SpellChangeCounts { added: number; changed: number; removed: number; interpreted: number; rawOnly: number }
export interface SpellObservation {
  id: number
  observedAt: string
  reason: SpellCheckReason
  outcome: 'baseline' | 'changed' | 'unchanged' | 'rollback' | 'parser-upgrade' | 'error'
  snapshotId: string | null
  previousSnapshotId: string | null
  message: string
  counts: SpellChangeCounts
}
export interface SpellHistoryResult {
  dataset: SpellDataset | null
  snapshots: SpellDataset[]
  observations: SpellObservation[]
  totalObservations: number
  storageBytes: number
}
export interface SpellHistoryQuery { page?: number; pageSize?: number }
export type SpellChangeKind = 'added' | 'removed' | 'interpreted' | 'raw-only' | 'format' | 'parser-upgrade'
export interface SpellFieldDifference { field: string; before: unknown; after: unknown; kind: SpellChangeKind }
export interface SpellChangeSummary { id: number; name: string; kind: SpellChangeKind; fields: number }
export interface SpellChangesQuery { beforeSnapshotId: string; afterSnapshotId: string; page?: number; pageSize?: number; id?: number }
export interface SpellChangesResult {
  dataset: SpellDataset | null
  before: SpellDataset | null
  after: SpellDataset | null
  total: number
  changes: SpellChangeSummary[]
}
export interface SpellBeforeAfterQuery { id: number; beforeSnapshotId: string; afterSnapshotId: string }
export interface SpellBeforeAfterResult {
  dataset: SpellDataset | null
  before: ClientSpellRecord | null
  after: ClientSpellRecord | null
  differences: SpellFieldDifference[]
}
export interface SpellTimelineQuery { id: number }
export interface SpellTimelineResult { dataset: SpellDataset | null; entries: { observation: SpellObservation; record: SpellSummary | null }[] }
export interface SpellLibraryBridge {
  rankings(query: SpellRankingsQuery): Promise<SpellRankingsResult>
  byLevel(query: SpellByLevelQuery): Promise<SpellByLevelResult>
  modifierContext(): Promise<SpellModifierContext>
  updateModifiers(update: SpellModifierUpdate): Promise<SpellModifierContext>
  focusOptions(query: { text?: string; page?: number }): Promise<SpellFocusOptions>
  onModifiersChanged(callback: (revision: string) => void): () => void
  status(): Promise<SpellLibraryStatus>
  check(): Promise<SpellLibraryStatus>
  search(query: SpellSearchQuery): Promise<SpellSearchResult>
  detail(query: SpellDetailQuery): Promise<SpellDetailResult>
  compare(query: SpellComparisonQuery): Promise<SpellComparisonResult>
  rank(query: SpellRankingQuery): Promise<SpellRankingResult>
  history(query?: SpellHistoryQuery): Promise<SpellHistoryResult>
  changes(query: SpellChangesQuery): Promise<SpellChangesResult>
  beforeAfter(query: SpellBeforeAfterQuery): Promise<SpellBeforeAfterResult>
  timeline(query: SpellTimelineQuery): Promise<SpellTimelineResult>
  onStatus(callback: (status: SpellLibraryStatus) => void): () => void
}
