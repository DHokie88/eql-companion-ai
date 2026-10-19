import type { JSX, ReactNode } from 'react'
import { Alert, CircularProgress, FormControlLabel, Stack, Switch, Tooltip } from '@mui/material'
import { toggleShowMine } from '@shared/spellPreviewControls'
import type { SpellModifiersState } from './useSpellModifiers'
import { SpellRankPreview } from './SpellRankPreview'

export function SpellModifierControls({ state, children }: { state: SpellModifiersState; children?: ReactNode }): JSX.Element {
  const { context, saving, loading, error, update } = state
  return <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" data-testid="spells-modifier-controls">
    {error && <Alert severity="error">{error}</Alert>}
    {!context && !error && <CircularProgress size={20} aria-label="Loading spell inputs" />}
    {context && <>
      <Tooltip disableInteractive title={context.character ? 'Use this character’s observed ranks, worn focus and supported instruments. Per-spell details explain the inputs.' : 'Select a character to use detected ranks and equipment. Rank previews remain available for this session.'}>
        <FormControlLabel sx={{ mr: 0 }} label="Show mine" data-testid="spells-show-mine" control={<Switch size="small" checked={context.preferences.mode === 'mine'} disabled={saving || loading || !context.character} data-testid="spells-mode-mine" onChange={(_event, checked) => update(toggleShowMine(context.preferences, checked))} />} />
      </Tooltip>
      <SpellRankPreview state={state} />
      {children}
    </>}
  </Stack>
}
