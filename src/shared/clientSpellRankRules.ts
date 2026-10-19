import type { ClientSpellEffect, ClientSpellRecord, SpellCalculation, SpellMetric } from './spellLibrary'
import { scaleExactSpellDamage, scaleExactSpellHeal } from './spellScale'
import { calculateClientSpell } from './clientSpellCalculations'

// Community-observed server model, not additional client rank records.
// Source: Amerzel/eql-info, commit 71960ca, docs/static/js/upgrades.js.
// Direct damage +6%/rank; periodic damage +3%/rank; DoT duration +5%/rank.
// Rank I is explicit here. Never infer an exact server implementation from this model.
export function rankedHpAmount(record: ClientSpellRecord, effect: ClientSpellEffect, amount: number, { metric, rank }: { metric: SpellMetric; rank: number | null }): number {
  if (metric === 'healing') return scaleExactSpellHeal(amount, rank)
  if (effect.spa === 0 && record.durationFormula > 0) return scaleExactSpellHeal(amount, rank)
  return scaleExactSpellDamage(amount, rank)
}
export function rankDotDuration(calculation: SpellCalculation, rank: number | null): SpellCalculation {
  if (calculation.metric !== 'damage' || !rank || calculation.total === null || calculation.ticks === null || !calculation.perTick) return calculation
  const durationTicks = Math.round((calculation.durationTicks ?? calculation.ticks) * (100 + 5 * rank) / 100)
  const ticks = durationTicks + (calculation.durationTicks === undefined ? 0 : 1)
  const total = (calculation.instant ?? 0) + calculation.perTick * ticks
  return { ...calculation, durationTicks, ticks, total, perMana: calculation.mana > 0 ? total / calculation.mana : null }
}

export function rankHpMana(calculation: SpellCalculation, rank: number | null): SpellCalculation {
  if (!rank || calculation.total === null) return calculation
  const mana = Math.round(calculation.mana * (100 - 2 * rank) / 100)
  return { ...calculation, mana, perMana: mana > 0 ? calculation.total / mana : null }
}

/** Category model from the pinned reference above. Preserve instant/zero reuse. */
export function rankHpTiming(record: ClientSpellRecord, metric: SpellMetric, rank: number | null): Pick<ClientSpellRecord, 'castMs' | 'recoveryMs' | 'recastMs'> {
  const base = { castMs: record.castMs, recoveryMs: record.recoveryMs, recastMs: record.recastMs }
  if (!rank || Object.values(base).some((value) => !Number.isFinite(value) || value < 0)) return base
  const castPct = metric === 'healing' || record.durationFormula > 0 ? 4 : 2
  return {
    castMs: Math.round(record.castMs * (100 - castPct * rank) / 100),
    recoveryMs: Math.max(0, Math.ceil((record.recoveryMs * (100 - 2 * rank) - 5000) / 10000) * 100),
    recastMs: record.recastMs === 0 ? 0 : Math.max(1000, Math.floor(record.recastMs * (100 - 2 * rank) / 100000) * 1000)
  }
}

/** One-target rank-only ladder at the requested caster level; no gear or focus. */
export function spellRankProgression(record: ClientSpellRecord, level: number, metric: SpellMetric) {
  return Array.from({ length: 11 }, (_, rank) => {
    const base = calculateClientSpell(record, level, metric, (amount, effect) => rankedHpAmount(record, effect, amount, { metric, rank }))
    const calculation = rankHpMana(rankDotDuration(base, rank), rank)
    return { rank, calculation, timing: rankHpTiming(record, metric, rank) }
  })
}
