import type { SpellBrowseSort, SpellMetric, SpellSummary } from '@shared/spellLibrary'

export const BROWSE_EXTRA_COLUMNS: { field: SpellBrowseSort; label: string }[] = [
  { field: 'cast', label: 'Cast (s)' }, { field: 'recovery', label: 'Recovery (s)' }, { field: 'recast', label: 'Recast (s)' },
  { field: 'duration', label: 'Delivery (s)' }, { field: 'ticks', label: 'Ticks' }, { field: 'waves', label: 'Waves' },
  { field: 'targets', label: 'Targets' }, { field: 'hits', label: 'Hits' }
]

export type CategoryDisplay = 'both' | 'subcategory' | 'none'
export interface BrowseColumn { field: SpellBrowseSort; label: string }
export function browseColumnWidth(field: SpellBrowseSort): number {
  const widths: Partial<Record<SpellBrowseSort, number>> = { id: 76, name: 240, classes: 148, category: 130, subcategory: 105,
    type: 92, amount: 96, mana: 70, efficiency: 92, rate: 110, selected: 100, description: 300 }
  return widths[field] ?? 90
}
export const DEFAULT_BROWSE_COLUMNS: SpellBrowseSort[] = ['id', 'category', 'type', 'amount', 'mana', 'efficiency', 'rate', 'selected']
export function selectableBrowseColumns(metric: SpellMetric): BrowseColumn[] {
  const metricLabel = metric === 'damage' ? 'Damage' : 'Healing'
  return [
    { field: 'id', label: 'ID' }, { field: 'description', label: 'Description' }, { field: 'category', label: 'Category / subcategory' },
    { field: 'type', label: 'Type' }, { field: 'amount', label: metricLabel }, { field: 'mana', label: 'Mana' },
    { field: 'efficiency', label: `${metricLabel}/Mana` }, { field: 'rate', label: metric === 'damage' ? 'Modeled DPS' : 'Modeled HPS' },
    ...BROWSE_EXTRA_COLUMNS, { field: 'selected', label: 'Compare' }
  ]
}
export function browseColumns(metric: SpellMetric, display: CategoryDisplay, visible: SpellBrowseSort[], uniformType = false): BrowseColumn[] {
  const choices = selectableBrowseColumns(metric).filter((column) => visible.includes(column.field))
  const columns: BrowseColumn[] = [
    ...choices.filter((c) => c.field === 'id'), { field: 'name', label: 'Spell' }, { field: 'classes', label: 'Class/Level' }
  ]
  for (const column of choices.filter((c) => c.field !== 'id')) {
    if (column.field === 'category') {
      if (display !== 'none') columns.push({ field: display === 'both' ? 'category' : 'subcategory', label: display === 'both' ? 'Category' : 'Subcategory' })
    } else if (column.field !== 'type' || !uniformType) columns.push(column)
  }
  return columns
}
export function browseTimingValue(record: SpellSummary, field: SpellBrowseSort): number | null {
  const rawFields: Partial<Record<SpellBrowseSort, 'castMs' | 'recoveryMs' | 'recastMs'>> = { cast: 'castMs', recovery: 'recoveryMs', recast: 'recastMs' }
  const rawField = rawFields[field]
  if (rawField) return seconds(record[rawField])
  const calculation = record.calculations?.[0], analysis = calculation?.analysis
  if (!analysis || !calculation) return null
  switch (field) {
    case 'rate': return analysis.timing.rate
    case 'duration': return seconds(analysis.timing.deliveryMs)
    case 'ticks': return calculation.ticks
    case 'waves': return analysis.waves
    case 'targets': return analysis.effectiveTargets
    case 'hits': return analysis.hits
    default: return null
  }
}
function seconds(value: number | null | undefined): number | null { return value === undefined || value === null ? null : value / 1000 }
