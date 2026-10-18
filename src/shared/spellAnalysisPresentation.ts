import type { SpellCalculation } from './spellLibrary'

export interface SpellDifference { absolute: number | null; percent: number | null }
export function spellDifference(value: number | null, reference: number | null): SpellDifference {
  if (value === null || reference === null) return { absolute: null, percent: null }
  return { absolute: value - reference, percent: reference === 0 ? null : (value - reference) / Math.abs(reference) * 100 }
}
export function spellComparisonDifferences(row: SpellCalculation, reference?: SpellCalculation) {
  return {
    amount: spellDifference(row.total, reference?.total ?? null),
    efficiency: spellDifference(row.perMana, reference?.perMana ?? null),
    rate: spellDifference(row.analysis?.timing.rate ?? null, reference?.analysis?.timing.rate ?? null),
    mana: spellDifference(row.mana, reference?.mana ?? null)
  }
}
