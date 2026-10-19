import type { SpellCalculation, SpellSearchQuery, SpellSearchResult, SpellSummary } from './spellLibrary'

export const SPELL_ANALYSIS_MODEL_VERSION = '3'
export type SpellTargetCount = number | 'maximum'
export interface SpellAnalysisOptions { scope: 'single' | 'pack'; targets: SpellTargetCount }
export const DEFAULT_SPELL_ANALYSIS: SpellAnalysisOptions = { scope: 'single', targets: 4 }
export type SpellRankingCategory = 'dd' | 'dot' | 'aoe' | 'heal' | 'hot'
export type SpellAnalysisSort = 'id' | 'name' | 'level' | 'amount' | 'mana' | 'efficiency' | 'rate' | 'cast' | 'recovery' | 'recast' | 'duration' | 'ticks' | 'waves' | 'targets' | 'hits'
export interface SpellEffectContribution {
  slot: number; spa: number; clientAmount: number | null; afterRank: number | null; afterFocus: number | null
  afterInstrument?: number | null
  periodic: boolean; ticks: number | null; hits: number | null; total: number | null
}
export interface SpellAnalysisTiming {
  castMs: number; recoveryMs: number; recastMs: number; deliveryMs: number | null; cycleMs: number | null; rate: number | null; reason: string | null
}
export interface SpellAnalysis {
  modelVersion: string; level: number; contextRevision: string | null; scenario: SpellAnalysisOptions
  scope: 'one-target full cast' | 'aggregate pack total'; requestedTargets: SpellTargetCount
  effectiveTargets: number | null; waves: number | null; hits: number | null; hitCap: number | null; capSource: string
  singleTargetTotal: number | null; packTotal: number | null; partial: boolean; warnings: string[]
  timing: SpellAnalysisTiming; contributions: SpellEffectContribution[]
}
export interface SpellRankingRow extends SpellSummary { calculation: SpellCalculation }
export interface SpellRankingsQuery extends Omit<SpellSearchQuery, 'type' | 'sortBy'> {
  level: number; categoryTab: SpellRankingCategory; sortBy?: SpellAnalysisSort
  group?: 'ranked' | 'zero-mana' | 'excluded'; analysis: SpellAnalysisOptions
}
export interface SpellRankingsResult extends Omit<SpellSearchResult, 'records'> {
  records: SpellRankingRow[]; counts: Record<SpellRankingCategory, number>
  groupCounts: { ranked: number; zeroMana: number; excluded: number }
  highlights: { kind: 'efficiency' | 'amount' | 'rate'; record: SpellRankingRow | null }[]
  contextRevision: string | null; modelVersion: string; level: number
}
export interface SpellByLevelQuery extends SpellSearchQuery { level: number; throughLevel?: number; view: 'at' | 'upcoming' }
export interface SpellByLevelResult extends SpellSearchResult { level: number; throughLevel: number; contextRevision: string | null }
export interface SpellLibraryFocus {
  tab: 'browse' | 'rankings' | 'compare' | 'by-level'; level?: number; category?: SpellRankingCategory
  classes?: import('./spellLibrary').SpellClass[]; analysis?: SpellAnalysisOptions; id?: number
}
