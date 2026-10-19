import { type JSX, type ReactNode, useCallback } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, CircularProgress, Stack, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material'
import { useBackTarget } from '../../appBack'
import { useLibraryQuery } from './useLibraryQuery'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import { SpellHpValues } from './SpellEstimate'
import type { ClientSpellRecord, SpellCalculation } from '@shared/spellLibrary'
import type { SpellAnalysisOptions } from '@shared/spellAnalysis'
import { SpellAnalysisBreakdown } from './SpellAnalysisBreakdown'
import { SpellEffectSummary, SpellTechnicalEffects } from './SpellEffectSummary'
import { BardSongInstruments } from './BardSongInstruments'
import { SpellDetailSection } from './SpellDetailSection'
import { SpellRowRank } from './SpellRowRank'

export function LibrarySpellDetail({ id, snapshotId, level, evaluation, analysis, controls, onBack, onWiki, onHistory }: {
  id: number; snapshotId?: string; onBack: () => void; onWiki?: (name: string) => void; onHistory: (id: number) => void
  level?: number; evaluation?: SpellEvaluationOptions
  analysis?: SpellAnalysisOptions
  controls?: ReactNode
}): JSX.Element {
  const load = useCallback(() => window.eq.spellLibrary.detail({ id, snapshotId, level, evaluation, analysis }), [id, snapshotId, level, evaluation, analysis])
  const { data, loading, error } = useLibraryQuery(load)
  useBackTarget(() => { onBack(); return true })
  const record = data?.record
  return <Stack spacing={3.5} data-testid="spells-detail" data-spell-id={id} sx={{ pb: 4, '& .MuiTypography-root': { lineHeight: 1.65 }, '& .MuiAccordion-root': { bgcolor: 'background.paper', backgroundImage: 'none', boxShadow: 'none', border: 1, borderColor: 'divider', borderRadius: '8px !important', '&::before': { display: 'none' } }, '& .MuiAccordionSummary-root': { minHeight: 56 }, '& .MuiTableCell-root': { py: 2, verticalAlign: 'top', lineHeight: 1.65 } }}>
    <Box><Button size="small" onClick={onBack} data-testid="spells-detail-back">← Back</Button></Box>
    {loading && <CircularProgress size={22} />}{error && <Alert severity="error">{error}</Alert>}
    {data && !record && <Alert severity="info">Spell ID {id} is not present in this snapshot. Its earlier revisions remain in History.</Alert>}
    {record && <>
      <Stack spacing={1.5}><Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center"><Typography variant="h4" sx={{ fontWeight: 600 }}>{record.name}</Typography><Chip size="small" variant="outlined" label={`ID ${record.id}`} /></Stack>
        <SpellRowRank id={record.id} name={record.name} evidence={data.rankEvidence} />
        <Typography color="text.secondary">{record.classes.length ? record.classes.map((c) => `${c.code} ${c.level}`).join(' · ') : 'Internal / NPC record'} · {record.category} {record.subcategory && `/ ${record.subcategory}`}</Typography>
        <DetailDescription record={record} presentation={data.presentation} />
      </Stack>
      {controls}
      <SpellEffectSummary presentation={data.presentation} />
      <DetailTiming record={record} />
      <DetailInstruments presentation={data.presentation} />
      <DetailCalculations calculations={data.calculations} />
      <Stack spacing={1.5}><Typography variant="h6">Client data</Typography>
      <Typography variant="caption" color="text.secondary">Client layout {record.layout} · First observed {data.dataset && new Date(data.dataset.firstObserved).toLocaleString()} · Revision {data.dataset?.contentId.slice(0, 14)}. Eligibility does not confirm ownership or acquisition.</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap"><Button size="small" onClick={() => onHistory(id)}>Spell timeline</Button><SupplementaryLink name={record.name} open={onWiki} /></Stack>
      <Accordion data-testid="spells-technical-details"><AccordionSummary>Decoded effects and spell messages</AccordionSummary><AccordionDetails><Stack spacing={2}>
        <SpellTechnicalEffects record={record} presentation={data.presentation} />
        {Object.entries(record.messages).map(([kind, message]) => message ? <Typography key={kind} variant="body2"><strong>{kind}:</strong> {message}</Typography> : null)}
      </Stack></AccordionDetails></Accordion>
      <Accordion><AccordionSummary>Complete interpreted client fields</AccordionSummary><AccordionDetails><Table size="small"><TableBody>{Object.entries(record.fields).map(([key, value]) => <TableRow key={key}><TableCell>{key}</TableCell><TableCell sx={{ overflowWrap: 'anywhere' }}>{String(value ?? '')}</TableCell></TableRow>)}</TableBody></Table></AccordionDetails></Accordion>
      <Accordion><AccordionSummary>All {record.rawFields.length} raw client columns</AccordionSummary><AccordionDetails><Typography variant="caption">Column indexes are zero based. Unknown fields are preserved for history.</Typography><Table size="small"><TableBody>{record.rawFields.map((value, index) => <TableRow key={index}><TableCell>{index}</TableCell><TableCell sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{value}</TableCell></TableRow>)}</TableBody></Table></AccordionDetails></Accordion>
      </Stack>
    </>}
  </Stack>
}

function DetailCalculations({ calculations }: { calculations?: SpellCalculation[] }): JSX.Element | null {
  return calculations?.length ? <SpellDetailSection><Stack spacing={2.5}><Typography variant="h6">Damage and healing estimates</Typography><SpellHpValues calculations={calculations} showExplanation={false} />{calculations.map((c) => <SpellAnalysisBreakdown key={c.metric} calculation={c} />)}</Stack></SpellDetailSection> : null
}
function DetailDescription({ record, presentation }: { record: ClientSpellRecord; presentation?: import('@shared/clientSpellDescriptions').SpellPresentation }): JSX.Element {
  const description = presentation?.description ?? record.description
  return <Typography data-testid="spell-description" sx={{ whiteSpace: 'pre-wrap', maxWidth: '90ch', pt: 0.5 }}>{description || 'No description in the spell files.'}</Typography>
}
function DetailTiming({ record }: { record: ClientSpellRecord }): JSX.Element {
  return <SpellDetailSection><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 3 }}>{Object.entries({ 'Mana': record.mana, 'Cast time': `${record.castMs / 1000}s`, Recovery: `${record.recoveryMs / 1000}s`, Recast: `${record.recastMs / 1000}s` }).map(([label, value]) => <Box key={label}><Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>{label}</Typography><Typography variant="h6">{value}</Typography></Box>)}</Box></SpellDetailSection>
}
function DetailInstruments({ presentation }: { presentation?: import('@shared/clientSpellDescriptions').SpellPresentation }): JSX.Element | null {
  return presentation?.bard ? <BardSongInstruments song={presentation.bard} /> : null
}

function SupplementaryLink({ name, open }: { name: string; open?: (name: string) => void }): JSX.Element | null {
  return open ? <Button size="small" onClick={() => open(name)}>Supplementary wiki / lineage</Button> : null
}
