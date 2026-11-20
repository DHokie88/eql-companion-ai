import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { SpellCompareMetric } from '@shared/spellCompareMetric'
import type { BrowseDisplayField, SpellColumnView } from './spellBrowseColumns'
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

const presetColumns: Presets = {
  direct: ['category', 'type', 'amount', 'mana', 'efficiency', 'rate', 'cast', 'recast', 'selected'],
  area: ['type', 'amount', 'mana', 'efficiency', 'rate', 'waves', 'targets', 'hits', 'selected'],
  dot: ['category', 'amount', 'mana', 'efficiency', 'rate', 'duration', 'ticks', 'selected'],
  healing: ['type', 'amount', 'mana', 'efficiency', 'rate', 'cast', 'ticks', 'selected'],
  buffs: ['description', 'category', 'mana', 'cast', 'recast', 'spa'],
  debuffs: ['description', 'type', 'mana', 'cast', 'recast', 'spa'],
  utility: ['description', 'category', 'type', 'mana', 'cast', 'recast', 'spa']
}

const commonLegacyColumns: BrowseDisplayField[] = ['rank', 'classes']
const progressionLegacyColumns: BrowseDisplayField[] = ['level', 'preview']
const compareLegacyColumns: BrowseDisplayField[] = ['remove', 'instant', 'perTick', 'scope', 'effects', 'effect-duration']
const legacyColumnsByView: Record<Exclude<SpellColumnView, 'presets'>, BrowseDisplayField[]> = {
  browse: commonLegacyColumns,
  progression: [...commonLegacyColumns, ...progressionLegacyColumns],
  'compare-hp': [...commonLegacyColumns, ...compareLegacyColumns],
  'compare-effects': [...commonLegacyColumns, ...compareLegacyColumns]
}
const legacyPresetColumns = [...commonLegacyColumns, ...progressionLegacyColumns, ...compareLegacyColumns]
function withLegacyColumns(columns: BrowseDisplayField[], legacy: BrowseDisplayField[]): BrowseDisplayField[] {
  return [...new Set([...legacy, ...columns])]
}
export const DEFAULT_SPELL_PRESETS: Presets = Object.fromEntries(SPELL_COLUMN_PRESETS.map(({ id }) =>
  [id, withLegacyColumns(presetColumns[id], legacyPresetColumns)])) as Presets

const LEGACY_STORAGE_KEY = 'eqo:spell-column-presets'
const STORAGE_KEY = 'eqo:spell-column-presets-v2'
const validColumns = new Set<string>(selectableBrowseColumns('damage', 'presets').map(({ field }) => field))
const listeners = new Set<() => void>()
let saved: Presets | undefined

function sanitizeColumns(value: unknown, fallback: BrowseDisplayField[]): BrowseDisplayField[] {
  if (!Array.isArray(value)) return fallback
  return [...new Set(value.filter((column): column is BrowseDisplayField => typeof column === 'string' && validColumns.has(column)))]
}

function getPresets(): Presets {
  if (saved) return saved
  try {
    const current = localStorage.getItem(STORAGE_KEY)
    const value: unknown = JSON.parse(current ?? localStorage.getItem(LEGACY_STORAGE_KEY) ?? '{}')
    const next = { ...DEFAULT_SPELL_PRESETS }
    if (value && typeof value === 'object') for (const { id } of SPELL_COLUMN_PRESETS) {
      const columns = sanitizeColumns((value as Record<string, unknown>)[id], next[id])
      next[id] = current === null ? withLegacyColumns(columns, legacyPresetColumns) : columns
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

type ManualColumns = { columns: BrowseDisplayField[] } | BrowseDisplayField[] | null
interface ColumnSelectionDefaults {
  view: Exclude<SpellColumnView, 'presets'>; baseline: BrowseDisplayField[]
  inferred: SpellColumnPreset | null; defaultPreset?: SpellColumnPreset
}

export function useSpellColumnSelection(key: string, { view, baseline, inferred, defaultPreset }: ColumnSelectionDefaults) {
  const presets = useSpellColumnPresets()
  const [manual, saveManual] = useSpellWorkspaceState<ManualColumns>(key, null)
  const [choice, setPreset] = useSpellWorkspaceState<ColumnPresetChoice | null>(`${key}-preset`, null)
  const preset = choice ?? (manual ? 'custom' : 'default')
  const resolved = preset === 'auto' ? inferred : preset === 'default' ? defaultPreset : preset
  const legacy = legacyColumnsByView[view]
  const manualColumns = useMemo(() => Array.isArray(manual)
    ? withLegacyColumns(sanitizeColumns(manual, baseline), legacy)
    : sanitizeColumns(manual?.columns, baseline), [manual, baseline, legacy])
  useEffect(() => {
    if (Array.isArray(manual)) saveManual({ columns: manualColumns })
  }, [manual, manualColumns, saveManual])
  const columns = resolved === 'custom' ? manualColumns : resolved ? presets[resolved] : baseline
  const setColumns = (next: BrowseDisplayField[]): void => {
    saveManual({ columns: sanitizeColumns(next, baseline) })
    setPreset('custom')
  }
  return { columns, setColumns, preset, setPreset }
}
