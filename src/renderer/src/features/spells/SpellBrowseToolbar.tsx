import { useEffect, useState, type JSX } from 'react'
import { Box, FormControlLabel, Slider, Stack, Switch, Typography } from '@mui/material'
import { romanRank } from '@shared/spellLines'
import { selectSpellPreviewRank, toggleShowMine } from '@shared/spellPreviewControls'
import type { SpellEraFilter } from '@shared/spellBrowseEra'
import { useSpellRankState } from './spellRankState'

const RANK_MARKS = Array.from({ length: 10 }, (_, index) => ({ value: index + 1 }))

function sliderRank(rank: number | null | undefined, fallback: number | null | undefined): number {
  if (typeof rank === 'number' && rank >= 1 && rank <= 10) return rank
  if (typeof fallback === 'number' && fallback >= 1 && fallback <= 10) return fallback
  return 1
}

/** The server rank lags a key burst. Hold the last chosen step until that save lands. */
function usePendingRank(stored: number, error: string | null): { rank: number; choose: (next: number) => void } {
  const [pending, setPending] = useState<number | null>(null)
  useEffect(() => {
    if (pending !== null && (pending === stored || error !== null)) setPending(null)
  }, [pending, stored, error])
  return { rank: pending ?? stored, choose: setPending }
}

/** Discrete I–X preview. Gear's upgrade slider is the spacing reference and is left unchanged. */
export function SpellRankSlider(): JSX.Element | null {
  const state = useSpellRankState()
  const context = state?.context
  const stored = sliderRank(context?.preferences.browse?.rank, context?.preferences.emulation.rank)
  const pending = usePendingRank(stored, state?.error ?? null)
  if (!state || !context) return null
  const label = romanRank(pending.rank)
  return <Stack direction="row" gap={1} alignItems="center" data-testid="spells-rank-slider" sx={{ minWidth: 0 }}>
    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>Spell rank</Typography>
    <Box sx={{ width: 220, flexShrink: 0, px: 1 }}>
      <Slider size="small" min={1} max={10} step={1} marks={RANK_MARKS} value={pending.rank} color="primary" data-testid="spells-global-rank" aria-label="Spell rank" valueLabelDisplay="off" disabled={state.loading} sx={{ py: 0.5, color: 'primary.main' }} onChange={(_event, value) => {
        const next = typeof value === 'number' ? value : value[0]
        pending.choose(next)
        state.update(selectSpellPreviewRank(context.preferences, next))
      }} />
    </Box>
    <Typography variant="body2" data-testid="spells-rank-label" aria-live="polite" sx={{ color: 'primary.main', fontVariantNumeric: 'tabular-nums', minWidth: 28 }}>{label}</Typography>
  </Stack>
}

export function SpellBrowseToolbar({ era, onEra }: { era: 'current' | 'preview'; onEra: (era: 'current' | 'preview') => void }): JSX.Element | null {
  const state = useSpellRankState()
  const context = state?.context
  if (!state || !context) return null
  const mine = context.preferences.browse?.useMyRanks === true
  const current = era === 'current'
  return <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap" data-testid="spells-browse-toolbar" sx={{ px: 0.5 }}>
    <SpellRankSlider />
    <FormControlLabel sx={{ mr: 0 }} label="Use my ranks" data-testid="spells-use-my-ranks" control={<Switch size="small" checked={mine} disabled={state.loading} data-testid="spells-mode-mine" onChange={(_event, checked) => state.update(toggleShowMine(context.preferences, checked))} />} />
    <FormControlLabel sx={{ mr: 0 }} label="Current era" data-testid="spells-current-era" control={<Switch size="small" checked={current} data-testid="spells-era-switch" onChange={(_event, checked) => onEra(checked ? 'current' : 'preview')} />} />
    <Typography variant="caption" data-testid="spells-era-label" color="text.secondary">{current ? 'Classic EQL' : 'Kunark estimate'}</Typography>
  </Stack>
}

export type BrowseEra = Extract<SpellEraFilter, 'current' | 'preview'>
