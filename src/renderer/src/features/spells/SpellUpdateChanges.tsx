import { type JSX, useCallback, useEffect, useState } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Pagination, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { CLASS_ABBRS_BY_DISPLAY_NAME, classDisplayName } from '@shared/spellLevels'
import type { SpellChangeKind, SpellChangesResult, SpellChangeSummary, SpellClass, SpellUpdateSection } from '@shared/spellLibrary'
import { useLibraryQuery } from './useLibraryQuery'
import { HistoryColumnPicker, HISTORY_COLUMN_LABELS, useHistoryColumns, type HistoryDisplayColumn } from './SpellHistoryColumns'
import { SpellUpdateFieldChanges, readableHistoryField } from './SpellUpdateFieldChanges'

export interface SpellUpdatePair {
  beforeSnapshotId: string
  afterSnapshotId: string
}

interface UpdateFilters {
  text: string
  spellClass: SpellClass | ''
}

const PAGE_SIZE = 30
const CHANGE_LABELS: Record<SpellChangeKind, string> = {
  added: 'Added',
  removed: 'Removed',
  interpreted: 'Changed',
  'raw-only': 'Raw fields',
  format: 'File format',
  'parser-upgrade': 'Parser interpretation'
}
const CHANGE_COLORS = { added: 'success', removed: 'error', interpreted: 'info' } as const

function useUpdateRows(pair: SpellUpdatePair, section: SpellUpdateSection, { text, spellClass }: UpdateFilters, page: number) {
  const { beforeSnapshotId, afterSnapshotId } = pair
  const load = useCallback(() => window.eq.spellLibrary.changes({
    beforeSnapshotId, afterSnapshotId, page, pageSize: PAGE_SIZE, clientUpdate: true, section,
    text: text.trim(), classes: spellClass ? [spellClass] : undefined
  }), [beforeSnapshotId, afterSnapshotId, page, section, text, spellClass])
  return useLibraryQuery(load)
}

function useDebouncedName(text: string): string {
  const [settled, setSettled] = useState(text)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(text), 180)
    return () => window.clearTimeout(timer)
  }, [text])
  return settled
}

export function SpellUpdateChanges({ pair }: { pair: SpellUpdatePair }): JSX.Element {
  const [text, setText] = useState('')
  const [spellClass, setSpellClass] = useState<SpellClass | ''>('')
  const filters = { text: useDebouncedName(text), spellClass }
  const selection = useHistoryColumns('update')
  return <Stack spacing={2} data-testid="spells-history-update-details">
    <Stack direction="row" gap={1} flexWrap="wrap">
      <TextField size="small" label="Spell name or ID" value={text} onChange={(event) => setText(event.target.value)} sx={{ minWidth: 250 }}
        slotProps={{ htmlInput: { 'data-testid': 'spells-history-name' } }} />
      <FormControl size="small" sx={{ minWidth: 170 }}>
        <InputLabel id="spells-history-class-label" shrink>Class</InputLabel>
        <Select<SpellClass | ''> labelId="spells-history-class-label" label="Class" value={spellClass} displayEmpty
          onChange={(event) => setSpellClass(event.target.value as SpellClass | '')} data-testid="spells-history-class">
          <MenuItem value="">All classes</MenuItem>
          {CLASS_ABBRS_BY_DISPLAY_NAME.map((code) => <MenuItem key={code} value={code}>{classDisplayName(code)}</MenuItem>)}
        </Select>
      </FormControl>
      <HistoryColumnPicker {...selection} />
    </Stack>
    <UpdateSections pair={pair} filters={filters} columns={selection.columns} />
  </Stack>
}

function useHistoryPage(filters: UpdateFilters) {
  const key = JSON.stringify(filters)
  const [selection, setSelection] = useState({ key, page: 1 })
  return { page: selection.key === key ? selection.page : 1, setPage: (page: number) => setSelection({ key, page }) }
}

function UpdateSections({ pair, filters, columns }: { pair: SpellUpdatePair; filters: UpdateFilters; columns: HistoryDisplayColumn[] }): JSX.Element {
  const { page, setPage } = useHistoryPage(filters)
  const result = useUpdateRows(pair, 'spells', filters, page)
  const counts = result.data?.updateCounts
  return <>
    {counts && <Typography variant="subtitle1" data-testid="spells-history-counts">
      {counts.added.toLocaleString()} added · {counts.changed.toLocaleString()} changed · {counts.removed.toLocaleString()} removed
    </Typography>}
    <ChangeResults pair={pair} result={result} page={page} onPage={setPage} columns={columns} />
    <TechnicalSection pair={pair} filters={filters} section="raw" count={counts?.rawOnly} columns={columns} />
    <TechnicalSection pair={pair} filters={filters} section="format" count={counts?.formatOnly} columns={columns} />
  </>
}

function TechnicalSection({ pair, filters, section, count, columns }: {
  pair: SpellUpdatePair; filters: UpdateFilters; section: 'raw' | 'format'; count?: number; columns: HistoryDisplayColumn[]
}): JSX.Element {
  const label = section === 'raw' ? 'Raw-field changes' : 'File format changes'
  return <Accordion disableGutters slotProps={{ transition: { unmountOnExit: true } }}>
    <AccordionSummary expandIcon={<ExpandMoreIcon />} data-testid={'spells-history-' + section}>
      {label}{count === undefined ? '' : ' (' + count.toLocaleString() + ')'}
    </AccordionSummary>
    <AccordionDetails>
      {section === 'format' && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        These spells had a different file layout. Their spell values stayed the same.
      </Typography>}
      <TechnicalResults pair={pair} section={section} filters={filters} columns={columns} />
    </AccordionDetails>
  </Accordion>
}

function TechnicalResults({ pair, section, filters, columns }: { pair: SpellUpdatePair; section: 'raw' | 'format'; filters: UpdateFilters; columns: HistoryDisplayColumn[] }): JSX.Element {
  const { page, setPage } = useHistoryPage(filters)
  const result = useUpdateRows(pair, section, filters, page)
  return <ChangeResults pair={pair} result={result} page={page} onPage={setPage} columns={columns} technicalExpanded />
}

function ChangeResults({ pair, result: { data, error, loading }, page, onPage, columns, technicalExpanded = false }: {
  pair: SpellUpdatePair; result: ReturnType<typeof useLibraryQuery<SpellChangesResult>>; page: number; onPage: (value: number) => void; columns: HistoryDisplayColumn[]; technicalExpanded?: boolean
}): JSX.Element {
  if (loading) return <CircularProgress size={22} aria-label="Loading spell changes" />
  if (error) return <Alert severity="error">{error}</Alert>
  if (!data?.total) return <Typography color="text.secondary">No spell changes match this view.</Typography>
  return <Stack spacing={1}>
    <Typography variant="body2" color="text.secondary">{data.total.toLocaleString()} matching {data.total === 1 ? 'spell' : 'spells'}</Typography>
    <ChangedSpellsTable key={page} pair={pair} changes={data.changes} columns={columns} technicalExpanded={technicalExpanded} />
    {data.total > PAGE_SIZE && <Pagination page={page} count={Math.ceil(data.total / PAGE_SIZE)} onChange={(_event, value) => onPage(value)} />}
  </Stack>
}

function ChangedSpellsTable({ pair, changes, columns, technicalExpanded }: { pair: SpellUpdatePair; changes: SpellChangeSummary[]; columns: HistoryDisplayColumn[]; technicalExpanded: boolean }): JSX.Element {
  const [spellId, setSpellId] = useState<number | null>(null)
  return <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Changed spells">
    <TableHead><TableRow>
      <TableCell>Spell</TableCell>
      {columns.map((column) => <TableCell key={column}>{HISTORY_COLUMN_LABELS[column]}</TableCell>)}
    </TableRow></TableHead>
    <TableBody>{changes.map((change) => <ChangedSpellRow key={change.id} pair={pair} change={change} columns={columns}
      expanded={spellId === change.id} technicalExpanded={technicalExpanded} onToggle={() => setSpellId(spellId === change.id ? null : change.id)} />)}</TableBody>
  </Table></Box>
}

function ChangedSpellRow({ pair, change, columns, expanded, onToggle, technicalExpanded }: {
  pair: SpellUpdatePair; change: SpellChangeSummary; columns: HistoryDisplayColumn[]; expanded: boolean; onToggle: () => void; technicalExpanded: boolean
}): JSX.Element {
  const { name, id } = change
  return <>
    <TableRow hover selected={expanded} data-testid={`spells-history-row-${id}`}>
      <TableCell component="th" scope="row"><Button onClick={onToggle} aria-expanded={expanded}
        data-testid={`spells-history-spell-${id}`} size="small" sx={{ px: 0, textTransform: 'none', textAlign: 'left' }}>
        {name}
      </Button></TableCell>
      {columns.map((column) => <TableCell key={column}>{historyChangeValue(column, change)}</TableCell>)}
    </TableRow>
    {expanded && <TableRow><TableCell colSpan={columns.length + 1} sx={{ p: { xs: 1, sm: 2.5 }, bgcolor: 'background.paper' }}>
      <SpellUpdateFieldChanges pair={pair} id={id} technicalExpanded={technicalExpanded} />
    </TableCell></TableRow>}
  </>
}

function historyChangeValue(column: HistoryDisplayColumn, change: SpellChangeSummary): JSX.Element | string | number | null {
  const { id, kind, classes, changedFields } = change
  switch (column) {
    case 'id': return id
    case 'classes': return classes?.length ? classes.map(({ code, level }) => `${code} ${level}`).join(' · ') : '-'
    case 'change': {
      const color = kind in CHANGE_COLORS ? CHANGE_COLORS[kind as keyof typeof CHANGE_COLORS] : 'default'
      return <Chip label={CHANGE_LABELS[kind]} color={color} size="small" variant="outlined" />
    }
    case 'fields': {
      const fields = [...new Set(changedFields?.map(readableHistoryField))]
      if (!fields.length) return '-'
      return fields.slice(0, 3).join(', ') + (fields.length > 3 ? ` +${fields.length - 3}` : '')
    }
    case 'current': return null
  }
}
