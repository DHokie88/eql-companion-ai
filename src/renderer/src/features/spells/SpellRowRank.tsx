import type { JSX } from 'react'
import { Chip, MenuItem, Select, Stack, Tooltip } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import type { SpellRankEvidence } from '@shared/spellModifiers'
import { currentSpellRankEvidence, previewSpellMote, spellMoteOverride } from '@shared/spellRankPreviews'
import { useSpellRankState, useSpellRankSnapshot } from './spellRankState'
import { MOTE_RANKS } from './SpellRankOverrides'
import { rankLabel } from './SpellEstimate'

export function SpellRowRank({ id, name, evidence }: { id: number; name: string; evidence?: SpellRankEvidence | null }): JSX.Element | null {
  const state = useSpellRankState(), context = state?.context
  if (!context) return null
  return <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap" sx={{ mt: 0.5 }}>
    <ObservedRank evidence={evidence} />
    {context.preferences.mode === 'emulate' && <Tooltip disableInteractive title="Simulated mote rank for this numeric spell ID. Group defaults apply when no override is selected."><span><Select size="small" displayEmpty value={spellMoteOverride(context.preferences, { id, name }) ?? ''} disabled={state.saving || state.loading} inputProps={{ 'aria-label': `Preview mote rank for ${name} (${id})` }} data-testid={`spell-preview-rank-${id}`} sx={{ fontSize: 12, minWidth: 110, '& .MuiSelect-select': { py: 0.5 } }} onChange={(event) => state.update(previewSpellMote(context.preferences, { id, name }, event.target.value === '' ? null : Number(event.target.value)))}><MenuItem value="">Group default</MenuItem>{MOTE_RANKS.map((rank) => <MenuItem key={rank} value={rank}>{rankLabel(rank)}</MenuItem>)}</Select></span></Tooltip>}
  </Stack>
}
function ObservedRank({ evidence }: { evidence?: SpellRankEvidence | null }): JSX.Element | null {
  const context = useSpellRankState()?.context
  const snapshotId = useSpellRankSnapshot()
  if (!evidence || !currentSpellRankEvidence(evidence, { characterKey: context?.character?.key ?? null, revision: context?.revision ?? null, snapshotId })) return null
  return <Tooltip disableInteractive title="Highest mote rank observed in this character's own cast or merge logs. This is log evidence, not a current spellbook scan."><Chip size="small" color="success" variant="outlined" icon={<CheckCircleOutlineIcon />} label={`Yours ${rankLabel(evidence.rank)}`} data-testid="spell-owned-rank" sx={{ height: 22, fontSize: 11, '& .MuiChip-icon': { fontSize: 14 } }} /></Tooltip>
}
