import type { JSX } from 'react'
import { Button, Chip, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material'
import type { SpellModifierPreferences } from '@shared/spellModifiers'
import type { SpellModifiersState } from './useSpellModifiers'
import { MOTE_RANKS } from './SpellRankOverrides'
import { rankLabel } from './SpellEstimate'

function selection(preferences: SpellModifierPreferences): string {
  return preferences.mode === 'emulate' ? String(preferences.emulation.rank ?? 'detected') : preferences.mode
}
export function SpellRankPreview({ state }: { state: SpellModifiersState }): JSX.Element | null {
  const { context, saving, loading, update } = state
  if (!context) return null
  const preferences = context.preferences, count = Object.keys(preferences.emulation.ranks).length
  const change = (choice: string): void => {
    if (choice === 'client' || choice === 'mine') { update({ ...preferences, mode: choice }); return }
    update({ ...preferences, mode: 'emulate', emulation: { ...preferences.emulation, rank: choice === 'detected' ? null : Number(choice) } })
  }
  return <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap" data-testid="spells-rank-preview">
    <FormControl size="small" sx={{ minWidth: 245 }}><InputLabel id="spell-rank-preview-label">Mote rank preview</InputLabel><Select labelId="spell-rank-preview-label" label="Mote rank preview" value={selection(preferences)} disabled={saving || loading} data-testid="spells-global-rank" onChange={(event) => change(event.target.value)}>
      <MenuItem value="client">Client values</MenuItem><MenuItem value="mine" disabled={!context.character}>Yours (detected)</MenuItem><MenuItem value="detected">Emulate: use detected ranks</MenuItem>{MOTE_RANKS.map((rank) => <MenuItem key={rank} value={String(rank)}>Group default: {rankLabel(rank)}</MenuItem>)}
    </Select></FormControl>
    <Typography variant="caption" color="text.secondary" sx={{ maxWidth: '44ch' }}>“Yours” badges show the highest observed upgrade in this character’s log.</Typography>
    {preferences.mode === 'emulate' && <><Chip size="small" color="warning" variant="outlined" label="Simulated" /><Typography variant="caption" color="text.secondary">{count ? `${count} saved per-spell overrides; matching records take priority.` : 'Applies to every modeled spell. Use row dropdowns for exact overrides.'}</Typography>{count > 0 && <Button size="small" disabled={saving || loading} onClick={() => update({ ...preferences, emulation: { ...preferences.emulation, ranks: {} } })} data-testid="spells-clear-rank-overrides">Clear spell overrides</Button>}</>}
  </Stack>
}
