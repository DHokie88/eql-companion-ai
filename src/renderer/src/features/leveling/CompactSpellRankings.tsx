import { type JSX, useState } from 'react'
import { Alert, Box, Button, Stack, Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel, Typography } from '@mui/material'
import type { SpellAnalysisSort, SpellLibraryFocus, SpellRankingRow, SpellRankingsResult } from '@shared/spellAnalysis'
import type { SpellCalculation, SpellSortDirection } from '@shared/spellLibrary'
import { amount, EstimateAmount, EstimateExplanation } from '../spells/SpellEstimate'
import { openLevelingSpells } from './useLevelingSpellAnalysis'

type Group = 'ranked' | 'zero-mana' | 'excluded'
const COLUMNS: { value: SpellAnalysisSort; label: string }[] = [
  { value: 'rate', label: 'Rate' }, { value: 'amount', label: 'Amount' },
  { value: 'mana', label: 'Mana' }, { value: 'efficiency', label: '/ mana' }
]

export function CompactSpellRankings({ result, sortBy, direction, group, onGroup, onSort, focus }: {
  result: SpellRankingsResult; sortBy: SpellAnalysisSort; direction: SpellSortDirection; group: Group
  onGroup: (group: Group) => void; onSort: (sort: SpellAnalysisSort) => void; focus: SpellLibraryFocus
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const rows = result.records.slice(0, expanded ? 40 : 10)
  return <Box data-testid="best-spells-section" data-tab={focus.category} data-count={result.total} data-sort={sortBy} data-desc={String(direction === 'desc')}>
    {!result.dataset && <Alert severity="warning">The client spell catalog is unavailable. Check for updates in Spells.</Alert>}
    <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mb: 0.5 }}>
      <Button size="small" variant={group === 'ranked' ? 'outlined' : 'text'} onClick={() => onGroup('ranked')}>Ranked ({result.groupCounts.ranked})</Button>
      <Button size="small" variant={group === 'zero-mana' ? 'outlined' : 'text'} onClick={() => onGroup('zero-mana')}>Zero mana ({result.groupCounts.zeroMana})</Button>
      <Button size="small" variant={group === 'excluded' ? 'outlined' : 'text'} onClick={() => onGroup('excluded')}>Excluded ({result.groupCounts.excluded})</Button>
    </Stack>
    {rows.length === 0 ? <Typography variant="caption" color="text.secondary" data-testid="best-spells-empty">No matching client spells in this group.</Typography>
      : <Table size="small" sx={{ tableLayout: 'fixed', '& th, & td': { px: 0.25, py: 0.5, fontSize: 11 } }}>
        <TableHead><TableRow>{COLUMNS.map((column) => <TableCell key={column.value} align="right" sortDirection={sortBy === column.value ? direction : false}>
          <TableSortLabel active={sortBy === column.value} direction={sortBy === column.value ? direction : 'desc'} onClick={() => onSort(column.value)} sx={{ '& .MuiTableSortLabel-icon': { width: 12, mx: 0 } }}>{column.label}</TableSortLabel>
        </TableCell>)}</TableRow></TableHead>
        <TableBody>{rows.map((row) => <CompactSpellRow key={row.id} row={row} focus={focus} />)}</TableBody>
      </Table>}
    {result.records.length > 10 && <Button size="small" onClick={() => setExpanded(!expanded)} data-testid="best-spells-more">{expanded ? 'Show top 10' : `+${result.records.length - 10} more`}</Button>}
    {result.total > result.records.length && <Button size="small" onClick={() => openLevelingSpells(focus)}>See all {result.total} in Spells</Button>}
  </Box>
}

function CompactSpellRow({ row, focus }: { row: SpellRankingRow; focus: SpellLibraryFocus }): JSX.Element {
  const calculation = row.calculation
  const [explaining, setExplaining] = useState(false)
  return <>
    <TableRow><TableCell colSpan={4} sx={{ borderBottom: 0 }}>
      <Button size="small" onClick={() => openLevelingSpells({ ...focus, id: row.id })} data-testid="best-spells-name" data-id={row.id}
        sx={{ justifyContent: 'flex-start', textAlign: 'left', p: 0, minWidth: 0, textTransform: 'none', fontSize: 12 }}>{row.name}</Button>
      <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>#{row.id} · L{row.learnedLevel ?? '?'}</Typography>
    </TableCell></TableRow>
    <TableRow data-testid="best-spells-row" data-id={row.id}>
      <TableCell align="right" title={calculation.analysis?.timing.reason ?? undefined}>{calculation.analysis?.timing.rate === null || !calculation.analysis ? 'N/A' : amount(calculation.analysis.timing.rate)}</TableCell>
      <TableCell align="right" sx={{ '& .MuiTypography-root': { fontSize: 11 }, '& .MuiStack-root': { alignItems: 'flex-end' } }}><EstimateAmount calculation={calculation} /></TableCell>
      <TableCell align="right">{calculation.mana}</TableCell>
      <TableCell align="right">{calculation.mana === 0 ? 'Zero mana' : amount(calculation.perMana)}</TableCell>
    </TableRow>
    <TableRow><TableCell colSpan={4}>
      <Button size="small" onClick={() => setExplaining(!explaining)} sx={{ p: 0, fontSize: 10 }} aria-expanded={explaining}>How calculated</Button>
      {calculation.analysis?.partial && <Typography variant="caption" color="warning.main" sx={{ ml: 0.5 }}>Partial estimate</Typography>}
      {explaining && <CompactSpellExplanation calculation={calculation} />}
    </TableCell></TableRow>
  </>
}

function CompactSpellExplanation({ calculation }: { calculation: SpellCalculation }): JSX.Element {
  const analysis = calculation.analysis
  const cycle = analysis?.timing.cycleMs
  return <Stack spacing={0.5}>
    <Typography variant="caption">{analysis?.scope ?? 'One-target full cast'} · {cycle === null || cycle === undefined ? 'Timing unavailable' : `${cycle / 1000}s modeled cycle`}</Typography>
    <EstimateExplanation calculation={calculation} />
    {analysis?.timing.reason && <Typography variant="caption" color="warning.main">{analysis.timing.reason}</Typography>}
    {analysis?.warnings.map((warning) => <Typography key={warning} variant="caption" color="warning.main">{warning}</Typography>)}
  </Stack>
}
