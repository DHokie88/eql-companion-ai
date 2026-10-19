import type { JSX } from 'react'
import { Button, FormControl, InputLabel, MenuItem, Select, Stack, Tooltip } from '@mui/material'
import type { SpellModifiersState } from './useSpellModifiers'
import { MOTE_RANKS } from './SpellRankOverrides'
import { rankLabel } from './SpellEstimate'

export function SpellRankPreview({ state }: { state: SpellModifiersState }): JSX.Element | null {
  const { context, saving, loading, update } = state
  if (!context) return null
  const preferences = context.preferences
  const value = preferences.mode === 'client' ? '0' : preferences.mode === 'mine' ? 'mine' : String(preferences.emulation.rank ?? 'detected')
  const count = Object.keys(preferences.emulation.ranks).length
  return <Stack direction="row" gap={0.5} alignItems="center" data-testid="spells-rank-preview">
    <Tooltip disableInteractive title="Mote rank. 0 is unupgraded; I through X are exact ranks. Auto uses observed ranks. Individual spell choices take precedence. Change to Emulate to preview a rank."><span><FormControl size="small" sx={{ width: 100 }}><InputLabel id="spell-rank-preview-label">Rank</InputLabel><Select labelId="spell-rank-preview-label" label="Rank" value={value} disabled={saving || loading || preferences.mode !== 'emulate'} data-testid="spells-global-rank" onChange={(event) => update({ ...preferences, emulation: { ...preferences.emulation, rank: event.target.value === 'detected' ? null : Number(event.target.value) } })}>
      {preferences.mode === 'mine' && <MenuItem value="mine">Yours</MenuItem>}<MenuItem value="detected">Auto</MenuItem>{MOTE_RANKS.map((rank) => <MenuItem key={rank} value={String(rank)}>{rankLabel(rank)}</MenuItem>)}
    </Select></FormControl></span></Tooltip>
    {preferences.mode === 'emulate' && count > 0 && <Tooltip disableInteractive title="Remove per-spell rank choices and follow the Rank control again."><Button size="small" disabled={saving || loading} onClick={() => update({ ...preferences, emulation: { ...preferences.emulation, ranks: {} } })} data-testid="spells-clear-rank-overrides">Clear ({count})</Button></Tooltip>}
  </Stack>
}