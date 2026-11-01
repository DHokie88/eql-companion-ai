import { isAbsolute, relative, resolve } from 'node:path'
import type { WikiDatasetCache } from '../shared/wikiDataset'
const WIKI_CACHE_FILE_NAME = 'wiki-dataset.json'
const SHA256_HEX = /^[a-f0-9]{64}$/
const VERSION_TEXT = /^[\x20-\x7e]{1,128}$/
const GENERATED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
const CHECKED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/

export class WikiDatasetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WikiDatasetError'
  }
}

export function publicError(err: unknown): string {
  const message = err instanceof Error ? err.message : (typeof err === 'string' ? err : '')
  const oneLine = message.replace(/\s+/g, ' ').trim()
  if (!oneLine) return 'Wiki dataset request failed.'
  return oneLine.slice(0, 300)
}


export function resolveWikiCacheFile(cacheDir: string): string {
  if (typeof cacheDir !== 'string' || cacheDir.length === 0 || cacheDir.length > 4096) {
    throw new WikiDatasetError('Wiki dataset cache directory is invalid.')
  }
  if (cacheDir.includes('\0')) throw new WikiDatasetError('Wiki dataset cache directory is invalid.')
  const parts = cacheDir.split(/[\\/]+/)
  if (parts.some((part) => part === '..' || part === '.')) {
    throw new WikiDatasetError('Wiki dataset cache directory is invalid.')
  }
  if (!isAbsolute(cacheDir)) throw new WikiDatasetError('Wiki dataset cache directory must be absolute.')
  const root = resolve(cacheDir)
  const file = resolve(root, WIKI_CACHE_FILE_NAME)
  if (relative(root, file) !== WIKI_CACHE_FILE_NAME) {
    throw new WikiDatasetError('Wiki dataset cache path escaped its directory.')
  }
  return file
}


export function parseStoredWikiCache(value: unknown): WikiDatasetCache {
  if (!isPlainObject(value)) throw new WikiDatasetError('Saved wiki dataset was rejected.')
  const allowed = new Set([
    'schemaVersion',
    'version',
    'generatedAt',
    'checkedAt',
    'sha256',
    'items',
    'sourceItemCount',
    'identityConflicts',
    'quarantinedItems',
    'npcCount',
    'zoneCount'
  ])
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new WikiDatasetError('Saved wiki dataset was rejected.')
  }
  if (value.schemaVersion !== 1) throw new WikiDatasetError('Saved wiki dataset was rejected.')
  const version = requireVersion(value.version)
  const generatedAt = requireGeneratedAt(value.generatedAt)
  const checkedAt = requireCheckedAt(value.checkedAt)
  const sha256 = requireSha256(value.sha256)
  const npcCount = requireCount(value.npcCount)
  const zoneCount = requireCount(value.zoneCount)
  const items = sealItems(value.items)
  return {
    schemaVersion: 1,
    version,
    generatedAt,
    checkedAt,
    sha256,
    items,
    ...optionalCacheFields(value),
    npcCount,
    zoneCount
  }
}


export function optionalCacheFields(value: Record<string, unknown>): Pick<WikiDatasetCache, 'sourceItemCount' | 'identityConflicts' | 'quarantinedItems'> {
  const extra: Pick<WikiDatasetCache, 'sourceItemCount' | 'identityConflicts' | 'quarantinedItems'> = {}
  if (value.sourceItemCount !== undefined) extra.sourceItemCount = requireCount(value.sourceItemCount)
  if (value.identityConflicts !== undefined) extra.identityConflicts = sealConflicts(value.identityConflicts)
  if (value.quarantinedItems !== undefined) extra.quarantinedItems = sealQuarantine(value.quarantinedItems)
  return extra
}

function sealConflicts(value: unknown): { key: string; pages: string[] }[] {
  if (!Array.isArray(value) || value.length > 100_000) {
    throw new WikiDatasetError('Wiki dataset payload counts were rejected.')
  }
  return value.map((entry) => {
    if (!isPlainObject(entry) || typeof entry.key !== 'string' || entry.key.length > 240 || entry.key.includes('\0')) {
      throw new WikiDatasetError('Wiki dataset payload counts were rejected.')
    }
    if (!Array.isArray(entry.pages) || entry.pages.length > 64) {
      throw new WikiDatasetError('Wiki dataset payload counts were rejected.')
    }
    const pages = entry.pages.map((page) => {
      if (typeof page !== 'string' || page.length > 240 || page.includes('\0')) {
        throw new WikiDatasetError('Wiki dataset payload counts were rejected.')
      }
      return page
    })
    return { key: entry.key, pages }
  })
}

function sealQuarantine(value: unknown): NonNullable<WikiDatasetCache['quarantinedItems']> {
  if (!Array.isArray(value) || value.length > 100_000) {
    throw new WikiDatasetError('Wiki dataset items were rejected.')
  }
  return value.map((entry) => {
    return sealItem(entry)
  })
}

export function sealItems(value: unknown): WikiDatasetCache['items'] {
  if (!isPlainObject(value)) throw new WikiDatasetError('Wiki dataset items were rejected.')
  const items = Object.create(null) as WikiDatasetCache['items']
  if (Object.keys(value).length > 200_000) throw new WikiDatasetError('Wiki dataset has too many item keys.')
  for (const key of Object.keys(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new WikiDatasetError('Wiki dataset items were rejected.')
    }
    if (key.length > 240) throw new WikiDatasetError('Wiki dataset item key was rejected.')
    items[key] = sealItem(value[key])
  }
  return items
}


export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function requireVersion(value: unknown): string {
  if (typeof value !== 'string' || !VERSION_TEXT.test(value)) {
    throw new WikiDatasetError('Wiki dataset manifest is missing version or pack.')
  }
  return value
}

export function requireGeneratedAt(value: unknown): string {
  if (typeof value !== 'string' || (!GENERATED_AT.test(value) || !Number.isFinite(Date.parse(value)))) {
    throw new WikiDatasetError('Wiki dataset manifest is missing version or pack.')
  }
  return value
}

export function requireCheckedAt(value: unknown): string {
  if (typeof value !== 'string' || !CHECKED_AT.test(value)) {
    throw new WikiDatasetError('Wiki dataset check time is invalid.')
  }
  return value
}

export function requireSha256(value: unknown): string {
  if (typeof value !== 'string' || !SHA256_HEX.test(value.toLowerCase())) {
    throw new WikiDatasetError('Wiki dataset manifest is missing a valid SHA-256 checksum.')
  }
  return value.toLowerCase()
}

export function requireCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new WikiDatasetError('Wiki dataset payload counts were rejected.')
  }
  return value
}


// Stored JSON is validated at the worker boundary before planners dereference stat arrays.
function optionalText(value: unknown): void {
  if (value !== undefined && (typeof value !== 'string' || value.length > 524288)) {
    throw new WikiDatasetError('Wiki dataset item text was rejected.')
  }
}
function optionalFlag(value: unknown): void {
  if (value !== undefined && typeof value !== 'boolean') throw new WikiDatasetError('Wiki dataset item flags were rejected.')
}
function boundedArray(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > 1024) throw new WikiDatasetError('Wiki dataset stat arrays were rejected.')
  return value as unknown[]
}
function stringArray(value: unknown): void {
  if (value === undefined) return
  if (boundedArray(value).some((v) => typeof v !== 'string')) throw new WikiDatasetError('Wiki dataset stat names were rejected.')
}
function sealItem(value: unknown): WikiDatasetCache['items'][string] {
  if (!isPlainObject(value) || typeof value.page !== 'string' || !value.page.trim() || value.page.length > 240) {
    throw new WikiDatasetError('Wiki dataset item page was rejected.')
  }
  for (const key of ['name', 'eraTag', 'summary', 'statsBlock']) optionalText(value[key])
  for (const key of ['quest', 'lore']) optionalFlag(value[key])
  if (value.stats !== undefined) validateStats(value.stats)
  if (value.questUses !== undefined && boundedArray(value.questUses).length !== 0) {
    throw new WikiDatasetError('Wiki dataset item relationships were rejected.')
  }
  return value as unknown as WikiDatasetCache['items'][string]
}
function statPair(row: unknown): void {
  if (!isPlainObject(row) || typeof row.key !== 'string' || typeof row.value !== 'string') {
    throw new WikiDatasetError('Wiki dataset stat values were rejected.')
  }
}
function statEffect(row: unknown): void {
  if (!isPlainObject(row) || !['combat', 'focus', 'click', 'worn', 'proc', 'effect'].includes(String(row.kind)) || typeof row.name !== 'string') {
    throw new WikiDatasetError('Wiki dataset item effects were rejected.')
  }
}
function statSocket(row: unknown): void {
  if (!isPlainObject(row) || typeof row.type !== 'string') throw new WikiDatasetError('Wiki dataset item sockets were rejected.')
}
function validateStats(value: unknown): void {
  if (!isPlainObject(value)) throw new WikiDatasetError('Wiki dataset item stats were rejected.')
  for (const key of ['flags', 'stats', 'saves', 'effects', 'exaltationSlots', 'extras']) boundedArray(value[key])
  for (const key of ['flags', 'extras', 'classes', 'races']) stringArray(value[key])
  for (const key of ['stats', 'saves']) boundedArray(value[key]).forEach(statPair)
  boundedArray(value.effects).forEach(statEffect)
  boundedArray(value.exaltationSlots).forEach(statSocket)
}
