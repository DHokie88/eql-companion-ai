import type { JSX } from 'react'
import { Chip, Stack, Typography } from '@mui/material'
import type { SpellCalculation } from '@shared/spellLibrary'

export function amount(value: number | null): string {
  return value === null ? 'Excluded' : value.toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function EstimateAmount({ calculation }: { calculation: SpellCalculation }): JSX.Element {
  const modifier = calculation.modifiers
  const changedMode = modifier && modifier.mode !== 'client'
  return <Stack spacing={0.25} data-testid={`spells-amount-${calculation.id}-${calculation.metric}`}>
    <Typography variant="body2">
      {changedMode && `${amount(modifier.baseline.total)} → `}{amount(calculation.total)}
    </Typography>
    {modifier?.range && changedMode && <Typography variant="caption">Range {amount(modifier.range.min)}–{amount(modifier.range.max)}</Typography>}
    <EstimateBadges calculation={calculation} />
  </Stack>
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
      <Typography variant="caption">{modifier.rank === null ? 'Mote rank unknown; using base amount.' : `Mote rank ${rankLabel(modifier.rank)} (${modifier.rankSource}).`} Measured rank model {modifier.modelVersion}.</Typography>
      <FocusExplanation calculation={calculation} />
      {modifier.warnings.map((warning) => <Typography key={warning} variant="caption" color="warning.main">{warning}</Typography>)}
    </>}
    <Typography variant="caption" color="text.secondary">{[...calculation.restrictions, ...calculation.reasons].join('; ') || 'Supported HP calculation, one target, full duration.'}</Typography>
  </Stack>
}

function FocusExplanation({ calculation }: { calculation: SpellCalculation }): JSX.Element {
  const focus = calculation.modifiers?.focus
  if (!focus) return <Typography variant="caption">No qualifying modeled focus applied.</Typography>
  return <Typography variant="caption">{focus.name}{focus.item ? ` from ${focus.item}` : ''}: {focus.pct}% midpoint ({focus.minPct}%–{focus.maxPct}% focus roll).</Typography>
}

export function rankLabel(rank: number): string {
  return ['Base', 'Base / I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][rank] ?? String(rank)
}

export function SpellHpValues({ calculations }: { calculations: SpellCalculation[] }): JSX.Element {
  return <Stack spacing={1} data-testid="spells-hp-values">
    {calculations.map((calculation) => <Stack key={calculation.metric} spacing={0.5}>
      <Typography variant="subtitle2">{calculation.metric === 'damage' ? 'Damage' : 'Healing'} per target</Typography>
      <EstimateAmount calculation={calculation} />
      <Typography variant="caption">Instant {amount(calculation.instant)} · Per tick {amount(calculation.perTick)} × {calculation.ticks ?? '?'} · Client mana {calculation.mana} · Amount / client mana {calculation.mana === 0 ? 'Zero mana' : amount(calculation.perMana)}</Typography>
      <EstimateExplanation calculation={calculation} />
    </Stack>)}
  </Stack>
}
