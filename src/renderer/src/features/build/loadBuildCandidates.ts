import { upgradeStateForTier } from '../../../../shared/itemUpgrade'
import type { PlanCandidate } from '../../../../shared/build/planSet'
import type { GearRow } from '../../../../shared/planner/gear'
import { scaleGearRow } from '../../../../shared/planner/gearScale'
import type { GearOwnershipMap } from '../gear/gearOwnership'

/** Optimal uses the same +5 tier for every item; owned uses actual copies and their tiers. */
export function loadBuildCandidates(rows: readonly GearRow[], ownership: GearOwnershipMap | null,
  mode: 'optimal' | 'owned', allowed: (row: GearRow) => boolean): PlanCandidate[] {
  const result: PlanCandidate[] = []
  for (const row of rows) {
    const facts = mode === 'optimal' ? [{ tier: 5, count: 4 }] : ownership?.get(row.key)?.facts ?? []
    for (const fact of facts) {
      const tier = Math.max(5, fact.tier ?? 0)
      const scaled = scaleGearRow(row, upgradeStateForTier(tier))
      if (fact.count > 0 && allowed(scaled)) result.push({ row: scaled, tier, count: fact.count })
    }
  }
  return result
}
