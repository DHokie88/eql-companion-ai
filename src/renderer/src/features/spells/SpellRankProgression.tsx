import type { JSX } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import type { ClientSpellRecord, SpellMetric } from '@shared/spellLibrary'
import { spellRankProgression } from '@shared/clientSpellRankRules'
import { efficiencyAmount, rankLabel, wholeAmount } from './SpellEstimate'

export function SpellRankProgression({ record, level, metric }: { record: ClientSpellRecord; level: number; metric: SpellMetric }): JSX.Element {
  const rows = spellRankProgression(record, level, metric)
  const periodic = (rows[0].calculation.perTick ?? 0) > 0
  const hybrid = periodic && (rows[0].calculation.instant ?? 0) > 0
  return <Accordion data-testid="spell-rank-progression"><AccordionSummary>Rank 0-X breakdown</AccordionSummary><AccordionDetails><Stack spacing={1.5}>
    <Typography variant="body2">Caster level {level} · one target · no equipment, focus, AA, crits or resists. Rank 0 is the client base; I-X use the community upgrade model.</Typography>
    <Typography variant="caption">{metric === 'healing' ? 'Healing: +3% per rank (limited observations).' : periodic ? 'Tick damage: base + floor(base × 3% × rank). Duration: round(base duration × (1 + 5% × rank)). Ordinary DoTs include one extra periodic pulse in addition to the duration intervals; its first pulse follows server tick timing.' : 'Direct damage: base + floor(base × 6% × rank). Each effect is rounded separately.'} Mana: −2% of base per rank. Cast: {periodic || metric === 'healing' ? '−4%' : '−2%'} of base per rank. These remain modeled values.</Typography>
    {hybrid && <Typography variant="caption" color="warning.main">Initial hit: +6% per rank is unverified and conflicts with some observed poison hits. The initial hit and total below remain uncertain; the periodic pulse correction is supported separately.</Typography>}
    <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Rank 0 to X spell values"><TableHead><TableRow>{['Rank', 'Initial', 'Per pulse', 'Pulses', 'Duration counter', `Modeled ${metric}`, 'Mana', `${metric === 'damage' ? 'Dam' : 'Heal'}/mana`, 'Cast'].map((label) => <TableCell key={label} align={label === 'Rank' ? 'left' : 'right'}>{label}</TableCell>)}</TableRow></TableHead>
      <TableBody>{rows.map(({ rank, calculation: c, timing }) => <TableRow key={rank} data-testid={`spell-rank-row-${rank}`}>
        <TableCell>{rankLabel(rank)}</TableCell><TableCell align="right">{wholeAmount(c.instant)}</TableCell><TableCell align="right">{wholeAmount(c.perTick)}</TableCell><TableCell align="right">{c.ticks ?? '-'}</TableCell>
        <TableCell align="right">{c.perTick ? `${(c.durationTicks ?? c.ticks ?? 0) * 6}s` : '-'}</TableCell><TableCell align="right">{wholeAmount(c.total)}</TableCell><TableCell align="right">{c.mana}</TableCell><TableCell align="right">{c.mana ? efficiencyAmount(c.perMana) : '-'}</TableCell><TableCell align="right">{timing.castMs / 1000}s</TableCell>
      </TableRow>)}</TableBody></Table></Box>
    {rows[0].calculation.reasons.map((reason) => <Typography key={reason} variant="caption" color="warning.main">{reason}</Typography>)}
  </Stack></AccordionDetails></Accordion>
}
