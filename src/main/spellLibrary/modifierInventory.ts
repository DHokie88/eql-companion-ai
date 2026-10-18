import { basename } from 'node:path'
import { outputFileNames, outputKind } from '../../shared/outputs/kinds'
import type { InventoryDump } from '../../shared/outputs/inventory'
import type { SpellModifierContext } from '../../shared/spellModifiers'
import type { ItemDbFile } from '../itemsDb'
import { modifierFocusCandidates } from '../planner/modifierFocusCandidates'

export interface ModifierInventoryReader {
  status(character: { name: string; server: string }): { path: string | null; updatedAt: string | null }
  load(character: { name: string; server: string }): { path: string; loadedAt: string; dump: InventoryDump } | null
  items: ItemDbFile
}
type Inventory = SpellModifierContext['inventory']

function missing(): Inventory { return { state: 'missing', exportedAt: null, candidates: [], warnings: [] } }

function ownsInventory(path: string, character: { name: string; server: string }): boolean {
  const names = outputFileNames(outputKind('inventory'), character.name, character.server)
  return names.some((name) => name.toLowerCase() === basename(path).toLowerCase())
}

/** The generic output reader falls back to another character's newest dump; estimates never do. */
export function readModifierInventory(character: { name: string; server: string } | null, reader: ModifierInventoryReader): Inventory {
  if (character === null) return missing()
  const status = reader.status(character)
  if (status.path === null || status.updatedAt === null || !ownsInventory(status.path, character)) return missing()
  const loaded = reader.load(character)
  if (loaded === null || !ownsInventory(loaded.path, character)) {
    return { state: 'error', exportedAt: status.updatedAt, candidates: [], warnings: ['The inventory export could not be read. Run /outputfile inventory again.'] }
  }
  if (loaded.dump.sectionShapes.Location !== 'items') {
    return { state: 'error', exportedAt: loaded.loadedAt, candidates: [], warnings: ['The inventory export has no recognized equipment table.'] }
  }
  const audit = modifierFocusCandidates(loaded.dump, reader.items)
  if (loaded.dump.malformed.length > 0) audit.warnings.push('Some inventory rows could not be read; equipped focus coverage may be incomplete.')
  return { state: 'ready', exportedAt: loaded.loadedAt, ...audit }
}
