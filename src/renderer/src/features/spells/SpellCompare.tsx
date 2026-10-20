import { type JSX, type ReactNode, useCallback, useEffect } from 'react'
import { Alert, Button, CircularProgress, FormControl, InputLabel, MenuItem, Paper, Select, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material'
import type { SpellClass, SpellMetric } from '@shared/spellLibrary'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import type { SpellAnalysisOptions, SpellTargetCount } from '@shared/spellAnalysis'
import { useLibraryQuery } from './useLibraryQuery'
import { SpellCalculationTable } from './SpellCalculationTable'
import { useSpellWorkspaceState } from './spellWorkspace'

export function SpellCompare({ ids, level, evaluation, targets, initialScope, onFocusConsumed, onRemove, onClear, onOpen, controls }: {
  ids: number[]; classes: SpellClass[]; level: number; evaluation: SpellEvaluationOptions; targets: SpellTargetCount
  onRemove: (id: number) => void; onClear: () => void; onOpen: (id: number) => void
  initialScope?: SpellAnalysisOptions['scope']; onFocusConsumed?: () => void
  controls?: ReactNode
}): JSX.Element {
  const [metric, setMetric] = useSpellWorkspaceState<SpellMetric>('compare-metric', 'damage')
  const [scope, setScope] = useSpellWorkspaceState<SpellAnalysisOptions['scope']>('compare-scope', 'single')
  const [reference, setReference] = useSpellWorkspaceState<number | null>('compare-reference', null)
  useEffect(() => { if (initialScope) { setScope(initialScope); onFocusConsumed?.() } }, [initialScope, setScope, onFocusConsumed])
  const idsKey = ids.join(',')
  const load = useCallback(() => window.eq.spellLibrary.compare({ ids: idsKey ? idsKey.split(',').map(Number) : [], level, metric, evaluation, analysis: { scope, targets } }), [idsKey, level, metric, evaluation, scope, targets])
  const { data, error, loading } = useLibraryQuery(load)
  const referenceId = reference !== null && ids.includes(reference) ? reference : ids[0]
  return <Stack spacing={2} data-testid="spells-compare">
    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
      <Typography variant="h6">Selected spells · level {level}</Typography>
      <Button size="small" variant="outlined" data-testid="spells-clear-comparison" disabled={!ids.length} onClick={onClear}>Clear all</Button>
    </Stack>
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}><Stack spacing={2}>{controls}<Stack direction="row" gap={1} flexWrap="wrap">
      <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel id="spell-metric-label">Metric</InputLabel><Select labelId="spell-metric-label" label="Metric" value={metric} data-testid="spells-metric" onChange={(e) => setMetric(e.target.value as SpellMetric)}><MenuItem value="damage">Damage</MenuItem><MenuItem value="healing">Healing</MenuItem></Select></FormControl>
      <ToggleButtonGroup size="small" exclusive value={scope} onChange={(_e, value: typeof scope | null) => { if (value) setScope(value) }} aria-label="Comparison amount scope"><ToggleButton value="single">One-target full cast</ToggleButton><ToggleButton value="pack">Aggregate pack total</ToggleButton></ToggleButtonGroup>
      <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel id="compare-reference-label">Reference spell</InputLabel><Select labelId="compare-reference-label" label="Reference spell" value={referenceId ?? ''} data-testid="compare-reference" onChange={(e) => setReference(Number(e.target.value))}>
        {(data?.results ?? []).map((r) => <MenuItem key={r.id} value={r.id}>{r.name} ({r.id})</MenuItem>)}
      </Select></FormControl>
    </Stack></Stack></Paper>
    <Tooltip disableInteractive title="Differences use matching spell files, level, value mode, and targets. Totals assume no resists, critical hits, overheal, or interruptions. Percent changes are unavailable for zero or unknown references."><Typography variant="caption" color="text.secondary">Full-cast comparison · healing is per recipient.</Typography></Tooltip>
    {!ids.length && <Typography>Add up to four spells from Browse or Progression.</Typography>}
    {error && <Alert severity="error">{error}</Alert>}{loading && <CircularProgress size={22} />}
    {!!ids.length && data && <><SpellCalculationTable rows={data.results} rankEvidence={data.rankEvidence} referenceId={referenceId} onOpen={onOpen} onRemove={onRemove} /><Typography variant="caption" color="text.secondary">{data.scope}</Typography></>}
  </Stack>
}
