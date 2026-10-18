import { type JSX, useCallback, useEffect, useState } from 'react'
import { Alert, Button, Chip, CircularProgress, Pagination, Stack, TextField, Typography } from '@mui/material'
import type { SpellEmulation } from '@shared/spellModifiers'
import { useLibraryQuery } from './useLibraryQuery'
import { useSearchText } from './useSearchText'

export function SpellFocusPicker({ value, disabled, onChange }: {
  value: SpellEmulation; disabled: boolean; onChange: (value: SpellEmulation) => void
}): JSX.Element {
  const [text, setText] = useState('')
  const [page, setPage] = useState(1)
  const queryText = useSearchText(text)
  useEffect(() => { setPage(1) }, [queryText])
  const load = useCallback(() => window.eq.spellLibrary.focusOptions({ text: queryText, page }), [queryText, page])
  const { data, loading, error } = useLibraryQuery(load)
  const toggle = (id: number): void => {
    onChange({ ...value, focusIds: value.focusIds.includes(id) ? value.focusIds.filter((n) => n !== id) : [...value.focusIds, id] })
  }
  return <Stack spacing={1} data-testid="spells-focus-picker">
    <TextField size="small" label="Find damage or healing focus" value={text} onChange={(event) => setText(event.target.value)} slotProps={{ htmlInput: { 'data-testid': 'spells-focus-search' } }} />
    <Typography variant="caption">Choose real client focus effects. Their qualification limits still apply; qualifying focuses are not added together.</Typography>
    <Stack direction="row" gap={0.5} flexWrap="wrap">{value.focusIds.map((id) => <Chip key={id} size="small" label={`Focus ID ${id}`} disabled={disabled} onDelete={() => toggle(id)} />)}</Stack>
    {error && <Alert severity="error">{error}</Alert>}
    {loading && <CircularProgress size={20} />}
    {data?.records.map((option) => <Stack key={option.id} direction="row" alignItems="center" spacing={1}>
      <Button size="small" variant={value.focusIds.includes(option.id) ? 'contained' : 'outlined'} disabled={disabled || !option.supported} onClick={() => toggle(option.id)} data-testid={`spells-focus-${option.id}`}>{value.focusIds.includes(option.id) ? 'Selected' : 'Select'}</Button>
      <Typography variant="body2">{option.name} · ID {option.id}{option.kind && ` · ${option.kind}`}<Typography component="span" variant="caption" display="block" color="text.secondary">{option.reason}</Typography></Typography>
    </Stack>)}
    {data?.total === 0 && <Typography variant="body2">No matching focus definitions.</Typography>}
    {data && data.total > 30 && <Pagination count={Math.ceil(data.total / 30)} page={page} onChange={(_event, next) => setPage(next)} />}
  </Stack>
}
