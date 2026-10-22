// THE ACTIVE CHARACTER'S WORN FOCUS EFFECTS (JOS-452) — the one live-state wrapper over
// `wornFocusIndex.ts`'s pure join.
//
// It is a separate file for a boundary rather than for size: `wornFocusIndex.ts` is driven by the
// node runner against the committed dump, and reaching `getActiveCharacter()` from inside it would
// pull `app` in three modules deep and take that away. Everything that knows about a RUNNING app
// lives here; everything that knows about the JOIN lives next door.
//
// MEMOIZED ON THE DUMP'S OWN IDENTITY, exactly the way `gearOwnership` is (src/main/ipc/planner.ts
// carries that argument in full): path plus mtime identify the file completely, a rewrite moves the
// mtime. Discovery may retain another character's fallback path after a switch, so ownership is
// checked before every cache hit and an unowned fallback clears the cache.
//
// TWO HANDLERS READ IT — the planner's inventory payload and the spell card's `spells:detail` — so
// the resolution happens once. Two copies of it could credit two different items for one spell, and
// the whole point of the card is to name the item the readout's marker is talking about.

import { loadInventoryDump, outputStatus } from '../outputs'
import { outputKind, ownsOutputFile } from '../../shared/outputs/kinds'
import { getActiveCharacter } from '../session'
import { COMMITTED_ITEMS, committedFocusLines, wornFocusFor } from './wornFocusIndex'
import type { WornFocus } from '../../shared/wornFocus'

let resolved: { path: string; loadedAt: string; focus: WornFocus[] } | null = null

/** The active character's worn focus effects. An empty array when there is no dump to read. */
export function currentWornFocus(): WornFocus[] {
  const { name, server } = getActiveCharacter() ?? {}
  const status = outputStatus('inventory', { name, server })
  if (status.path === null || status.updatedAt === null ||
    !ownsOutputFile(outputKind('inventory'), status.path, name, server)) {
    resolved = null
    return []
  }
  if (resolved !== null && resolved.path === status.path && resolved.loadedAt === status.updatedAt) {
    return resolved.focus
  }
  // The loader resolves again and checks ownership itself; a dump that vanished or became
  // unavailable between the status check and the read is simply no dump.
  const loaded = loadInventoryDump(name, server)
  if (!loaded) {
    resolved = null
    return []
  }
  const focus = wornFocusFor(loaded.dump, COMMITTED_ITEMS, committedFocusLines())
  resolved = { path: loaded.path, loadedAt: loaded.loadedAt, focus }
  return focus
}
