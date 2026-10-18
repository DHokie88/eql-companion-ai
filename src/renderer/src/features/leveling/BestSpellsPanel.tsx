// A compact projection of the same immutable worker results as Spells. Never fall back to the
// old name-collapsing HP model: a missing catalog is a visible unavailable state, not another answer.
import { type JSX, useCallback, useEffect, useState } from 'react'
import { Alert, Button, CircularProgress, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import type { SpellAnalysisSort, SpellRankingCategory } from '@shared/spellAnalysis'
import type { SpellSortDirection } from '@shared/spellLibrary'
import { useLibraryQuery } from '../spells/useLibraryQuery'
import { useCurrentComboClasses } from './useLevelUnlocks'
import { LevelStepper } from './LevelStepper'
import type { ViewedLevel } from './viewedLevel'
import { CompactSpellControls } from './CompactSpellControls'
import { CompactSpellRankings } from './CompactSpellRankings'
import { openLevelingSpells, useLevelingSpellAnalysis, useSpellSearchText } from './useLevelingSpellAnalysis'

const TABS: { value: SpellRankingCategory; label: string }[] = [
  { value: 'dd', label: 'DD' }, { value: 'dot', label: 'DoT' }, { value: 'aoe', label: 'AOE' },
  { value: 'heal', label: 'Heal' }, { value: 'hot', label: 'HoT' }
]

export interface BestSpellsPanelProps { viewed: ViewedLevel }

/** Retain the right-column gate; uncertain classes receive an explicit state inside the panel. */
export function useBestSpellsVisible(): boolean {
  const combo = useCurrentComboClasses()
  return combo.resolved.length > 0 || combo.candidates.length > 0
}

export function BestSpellsPanel({ viewed }: BestSpellsPanelProps): JSX.Element {
  const [tab, setTab] = useState<SpellRankingCategory>('dd')
  const [sortBy, setSort] = useState<SpellAnalysisSort>('efficiency')
  const [direction, setDirection] = useState<SpellSortDirection>('desc')
  const [group, setGroup] = useState<'ranked' | 'zero-mana' | 'excluded'>('ranked')
  const [query, setQuery, text] = useSpellSearchText()
  const context = useLevelingSpellAnalysis(tab)
  const { classes, evaluation, analysis } = context
  const level = viewed.level
  const load = useCallback(async () => {
    if (!evaluation || classes.length === 0) return null
    return window.eq.spellLibrary.rankings({ classes, level, categoryTab: tab, analysis, evaluation,
      text, sortBy, direction, group, page: 1, pageSize: 40 })
  }, [classes, level, tab, analysis, evaluation, text, sortBy, direction, group])
  const result = useLibraryQuery(load)
  useEffect(() => { setGroup('ranked') }, [tab, text, level])
  const focus = { tab: 'rankings' as const, level, classes, category: tab, analysis }
  const onSort = (next: SpellAnalysisSort): void => {
    setDirection(next === sortBy && direction === 'desc' ? 'asc' : 'desc')
    setSort(next)
  }
  return <Paper variant="outlined" sx={{ p: 1.5 }} data-testid="best-spells" data-level={level} data-context={evaluation?.contextRevision ?? ''}>
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
        <Typography variant="subtitle2">Best at</Typography>
        <LevelStepper level={level} onChange={viewed.pick} testidPrefix="best-spells-level" />
        <Button size="small" onClick={() => openLevelingSpells(focus)} data-testid="best-spells-open-library">Open in Spells</Button>
      </Stack>
      <CompactSpellControls state={context.modifiers} category={tab} />
      <Tabs value={tab} onChange={(_event, value: SpellRankingCategory) => setTab(value)} variant="fullWidth" data-testid="best-spells-tabs" sx={{ minHeight: 28 }}>
        {TABS.map((item) => <Tab key={item.value} value={item.value} label={`${item.label} (${result.data?.counts[item.value] ?? 0})`} data-testid="best-spells-tab" data-tab={item.value}
          sx={{ minHeight: 28, minWidth: 0, px: 0.25, py: 0.25, fontSize: 10, textTransform: 'none' }} />)}
      </Tabs>
      <TextField size="small" placeholder="Spell name or numeric ID" value={query} onChange={(event) => setQuery(event.target.value)} slotProps={{ htmlInput: { 'data-testid': 'best-spells-search' } }} />
      {classes.length === 0 && <Alert severity="info">Resolve your character classes to rank eligible spells. Open Spells to choose classes manually.</Alert>}
      {result.error && <Alert severity="warning">Spell rankings unavailable: {result.error}</Alert>}
      {result.loading && <CircularProgress size={18} aria-label="Loading spell rankings" />}
      {result.data && <CompactSpellRankings key={`${tab}:${text}:${group}:${level}`} result={result.data} sortBy={sortBy} direction={direction} group={group} onGroup={setGroup} onSort={onSort} focus={focus} />}
      <Typography variant="caption" color="text.secondary">Client eligibility, not confirmed ownership. Efficiency uses client mana. Rate is modeled cycle DPS/HPS.</Typography>
    </Stack>
  </Paper>
}
