import { loadoutWishlist, type CharacterLoadout } from '@shared/loadouts'
import type { PlannerInventory } from '@shared/planner/inventorySlots'
import type { BuildStrategy } from '@shared/build/strategies'
import { useCallback, useMemo, useState } from 'react'
import type { GearRow } from '@shared/planner/gear'
import type { PlanSlotId } from '@shared/planner/types'
import { scaleGearRow } from '@shared/planner/gearScale'
import { upgradeStateForTier } from '@shared/itemUpgrade'
import { wearable } from '@shared/build/optimizer'
import { defaultBuildStrategies } from '@shared/build/strategies'
import { useLoadouts } from '../loadouts/useLoadouts'
import { useWishlist } from '../wishlist/useWishlist'
import { wishFromGear } from '../wishlist/wishSearch'
import { useGearOwnership } from '../gear/gearData'
import { usePlannerInventory } from '../planner/plannerInventory'
export function useBuildLoadout(rows: GearRow[]) {
  const { selected, live, liveClasses, state, update, ready } = useLoadouts()
  const { add, list } = useWishlist()
  const liveInventory = usePlannerInventory()
  const ownership = useGearOwnership()
  const classes = selected?.classes ?? liveClasses
  const inventory = selectedInventory(selected, live?.id, liveInventory.inventory)
  const [localSwaps, setLocalSwaps] = useState<ReadonlyMap<PlanSlotId, GearRow>>(() => new Map())
  const [fallbackStrategy, setFallbackStrategy] = useState('s1')
  const strategies = state?.book.strategies ?? defaultBuildStrategies()
  const strategy = selectedStrategy(strategies, selected, fallbackStrategy)
  const setStrategy = useCallback((id: string): void => {
    if (selected) void update({ kind: 'edit', id: selected.id, strategyId: id }).catch(() => { /* Shared error. */ })
    else setFallbackStrategy(id)
  }, [selected, update])
  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows])
  const swaps = useMemo(() => {
    if (!selected) return localSwaps
    const out = new Map<PlanSlotId, GearRow>()
    for (const [cell, item] of Object.entries(selected.plan)) {
      const row = byKey.get(item.key)
      if (row && wearable(row, classes)) out.set(cell as PlanSlotId, scaleGearRow(row, upgradeStateForTier(item.tier)))
    }
    return out
  }, [selected, localSwaps, byKey, classes])
  const savePlan = useCallback((next: ReadonlyMap<PlanSlotId, GearRow>): void => {
    if (!selected) { setLocalSwaps(next); return }
    const plan = Object.fromEntries([...next].map(([cell, row]) => [cell, { key: row.key, tier: selected.plan[cell]?.key === row.key ? selected.plan[cell]?.tier ?? 0 : 0 }]))
    void update({ kind: 'plan', id: selected.id, plan }).catch(() => { /* Shared error. */ })
  }, [selected, update])
  const swap = useCallback((cell: PlanSlotId, row: GearRow) => savePlan(new Map(swaps).set(cell, row)), [swaps, savePlan])
  const unswap = useCallback((cell: PlanSlotId) => { const next = new Map(swaps); next.delete(cell); savePlan(next) }, [swaps, savePlan])
  const reset = useCallback(() => savePlan(new Map()), [savePlan])
  const wished = useMemo(() => new Set(loadoutWishlist(list, selected?.wishKeys ?? null).entries.map((e) => e.itemKey)), [list, selected])
  const owned = useCallback((row: GearRow) => ownership.map?.get(row.key)?.owned === true, [ownership.map])
  const addWish = useCallback((row: GearRow): void => {
    if (owned(row)) return
    add(wishFromGear(row, Date.now()))
    if (selected) void update({ kind: 'wish', id: selected.id, wishKeys: [...new Set([...selected.wishKeys, row.key])] }).catch(() => { /* Shared error. */ })
  }, [add, owned, selected, update])
  return { classes, inventory, inventoryReady: liveInventory.ready && ready, strategy, strategies, swaps, setStrategy, swap, unswap, reset, wished, owned, addWish }
}

function selectedInventory(selected: CharacterLoadout | null, liveId: string | undefined, live: PlannerInventory | null): PlannerInventory | null {
  if (!selected) return live
  const capture = selected.capture
  if (capture?.classes.slice().sort().join('/') === selected.classes.slice().sort().join('/')) return capture.inventory
  return selected.id === liveId ? live : null
}
function selectedStrategy(strategies: BuildStrategy[], selected: CharacterLoadout | null, fallback: string): BuildStrategy {
  return strategies.find((p) => p.id === (selected?.strategyId ?? fallback)) ?? strategies[0]
}
