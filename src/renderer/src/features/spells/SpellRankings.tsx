import { type JSX, useEffect } from 'react'
import { Alert, Button, CircularProgress, Pagination, Stack, Tab, Tabs, Typography } from '@mui/material'
import type { SpellClass } from '@shared/spellLibrary'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import type { SpellRankingCategory, SpellTargetCount } from '@shared/spellAnalysis'
import { useSpellRankings } from './useSpellRankings'
import { SpellBrowseFilters } from './SpellBrowseFilters'
import { SpellRankingTable } from './SpellRankingTable'
import { amount } from './SpellEstimate'
import { useSpellScroll } from './spellWorkspace'

const CATEGORIES: { key: SpellRankingCategory; label: string }[] = [{ key: 'dd', label: 'DD' }, { key: 'dot', label: 'DoT' }, { key: 'aoe', label: 'AOE' }, { key: 'heal', label: 'Heal' }, { key: 'hot', label: 'HoT' }]
function rankingScope(category: SpellRankingCategory, targets: SpellTargetCount): string {
  if (category === 'aoe') return `Aggregate pack total · ${targets === 'maximum' ? 'Spell maximum' : `${targets} requested targets`}`
  if (category === 'heal' || category === 'hot') return 'Per recipient · full cast'
  return 'One-target full cast · pack size does not change this ranking'
}
export function SpellRankings({ classes, level, evaluation, targets, selected, initialCategory, onFocusConsumed, onOpen, onToggle }: {
  classes: SpellClass[]; level: number; evaluation: SpellEvaluationOptions; targets: SpellTargetCount; selected: number[]; initialCategory?: SpellRankingCategory
  onOpen: (id: number, scope?: 'single' | 'pack') => void; onToggle: (id: number) => void; onFocusConsumed?: () => void
}): JSX.Element {
  const r = useSpellRankings({ classes, level, evaluation, targets, initialCategory })
  const setCategory = r.setCategory
  useEffect(() => { if (initialCategory) { setCategory(initialCategory); onFocusConsumed?.() } }, [initialCategory, setCategory, onFocusConsumed])
  const data = r.data
  useSpellScroll('rankings', !!data && !r.loading)
  return <Stack spacing={1.5} data-testid="spells-rankings">
    <Tabs value={r.categoryTab} onChange={(_e, value: SpellRankingCategory) => r.setCategory(value)} variant="scrollable" aria-label="Ranking category">{CATEGORIES.map((c) => <Tab key={c.key} value={c.key} label={`${c.label} (${data?.counts[c.key] ?? 0})`} data-testid={`rankings-tab-${c.key}`} />)}</Tabs>
    <SpellBrowseFilters {...r} hideTypes categories={data?.categories ?? []} subcategories={data?.subcategories ?? []} />
    <Typography variant="body2" data-testid="rankings-amount-scope">{rankingScope(r.categoryTab, targets)}</Typography>
    <Typography variant="caption">Rankings cover the entire filtered catalog. Amounts are full-duration modeled values; eligibility does not confirm ownership. Partial inputs are labeled. Healing is potential healing before overheal.</Typography>
    {r.error && <Alert severity="error">{r.error}</Alert>}{r.loading && <CircularProgress size={22} aria-label="Ranking spells" />}
    {data && <>
      <Stack direction="row" gap={1} flexWrap="wrap">{data.highlights.map((h) => <Button key={h.kind} variant="outlined" disabled={!h.record} onClick={() => { r.sort.selectSort(h.kind, 'desc'); r.setGroup(h.record?.mana === 0 ? 'zero-mana' : 'ranked') }}>
        {h.kind === 'efficiency' ? 'Highest amount / mana' : h.kind === 'amount' ? 'Largest cast' : 'Highest modeled rate'}: {h.record ? `${h.record.name} (${amount(highlightValue(h.record.calculation, h.kind))})` : 'Unavailable'}
      </Button>)}</Stack>
      <Tabs value={r.group} onChange={(_e, value: typeof r.group) => r.setGroup(value)} aria-label="Ranking result group" variant="scrollable"><Tab value="ranked" label={`Ranked (${data.groupCounts.ranked})`} /><Tab value="zero-mana" label={`Zero mana (${data.groupCounts.zeroMana})`} /><Tab value="excluded" label={`Unsupported (${data.groupCounts.excluded})`} /></Tabs>
      <Typography variant="caption" data-testid="spells-ranked-count">{data.total.toLocaleString()} matching {r.group} records · level {data.level} · model {data.modelVersion} · revision {data.dataset?.contentId.slice(0, 14)}</Typography>
      <SpellRankingTable records={data.records} selected={selected} sort={r.sort} onOpen={onOpen} onToggle={onToggle} />
      {!data.total && <Typography>No matching spells. Try another category or broader filters.</Typography>}
      {data.total > 40 && <Pagination count={Math.ceil(data.total / 40)} page={r.page} onChange={(_e, value) => r.setPage(value)} />}
    </>}
  </Stack>
}
function highlightValue(calculation: import('@shared/spellLibrary').SpellCalculation, kind: string): number | null {
  if (kind === 'efficiency') return calculation.perMana
  return kind === 'amount' ? calculation.total : calculation.analysis?.timing.rate ?? null
}
