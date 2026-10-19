import type { SpellCalculation, SpellClass } from './spellLibrary'

export const SPELL_MODIFIER_MODEL_VERSION = '2'
export type SpellValueMode = 'client' | 'mine' | 'emulate'
export interface SpellEmulation {
  rank: number | null
  ranks: Record<string, { rank: number; name: string }>
  focus: 'detected' | 'none' | 'selected'
  focusIds: number[]
}
export interface SpellModifierPreferences { mode: SpellValueMode; emulation: SpellEmulation; targets?: import('./spellAnalysis').SpellTargetCount }
export function defaultSpellModifierPreferences(): SpellModifierPreferences {
  return { mode: 'client', emulation: { rank: null, ranks: {}, focus: 'detected', focusIds: [] } }
}
export interface SpellFocusCandidate { effect: string; item: string }
export interface SpellModifierContext {
  revision: string
  modelVersion: string
  character: { key: string; name: string; server: string } | null
  preferences: SpellModifierPreferences
  ranks: Record<string, { name: string; rank: number }> | null
  inventory: { state: 'missing' | 'ready' | 'error'; exportedAt: string | null; candidates: SpellFocusCandidate[]; warnings: string[]; instruments?: import('./bardInstruments').BardInstrumentInventory }
  warnings: string[]
}
export interface SpellEvaluationOptions { mode: SpellValueMode; contextRevision: string; classes?: SpellClass[] }
export interface SpellModifierUpdate { expectedRevision: string; preferences: SpellModifierPreferences }
export interface SpellFocusOption { id: number; name: string; kind: 'damage' | 'healing' | null; supported: boolean; reason: string | null }
export interface SpellFocusOptions { datasetId: string | null; total: number; records: SpellFocusOption[] }
export interface SpellModifierApplied {
  instrument?: import('./bardInstruments').BardInstrumentEstimate
  equippedInstrument?: Pick<SpellCalculation, 'instant' | 'perTick' | 'ticks' | 'total' | 'perMana'>
  mode: SpellValueMode
  modelVersion: string
  contextRevision: string
  baseline: Pick<SpellCalculation, 'instant' | 'perTick' | 'ticks' | 'total' | 'perMana'>
  rank: number | null
  rankSource: 'detected' | 'simulated' | 'unknown'
  focus: { id: number; name: string; item: string; minPct: number; maxPct: number; pct: number } | null
  range: { min: number; max: number } | null
  partial: boolean
  simulated: boolean
  warnings: string[]
}
