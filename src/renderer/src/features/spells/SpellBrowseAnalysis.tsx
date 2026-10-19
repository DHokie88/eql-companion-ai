import type { JSX } from 'react'
import { Button, Checkbox, FormControl, InputLabel, ListItemText, MenuItem, Select, Stack, Tab, Tabs } from '@mui/material'
import type { SpellBrowseSort, SpellMetric, SpellSearchQuery, SpellSearchResult } from '@shared/spellLibrary'
import { amount } from './SpellEstimate'
import { selectableBrowseColumns } from './spellBrowseColumns'
export function BrowseColumnPicker({ metric, columns, setColumns }: {
  metric: SpellMetric; columns: SpellBrowseSort[]; setColumns: (columns: SpellBrowseSort[]) => void
}): JSX.Element {
  return <FormControl size="small" sx={{ width: 130, ml: 'auto' }}><InputLabel id="browse-columns-label">Columns</InputLabel>
      <Select multiple labelId="browse-columns-label" label="Columns" value={columns} renderValue={(values) => `${values.length + 2} shown`} data-testid="spells-columns" onChange={(e) => setColumns(e.target.value as SpellBrowseSort[])}>
        <MenuItem disabled>Spell and Class/Level always shown</MenuItem>
        {selectableBrowseColumns(metric).map((column) => <MenuItem key={column.field} value={column.field} data-testid={`spells-column-${column.field}`}><Checkbox checked={columns.includes(column.field)} /><ListItemText primary={column.label} /></MenuItem>)}
      </Select>
    </FormControl>
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
