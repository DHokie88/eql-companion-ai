import { type JSX, type KeyboardEvent, useEffect, useState } from 'react'
import { IconButton, Stack, TextField, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { commitBrowseLevel, stepBrowseLevel } from './spellLevelRange'

function LevelStepper({ label, value, other, side, testId, characterKey, onCommit }: {
  label: string; value: number; other: number; side: 'min' | 'max'; testId: string; characterKey: string; onCommit: (value: number) => void
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setDraft(null); setError(null) }, [value, characterKey])
  const shown = draft ?? String(value)
  const commit = (): void => {
    if (draft === null) return
    const result = commitBrowseLevel(draft, other, side)
    if (!result.ok) { setError(result.error); return }
    setError(null)
    setDraft(null)
    if (result.value !== value) onCommit(result.value)
  }
  const step = (delta: number): void => {
    const base = draft !== null && /^\d+$/.test(draft.trim()) ? Number(draft.trim()) : value
    const next = stepBrowseLevel(base, delta, other, side)
    setDraft(null)
    setError(null)
    if (next !== value) onCommit(next)
  }
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Enter') { event.preventDefault(); commit() }
  }
  return <Stack direction="row" gap={0.25} alignItems="center" data-testid={`${testId}-stepper`}>
    <IconButton size="small" aria-label={`Decrease ${label}`} data-testid={`${testId}-decrease`} onMouseDown={(event) => event.preventDefault()} onClick={() => step(-1)}><ChevronLeftIcon fontSize="small" /></IconButton>
    <TextField size="small" label={label} value={shown} error={!!error} helperText={error ?? ' '} slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-invalid': error ? true : undefined, 'data-testid': testId, style: { textAlign: 'center', width: 36 } } }} sx={{ width: 118 }} onFocus={() => { if (draft === null) setDraft(String(value)) }} onChange={(event) => { setDraft(event.target.value); setError(null) }} onBlur={commit} onKeyDown={onKey} />
    <IconButton size="small" aria-label={`Increase ${label}`} data-testid={`${testId}-increase`} onMouseDown={(event) => event.preventDefault()} onClick={() => step(1)}><ChevronRightIcon fontSize="small" /></IconButton>
  </Stack>
}

export function SpellLevelBounds({ min, max, characterKey, caption, onMin, onMax }: {
  min: number; max: number; characterKey: string; caption?: string; onMin: (value: number) => void; onMax: (value: number) => void
}): JSX.Element {
  return <Stack gap={0.25} data-testid="spells-level-bounds">
    <Stack direction="row" gap={1} alignItems="flex-start" flexWrap="wrap">
      <LevelStepper label="Min spell level" value={min} other={max} side="min" testId="spells-min-level" characterKey={characterKey} onCommit={onMin} />
      <LevelStepper label="Max spell level" value={max} other={min} side="max" testId="spells-max-level" characterKey={characterKey} onCommit={onMax} />
    </Stack>
    {caption && <Typography variant="caption" color="text.secondary" data-testid="spells-level-source">{caption}</Typography>}
  </Stack>
}
