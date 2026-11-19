import { clientSpellEffectAmount, clientSpellDurationTicks } from './clientSpellCalculations'
import { clientSpellEffectLabel, clientSpellEffectValueKind } from './clientSpellParser'
import { rankDotDurationTicks, rankedHpAmount } from './clientSpellRankRules'
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

function slotFormula(input: { kind: ReturnType<typeof clientSpellEffectValueKind>; supported: boolean; timing: SpellEffectTiming; ticks: number | null; record: ClientSpellRecord; effect: ClientSpellEffect }): string | null {
  if (input.kind === 'reference') return 'Spell or item reference, not a calculated amount.'
  if (input.kind === 'flag') return 'Flag, not a calculated amount.'
  if (input.kind === 'bounds') return 'Bound, not a calculated amount.'
  if (!input.supported) return `Unsupported effect formula: ${input.effect.calc}.`
  if (input.timing === 'per-tick' && input.ticks === null) return `Unsupported or untimed duration formula: ${input.record.durationFormula}.`
  return null
}

function rankForEffect(effect: ClientSpellEffect, beneficial: boolean, rank: number | null): number | null {
  if (effect.spa !== 0 && effect.spa !== 79) return null
  return (beneficial ? effect.base > 0 : effect.base < 0) ? rank : null
}

function slotDuration(effect: ClientSpellEffect, input: { timing: SpellEffectTiming; ticks: number | null; metric: SpellMetric; rank: number | null }): number | null {
  const { timing, ticks, metric, rank } = input
  if (timing !== 'per-tick' || ticks === null) return null
  return metric === 'damage' && effect.spa === 0 && rank !== null ? rankDotDurationTicks(ticks, rank) : ticks
}

/** Every captured slot, in order. Rank scaling uses the shared HP rules; other formulas stay raw. */
export function spellBrowseEffectSlots(record: ClientSpellRecord, level: number, rank: number | null): SpellBrowseEffectSlot[] {
  const ticks = clientSpellDurationTicks(record, level)
  const metric: SpellMetric = record.beneficial ? 'healing' : 'damage'
  return record.effects.map((effect) => {
    const clientAmount = clientSpellEffectAmount(effect, level)
    const kind = clientSpellEffectValueKind(effect)
    const supported = clientAmount !== null && kind === 'amount'
    const timing = slotTiming(record, effect, supported)
    const effectRank = rankForEffect(effect, record.beneficial, rank)
    const magnitude = !supported || clientAmount === null ? null
      : effectRank === null ? clientAmount : rankedHpAmount(record, effect, clientAmount, { metric, rank: effectRank })
    const amount = magnitude === null || effect.base >= 0 ? magnitude : -magnitude
    const duration = slotDuration(effect, { timing, ticks, metric, rank: effectRank })
    return {
      slot: effect.slot, spa: effect.spa, name: clientSpellEffectLabel(effect.spa), timing, amount,
      raw: { base: effect.base, limit: effect.limit, calc: effect.calc, max: effect.max },
      formula: slotFormula({ kind, supported, timing, ticks, record, effect }), ticks: duration
    }
  })
}
