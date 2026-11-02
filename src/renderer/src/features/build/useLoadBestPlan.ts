import { useCallback, useMemo } from 'react'
import type { ClassAbbr } from '@shared/classCombo'
import type { BuildStrategy } from '@shared/build/strategies'
import { strategyAllows } from '@shared/build/strategies'
import type { ManaEstimate } from '@shared/build/manaEstimate'
import type { BuildSet } from '@shared/build/optimizer'
import type { WornUnknown } from '@shared/build/wornSet'
import type { BuildWeights } from '@shared/build/profiles'
import { estimatedPlan, type LoadedPlan } from '@shared/build/planSet'
import type { GearRow } from '@shared/planner/gear'
import { BUILD_CELLS } from '@shared/build/wornSet'
import type { GearOwnershipMap } from '../gear/gearOwnership'
import { loadBuildCandidates } from './loadBuildCandidates'

interface Input {
  rows: readonly GearRow[]; ownership: GearOwnershipMap | null; strategy: BuildStrategy
  eraOnly: boolean; eraHidden: (row: GearRow) => boolean; unknown: readonly WornUnknown[]
  worn: BuildSet; classes: readonly ClassAbbr[]; weights: BuildWeights
  rowScore: (row: GearRow) => number; hasteScore: (row: GearRow) => number
  mana: ManaEstimate; loadPlan: (plan: LoadedPlan) => void
}

export function useLoadBestPlan({ rows, ownership, strategy, eraOnly, eraHidden, unknown, worn,
  classes, weights, rowScore, hasteScore, mana, loadPlan }: Input) {
  const canLoadOwned = useMemo(() => {
    for (const item of ownership?.values() ?? []) if (item.facts.length > 0) return true
    return false
  }, [ownership])
  const loadSuggested = useCallback((mode: 'optimal' | 'owned'): void => {
    const candidates = loadBuildCandidates(rows, ownership, mode, (row) =>
      strategyAllows(row, strategy) && (mode === 'owned' || !eraOnly || !eraHidden(row)))
    if (candidates.length === 0) return
    const locked = new Set(unknown.map((item) => item.cell))
    loadPlan(estimatedPlan({ candidates, cells: BUILD_CELLS, worn, locked,
      ctx: { classes, weights, score: rowScore, hasteScore }, mana }))
  }, [rows, ownership, strategy, eraOnly, eraHidden, unknown, worn, classes, weights, rowScore, hasteScore, mana, loadPlan])
  return { canLoadOwned, loadOptimal: useCallback(() => loadSuggested('optimal'), [loadSuggested]),
    loadBestOwned: useCallback(() => loadSuggested('owned'), [loadSuggested]) }
}
