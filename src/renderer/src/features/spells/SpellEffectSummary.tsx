import type { JSX } from 'react'
import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import type { ClientSpellRecord } from '@shared/spellLibrary'
import type { SpellPresentation } from '@shared/clientSpellDescriptions'
import { clientSpellEffectLabel } from '@shared/clientSpellParser'
import { SpellDetailSection } from './SpellDetailSection'

export function SpellEffectSummary({ presentation }: { presentation?: SpellPresentation }): JSX.Element | null {
  if (!presentation) return null
  return <SpellDetailSection><Stack spacing={2.5} data-testid="spell-effect-summary">
    <Typography variant="h6">What this spell does</Typography>
    <Stack spacing={2}>{presentation.effects.map((effect) => effect.neutral ? null : <Box key={effect.slot}><Typography variant="subtitle2" sx={{ mb: 0.5 }}>{effect.label}</Typography><Typography color="text.secondary" sx={{ maxWidth: '85ch' }}>{effect.text}</Typography></Box>)}</Stack>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5, pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
      {Object.entries({ Duration: presentation.duration, Target: presentation.target, Resist: presentation.resist, Range: presentation.range }).map(([label, value]) => <Box key={label}><Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>{label}</Typography><Typography>{value}</Typography></Box>)}
    </Box>
    <Typography variant="caption" color="text.secondary">Base effects at caster level {presentation.level}. Character estimates are shown separately.</Typography>
  </Stack></SpellDetailSection>
}
export function SpellTechnicalEffects({ record, presentation }: { record: ClientSpellRecord; presentation?: SpellPresentation }): JSX.Element {
  return <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Decoded client effects"><TableHead><TableRow>{['Slot', 'Effect (SPA)', 'English description', 'Base', 'Limit', 'Formula', 'Maximum'].map((label) => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>
    {record.effects.map((effect) => <TableRow key={effect.slot}><TableCell>{effect.slot}</TableCell><TableCell>{presentation?.effects.find((entry) => entry.slot === effect.slot)?.label ?? clientSpellEffectLabel(effect.spa)}<Typography variant="caption" display="block">SPA {effect.spa}</Typography></TableCell>
      <TableCell sx={{ minWidth: 230 }}>{presentation?.effects.find((entry) => entry.slot === effect.slot)?.text ?? String(record.fields[`effect${effect.slot}`] ?? 'No decoded description available.')}</TableCell>
      {[effect.base, effect.limit, effect.calc, effect.max].map((value, index) => <TableCell key={index}>{value}</TableCell>)}
    </TableRow>)}
  </TableBody></Table></Box>
}
