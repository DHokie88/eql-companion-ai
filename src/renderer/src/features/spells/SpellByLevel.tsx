import { Fragment, type JSX, useCallback } from 'react'
import { Alert, Box, Button, CircularProgress, Pagination, Stack, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import type { SpellBrowseSort, SpellClass, SpellSummary } from '@shared/spellLibrary'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import { useLibraryQuery } from './useLibraryQuery'
import { useSearchText } from './useSearchText'
import { SpellNameButton, SpellSortHeader, useSpellSort } from './SpellTableControls'
import { useSpellPageReset, useSpellScroll, useSpellWorkspaceState } from './spellWorkspace'
import { SpellRowRank } from './SpellRowRank'

export function SpellByLevel({ classes, level, evaluation, selected, onOpen, onPreview, onToggle }: {
  classes: SpellClass[]; level: number; evaluation: SpellEvaluationOptions; selected: number[]
  onOpen: (id: number) => void; onPreview: (id: number, level: number) => void; onToggle: (id: number) => void
}): JSX.Element {
  const state = useByLevel(classes, level, evaluation)
  const { data, error, loading, page, setPage, sort, view, setView, through, setThrough, text, setText } = state
  useSpellScroll('by-level', !!data && !loading)
  return <Stack spacing={1.5} data-testid="spells-by-level">
    <Tabs value={view} onChange={(_e, value: typeof view) => { setView(value); setPage(1) }}><Tab value="at" label={`At level ${level}`} /><Tab value="upcoming" label="Upcoming" /></Tabs>
    <Stack direction="row" gap={1} flexWrap="wrap"><TextField size="small" label="Spell name or numeric ID" value={text} onChange={(e) => { setText(e.target.value); setPage(1) }} slotProps={{ htmlInput: { 'data-testid': 'by-level-search' } }} sx={{ flexGrow: 1 }} />
      {view === 'upcoming' && <TextField size="small" label="Through level" type="number" value={through ?? Math.min(255, level + 10)} onChange={(e) => { setThrough(Number(e.target.value)); setPage(1) }} slotProps={{ htmlInput: { min: level + 1, max: 255, 'data-testid': 'by-level-through' } }} sx={{ width: 160 }} />}
    </Stack>
    <Alert severity="info">Client eligibility only. These lists do not confirm spell ownership, scroll availability, era availability, or server acquisition. Detected ranks are observation evidence. Preview uses the spell's eligible level and your current modeled inputs.</Alert>
    {error && <Alert severity="error">{error}</Alert>}{loading && <CircularProgress size={22} />}
    {data && <>
      <Typography variant="caption">{data.total.toLocaleString()} records · earliest eligible level across {classes.length ? classes.join(' / ') : 'all classes'} · revision {data.dataset?.contentId.slice(0, 14)}</Typography>
      <ByLevelTable records={data.records} selected={selected} sort={sort} onOpen={onOpen} onPreview={onPreview} onToggle={onToggle} />
      {!data.total && <Typography>No client spells become eligible in this range.</Typography>}
      {data.total > 40 && <Pagination page={page} count={Math.ceil(data.total / 40)} onChange={(_e, value) => setPage(value)} />}
    </>}
  </Stack>
}
function useByLevel(classes: SpellClass[], level: number, evaluation: SpellEvaluationOptions) {
  const [view, setView] = useSpellWorkspaceState<'at' | 'upcoming'>('by-level-view', 'at')
  const [through, setThrough] = useSpellWorkspaceState<number | null>('by-level-through', null)
  const [page, setPage] = useSpellWorkspaceState('by-level-page', 1)
  const [text, setText] = useSpellWorkspaceState('by-level-search', '')
  const sort = useSpellSort<SpellBrowseSort>('level', 'asc', 'by-level')
  const queryText = useSearchText(text), classKey = classes.join(',')
  useSpellPageReset(`${classKey}:${level}:${view}:${sort.field}:${sort.direction}`, setPage)
  const load = useCallback(() => window.eq.spellLibrary.byLevel({ classes: classKey ? classKey.split(',') as SpellClass[] : [], level,
    throughLevel: through ?? Math.min(255, level + 10), view, page, pageSize: 40, evaluation, text: queryText, sortBy: sort.field, direction: sort.direction }),
  [classKey, level, through, view, page, evaluation, queryText, sort.field, sort.direction])
  return { ...useLibraryQuery(load), view, setView, through, setThrough, page, setPage, text, setText, sort }
}
function ByLevelTable({ records, selected, sort, onOpen, onPreview, onToggle }: {
  records: SpellSummary[]; selected: number[]; sort: ReturnType<typeof useSpellSort<SpellBrowseSort>>
  onOpen: (id: number) => void; onPreview: (id: number, level: number) => void; onToggle: (id: number) => void
}): JSX.Element {
  return <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Client spell eligibility by level"><TableHead><TableRow>
    {([{ field: 'level', label: 'Level' }, { field: 'id', label: 'ID' }, { field: 'name', label: 'Spell / description' }, { field: 'classes', label: 'Client classes / levels' }, { field: 'category', label: 'Category' }, { field: 'mana', label: 'Client mana' }] as const).map((c) => <SpellSortHeader key={c.field} {...c} sort={sort} />)}<TableCell>Actions</TableCell>
  </TableRow></TableHead><TableBody>{records.map((r, index) => <Fragment key={r.id}>
    {sort.field === 'level' && (index === 0 || records[index - 1].learnedLevel !== r.learnedLevel) && <TableRow><TableCell colSpan={7} sx={{ bgcolor: 'action.hover' }}><Typography variant="subtitle2">Eligible at level {r.learnedLevel ?? 'unknown'}</Typography></TableCell></TableRow>}
    <TableRow data-testid="by-level-record" data-spell-id={r.id}>
    <TableCell>{r.learnedLevel ?? '-'}</TableCell><TableCell>{r.id}</TableCell><TableCell sx={{ minWidth: 210 }}><SpellNameButton id={r.id} onOpen={onOpen}>{r.name}</SpellNameButton>
      <SpellRowRank id={r.id} name={r.name} evidence={r.rankEvidence} /><Typography variant="caption" display="block">{r.description?.slice(0, 220)}</Typography></TableCell>
    <TableCell>{r.classes.map((c) => `${c.code} ${c.level}`).join(' · ')}</TableCell><TableCell>{r.category}<Typography variant="caption" display="block">{r.subcategory}</Typography></TableCell><TableCell>{r.mana}</TableCell>
    <TableCell><Button size="small" disabled={r.learnedLevel == null} onClick={() => onPreview(r.id, r.learnedLevel ?? 1)} data-testid={`by-level-preview-${r.id}`}>Preview at {r.learnedLevel}</Button><Button size="small" disabled={!selected.includes(r.id) && selected.length >= 4} onClick={() => onToggle(r.id)} data-testid={`by-level-compare-${r.id}`}>{selected.includes(r.id) ? 'Selected' : 'Add to Compare'}</Button></TableCell>
  </TableRow></Fragment>)}</TableBody></Table></Box>
}
