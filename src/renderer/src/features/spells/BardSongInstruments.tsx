import type { JSX } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Chip, Link, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import type { BardInstrumentChoice, BardSongPresentation } from '@shared/bardInstruments'

function InstrumentChoice({ choice, label }: { choice: BardInstrumentChoice | null; label: string }): JSX.Element {
  return <Typography variant="body2"><strong>{label}:</strong> {choice ? `${choice.item} · ${choice.effect} (#${choice.effectId}) · ${choice.multiplier.toLocaleString()}× · ${choice.location}` : 'No qualifying modifier found; base 1× assumed.'} {choice?.requiresEquip && <Chip size="small" color="warning" label="Requires equipment swap" />}</Typography>
}
export function BardSongInstruments({ song }: { song: BardSongPresentation }): JSX.Element {
  const { inputs, effects } = song
  const modified = inputs.mode !== 'client'
  return <Stack spacing={1} data-testid="bard-song-instruments">
    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography variant="h6">{modified ? 'Your song: instrument impact' : 'How instruments affect this song'}</Typography>{modified && <Chip size="small" color="warning" label="Partial gear estimate" />}</Stack>
    <Typography variant="body2">Song skill: <strong>{inputs.family}</strong>. Only matching or unrestricted all-song modifiers qualify. {inputs.family === 'singing' && 'Drums, lutes, horns and flutes do not substitute for a Singing modifier.'}</Typography>
    {modified && <>
      <InstrumentChoice label="Equipped at export" choice={inputs.equipped} /><InstrumentChoice label="Best known carried" choice={inputs.bestCarried} />
      <Typography variant="caption">Equipment evidence exported {inputs.exportedAt ? new Date(inputs.exportedAt).toLocaleString() : 'at an unknown time'}. Run /outputfile inventory in EQ to refresh it. Banked items are excluded; carried alternatives are not assumed equipped.</Typography>
    </>}
    <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Bard instrument effect comparison"><TableHead><TableRow><TableCell>Effect</TableCell><TableCell>Client effect</TableCell>{modified && <><TableCell>Equipped instrument only</TableCell><TableCell>Best carried instrument only</TableCell></>}<TableCell>What instruments add</TableCell></TableRow></TableHead><TableBody>
      {effects.map((effect) => <TableRow key={effect.slot} data-testid={`bard-effect-${effect.slot}`}><TableCell>{effect.label}</TableCell><TableCell>{effect.client}</TableCell>{modified && <><TableCell>{effect.equipped ?? 'Unsupported; client effect retained'}</TableCell><TableCell>{effect.bestCarried ?? 'Unsupported; client effect retained'}</TableCell></>}<TableCell>{effect.explanation}</TableCell></TableRow>)}
    </TableBody></Table></Box>
    <Typography variant="caption">This table isolates instrument equipment. Supported combined HP estimates below also use your selected mote/focus inputs. Non-HP mote upgrades are not modeled.</Typography>
    {modified && <Accordion><AccordionSummary>Input coverage and model limits</AccordionSummary><AccordionDetails><Stack spacing={0.5}>
      {inputs.knownSources?.map((source) => <Typography key={`${source.item}:${source.location}:${source.effect}`} variant="caption">{source.item}: {source.effect} · {source.location} · {source.equipped ? 'equipped at export' : 'carried; requires equipment swap'}</Typography>)}
      {inputs.warnings.map((warning) => <Alert key={warning} severity="warning">{warning}</Alert>)}
    </Stack></AccordionDetails></Accordion>}
    <Typography variant="caption" color="text.secondary">Reference mechanics, not a server guarantee: <Link href="https://github.com/EQEmu/Server/blob/master/common/spdat.cpp" target="_blank" rel="noreferrer">per-effect instrument rules</Link>. Numeric modifiers come from your captured client snapshot.</Typography>
  </Stack>
}
