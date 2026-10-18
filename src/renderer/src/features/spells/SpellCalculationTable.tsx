import type { JSX } from 'react'
import { Box, Button, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import type { SpellCalculation } from '@shared/spellLibrary'
import { sortSpellCalculations, type SpellCalculationSort } from '@shared/clientSpellBrowse'
import { amount, EstimateAmount } from './SpellEstimate'
import { SpellAnalysisBreakdown } from './SpellAnalysisBreakdown'
import { spellComparisonDifferences, type SpellDifference } from '@shared/spellAnalysisPresentation'
import { SpellNameButton, SpellSortHeader, useSpellSort } from './SpellTableControls'

const COLUMNS: { field: SpellCalculationSort; label: string; numeric?: boolean }[] = [
  { field: 'name', label: 'Spell' }, { field: 'instant', label: 'Instant', numeric: true }, { field: 'perTick', label: 'Per tick × ticks', numeric: true },
  { field: 'total', label: 'Full amount', numeric: true }, { field: 'mana', label: 'Client mana', numeric: true },
  { field: 'perMana', label: 'Amount / client mana', numeric: true }, { field: 'rate', label: 'Modeled cycle DPS/HPS', numeric: true }, { field: 'scope', label: 'Scope / exclusions' }
]
export function SpellCalculationTable({ rows, onOpen, onRemove, referenceId }: {
  rows: SpellCalculation[]; onOpen: (id: number) => void; onRemove?: (id: number) => void; referenceId?: number
}): JSX.Element {
  const sort = useSpellSort<SpellCalculationSort>('total', 'desc')
  const sorted = sortSpellCalculations(rows, sort.field, sort.direction)
  return <Box sx={{ overflowX: 'auto' }}><Table size="small" sx={{ '& .MuiTableCell-root': { px: 1 } }}><TableHead><TableRow>
    {COLUMNS.map((column) => <SpellSortHeader key={column.field} {...column} sort={sort} />)}{onRemove && <TableCell />}
  </TableRow></TableHead><TableBody>{sorted.map((row) => <CalculationRow key={row.id} row={row} onOpen={onOpen} onRemove={onRemove} reference={rows.find((r) => r.id === referenceId)} />)}</TableBody></Table></Box>
}
function CalculationRow({ row, onOpen, onRemove, reference }: { row: SpellCalculation; onOpen: (id: number) => void; onRemove?: (id: number) => void; reference?: SpellCalculation }): JSX.Element {
  const differences = spellComparisonDifferences(row, reference)
  const showDifference = reference !== undefined && row.id !== reference.id
  return <TableRow data-testid="spells-calculation">
    <TableCell sx={{ minWidth: 190 }}><SpellNameButton id={row.id} onOpen={onOpen}>{row.name}</SpellNameButton><Typography variant="caption" display="block">ID {row.id} · target {row.target}</Typography></TableCell>
    <TableCell align="right">{amount(row.instant)}</TableCell><PeriodicCell row={row} />
    <TableCell align="right"><EstimateAmount calculation={row} />{showDifference && <Delta value={differences.amount} />}</TableCell><TableCell align="right">{row.mana}{showDifference && <Delta value={differences.mana} />}</TableCell>
    <TableCell align="right">{row.mana === 0 ? 'Zero mana' : amount(row.perMana)}{showDifference && <Delta value={differences.efficiency} />}</TableCell>
    <TableCell align="right">{amount(row.analysis?.timing.rate ?? null)}{showDifference && <Delta value={differences.rate} />}</TableCell>
    <TableCell sx={{ minWidth: 180 }}><Typography variant="caption">{row.analysis?.scope ?? 'One target'}</Typography><SpellAnalysisBreakdown calculation={row} /></TableCell>
    {onRemove && <TableCell><Button size="small" onClick={() => onRemove(row.id)}>Remove</Button></TableCell>}
  </TableRow>
}
function PeriodicCell({ row }: { row: SpellCalculation }): JSX.Element {
  return <TableCell align="right">{row.perTick === null ? '-' : `${amount(row.perTick)} × ${row.ticks ?? '?'}`}</TableCell>
}
function Delta({ value }: { value: SpellDifference }): JSX.Element {
  const absolute = value.absolute === null ? 'Unavailable' : `${value.absolute >= 0 ? '+' : ''}${amount(value.absolute)}`
  const percent = value.percent === null ? 'percentage unavailable' : `${value.percent >= 0 ? '+' : ''}${amount(value.percent)}%`
  return <Typography variant="caption" display="block" color="text.secondary" data-testid="comparison-delta">{absolute} ({percent}) vs reference</Typography>
}
