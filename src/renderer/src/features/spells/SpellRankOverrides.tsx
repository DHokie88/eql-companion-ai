import { type JSX, useCallback } from 'react'
import { Alert, Button, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material'
import type { SpellEmulation } from '@shared/spellModifiers'
import { useLibraryQuery } from './useLibraryQuery'
import { rankLabel } from './SpellEstimate'

export const MOTE_RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function SpellRankOverrides({ ids, value, disabled, onChange }: {
  ids: number[]; value: SpellEmulation; disabled: boolean; onChange: (value: SpellEmulation) => void
}): JSX.Element {
  const key = ids.join(',')
  const load = useCallback(() => Promise.all(key.split(',').filter(Boolean).map((id) => window.eq.spellLibrary.detail({ id: Number(id) }))), [key])
  const { data, error } = useLibraryQuery(load)
  const setRank = (id: number, name: string, rank: number | ''): void => {
    const ranks = withoutRank(value.ranks, String(id))
    if (rank !== '') ranks[String(id)] = { name, rank }
    onChange({ ...value, ranks })
  }
  const clear = (id: string): void => {
    onChange({ ...value, ranks: withoutRank(value.ranks, id) })
  }
  return <Stack spacing={1} data-testid="spells-rank-overrides">
    <Typography variant="subtitle2">Exact per-spell mote ranks</Typography>
    <Typography variant="caption">These overrides take precedence over the global rank. Add spells to Compare or open a detail record to set an override.</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {data?.map(({ record }) => record && <FormControl key={record.id} size="small" sx={{ maxWidth: 420 }}>
      <InputLabel id={`spells-rank-label-${record.id}`}>{record.name} · {record.id}</InputLabel>
      <Select labelId={`spells-rank-label-${record.id}`} label={`${record.name} · ${record.id}`} value={value.ranks[String(record.id)]?.rank ?? ''} disabled={disabled} data-testid={`spells-rank-${record.id}`} onChange={(event) => setRank(record.id, record.name, event.target.value === '' ? '' : Number(event.target.value))}>
        <MenuItem value="">Follow global / detected</MenuItem>{MOTE_RANKS.map((rank) => <MenuItem key={rank} value={rank}>{rankLabel(rank)}</MenuItem>)}
      </Select>
    </FormControl>)}
    {Object.entries(value.ranks).filter(([id]) => !ids.includes(Number(id))).map(([id, override]) => <Stack key={id} direction="row" alignItems="center" spacing={1}>
      <Typography variant="body2">ID {id} · {override.name}: {rankLabel(override.rank)}</Typography><Button size="small" disabled={disabled} onClick={() => clear(id)}>Clear override</Button>
    </Stack>)}
  </Stack>
}

function withoutRank(ranks: SpellEmulation['ranks'], id: string): SpellEmulation['ranks'] {
  return Object.fromEntries(Object.entries(ranks).filter(([key]) => key !== id))
}
