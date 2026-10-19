import { type JSX, useState } from 'react'
import { Box, Button, Checkbox, FormControl, InputLabel, ListItemText, MenuItem, Select, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import type { SpellAnalysisSort, SpellRankingRow } from '@shared/spellAnalysis'
import { amount, EstimateAmount } from './SpellEstimate'
import { SpellNameButton, SpellSortHeader, type useSpellSort } from './SpellTableControls'
import { SpellAnalysisBreakdown } from './SpellAnalysisBreakdown'
import { useSpellWorkspaceState } from './spellWorkspace'
import { SpellRowRank } from './SpellRowRank'
import { SpellCastSummary } from './SpellCastSummary'

const BASIC: { field: SpellAnalysisSort; label: string }[] = [{ field: 'id', label: 'ID' }, { field: 'name', label: 'Spell' }, { field: 'level', label: 'Level' }, { field: 'amount', label: 'Full amount' }, { field: 'mana', label: 'Client mana' }, { field: 'efficiency', label: 'Amount / mana' }, { field: 'rate', label: 'Modeled cycle DPS/HPS' }]
const OPTIONAL: { field: SpellAnalysisSort; label: string }[] = [{ field: 'cast', label: 'Cast (s)' }, { field: 'recovery', label: 'Recovery (s)' }, { field: 'recast', label: 'Recast (s)' }, { field: 'duration', label: 'Delivery (s)' }, { field: 'ticks', label: 'Ticks' }, { field: 'waves', label: 'Waves' }, { field: 'targets', label: 'Targets' }, { field: 'hits', label: 'Hits' }]
function extraValue(row: SpellRankingRow, field: SpellAnalysisSort): number | null {
  const a = row.calculation.analysis
  if (!a) return null
  switch (field) {
    case 'cast': return a.timing.castMs / 1000
    case 'recovery': return a.timing.recoveryMs / 1000
    case 'recast': return a.timing.recastMs / 1000
    case 'duration': return a.timing.deliveryMs === null ? null : a.timing.deliveryMs / 1000
    case 'ticks': return row.calculation.ticks
    case 'waves': return a.waves
    case 'targets': return a.effectiveTargets
    case 'hits': return a.hits
    default: return null
  }
}
export function SpellRankingTable({ records, selected, sort, onOpen, onToggle }: {
  records: SpellRankingRow[]; selected: number[]; sort: ReturnType<typeof useSpellSort<SpellAnalysisSort>>; onOpen: (id: number, scope?: 'single' | 'pack') => void; onToggle: (id: number) => void
}): JSX.Element {
  const [columns, setColumns] = useSpellWorkspaceState<SpellAnalysisSort[]>('ranking-columns', [])
  const [expanded, setExpanded] = useState<number | null>(null)
  const extras = OPTIONAL.filter((c) => columns.includes(c.field))
  return <>
    <FormControl size="small" sx={{ width: 210 }}><InputLabel id="ranking-columns-label">Additional columns</InputLabel><Select multiple labelId="ranking-columns-label" label="Additional columns" value={columns} renderValue={(values) => `${values.length} selected`} data-testid="rankings-columns" onChange={(e) => setColumns(e.target.value as SpellAnalysisSort[])}>{OPTIONAL.map((c) => <MenuItem key={c.field} value={c.field}><Checkbox checked={columns.includes(c.field)} /><ListItemText primary={c.label} /></MenuItem>)}</Select></FormControl>
    <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Spell rankings" sx={{ '& .MuiTableCell-root': { px: 1 }, '& .MuiTableCell-root:nth-of-type(n+3)': { textAlign: 'center' } }}><TableHead><TableRow>
      {[...BASIC, ...extras].map((c, index) => <SpellSortHeader key={c.field} {...c} sort={sort} align={index > 1 ? 'center' : 'left'} />)}<TableCell align="center">Actions</TableCell>
    </TableRow></TableHead><TableBody>{records.map((row) => <RankingRows key={row.id} row={row} selected={selected} expanded={expanded === row.id} expand={() => setExpanded(expanded === row.id ? null : row.id)} extras={extras} onOpen={onOpen} onToggle={onToggle} />)}</TableBody></Table></Box>
  </>
}
function RankingRows({ row, selected, expanded, expand, extras, onOpen, onToggle }: {
  row: SpellRankingRow; selected: number[]; expanded: boolean; expand: () => void; extras: typeof OPTIONAL; onOpen: (id: number, scope?: 'single' | 'pack') => void; onToggle: (id: number) => void
}): JSX.Element {
  return <><TableRow data-testid="rankings-record" data-spell-id={row.id}>
    <TableCell>{row.id}</TableCell><TableCell sx={{ minWidth: 190 }}><SpellNameButton id={row.id} onOpen={() => onOpen(row.id, row.calculation.analysis?.scenario.scope)}>{row.name}</SpellNameButton><SpellRowRank id={row.id} name={row.name} evidence={row.rankEvidence} /><Typography variant="caption" display="block">{row.classes.map((c) => `${c.code} ${c.level}`).join(' · ')}</Typography></TableCell>
    <TableCell align="center">{row.learnedLevel ?? '-'}</TableCell><TableCell align="center"><EstimateAmount calculation={row.calculation} /><SpellCastSummary calculation={row.calculation} /></TableCell>
    <TableCell align="center">{row.mana}</TableCell><TableCell align="center">{row.mana === 0 ? 'Zero mana' : amount(row.calculation.perMana)}</TableCell><TableCell align="center">{amount(row.calculation.analysis?.timing.rate ?? null)}</TableCell>
    {extras.map((c) => <TableCell key={c.field} align="center">{amount(extraValue(row, c.field))}</TableCell>)}
    <TableCell><Button size="small" disabled={!selected.includes(row.id) && selected.length >= 4} onClick={() => onToggle(row.id)} data-testid={`rankings-compare-${row.id}`}>{selected.includes(row.id) ? 'Selected' : 'Add'}</Button><Button size="small" onClick={expand} aria-expanded={expanded}>Explain</Button></TableCell>
  </TableRow>{expanded && <TableRow><TableCell colSpan={BASIC.length + extras.length + 1}><SpellAnalysisBreakdown calculation={row.calculation} /></TableCell></TableRow>}</>
}
