import { type JSX, useRef } from 'react'
import { Box } from '@mui/material'

/** Pointer capture keeps a drag working outside the header without global listeners. */
export default function GearColumnResize({ column, label, width, onResize }: {
  column: string
  label: string
  width: number
  onResize: (key: string, width: number | null) => void
}): JSX.Element {
  const drag = useRef<{ x: number; width: number } | null>(null)
  return (
    <Box
      role="separator"
      aria-label={`Resize ${label} column`}
      aria-orientation="vertical"
      aria-valuenow={Math.round(width)}
      aria-valuemin={64}
      aria-valuemax={2400}
      tabIndex={0}
      data-testid={`gear-resize-${column}`}
      title="Drag to resize, double-click to reset"
      onDoubleClick={() => onResize(column, null)}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        drag.current = { x: event.clientX, width }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (drag.current) onResize(column, drag.current.width + event.clientX - drag.current.x)
      }}
      onPointerUp={(event) => {
        drag.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onLostPointerCapture={() => { drag.current = null }}
      onPointerCancel={() => { drag.current = null }}
      onKeyDown={(event) => {
        if (event.key === 'Home') {
          event.preventDefault()
          onResize(column, null)
          return
        }
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        event.stopPropagation()
        onResize(column, width + (event.key === 'ArrowRight' ? 16 : -16))
      }}
      sx={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 8,
        cursor: 'col-resize', touchAction: 'none', userSelect: 'none', zIndex: 1,
        borderRight: '2px solid', borderColor: 'divider',
        '&:hover, &:focus-visible': { borderColor: 'primary.main', outline: 0 }
      }}
    />
  )
}
