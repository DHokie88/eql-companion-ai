import { focusBearers } from '../../shared/planner/inventorySlots'
import type { InventoryDump } from '../../shared/outputs/inventory'
import type { SpellFocusCandidate } from '../../shared/spellModifiers'
import { itemKey, type ItemDbFile } from '../itemsDb'

/** Keep exact focus names, including unsupported families, for the numeric client-catalog join. */
export function modifierFocusCandidates(dump: InventoryDump, items: ItemDbFile): {
  candidates: SpellFocusCandidate[]; warnings: string[]
} {
  const candidates = new Map<string, SpellFocusCandidate>()
  const warnings = new Set<string>()
  for (const bearer of focusBearers(dump)) {
    const item = bearer.exaltation ? `${bearer.name} (Exaltation)` : bearer.name
    const entry = items.items[itemKey(bearer.name)]
    if (entry === undefined) {
      warnings.add(`Equipped item is missing from the item catalog: ${item}`)
      continue
    }
    for (const effect of entry.stats?.effects ?? []) {
      if (effect.kind !== 'focus') continue
      if (!effect.name.trim()) {
        warnings.add(`Equipped item has an unnamed focus effect: ${item}`)
        continue
      }
      const key = effect.name.trim().toLowerCase()
      if (!candidates.has(key)) candidates.set(key, { effect: effect.name.trim(), item })
    }
  }
  return { candidates: [...candidates.values()], warnings: [...warnings].sort() }
}
