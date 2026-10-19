import type { JSX } from 'react'
import { Accordion, AccordionSummary, AccordionDetails, Alert, Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import type { SpellCalculation } from '@shared/spellLibrary'
import { amount, EstimateExplanation } from './SpellEstimate'

export function SpellAnalysisBreakdown({ calculation }: { calculation: SpellCalculation }): JSX.Element {
  const analysis = calculation.analysis
  return <Accordion disableGutters sx={{ bgcolor: 'transparent', boxShadow: 'none' }}><AccordionSummary sx={{ px: 0, minHeight: 32 }}>How this was calculated</AccordionSummary>
    <AccordionDetails sx={{ px: 0 }}><Stack spacing={1}>
      <EstimateExplanation calculation={calculation} />
      {analysis && <>
        <Typography variant="body2">{analysis.scope} · evaluated at level {analysis.level} · model {analysis.modelVersion}</Typography>
        <RainBreakdown calculation={calculation} />
        <Typography variant="caption">Requested targets {analysis.requestedTargets}; effective targets {analysis.effectiveTargets ?? 'unknown'}; waves {analysis.waves ?? 'unknown'}; total hits {analysis.hits ?? 'unknown'}; hit cap {analysis.hitCap ?? 'unknown'}. {analysis.capSource}</Typography>
        <Typography variant="caption">One-target full cast {amount(analysis.singleTargetTotal)} · aggregate pack total {amount(analysis.packTotal)}.</Typography>
        {analysis.warnings.map((warning) => <Alert key={warning} severity="warning">{warning}</Alert>)}
        <Timing calculation={calculation} />
        <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Spell effect contributions"><TableHead><TableRow>{['Slot / SPA', 'Base at level', 'After mote', 'After instrument', 'After focus', 'Ticks', 'Hits', 'Contribution'].map((label) => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
          <TableBody>{analysis.contributions.map((c) => <TableRow key={c.slot}><TableCell>{c.slot} / {c.spa}</TableCell><TableCell>{amount(c.clientAmount)}</TableCell><TableCell>{amount(c.afterRank)}</TableCell><TableCell>{amount(c.afterInstrument === undefined ? c.afterRank : c.afterInstrument)}</TableCell><TableCell>{amount(c.afterFocus)}</TableCell><TableCell>{c.periodic ? c.ticks ?? '?' : '-'}</TableCell><TableCell>{c.hits ?? '?'}</TableCell><TableCell>{amount(c.total)}</TableCell></TableRow>)}</TableBody>
        </Table></Box>
        <Typography variant="caption">Efficiency = {amount(calculation.total)} / {calculation.mana} mana. Mana is spent once per cast.</Typography>
      </>}
    </Stack></AccordionDetails>
  </Accordion>
}
function RainBreakdown({ calculation }: { calculation: SpellCalculation }): JSX.Element | null {
  const analysis = calculation.analysis
  if (analysis?.deliveryKind !== 'rain') return null
  return <Stack spacing={0.5} data-testid="rain-calculation-breakdown">
    <Typography variant="body2">Rain: {amount(analysis.perHitTotal)} per hit × {analysis.hits ?? '?'} potential hits = {amount(calculation.total)} total, for one payment of {calculation.mana} mana.</Typography>
    <Typography variant="caption">{analysis.waves ?? '?'} available waves share a {analysis.hitCap ?? '?'}-hit budget across the entire cast. {analysis.waveHits ? `Potential hits by wave: ${analysis.waveHits.join(' + ')}.` : 'Wave allocation is unavailable.'} This is a hit-budget illustration, not a guaranteed split between targets.</Typography>
    <Typography variant="caption" color="text.secondary">The model assumes targets stay in the area and no resists. The captured {analysis.timing.deliveryMs === null ? 'unknown' : `${analysis.timing.deliveryMs / 1000}s`} delivery window is retained for conservative cycle rates; it does not claim exact timing for the last active wave.</Typography>
  </Stack>
}
function Timing({ calculation }: { calculation: SpellCalculation }): JSX.Element | null {
  const timing = calculation.analysis?.timing
  if (!timing) return null
  return <Stack spacing={0.5}><Typography variant="caption">Cycle = cast {timing.castMs / 1000}s + max(recovery {timing.recoveryMs / 1000}s, recast {timing.recastMs / 1000}s, delivery {timing.deliveryMs === null ? '?' : timing.deliveryMs / 1000}s) = {timing.cycleMs === null ? '?' : timing.cycleMs / 1000}s.</Typography>
    <Typography variant="caption">Modeled cycle {calculation.metric === 'damage' ? 'DPS' : 'HPS'}: {amount(timing.rate)}. {timing.reason} These are modeled casting cycles, not measured combat output or a rotation simulation.</Typography></Stack>
}
