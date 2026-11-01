// The four gauges (EQ Zera, 2026-09-06): Tank, DPS, Healer — each "where your set sits against
// the best set the same filters could reach", 0..100 — and Solo, the class kit blended with the
// three. Segmented bars, the console health-bar look the theme gives every LinearProgress.

import type { JSX } from 'react'
import { LinearProgress, Paper, Stack, Typography } from '@mui/material'
import { meterPercent } from '@shared/build/profiles'
import { strategyItemScore, strategyWeights } from '@shared/build/strategies'
import { buildScore } from '@shared/build/optimizer'
import type { GearRow } from '@shared/planner/gear'
import { FONTS, PALETTE } from '../../../../shared/palette'
import type { BuildState } from './useBuild'

const TILE_TITLE = { display: 'block', color: 'text.secondary', mb: 0.5 } as const

function Gauge({
  label,
  value,
  note,
  color,
  selected,
  onSelect,
  testId
}: {
  label: string
  value: number | null
  note: string
  color: string
  selected?: boolean
  onSelect?: () => void
  testId: string
}): JSX.Element {
  return (
    <Paper
      variant="outlined"
      data-testid={testId}
      onClick={onSelect}
      sx={{
        p: 1.25,
        flex: 1,
        minWidth: 120,
        cursor: onSelect ? 'pointer' : 'default',
        borderColor: selected ? color : undefined,
        boxShadow: selected ? `0 0 12px ${color}55` : 'none'
      }}
    >
      <Typography variant="caption" className="eq-display-label" sx={TILE_TITLE}>
        {label}
      </Typography>
      <Typography sx={{ fontFamily: FONTS.mono, fontSize: 28, lineHeight: 1, color }}>{value === null ? '-' : `${value}%`}</Typography>
      {value !== null && <LinearProgress
        variant="determinate"
        value={value}
        sx={{ mt: 0.75, '& .MuiLinearProgress-bar': { backgroundImage: 'none', backgroundColor: color } }}
      />}
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }} noWrap>
        {note}
      </Typography>
    </Paper>
  )
}



export function BuildMeters({ build }: { build: BuildState }): JSX.Element {
  return <Stack spacing={0.5}>
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" data-testid="build-meters">
      {build.strategies.map((strategy) => {
        const weights = strategyWeights(strategy, build.classes)
        const score = (row: GearRow): number => strategyItemScore(row.stats, strategy, build.classes)
        const current = buildScore(build.set, weights, score)
        const base = strategy.base
        const id = base === 'custom' ? 'custom' : base
        return <Gauge key={strategy.id} label={strategy.name} value={strategy.id === build.strategy.id ? meterPercent(build.score.current, build.score.best) : null}
          color={base === 'dps' ? PALETTE.red : base === 'heal' ? PALETTE.green : PALETTE.cyan}
          selected={strategy.id === build.strategy.id} onSelect={() => build.setStrategy(strategy.id)}
          note={strategy.id === build.strategy.id ? `Selected · score ${Math.round(current)}` : 'Choose these criteria'} testId={`build-meter-${id}`} />
      })}
    </Stack>
    <Typography variant="caption" color="text.secondary">Scores follow your criteria and available item data. Configure the five strategies in Preferences → Build strategies.</Typography>
  </Stack>
}
