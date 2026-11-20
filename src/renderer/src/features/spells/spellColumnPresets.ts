import { useSyncExternalStore } from 'react'
import type { SpellCompareMetric } from '@shared/spellCompareMetric'
import type { BrowseDisplayField } from './spellBrowseColumns'
import { selectableBrowseColumns } from './spellBrowseColumns'
import { useSpellWorkspaceState } from './spellWorkspace'

export const SPELL_COLUMN_PRESETS = [
  { id: 'direct', label: 'Direct damage' },
  { id: 'area', label: 'Rain / area damage' },
  { id: 'dot', label: 'Damage over time' },
  { id: 'healing', label: 'Healing' },
  { id: 'buffs', label: 'Buffs' },
  { id: 'debuffs', label: 'Debuffs' },
  { id: 'utility', label: 'Utility' }
] as const
export type SpellColumnPreset = typeof SPELL_COLUMN_PRESETS[number]['id']
export type ColumnPresetChoice = SpellColumnPreset | 'auto' | 'default' | 'custom'
type Presets = Record<SpellColumnPreset, BrowseDisplayField[]>

export const DEFAULT_SPELL_PRESETS: Presets = {
  direct: ['category', 'type', 'amount', 'mana', 'efficiency', 'rate', 'cast', 'recast', 'selected'],
  area: ['type', 'amount', 'mana', 'efficiency', 'rate', 'waves', 'targets', 'hits', 'selected'],
  dot: ['category', 'amount', 'mana', 'efficiency', 'rate', 'duration', 'ticks', 'selected'],
  healing: ['type', 'amount', 'mana', 'efficiency', 'rate', 'cast', 'ticks', 'selected'],
  buffs: ['description', 'category', 'mana', 'cast', 'recast', 'spa'],
  debuffs: ['description', 'type', 'mana', 'cast', 'recast', 'spa'],
  utility: ['description', 'category', 'type', 'mana', 'cast', 'recast', 'spa']
}

const STORAGE_KEY = 'eqo:spell-column-presets'
const validColumns = new Set<string>(selectableBrowseColumns('damage').map(({ field }) => field))
const listeners = new Set<() => void>()
let saved: Presets | undefined

function sanitizeColumns(value: unknown, fallback: BrowseDisplayField[]): BrowseDisplayField[] {
  if (!Array.isArray(value)) return fallback
  return [...new Set(value.filter((column): column is BrowseDisplayField => typeof column === 'string' && validColumns.has(column)))]
}

function getPresets(): Presets {
  if (saved) return saved
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    const next = { ...DEFAULT_SPELL_PRESETS }
    if (value && typeof value === 'object') for (const { id } of SPELL_COLUMN_PRESETS) {
      next[id] = sanitizeColumns((value as Record<string, unknown>)[id], next[id])
    }
    saved = next
  } catch { saved = DEFAULT_SPELL_PRESETS }
  return saved
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function useSpellColumnPresets(): Presets {
  return useSyncExternalStore(subscribe, getPresets)
}
export function saveSpellColumnPreset(preset: SpellColumnPreset, columns: BrowseDisplayField[]): void {
  saved = { ...getPresets(), [preset]: sanitizeColumns(columns, DEFAULT_SPELL_PRESETS[preset]) }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)) } catch { /* Retain choices for this session. */ }
  for (const listener of listeners) listener()
}

const typePresets: Readonly<Record<string, SpellColumnPreset>> = {
  dd: 'direct', rain: 'area', aoe: 'area', dot: 'dot', heal: 'healing', hot: 'healing'
}
export function filterColumnPreset({ type, hpFilter, polarity }: { type: string; hpFilter: string; polarity: string }): SpellColumnPreset | null {
  if (type === 'other') return polarity === 'detrimental' ? 'debuffs' : polarity === 'beneficial' ? 'buffs' : 'utility'
  if (type.startsWith('aoe')) return 'area'
  return typePresets[type] ?? typePresets[hpFilter === 'healing' ? 'heal' : hpFilter === 'damage' ? 'dd' : ''] ?? null
}
export function compareColumnPreset(metric: SpellCompareMetric): SpellColumnPreset {
  return metric === 'damage' ? 'direct' : metric
}

export function useSpellColumnSelection(key: string, baseline: BrowseDisplayField[], inferred: SpellColumnPreset | null, defaultPreset?: SpellColumnPreset) {
  const presets = useSpellColumnPresets()
  const [manual, saveManual] = useSpellWorkspaceState<BrowseDisplayField[] | null>(key, null)
  const [choice, setPreset] = useSpellWorkspaceState<ColumnPresetChoice | null>(`${key}-preset`, null)
  const preset = choice ?? (manual ? 'custom' : 'default')
  const resolved = preset === 'auto' ? inferred : preset === 'default' ? defaultPreset : preset
  const columns = resolved === 'custom' ? manual ?? baseline : resolved ? presets[resolved] : baseline
  const setColumns = (next: BrowseDisplayField[]): void => { saveManual(next); setPreset('custom') }
  return { columns, setColumns, preset, setPreset }
}
