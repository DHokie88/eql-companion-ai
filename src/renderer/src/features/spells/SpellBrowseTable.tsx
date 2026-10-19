import type { JSX } from 'react'
import { Box, Button, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { SPELL_TYPE_LABELS } from '@shared/clientSpellBrowse'
import type { SpellBrowseSort, SpellSummary } from '@shared/spellLibrary'
import { amount, EstimateAmount } from './SpellEstimate'
import { SpellNameButton, SpellSortHeader, type useSpellSort } from './SpellTableControls'
import { SpellRowRank } from './SpellRowRank'

const COLUMNS: { field: SpellBrowseSort; label: string; numeric?: boolean }[] = [
  { field: 'id', label: 'ID' }, { field: 'name', label: 'Spell' }, { field: 'level', label: 'Level', numeric: true },
  { field: 'classes', label: 'Client classes / levels' }, { field: 'category', label: 'Category' }, { field: 'type', label: 'Type' },
  { field: 'amount', label: 'HP amount / target', numeric: true }, { field: 'mana', label: 'Client mana', numeric: true },
  { field: 'efficiency', label: 'Amount / client mana', numeric: true }, { field: 'selected', label: 'Compare' }
]

function CalculationCells({ record }: { record: SpellSummary }): JSX.Element {
  const calculation = record.calculations?.[0]
  return <><TableCell align="right">{calculation ? <><Typography variant="caption">{calculation.metric}</Typography><EstimateAmount calculation={calculation} /></> : '-'}</TableCell>
    <TableCell align="right">{record.mana}</TableCell><TableCell align="right">{record.mana === 0 ? 'Zero mana' : calculation ? amount(calculation.perMana) : '-'}</TableCell></>
}

export function SpellBrowseTable({ records, selected, sort, onOpen, onToggle }: {
  records: SpellSummary[]; selected: number[]; sort: ReturnType<typeof useSpellSort<SpellBrowseSort>>
  onOpen: (id: number) => void; onToggle: (id: number) => void
}): JSX.Element {
  return <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Client spell records" sx={{ '& .MuiTableCell-root': { px: 1 } }}><TableHead><TableRow>
    {COLUMNS.map((column) => <SpellSortHeader key={column.field} {...column} sort={sort} />)}
  </TableRow></TableHead><TableBody>{records.map((record) => <TableRow key={record.id} hover data-testid="spells-record">
    <TableCell>{record.id}</TableCell><TableCell sx={{ minWidth: 190, maxWidth: 280 }}><SpellNameButton id={record.id} onOpen={onOpen}>{record.name}</SpellNameButton><SpellRowRank id={record.id} name={record.name} evidence={record.rankEvidence} /></TableCell>
    <TableCell align="right">{record.learnedLevel ?? '-'}</TableCell><TableCell sx={{ minWidth: 120 }}>{record.classes.length ? record.classes.map((c) => `${c.code} ${c.level}`).join(' · ') : 'Internal / NPC'}</TableCell>
    <TableCell>{record.category || 'Uncategorized'}{record.subcategory && <Typography variant="caption" display="block" color="text.secondary">{record.subcategory}</Typography>}</TableCell>
    <TableCell sx={{ whiteSpace: 'nowrap' }}>{record.spellType ? SPELL_TYPE_LABELS[record.spellType] : '-'}</TableCell>
    <CalculationCells record={record} />
    <TableCell><Button size="small" variant={selected.includes(record.id) ? 'contained' : 'outlined'} disabled={!selected.includes(record.id) && selected.length >= 4} onClick={() => onToggle(record.id)} data-testid={`spells-compare-${record.id}`}>{selected.includes(record.id) ? 'Selected' : 'Add'}</Button></TableCell>
  </TableRow>)}</TableBody></Table></Box>
}
