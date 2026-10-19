import { type JSX, type ReactNode, useEffect } from 'react'
import { Alert, CircularProgress, Pagination, Stack, Tooltip, Typography } from '@mui/material'
import type { SpellClass } from '@shared/spellLibrary'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import type { SpellAnalysisOptions, SpellRankingCategory } from '@shared/spellAnalysis'
import { useSpellBrowse } from './useSpellBrowse'
import { SpellBrowseFilters } from './SpellBrowseFilters'
import { SpellBrowseTable } from './SpellBrowseTable'
import { useSpellScroll } from './spellWorkspace'
import { BrowseColumnPicker, BrowseGroups, BrowseHighlights } from './SpellBrowseAnalysis'

function ResultCount({ total, matching = total, contentId }: { total: number; matching?: number; contentId?: string }): JSX.Element {
  return <Tooltip title={`Sorted across all matching records before pagination; unknown values sort last. Captured revision ${contentId?.slice(0, 14) ?? 'no baseline'}. Numeric spell identities and rank observations are preserved.`}><Typography variant="caption" color="text.secondary">{matching.toLocaleString()} matching spells{total !== matching ? ` · ${total.toLocaleString()} rows with Best in line` : ''}</Typography></Tooltip>
}
function BrowseResults({ browse, selected, onOpen, onToggle }: {
  browse: ReturnType<typeof useSpellBrowse>; selected: number[]; onOpen: (id: number) => void; onToggle: (id: number) => void
}): JSX.Element {
  const { data, loading, error } = browse
  return <>
    {error && <Alert severity="error">{error}</Alert>}
    {loading && <CircularProgress size={22} aria-label="Searching spells" />}
    {data && <>
      <BrowseHighlights highlights={data.highlights} onSelect={(kind, group) => { browse.sort.selectSort(kind, 'desc'); browse.setGroup(group); browse.setPage(1) }} />
      <BrowseGroups group={browse.group} onChange={browse.setGroup} counts={data.groupCounts} />
      <ResultCount total={data.total} matching={data.matchingRecords} contentId={data.dataset?.contentId} />
      <SpellBrowseTable uniformType={data.matchingTypes?.length === 1} records={data.records} selected={selected} sort={browse.sort} filters={{ ...browse.filters, category: browse.filters.category || ((browse.filters.type || browse.filters.hpFilter) && data.matchingCategories?.length === 1 ? data.matchingCategories[0] : '') }} metric={browse.metric} columns={browse.columns} onOpen={onOpen} onToggle={onToggle} />
      {data.total === 0 && <Typography>No matching spells in this captured dataset.</Typography>}
      {data.total > 40 && <Pagination count={Math.ceil(data.total / 40)} page={browse.page} onChange={(_e, value) => browse.setPage(value)} data-testid="spells-pagination" />}
    </>}
  </>
}

export function SpellBrowse({ classes, level, evaluation, analysis, allSpells, enabled, selected, controls, bestInLine = false, initialCategory, onFocusConsumed, onToggle, onOpen }: {
  classes: SpellClass[]; level: number; allSpells: boolean; enabled: boolean; selected: number[]
  evaluation: SpellEvaluationOptions
  analysis?: SpellAnalysisOptions
  controls?: ReactNode
  bestInLine?: boolean
  initialCategory?: SpellRankingCategory; onFocusConsumed?: () => void
  onToggle: (id: number) => void; onOpen: (id: number) => void
}): JSX.Element {
  const browse = useSpellBrowse({ classes, level, evaluation, allSpells, selected, analysis, enabled, bestInLine })
  const { data } = browse
  const focusCategory = browse.focusCategory
  useEffect(() => { if (initialCategory) { focusCategory(initialCategory); onFocusConsumed?.() } }, [initialCategory, focusCategory, onFocusConsumed])
  useSpellScroll('browse', Boolean(data) && enabled)
  return <Stack spacing={1.5} data-testid="spells-browse">
    <SpellBrowseFilters {...browse} controls={controls} columns={<BrowseColumnPicker {...browse} />} categories={data?.categories ?? []} subcategories={data?.subcategories ?? []} typeOptions={data?.typeOptions} />
    {enabled ? <BrowseResults browse={browse} selected={selected} onOpen={onOpen} onToggle={onToggle} /> : <Alert severity="info">Choose one or more classes, or select All classes to browse spells.</Alert>}
  </Stack>
}
