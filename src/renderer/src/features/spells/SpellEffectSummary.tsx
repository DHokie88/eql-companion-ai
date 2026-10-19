import type { JSX } from 'react'
import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import type { ClientSpellRecord } from '@shared/spellLibrary'
import type { SpellPresentation } from '@shared/clientSpellDescriptions'
import { clientSpellEffectLabel } from '@shared/clientSpellParser'

export function SpellEffectSummary({ presentation }: { presentation?: SpellPresentation }): JSX.Element | null {
  if (!presentation) return null
  return <Stack spacing={1} data-testid="spell-effect-summary">
    <Typography variant="h6">What this spell does</Typography>
    {presentation.effects.map((effect) => effect.neutral ? null : <Typography key={effect.slot}><strong>{effect.label}:</strong> {effect.text}</Typography>)}
    <Typography><strong>Duration:</strong> {presentation.duration} · <strong>Target:</strong> {presentation.target} · <strong>Resist:</strong> {presentation.resist}</Typography>
    <Typography><strong>Range:</strong> {presentation.range}</Typography>
    <Typography variant="caption" color="text.secondary">Unmodified client effects at caster level {presentation.level}. Modeled instrument and combined HP estimates are labeled separately. Other modified buff statistics are not simulated.</Typography>
  </Stack>
}
export function SpellTechnicalEffects({ record, presentation }: { record: ClientSpellRecord; presentation?: SpellPresentation }): JSX.Element {
  return <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Decoded client effects"><TableHead><TableRow>{['Slot', 'Effect (SPA)', 'English description', 'Base', 'Limit', 'Formula', 'Maximum'].map((label) => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>
    {record.effects.map((effect) => <TableRow key={effect.slot}><TableCell>{effect.slot}</TableCell><TableCell>{clientSpellEffectLabel(effect.spa)}<Typography variant="caption" display="block">SPA {effect.spa}</Typography></TableCell>
      <TableCell sx={{ minWidth: 230 }}>{presentation?.effects.find((entry) => entry.slot === effect.slot)?.text ?? String(record.fields[`effect${effect.slot}`] ?? 'No decoded description available.')}</TableCell>
      {[effect.base, effect.limit, effect.calc, effect.max].map((value, index) => <TableCell key={index}>{value}</TableCell>)}
    </TableRow>)}
  </TableBody></Table></Box>
}
