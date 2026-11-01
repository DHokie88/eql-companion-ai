import { isClassAbbr, type ClassAbbr } from './classCombo'
import type { CharacterSheet } from './characterSheet'
import { PLAN_SLOTS, type PlanSlotId } from './planner/types'
import type { PlannerInventory } from './planner/inventorySlots'
import { defaultBuildStrategies, normalizeBuildStrategies, type BuildStrategy } from './build/strategies'
import { validLoadoutCapture } from './loadoutCapture'
export const LOADOUT_IDS = ['lo1', 'lo2', 'lo3', 'lo4', 'lo5'] as const
export type LoadoutId = typeof LOADOUT_IDS[number]
export interface LoadoutCapture { capturedAt: string; classes: ClassAbbr[]; sheet: Omit<CharacterSheet, 'carry'>; inventory: PlannerInventory }
export interface LoadoutPlanItem { key: string; tier: number }
export interface CharacterLoadout { id: LoadoutId; name: string; classes: ClassAbbr[]; capture?: LoadoutCapture; plan: Partial<Record<PlanSlotId, LoadoutPlanItem>>; strategyId: string; wishKeys: string[] }
export interface LoadoutBook { version: 1; loadouts: CharacterLoadout[]; strategies: BuildStrategy[] }
export interface LoadoutState { characterId: string; book: LoadoutBook }
export type LoadoutChange = { kind: 'edit'; id: LoadoutId; name?: string; classes?: ClassAbbr[]; strategyId?: string } |
  { kind: 'plan'; id: LoadoutId; plan: CharacterLoadout['plan'] } | { kind: 'wish'; id: LoadoutId; wishKeys: string[] } |
  { kind: 'strategy'; strategy: BuildStrategy }
export const loadoutRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
export function loadoutClasses(raw: unknown): ClassAbbr[] {
  return Array.isArray(raw) ? [...new Set(raw.filter(isClassAbbr))].slice(0, 3) : []
}
export function emptyLoadoutBook(): LoadoutBook {
  return { version: 1, strategies: defaultBuildStrategies(), loadouts: LOADOUT_IDS.map((id, i) => ({ id, name: `LO${i + 1}`, classes: [], plan: {}, strategyId: 's1', wishKeys: [] })) }
}
function keys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 240))].slice(0, 500)
}
function planItems(raw: unknown): CharacterLoadout['plan'] {
  if (!loadoutRecord(raw)) return {}
  const out: CharacterLoadout['plan'] = {}
  for (const slot of PLAN_SLOTS) {
    const item = raw[slot]
    if (!loadoutRecord(item) || typeof item.key !== 'string' || !item.key || item.key.length > 240) continue
    if (typeof item.tier !== 'number' || !Number.isFinite(item.tier) || item.tier < 0 || item.tier > 100) continue
    out[slot] = { key: item.key, tier: item.tier }
  }
  return out
}
function readLoadout(raw: unknown, fallback: CharacterLoadout): CharacterLoadout {
  if (!loadoutRecord(raw)) return fallback
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 60) : ''
  return { ...fallback, name: name || fallback.name, classes: loadoutClasses(raw.classes), plan: planItems(raw.plan),
    strategyId: typeof raw.strategyId === 'string' && /^s[1-5]$/.test(raw.strategyId) ? raw.strategyId : 's1',
    wishKeys: keys(raw.wishKeys), ...(validLoadoutCapture(raw.capture) ? { capture: raw.capture } : {}) }
}
export function normalizeLoadoutBook(raw: unknown): LoadoutBook {
  const out = emptyLoadoutBook()
  if (!loadoutRecord(raw) || raw.version !== 1) return out
  const entries: unknown[] = Array.isArray(raw.loadouts) ? raw.loadouts as unknown[] : []
  out.loadouts = out.loadouts.map((lo) => readLoadout(entries.find((v) => loadoutRecord(v) && v.id === lo.id), lo))
  out.strategies = normalizeBuildStrategies(raw.strategies)
  return out
}
export function applyLoadoutChange(book: LoadoutBook, change: unknown): LoadoutBook {
  if (!loadoutRecord(change)) throw new Error('Invalid loadout edit.')
  if (change.kind === 'strategy') {
    const nextStrategy = change.strategy
    if (!loadoutRecord(nextStrategy) || !book.strategies.some((s) => s.id === nextStrategy.id)) throw new Error('Unknown strategy.')
    return { ...book, strategies: normalizeBuildStrategies(book.strategies.map((s) => s.id === nextStrategy.id ? nextStrategy : s)) }
  }
  const index = book.loadouts.findIndex((lo) => lo.id === change.id)
  if (index < 0) throw new Error('Unknown loadout.')
  const old = book.loadouts[index]
  let next: CharacterLoadout
  switch (change.kind) {
    case 'edit': next = readLoadout({ ...old, ...change, capture: old.capture, plan: old.plan, wishKeys: old.wishKeys }, old); break
    case 'plan': next = { ...old, plan: planItems(change.plan) }; break
    case 'wish': next = { ...old, wishKeys: keys(change.wishKeys) }; break
    default: throw new Error('Unknown loadout edit.')
  }
  return { ...book, loadouts: book.loadouts.map((lo, i) => i === index ? next : lo) }
}
export function matchingLoadout(book: LoadoutBook, classes: readonly ClassAbbr[]): CharacterLoadout | null {
  if (classes.length === 0 || new Set(classes).size !== classes.length) return null
  const key = classes.slice().sort().join('/')
  const matches = book.loadouts.filter((lo) => lo.classes.slice().sort().join('/') === key)
  return matches.length === 1 ? matches[0] : null
}

export function loadoutWishlist<T extends { entries: { itemKey: string }[] }>(list: T, itemKeys: readonly string[] | null): T {
  return itemKeys === null ? list : { ...list, entries: list.entries.filter((entry) => itemKeys.includes(entry.itemKey)) }
}
