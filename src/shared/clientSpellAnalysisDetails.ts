import { clientSpellEffectAmount } from './clientSpellCalculations'
import { scaleSpellDamage, scaleSpellHeal } from './spellScale'
import type { ClientSpellEffect, ClientSpellRecord, SpellCalculation } from './spellLibrary'
import type { SpellAnalysisTiming, SpellEffectContribution } from './spellAnalysis'
import type { ClientSpellMechanics } from './clientSpellMechanics'
import { bardInstrumentAmount } from './bardSongRules'

const multiply = (value: number | null, factor: number | null): number | null => value === null || factor === null ? null : value * factor
const efficiency = (total: number | null, mana: number): number | null => total !== null && mana > 0 ? Math.round(total / mana * 1_000_000) / 1_000_000 : null

/** Scale HP amounts and their matching baseline/range as one scope change. */
export function scaleAnalysisCalculation(calculation: SpellCalculation, factor: number | null): SpellCalculation {
  const total = multiply(calculation.total, factor)
  const scaled = {
    ...calculation, instant: multiply(calculation.instant, factor), perTick: multiply(calculation.perTick, factor),
    total, perMana: efficiency(total, calculation.mana)
  }
  if (!calculation.modifiers) return scaled
  const baseline = calculation.modifiers.baseline
  const baselineTotal = multiply(baseline.total, factor)
  const range = calculation.modifiers.range
  return {
    ...scaled, modifiers: {
      ...calculation.modifiers,
      baseline: { ...baseline, instant: multiply(baseline.instant, factor), perTick: multiply(baseline.perTick, factor), total: baselineTotal, perMana: efficiency(baselineTotal, calculation.mana) },
      equippedInstrument: scaleEquippedInstrument(calculation, factor),
      range: range && factor !== null ? { min: range.min * factor, max: range.max * factor } : null
    }
  }
}
function scaleEquippedInstrument(calculation: SpellCalculation, factor: number | null) {
  const equipped = calculation.modifiers?.equippedInstrument
  if (!equipped) return undefined
  const total = multiply(equipped.total, factor)
  return { ...equipped, instant: multiply(equipped.instant, factor), perTick: multiply(equipped.perTick, factor), total, perMana: efficiency(total, calculation.mana) }
}

export function analysisTiming(record: ClientSpellRecord, calculation: SpellCalculation, mechanics: ClientSpellMechanics): SpellAnalysisTiming {
  const { castMs, recoveryMs, recastMs } = record
  const base = { castMs, recoveryMs, recastMs, deliveryMs: null, cycleMs: null, rate: null }
  if ([castMs, recoveryMs, recastMs, record.aoeDurationMs].some((value) => !Number.isFinite(value) || value < 0)) {
    return { ...base, reason: 'Negative or unknown client timing is not modeled.' }
  }
  if (mechanics.reason || calculation.total === null) return { ...base, reason: 'Timing requires a supported complete HP calculation.' }
  const periodicMs = (calculation.perTick ?? 0) > 0 ? (calculation.ticks ?? 0) * 6000 : 0
  const deliveryMs = Math.max(periodicMs, mechanics.deliveryMs)
  const cycleMs = castMs + Math.max(recoveryMs, recastMs, deliveryMs)
  if (cycleMs <= 0) return { ...base, deliveryMs, cycleMs, reason: 'The client timing denominator is zero; no modeled rate is available.' }
  return { castMs, recoveryMs, recastMs, deliveryMs, cycleMs, rate: calculation.total / (cycleMs / 1000), reason: null }
}

function contributionAmounts(effect: ClientSpellEffect, calculation: SpellCalculation, input: { record: ClientSpellRecord; level: number }): Pick<SpellEffectContribution, 'clientAmount' | 'afterRank' | 'afterInstrument' | 'afterFocus'> {
  const empty = { clientAmount: null, afterRank: null, afterFocus: null }
  if (effect.spa !== 0 && effect.spa !== 79) return empty
  const clientAmount = clientSpellEffectAmount(effect, input.level)
  if (clientAmount === null) return empty
  const scale = calculation.metric === 'damage' ? scaleSpellDamage : scaleSpellHeal
  const afterRank = scale(clientAmount, calculation.modifiers?.rank ?? null)
  const instrument = calculation.modifiers?.instrument
  const afterInstrument = instrument ? bardInstrumentAmount(afterRank, effect, { record: input.record, multiplier: instrument.bestMultiplier }) : afterRank
  const afterFocus = afterInstrument * (1 + focusPercent(calculation) / 100)
  return { clientAmount, afterRank, ...(instrument ? { afterInstrument } : {}), afterFocus }
}
function focusPercent(calculation: SpellCalculation): number { return calculation.modifiers?.focus?.pct ?? 0 }

function contribution(effect: ClientSpellEffect, calculation: SpellCalculation, options: { record: ClientSpellRecord; level: number; hits: number | null }): SpellEffectContribution {
  const amounts = contributionAmounts(effect, calculation, options)
  const periodic = effect.spa === 100 || (effect.spa === 0 && options.record.durationFormula !== 0)
  const ticks = periodic ? calculation.ticks : null
  const total = calculation.total === null ? null : multiply(multiply(amounts.afterFocus, periodic ? ticks : 1), options.hits)
  return { slot: effect.slot, spa: effect.spa, ...amounts, periodic, ticks, hits: options.hits, total }
}

export function analysisContributions(record: ClientSpellRecord, calculation: SpellCalculation, options: { level: number; hits: number | null }): SpellEffectContribution[] {
  const sign = calculation.metric === 'damage' ? -1 : 1
  return record.effects.filter((effect) => [0, 79, 100, 101, 334].includes(effect.spa) && effect.base * sign > 0)
    .map((effect) => contribution(effect, calculation, { record, ...options }))
}
