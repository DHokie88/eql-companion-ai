import { type JSX, useEffect, useState } from 'react'
import { Button, Chip, Menu, MenuItem, Stack } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import type { SpellBrowseRankMetadata } from '@shared/spellLibrary'
import type { SpellRankEvidence } from '@shared/spellModifiers'
import { currentBrowseRank } from '@shared/browseSpellRank'
import { previewSpellMote, spellMoteOverride } from '@shared/spellRankPreviews'
import { useSpellRankSnapshot, useSpellRankState } from './spellRankState'
import { rankLabel } from './SpellEstimate'

const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function boundedRank(rank: number | null | undefined): number | null {
  return typeof rank === 'number' && rank >= 1 && rank <= 10 ? rank : null
}
function displayedRank(live: SpellBrowseRankMetadata | null, override: number | null, global: number | null | undefined): { rank: number; source: string; owned: boolean; label: string } {
  if (live) return { rank: live.rank, source: live.source, owned: live.owned, label: live.label }
  const manual = boundedRank(override)
  if (manual !== null) return { rank: manual, source: 'override', owned: false, label: rankLabel(manual) }
  const rank = boundedRank(global) ?? 1
  return { rank, source: 'global', owned: false, label: rankLabel(rank) }
}

export function SpellRowRank({ id, name, browseRank, readOnly }: {
  id: number; name: string; evidence?: SpellRankEvidence | null; browseRank?: SpellBrowseRankMetadata | null; readOnly?: boolean
}): JSX.Element | null {
  const state = useSpellRankState()
  const snapshotId = useSpellRankSnapshot()
  const context = state?.context
  const characterKey = context?.character?.key ?? ''
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  useEffect(() => { setAnchor(null) }, [characterKey, id])
  if (!context) return null
  const shown = rowRankView({ context, browseRank, snapshotId, id, name })
  if (readOnly) return <span data-testid={`spell-rank-cell-${id}`} data-rank-source={shown.source}><RankValue shown={shown} /></span>
  const override = spellMoteOverride(context.preferences, { id, name })
  const choose = (next: number | null): void => {
    setAnchor(null)
    state.update(previewSpellMote(context.preferences, { id, name }, next))
  }
  return <RankChoices id={id} name={name} shown={shown} override={override} anchor={anchor} setAnchor={setAnchor} choose={choose} disabled={state.saving || state.loading} />
}

function rowRankView(input: { context: NonNullable<ReturnType<typeof useSpellRankState>>['context']; browseRank: SpellBrowseRankMetadata | null | undefined; snapshotId: string | null; id: number; name: string }) {
  const { context, browseRank, snapshotId, id, name } = input
  if (!context) return displayedRank(null, null, 1)
  const override = spellMoteOverride(context.preferences, { id, name })
  const live = currentRowRank(browseRank, { characterKey: context.character?.key ?? '', revision: context.revision ?? null, snapshotId })
  const global = context.preferences.browse?.rank ?? context.preferences.emulation.rank
  return displayedRank(live, override, global)
}
function currentRowRank(browseRank: SpellBrowseRankMetadata | null | undefined, guard: { characterKey: string | null; revision: string | null; snapshotId: string | null }): SpellBrowseRankMetadata | null {
  if (!browseRank || !currentBrowseRank(browseRank, guard)) return null
  return browseRank
}
type RankView = ReturnType<typeof displayedRank>
function RankValue({ shown }: { shown: RankView }): JSX.Element {
  if (shown.owned) return <Chip size="small" color="success" variant="outlined" icon={<CheckIcon />} label={`Yours ${shown.label}`} data-testid="spell-owned-rank" sx={{ height: 22, fontSize: 11, '& .MuiChip-icon': { fontSize: 14 } }} />
  return <span>{shown.label}{shown.source === 'override' ? ' manual' : ''}</span>
}
function RankChoices({ id, name, shown, override, anchor, setAnchor, choose, disabled }: {
  id: number; name: string; shown: RankView; override: number | null
  anchor: HTMLElement | null; setAnchor: (anchor: HTMLElement | null) => void; choose: (next: number | null) => void; disabled: boolean
}): JSX.Element {
  const { source, owned } = shown
  return <Stack direction="row" alignItems="center" data-testid={`spell-rank-cell-${id}`}>
    <Button size="small" aria-haspopup="menu" aria-expanded={Boolean(anchor)} aria-label={`Rank for ${name}`} data-testid={`spell-preview-rank-${id}`} data-rank-source={owned ? 'owned' : source} disabled={disabled} onClick={(event) => setAnchor(event.currentTarget)} sx={{ minWidth: 0, px: 0.75, py: 0.25, textTransform: 'none' }}>
      <RankValue shown={shown} />{!owned && source !== 'override' && ' ▾'}
    </Button>
    <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} slotProps={{
      paper: { sx: { bgcolor: 'background.paper', backgroundImage: 'none' } },
      list: { 'aria-label': `Rank for ${name}`, sx: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(38px, 1fr))', px: 0.5 } }
    }}>
      <MenuItem dense sx={{ gridColumn: '1 / -1' }} onClick={() => choose(null)} data-testid={`spell-rank-auto-${id}`}>Auto</MenuItem>
      {RANKS.map((value) => <MenuItem key={value} dense sx={{ justifyContent: 'center', px: 0.5 }} data-testid={`spell-rank-option-${id}-${value}`} onClick={() => choose(value)}>{rankLabel(value)}</MenuItem>)}
      <MenuItem dense sx={{ gridColumn: '1 / -1' }} disabled={override === null} onClick={() => choose(null)} data-testid={`spell-rank-reset-${id}`}>Reset override</MenuItem>
    </Menu>
  </Stack>
}
