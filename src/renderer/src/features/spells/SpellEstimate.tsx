import type { JSX } from 'react'
import { Chip, Stack, Tooltip, Typography } from '@mui/material'
import type { SpellCalculation } from '@shared/spellLibrary'
import type { SpellAnalysisTiming } from '@shared/spellAnalysis'
import { SpellCastSummary } from './SpellCastSummary'

export function amount(value: number | null): string {
  return value === null ? 'Excluded' : value.toLocaleString(undefined, { maximumFractionDigits: 3 })
}
export function efficiencyAmount(value: number | null): string {
  return value === null ? 'Excluded' : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
export function wholeAmount(value: number | null): string { return value === null ? '-' : Math.round(value).toLocaleString() }

export function EstimateAmount({ calculation, compact = false }: { calculation: SpellCalculation; compact?: boolean }): JSX.Element {
  const modifier = calculation.modifiers
  if (compact) return <CompactEstimateAmount calculation={calculation} />
  const changedMode = modifier && modifier.mode !== 'client'
  return <Stack spacing={0.25} data-testid={`spells-amount-${calculation.id}-${calculation.metric}`}>
    <Typography variant="body2">
      {changedMode && `${amount(modifier.baseline.total)} → `}{amount(calculation.total)}
    </Typography>
    {modifier?.range && changedMode && <Typography variant="caption">Range {amount(modifier.range.min)} - {amount(modifier.range.max)}</Typography>}
    <EstimateBadges calculation={calculation} />
    {calculation.analysis?.partial && <Chip size="small" color="warning" variant="outlined" label="Partial scenario" />}
  </Stack>
}

function CompactEstimateAmount({ calculation }: { calculation: SpellCalculation }): JSX.Element {
  const modifier = calculation.modifiers
  const title = [
    fullCastEstimate(calculation),
    baseEffectEstimate(calculation),
    modifier?.rankOnly ? 'Equipment estimates are available in spell details.' : '',
    modifier?.range ? `Focus roll ${amount(modifier.range.min)} - ${amount(modifier.range.max)}.` : '',
    ...new Set([...(modifier?.warnings ?? []), ...(calculation.analysis?.warnings ?? []), ...calculation.reasons])
  ].filter(Boolean).join(' ')
  return <Tooltip disableInteractive describeChild title={title}>
    <Typography tabIndex={0} variant="body2" data-testid={`spells-amount-${calculation.id}-${calculation.metric}`} sx={{ whiteSpace: 'nowrap' }}>{wholeAmount(calculation.total)}</Typography>
  </Tooltip>
}

function fullCastEstimate(calculation: SpellCalculation): string {
  const { analysis, total, perTick, ticks, instant } = calculation
  if (total === null) return 'Full-cast estimate unavailable.'
  const scope = analysis?.scope === 'aggregate pack total' ? 'across the target pack' : 'on one target'
  const hits = analysis?.hits ?? 1
  const perHit = analysis?.perHitTotal
  const summary = `${amount(total)} ${calculation.metric} per full cast ${scope}.`
  if (hits > 1 && perHit != null) return `${summary} ${amount(perHit)} per hit × ${hits} modeled hits.`
  if (perTick && ticks) return `${summary} ${amount(perTick)} per tick × ${ticks} ticks${instant ? ` + ${amount(instant)} instant` : ''}.`
  return summary
}

function baseEffectEstimate(calculation: SpellCalculation): string {
  const { analysis, modifiers } = calculation
  if (calculation.total === null) return ''
  if (!modifiers?.rank || !analysis) return ''
  const rank = rankLabel(modifiers.rank)
  const contribution = analysis.contributions.length === 1 ? analysis.contributions[0] : null
  if (contribution?.clientAmount == null || contribution.afterRank === null) {
    return `Level ${analysis.level}, mote rank ${rank}. Base full-cast amount ${amount(modifiers.baseline.total)} in the same target scope.`
  }
  const unit = contribution.periodic ? 'per tick' : 'per hit'
  return `At level ${analysis.level}, base effect ${amount(contribution.clientAmount)} ${unit} → ${amount(contribution.afterRank)} ${unit} at mote rank ${rank}.`
}

export function modeledCycleTiming(timing: SpellAnalysisTiming): string {
  return `cast ${timing.castMs / 1000}s + max(recast ${timing.recastMs / 1000}s, global recovery ${timing.recoveryMs / 1000}s, delivery ${timing.deliveryMs === null ? '?' : `${timing.deliveryMs / 1000}s`}) = ${timing.cycleMs === null ? '?' : `${timing.cycleMs / 1000}s`}.`
}

export function ModeledRate({ calculation }: { calculation?: SpellCalculation }): JSX.Element {
  const timing = calculation?.analysis?.timing
  if (!calculation || !timing) return <>-</>
  if (timing.rate === null || timing.cycleMs === null) return <>{wholeAmount(timing.rate)}</>
  const title = `${amount(calculation.total)} per cast ÷ ${timing.cycleMs / 1000}s per cycle. ${modeledCycleTiming(timing)} The model treats those waits as overlapping.`
  return <Tooltip disableInteractive describeChild title={title}>
    <Typography tabIndex={0} variant="body2" data-testid={`spells-rate-${calculation.id}-${calculation.metric}`}>{wholeAmount(timing.rate)}</Typography>
  </Tooltip>
}

export function EstimateBadges({ calculation }: { calculation: SpellCalculation }): JSX.Element | null {
  const modifier = calculation.modifiers
  if (!modifier || modifier.mode === 'client') return null
  return <Stack direction="row" gap={0.5} flexWrap="wrap">
    {modifier.partial && <Chip size="small" color="warning" variant="outlined" label="Partial estimate" />}
    {modifier.simulated && <Chip size="small" variant="outlined" label="Simulated" />}
  </Stack>
}

export function EstimateExplanation({ calculation }: { calculation: SpellCalculation }): JSX.Element {
  const modifier = calculation.modifiers
  return <Stack spacing={0.5}>
    {modifier && modifier.mode !== 'client' && <>
      <RankExplanation calculation={calculation} />
      <FocusExplanation calculation={calculation} />
      <InstrumentExplanation calculation={calculation} />
      {modifier.warnings.map((warning) => <Typography key={warning} variant="caption" color="warning.main">{warning}</Typography>)}
    </>}
    <Typography variant="caption" color="text.secondary">{[...calculation.restrictions, ...calculation.reasons].join('; ') || 'Supported HP calculation, one target, full duration.'}</Typography>
  </Stack>
}
function RankExplanation({ calculation }: { calculation: SpellCalculation }): JSX.Element | null {
  const modifier = calculation.modifiers
  if (!modifier || modifier.mode === 'client') return null
  return <Typography variant="caption">{modifier.rank === null ? 'Mote rank unknown; using base amount.' : `Mote rank ${rankLabel(modifier.rank)} (${modifier.rankSource}).`} Community rank model {modifier.modelVersion}.</Typography>
}
function InstrumentExplanation({ calculation }: { calculation: SpellCalculation }): JSX.Element | null {
  const instrument = calculation.modifiers?.instrument
  if (!instrument) return null
  return <Stack spacing={0.5}><Typography variant="caption">Song skill {instrument.family}. Best known carried: {instrument.bestCarried?.item ?? 'no qualifying modifier'} · {instrument.bestMultiplier}×{instrument.bestCarried?.requiresEquip ? ' · requires equipment swap' : ''}. Equipped: {instrument.equipped?.item ?? 'no qualifying modifier'} · {instrument.equippedMultiplier}×.</Typography>
    <Typography variant="caption" data-testid="bard-combined-hp">Combined amount with equipped instrument {amount(calculation.modifiers?.equippedInstrument?.total ?? null)} → with best carried {amount(calculation.total)}. Same mote/focus inputs and target scope; instrument estimates remain partial.</Typography></Stack>
}

function FocusExplanation({ calculation }: { calculation: SpellCalculation }): JSX.Element {
  const focus = calculation.modifiers?.focus
  if (!focus) return <Typography variant="caption">No qualifying modeled focus applied.</Typography>
  return <Typography variant="caption">{focus.name}{focus.item ? ` from ${focus.item}` : ''}: {focus.pct}% midpoint ({focus.minPct}% - {focus.maxPct}% focus roll).</Typography>
}

export function rankLabel(rank: number): string {
  return ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][rank] ?? String(rank)
}

export function SpellHpValues({ calculations, showExplanation = true }: { calculations: SpellCalculation[]; showExplanation?: boolean }): JSX.Element {
  return <Stack spacing={1} data-testid="spells-hp-values">
    {calculations.map((calculation) => <Stack key={calculation.metric} spacing={0.5}>
      <Typography variant="subtitle2">{calculation.metric === 'damage' ? 'Damage' : 'Healing'} · {calculation.analysis?.scope ?? 'per target'}</Typography>
      <EstimateAmount calculation={calculation} />
      <SpellCastSummary calculation={calculation} align="left" />
      <Typography variant="caption" color="text.secondary">{calculation.total === null ? 'This HP formula is not supported yet. Open the calculation details for exclusions.' : `Instant ${amount(calculation.instant)} · Per tick ${amount(calculation.perTick)} × ${calculation.ticks ?? '?'} · Mana ${calculation.mana} · ${calculation.metric === 'damage' ? 'Damage' : 'Healing'}/Mana ${calculation.mana === 0 ? 'Zero mana' : efficiencyAmount(calculation.perMana)}`}</Typography>
      {showExplanation && <EstimateExplanation calculation={calculation} />}
      {!showExplanation && <><RankExplanation calculation={calculation} /><InstrumentExplanation calculation={calculation} /></>}
    </Stack>)}
  </Stack>
}
