import type { JSX } from 'react'
import { Box, Button, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { SPELL_TYPE_LABELS } from '@shared/clientSpellBrowse'
import type { SpellBrowseSort, SpellSummary } from '@shared/spellLibrary'
import { amount, EstimateAmount } from './SpellEstimate'
import { SpellNameButton, SpellSortHeader, type useSpellSort } from './SpellTableControls'
import { SpellRowRank } from './SpellRowRank'
import { SpellCastSummary } from './SpellCastSummary'

const COLUMNS: { field: SpellBrowseSort; label: string }[] = [
  { field: 'id', label: 'ID' }, { field: 'name', label: 'Spell' }, { field: 'level', label: 'Level' },
  { field: 'classes', label: 'Client classes / levels' }, { field: 'category', label: 'Category' }, { field: 'type', label: 'Type' },
  { field: 'amount', label: 'HP amount / full cast' }, { field: 'mana', label: 'Client mana' },
  { field: 'efficiency', label: 'Amount / client mana' }, { field: 'selected', label: 'Compare' }
]

function CalculationCells({ record }: { record: SpellSummary }): JSX.Element {
  const calculation = record.calculations?.[0]
  return <><TableCell align="center">{calculation ? <><Typography variant="caption">{calculation.metric}</Typography><EstimateAmount calculation={calculation} /><SpellCastSummary calculation={calculation} /></> : '-'}</TableCell>
    <TableCell align="center">{record.mana}</TableCell><TableCell align="center">{record.mana === 0 ? 'Zero mana' : calculation ? amount(calculation.perMana) : '-'}</TableCell></>
}

type CategoryDisplay = 'both' | 'subcategory' | 'none'
function categoryColumns(display: CategoryDisplay): typeof COLUMNS {
  return COLUMNS.flatMap((column) => {
    if (column.field !== 'category') return [column]
    if (display === 'none') return []
    return [display === 'subcategory' ? { field: 'subcategory', label: 'Subcategory' } : column]
  })
}
function CategoryCell({ record, display }: { record: SpellSummary; display: CategoryDisplay }): JSX.Element | null {
  if (display === 'none') return null
  if (display === 'subcategory') return <TableCell align="center">{record.subcategory || '-'}</TableCell>
  return <TableCell align="center">{record.category || 'Uncategorized'}{record.subcategory && <Typography variant="caption" display="block" color="text.secondary">{record.subcategory}</Typography>}</TableCell>
}

export function SpellBrowseTable({ records, selected, sort, filters, onOpen, onToggle }: {
  records: SpellSummary[]; selected: number[]; sort: ReturnType<typeof useSpellSort<SpellBrowseSort>>
  filters?: { category: string; subcategory: string }
  onOpen: (id: number) => void; onToggle: (id: number) => void
}): JSX.Element {
  const categoryDisplay = !filters?.category ? 'both' : filters.subcategory ? 'none' : 'subcategory'
  return <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Client spell records" sx={{ '& .MuiTableCell-root': { px: 1 }, '& .MuiTableCell-root:nth-of-type(n+3)': { textAlign: 'center' } }}><TableHead><TableRow>
    {categoryColumns(categoryDisplay).map((column, index) => <SpellSortHeader key={column.field} {...column} sort={sort} align={index > 1 ? 'center' : 'left'} />)}
  </TableRow></TableHead><TableBody>{records.map((record) => <TableRow key={record.id} hover data-testid="spells-record">
    <TableCell>{record.id}</TableCell><TableCell sx={{ minWidth: 190, maxWidth: 280 }}><SpellNameButton id={record.id} onOpen={onOpen}>{record.name}</SpellNameButton><SpellRowRank id={record.id} name={record.name} evidence={record.rankEvidence} /></TableCell>
    <TableCell align="center">{record.learnedLevel ?? '-'}</TableCell><TableCell align="center" sx={{ minWidth: 120 }}>{record.classes.length ? record.classes.map((c) => `${c.code} ${c.level}`).join(' · ') : 'Internal / NPC'}</TableCell>
    <CategoryCell record={record} display={categoryDisplay} />
    <TableCell sx={{ whiteSpace: 'nowrap' }}>{record.spellType ? SPELL_TYPE_LABELS[record.spellType] : '-'}</TableCell>
    <CalculationCells record={record} />
    <TableCell><Button size="small" variant={selected.includes(record.id) ? 'contained' : 'outlined'} disabled={!selected.includes(record.id) && selected.length >= 4} onClick={() => onToggle(record.id)} data-testid={`spells-compare-${record.id}`}>{selected.includes(record.id) ? 'Selected' : 'Add'}</Button></TableCell>
  </TableRow>)}</TableBody></Table></Box>
}
