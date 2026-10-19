import type { JSX } from 'react'
import { Stack, Tooltip, Typography } from '@mui/material'
import type { SpellCalculation } from '@shared/spellLibrary'
import type { SpellAnalysis } from '@shared/spellAnalysis'

function rainTargets(analysis: SpellAnalysis): string {
  const targets = analysis.scenario.scope === 'single' ? 1 : analysis.requestedTargets
  return targets === 'maximum' ? 'Max pack' : `${targets} target${targets === 1 ? '' : 's'}`
}
export function SpellCastSummary({ calculation, align = 'center', compact = false }: { calculation: SpellCalculation; align?: 'left' | 'center'; compact?: boolean }): JSX.Element | null {
  const analysis = calculation.analysis
  if (!analysis) return null
  if (compact) return <CompactRainSummary id={calculation.id} analysis={analysis} />
  if (analysis.deliveryKind === 'rain') return <ExpandedRainSummary id={calculation.id} analysis={analysis} align={align} />
  return <Typography variant="caption" color="text.secondary" display="block">{analysis.scope === 'aggregate pack total' ? `${analysis.effectiveTargets ?? '?'} targets · pack total` : calculation.metric === 'healing' ? 'Per recipient · full cast' : 'One target · full cast'}</Typography>
}

function ExpandedRainSummary({ id, analysis, align }: { id: number; analysis: SpellAnalysis; align: 'left' | 'center' }): JSX.Element {
  return <Tooltip disableInteractive title="Potential hits across the cast, assuming targets stay in the area and no resists. The hit budget applies across all waves; it does not guarantee an even split between enemies.">
    <Stack spacing={0.25} sx={{ alignItems: align === 'left' ? 'flex-start' : 'center' }} data-testid={`rain-summary-${id}`}>
      <Typography variant="caption" color="text.secondary">{analysis.perHitTotal?.toLocaleString(undefined, { maximumFractionDigits: 3 }) ?? 'Excluded'} / hit × {analysis.hits ?? '?'} hits</Typography>
      {analysis.waveHits && <Typography variant="caption" color="text.secondary">{rainTargets(analysis)} · hits by wave {analysis.waveHits.join(' + ')}</Typography>}
    </Stack>
  </Tooltip>
}

function CompactRainSummary({ id, analysis }: { id: number; analysis: SpellAnalysis }): JSX.Element | null {
  if (analysis.deliveryKind !== 'rain' || analysis.perHitTotal === null || analysis.hits === null) return null
  return <Tooltip disableInteractive title={`${rainTargets(analysis)}. Hits by wave: ${analysis.waveHits?.join(' + ') ?? 'unknown'}. The ${analysis.hitCap ?? 'unknown'}-hit budget is shared across the cast; hits need not split evenly.`}>
    <Typography variant="caption" color="text.secondary" display="block" sx={{ whiteSpace: 'nowrap' }} data-testid={`rain-summary-${id}`}>{analysis.scenario.scope === 'pack' && analysis.requestedTargets === 'maximum' ? 'max ' : ''}{analysis.perHitTotal.toLocaleString(undefined, { maximumFractionDigits: 3 })} × {analysis.hits}</Typography>
  </Tooltip>
}
