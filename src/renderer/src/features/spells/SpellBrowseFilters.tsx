import type { JSX, ReactNode } from 'react'
import { Button, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material'
import type { SpellBrowseType } from '@shared/spellLibrary'
import type { BrowseFilters } from './useSpellBrowse'
import { SpellLevelBounds } from './SpellLevelBounds'

function ChoiceFilter({ name, label, value, options, onChange, compact = false }: {
  name: string; label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; compact?: boolean
}): JSX.Element {
  return <FormControl size="small" sx={compact ? { width: 115 } : { minWidth: 145, flexGrow: 1 }}><InputLabel id={`spell-${name}-label`}>{label}</InputLabel>
    <Select labelId={`spell-${name}-label`} label={label} value={value} data-testid={`spells-${name}`} onChange={(e) => onChange(e.target.value)}>
      <MenuItem value="">All</MenuItem>{options.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
    </Select></FormControl>
}
function textOptions(values: string[], selected: string) {
  return [...new Set([...values, ...(selected ? [selected] : [])])].map((value) => ({ value, label: value }))
}
const BASIC_TYPES: { value: SpellBrowseType; label: string }[] = [
  { value: 'dd', label: 'DD' }, { value: 'rain', label: 'Rain' }, { value: 'aoe', label: 'AOE' }, { value: 'dot', label: 'DoT' },
  { value: 'heal', label: 'Heal' }, { value: 'hot', label: 'HoT' }, { value: 'other', label: 'Buffs / utility' }
]
function TypeFilters({ filters, change, columns }: Pick<Props, 'filters' | 'change' | 'columns'>): JSX.Element {
  const cap = /^aoe\d+$/.test(filters.type) ? filters.type : ''
  return <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
    <ToggleButtonGroup size="small" exclusive value={filters.hpFilter || (cap ? 'aoe' : filters.type)} onChange={(_e, value: SpellBrowseType | 'damage' | 'healing' | '' | null) => { if (value === 'damage' || value === 'healing') change('hpFilter', value); else if (value !== null) change('type', value) }} aria-label="Spell type" sx={{ flexWrap: 'wrap' }}>
      <ToggleButton value="" data-testid="spells-type-all">All types</ToggleButton>
      <ToggleButton value="damage" data-testid="spells-type-damage">All damage</ToggleButton><ToggleButton value="healing" data-testid="spells-type-healing">All heals</ToggleButton>
      {BASIC_TYPES.map(({ value, label }) => <ToggleButton key={value} value={value} data-testid={`spells-type-${value}`}>{label}</ToggleButton>)}
    </ToggleButtonGroup>
    {columns}
  </Stack>
}
interface Props {
  filters: BrowseFilters; maximum: string; categories: string[]; subcategories: string[]; invalid: string | null
  change: <K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]) => void; reset: () => void
  hideTypes?: boolean; controls?: ReactNode; columns?: ReactNode; typeOptions?: { value: SpellBrowseType; label: string }[]
  characterKey?: string; levelCaption?: string
}
export function SpellBrowseFilters({ filters, maximum, categories, subcategories, change, reset, invalid, hideTypes = false, controls, columns, characterKey = '', levelCaption }: Props): JSX.Element {
  const min = /^\d+$/.test(filters.min) ? Number(filters.min) : 0
  const max = /^\d+$/.test(maximum) ? Number(maximum) : 0
  return <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2 }} data-testid="spells-filter-panel"><Stack spacing={2}>
    <Stack direction="row" gap={1} flexWrap="wrap" alignItems="flex-start">
      <TextField size="small" label="Spell name or ID" value={filters.text} slotProps={{ htmlInput: { 'data-testid': 'spells-search' } }} onChange={(e) => change('text', e.target.value)} sx={{ minWidth: 230, flexGrow: 1 }} />
      <Tooltip title="Eligibility across the selected classes. Min 0 includes an explicit level-less class row. A missing or ineligible level stays unknown. Caster level, from the character's stated level, is separate and drives calculated strength.">
        <span><SpellLevelBounds min={min} max={max} characterKey={characterKey} caption={levelCaption} onMin={(value) => change('min', String(value))} onMax={(value) => change('max', String(value))} /></span>
      </Tooltip>
      <Button onClick={reset} data-testid="spells-reset-filters" sx={{ mt: 0.5 }}>Reset filters</Button>
    </Stack>
    {invalid && <Typography color="error" variant="caption">{invalid}</Typography>}
    {controls}
    {!hideTypes && <TypeFilters filters={filters} change={change} columns={columns} />}
    <Stack direction="row" gap={1} flexWrap="wrap">
      <ChoiceFilter name="category" label="Category" value={filters.category} options={textOptions(categories, filters.category)} onChange={(value) => change('category', value)} />
      <ChoiceFilter name="subcategory" label="Subcategory" value={filters.subcategory} options={textOptions(subcategories, filters.subcategory)} onChange={(value) => change('subcategory', value)} />
      <ChoiceFilter name="polarity" label="Helpful / harmful" value={filters.polarity} options={[{ value: 'beneficial', label: 'Helpful' }, { value: 'detrimental', label: 'Harmful' }]} onChange={(value) => change('polarity', value as BrowseFilters['polarity'])} />
      <TextField size="small" label="Effect (SPA)" type="number" value={filters.effect} slotProps={{ htmlInput: { min: 0, max: 100000, 'data-testid': 'spells-effect' } }} onChange={(e) => change('effect', e.target.value)} sx={{ width: 140 }} />
    </Stack>
  </Stack></Paper>
}
