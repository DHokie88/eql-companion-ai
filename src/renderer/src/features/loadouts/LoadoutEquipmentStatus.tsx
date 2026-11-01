import type { JSX } from 'react'
import { Alert, Typography } from '@mui/material'
import { useLoadouts } from './useLoadouts'
export function LoadoutEquipmentStatus(): JSX.Element | null {
  const { selected, live } = useLoadouts()
  if (!selected) return null
  const capture = selected.capture
  if (!capture) return <Typography variant="caption" color="text.secondary" data-testid="loadout-no-capture">
    {selected.id === live?.id ? 'Current equipment is shown. Save current equipment to retain it for this loadout.' : 'No equipment saved for this loadout. Switch to it in EQL, use /who and /outputfile inventory, then Save current equipment.'}
  </Typography>
  if (capture.classes.slice().sort().join('/') !== selected.classes.slice().sort().join('/')) {
    return <Alert severity="warning">This saved equipment was captured for {capture.classes.join(' / ')}. The loadout classes have since changed; save a new export when that loadout is active.</Alert>
  }
  return <Typography variant="caption" color="text.secondary">Saved actual equipment. Build plans do not change this snapshot. Inventory and bank below are shared for this character.</Typography>
}
