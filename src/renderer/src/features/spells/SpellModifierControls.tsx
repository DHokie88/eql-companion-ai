import type { JSX } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Button, CircularProgress, FormControl, InputLabel, MenuItem, Select, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { defaultSpellModifierPreferences, type SpellEmulation, type SpellModifierContext, type SpellModifierPreferences, type SpellValueMode } from '@shared/spellModifiers'
import type { SpellModifiersState } from './useSpellModifiers'
import { rankLabel } from './SpellEstimate'
import { SpellFocusPicker } from './SpellFocusPicker'
import { SpellRankOverrides } from './SpellRankOverrides'
import { SpellRankPreview } from './SpellRankPreview'

export function SpellModifierControls({ state, ids }: { state: SpellModifiersState; ids: number[] }): JSX.Element {
  const { context, saving, loading, error, update } = state
  const preferences = context?.preferences
  const disabled = saving || loading
  return <Stack spacing={1} data-testid="spells-modifier-controls">
    {error && <Alert severity="error">{error}</Alert>}
    {!context && !error && <CircularProgress size={20} aria-label="Loading spell modifiers" />}
    {context && preferences && <>
      <ValueModeButtons context={context} disabled={disabled} onChange={update} />
      <SpellRankPreview state={state} />
      {!context.character && <Typography variant="caption" color="text.secondary">Select a character to use Show mine. Characterless emulation lasts for this session.</Typography>}
      {saving && <Typography variant="caption">Saving modifier settings…</Typography>}
      <Accordion data-testid="spells-modifiers-panel">
        <AccordionSummary>Modifiers{preferences.mode === 'emulate' ? ' · Simulated' : ''}</AccordionSummary>
        <AccordionDetails><Stack spacing={2}>
          <DetectedInputs context={context} />
          {preferences.mode === 'emulate' && <EmulationControls preferences={preferences} ids={ids} disabled={disabled} onChange={update} />}
          <Typography variant="caption" color="text.secondary">Estimates use measured mote rules, qualifying worn damage/healing focus, and supported bard instrument equipment. Show mine and Emulate use the best known carried instrument; details also show the equipped result and any required swap. AA, temporary singing bonuses, critical hits, resists, mana/casting-speed modifiers, and recourse are excluded. Only verified rain layouts are modeled; other repeated waves remain unsupported. Efficiency uses client mana cost.</Typography>
        </Stack></AccordionDetails>
      </Accordion>
    </>}
  </Stack>
}

function ValueModeButtons({ context, disabled, onChange }: {
  context: SpellModifierContext; disabled: boolean; onChange: (preferences: SpellModifierPreferences) => void
}): JSX.Element {
  return <ToggleButtonGroup size="small" exclusive value={context.preferences.mode} disabled={disabled} onChange={(_event, mode: SpellValueMode | null) => { if (mode) onChange({ ...context.preferences, mode }) }} aria-label="Spell value mode">
    <ToggleButton value="client" data-testid="spells-mode-client">Client values</ToggleButton>
    <ToggleButton value="mine" disabled={disabled || !context.character} data-testid="spells-mode-mine">Show mine</ToggleButton>
    <ToggleButton value="emulate" data-testid="spells-mode-emulate">Emulate</ToggleButton>
  </ToggleButtonGroup>
}

function DetectedInputs({ context }: { context: SpellModifierContext }): JSX.Element {
  const { inventory } = context
  const ranks = Object.values(context.ranks ?? {})
  return <Stack spacing={0.5} data-testid="spells-detected-inputs">
    <Typography variant="subtitle2">Detected inputs{context.character ? ` · ${context.character.name} @ ${context.character.server}` : ''}</Typography>
    <Typography variant="body2">{context.ranks === null ? 'Mote rank observations unavailable.' : `${ranks.length} observed spell lines. Unobserved ranks remain unknown.`}</Typography>
    {ranks.length > 0 && <Accordion><AccordionSummary>Observed mote ranks ({ranks.length})</AccordionSummary><AccordionDetails>{ranks.map((row) => <Typography key={row.name} variant="body2">{row.name}: {rankLabel(row.rank)}</Typography>)}</AccordionDetails></Accordion>}
    <InventorySummary context={context} />
    {inventory.candidates.map((candidate, index) => <Typography key={`${candidate.item}:${candidate.effect}:${index}`} variant="body2">{candidate.item}: {candidate.effect}</Typography>)}
    {[...context.warnings, ...inventory.warnings].map((warning, index) => <Typography key={`${index}:${warning}`} variant="body2" color="warning.main">{warning}</Typography>)}
  </Stack>
}

function InventorySummary({ context }: { context: SpellModifierContext }): JSX.Element {
  const inventory = context.inventory
  if (inventory.state !== 'ready') return <Alert severity="warning">{inventory.state === 'missing' ? 'No inventory export is available.' : 'The inventory export could not be read.'} In EQ, run /outputfile inventory to refresh equipment evidence.</Alert>
  return <>
    <Typography variant="body2">Inventory exported {inventory.exportedAt ? new Date(inventory.exportedAt).toLocaleString() : 'at an unknown time'}. This describes equipment at export time. Run /outputfile inventory in EQ to refresh it.</Typography>
    {inventory.candidates.length === 0 && <Typography variant="body2">No focus effects were identified in this inventory export. See any coverage warnings below.</Typography>}
  </>
}

function EmulationControls({ preferences, ids, disabled, onChange }: {
  preferences: SpellModifierPreferences; ids: number[]; disabled: boolean; onChange: (preferences: SpellModifierPreferences) => void
}): JSX.Element {
  const value = preferences.emulation
  const update = (emulation: SpellEmulation): void => onChange({ ...preferences, emulation })
  return <Stack spacing={1.5} data-testid="spells-emulation">
    <Typography variant="subtitle2">Simulated inputs</Typography>
    <SpellRankOverrides ids={ids} value={value} disabled={disabled} onChange={update} />
    <FormControl size="small" sx={{ maxWidth: 420 }}><InputLabel id="spells-focus-mode-label">Focus assumptions</InputLabel>
      <Select labelId="spells-focus-mode-label" label="Focus assumptions" value={value.focus} disabled={disabled} data-testid="spells-focus-mode" onChange={(event) => update({ ...value, focus: event.target.value as SpellEmulation['focus'] })}>
        <MenuItem value="detected">Use detected equipment</MenuItem><MenuItem value="none">No damage/healing focus</MenuItem><MenuItem value="selected">Choose simulated focus effects</MenuItem>
      </Select>
    </FormControl>
    {value.focus === 'selected' && <SpellFocusPicker value={value} disabled={disabled} onChange={update} />}
    <Button size="small" sx={{ alignSelf: 'flex-start' }} disabled={disabled} onClick={() => onChange({ ...preferences, emulation: defaultSpellModifierPreferences().emulation })} data-testid="spells-emulation-reset">Reset emulation</Button>
  </Stack>
}
