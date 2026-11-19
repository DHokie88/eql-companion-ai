import type { JSX } from 'react'
import { useState } from 'react'
import { FormControl, FormControlLabel, Switch, InputLabel, MenuItem, Select, Stack, Tooltip } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { SPELL_CLASSES, type SpellClass } from '@shared/spellLibrary'
import type { SpellTargetCount } from '@shared/spellAnalysis'
import { SpellModifierControls } from './SpellModifierControls'
import { SpellTargetControls } from './SpellTargetControls'
import type { SpellModifiersState } from './useSpellModifiers'
import type { useSpellViewState } from './useSpellViewState'

export function SpellWorkspaceControls({ state, classes, combo, modifiers, targets }: {
  state: ReturnType<typeof useSpellViewState>; classes: SpellClass[]; combo: SpellClass[]
  modifiers: SpellModifiersState; targets: SpellTargetCount
}): JSX.Element {
  return <Stack spacing={1} data-testid="spells-workspace-controls">
    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
      <ClassesPicker mode={state.mode} classes={classes} combo={combo} onChange={(mode, selected) => { state.setMode(mode); state.setClasses(selected) }} />
      <SpellModifierControls state={modifiers}>
        <SpellTargetControls targets={targets} disabled={!modifiers.context || modifiers.saving || modifiers.loading} onChange={(value) => {
          state.setBrowseTargets(null)
          if (modifiers.context) modifiers.update({ ...modifiers.context.preferences, targets: value })
        }} />
      </SpellModifierControls>
      {state.tab === 'browse' && <Tooltip title="Show the best matching spell from existing Companion replacement families and shared recast timers. Damage and healing choices follow the Amount, Damage/Mana or Rate sort at your selected level, targets and modifiers. Stat buffs use effect strength. Expand the arrow for alternatives."><FormControlLabel sx={{ mr: 0 }} control={<Switch size="small" checked={state.bestInLine} onChange={(_event, checked) => state.setBestInLine(checked)} data-testid="spells-best-in-line" />} label="Best in line" /></Tooltip>}
      <Tooltip disableInteractive title="Class/Level shows eligibility in the spell files. It does not confirm ownership, scroll availability, or acquisition. Yours badges show observed upgrades."><InfoOutlinedIcon sx={{ color: 'text.secondary', fontSize: 18 }} /></Tooltip>
    </Stack>
  </Stack>
}

function ClassesPicker({ mode, classes, combo, onChange }: {
  mode: 'character' | 'custom' | 'all'; classes: SpellClass[]; combo: SpellClass[]
  onChange: (mode: 'character' | 'custom' | 'all', classes: SpellClass[]) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const choose = (values: string[]): void => {
    if (values.includes('all')) { onChange('all', []); setOpen(false); return }
    if (values.includes('none')) { onChange('custom', []); setOpen(false); return }
    if (values.includes('mine')) { onChange('character', combo); setOpen(false); return }
    onChange('custom', values.filter((value): value is SpellClass => SPELL_CLASSES.includes(value as SpellClass)))
  }
  return <FormControl size="small" sx={{ minWidth: 190, maxWidth: 440 }}><InputLabel id="spells-classes-label" shrink>Classes</InputLabel>
    <Select multiple displayEmpty open={open} onOpen={() => setOpen(true)} onClose={() => setOpen(false)} labelId="spells-classes-label" label="Classes" value={mode === 'all' ? [...SPELL_CLASSES] : classes} data-testid="spells-classes" renderValue={(values) => mode === 'all' ? 'All' : values.length ? values.join(' / ') : 'Select…'} onChange={(event) => choose(typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)} MenuProps={{ slotProps: { paper: { sx: { bgcolor: 'background.paper', backgroundImage: 'none' } } } }}>
      <MenuItem value="all" data-testid="spells-classes-all">All</MenuItem><MenuItem value="none" data-testid="spells-classes-none">None</MenuItem><MenuItem value="mine" disabled={!combo.length} data-testid="spells-classes-mine">My classes</MenuItem>
      {SPELL_CLASSES.map((code) => <MenuItem key={code} value={code}>{code}</MenuItem>)}
    </Select>
  </FormControl>
}
