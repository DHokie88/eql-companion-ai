import type { JSX, ReactNode } from 'react'
import { Button, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material'
import type { SpellBrowseType } from '@shared/spellLibrary'
import type { BrowseFilters } from './useSpellBrowse'

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
}
export function SpellBrowseFilters({ filters, maximum, categories, subcategories, change, reset, invalid, hideTypes = false, controls, columns }: Props): JSX.Element {
  return <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2 }} data-testid="spells-filter-panel"><Stack spacing={2}>
    <Stack direction="row" gap={1} flexWrap="wrap">
      <TextField size="small" label="Spell name or ID" value={filters.text} slotProps={{ htmlInput: { 'data-testid': 'spells-search' } }} onChange={(e) => change('text', e.target.value)} sx={{ minWidth: 230, flexGrow: 1 }} />
      <Tooltip title="Spell eligibility level across your selected classes. Blank bounds include every level; level limits omit records without a class requirement. Caster level separately controls calculated strength."><Stack direction="row" gap={1}>
        <TextField size="small" label="Min spell level" type="number" value={filters.min} error={!!invalid} slotProps={{ htmlInput: { min: 1, max: 255, 'data-testid': 'spells-min-level' } }} onChange={(e) => change('min', e.target.value)} sx={{ width: 135 }} />
        <TextField size="small" label="Max spell level" type="number" value={maximum} error={!!invalid} slotProps={{ htmlInput: { min: 1, max: 255, 'data-testid': 'spells-max-level' } }} onChange={(e) => change('max', e.target.value)} sx={{ width: 135 }} />
      </Stack></Tooltip>
      <Button onClick={reset} data-testid="spells-reset-filters">Reset filters</Button>
    </Stack>
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
