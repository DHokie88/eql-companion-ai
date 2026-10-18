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
export interface SpellSearchQuery extends SpellQueryContext {
  text?: string
  classes?: SpellClass[]
  level?: number
  category?: string
  effect?: number
  allSpells?: boolean
  page?: number
  pageSize?: number
}
export type SpellSummary = Pick<ClientSpellRecord, 'id' | 'name' | 'rank' | 'classes' | 'mana' | 'category' | 'subcategory' | 'beneficial' | 'target'>
export interface SpellSearchResult {
  dataset: SpellDataset | null
  total: number
  page: number
  pageSize: number
  records: SpellSummary[]
  categories: string[]
}
export interface SpellDetailQuery extends SpellQueryContext { id: number }
export interface SpellDetailResult { dataset: SpellDataset | null; record: ClientSpellRecord | null }
export type SpellMetric = 'damage' | 'healing'
export interface SpellCalculation {
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
export interface SpellComparisonQuery extends SpellQueryContext { ids: number[]; level: number; metric: SpellMetric }
export interface SpellComparisonResult { dataset: SpellDataset | null; level: number; scope: string; results: SpellCalculation[] }
export interface SpellRankingQuery extends SpellQueryContext {
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
export interface SpellTimelineResult { dataset: SpellDataset | null; entries: Array<{ observation: SpellObservation; record: SpellSummary | null }> }
export interface SpellLibraryBridge {
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
