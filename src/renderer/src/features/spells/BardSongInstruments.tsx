import type { JSX } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Chip, Link, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import type { BardInstrumentChoice, BardSongPresentation } from '@shared/bardInstruments'
import { SpellDetailSection } from './SpellDetailSection'

function InstrumentChoice({ choice, label }: { choice: BardInstrumentChoice | null; label: string }): JSX.Element {
  return <Stack spacing={1} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1.5 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="subtitle2">{choice?.item ?? 'No qualifying modifier found; base 1× assumed.'}</Typography>{choice && <Typography variant="body2" color="text.secondary">{choice.effect} (#{choice.effectId}) · {choice.multiplier.toLocaleString()}× · {choice.location}</Typography>}{choice?.requiresEquip && <Chip size="small" color="warning" variant="outlined" sx={{ alignSelf: 'flex-start' }} label="Requires equipment swap" />}</Stack>
}
export function BardSongInstruments({ song }: { song: BardSongPresentation }): JSX.Element {
  const { inputs, effects } = song
  const modified = inputs.mode !== 'client'
  return <SpellDetailSection><Stack spacing={2.5} data-testid="bard-song-instruments">
    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography variant="h6">{modified ? 'Your song: instrument impact' : 'How instruments affect this song'}</Typography>{modified && <Chip size="small" color="warning" label="Partial gear estimate" />}</Stack>
    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '85ch' }}>Song skill: <strong>{inputs.family}</strong>. Only matching or unrestricted all-song modifiers qualify. {inputs.family === 'singing' && 'Drums, lutes, horns and flutes do not substitute for a Singing modifier.'}</Typography>
    {modified && <>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}><InstrumentChoice label="Equipped at export" choice={inputs.equipped} /><InstrumentChoice label="Best known carried" choice={inputs.bestCarried} /></Box>
      <Typography variant="caption" color="text.secondary">Equipment exported {inputs.exportedAt ? new Date(inputs.exportedAt).toLocaleString() : 'at an unknown time'}. Refresh in EQ with /outputfile inventory.</Typography>
    </>}
    <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Bard instrument effect comparison" sx={{ minWidth: modified ? 920 : undefined }}><TableHead><TableRow><TableCell sx={{ width: modified ? '13%' : '22%' }}>Effect</TableCell>{modified && <><TableCell>Base effect</TableCell><TableCell>Equipped instrument only</TableCell><TableCell>Best carried instrument only</TableCell></>}<TableCell>What instruments add</TableCell></TableRow></TableHead><TableBody>
      {effects.map((effect) => <TableRow key={effect.slot} data-testid={`bard-effect-${effect.slot}`}><TableCell sx={{ fontWeight: 600 }}>{effect.label}</TableCell>{modified && <><TableCell>{effect.client}</TableCell><TableCell>{effect.equipped ?? 'Unsupported; base effect retained'}</TableCell><TableCell>{effect.bestCarried ?? 'Unsupported; base effect retained'}</TableCell></>}<TableCell sx={{ color: 'text.secondary' }}>{effect.explanation}</TableCell></TableRow>)}
    </TableBody></Table></Box>
    <Accordion><AccordionSummary>Input coverage and model limits</AccordionSummary><AccordionDetails><Stack spacing={2}>
      <Typography variant="body2">This table isolates instrument equipment. Combined HP estimates also use your selected mote/focus inputs. Non-HP mote upgrades are not modeled. Banked items are excluded; carried alternatives may require a swap.</Typography>
      {inputs.knownSources?.map((source) => <Typography key={`${source.item}:${source.location}:${source.effect}`} variant="caption">{source.item}: {source.effect} · {source.location} · {source.equipped ? 'equipped at export' : 'carried; requires equipment swap'}</Typography>)}
      {inputs.warnings.map((warning) => <Alert key={warning} severity="warning">{warning}</Alert>)}
      <Typography variant="caption" color="text.secondary">Reference mechanics, not a server guarantee: <Link href="https://github.com/EQEmu/Server/blob/master/common/spdat.cpp" target="_blank" rel="noreferrer">per-effect instrument rules</Link>. Numeric modifiers come from your captured spell files.</Typography>
    </Stack></AccordionDetails></Accordion>
  </Stack></SpellDetailSection>
}
