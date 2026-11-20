import { clientSpellType } from './clientSpellBrowse'
import type { ClientSpellRecord, SpellMetric } from './spellLibrary'

export const SPELL_COMPARE_METRICS = ['damage', 'healing', 'buffs', 'debuffs', 'utility'] as const
export type SpellCompareMetric = typeof SPELL_COMPARE_METRICS[number]
export type SpellCompareMetricChoice = SpellCompareMetric | 'auto'

export const SPELL_COMPARE_LABELS: Record<SpellCompareMetric, string> = {
  damage: 'Damage', healing: 'Healing', buffs: 'Buffs', debuffs: 'Debuffs', utility: 'Utility'
}

export function hitPointMetric(metric: SpellCompareMetric): SpellMetric | null {
  return metric === 'damage' || metric === 'healing' ? metric : null
}

function recordMetric(record: ClientSpellRecord): SpellCompareMetric {
  const kind = clientSpellType(record)
  if (kind === 'heal' || kind === 'hot') return 'healing'
  if (kind !== 'other') return 'damage'
  if (!record.beneficial) return 'debuffs'
  return record.durationFormula !== 0 || record.durationCap > 0 ? 'buffs' : 'utility'
}

/** Use the most common kind, breaking ties by the order the spells were added. */
export function guessSpellCompareMetric(records: readonly ClientSpellRecord[]): SpellCompareMetric {
  const kinds = records.map(recordMetric)
  const counts = new Map<SpellCompareMetric, number>()
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1)
  let best: SpellCompareMetric = kinds[0] ?? 'damage'
  for (const kind of counts.keys()) {
    if ((counts.get(kind) ?? 0) > (counts.get(best) ?? 0)) best = kind
  }
  return best
}
