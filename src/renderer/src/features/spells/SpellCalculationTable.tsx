import type { JSX } from 'react'
import { Box, Button, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import type { SpellCalculation } from '@shared/spellLibrary'
import { sortSpellCalculations, type SpellCalculationSort } from '@shared/clientSpellBrowse'
import { amount, EstimateAmount, EstimateExplanation } from './SpellEstimate'
import { SpellNameButton, SpellSortHeader, useSpellSort } from './SpellTableControls'

const COLUMNS: { field: SpellCalculationSort; label: string; numeric?: boolean }[] = [
  { field: 'name', label: 'Spell' }, { field: 'instant', label: 'Instant', numeric: true }, { field: 'perTick', label: 'Per tick × ticks', numeric: true },
  { field: 'total', label: 'Full amount / target', numeric: true }, { field: 'mana', label: 'Client mana', numeric: true },
  { field: 'perMana', label: 'Amount / client mana', numeric: true }, { field: 'scope', label: 'Scope / exclusions' }
]
export function SpellCalculationTable({ rows, onOpen, onRemove }: {
  rows: SpellCalculation[]; onOpen: (id: number) => void; onRemove?: (id: number) => void
}): JSX.Element {
  const sort = useSpellSort<SpellCalculationSort>('total', 'desc')
  const sorted = sortSpellCalculations(rows, sort.field, sort.direction)
  return <Box sx={{ overflowX: 'auto' }}><Table size="small" sx={{ '& .MuiTableCell-root': { px: 1 } }}><TableHead><TableRow>
    {COLUMNS.map((column) => <SpellSortHeader key={column.field} {...column} sort={sort} />)}{onRemove && <TableCell />}
  </TableRow></TableHead><TableBody>{sorted.map((row) => <TableRow key={row.id} data-testid="spells-calculation">
    <TableCell sx={{ minWidth: 190 }}><SpellNameButton id={row.id} onOpen={onOpen}>{row.name}</SpellNameButton><Typography variant="caption" display="block">ID {row.id} · target {row.target}</Typography></TableCell>
    <TableCell align="right">{amount(row.instant)}</TableCell><TableCell align="right">{row.perTick === null ? '-' : `${amount(row.perTick)} × ${row.ticks ?? '?'}`}</TableCell>
    <TableCell align="right"><EstimateAmount calculation={row} /></TableCell><TableCell align="right">{row.mana}</TableCell>
    <TableCell align="right">{row.mana === 0 ? 'Zero mana' : amount(row.perMana)}</TableCell><TableCell sx={{ minWidth: 180 }}><EstimateExplanation calculation={row} /></TableCell>
    {onRemove && <TableCell><Button size="small" onClick={() => onRemove(row.id)}>Remove</Button></TableCell>}
  </TableRow>)}</TableBody></Table></Box>
}
