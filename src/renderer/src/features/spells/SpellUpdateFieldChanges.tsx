import { type JSX, useCallback } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, CircularProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { clientSpellEffectLabel } from '@shared/clientSpellParser'
import type { ClientSpellRecord, SpellBeforeAfterResult, SpellFieldDifference } from '@shared/spellLibrary'
import { useLibraryQuery } from './useLibraryQuery'
import type { SpellUpdatePair } from './SpellUpdateChanges'

const TIMING_LABELS: Record<string, string> = { castMs: 'Cast time', recoveryMs: 'Recovery time', recastMs: 'Recast time', aoeDurationMs: 'Area duration' }
const FIELD_LABELS: Record<string, string> = {
  ...TIMING_LABELS,
  name: 'Name', classes: 'Class / level', mana: 'Mana cost', layout: 'File layout', aeRange: 'Area radius',
  target: 'Target type', targetName: 'Target type', resist: 'Resist type', resistName: 'Resist type',
  skill: 'Skill', skillName: 'Skill', typeName: 'Spell type', beneficial: 'Spell type', beneficialCode: 'Spell type',
  rawDescription: 'Description template', durationText: 'Duration', spellGroup: 'Spell group'
}

const INTERPRETED_RECORD_FIELDS = [
  'name', 'classes', 'description', 'category', 'subcategory', 'mana', 'target', 'range', 'aeRange',
  'castMs', 'recoveryMs', 'recastMs', 'durationText', 'aoeDurationMs', 'effects', 'messages'
]

function fieldKey(field: string): string {
  return field.replace(/^fields\./, '')
}

export function readableHistoryField(field: string): string {
  const key = fieldKey(field)
  const raw = /^rawFields\[(\d+)\](.*)$/.exec(key)
  if (raw) return 'Column ' + raw[1] + raw[2]
  const spaced = key.replace(/([a-z])([A-Z0-9])/g, '$1 $2')
  return FIELD_LABELS[key] ?? (spaced.charAt(0).toUpperCase() + spaced.slice(1))
}

function storedValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'string') return value || 'Empty'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value) ?? '-'
}

function recordListValue(key: string, record: ClientSpellRecord): string | null {
  switch (key) {
    case 'classes':
      return record.classes.map(({ code, level }) => `${code} ${level}`).join(' · ') || 'No player class'
    case 'effects':
      return record.effects.map(({ slot, spa, base, limit, max, calc }) => (
        `Slot ${slot}: ${clientSpellEffectLabel(spa)} · base ${base} · limit ${limit} · cap ${max} · formula ${calc}`
      )).join('\n') || 'None'
    case 'messages':
      return Object.entries(record.messages).map(([name, value]) => readableHistoryField(name) + ': ' + value).join('\n') || 'None'
    default:
      return null
  }
}

const NAMED_VALUE: Record<string, string> = {
  target: 'targetName', resist: 'resistName', skill: 'skillName', beneficial: 'typeName', beneficialCode: 'typeName'
}

function recordValue(field: string, record: ClientSpellRecord | null, fallback: unknown): string {
  if (!record) return '-'
  const key = fieldKey(field)
  const named = NAMED_VALUE[key]
  if (named && record.fields[named] !== undefined) return storedValue(record.fields[named])
  const value = key in record ? record[key as keyof ClientSpellRecord] : record.fields[key] ?? fallback
  if (key in TIMING_LABELS && typeof value === 'number') return (value / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 }) + ' s'
  return recordListValue(key, record) ?? storedValue(value)
}

interface DisplayDifference { label: string; before: string; after: string }

function interpretedDifference(diff: SpellFieldDifference, data: SpellBeforeAfterResult): DisplayDifference {
  return { label: readableHistoryField(diff.field), before: recordValue(diff.field, data.before, diff.before), after: recordValue(diff.field, data.after, diff.after) }
}

function interpretedRows(data: SpellBeforeAfterResult): DisplayDifference[] {
  if (!data.before || !data.after) {
    return INTERPRETED_RECORD_FIELDS.map((field) => ({ label: readableHistoryField(field), before: recordValue(field, data.before, null), after: recordValue(field, data.after, null) }))
  }
  const rows = new Map<string, DisplayDifference>()
  for (const diff of data.differences) {
    if (diff.kind !== 'interpreted') continue
    const row = interpretedDifference(diff, data)
    // Numeric target/skill/etc. and their named values describe the same change.
    const key = JSON.stringify(row)
    rows.set(key, row)
  }
  return [...rows.values()]
}

function technicalValue(field: string, value: unknown): string {
  if (field === 'layout' && typeof value === 'number') return `${value} columns`
  return JSON.stringify(value) ?? '-'
}

function technicalRows(data: SpellBeforeAfterResult): DisplayDifference[] {
  if (data.before && data.after) {
    return (data.technicalDifferences ?? []).map(({ field, before, after }) => ({
      label: readableHistoryField(field), before: technicalValue(field, before), after: technicalValue(field, after)
    }))
  }
  const record = data.before ?? data.after
  if (!record) return []
  const side = data.before ? 'before' : 'after'
  return [
    { label: 'File layout', before: '-', after: '-', [side]: `${record.layout} columns` },
    ...record.rawFields.map((value, index) => ({ label: `Column ${index}`, before: '-', after: '-', [side]: JSON.stringify(value) }))
  ]
}

function DifferenceTable({ rows }: { rows: DisplayDifference[] }): JSX.Element {
  return <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Spell values before and after">
    <TableHead><TableRow><TableCell>Field</TableCell><TableCell>Before</TableCell><TableCell>After</TableCell></TableRow></TableHead>
    <TableBody>{rows.map(({ label, before, after }) => <TableRow key={JSON.stringify([label, before, after])} sx={{ '& td, & th': { verticalAlign: 'top' } }}>
      <TableCell component="th" scope="row" sx={{ minWidth: 112 }}>{label}</TableCell>
      <TableCell sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', width: '44%' }}>{before}</TableCell>
      <TableCell sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', width: '44%' }}>{after}</TableCell>
    </TableRow>)}</TableBody>
  </Table></Box>
}

function DiffContent({ data, technicalExpanded }: { data: SpellBeforeAfterResult; technicalExpanded: boolean }): JSX.Element {
  const interpreted = interpretedRows(data)
  const technical = technicalRows(data)
  return <>
    {interpreted.length > 0 && <DifferenceTable rows={interpreted} />}
    {technical.length > 0 && <Accordion disableGutters defaultExpanded={technicalExpanded} slotProps={{ transition: { unmountOnExit: true } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} data-testid="spells-history-spell-technical">Raw and format details</AccordionSummary>
      <AccordionDetails><DifferenceTable rows={technical} /></AccordionDetails>
    </Accordion>}
    {!interpreted.length && !technical.length && <Typography color="text.secondary">No differences in this spell between these captures.</Typography>}
  </>
}

export function SpellUpdateFieldChanges({ id, pair, technicalExpanded }: { id: number; pair: SpellUpdatePair; technicalExpanded: boolean }): JSX.Element {
  const { beforeSnapshotId, afterSnapshotId } = pair
  const load = useCallback(() => window.eq.spellLibrary.beforeAfter({
    id, beforeSnapshotId, afterSnapshotId, clientUpdate: true
  }), [id, beforeSnapshotId, afterSnapshotId])
  const { data, loading, error } = useLibraryQuery(load)
  return <Stack spacing={1} data-testid="spells-history-before-after">
    <Typography variant="subtitle1">Before and after</Typography>
    {loading && <CircularProgress size={20} aria-label="Loading spell values" />}
    {error && <Alert severity="error">{error}</Alert>}
    {data && <DiffContent data={data} technicalExpanded={technicalExpanded} />}
  </Stack>
}
