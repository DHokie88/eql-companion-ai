import type { JSX } from 'react'
import { Stack, Tooltip, Typography } from '@mui/material'
import type { SpellCalculation } from '@shared/spellLibrary'
import type { SpellAnalysis } from '@shared/spellAnalysis'

function rainTargets(analysis: SpellAnalysis): string {
  const targets = analysis.scenario.scope === 'single' ? 1 : analysis.requestedTargets
  return targets === 'maximum' ? 'Max pack' : `${targets} target${targets === 1 ? '' : 's'}`
}
export function SpellCastSummary({ calculation, align = 'center' }: { calculation: SpellCalculation; align?: 'left' | 'center' }): JSX.Element | null {
  const analysis = calculation.analysis
  if (!analysis) return null
  if (analysis.deliveryKind === 'rain') return <Tooltip disableInteractive title="Potential hits across the cast, assuming targets stay in the area and no resists. The hit budget applies across all waves; it does not guarantee an even split between enemies.">
    <Stack spacing={0.25} sx={{ alignItems: align === 'left' ? 'flex-start' : 'center' }} data-testid={`rain-summary-${calculation.id}`}>
      <Typography variant="caption" color="text.secondary">{analysis.perHitTotal?.toLocaleString(undefined, { maximumFractionDigits: 3 }) ?? 'Excluded'} / hit × {analysis.hits ?? '?'} hits</Typography>
      {analysis.waveHits && <Typography variant="caption" color="text.secondary">{rainTargets(analysis)} · hits by wave {analysis.waveHits.join(' + ')}</Typography>}
    </Stack>
  </Tooltip>
  return <Typography variant="caption" color="text.secondary" display="block">{analysis.scope === 'aggregate pack total' ? `${analysis.effectiveTargets ?? '?'} targets · pack total` : calculation.metric === 'healing' ? 'Per recipient · full cast' : 'One target · full cast'}</Typography>
}
