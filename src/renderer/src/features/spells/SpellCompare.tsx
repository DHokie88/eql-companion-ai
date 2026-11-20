import { type JSX, type ReactNode, useCallback, useEffect, useState } from 'react'
import { Alert, Button, CircularProgress, FormControl, InputLabel, MenuItem, Paper, Select, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material'
import type { SpellClass, SpellComparisonResult } from '@shared/spellLibrary'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import type { SpellAnalysisOptions, SpellTargetCount } from '@shared/spellAnalysis'
import { useLibraryQuery } from './useLibraryQuery'
import { compareColumns, DEFAULT_COMPARE_COLUMNS, SpellCalculationTable } from './SpellCalculationTable'
import { useSpellWorkspaceState } from './spellWorkspace'
import { SpellRankSlider } from './SpellBrowseToolbar'
import { BrowseColumnPicker } from './SpellBrowseAnalysis'
import { hitPointMetric, SPELL_COMPARE_LABELS, SPELL_COMPARE_METRICS, type SpellCompareMetric, type SpellCompareMetricChoice } from '@shared/spellCompareMetric'
import { compareColumnPreset, useSpellColumnSelection } from './spellColumnPresets'

export function SpellCompare({ ids, level, evaluation, targets, initialScope, onFocusConsumed, onRemove, onClear, onOpen, controls }: {
  ids: number[]; classes: SpellClass[]; level: number; evaluation: SpellEvaluationOptions; targets: SpellTargetCount
  onRemove: (id: number) => void; onClear: () => void; onOpen: (id: number, scope: SpellAnalysisOptions['scope']) => void
  initialScope?: SpellAnalysisOptions['scope']; onFocusConsumed?: () => void
  controls?: ReactNode
}): JSX.Element {
  const [choice, setChoice] = useState<SpellCompareMetricChoice>('auto')
  const [scope, setScope] = useSpellWorkspaceState<SpellAnalysisOptions['scope']>('compare-scope', 'single')
  const [reference, setReference] = useSpellWorkspaceState<number | null>('compare-reference', null)
  useEffect(() => { if (initialScope) { setScope(initialScope); onFocusConsumed?.() } }, [initialScope, setScope, onFocusConsumed])
  const idsKey = ids.join(',')
  const load = useCallback(() => window.eq.spellLibrary.compare({ ids: idsKey ? idsKey.split(',').map(Number) : [], level, metric: choice, evaluation,
    analysis: { scope, targets, rainWithinPack: scope === 'single' }, browseRank: true, includeSummary: true, includeEffects: true }), [idsKey, level, choice, evaluation, scope, targets])
  const { data, error, loading } = useLibraryQuery(load)
  const metric = choice === 'auto' ? data?.metric ?? 'damage' : choice
  const hp = hitPointMetric(metric)
  const suggested = compareColumnPreset(metric)
  const columnSelection = useSpellColumnSelection('compare-columns', DEFAULT_COMPARE_COLUMNS, suggested, hp ? undefined : suggested)
  const referenceId = reference !== null && ids.includes(reference) ? reference : ids[0]
  const visible = compareColumns(columnSelection.columns, metric)
  return <Stack spacing={2} data-testid="spells-compare">
    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
      <Typography variant="h6">Selected spells · level {level}</Typography>
      <Button size="small" variant="outlined" data-testid="spells-clear-comparison" disabled={!ids.length} onClick={onClear}>Clear all</Button>
    </Stack>
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}><Stack spacing={2}>{controls}<SpellRankSlider />
      <Stack direction="row" gap={1} flexWrap="wrap">
      <CompareMetricPicker choice={choice} onChange={setChoice} detected={data?.results.length ? data.metric : undefined} />
      {hp && <CompareScopePicker scope={scope} onChange={setScope} />}
      <CompareReferencePicker data={data} referenceId={referenceId} onChange={setReference} />
      <BrowseColumnPicker metric={hp ?? 'damage'} {...columnSelection} columnCount={visible.length} />
    </Stack></Stack></Paper>
    <CompareResults data={data} empty={!ids.length} error={error} loading={loading} showHp={hp !== null} columns={visible} referenceId={referenceId} onOpen={(id) => onOpen(id, scope)} onRemove={onRemove} />
  </Stack>
}

function CompareMetricPicker({ choice, onChange, detected }: { choice: SpellCompareMetricChoice; onChange: (choice: SpellCompareMetricChoice) => void; detected?: SpellCompareMetric }): JSX.Element {
  return <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel id="spell-metric-label">Metric</InputLabel>
    <Select labelId="spell-metric-label" label="Metric" value={choice} data-testid="spells-metric"
      renderValue={(value) => value === 'auto' ? detected ? `Auto · ${SPELL_COMPARE_LABELS[detected]}` : 'Auto' : SPELL_COMPARE_LABELS[value]}
      onChange={(event) => onChange(event.target.value as SpellCompareMetricChoice)}>
      <MenuItem value="auto">Auto</MenuItem>
      {SPELL_COMPARE_METRICS.map((value) => <MenuItem key={value} value={value}>{SPELL_COMPARE_LABELS[value]}</MenuItem>)}
    </Select>
  </FormControl>
}
function CompareScopePicker({ scope, onChange }: { scope: SpellAnalysisOptions['scope']; onChange: (scope: SpellAnalysisOptions['scope']) => void }): JSX.Element {
  return <ToggleButtonGroup size="small" exclusive value={scope} onChange={(_event, value: typeof scope | null) => { if (value) onChange(value) }} aria-label="Comparison amount scope">
    <ToggleButton value="single" title="For rain spells, shows hits on one enemy in the selected pack.">One-target full cast</ToggleButton>
    <ToggleButton value="pack">Aggregate pack total</ToggleButton>
  </ToggleButtonGroup>
}
function CompareReferencePicker({ data, referenceId, onChange }: { data: SpellComparisonResult | null; referenceId?: number; onChange: (id: number) => void }): JSX.Element {
  return <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel id="compare-reference-label">Reference spell</InputLabel>
    <Select labelId="compare-reference-label" label="Reference spell" value={referenceId ?? ''} data-testid="compare-reference" onChange={(event) => onChange(Number(event.target.value))}>
      {(data?.results ?? []).map((row) => <MenuItem key={row.id} value={row.id}>{row.name} ({row.id})</MenuItem>)}
    </Select>
  </FormControl>
}
function CompareResults({ data, empty, error, loading, showHp, columns, referenceId, onOpen, onRemove }: {
  data: SpellComparisonResult | null; empty: boolean; error: string | null; loading: boolean; showHp: boolean
  columns: ReturnType<typeof compareColumns>; referenceId?: number; onOpen: (id: number) => void; onRemove: (id: number) => void
}): JSX.Element {
  return <>
    {showHp && <Tooltip disableInteractive title="Differences use matching spell files, level, value mode, and targets. Totals assume no resists, critical hits, overheal, or interruptions. Percent changes are unavailable for zero or unknown references."><Typography variant="caption" color="text.secondary">Full-cast comparison · healing is per recipient.</Typography></Tooltip>}
    {empty && <Typography>Add up to four spells from Browse or Progression.</Typography>}
    {error && <Alert severity="error">{error}</Alert>}{loading && <CircularProgress size={22} />}
    {!empty && data && <><SpellCalculationTable rows={data.results} summaries={data.summaries} columns={columns} rankEvidence={data.rankEvidence} browseRank={data.browseRank} referenceId={referenceId} onOpen={onOpen} onRemove={onRemove} /><Typography variant="caption" color="text.secondary">{data.scope}</Typography></>}
  </>
}
