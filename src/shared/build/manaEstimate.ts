import type { ClassAbbr } from '../classCombo'
import type { GearRow } from '../planner/gear'

/** User-selected level-50 illustration; the exact EQL formula is unpublished. */
export interface ManaEstimate {
  classes: readonly ClassAbbr[]
  intelligence: number
  wisdom: number
  /** Value of one raw mana point in the selected strategy. */
  manaWeight: number
}

const INT_FULL: readonly ClassAbbr[] = ['WIZ', 'MAG', 'NEC', 'ENC']
const WIS_FULL: readonly ClassAbbr[] = ['CLR', 'DRU', 'SHM']
const INT_HYBRID: readonly ClassAbbr[] = ['BRD', 'SHD']
const WIS_HYBRID: readonly ClassAbbr[] = ['PAL', 'RNG', 'BST']

/** Approximate pools from the user's model: 9.4 mana/stat full, half for hybrid. */
export function estimatedMana(model: ManaEstimate): number {
  const pools: number[] = []
  for (const cls of model.classes) {
    if (INT_FULL.includes(cls)) pools.push(model.intelligence * 9.4)
    else if (WIS_FULL.includes(cls)) pools.push(model.wisdom * 9.4)
    else if (INT_HYBRID.includes(cls)) pools.push(model.intelligence * 4.7)
    else if (WIS_HYBRID.includes(cls)) pools.push(model.wisdom * 4.7)
  }
  pools.sort((a, b) => b - a)
  return (pools[0] ?? 0) + (pools[1] ?? 0)
}

/** A candidate can change which two class pools are largest. */
export function estimatedManaGain(model: ManaEstimate, current: GearRow | null, candidate: GearRow): number {
  const next = { ...model,
    intelligence: Math.max(0, model.intelligence - (current?.stats.INT ?? 0) + (candidate.stats.INT ?? 0)),
    wisdom: Math.max(0, model.wisdom - (current?.stats.WIS ?? 0) + (candidate.stats.WIS ?? 0)) }
  return (estimatedMana(next) - estimatedMana(model)) * model.manaWeight
}

/** Move the entered, in-game totals with a hypothetical change of the worn set. */
export function manaForSet(model: ManaEstimate, baseline: Iterable<GearRow | null>, next: Iterable<GearRow | null>): ManaEstimate {
  let intelligence = model.intelligence, wisdom = model.wisdom
  for (const item of baseline) if (item) { intelligence -= item.stats.INT ?? 0; wisdom -= item.stats.WIS ?? 0 }
  for (const item of next) if (item) { intelligence += item.stats.INT ?? 0; wisdom += item.stats.WIS ?? 0 }
  return { ...model, intelligence: Math.max(0, intelligence), wisdom: Math.max(0, wisdom) }
}

/** Estimated mana attributable to the gear; intrinsic stats remain the baseline. */
export function gearManaScore(model: ManaEstimate, baseline: Iterable<GearRow | null>, set: Iterable<GearRow | null>): number {
  const base = [...baseline]
  const naked = manaForSet(model, base, [])
  return (estimatedMana(manaForSet(model, base, set)) - estimatedMana(naked)) * model.manaWeight
}
