import { clientSpellEffectAmount, clientSpellDurationTicks } from './clientSpellCalculations'
import { clientSpellEffectLabel } from './clientSpellParser'
import { rankedHpAmount } from './clientSpellRankRules'
import type { ClientSpellEffect, ClientSpellRecord, SpellMetric } from './spellLibrary'

export type SpellEffectTiming = 'instant' | 'per-tick' | 'raw'
export interface SpellBrowseEffectSlot {
  /** Client slot number, in the record's original order. */
  slot: number
  spa: number
  name: string
  timing: SpellEffectTiming
  /** Ranked HP amount, or the client amount. Null when the formula is unsupported. */
  amount: number | null
  raw: { base: number; limit: number; calc: number; max: number }
  formula: string | null
  ticks: number | null
}

/** Compact cell text. Raw slots stay labeled raw; per-tick slots say so. */
export function spellBrowseEffectText(slot: SpellBrowseEffectSlot): string {
  const head = `SPA ${slot.spa} · ${slot.name}`
  if (slot.amount === null || slot.timing === 'raw') return `${head}: raw ${slot.raw.base}`
  const magnitude = Math.abs(slot.amount).toLocaleString()
  const signed = slot.amount > 0 ? `+${magnitude}` : slot.amount < 0 ? `−${magnitude}` : magnitude
  return slot.timing === 'per-tick' ? `${head}: ${signed}/tick` : `${head}: ${signed}`
}

const PERIODIC = new Set([0, 15, 100, 189])

function slotTiming(record: ClientSpellRecord, effect: ClientSpellEffect, supported: boolean): SpellEffectTiming {
  if (!supported) return 'raw'
  return record.durationFormula !== 0 && PERIODIC.has(effect.spa) ? 'per-tick' : 'instant'
}

/** Every captured slot, in order. Rank scaling uses the shared HP rules; other formulas stay raw. */
export function spellBrowseEffectSlots(record: ClientSpellRecord, level: number, rank: number | null): SpellBrowseEffectSlot[] {
  const ticks = clientSpellDurationTicks(record, level)
  const metric: SpellMetric = record.beneficial ? 'healing' : 'damage'
  return record.effects.map((effect) => {
    const clientAmount = clientSpellEffectAmount(effect, level)
    const supported = clientAmount !== null
    const timing = slotTiming(record, effect, supported)
    const amount = supported && rank !== null && (effect.spa === 0 || effect.spa === 79)
      ? rankedHpAmount(record, effect, clientAmount, { metric, rank })
      : clientAmount
    const formula = !supported
      ? `Unsupported effect formula: ${effect.calc}.`
      : timing === 'per-tick' && ticks === null
        ? `Unsupported or untimed duration formula: ${record.durationFormula}.`
        : null
    return {
      slot: effect.slot, spa: effect.spa, name: clientSpellEffectLabel(effect.spa), timing, amount,
      raw: { base: effect.base, limit: effect.limit, calc: effect.calc, max: effect.max },
      formula, ticks: timing === 'per-tick' ? ticks : null
    }
  })
}
