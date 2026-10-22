import type { JSX } from 'react'
import { CircularProgress, Paper, Typography } from '@mui/material'

/** Keep the dashboard in place while a same-world read is catching up. */
export default function UpdatingBadge({ show }: { show: boolean }): JSX.Element | null {
  if (!show) return null
  return (
    <Paper variant="outlined" role="status" data-testid="combat-updating"
      sx={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', zIndex: 2,
        px: 1, py: 0.25, display: 'flex', alignItems: 'center', gap: 0.75, pointerEvents: 'none' }}>
      <CircularProgress size={10} thickness={6} />
      <Typography variant="caption" color="text.secondary">Updating…</Typography>
    </Paper>
  )
}
