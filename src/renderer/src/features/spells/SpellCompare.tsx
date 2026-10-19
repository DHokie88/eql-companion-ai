import { type JSX, useCallback, useEffect } from 'react'
import { Alert, CircularProgress, FormControl, InputLabel, MenuItem, Select, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import type { SpellClass, SpellMetric } from '@shared/spellLibrary'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import type { SpellAnalysisOptions, SpellTargetCount } from '@shared/spellAnalysis'
import { useLibraryQuery } from './useLibraryQuery'
import { SpellCalculationTable } from './SpellCalculationTable'
import { useSpellWorkspaceState } from './spellWorkspace'

export function SpellCompare({ ids, level, evaluation, targets, initialScope, onFocusConsumed, onRemove, onOpen }: {
  ids: number[]; classes: SpellClass[]; level: number; evaluation: SpellEvaluationOptions; targets: SpellTargetCount
  onRemove: (id: number) => void; onOpen: (id: number) => void
  initialScope?: SpellAnalysisOptions['scope']; onFocusConsumed?: () => void
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
    <Typography variant="h6">Selected spells · level {level}</Typography>
    <Stack direction="row" gap={1} flexWrap="wrap">
      <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel id="spell-metric-label">Metric</InputLabel><Select labelId="spell-metric-label" label="Metric" value={metric} data-testid="spells-metric" onChange={(e) => setMetric(e.target.value as SpellMetric)}><MenuItem value="damage">Damage</MenuItem><MenuItem value="healing">Healing</MenuItem></Select></FormControl>
      <ToggleButtonGroup size="small" exclusive value={scope} onChange={(_e, value: typeof scope | null) => { if (value) setScope(value) }} aria-label="Comparison amount scope"><ToggleButton value="single">One-target full cast</ToggleButton><ToggleButton value="pack">Aggregate pack total</ToggleButton></ToggleButtonGroup>
      <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel id="compare-reference-label">Reference spell</InputLabel><Select labelId="compare-reference-label" label="Reference spell" value={referenceId ?? ''} data-testid="compare-reference" onChange={(e) => setReference(Number(e.target.value))}>
        {(data?.results ?? []).map((r) => <MenuItem key={r.id} value={r.id}>{r.name} ({r.id})</MenuItem>)}
      </Select></FormControl>
    </Stack>
    <Alert severity="info">Differences use one dataset, caster level, value mode, and target scenario. Full-duration totals are potential effects before resists, critical hits, overheal, or interruptions. Healing remains per recipient. Percentage differences are unavailable for zero or unknown references.</Alert>
    {!ids.length && <Typography>Add up to four spells from Browse, Rankings, or By level.</Typography>}
    {error && <Alert severity="error">{error}</Alert>}{loading && <CircularProgress size={22} />}
    {data && <><SpellCalculationTable rows={data.results} rankEvidence={data.rankEvidence} referenceId={referenceId} onOpen={onOpen} onRemove={onRemove} /><Typography variant="caption" color="text.secondary">{data.scope}</Typography></>}
  </Stack>
}
