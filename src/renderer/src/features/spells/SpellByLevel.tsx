import { Fragment, type JSX, type ReactNode, useCallback } from 'react'
import { Alert, Box, Button, CircularProgress, Pagination, Stack, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import type { SpellBrowseSort, SpellClass, SpellSummary } from '@shared/spellLibrary'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import { useLibraryQuery } from './useLibraryQuery'
import { useSearchText } from './useSearchText'
import { SpellNameButton, SpellSortHeader, useSpellSort, visibleSpellSort } from './SpellTableControls'
import { useSpellPageReset, useSpellScroll, useSpellWorkspaceState } from './spellWorkspace'
import { SpellRowRank } from './SpellRowRank'
import { SpellRankSlider } from './SpellBrowseToolbar'
import { SpellBrowseFilters } from './SpellBrowseFilters'
import { browseFilterError, defaultBrowseFilters, type BrowseFilters } from './useSpellBrowse'
import type { SpellAnalysisOptions } from '@shared/spellAnalysis'
import { BrowseColumnPicker } from './SpellBrowseAnalysis'
import { browseColumns, type BrowseDisplayField } from './spellBrowseColumns'
import { SpellDataCell } from './SpellBrowseTable'
import { filterColumnPreset, useSpellColumnSelection } from './spellColumnPresets'

const PROGRESSION_LEVELS = { min: 1, max: 255 }
const PROGRESSION_COLUMNS: BrowseDisplayField[] = ['level', 'id', 'rank', 'classes', 'description', 'category', 'mana', 'selected', 'preview']
const FOLLOW_PROGRESSION_LEVELS: { min: number | null; max: number | null } = { min: null, max: null }

export function SpellByLevel({ classes, level, evaluation, analysis, selected, onPreview, onToggle, controls, enabled = true }: {
  classes: SpellClass[]; level: number; evaluation: SpellEvaluationOptions; selected: number[]
  analysis: SpellAnalysisOptions; onPreview: (id: number, level: number) => void; onToggle: (id: number) => void
  controls?: ReactNode; enabled?: boolean
}): JSX.Element {
  const state = useByLevel({ classes, level, evaluation, analysis, selected, enabled })
  const { data, error, loading } = state
  useSpellScroll('by-level', !!data && !loading)
  return <Stack spacing={1.5} data-testid="spells-by-level">
    <SpellBrowseFilters {...state} levelLimits={PROGRESSION_LEVELS} categories={data?.categories ?? []} subcategories={data?.subcategories ?? []}
      controls={<ProgressionControls state={state} controls={controls} />} columns={<BrowseColumnPicker {...state} view="progression" columnCount={state.tableColumns.length} />} />
    <SpellRankSlider />
    {error && <Alert severity="error">{error}</Alert>}{loading && <CircularProgress size={22} />}
    {!enabled && <Typography>Select classes or choose All to see spells.</Typography>}
    {enabled && <ProgressionResults state={state} classes={classes} selected={selected} onOpen={(id) => onPreview(id, state.level)} onPreview={onPreview} onToggle={onToggle} />}
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
    <ByLevelTable records={data.records} selected={selected} sort={sort} columns={state.tableColumns} onOpen={onOpen} onPreview={onPreview} onToggle={onToggle} />
    {!data.total && <Typography>No spells become eligible in this range.</Typography>}
    {data.total > 40 && <Pagination page={page} count={Math.ceil(data.total / 40)} onChange={(_e, value) => setPage(value)} />}
  </>
}
function ProgressionControls({ state, controls }: { state: ReturnType<typeof useByLevel>; controls?: ReactNode }): JSX.Element {
  const { view, setView, level, setPage, followCharacter } = state
  return <Stack spacing={1}>{controls}<Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
    <Tabs value={view} onChange={(_e, value: typeof view) => { setView(value); setPage(1) }}><Tab value="at" label={`At level ${level}`} /><Tab value="upcoming" label="Upcoming" /></Tabs>
    {followCharacter && <Button size="small" onClick={followCharacter}>Use character level</Button>}
  </Stack></Stack>
}
function useByLevel({ classes, level: detectedLevel, evaluation, analysis, selected, enabled }: {
  classes: SpellClass[]; level: number; evaluation: SpellEvaluationOptions; analysis: SpellAnalysisOptions; selected: number[]; enabled: boolean
}) {
  const [view, setView] = useSpellWorkspaceState<'at' | 'upcoming'>('by-level-view', 'at')
  const [page, setPage] = useSpellWorkspaceState('by-level-page', 1)
  const [text, setText] = useSpellWorkspaceState('by-level-search', '')
  const [savedFilters, setFilters] = useSpellWorkspaceState('progression-filters', defaultBrowseFilters())
  const [range, setRange] = useSpellWorkspaceState('progression-level-range', FOLLOW_PROGRESSION_LEVELS)
  const level = range.min ?? detectedLevel
  const maximum = String(Math.max(level, range.max ?? Math.min(255, detectedLevel + 10)))
  const filters = { ...savedFilters, text, min: String(level), max: maximum }
  const columnSelection = useSpellColumnSelection('progression-columns', { view: 'progression', baseline: PROGRESSION_COLUMNS, inferred: filterColumnPreset(filters) })
  const invalid = browseFilterError(filters, maximum)
  const { category, subcategory, effect, type, polarity, mana, hpFilter } = filters
  const metric = hpFilter === 'healing' || type === 'heal' || type === 'hot' ? 'healing' as const : 'damage' as const
  const tableColumns = browseColumns(metric, 'both', columnSelection.columns, { view: 'progression' })
  const sort = visibleSpellSort(useSpellSort<SpellBrowseSort>('level', 'asc', 'by-level'), tableColumns, 'name')
  const queryText = useSearchText(text), classKey = classes.join(',')
  const selectedKey = sort.field === 'selected' ? selected.join(',') : ''
  useSpellPageReset(`${classKey}:${level}:${maximum}:${view}:${sort.field}:${sort.direction}:${selectedKey}`, setPage)
  const includeEffects = columnSelection.columns.includes('spa')
  const load = useCallback(() => {
    if (invalid) return Promise.reject(new Error(invalid))
    return window.eq.spellLibrary.byLevel({ classes: classKey ? classKey.split(',') as SpellClass[] : [], level,
      throughLevel: view === 'at' ? level : Number(maximum), view: 'range', page, pageSize: 40, evaluation, analysis, includeEffects, browseRank: true, text: queryText,
      sortBy: sort.field, direction: sort.direction, selectedIds: selectedKey ? selectedKey.split(',').map(Number) : undefined,
      category: category || undefined, subcategory: subcategory || undefined, effect: effect ? Number(effect) : undefined,
      type: type || undefined, polarity: polarity || undefined, mana: mana || undefined, hpFilter: hpFilter || undefined })
  }, [classKey, level, view, page, evaluation, analysis, includeEffects, queryText, sort.field, sort.direction, selectedKey, category, subcategory, effect, type, polarity, mana, hpFilter, maximum, invalid])
  const change = <K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]): void => {
    if (key === 'text') setText(String(value))
    else if (key === 'min' || key === 'max') setRange((previous) => ({ ...previous, [key]: Number(value) }))
    else setFilters((previous) => ({ ...previous, [key]: value, ...(key === 'category' ? { subcategory: '' } : {}), ...(key === 'type' ? { hpFilter: '' } : key === 'hpFilter' ? { type: '' } : {}) }))
    setPage(1)
  }
  const reset = (): void => { setFilters(defaultBrowseFilters()); setRange(FOLLOW_PROGRESSION_LEVELS); setText(''); setPage(1) }
  const followCharacter = range.min !== null ? () => {
    setRange(({ max }) => ({ min: null, max: max !== null && max >= detectedLevel ? max : null })); setPage(1)
  } : undefined
  return { ...useLibraryQuery(load, undefined, enabled), ...columnSelection, tableColumns, view, setView, level, followCharacter, page, setPage, sort, filters, maximum, invalid, change, reset, metric }
}
function ByLevelTable({ records, selected, sort, columns, onOpen, onPreview, onToggle }: {
  records: SpellSummary[]; selected: number[]; sort: ReturnType<typeof useSpellSort<SpellBrowseSort>>
  columns: ReturnType<typeof browseColumns>
  onOpen: (id: number) => void; onPreview: (id: number, level: number) => void; onToggle: (id: number) => void
}): JSX.Element {
  return <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Client spell eligibility by level"><TableHead><TableRow>
    {columns.map(({ field, label }) => field === 'rank' || field === 'spa' || field === 'preview' ? <TableCell key={field}>{label}</TableCell> : <SpellSortHeader key={field} field={field as SpellBrowseSort} label={label} sort={sort} />)}
  </TableRow></TableHead><TableBody>{records.map((r, index) => <Fragment key={r.id}>
    {sort.field === 'level' && (index === 0 || records[index - 1].learnedLevel !== r.learnedLevel) && <TableRow><TableCell colSpan={columns.length} sx={{ bgcolor: 'action.hover' }}><Typography variant="subtitle2">Eligible at level {r.learnedLevel ?? 'unknown'}</Typography></TableCell></TableRow>}
    <TableRow data-testid="by-level-record" data-spell-id={r.id}>
      {columns.map(({ field }) => <TableCell key={field} sx={field === 'name' ? { minWidth: 180 } : undefined}>
        <ProgressionCell field={field} record={r} selected={selected} onOpen={onOpen} onPreview={onPreview} onToggle={onToggle} />
      </TableCell>)}
    </TableRow></Fragment>)}</TableBody></Table></Box>
}

function ProgressionCell({ field, record, selected, onOpen, onPreview, onToggle }: {
  field: BrowseDisplayField; record: SpellSummary; selected: number[]; onOpen: (id: number) => void; onPreview: (id: number, level: number) => void; onToggle: (id: number) => void
}): JSX.Element {
  if (field === 'name') return <SpellNameButton id={record.id} onOpen={onOpen}>{record.name}</SpellNameButton>
  if (field === 'level') return <>{record.learnedLevel ?? '-'}</>
  if (field === 'preview') return <Button size="small" disabled={record.learnedLevel == null} onClick={() => onPreview(record.id, record.learnedLevel ?? 1)} data-testid={`by-level-preview-${record.id}`}>Preview at {record.learnedLevel}</Button>
  if (field === 'rank') return <SpellRowRank id={record.id} name={record.name} browseRank={record.browseRank} readOnly />
  if (field === 'selected') return <Button size="small" disabled={!selected.includes(record.id) && selected.length >= 4} onClick={() => onToggle(record.id)} data-testid={`by-level-compare-${record.id}`}>{selected.includes(record.id) ? 'Selected' : 'Add to Compare'}</Button>
  return <SpellDataCell record={record} field={field} />
}
