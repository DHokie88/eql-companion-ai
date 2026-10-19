import type { JSX } from 'react'
import { Button, Checkbox, FormControl, InputLabel, ListItemText, MenuItem, Select, Stack, Tab, Tabs, ToggleButton, ToggleButtonGroup } from '@mui/material'
import type { SpellBrowseSort, SpellMetric, SpellSearchQuery, SpellSearchResult } from '@shared/spellLibrary'
import { amount } from './SpellEstimate'
import { BROWSE_EXTRA_COLUMNS } from './spellBrowseColumns'
export function BrowseAnalysisControls({ metric, setMetric, columns, setColumns }: {
  metric: SpellMetric; setMetric: (metric: SpellMetric) => void; columns: SpellBrowseSort[]; setColumns: (columns: SpellBrowseSort[]) => void
}): JSX.Element {
  return <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
    <ToggleButtonGroup size="small" exclusive value={metric} onChange={(_e, value: SpellMetric | null) => { if (value) setMetric(value) }} aria-label="Spell calculation metric" data-testid="spells-metric">
      <ToggleButton value="damage">Damage</ToggleButton><ToggleButton value="healing">Healing</ToggleButton>
    </ToggleButtonGroup>
    <FormControl size="small" sx={{ minWidth: 190, ml: 'auto' }}><InputLabel id="browse-columns-label">Additional columns</InputLabel>
      <Select multiple labelId="browse-columns-label" label="Additional columns" value={columns} renderValue={(values) => `${values.length} selected`} data-testid="spells-columns" onChange={(e) => setColumns(e.target.value as SpellBrowseSort[])}>
        {BROWSE_EXTRA_COLUMNS.map((column) => <MenuItem key={column.field} value={column.field}><Checkbox checked={columns.includes(column.field)} /><ListItemText primary={column.label} /></MenuItem>)}
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
export function BrowseHighlights({ highlights = [], onSelect }: {
  highlights: SpellSearchResult['highlights']; onSelect: (kind: 'efficiency' | 'amount' | 'rate', group: NonNullable<SpellSearchQuery['group']>) => void
}): JSX.Element {
  return <Stack direction="row" gap={1} flexWrap="wrap" data-testid="spells-highlights">{highlights.map(({ kind, record }) => {
    const value = kind === 'efficiency' ? record?.calculation.perMana : kind === 'amount' ? record?.calculation.total : record?.calculation.analysis?.timing.rate
    return <Button key={kind} variant="outlined" size="small" disabled={!record} data-testid={`spells-highlight-${kind}`} onClick={() => onSelect(kind, record?.mana === 0 ? 'zero-mana' : 'ranked')} sx={{ flex: '1 1 220px', textTransform: 'none', justifyContent: 'flex-start', textAlign: 'left' }}>
      {kind === 'efficiency' ? 'Best efficiency' : kind === 'amount' ? 'Largest cast' : 'Highest modeled rate'} · {record ? `${record.name} (${amount(value ?? null)})` : 'Unavailable'}
    </Button>
  })}</Stack>
}
