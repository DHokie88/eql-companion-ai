import type { JSX } from 'react'
import { FormControl, InputLabel, MenuItem, Select, Tooltip } from '@mui/material'
import { selectSpellPreviewRank } from '@shared/spellPreviewControls'
import type { SpellModifiersState } from './useSpellModifiers'
import { MOTE_RANKS } from './SpellRankOverrides'
import { rankLabel } from './SpellEstimate'

export function SpellRankPreview({ state }: { state: SpellModifiersState }): JSX.Element | null {
  const { context, saving, loading, update } = state
  if (!context) return null
  return <Tooltip disableInteractive title="0 shows base values. I through X preview one mote rank for every spell with detected equipment. Changing Rank clears individual overrides and turns off Show mine. Turn Show mine back on to restore detected ranks."><FormControl size="small" sx={{ width: 90 }}><InputLabel id="spell-rank-preview-label">Rank</InputLabel>
    <Select labelId="spell-rank-preview-label" label="Rank" value={context.preferences.mode === 'client' ? 0 : context.preferences.emulation.rank ?? 0} disabled={saving || loading} data-testid="spells-global-rank" onChange={(event) => update(selectSpellPreviewRank(context.preferences, Number(event.target.value)))}>
      {MOTE_RANKS.map((rank) => <MenuItem key={rank} value={rank}>{rankLabel(rank)}</MenuItem>)}
    </Select>
  </FormControl></Tooltip>
}
