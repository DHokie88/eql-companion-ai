import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { GearColumn } from './gearColumns'
import { gearWidths, sanitizeGearWidths } from './gearColumnWidths'

const STORAGE_KEY = 'eq.gear.columnWidths'
function readWidths(): Record<string, number> {
  try {
    return sanitizeGearWidths(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'))
  } catch {
    return {}
  }
}

/** Pixel widths keep short stats compact; the item name alone receives spare space. */
export function useGearColumnWidths(columns: readonly GearColumn[], hasOwned: boolean) {
  const tableRef = useRef<HTMLTableElement>(null)
  const [available, setAvailable] = useState(0)
  const [saved, setSaved] = useState(readWidths)
  useLayoutEffect(() => {
    const parent = tableRef.current?.parentElement
    if (!parent) return
    const observer = new ResizeObserver(() => setAvailable(parent.clientWidth))
    setAvailable(parent.clientWidth)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])
  const { widths, total } = gearWidths(columns, hasOwned, available, saved)
  const resize = useCallback((key: string, width: number | null) => {
    setSaved((previous) => {
      const next = width === null
        ? Object.fromEntries(Object.entries(previous).filter(([column]) => column !== key))
        : { ...previous, [key]: Math.round(Math.max(64, Math.min(2400, width))) }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* session still works */ }
      return next
    })
  }, [])
  return { tableRef, widths, total, resize }
}
