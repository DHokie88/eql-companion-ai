// Client spell eligibility is read by numeric ID from the captured snapshot. The legacy unlock
// join remains for skills and disciplines, whose data and behavior this spell-only migration retains.
import { type JSX, useCallback, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material'
import type { SpellByLevelResult, SpellLibraryFocus } from '@shared/spellAnalysis'
import type { SpellSummary } from '@shared/spellLibrary'
import { rankLabel } from '../spells/SpellEstimate'
import { useLibraryQuery } from '../spells/useLibraryQuery'
import { openLevelingSpells, useLevelingSpellAnalysis, useSpellSearchText } from './useLevelingSpellAnalysis'

export function LevelingSpellUnlocks({ level }: { level: number }): JSX.Element {
  const [query, setQuery, text] = useSpellSearchText()
  const [expanded, setExpanded] = useState(false)
  const { classes, evaluation, analysis } = useLevelingSpellAnalysis()
  const load = useCallback(async () => {
    if (!evaluation || classes.length === 0) return null
    return window.eq.spellLibrary.byLevel({ view: 'at', level, classes, evaluation, analysis, text, page: 1, pageSize: 40 })
  }, [classes, evaluation, analysis, level, text])
  const result = useLibraryQuery(load)
  const focus: SpellLibraryFocus = { tab: 'by-level', level, classes, analysis }
  const rows = result.data?.records ?? []
  return <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }} data-testid="new-at-level-client-spells">
    <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
      <Typography variant="subtitle2">Spells ({result.data?.total ?? 0})</Typography>
      <Button size="small" data-testid="new-at-level-open-library" onClick={() => openLevelingSpells(focus)}>Open in Spells</Button>
    </Stack>
    <Typography variant="caption" color="text.secondary">Client eligibility, not confirmed ownership or acquisition.</Typography>
    <TextField size="small" placeholder="Search this level by name or ID" value={query} onChange={(event) => { setQuery(event.target.value); setExpanded(false) }} slotProps={{ htmlInput: { 'data-testid': 'new-at-level-spell-search' } }} />
    <ClientUnlockStatus result={result} known={classes.length > 0} level={level} />
    {rows.slice(0, expanded ? 40 : 10).map((row) => <ClientUnlockRow key={row.id} row={row} focus={focus} />)}
    {rows.length > 10 && <Button size="small" onClick={() => setExpanded(!expanded)} sx={{ alignSelf: 'flex-start' }}>{expanded ? 'Show first 10' : `+${rows.length - 10} more`}</Button>}
    {(result.data?.total ?? 0) > rows.length && <Button size="small" onClick={() => openLevelingSpells(focus)}>See all {result.data?.total} in Spells</Button>}
  </Stack>
}

function ClientUnlockStatus({ result, known, level }: {
  result: { data: SpellByLevelResult | null; loading: boolean; error: string | null }; known: boolean; level: number
}): JSX.Element {
  return <>
    {result.loading && <CircularProgress size={18} aria-label="Loading eligible spells" />}
    {result.error && <Alert severity="warning">Spell eligibility unavailable: {result.error}</Alert>}
    {!known && <Typography variant="caption" color="text.secondary">Resolve your character classes, or choose classes in Spells.</Typography>}
    {result.data && !result.data.dataset && <Alert severity="warning">Client spell catalog unavailable. Check for updates in Spells.</Alert>}
    {result.data?.dataset && result.data.records.length === 0 && <Typography variant="caption" color="text.secondary">No matching new client spells at level {level}.</Typography>}
  </>
}

function ClientUnlockRow({ row, focus }: { row: SpellSummary; focus: SpellLibraryFocus }): JSX.Element {
  return <Box data-testid="new-at-level-client-spell" data-id={row.id} sx={{ py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
    <Button size="small" onClick={() => openLevelingSpells({ ...focus, id: row.id })} data-testid="new-at-level-spell-name" sx={{ minWidth: 0, p: 0, textAlign: 'left', justifyContent: 'flex-start', textTransform: 'none' }}>{row.name}</Button>
    <Typography variant="caption" display="block">#{row.id} · {row.classes.map((item) => `${item.code} ${item.level}`).join(' · ')} · {row.category || 'Uncategorized'} · {row.mana} mana</Typography>
    <Typography variant="caption" color="text.secondary" display="block">{row.detectedRank === null || row.detectedRank === undefined ? 'Mote rank unknown' : `Detected mote ${rankLabel(row.detectedRank)}`}</Typography>
    {row.description && <Typography variant="caption" color="text.secondary" display="block" sx={{ overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{row.description}</Typography>}
    <Stack direction="row" gap={1} flexWrap="wrap">
      <Button size="small" onClick={() => openLevelingSpells({ ...focus, id: row.id, level: row.learnedLevel ?? focus.level })}>Preview at this level</Button>
      <Button size="small" onClick={() => openLevelingSpells({ ...focus, tab: 'compare', id: row.id })}>Add to Compare</Button>
    </Stack>
  </Box>
}
