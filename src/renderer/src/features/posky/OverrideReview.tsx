import { useState, type JSX } from 'react'
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Table, TableBody, TableCell, TableHead, TableRow, Typography
} from '@mui/material'
import type { ItemCountOverride } from '@shared/types'
import type { InventoryRow } from '../inventory/reconcile'

/** Manual baselines survive new exports. Make that choice visible and reversible in one place. */
export default function OverrideReview({ overrides, inventoryRows, onClear, onClose }: {
  overrides: readonly ItemCountOverride[]
  inventoryRows: readonly InventoryRow[]
  onClear: (name: string) => Promise<void>
  onClose: () => void
}): JSX.Element {
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const clear = async (o: ItemCountOverride): Promise<void> => {
    setPending(o.key)
    setError(null)
    try {
      await onClear(o.name)
    } catch {
      setError(`Could not restore automatic counting for ${o.name}. Try again.`)
    } finally {
      setPending(null)
    }
  }
  return (
    <Dialog open onClose={pending ? undefined : onClose} maxWidth="md" fullWidth data-testid="posky-override-review">
      <DialogTitle>Review manual item counts</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          Manual counts take priority even after refreshing inventory. Loot and turn-ins since each
          correction still change its count. Use automatic counting to let your selected log and
          inventory sources answer for that item again.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Export counts are from the last loaded file. Not listed can mean the storage was closed;
          Wind Runes are not included in inventory exports.
        </Typography>
        {error && <Alert severity="error" role="alert">{error}</Alert>}
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Item / correction date</TableCell>
            <TableCell align="right">Manual baseline</TableCell>
            <TableCell align="right">Held now</TableCell>
            <TableCell align="right">In export</TableCell>
            <TableCell />
          </TableRow></TableHead>
          <TableBody>{overrides.map((o) => {
            const row = inventoryRows.find((r) => r.key === o.key)
            return (
              <TableRow key={o.key} data-testid="posky-override-review-row" data-item={o.key}>
                <TableCell>{o.name}<Typography variant="caption" display="block" color="text.secondary">
                  {o.setAt > 0 ? new Date(o.setAt).toLocaleString() : 'Unknown date'}
                </Typography></TableCell>
                <TableCell align="right">{o.count}</TableCell>
                <TableCell align="right">{row?.net ?? 'Unknown'}</TableCell>
                <TableCell align="right">{row && row.inv > 0 ? row.inv : 'Not listed'}</TableCell>
                <TableCell><Button size="small" disabled={pending !== null}
                  data-testid="posky-override-use-automatic" onClick={() => void clear(o)}>
                  Use automatic count
                </Button></TableCell>
              </TableRow>
            )
          })}</TableBody>
        </Table>
      </DialogContent>
      <DialogActions><Button onClick={onClose} disabled={pending !== null}>Done</Button></DialogActions>
    </Dialog>
  )
}
