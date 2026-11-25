import { type JSX, type ReactNode, useCallback, useState } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Pagination, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { capturedSourceNames, type SpellDataset, type SpellHistoryResult, type SpellObservation } from '@shared/spellLibrary'
import { useLibraryQuery } from './useLibraryQuery'
import { useSpellLibraryStatus } from './libraryState'
import { LibrarySpellDetail } from './LibrarySpellDetail'
import { SpellUpdateChanges } from './SpellUpdateChanges'
import { HistoryColumnPicker, HISTORY_COLUMN_LABELS, useHistoryColumns } from './SpellHistoryColumns'

function FieldChanges({ id, before, after }: { id: number; before: string; after: string }): JSX.Element {
  const load = useCallback(() => window.eq.spellLibrary.beforeAfter({ id, beforeSnapshotId: before, afterSnapshotId: after }), [id, before, after])
  const { data, loading, error } = useLibraryQuery(load)
  return <Stack spacing={1} data-testid="spells-field-changes">
    {loading && <CircularProgress size={20} />}{error && <Alert severity="error">{error}</Alert>}
    {data && <><Typography variant="subtitle1">ID {id}: {data.before?.name ?? '(absent)'} → {data.after?.name ?? '(absent)'}</Typography><Box sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>Field / change kind</TableCell><TableCell>Before</TableCell><TableCell>After</TableCell></TableRow></TableHead><TableBody>{data.differences.map((d) => <TableRow key={`${d.kind}:${d.field}`}><TableCell>{d.field}<Typography variant="caption" display="block">{d.kind}</Typography></TableCell><TableCell sx={{ overflowWrap: 'anywhere', maxWidth: 380, whiteSpace: 'pre-wrap' }}>{JSON.stringify(d.before)}</TableCell><TableCell sx={{ overflowWrap: 'anywhere', maxWidth: 380, whiteSpace: 'pre-wrap' }}>{JSON.stringify(d.after)}</TableCell></TableRow>)}</TableBody></Table></Box>{data.differences.length === 0 && <Typography>No differences in this spell between the selected snapshots.</Typography>}</>}
  </Stack>
}

function SnapshotChanges({ before, after, onOpen }: { before: string; after: string; onOpen: (id: number) => void }): JSX.Element {
  const [page, setPage] = useState(1)
  const [id, setId] = useState<number | null>(null)
  const selection = useHistoryColumns('snapshot')
  const { columns } = selection
  const load = useCallback(() => window.eq.spellLibrary.changes({ beforeSnapshotId: before, afterSnapshotId: after, page, pageSize: 40 }), [before, after, page])
  const { data, error, loading } = useLibraryQuery(load)
  return <Stack spacing={1}>
    {loading && <CircularProgress size={20} />}{error && <Alert severity="error">{error}</Alert>}
    {data && <>
      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
        <Typography>{data.total.toLocaleString()} spell differences</Typography>
        <HistoryColumnPicker {...selection} />
      </Stack>
      <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Snapshot spell differences">
        <TableHead><TableRow>
          <TableCell>Spell</TableCell>
          {columns.map((column) => <TableCell key={column}>{HISTORY_COLUMN_LABELS[column]}</TableCell>)}
        </TableRow></TableHead>
        <TableBody>{data.changes.map((change) => <TableRow key={change.id}>
          <TableCell component="th" scope="row"><Button size="small" onClick={() => setId(change.id)}>{change.name}</Button></TableCell>
          {columns.includes('id') && <TableCell>{change.id}</TableCell>}
          {columns.includes('change') && <TableCell>{change.kind}</TableCell>}
          {columns.includes('fields') && <TableCell>{change.fields}</TableCell>}
          {columns.includes('current') && <TableCell><Button size="small" onClick={() => onOpen(change.id)}>Current record</Button></TableCell>}
        </TableRow>)}</TableBody>
      </Table></Box>
      {data.total > 40 && <Pagination page={page} count={Math.ceil(data.total / 40)} onChange={(_e, p) => { setPage(p); setId(null) }} />}
    </>}
    {id !== null && <FieldChanges key={`${before}:${after}:${id}`} id={id} before={before} after={after} />}
  </Stack>
}

function SpellTimeline({ id, onOpen }: { id: number; onOpen: (id: number) => void }): JSX.Element {
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const checkedAt = useSpellLibraryStatus().checkedAt
  const load = useCallback(() => window.eq.spellLibrary.timeline({ id }), [id])
  const { data, error, loading } = useLibraryQuery(load, checkedAt)
  if (snapshot) return <LibrarySpellDetail id={id} snapshotId={snapshot} onBack={() => setSnapshot(null)} onHistory={() => setSnapshot(null)} />
  return <Stack spacing={1} data-testid="spells-timeline">
    {loading && <CircularProgress size={20} />}{error && <Alert severity="error">{error}</Alert>}
    {data?.entries.map((entry) => <Accordion key={entry.observation.id} slotProps={{ transition: { unmountOnExit: true } }}><AccordionSummary expandIcon={<ExpandMoreIcon />}>{new Date(entry.observation.observedAt).toLocaleString()} · {entry.observation.outcome} · {entry.record?.name ?? 'Record absent'}</AccordionSummary><AccordionDetails><Stack spacing={1}><Typography>{entry.observation.message}</Typography><Button size="small" onClick={() => onOpen(id)}>Open current ID {id}</Button>{entry.record && <Button size="small" onClick={() => setSnapshot(entry.observation.snapshotId)}>View captured record</Button>}{entry.observation.previousSnapshotId && entry.observation.snapshotId && <FieldChanges id={id} before={entry.observation.previousSnapshotId} after={entry.observation.snapshotId} />}</Stack></AccordionDetails></Accordion>)}
    {data?.entries.length === 0 && <Typography>No captured history for spell ID {id}.</Typography>}
  </Stack>
}

function SnapshotPicker({ label, value, snapshots, onChange }: { label: string; value: string; snapshots: SpellDataset[]; onChange: (id: string) => void }): JSX.Element {
  return <FormControl size="small" sx={{ minWidth: 260, flexGrow: 1 }}><InputLabel>{label}</InputLabel><Select label={label} value={value} onChange={(e) => onChange(e.target.value)} inputProps={{ 'aria-label': label }}>{snapshots.map((s) => <MenuItem key={s.snapshotId} value={s.snapshotId}>{new Date(s.firstObserved).toLocaleString()} · {s.contentId.slice(0, 12)} · parser {s.parserVersion}</MenuItem>)}</Select></FormControl>
}

function snapshotPair(data: SpellHistoryResult | null, before: string | null, after: string | null) {
  const snapshots = data?.snapshots ?? []
  const afterId = after ?? data?.dataset?.snapshotId ?? snapshots[0]?.snapshotId ?? ''
  const beforeId = before ?? snapshots.find((s) => s.snapshotId !== afterId)?.snapshotId ?? afterId
  return { snapshots, beforeId, afterId }
}

const UPDATES_PER_PAGE = 20

export function SpellHistory({ focusId, onOpen }: { focusId: number | null; onOpen: (id: number) => void }): JSX.Element {
  const timeline = <HistoryDisclosure label="Spell timeline" testId="spells-history-timeline-toggle" defaultExpanded={focusId !== null}>
    <FindSpellTimeline key={focusId} focusId={focusId} onOpen={onOpen} />
  </HistoryDisclosure>
  return <Stack spacing={2} data-testid="spells-history">
    {focusId !== null && timeline}
    <ClientUpdates />
    {focusId === null && timeline}
    <HistoryDisclosure label="Check log" testId="spells-history-check-log"><CheckLog /></HistoryDisclosure>
    <HistoryDisclosure label="Compare captured snapshots" testId="spells-history-manual-compare"><ManualComparison onOpen={onOpen} /></HistoryDisclosure>
  </Stack>
}

function HistoryDisclosure({ label, testId, defaultExpanded = false, children }: {
  label: string; testId: string; defaultExpanded?: boolean; children: ReactNode
}): JSX.Element {
  return <Accordion disableGutters defaultExpanded={defaultExpanded} slotProps={{ transition: { unmountOnExit: true } }}>
    <AccordionSummary expandIcon={<ExpandMoreIcon />} data-testid={testId}>{label}</AccordionSummary>
    <AccordionDetails>{children}</AccordionDetails>
  </Accordion>
}

function ClientUpdates(): JSX.Element {
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const load = useCallback(() => window.eq.spellLibrary.history({ page, pageSize: UPDATES_PER_PAGE, updatesOnly: true }), [page])
  const { data, loading, error } = useLibraryQuery(load)
  return <Stack spacing={1.5} data-testid="spells-client-updates">
    <Typography variant="h6" component="h2">Client spell updates</Typography>
    <Typography variant="body2" color="text.secondary">First seen is when Oracle captured the update.</Typography>
    {loading && <CircularProgress size={22} aria-label="Loading spell updates" />}
    {error && <Alert severity="error">{error}</Alert>}
    {data && <ClientUpdateList data={data} page={page} setPage={setPage} expandedId={expandedId} onExpand={setExpandedId} />}
  </Stack>
}

function ClientUpdateList({ data: { observations, snapshots, totalObservations }, page, setPage, expandedId, onExpand }: {
  data: SpellHistoryResult; page: number; setPage: (value: number) => void
  expandedId: number | null; onExpand: (id: number | null) => void
}): JSX.Element {
  if (!observations.length) return <Typography color="text.secondary">No client spell updates captured yet.</Typography>
  const datasets = new Map(snapshots.map((snapshot) => [snapshot.snapshotId, snapshot]))
  return <Stack spacing={1}>
    <Typography variant="subtitle2" color="text.secondary" sx={{ px: 2 }}>First seen</Typography>
    {observations.map((observation) => <ClientUpdate key={observation.id} observation={observation}
      datasets={datasets} expanded={expandedId === observation.id} onExpand={(open) => onExpand(open ? observation.id : null)} />)}
    {totalObservations > UPDATES_PER_PAGE && <Pagination page={page} count={Math.ceil(totalObservations / UPDATES_PER_PAGE)}
      onChange={(_event, value) => { setPage(value); onExpand(null) }} />}
  </Stack>
}

function ClientUpdate({ observation, datasets, expanded, onExpand }: {
  observation: SpellObservation; datasets: Map<string, SpellDataset>; expanded: boolean; onExpand: (open: boolean) => void
}): JSX.Element | null {
  const { previousSnapshotId, snapshotId, id, outcome, observedAt } = observation
  if (!previousSnapshotId || !snapshotId) return null
  const before = datasets.get(previousSnapshotId)
  const after = datasets.get(snapshotId)
  const files = capturedSourceNames([...new Set([...Object.keys(before?.hashes ?? {}), ...Object.keys(after?.hashes ?? {})])]).filter((file) => before?.hashes[file] !== after?.hashes[file])
  const pair = { beforeSnapshotId: previousSnapshotId, afterSnapshotId: snapshotId }
  return <Accordion disableGutters expanded={expanded} onChange={(_event, value) => onExpand(value)}
    slotProps={{ transition: { unmountOnExit: true } }}>
    <AccordionSummary expandIcon={<ExpandMoreIcon />} data-testid="spells-history-update" data-observation-id={id}>
      <Stack direction="row" gap={2} alignItems="baseline" flexWrap="wrap">
        <Typography sx={{ fontWeight: 600 }}>{new Date(observedAt).toLocaleString()}</Typography>
        <Typography variant="body2" color="text.secondary">{files.join(' · ')}</Typography>
        {outcome === 'rollback' && <Chip size="small" variant="outlined" label="Earlier files restored" />}
      </Stack>
    </AccordionSummary>
    <AccordionDetails><SpellUpdateChanges pair={pair} /></AccordionDetails>
  </Accordion>
}

function FindSpellTimeline({ focusId, onOpen }: { focusId: number | null; onOpen: (id: number) => void }): JSX.Element {
  const [spellId, setSpellId] = useState(focusId?.toString() ?? '')
  const timelineId = /^\d+$/.test(spellId) ? Number(spellId) : null
  return <Stack spacing={1}>
    <TextField size="small" label="Numeric spell ID" type="number" value={spellId}
      slotProps={{ htmlInput: { min: 0, 'data-testid': 'spells-timeline-id' } }}
      onChange={(event) => setSpellId(event.target.value)} sx={{ maxWidth: 240 }} />
    {timelineId !== null && <SpellTimeline key={timelineId} id={timelineId} onOpen={onOpen} />}
  </Stack>
}

function CheckLog(): JSX.Element {
  const checkedAt = useSpellLibraryStatus().checkedAt
  const [page, setPage] = useState(1)
  const load = useCallback(() => window.eq.spellLibrary.history({ page, pageSize: 30 }), [page])
  const { data, loading, error } = useLibraryQuery(load, checkedAt)
  return <Stack spacing={1}>
    {loading && <CircularProgress size={20} aria-label="Loading check log" />}
    {error && <Alert severity="error">{error}</Alert>}
    {data && <ObservedChecks data={data} page={page} setPage={setPage} />}
  </Stack>
}

function ManualComparison({ onOpen }: { onOpen: (id: number) => void }): JSX.Element {
  const checkedAt = useSpellLibraryStatus().checkedAt
  const [before, setBefore] = useState<string | null>(null)
  const [after, setAfter] = useState<string | null>(null)
  const load = useCallback(() => window.eq.spellLibrary.history({ pageSize: 1 }), [])
  const { data, loading, error } = useLibraryQuery(load, checkedAt)
  const { snapshots, afterId, beforeId } = snapshotPair(data, before, after)
  return <Stack spacing={1}>
    {loading && <CircularProgress size={20} aria-label="Loading snapshots" />}
    {error && <Alert severity="error">{error}</Alert>}
    <HistoryComparison snapshots={snapshots} beforeId={beforeId} afterId={afterId} setBefore={setBefore} setAfter={setAfter} onOpen={onOpen} />
  </Stack>
}

function ObservedChecks({ data, page, setPage }: { data: SpellHistoryResult; page: number; setPage: (page: number) => void }): JSX.Element {
  const snapshots = data.snapshots
  return <>      <Typography variant="body2">{snapshots.length} unique interpreted snapshots · {(data.storageBytes / 1048576).toFixed(1)} MiB local storage · {data.totalObservations} recorded checks</Typography>
      <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Spell dataset checks"><TableHead><TableRow><TableCell>Observed</TableCell><TableCell>Trigger / outcome</TableCell><TableCell>Added / changed / removed</TableCell><TableCell>Details</TableCell></TableRow></TableHead><TableBody>{data.observations.map((o) => <TableRow key={o.id} data-testid="spells-observation"><TableCell>{new Date(o.observedAt).toLocaleString()}</TableCell><TableCell>{o.reason}<Typography variant="caption" display="block">{o.outcome}</Typography></TableCell><TableCell>{o.counts.added} / {o.counts.changed} / {o.counts.removed}</TableCell><TableCell>{o.message}</TableCell></TableRow>)}</TableBody></Table></Box>
      {data.totalObservations > 30 && <Pagination page={page} count={Math.ceil(data.totalObservations / 30)} onChange={(_e, p) => setPage(p)} />}
      {snapshots.map((s) => <Accordion key={s.snapshotId}><AccordionSummary>{s.contentId.slice(0, 14)} · {s.recordCount.toLocaleString()} records · first observed {new Date(s.firstObserved).toLocaleString()} · parser {s.parserVersion}</AccordionSummary><AccordionDetails><Typography variant="caption" sx={{ overflowWrap: 'anywhere' }} component="div">Snapshot {s.snapshotId}{Object.entries(s.hashes).map(([file, hash]) => <Box key={file}>{file}: {hash}</Box>)}</Typography></AccordionDetails></Accordion>)}
</>
}

function HistoryComparison({ snapshots, beforeId, afterId, setBefore, setAfter, onOpen }: {
  snapshots: SpellDataset[]; beforeId: string; afterId: string; setBefore: (id: string) => void; setAfter: (id: string) => void; onOpen: (id: number) => void
}): JSX.Element | null {
  if (snapshots.length === 0) return null
  return <><Stack direction="row" flexWrap="wrap" gap={1}><SnapshotPicker label="Before snapshot" value={beforeId} snapshots={snapshots} onChange={setBefore} /><SnapshotPicker label="After snapshot" value={afterId} snapshots={snapshots} onChange={setAfter} /></Stack><SnapshotChanges key={`${beforeId}:${afterId}`} before={beforeId} after={afterId} onOpen={onOpen} /></>
}
