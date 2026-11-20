import type { JSX } from 'react'
import { Checkbox, FormControl, InputLabel, ListItemText, MenuItem, Select, Stack, Tab, Tabs } from '@mui/material'
import type { SpellMetric, SpellSearchQuery, SpellSearchResult } from '@shared/spellLibrary'
import { browseColumns, selectableBrowseColumns, type BrowseDisplayField, type CategoryDisplay } from './spellBrowseColumns'
import { SPELL_COLUMN_PRESETS, type ColumnPresetChoice } from './spellColumnPresets'
export function BrowseColumnPicker({ metric, columns, setColumns, display = 'both', uniformType = false, columnCount, preset, setPreset }: {
  metric: SpellMetric; columns: BrowseDisplayField[]; setColumns: (columns: BrowseDisplayField[]) => void
  display?: CategoryDisplay; uniformType?: boolean; columnCount?: number
  preset: ColumnPresetChoice; setPreset: (preset: ColumnPresetChoice) => void
}): JSX.Element {
  const shown = columnCount ?? browseColumns(metric, display, columns, uniformType).length
  return <Stack direction="row" gap={1} flexWrap="wrap" sx={{ ml: 'auto' }}>
    <FormControl size="small" sx={{ minWidth: 160 }}><InputLabel id="spell-preset-label">Column preset</InputLabel>
      <Select labelId="spell-preset-label" label="Column preset" value={preset} onChange={(event) => setPreset(event.target.value as ColumnPresetChoice)} data-testid="spells-column-preset">
        <MenuItem value="default">Default</MenuItem><MenuItem value="auto">Match spell type</MenuItem><MenuItem value="custom">Custom</MenuItem>
        {SPELL_COLUMN_PRESETS.map(({ id, label }) => <MenuItem key={id} value={id}>{label}</MenuItem>)}
      </Select>
    </FormControl>
    <FormControl size="small" sx={{ width: 130 }}><InputLabel id="browse-columns-label">Columns</InputLabel>
      <Select multiple labelId="browse-columns-label" label="Columns" value={columns} renderValue={() => `${shown} shown`} data-testid="spells-columns" onChange={(e) => setColumns(e.target.value as BrowseDisplayField[])}>
        <MenuItem disabled>Spell, Rank, and Class/Level always shown</MenuItem>
        {selectableBrowseColumns(metric).map((column) => <MenuItem key={column.field} value={column.field} data-testid={`spells-column-${column.field}`}><Checkbox checked={columns.includes(column.field)} /><ListItemText primary={column.label} /></MenuItem>)}
      </Select>
    </FormControl>
  </Stack>
}
export function BrowseGroups({ group, onChange, counts }: {
  group: NonNullable<SpellSearchQuery['group']>; onChange: (group: NonNullable<SpellSearchQuery['group']>) => void; counts: SpellSearchResult['groupCounts']
}): JSX.Element {
  return <Tabs value={group} onChange={(_e, value: NonNullable<SpellSearchQuery['group']>) => onChange(value)} aria-label="Spell result groups" variant="scrollable">
    <Tab value="all" label="All spells" data-testid="spells-group-all" />
    <Tab value="ranked" label={`Ranked (${counts?.ranked ?? 0})`} data-testid="spells-group-ranked" />
    <Tab value="zero-mana" label={`Zero mana (${counts?.zeroMana ?? 0})`} data-testid="spells-group-zero-mana" />
    <Tab value="excluded" label={`Unsupported / utility (${counts?.excluded ?? 0})`} data-testid="spells-group-excluded" />
  </Tabs>
}
