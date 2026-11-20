import { useState, type JSX } from 'react'
import { Button, Checkbox, FormControlLabel, MenuItem, Stack, TextField } from '@mui/material'
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined'
import type { PrefSection } from './PreferencesView'
import { selectableBrowseColumns } from '../spells/spellBrowseColumns'
import { DEFAULT_SPELL_PRESETS, saveSpellColumnPreset, SPELL_COLUMN_PRESETS, useSpellColumnPresets, type SpellColumnPreset } from '../spells/spellColumnPresets'

function SpellColumnPresetSetting(): JSX.Element {
  const [preset, setPreset] = useState<SpellColumnPreset>('direct')
  const presets = useSpellColumnPresets()
  const columns = presets[preset]
  return <Stack spacing={1.5} data-testid="spell-column-preset-setting">
    <TextField select label="Column preset" size="small" value={preset} onChange={(event) => setPreset(event.target.value as SpellColumnPreset)} data-testid="pref-spell-preset-select" sx={{ maxWidth: 300 }}>
      {SPELL_COLUMN_PRESETS.map(({ id, label }) => <MenuItem key={id} value={id}>{label}</MenuItem>)}
    </TextField>
    <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.5}>
      {selectableBrowseColumns(preset === 'healing' ? 'healing' : 'damage', 'presets').map(({ field, label }) => <FormControlLabel key={field} label={label}
        control={<Checkbox size="small" checked={columns.includes(field)} onChange={(_event, checked) => saveSpellColumnPreset(preset, checked ? [...columns, field] : columns.filter((column) => column !== field))} />}
        data-testid={`pref-spell-preset-column-${field}`} sx={{ width: 190 }} />)}
    </Stack>
    <Button size="small" onClick={() => saveSpellColumnPreset(preset, DEFAULT_SPELL_PRESETS[preset])} sx={{ alignSelf: 'flex-start' }}>Restore preset defaults</Button>
  </Stack>
}

export function spellColumnPresetSection(): PrefSection {
  return {
    id: 'spell-columns', label: 'Spell columns', icon: <ViewColumnOutlinedIcon fontSize="small" />,
    items: [{ id: 'spell-column-presets', label: 'Column presets', keywords: 'spells browse compare progression buffs debuffs DD rain damage healing customize', content: <SpellColumnPresetSetting /> }]
  }
}
