import { type JSX, useCallback, useState } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, CircularProgress, FormControl, InputLabel, MenuItem, Pagination, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import type { SpellDataset, SpellHistoryResult } from '@shared/spellLibrary'
import { useLibraryQuery } from './useLibraryQuery'
import { useSpellLibraryStatus } from './libraryState'
import { LibrarySpellDetail } from './LibrarySpellDetail'

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
  const load = useCallback(() => window.eq.spellLibrary.changes({ beforeSnapshotId: before, afterSnapshotId: after, page, pageSize: 40 }), [before, after, page])
  const { data, error, loading } = useLibraryQuery(load)
  return <Stack spacing={1}>
    {loading && <CircularProgress size={20} />}{error && <Alert severity="error">{error}</Alert>}
    {data && <><Typography>{data.total.toLocaleString()} spell differences</Typography><Box sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>ID / name</TableCell><TableCell>Change</TableCell><TableCell>Fields</TableCell><TableCell /></TableRow></TableHead><TableBody>{data.changes.map((c) => <TableRow key={c.id}><TableCell><Button size="small" onClick={() => setId(c.id)}>{c.id} · {c.name}</Button></TableCell><TableCell>{c.kind}</TableCell><TableCell>{c.fields}</TableCell><TableCell><Button size="small" onClick={() => onOpen(c.id)}>Current record</Button></TableCell></TableRow>)}</TableBody></Table></Box>{data.total > 40 && <Pagination page={page} count={Math.ceil(data.total / 40)} onChange={(_e, p) => { setPage(p); setId(null) }} />}</>}
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
    {data?.entries.map((entry) => <Accordion key={entry.observation.id}><AccordionSummary>{new Date(entry.observation.observedAt).toLocaleString()} · {entry.observation.outcome} · {entry.record?.name ?? 'Record absent'}</AccordionSummary><AccordionDetails><Stack spacing={1}><Typography>{entry.observation.message}</Typography><Button size="small" onClick={() => onOpen(id)}>Open current ID {id}</Button>{entry.record && <Button size="small" onClick={() => setSnapshot(entry.observation.snapshotId)}>View captured record</Button>}{entry.observation.previousSnapshotId && entry.observation.snapshotId && <FieldChanges id={id} before={entry.observation.previousSnapshotId} after={entry.observation.snapshotId} />}</Stack></AccordionDetails></Accordion>)}
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

export function SpellHistory({ focusId, onOpen }: { focusId: number | null; onOpen: (id: number) => void }): JSX.Element {
  const checkedAt = useSpellLibraryStatus().checkedAt
  const [page, setPage] = useState(1)
  const [before, setBefore] = useState<string | null>(null)
  const [after, setAfter] = useState<string | null>(null)
  const [spellId, setSpellId] = useState(focusId?.toString() ?? '')
  const load = useCallback(() => window.eq.spellLibrary.history({ page, pageSize: 30 }), [page])
  const { data, loading, error } = useLibraryQuery(load, checkedAt)
  const { snapshots, afterId, beforeId } = snapshotPair(data, before, after)
  const timelineId = /^\d+$/.test(spellId) ? Number(spellId) : null
  return <Stack spacing={2} data-testid="spells-history">
    <Alert severity="info">History begins with Oracle’s first captured baseline. Dates mean “first observed by Oracle,” not official patch dates. Changes while Oracle was closed cannot be reconstructed without older source files. Captured history is retained indefinitely.</Alert>
    {loading && <CircularProgress size={22} />}{error && <Alert severity="error">{error}</Alert>}
    {data && <>
      <ObservedChecks data={data} page={page} setPage={setPage} />
      <HistoryComparison snapshots={snapshots} beforeId={beforeId} afterId={afterId} setBefore={setBefore} setAfter={setAfter} onOpen={onOpen} />
    </>}
    <Typography variant="h6">Spell timeline</Typography><TextField size="small" label="Numeric spell ID" type="number" value={spellId} slotProps={{ htmlInput: { min: 0, 'data-testid': 'spells-timeline-id' } }} onChange={(e) => setSpellId(e.target.value)} sx={{ maxWidth: 240 }} />
    {timelineId !== null && <SpellTimeline key={timelineId} id={timelineId} onOpen={onOpen} />}
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
  return <><Typography variant="h6">Compare captured snapshots</Typography><Stack direction="row" flexWrap="wrap" gap={1}><SnapshotPicker label="Before snapshot" value={beforeId} snapshots={snapshots} onChange={setBefore} /><SnapshotPicker label="After snapshot" value={afterId} snapshots={snapshots} onChange={setAfter} /></Stack><SnapshotChanges key={`${beforeId}:${afterId}`} before={beforeId} after={afterId} onOpen={onOpen} /></>
}
