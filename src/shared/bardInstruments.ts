import type { SpellValueMode } from './spellModifiers'

export type BardInstrumentFamily = 'singing' | 'brass' | 'string' | 'wind' | 'percussion'
/** Export-time evidence only. Bag items are alternatives, never worn bonuses. */
export interface BardInstrumentSource {
  item: string
  location: string
  equipped: boolean
  effect: string
  requiredLevel?: number
  basis: 'focus effect' | 'resonance stat'
}
export interface BardInstrumentInventory { sources: BardInstrumentSource[]; warnings: string[] }
export interface BardInstrumentChoice {
  item: string
  location: string
  effect: string
  effectId: number
  multiplier: number
  requiresEquip: boolean
}
export interface BardInstrumentEstimate {
  knownSources?: BardInstrumentSource[]
  mode: SpellValueMode
  family: BardInstrumentFamily
  equipped: BardInstrumentChoice | null
  bestCarried: BardInstrumentChoice | null
  equippedMultiplier: number
  bestMultiplier: number
  exportedAt: string | null
  partial: boolean
  warnings: string[]
}
export interface BardSongEffectEstimate {
  slot: number
  label: string
  impact: 'scales' | 'unchanged' | 'unsupported'
  explanation: string
  client: string
  equipped: string | null
  bestCarried: string | null
}
export interface BardSongPresentation { inputs: BardInstrumentEstimate; effects: BardSongEffectEstimate[] }
