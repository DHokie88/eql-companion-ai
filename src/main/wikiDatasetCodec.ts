// Adapted from EOZ v1.0.0's verified dataset contract (11796e8f).
// Oracle owns this projection: wiki era is a claim, not proof of current EQL availability.
import { canonicalTitle, itemKey, type ItemDbEntry, type ItemDbFile } from './itemsDb'
import { parseStatsBlock } from '../shared/itemStats'
import type { WikiDatasetCache, WikiDatasetEvidence } from '../shared/wikiDataset'

type RecordValue = Record<string, unknown>
interface DatasetManifest { version: string; generatedAt: string; sha256: string }
const MAX_ROWS = 100_000
const own = (value: unknown): value is RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

function hasControl(value: string, allowWhitespace = false): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (allowWhitespace ? [0, 11, 12].includes(code) : code < 32 || code === 127) return true
  }
  return false
}

function requiredText(value: unknown, field: string, limit = 240): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit ||
      hasControl(value)) throw new Error('Invalid wiki dataset ' + field)
  return value.trim()
}

function rows(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value) || value.length > MAX_ROWS) throw new Error('Invalid wiki dataset ' + field)
  return value
}

function optionalNames(value: unknown, field: string): string[] {
  if (value === undefined) return []
  const values = rows(value, field)
  if (values.length > 64) throw new Error('Too many wiki dataset ' + field)
  return values.map((v) => requiredText(v, field, 100))
}

function statText(value: unknown): string {
  const display = rows(value, 'display lines')
  if (display.length > 256) throw new Error('Oversized wiki item stat block')
  return display.map((line) => {
    if (typeof line !== 'string' || line.length > 2048 || hasControl(line, true)) {
      throw new Error('Invalid wiki item display line')
    }
    return line
  }).join('\n')
}
function optionalNumber(value: unknown, field: string, max = Number.MAX_SAFE_INTEGER): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new Error('Invalid wiki item ' + field)
  }
  return value
}
function itemSummary(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new Error('Invalid wiki item notes')
  return value.trim().slice(0, 2048) || undefined
}
function eraClaim(value: unknown): string {
  return value === undefined || value === '' ? 'Unknown' : requiredText(value, 'era', 100)
}
function itemEntry(value: unknown, evidence: Omit<WikiDatasetEvidence, 'revisionId' | 'era'>): ItemDbEntry {
  if (!own(value)) throw new Error('Invalid wiki item')
  const page = requiredText(value.wikiTitle, 'item page')
  const name = requiredText(value.name, 'item name')
  const statsBlock = statText(value.displayLines)
  const stats = parseStatsBlock(statsBlock)
  const classes = optionalNames(value.classes, 'classes')
  const slots = optionalNames(value.slots, 'slots')
  if (!stats.classes && classes.length) stats.classes = classes
  if (!stats.slot && slots.length) stats.slot = slots.join(' ')
  const era = eraClaim(value.era)
  return { name, page, eraTag: era, statsBlock, stats,
    lore: stats.flags.some((f) => /^lore (?:item|equipped)$/i.test(f)),
    quest: stats.flags.some((f) => /^quest item$/i.test(f)), questUses: [],
    wikiDataset: { ...evidence, era, revisionId: recordRevision(value.revisionId) },
    ...optionalMetadata(value) }
}

function sourceRows(value: unknown): { items: unknown[]; npcs: unknown[]; zones: unknown[]; generatedAt: string } {
  if (!own(value) || !own(value.meta) || value.meta.schemaVersion !== 3 || value.meta.sample !== false) {
    throw new Error('A production wiki dataset with schema 3 is required')
  }
  const items = rows(value.items, 'items'), npcs = rows(value.npcs, 'NPCs'), zones = rows(value.zones, 'zones')
  if (!items.length || !zones.length) throw new Error('Wiki dataset is unexpectedly empty')
  return { items, npcs, zones, generatedAt: requiredText(value.meta.generatedAt, 'generation time', 100) }
}
function safeKey(label: string): string {
  const key = itemKey(label)
  if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unsafe wiki item key')
  return key
}
function pageGroups(entries: ItemDbEntry[]): Map<string, ItemDbEntry[]> {
  const groups = new Map<string, ItemDbEntry[]>()
  for (const entry of entries) {
    const key = safeKey(entry.page), group = groups.get(key) ?? []
    group.push(entry)
    groups.set(key, group)
  }
  return groups
}
function addAliases(entries: ItemDbEntry[], index: Map<string, ItemDbEntry>,
  conflicts: { key: string; pages: string[] }[], quarantined: ItemDbEntry[]): void {
  const exactKeys = new Set(index.keys()), ambiguous = new Set(conflicts.map((c) => c.key))
  for (const entry of entries) {
    if (quarantined.includes(entry)) continue
    const key = safeKey(entry.name ?? entry.page)
    if (exactKeys.has(key) || ambiguous.has(key)) continue
    const old = index.get(key)
    if (old && canonicalTitle(old.page) !== canonicalTitle(entry.page)) {
      conflicts.push({ key, pages: [old.page, entry.page] })
      ambiguous.add(key)
      index.delete(key)
    } else index.set(key, entry)
  }
}
export function decodeWikiDataset(value: unknown, manifest: DatasetManifest, checkedAt: string): WikiDatasetCache {
  const { items, npcs, zones, generatedAt } = sourceRows(value)
  if (!Number.isFinite(Date.parse(generatedAt)) || !Number.isFinite(Date.parse(checkedAt))) {
    throw new Error('Invalid wiki dataset timestamp')
  }
  const version = requiredText(manifest.version, 'manifest version', 200)
  if (!/^[a-f0-9]{64}$/i.test(manifest.sha256)) throw new Error('Invalid wiki dataset digest')
  const index = new Map<string, ItemDbEntry>()
  const evidence = { source: 'EQLWiki EOZ dataset' as const, version, generatedAt }
  const entries = items.map((raw) => itemEntry(raw, evidence))
  const pageKeys = pageGroups(entries)
  const identityConflicts: { key: string; pages: string[] }[] = []
  const quarantinedItems: ItemDbEntry[] = []
  for (const [key, group] of pageKeys) {
    if (new Set(group.map((entry) => canonicalTitle(entry.page))).size > 1) {
      identityConflicts.push({ key, pages: group.map((entry) => entry.page) })
      quarantinedItems.push(...group)
    } else index.set(key, group[0])
  }
  addAliases(entries, index, identityConflicts, quarantinedItems)
  return { schemaVersion: 1, version, generatedAt, checkedAt, sha256: manifest.sha256,
    items: Object.fromEntries(index), sourceItemCount: items.length, identityConflicts, quarantinedItems,
    npcCount: npcs.length, zoneCount: zones.length }
}

export function mergeWikiItems(base: ItemDbFile, cache: WikiDatasetCache | null): ItemDbFile {
  if (!cache) return base
  const items = { ...base.items }
  const oldByPage = new Map<string, ItemDbEntry>()
  const oldKeys = new Map<string, string[]>()
  for (const [key, row] of Object.entries(base.items)) {
    const title = canonicalTitle(row.page)
    oldByPage.set(title, row)
    const keys = oldKeys.get(title) ?? []
    keys.push(key)
    oldKeys.set(title, keys)
  }
  const freshByPage = new Map(Object.values(cache.items).map((row) => [canonicalTitle(row.page), row]))
  for (const [title, row] of freshByPage) {
    const old = oldByPage.get(title)
    const entry = mergedEntry(old, row)
    for (const key of oldKeys.get(title) ?? []) items[key] = entry
    installNames(items, entry, title)
  }
  return { ...base, count: new Set(Object.values(items).map((v) => canonicalTitle(v.page))).size,
    source: base.source + ' + verified EQLWiki EOZ dataset ' + cache.version, items }
}

function installNames(items: ItemDbFile['items'], row: ItemDbEntry, title: string): void {
  for (const label of [row.page, row.name ?? row.page]) {
    const key = itemKey(label)
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue
    if (!items[key] || canonicalTitle(items[key].page) === title) items[key] = row
  }
}

function recordRevision(value: unknown): number | null {
  const revision = optionalNumber(value, 'revision')
  return revision === 0 ? null : revision ?? null
}
function optionalMetadata(value: RecordValue): Pick<ItemDbEntry, 'iconId' | 'summary'> {
  const extra: Pick<ItemDbEntry, 'iconId' | 'summary'> = {}
  const iconId = optionalNumber(value.iconId, 'icon', 10_000_000)
  const summary = itemSummary(value.notes)
  if (iconId !== undefined) extra.iconId = iconId
  if (summary !== undefined) extra.summary = summary
  return extra
}
function mergedEntry(old: ItemDbEntry | undefined, row: ItemDbEntry): ItemDbEntry {
  return { ...old, ...row, eraTag: old?.eraTag ?? row.eraTag,
    quest: [old?.quest, row.quest].some(Boolean),
    questUses: old?.questUses?.length ? old.questUses : row.questUses ?? [] }
}
