import { type JSX, useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, FormControl, InputLabel, MenuItem, Pagination, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import type { SpellClass } from '@shared/spellLibrary'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import { useLibraryQuery } from './useLibraryQuery'
import { useSearchText } from './useSearchText'
import { EstimateAmount } from './SpellEstimate'

export function SpellBrowse({ classes, level, evaluation, allSpells, enabled, selected, onToggle, onOpen }: {
  classes: SpellClass[]; level: number; allSpells: boolean; enabled: boolean; selected: number[]
  evaluation: SpellEvaluationOptions
  onToggle: (id: number) => void; onOpen: (id: number) => void
}): JSX.Element {
  const [text, setText] = useState('')
  const queryText = useSearchText(text)
  const [category, setCategory] = useState('')
  const [effect, setEffect] = useState('')
  const [page, setPage] = useState(1)
  const classKey = classes.join(',')
  useEffect(() => { setPage(1) }, [classKey, level, allSpells])
  const load = useCallback(() => window.eq.spellLibrary.search({
    text: queryText, classes: classKey ? classKey.split(',') as SpellClass[] : [], level, allSpells,
    category: category || undefined, effect: effect === '' ? undefined : Number(effect), page, pageSize: 40, evaluation
  }), [queryText, classKey, level, allSpells, category, effect, page, evaluation])
  const { data, loading, error } = useLibraryQuery(load)
  const reset = (change: () => void): void => { change(); setPage(1) }
  if (!enabled) return <Box />
  return <Stack spacing={1.5} data-testid="spells-browse">
    <Stack direction="row" gap={1} flexWrap="wrap">
      <TextField size="small" label="Spell name or numeric ID" value={text} slotProps={{ htmlInput: { 'data-testid': 'spells-search' } }} onChange={(e) => reset(() => setText(e.target.value))} sx={{ minWidth: 260, flexGrow: 1 }} />
      <FormControl size="small" sx={{ minWidth: 180 }}><InputLabel id="spell-category-label">Category</InputLabel><Select labelId="spell-category-label" label="Category" value={category} data-testid="spells-category" onChange={(e) => reset(() => setCategory(e.target.value))}><MenuItem value="">All categories</MenuItem>{(data?.categories ?? (category ? [category] : [])).map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</Select></FormControl>
      <TextField size="small" label="Effect (SPA number)" type="number" value={effect} slotProps={{ htmlInput: { min: 0, 'data-testid': 'spells-effect' } }} onChange={(e) => reset(() => setEffect(e.target.value))} sx={{ width: 180 }} />
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    {loading && <CircularProgress size={22} aria-label="Searching spells" />}
    {data && <>
      <Typography variant="caption" color="text.secondary">{data.total.toLocaleString()} matching records · IDs and ranks are preserved · revision {data.dataset?.contentId.slice(0, 14) ?? 'no baseline'}</Typography>
      <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Client spell records"><TableHead><TableRow><TableCell>ID</TableCell><TableCell>Spell</TableCell><TableCell>Client classes / levels</TableCell><TableCell>Category</TableCell><TableCell>HP amount / target</TableCell><TableCell align="right">Client mana</TableCell><TableCell>Compare</TableCell></TableRow></TableHead>
        <TableBody>{data.records.map((record) => <TableRow key={record.id} hover data-testid="spells-record"><TableCell>{record.id}</TableCell><TableCell><Button size="small" onClick={() => onOpen(record.id)} data-testid={`spells-open-${record.id}`}>{record.name}</Button></TableCell><TableCell>{record.classes.length ? record.classes.map((c) => `${c.code} ${c.level}`).join(' · ') : 'Internal / NPC'}</TableCell><TableCell>{record.category || 'Uncategorized'}</TableCell><TableCell>{record.calculations?.map((calculation) => <Box key={calculation.metric}><Typography variant="caption">{calculation.metric}</Typography><EstimateAmount calculation={calculation} /></Box>)}</TableCell><TableCell align="right">{record.mana}</TableCell><TableCell><Button size="small" variant={selected.includes(record.id) ? 'contained' : 'outlined'} disabled={!selected.includes(record.id) && selected.length >= 4} onClick={() => onToggle(record.id)} data-testid={`spells-compare-${record.id}`}>{selected.includes(record.id) ? 'Selected' : 'Add'}</Button></TableCell></TableRow>)}</TableBody>
      </Table></Box>
      {data.total === 0 && <Typography>No matching spells in this captured dataset.</Typography>}
      {data.total > 40 && <Pagination count={Math.ceil(data.total / 40)} page={page} onChange={(_e, value) => setPage(value)} data-testid="spells-pagination" />}
    </>}
  </Stack>
}
