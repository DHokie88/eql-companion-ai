import type { BardInstrumentInventory, BardInstrumentSource } from '../../shared/bardInstruments'
import { PRIMARY_ITEM_SECTION, type InventoryDump, type InventoryEntry } from '../../shared/outputs/inventory'
import { FOCUS_SOCKET_INDEX } from '../../shared/planner/inventorySlots'
import type { ItemEffect } from '../../shared/itemStats'
import { itemKey, type ItemDbEntry, type ItemDbFile } from '../itemsDb'

interface Audit {
  sources: Map<string, BardInstrumentSource>
  missingItems: Set<string>
  missingData: Set<string>
  warnings: Set<string>
}

const FAMILIES: Record<string, string> = {
  brass: 'Brass', string: 'String', wind: 'Wind', percussion: 'Percussion', singing: 'Singing'
}

/** A measured label syntax, not a fuzzy name association or an inferred multiplier. */
function resonanceName(text: string): string | null {
  const match = /^(brass|string|wind|percussion|singing) resonance(?:\s*:\s*|\s+)(\d+)$/i.exec(text.trim())
  return match ? `${FAMILIES[match[1].toLowerCase()]} Resonance ${Number(match[2])}` : null
}

function statLines(item: ItemDbEntry): string[] {
  return [
    ...(item.stats?.flags ?? []), ...(item.stats?.extras ?? []),
    ...(item.stats?.stats ?? []).map((stat) => `${stat.key}: ${stat.value}`),
    ...(item.statsBlock ?? '').split(/\r?\n/)
  ]
}

function explicitRequiredLevel(item: ItemDbEntry): number | undefined {
  const levels = statLines(item).flatMap((line) => {
    const match = /^(?:required level|req level)\s*:?\s*(\d+)$/i.exec(line.trim())
    return match ? [Number(match[1])] : []
  })
  return levels.length ? Math.max(...levels) : undefined
}

function requiredLevel(...levels: (number | undefined)[]): number | undefined {
  const valid = levels.filter((level): level is number => level !== undefined && Number.isFinite(level) && level >= 0)
  return valid.length ? Math.max(...valid) : undefined
}

function addSource(audit: Audit, source: BardInstrumentSource): void {
  const key = `${source.location}\u0000${source.item}\u0000${source.effect}`
  const previous = audit.sources.get(key)
  if (previous === undefined || (source.requiredLevel ?? 0) > (previous.requiredLevel ?? 0)) audit.sources.set(key, source)
}

function effectSource(effect: ItemEffect, source: Omit<BardInstrumentSource, 'effect' | 'basis'>): BardInstrumentSource | null {
  if (effect.kind !== 'focus' || !effect.name.trim()) return null
  return {
    ...source, effect: resonanceName(effect.name) ?? effect.name.trim(), basis: 'focus effect',
    requiredLevel: requiredLevel(source.requiredLevel, effect.reqLevel)
  }
}

function collectSources(audit: Audit, item: ItemDbEntry, source: Omit<BardInstrumentSource, 'effect' | 'basis'>): void {
  // Keep named singing/all-song focuses for the numeric catalog decoder; names alone grant nothing.
  for (const effect of item.stats?.effects ?? []) {
    const candidate = effectSource(effect, source)
    if (candidate !== null) addSource(audit, candidate)
  }
  for (const line of statLines(item)) {
    const effect = resonanceName(line)
    if (effect !== null) addSource(audit, { ...source, effect, basis: 'resonance stat' })
    else if (/^(brass|string|wind|percussion|singing) resonance(?:\s|:|$)/i.test(line.trim())) {
      audit.warnings.add('Some instrument resonance stat lines could not be decoded. Instrument coverage may be incomplete.')
    }
  }
}

function eligible(entry: InventoryEntry): boolean {
  return entry.section === PRIMARY_ITEM_SECTION && !entry.empty && !entry.orphan && !entry.parsedName.ornamentation
}

function focusSocket(entry: InventoryEntry): boolean {
  return eligible(entry) && entry.parsedName.exaltation && entry.path.at(-1) === FOCUS_SOCKET_INDEX
}

function lookup(entry: InventoryEntry, items: ItemDbFile, audit: Audit): ItemDbEntry | undefined {
  const item = items.items[itemKey(entry.parsedName.base)]
  if (item === undefined) audit.missingItems.add(entry.parsedName.base)
  else if (item.stats === undefined && !item.statsBlock?.trim()) audit.missingData.add(entry.parsedName.base)
  return item
}

function collectHost(entry: InventoryEntry, equipped: boolean, items: ItemDbFile, audit: Audit): void {
  const item = lookup(entry, items, audit)
  if (item !== undefined) {
    const minimum = explicitRequiredLevel(item)
    collectSources(audit, item, { item: entry.parsedName.base, location: entry.location, equipped, requiredLevel: minimum })
    for (const socket of entry.children.filter(focusSocket)) {
      const donor = lookup(socket, items, audit)
      if (donor === undefined) continue
      collectSources(audit, donor, {
        item: `${socket.parsedName.base} (Exaltation)`, location: socket.location, equipped,
        requiredLevel: requiredLevel(minimum, explicitRequiredLevel(donor))
      })
    }
  }
  if (equipped) return
  // Contents of General bags are carried alternatives. Socket copies are handled only above.
  for (const child of entry.children) {
    if (eligible(child) && !child.parsedName.exaltation) collectHost(child, false, items, audit)
  }
}

function coverageWarning(items: Set<string>, description: string): string[] {
  if (items.size === 0) return []
  const names = [...items].sort()
  const extra = names.length > 5 ? `; and ${names.length - 5} more` : ''
  return [`${description}: ${names.slice(0, 5).join(', ')}${extra}. Instrument coverage may be incomplete.`]
}

/** Export-time evidence only; storage elsewhere and loose/uninstalled exaltations grant nothing. */
export function bardInstrumentInventory(dump: InventoryDump, items: ItemDbFile): BardInstrumentInventory {
  const audit: Audit = { sources: new Map(), missingItems: new Set(), missingData: new Set(), warnings: new Set() }
  for (const entry of dump.items) {
    if (!eligible(entry) || entry.path.length !== 0 || entry.parsedName.exaltation) continue
    if (entry.place.kind === 'equip') collectHost(entry, true, items, audit)
    else if (entry.place.kind === 'container' && entry.place.container === 'general') collectHost(entry, false, items, audit)
  }
  if (dump.malformed.length > 0) audit.warnings.add('Some inventory rows could not be read. Instrument coverage may be incomplete.')
  if (dump.items.some((entry) => entry.section === PRIMARY_ITEM_SECTION && entry.orphan)) {
    audit.warnings.add('Orphan inventory rows were excluded from instrument evidence. Run /outputfile inventory again.')
  }
  return { sources: [...audit.sources.values()], warnings: [
    ...audit.warnings,
    ...coverageWarning(audit.missingItems, 'Equipped or carried items missing from the item catalog'),
    ...coverageWarning(audit.missingData, 'Equipped or carried items with no modifier data')
  ] }
}
