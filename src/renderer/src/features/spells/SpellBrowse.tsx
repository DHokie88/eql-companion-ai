import { type JSX, type ReactNode, useEffect } from 'react'
import { Alert, CircularProgress, Pagination, Stack, Tooltip, Typography } from '@mui/material'
import type { SpellClass } from '@shared/spellLibrary'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import type { SpellAnalysisOptions, SpellRankingCategory } from '@shared/spellAnalysis'
import { browseCategory, useSpellBrowse } from './useSpellBrowse'
import { SpellBrowseFilters } from './SpellBrowseFilters'
import { SpellBrowseTable } from './SpellBrowseTable'
import { useSpellScroll } from './spellWorkspace'
import { BrowseColumnPicker, BrowseGroups } from './SpellBrowseAnalysis'
import { SpellBrowseToolbar } from './SpellBrowseToolbar'
import { hideUniformTypeColumn } from './spellBrowseColumns'

function browseMaxCaption({ manual, effective, autoMax, levelCaption }: { manual: string | null; effective: number; autoMax: number; levelCaption?: string }): string | undefined {
  if (manual) return undefined
  if (effective > autoMax) return `Max held at the minimum · ${levelCaption ?? `Automatic max ${autoMax}`}`
  return levelCaption
}

function browseColumnDisplay(category: string, subcategory: string): 'both' | 'subcategory' | 'none' {
  if (!category) return 'both'
  if (subcategory) return 'none'
  return 'subcategory'
}
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
      <BrowseGroups group={browse.group} onChange={browse.setGroup} counts={data.groupCounts} />
      <ResultCount total={data.total} matching={data.matchingRecords} contentId={data.dataset?.contentId} />
      <SpellBrowseTable uniformType={hideUniformTypeColumn(browse.filters.type, data.matchingTypes)} records={data.records} selected={selected} sort={browse.sort} filters={{ ...browse.filters, category: browseCategory(browse.filters, data) }} metric={browse.metric} columns={browse.columns} onOpen={onOpen} onToggle={onToggle} />
      {data.total === 0 && <Typography>No matching spells in this captured dataset.</Typography>}
      {data.total > 40 && <Pagination count={Math.ceil(data.total / 40)} page={browse.page} onChange={(_e, value) => browse.setPage(value)} data-testid="spells-pagination" />}
    </>}
  </>
}

export function SpellBrowse({ classes, level, autoMax, levelCaption, characterKey = '', evaluation, analysis, allSpells, enabled, selected, controls, bestInLine = false, initialCategory, onFocusConsumed, onToggle, onOpen }: {
  classes: SpellClass[]; level: number; autoMax: number; levelCaption?: string; characterKey?: string; allSpells: boolean; enabled: boolean; selected: number[]
  evaluation: SpellEvaluationOptions
  analysis?: SpellAnalysisOptions
  controls?: ReactNode
  bestInLine?: boolean
  initialCategory?: SpellRankingCategory; onFocusConsumed?: () => void
  onToggle: (id: number) => void; onOpen: (id: number) => void
}): JSX.Element {
  const browse = useSpellBrowse({ classes, level, autoMax, evaluation, allSpells, selected, analysis, enabled, bestInLine })
  const { data } = browse
  const focusCategory = browse.focusCategory
  const category = browseCategory(browse.filters, data)
  const columnDisplay = browseColumnDisplay(category, browse.filters.subcategory)
  const uniformType = hideUniformTypeColumn(browse.filters.type, data?.matchingTypes)
  const maxCaption = browseMaxCaption({ manual: browse.filters.max, effective: Number(browse.maximum), autoMax, levelCaption })
  useEffect(() => { if (initialCategory) { focusCategory(initialCategory); onFocusConsumed?.() } }, [initialCategory, focusCategory, onFocusConsumed])
  useSpellScroll('browse', Boolean(data) && enabled)
  return <Stack spacing={1.5} data-testid="spells-browse">
    <SpellBrowseFilters {...browse} characterKey={characterKey} levelCaption={maxCaption} controls={controls} columns={<BrowseColumnPicker {...browse} display={columnDisplay} uniformType={uniformType} />} categories={data?.categories ?? []} subcategories={data?.subcategories ?? []} typeOptions={data?.typeOptions} />
    <SpellBrowseToolbar era={browse.era} onEra={browse.setEra} />
    {enabled ? <BrowseResults browse={browse} selected={selected} onOpen={onOpen} onToggle={onToggle} /> : <Alert severity="info">Choose one or more classes, or select All classes to browse spells.</Alert>}
  </Stack>
}
