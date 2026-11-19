import type { JSX, ReactNode } from 'react'
import { Alert, CircularProgress, Stack } from '@mui/material'
import type { SpellModifiersState } from './useSpellModifiers'

/** Targets and load state. Rank and Use my ranks live on the browse toolbar. */
export function SpellModifierControls({ state, children }: { state: SpellModifiersState; children?: ReactNode }): JSX.Element {
  const { context, error } = state
  return <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" data-testid="spells-modifier-controls">
    {error && <Alert severity="error">{error}</Alert>}
    {!context && !error && <CircularProgress size={20} aria-label="Loading spell inputs" />}
    {context && children}
  </Stack>
}
