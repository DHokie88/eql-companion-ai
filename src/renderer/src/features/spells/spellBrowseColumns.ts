import type { SpellBrowseSort, SpellMetric, SpellSummary } from '@shared/spellLibrary'

export const BROWSE_EXTRA_COLUMNS: { field: SpellBrowseSort; label: string }[] = [
  { field: 'cast', label: 'Cast (s)' }, { field: 'recovery', label: 'Recovery (s)' }, { field: 'recast', label: 'Recast (s)' },
  { field: 'duration', label: 'Delivery (s)' }, { field: 'ticks', label: 'Ticks' }, { field: 'waves', label: 'Waves' },
  { field: 'targets', label: 'Targets' }, { field: 'hits', label: 'Hits' }
]

export type CategoryDisplay = 'both' | 'subcategory' | 'none'
export interface BrowseColumn { field: SpellBrowseSort; label: string }
export function browseColumns(metric: SpellMetric, display: CategoryDisplay, optional: SpellBrowseSort[]): BrowseColumn[] {
  const metricLabel = metric === 'damage' ? 'Damage' : 'Healing'
  const columns: BrowseColumn[] = [
    { field: 'id', label: 'ID' }, { field: 'name', label: 'Spell' }, { field: 'level', label: 'Level' },
    { field: 'classes', label: 'Class/Level' }
  ]
  if (display !== 'none') columns.push({ field: display === 'both' ? 'category' : 'subcategory', label: display === 'both' ? 'Category' : 'Subcategory' })
  return [...columns, { field: 'type', label: 'Type' }, { field: 'amount', label: metricLabel }, { field: 'mana', label: 'Mana' },
    { field: 'efficiency', label: `${metricLabel}/Mana` }, { field: 'rate', label: metric === 'damage' ? 'Modeled DPS' : 'Modeled HPS' },
    ...BROWSE_EXTRA_COLUMNS.filter((column) => optional.includes(column.field)), { field: 'selected', label: 'Compare' }]
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
