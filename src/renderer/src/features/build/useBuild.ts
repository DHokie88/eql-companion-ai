import { useBuildLoadout } from './useBuildLoadout'
import { strategyAllows, strategyScorer, strategyWeights, type BuildStrategy } from '@shared/build/strategies'
// THE BUILD TAB'S STATE (EQ Zera, 2026-09-06): the worn set read off the inventory dump, the
// swaps the player is trying, and everything the three profiles say about both — computed here,
// drawn by the panels.
//
// WHAT IT READS, and from where it already exists:
//   - the gear index (`useGearIndex`, main's 6.7k equippable rows with numeric stats),
//   - the worn hosts (`usePlannerInventory`, the `/outputfile inventory` dump by cell), each
//     scaled to the tier the dump states (`scaleGearRow`), the way the character sheet totals,
//   - the class loadout the Gear tab filters by (`useGearClasses`), the era rule the Exaltations
//     tab uses (`useEraOnly` + `eraHides`), and the owned/looted join (`useGearOwnership`).
//
// WHAT IT COMPUTES: for each profile, the set's score and the best score the same rows could
// reach under the same filters (`bestBuild`) — a meter is the ratio; and for the SELECTED profile,
// the upgrades per cell. Candidates use at least +5, or a higher owned tier when available.

import { useCallback, useMemo, useState } from 'react'
import type { ClassAbbr } from '@shared/classCombo'
import type { GearRow } from '@shared/planner/gear'
import type { PlanSlotId } from '@shared/planner/types'
import {
  BUILD_PROFILES,
  meterPercent,
  profileWeights,
  soloKit,
  soloReading,
  type BuildProfile,
  type BuildWeights,
  type SoloKit,
  type SoloReading
} from '../../../../shared/build/profiles'
import { bestBuild, buildScore, rankUpgrades, upgradesFor, type BuildSet, type CellUpgrade } from '../../../../shared/build/optimizer'
// THE WORN READ IS SHARED NOW (shared/build/wornSet.ts). `useUpgradeFinder` asks the same question
// from the Zone Loot rows and the item page, and two spellings of "what am I wearing" would be two
// answers to it. `BUILD_CELLS` and `WornUnknown` are re-exported below for this tab's importers.
import { BUILD_CELLS, wornSet, type WornUnknown } from '../../../../shared/build/wornSet'
import { useEraHidden, useGearIndex, useGearOwnership, useOwnedOrLooted } from '../gear/gearData'
import { useRemembered } from '../gear/useAreaMemory'
import { sanitizeBuildProfile } from '../gear/areaMemory'
import { useEraOnly } from '../planner/plannerData'
import { outputUpdatedMillis } from '../../lib/outputFreshness'
import { sanitizeManaStat } from '../gear/areaMemory'
import { gearManaScore, manaForSet, type ManaEstimate } from '../../../../shared/build/manaEstimate'
import { scaleGearRow } from '@shared/planner/gearScale'
import { upgradeStateForTier } from '@shared/itemUpgrade'
import { recommendedGearTier } from '../gear/gearOwnership'

export { BUILD_CELLS }
export type { WornUnknown }

const UPGRADE_LIMIT = 50

export type Meters = Record<BuildProfile, number>

export interface BuildState {
  ready: boolean
  hasDump: boolean
  hasLiveInventory: boolean
  usingLiveInventory: boolean
  followLive: () => void
  manaInt: number | null
  manaWis: number | null
  setManaInt: (value: number | null) => void
  setManaWis: (value: number | null) => void
  exportedAt: number | undefined
  classes: ClassAbbr[]
  strategy: BuildStrategy
  strategies: BuildStrategy[]
  setStrategy: (id: string) => void
  rowScore: (row: GearRow) => number
  candidateTier: (row: GearRow) => number
  wished: ReadonlySet<string>
  owned: (row: GearRow) => boolean
  addWish: (row: GearRow) => void
  profile: BuildProfile
  setProfile: (p: BuildProfile) => void
  eraOnly: boolean
  setEraOnly: (v: boolean) => void
  ownedOnly: boolean
  setOwnedOnly: (v: boolean) => void
  /** the dump's worn items, as index rows scaled to their tier; null where empty or unknown */
  worn: BuildSet
  /** worn items the index has no row for — counted, never silently dropped */
  unknown: WornUnknown[]
  /** worn + swaps */
  set: BuildSet
  swaps: ReadonlyMap<PlanSlotId, GearRow>
  swap: (cell: PlanSlotId, row: GearRow, tier?: number) => void
  unswap: (cell: PlanSlotId) => void
  reset: () => void
  weights: BuildWeights
  meters: Meters
  /** the selected profile's score, and the best it could reach */
  score: { current: number; best: number }
  kit: SoloKit
  solo: SoloReading
  upgrades: CellUpgrade[]
}

export function useBuild(): BuildState {
  const index = useGearIndex()
  const { classes, inventory, liveInventory, inventoryReady, hasLiveInventory, usingLiveInventory, followLive, strategy, strategies, swaps, setStrategy, swap, unswap, reset, wished, owned, addWish } = useBuildLoadout(index.rows)
  const { eraHidden } = useEraHidden()
  const [eraOnly, setEraOnly] = useEraOnly()
  const ownership = useGearOwnership()
  const candidateTier = useCallback((row: GearRow): number => recommendedGearTier(ownership.map, row.key), [ownership.map])
  const candidates = useMemo(() => index.rows.map((row) => {
    const tier = candidateTier(row)
    return scaleGearRow(row, upgradeStateForTier(tier))
  }), [index.rows, candidateTier])
  const { ownedOrLooted } = useOwnedOrLooted(ownership.map)
  const [ownedOnly, setOwnedOnly] = useState(false)
  const [profile, setProfile] = useRemembered<BuildProfile>('eq.build.profile', sanitizeBuildProfile)
  const [manaInt, setManaInt] = useRemembered('eq.build.manaInt', sanitizeManaStat)
  const [manaWis, setManaWis] = useRemembered('eq.build.manaWis', sanitizeManaStat)
  const byKey = useMemo(() => new Map(index.rows.map((r) => [r.key, r])), [index.rows])
  const { worn, unknown } = useMemo(() => wornSet(inventory?.hosts ?? [], byKey), [inventory, byKey])
  const set = useMemo(() => {
    const out = new Map(worn)
    for (const [cell, row] of swaps) out.set(cell, row)
    return out
  }, [worn, swaps])

  const excluded = useCallback(
    (row: GearRow) => (eraOnly && eraHidden(row)) || (ownedOnly && !ownedOrLooted(row)) || !strategyAllows(row, strategy),
    [eraOnly, eraHidden, ownedOnly, ownedOrLooted, strategy]
  )

  // Every profile's weights, current score and best reachable score — the three meters.
  const readings = useMemo(() => {
    const out = {} as Record<BuildProfile, { weights: BuildWeights; current: number; best: number }>
    for (const p of BUILD_PROFILES) {
      const weights = profileWeights(p, classes)
      const ctx = { classes, weights, excluded }
      out[p] = { weights, current: buildScore(set, weights), best: buildScore(bestBuild(index.rows, BUILD_CELLS, ctx), weights) }
    }
    return out
  }, [index.rows, classes, excluded, set])

  const meters = useMemo(() => {
    const out = {} as Meters
    for (const p of BUILD_PROFILES) out[p] = meterPercent(readings[p].current, readings[p].best)
    return out
  }, [readings])

  const kit = useMemo(() => soloKit(classes), [classes])
  const solo = useMemo(() => soloReading(kit, meters), [kit, meters])

  const weights = useMemo(() => strategyWeights(strategy, classes), [strategy, classes])
  const scoreStats = useMemo(() => strategyScorer(strategy, classes), [strategy, classes])
  const rowScore = useCallback((row: GearRow) => scoreStats(row.stats), [scoreStats])
  const hasteScore = useCallback((row: GearRow) => scoreStats({ HASTE: row.stats.HASTE }), [scoreStats])
  const manaBaseline = useMemo<ManaEstimate>(() => ({ classes, intelligence: manaInt ?? 150, wisdom: manaWis ?? 150,
    manaWeight: weights.MP ?? 0 }), [classes, manaInt, manaWis, weights.MP])
  const mana = useMemo(() => manaForSet(manaBaseline, worn.values(), set.values()), [manaBaseline, worn, set])
  const unscored = useMemo(() => {
    const cells = new Set<PlanSlotId>()
    for (const item of unknown) if (!swaps.has(item.cell)) cells.add(item.cell)
    return cells
  }, [unknown, swaps])
  const upgrades = useMemo(
    () => rankUpgrades(upgradesFor(candidates, set, BUILD_CELLS, {
      classes, weights, excluded, score: rowScore, hasteScore, mana, perCell: UPGRADE_LIMIT,
      wornKeys: new Set([...(inventory?.hosts.map((host) => host.key) ?? []), ...(liveInventory?.hosts.map((host) => host.key) ?? [])]),
      unknownCells: unscored
    }), UPGRADE_LIMIT),
    [candidates, set, classes, weights, excluded, rowScore, hasteScore, mana, inventory, liveInventory, unscored]
  )

  const score = useMemo(() => {
    const current = buildScore(set, weights, rowScore, hasteScore) + gearManaScore(manaBaseline, worn.values(), set.values())
    const bestSet = bestBuild(candidates, BUILD_CELLS, { classes, weights, excluded, score: rowScore, hasteScore, mana })
    const estimate = buildScore(bestSet, weights, rowScore, hasteScore) + gearManaScore(manaBaseline, worn.values(), bestSet.values())
    return { current, best: Math.max(current, estimate) }
  }, [set, weights, rowScore, hasteScore, manaBaseline, worn, candidates, classes, excluded, mana])


  return {
    strategy, strategies, setStrategy, rowScore, candidateTier, wished, owned, addWish,
    ready: index.ready && inventoryReady,
    hasDump: inventory !== null,
    hasLiveInventory, usingLiveInventory, followLive,
    manaInt, manaWis, setManaInt, setManaWis,
    exportedAt: outputUpdatedMillis(inventory?.loadedAt),
    classes,
    profile,
    setProfile,
    eraOnly,
    setEraOnly,
    ownedOnly,
    setOwnedOnly,
    worn,
    unknown,
    set,
    swaps,
    swap,
    unswap,
    reset,
    weights,
    meters,
    score,
    kit,
    solo,
    upgrades
  }
}
