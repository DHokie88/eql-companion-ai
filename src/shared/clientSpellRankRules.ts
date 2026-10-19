import type { ClientSpellEffect, ClientSpellRecord, SpellCalculation, SpellMetric } from './spellLibrary'
import { scaleExactSpellDamage, scaleExactSpellHeal } from './spellScale'

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
  const ticks = Math.round(calculation.ticks * (100 + 5 * rank) / 100)
  const total = (calculation.instant ?? 0) + calculation.perTick * ticks
  return { ...calculation, ticks, total, perMana: calculation.mana > 0 ? total / calculation.mana : null }
}
