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
        <Typography variant="caption">Requested targets {analysis.requestedTargets}; effective targets {analysis.effectiveTargets ?? 'unknown'}; waves {analysis.waves ?? 'unknown'}; total hits {analysis.hits ?? 'unknown'}; hit cap {analysis.hitCap ?? 'unknown'}. {analysis.capSource}</Typography>
        <Typography variant="caption">One-target full cast {amount(analysis.singleTargetTotal)} · aggregate pack total {amount(analysis.packTotal)}. Rain hits are not assumed to be evenly distributed.</Typography>
        {analysis.warnings.map((warning) => <Alert key={warning} severity="warning">{warning}</Alert>)}
        <Timing calculation={calculation} />
        <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Spell effect contributions"><TableHead><TableRow>{['Slot / SPA', 'Client at level', 'After mote', 'After focus', 'Ticks', 'Hits', 'Contribution'].map((label) => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
          <TableBody>{analysis.contributions.map((c) => <TableRow key={c.slot}><TableCell>{c.slot} / {c.spa}</TableCell><TableCell>{amount(c.clientAmount)}</TableCell><TableCell>{amount(c.afterRank)}</TableCell><TableCell>{amount(c.afterFocus)}</TableCell><TableCell>{c.periodic ? c.ticks ?? '?' : '-'}</TableCell><TableCell>{c.hits ?? '?'}</TableCell><TableCell>{amount(c.total)}</TableCell></TableRow>)}</TableBody>
        </Table></Box>
        <Typography variant="caption">Efficiency = {amount(calculation.total)} / {calculation.mana} client mana. Mana is spent once per cast.</Typography>
      </>}
    </Stack></AccordionDetails>
  </Accordion>
}
function Timing({ calculation }: { calculation: SpellCalculation }): JSX.Element | null {
  const timing = calculation.analysis?.timing
  if (!timing) return null
  return <Stack spacing={0.5}><Typography variant="caption">Cycle = cast {timing.castMs / 1000}s + max(recovery {timing.recoveryMs / 1000}s, recast {timing.recastMs / 1000}s, delivery {timing.deliveryMs === null ? '?' : timing.deliveryMs / 1000}s) = {timing.cycleMs === null ? '?' : timing.cycleMs / 1000}s.</Typography>
    <Typography variant="caption">Modeled cycle {calculation.metric === 'damage' ? 'DPS' : 'HPS'}: {amount(timing.rate)}. {timing.reason} These are modeled casting cycles, not measured combat output or a rotation simulation.</Typography></Stack>
}
