import type { JSX } from 'react'
import { Button, FormControl, InputLabel, MenuItem, Select, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { SPELL_TYPE_LABELS } from '@shared/clientSpellBrowse'
import type { SpellBrowseType } from '@shared/spellLibrary'
import type { BrowseFilters } from './useSpellBrowse'

function ChoiceFilter({ name, label, value, options, onChange }: {
  name: string; label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void
}): JSX.Element {
  return <FormControl size="small" sx={{ minWidth: 165, flexGrow: 1 }}><InputLabel id={`spell-${name}-label`}>{label}</InputLabel>
    <Select labelId={`spell-${name}-label`} label={label} value={value} data-testid={`spells-${name}`} onChange={(e) => onChange(e.target.value)}>
      <MenuItem value="">All</MenuItem>{options.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
    </Select></FormControl>
}
function textOptions(values: string[], selected: string) {
  return [...new Set([...values, ...(selected ? [selected] : [])])].map((value) => ({ value, label: value }))
}
export function SpellBrowseFilters({ filters, maximum, categories, subcategories, change, reset, invalid }: {
  filters: BrowseFilters; maximum: string; categories: string[]; subcategories: string[]; invalid: string | null
  change: <K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]) => void; reset: () => void
}): JSX.Element {
  return <Stack spacing={1.5}>
    <Stack direction="row" gap={1} flexWrap="wrap">
      <TextField size="small" label="Spell name or numeric ID" value={filters.text} slotProps={{ htmlInput: { 'data-testid': 'spells-search' } }} onChange={(e) => change('text', e.target.value)} sx={{ minWidth: 260, flexGrow: 1 }} />
      <TextField size="small" label="Min spell level" type="number" value={filters.min} error={!!invalid} slotProps={{ htmlInput: { min: 1, max: 255, 'data-testid': 'spells-min-level' } }} onChange={(e) => change('min', e.target.value)} sx={{ width: 150 }} />
      <TextField size="small" label="Max spell level" type="number" value={maximum} error={!!invalid} slotProps={{ htmlInput: { min: 1, max: 255, 'data-testid': 'spells-max-level' } }} onChange={(e) => change('max', e.target.value)} sx={{ width: 150 }} />
      <Button onClick={reset} data-testid="spells-reset-filters">Reset filters</Button>
    </Stack>
    <ToggleButtonGroup size="small" exclusive value={filters.type} onChange={(_e, value: SpellBrowseType | '' | null) => { if (value !== null) change('type', value) }} aria-label="Spell type" sx={{ flexWrap: 'wrap' }}>
      <ToggleButton value="" data-testid="spells-type-all">All types</ToggleButton>
      {Object.entries(SPELL_TYPE_LABELS).map(([value, label]) => <ToggleButton key={value} value={value} data-testid={`spells-type-${value}`}>{label}</ToggleButton>)}
    </ToggleButtonGroup>
    <Stack direction="row" gap={1} flexWrap="wrap">
      <ChoiceFilter name="category" label="Category" value={filters.category} options={textOptions(categories, filters.category)} onChange={(value) => change('category', value)} />
      <ChoiceFilter name="subcategory" label="Subcategory" value={filters.subcategory} options={textOptions(subcategories, filters.subcategory)} onChange={(value) => change('subcategory', value)} />
      <ChoiceFilter name="polarity" label="Polarity" value={filters.polarity} options={[{ value: 'beneficial', label: 'Beneficial' }, { value: 'detrimental', label: 'Detrimental' }]} onChange={(value) => change('polarity', value as BrowseFilters['polarity'])} />
      <ChoiceFilter name="mana" label="Mana cost" value={filters.mana} options={[{ value: 'free', label: 'Zero mana' }, { value: 'cost', label: 'Costs mana' }]} onChange={(value) => change('mana', value as BrowseFilters['mana'])} />
      <TextField size="small" label="Effect (SPA number)" type="number" value={filters.effect} slotProps={{ htmlInput: { min: 0, max: 100000, 'data-testid': 'spells-effect' } }} onChange={(e) => change('effect', e.target.value)} sx={{ width: 180 }} />
    </Stack>
    <Typography variant="caption" color="text.secondary">Spell level is the earliest eligible level across the chosen classes. Blank bounds include all levels; bounded searches omit internal records without a class level. Caster level controls calculated strength.</Typography>
  </Stack>
}
