import { resizeFraction } from '../../../../shared/worth'
import { gearTableLayout, PICKABLE_COLUMNS, type GearColumn } from './gearColumns'

/** Drag a column. The track is the widest a column may be, and the pane cannot shrink past `minWidth`. */
export function resizedColumnWidth(width: number, deltaPx: number, minWidth: number, maxWidth = 2400): number {
  if (!(maxWidth > 0)) return Math.max(minWidth, width)
  const next = resizeFraction(width / maxWidth, deltaPx, maxWidth, minWidth) * maxWidth
  return Math.round(Math.min(maxWidth, Math.max(minWidth, next)))
}

export const GEAR_ITEM_TIER_MIN_WIDTH = 220

const WEAPON_WIDTHS: Readonly<Record<string, number>> = { HAND: 108, WEAPON_TYPE: 128, PROC: 172 }

const KNOWN = new Set<string>(['name', 'actions', 'SCORE', 'slot', 'classes', 'owned', ...PICKABLE_COLUMNS])

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
    name: Number.parseFloat(layout.name), actions: Number.parseFloat(layout.actions), slot: Number.parseFloat(layout.slot),
    classes: Number.parseFloat(layout.classes), owned: Number.parseFloat(layout.owned)
  }
  for (const column of columns) defaults[column.key] = WEAPON_WIDTHS[column.key] ?? Math.max(64, column.label.length * 6 + 40)
  const keys = ['name', 'actions', 'slot', 'classes', ...columns.map((c) => c.key), ...(hasOwned ? ['owned'] : [])]
  const widths = Object.fromEntries(keys.map((key) => [key, saved[key] ?? defaults[key]]))
  const otherWidth = keys.slice(1).reduce((sum, key) => sum + widths[key], 0)
  if (saved.name === undefined) widths.name = Math.max(defaults.name, available - otherWidth)
  return { widths, total: keys.reduce((sum, key) => sum + widths[key], 0) }
}

/** A visible tier label needs room beside the item name without changing its saved width. */
export function withTierLabelMinimum(layout: ReturnType<typeof gearWidths>, showTierLabels: boolean): ReturnType<typeof gearWidths> {
  if (!showTierLabels || layout.widths.name >= GEAR_ITEM_TIER_MIN_WIDTH) return layout
  const name = GEAR_ITEM_TIER_MIN_WIDTH
  return { widths: { ...layout.widths, name }, total: layout.total + name - layout.widths.name }
}
