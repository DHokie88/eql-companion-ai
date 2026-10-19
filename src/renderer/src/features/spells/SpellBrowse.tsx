import type { JSX } from 'react'
import { Alert, Box, CircularProgress, Pagination, Stack, Typography } from '@mui/material'
import type { SpellClass } from '@shared/spellLibrary'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import type { SpellAnalysisOptions } from '@shared/spellAnalysis'
import { useSpellBrowse } from './useSpellBrowse'
import { SpellBrowseFilters } from './SpellBrowseFilters'
import { SpellBrowseTable } from './SpellBrowseTable'
import { useSpellScroll } from './spellWorkspace'

function ResultCount({ total, contentId }: { total: number; contentId?: string }): JSX.Element {
  return <Typography variant="caption" color="text.secondary">{total.toLocaleString()} matching records · IDs and ranks are preserved · revision {contentId?.slice(0, 14) ?? 'no baseline'}. Column sorting covers all matches before pagination; unknown values sort last.</Typography>
}

export function SpellBrowse({ classes, level, evaluation, analysis, allSpells, enabled, selected, onToggle, onOpen }: {
  classes: SpellClass[]; level: number; allSpells: boolean; enabled: boolean; selected: number[]
  evaluation: SpellEvaluationOptions
  analysis?: SpellAnalysisOptions
  onToggle: (id: number) => void; onOpen: (id: number) => void
}): JSX.Element {
  const browse = useSpellBrowse({ classes, level, evaluation, allSpells, selected, analysis, enabled })
  const { data, loading, error } = browse
  useSpellScroll('browse', Boolean(data))
  if (!enabled) return <Box />
  return <Stack spacing={1.5} data-testid="spells-browse">
    <SpellBrowseFilters {...browse} categories={data?.categories ?? []} subcategories={data?.subcategories ?? []} />
    {error && <Alert severity="error">{error}</Alert>}
    {loading && <CircularProgress size={22} aria-label="Searching spells" />}
    {data && <>
      <ResultCount total={data.total} contentId={data.dataset?.contentId} />
      <SpellBrowseTable records={data.records} selected={selected} sort={browse.sort} filters={browse.filters} onOpen={onOpen} onToggle={onToggle} />
      {data.total === 0 && <Typography>No matching spells in this captured dataset.</Typography>}
      {data.total > 40 && <Pagination count={Math.ceil(data.total / 40)} page={browse.page} onChange={(_e, value) => browse.setPage(value)} data-testid="spells-pagination" />}
    </>}
  </Stack>
}
