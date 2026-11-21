import { upgradeStatClass, type ItemUpgradeState } from '../../../../shared/itemUpgrade'
import type { GearRow, GearStatKey } from '../../../../shared/planner/gear'

export type GearStatEvidence = 'verified' | 'estimated' | 'wiki'

export const GEAR_STAT_EVIDENCE_LABELS: Record<GearStatEvidence, string> = {
  verified: 'Ruby verified',
  estimated: 'Estimated at this tier',
  wiki: 'Wiki value, not cross-checked'
}

export function gearStatEvidence(row: GearRow, key: GearStatKey, state: ItemUpgradeState): GearStatEvidence {
  const rule = upgradeStatClass(key)
  if (state.full > 0 && rule !== 'unchanged' && rule !== 'delay') return 'estimated'
  return row.verifiedBaseStats?.includes(key) ? 'verified' : 'wiki'
}
