import type { SpellBrowseSort, SpellMetric, SpellSummary } from '@shared/spellLibrary'

export type BrowseDisplayField = SpellBrowseSort | 'rank' | 'spa' | 'era'

export const BROWSE_EXTRA_COLUMNS: { field: BrowseDisplayField; label: string }[] = [
  { field: 'cast', label: 'Cast (s)' }, { field: 'recovery', label: 'Recovery (s)' }, { field: 'recast', label: 'Recast (s)' },
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
export const DEFAULT_BROWSE_COLUMNS: SpellBrowseSort[] = ['id', 'category', 'type', 'amount', 'mana', 'efficiency', 'rate', 'selected']
export function selectableBrowseColumns(metric: SpellMetric): BrowseColumn[] {
  const metricLabel = metric === 'damage' ? 'Damage' : 'Healing'
  return [
    { field: 'id', label: 'ID' }, { field: 'era', label: 'Era' }, { field: 'description', label: 'Description' }, { field: 'category', label: 'Category / subcategory' },
    { field: 'type', label: 'Type' }, { field: 'amount', label: metricLabel }, { field: 'mana', label: 'Mana' },
    { field: 'efficiency', label: `${metricLabel}/Mana` }, { field: 'rate', label: metric === 'damage' ? 'Modeled DPS' : 'Modeled HPS' },
    ...BROWSE_EXTRA_COLUMNS, { field: 'spa', label: 'SPA' }, { field: 'selected', label: 'Compare' }
  ]
}
/** Type leaves the table only while an explicit type filter makes every displayed label the same. Column prefs stay put. */
export function hideUniformTypeColumn(explicitType: string, labels: readonly string[] | undefined): boolean {
  if (!explicitType) return false
  return new Set((labels ?? []).filter(Boolean)).size <= 1
}
export function browseColumns(metric: SpellMetric, display: CategoryDisplay, visible: BrowseDisplayField[], uniformType = false): BrowseColumn[] {
  const choices = selectableBrowseColumns(metric).filter((column) => visible.includes(column.field))
  const columns: BrowseColumn[] = [
    ...choices.filter((c) => c.field === 'id'), { field: 'name', label: 'Spell' }, { field: 'rank', label: 'Rank' }, { field: 'classes', label: 'Class/Level' }
  ]
  for (const column of choices.filter((c) => c.field !== 'id')) {
    if (column.field === 'category') {
      if (display !== 'none') columns.push({ field: display === 'both' ? 'category' : 'subcategory', label: display === 'both' ? 'Category' : 'Subcategory' })
    } else if (column.field === 'spa') columns.push(column)
    else if (column.field !== 'type' || !uniformType) columns.push(column)
  }
  return columns
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
