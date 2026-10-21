import { gearTableLayout, PICKABLE_COLUMNS, type GearColumn } from './gearColumns'

const KNOWN = new Set<string>(['name', 'slot', 'classes', 'owned', ...PICKABLE_COLUMNS])

export function sanitizeGearWidths(value: unknown): Record<string, number> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([key, width]) =>
    KNOWN.has(key) && typeof width === 'number' && Number.isFinite(width) && width >= 64 && width <= 2400
  ))
}

/** Explicit pixel widths. Only an uncustomized Item column absorbs spare room. */
export function gearWidths(columns: readonly GearColumn[], hasOwned: boolean, available: number, saved: Readonly<Record<string, number>>) {
  const layout = gearTableLayout(columns.length, hasOwned)
  const defaults: Record<string, number> = {
    name: Number.parseFloat(layout.name), slot: Number.parseFloat(layout.slot),
    classes: Number.parseFloat(layout.classes), owned: Number.parseFloat(layout.owned)
  }
  for (const column of columns) defaults[column.key] = Math.max(88, column.label.length * 7 + 44)
  const keys = ['name', 'slot', 'classes', ...columns.map((c) => c.key), ...(hasOwned ? ['owned'] : [])]
  const widths = Object.fromEntries(keys.map((key) => [key, saved[key] ?? defaults[key]]))
  const otherWidth = keys.slice(1).reduce((sum, key) => sum + widths[key], 0)
  if (saved.name === undefined) widths.name = Math.max(defaults.name, available - otherWidth)
  return { widths, total: keys.reduce((sum, key) => sum + widths[key], 0) }
}
