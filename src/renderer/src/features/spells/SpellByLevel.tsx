import { Fragment, type JSX, type ReactNode, useCallback } from 'react'
import { Alert, Box, Button, CircularProgress, Pagination, Stack, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material'
import type { SpellBrowseSort, SpellClass, SpellSummary } from '@shared/spellLibrary'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import { useLibraryQuery } from './useLibraryQuery'
import { useSearchText } from './useSearchText'
import { SpellNameButton, SpellSortHeader, useSpellSort } from './SpellTableControls'
import { useSpellPageReset, useSpellScroll, useSpellWorkspaceState } from './spellWorkspace'
import { SpellRowRank } from './SpellRowRank'
import { SpellBrowseFilters } from './SpellBrowseFilters'
import { browseFilterError, defaultBrowseFilters, type BrowseFilters } from './useSpellBrowse'

export function SpellByLevel({ classes, level, evaluation, selected, onOpen, onPreview, onToggle, controls, enabled = true }: {
  classes: SpellClass[]; level: number; evaluation: SpellEvaluationOptions; selected: number[]
  onOpen: (id: number) => void; onPreview: (id: number, level: number) => void; onToggle: (id: number) => void
  controls?: ReactNode; enabled?: boolean
}): JSX.Element {
  const state = useByLevel({ classes, level, evaluation, enabled })
  const { data, error, loading } = state
  useSpellScroll('by-level', !!data && !loading)
  return <Stack spacing={1.5} data-testid="spells-by-level">
    <SpellBrowseFilters {...state} categories={data?.categories ?? []} subcategories={data?.subcategories ?? []} controls={<ProgressionControls state={state} controls={controls} level={level} />} />
    {error && <Alert severity="error">{error}</Alert>}{loading && <CircularProgress size={22} />}
    {!enabled && <Typography>Select classes or choose All to see spells.</Typography>}
    {enabled && <ProgressionResults state={state} classes={classes} selected={selected} onOpen={onOpen} onPreview={onPreview} onToggle={onToggle} />}
  </Stack>
}
function ProgressionResults({ state, classes, selected, onOpen, onPreview, onToggle }: {
  state: ReturnType<typeof useByLevel>; classes: SpellClass[]; selected: number[]
  onOpen: (id: number) => void; onPreview: (id: number, level: number) => void; onToggle: (id: number) => void
}): JSX.Element | null {
  const { data, sort, page, setPage } = state
  if (!data) return null
  return <>
    <Tooltip disableInteractive title="These lists show class eligibility, not ownership or availability. Preview evaluates the spell at its eligible level."><Typography variant="caption">{data.total.toLocaleString()} spells · {classes.length ? classes.join(' / ') : 'All classes'}</Typography></Tooltip>
    <ByLevelTable records={data.records} selected={selected} sort={sort} onOpen={onOpen} onPreview={onPreview} onToggle={onToggle} />
    {!data.total && <Typography>No spells become eligible in this range.</Typography>}
    {data.total > 40 && <Pagination page={page} count={Math.ceil(data.total / 40)} onChange={(_e, value) => setPage(value)} />}
  </>
}
function ProgressionControls({ state, controls, level }: { state: ReturnType<typeof useByLevel>; controls?: ReactNode; level: number }): JSX.Element {
  const { view, setView, through, setThrough, setPage } = state
  return <Stack spacing={1}>{controls}<Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
    <Tabs value={view} onChange={(_e, value: typeof view) => { setView(value); setPage(1) }}><Tab value="at" label={`At level ${level}`} /><Tab value="upcoming" label="Upcoming" /></Tabs>
    {view === 'upcoming' && <TextField size="small" label="Through level" type="number" value={through ?? Math.min(255, level + 10)} onChange={(e) => { setThrough(Number(e.target.value)); setPage(1) }} slotProps={{ htmlInput: { min: level + 1, max: 255, 'data-testid': 'by-level-through' } }} sx={{ width: 160 }} />}
  </Stack></Stack>
}
function useByLevel({ classes, level, evaluation, enabled }: { classes: SpellClass[]; level: number; evaluation: SpellEvaluationOptions; enabled: boolean }) {
  const [view, setView] = useSpellWorkspaceState<'at' | 'upcoming'>('by-level-view', 'at')
  const [through, setThrough] = useSpellWorkspaceState<number | null>('by-level-through', null)
  const [page, setPage] = useSpellWorkspaceState('by-level-page', 1)
  const [text, setText] = useSpellWorkspaceState('by-level-search', '')
  const [savedFilters, setFilters] = useSpellWorkspaceState('progression-filters', defaultBrowseFilters())
  const filters = { ...savedFilters, text }
  const maximum = filters.max ?? String(view === 'at' ? level : through ?? Math.min(255, level + 10))
  const invalid = browseFilterError(filters, maximum)
  const sort = useSpellSort<SpellBrowseSort>('level', 'asc', 'by-level')
  const queryText = useSearchText(text), classKey = classes.join(',')
  useSpellPageReset(`${classKey}:${level}:${view}:${sort.field}:${sort.direction}`, setPage)
  const { category, subcategory, effect, type, polarity, mana, min } = filters
  const load = useCallback(() => {
    if (invalid) return Promise.reject(new Error(invalid))
    return window.eq.spellLibrary.byLevel({ classes: classKey ? classKey.split(',') as SpellClass[] : [], level,
      throughLevel: through ?? Math.min(255, level + 10), view, page, pageSize: 40, evaluation, text: queryText, sortBy: sort.field, direction: sort.direction,
      category: category || undefined, subcategory: subcategory || undefined, effect: effect ? Number(effect) : undefined,
      type: type || undefined, polarity: polarity || undefined, mana: mana || undefined, minLevel: min ? Number(min) : undefined, maxLevel: maximum ? Number(maximum) : undefined })
  }, [classKey, level, through, view, page, evaluation, queryText, sort.field, sort.direction, category, subcategory, effect, type, polarity, mana, min, maximum, invalid])
  const change = <K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]): void => {
    if (key === 'text') setText(String(value))
    else setFilters((previous) => ({ ...previous, [key]: value, ...(key === 'category' ? { subcategory: '' } : {}) }))
    setPage(1)
  }
  const reset = (): void => { setFilters(defaultBrowseFilters()); setText(''); setPage(1) }
  return { ...useLibraryQuery(load, undefined, enabled), view, setView, through, setThrough, page, setPage, sort, filters, maximum, invalid, change, reset }
}
function ByLevelTable({ records, selected, sort, onOpen, onPreview, onToggle }: {
  records: SpellSummary[]; selected: number[]; sort: ReturnType<typeof useSpellSort<SpellBrowseSort>>
  onOpen: (id: number) => void; onPreview: (id: number, level: number) => void; onToggle: (id: number) => void
}): JSX.Element {
  return <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Client spell eligibility by level"><TableHead><TableRow>
    {([{ field: 'level', label: 'Level' }, { field: 'id', label: 'ID' }, { field: 'name', label: 'Spell / description' }, { field: 'classes', label: 'Class/Level' }, { field: 'category', label: 'Category' }, { field: 'mana', label: 'Mana' }] as const).map((c) => <SpellSortHeader key={c.field} {...c} sort={sort} />)}<TableCell>Actions</TableCell>
  </TableRow></TableHead><TableBody>{records.map((r, index) => <Fragment key={r.id}>
    {sort.field === 'level' && (index === 0 || records[index - 1].learnedLevel !== r.learnedLevel) && <TableRow><TableCell colSpan={7} sx={{ bgcolor: 'action.hover' }}><Typography variant="subtitle2">Eligible at level {r.learnedLevel ?? 'unknown'}</Typography></TableCell></TableRow>}
    <TableRow data-testid="by-level-record" data-spell-id={r.id}>
    <TableCell>{r.learnedLevel ?? '-'}</TableCell><TableCell>{r.id}</TableCell><TableCell sx={{ minWidth: 210 }}><SpellNameButton id={r.id} onOpen={onOpen}>{r.name}</SpellNameButton>
      <SpellRowRank id={r.id} name={r.name} evidence={r.rankEvidence} /><Typography variant="caption" display="block">{r.description?.slice(0, 220)}</Typography></TableCell>
    <TableCell>{r.classes.map((c) => `${c.code} ${c.level}`).join(' · ')}</TableCell><TableCell>{r.category}<Typography variant="caption" display="block">{r.subcategory}</Typography></TableCell><TableCell>{r.mana}</TableCell>
    <TableCell><Button size="small" disabled={r.learnedLevel == null} onClick={() => onPreview(r.id, r.learnedLevel ?? 1)} data-testid={`by-level-preview-${r.id}`}>Preview at {r.learnedLevel}</Button><Button size="small" disabled={!selected.includes(r.id) && selected.length >= 4} onClick={() => onToggle(r.id)} data-testid={`by-level-compare-${r.id}`}>{selected.includes(r.id) ? 'Selected' : 'Add to Compare'}</Button></TableCell>
  </TableRow></Fragment>)}</TableBody></Table></Box>
}
