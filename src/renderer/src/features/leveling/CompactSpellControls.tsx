import type { JSX } from 'react'
import { Alert, Chip, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import type { SpellRankingCategory } from '@shared/spellAnalysis'
import type { SpellValueMode } from '@shared/spellModifiers'
import type { SpellModifiersState } from '../spells/useSpellModifiers'

/** These are shared profile preferences; no panel-local slider can silently override detected ranks. */
export function CompactSpellControls({ state, category }: { state: SpellModifiersState; category: SpellRankingCategory }): JSX.Element {
  const { context, loading, saving, error, update } = state
  const preferences = context?.preferences
  const disabled = loading || saving
  return <Stack spacing={0.5} data-testid="best-spells-modifiers">
    {error && <Alert severity="warning">Modifier inputs unavailable: {error}</Alert>}
    {context && preferences && <>
      <ToggleButtonGroup size="small" exclusive value={preferences.mode} disabled={disabled} aria-label="Leveling spell value mode" sx={{ flexWrap: 'wrap', '& button': { fontSize: 10, px: 0.75 } }}
        onChange={(_event, mode: SpellValueMode | null) => { if (mode) update({ ...preferences, mode }) }}>
        <ToggleButton value="client" data-testid="best-spells-mode-client">Client values</ToggleButton>
        <ToggleButton value="mine" disabled={disabled || !context.character} data-testid="best-spells-mode-mine">Show mine</ToggleButton>
        <ToggleButton value="emulate" data-testid="best-spells-mode-emulate">Emulate</ToggleButton>
      </ToggleButtonGroup>
      {preferences.mode === 'emulate' && <Chip size="small" variant="outlined" label="Simulated" sx={{ alignSelf: 'flex-start' }} />}
      {category === 'aoe' && <TextField select label="AOE targets" size="small" value={preferences.targets ?? 4} disabled={disabled} data-testid="best-spells-targets"
        onChange={(event) => update({ ...preferences, targets: event.target.value === 'maximum' ? 'maximum' : Number(event.target.value) })}>
        {Array.from({ length: 100 }, (_, index) => index + 1).map((count) => <MenuItem key={count} value={count}>{count} targets</MenuItem>)}
        <MenuItem value="maximum">Spell maximum</MenuItem>
      </TextField>}
      {preferences.mode === 'emulate' && <Typography variant="caption" color="text.secondary">Uses your shared emulation settings. Open Spells to edit ranks and focus.</Typography>}
    </>}
  </Stack>
}
