import type { JSX } from 'react'
import { Box, Button, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import type { SpellBrowseSort, SpellMetric, SpellSummary } from '@shared/spellLibrary'
import { amount, EstimateAmount } from './SpellEstimate'
import { SpellNameButton, SpellSortHeader, type useSpellSort } from './SpellTableControls'
import { SpellRowRank } from './SpellRowRank'
import { SpellCastSummary } from './SpellCastSummary'
import { BROWSE_EXTRA_COLUMNS, browseColumns, browseTimingValue, type CategoryDisplay } from './spellBrowseColumns'

function CalculationCells({ record }: { record: SpellSummary }): JSX.Element {
  const calculation = record.calculations?.[0]
  return <><TableCell align="center">{calculation ? <><EstimateAmount calculation={calculation} /><SpellCastSummary calculation={calculation} /></> : '-'}</TableCell>
    <TableCell align="center">{record.mana}</TableCell><TableCell align="center">{record.mana === 0 ? 'Zero mana' : calculation ? amount(calculation.perMana) : '-'}</TableCell>
    <TableCell align="center">{amount(browseTimingValue(record, 'rate'))}</TableCell></>
}

function CategoryCell({ record, display }: { record: SpellSummary; display: CategoryDisplay }): JSX.Element | null {
  if (display === 'none') return null
  if (display === 'subcategory') return <TableCell align="center">{record.subcategory || '-'}</TableCell>
  return <TableCell align="center">{record.category || 'Uncategorized'}{record.subcategory && <Typography variant="caption" display="block" color="text.secondary">{record.subcategory}</Typography>}</TableCell>
}

export function SpellBrowseTable({ records, selected, sort, filters, metric = 'damage', columns = [], onOpen, onToggle }: {
  records: SpellSummary[]; selected: number[]; sort: ReturnType<typeof useSpellSort<SpellBrowseSort>>
  filters?: { category: string; subcategory: string }
  metric?: SpellMetric; columns?: SpellBrowseSort[]
  onOpen: (id: number) => void; onToggle: (id: number) => void
}): JSX.Element {
  const categoryDisplay = !filters?.category ? 'both' : filters.subcategory ? 'none' : 'subcategory'
  const extras = BROWSE_EXTRA_COLUMNS.filter((column) => columns.includes(column.field))
  return <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Spell catalog" sx={{ '& .MuiTableCell-root': { px: 1 }, '& .MuiTableCell-root:nth-of-type(n+3)': { textAlign: 'center' } }}><TableHead><TableRow>
    {browseColumns(metric, categoryDisplay, columns).map((column, index) => <SpellSortHeader key={column.field} {...column} sort={sort} align={index > 1 ? 'center' : 'left'} />)}
  </TableRow></TableHead><TableBody>{records.map((record) => <TableRow key={record.id} hover data-testid="spells-record">
    <TableCell>{record.id}</TableCell><TableCell sx={{ minWidth: 190, maxWidth: 280 }}><SpellNameButton id={record.id} onOpen={onOpen}>{record.name}</SpellNameButton><SpellRowRank id={record.id} name={record.name} evidence={record.rankEvidence} /></TableCell>
    <TableCell align="center">{record.learnedLevel ?? '-'}</TableCell><TableCell align="center" sx={{ minWidth: 120 }}>{record.classes.length ? record.classes.map((c) => `${c.code} ${c.level}`).join(' · ') : 'Internal / NPC'}</TableCell>
    <CategoryCell record={record} display={categoryDisplay} />
    <TableCell sx={{ whiteSpace: 'nowrap' }}>{record.typeLabel ?? record.spellType?.toUpperCase() ?? '-'}</TableCell>
    <CalculationCells record={record} />
    {extras.map((column) => <TableCell key={column.field} align="center">{amount(browseTimingValue(record, column.field))}</TableCell>)}
    <TableCell><Button size="small" variant={selected.includes(record.id) ? 'contained' : 'outlined'} disabled={!selected.includes(record.id) && selected.length >= 4} onClick={() => onToggle(record.id)} data-testid={`spells-compare-${record.id}`}>{selected.includes(record.id) ? 'Selected' : 'Add'}</Button></TableCell>
  </TableRow>)}</TableBody></Table></Box>
}
