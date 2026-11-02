import type { CharacterLoadout } from '../../../../shared/loadouts'
import type { PlannerInventory } from '../../../../shared/planner/inventorySlots'

/** A saved snapshot belongs to its class mix; following live uses the current export. */
export function selectBuildInventory(
  selected: CharacterLoadout | null,
  following: boolean,
  liveId: string | undefined,
  live: PlannerInventory | null
): PlannerInventory | null {
  if (following || !selected) return live
  const capture = selected.capture
  if (capture?.classes.slice().sort().join('/') === selected.classes.slice().sort().join('/')) return capture.inventory
  return selected.id === liveId ? live : null
}
