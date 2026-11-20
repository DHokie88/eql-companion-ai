import type { SpellBrowseSort, SpellMetric, SpellSummary } from '@shared/spellLibrary'

export type BrowseDisplayField = SpellBrowseSort | 'rank' | 'spa'
  | 'preview' | 'remove' | 'instant' | 'perTick' | 'scope' | 'effects' | 'effect-duration'
export type SpellColumnView = 'browse' | 'progression' | 'compare-hp' | 'compare-effects' | 'presets'

export const BROWSE_EXTRA_COLUMNS: { field: BrowseDisplayField; label: string }[] = [
  { field: 'cast', label: 'Cast (s)' }, { field: 'recast', label: 'Recast (s)' }, { field: 'recovery', label: 'Global recovery (s)' },
  { field: 'duration', label: 'Delivery (s)' }, { field: 'ticks', label: 'Ticks' }, { field: 'waves', label: 'Waves' },
  { field: 'targets', label: 'Targets' }, { field: 'hits', label: 'Hits' }
]

export type CategoryDisplay = 'both' | 'subcategory' | 'none'
export interface BrowseColumn { field: BrowseDisplayField; label: string }
export function browseColumnWidth(field: BrowseDisplayField): number {
  const widths: Partial<Record<BrowseDisplayField, number>> = { id: 76, name: 220, rank: 108, classes: 148, category: 130, subcategory: 105,
    type: 92, amount: 96, mana: 70, efficiency: 92, rate: 110, selected: 100, description: 280, spa: 240 }
  return widths[field] ?? 90
}
export const DEFAULT_BROWSE_COLUMNS: BrowseDisplayField[] = ['id', 'rank', 'classes', 'category', 'type', 'amount', 'mana', 'efficiency', 'rate', 'recast', 'selected']
const identityColumns: BrowseColumn[] = [
  { field: 'rank', label: 'Rank' }, { field: 'classes', label: 'Class/Level' }
]
const progressionColumns: BrowseColumn[] = [{ field: 'level', label: 'Level' }, { field: 'preview', label: 'Preview' }]
const compareHpColumns: BrowseColumn[] = [
  { field: 'instant', label: 'Instant' }, { field: 'perTick', label: 'Per tick × ticks' }, { field: 'scope', label: 'Scope / exclusions' }
]
const compareEffectsColumns: BrowseColumn[] = [{ field: 'effects', label: 'Effects' }, { field: 'effect-duration', label: 'Effect duration' }]
const compareRemove: BrowseColumn = { field: 'remove', label: 'Remove' }
const hpOnly = new Set<BrowseDisplayField>(['amount', 'efficiency', 'rate', 'duration', 'ticks', 'waves', 'hits', 'targets'])

export function selectableBrowseColumns(metric: SpellMetric, view: SpellColumnView = 'browse'): BrowseColumn[] {
  const metricLabel = metric === 'damage' ? 'Damage' : 'Healing'
  const common: BrowseColumn[] = [
    { field: 'id', label: 'ID' }, ...identityColumns, { field: 'description', label: 'Description' }, { field: 'category', label: 'Category / subcategory' },
    { field: 'type', label: 'Type' }, { field: 'amount', label: metricLabel }, { field: 'mana', label: 'Mana' },
    { field: 'efficiency', label: `${metricLabel}/Mana` }, { field: 'rate', label: metric === 'damage' ? 'Modeled DPS' : 'Modeled HPS' },
    ...BROWSE_EXTRA_COLUMNS, { field: 'spa', label: 'SPA' }
  ]
  const selectable: BrowseColumn[] = [...common, { field: 'selected', label: 'Compare' }]
  if (view === 'browse') return selectable
  if (view === 'progression') return [...progressionColumns, ...selectable]
  if (view === 'compare-hp') return [compareRemove, ...common, ...compareHpColumns, compareEffectsColumns[0]]
  if (view === 'compare-effects') return [compareRemove, ...common.filter(({ field }) => !hpOnly.has(field)), ...compareEffectsColumns]
  return [...selectable, ...progressionColumns, compareRemove, ...compareHpColumns, ...compareEffectsColumns]
}
/** Type leaves the table only while an explicit type filter makes every displayed label the same. Column prefs stay put. */
export function hideUniformTypeColumn(explicitType: string, labels: readonly string[] | undefined): boolean {
  if (!explicitType) return false
  return new Set((labels ?? []).filter(Boolean)).size <= 1
}
export function browseColumns(
  metric: SpellMetric, display: CategoryDisplay, visible: BrowseDisplayField[],
  { uniformType = false, view = 'browse' }: { uniformType?: boolean; view?: 'browse' | 'progression' } = {}
): BrowseColumn[] {
  const choices = selectableBrowseColumns(metric, view).filter(({ field }) => visible.includes(field))
  const beforeName = new Set<BrowseDisplayField>(['level', 'id'])
  const columns: BrowseColumn[] = [...choices.filter(({ field }) => beforeName.has(field)), { field: 'name', label: 'Spell' }]
  for (const column of choices) {
    if (beforeName.has(column.field) || column.field === 'preview') continue
    const shown = visibleBrowseColumn(column, display, uniformType)
    if (shown) columns.push(shown)
  }
  const preview = choices.find(({ field }) => field === 'preview')
  if (preview) columns.push(preview)
  return columns
}

function visibleBrowseColumn(column: BrowseColumn, display: CategoryDisplay, uniformType: boolean): BrowseColumn | null {
  if (column.field === 'type' && uniformType) return null
  if (column.field !== 'category') return column
  if (display === 'none') return null
  return display === 'both' ? { field: 'category', label: 'Category' } : { field: 'subcategory', label: 'Subcategory' }
}

function analysisTiming(record: SpellSummary, field: BrowseDisplayField): number | null {
  const calculation = record.calculations?.[0], analysis = calculation?.analysis
  if (!analysis || !calculation) return null
  if (field === 'rate') return analysis.timing.rate
  if (field === 'duration') return seconds(analysis.timing.deliveryMs)
  if (field === 'ticks') return calculation.ticks
  if (field === 'waves') return analysis.waves
  if (field === 'targets') return analysis.effectiveTargets
  if (field === 'hits') return analysis.hits
  return null
}
export function browseTimingValue(record: SpellSummary, field: BrowseDisplayField): number | null {
  const rawFields: Partial<Record<BrowseDisplayField, 'castMs' | 'recoveryMs' | 'recastMs'>> = { cast: 'castMs', recovery: 'recoveryMs', recast: 'recastMs' }
  const rawField = rawFields[field]
  if (rawField) return seconds(evaluatedTiming(record)[rawField])
  return analysisTiming(record, field)
}
function seconds(value: number | null | undefined): number | null { return value === undefined || value === null ? null : value / 1000 }
function evaluatedTiming(record: SpellSummary) { return record.calculations?.[0]?.analysis?.timing ?? record }
