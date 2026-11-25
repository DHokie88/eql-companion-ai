import type { LevelEvent, LevelingSnap } from '@shared/types'
import { aaPlan, reincarnationClimbs, type ProgressionEvent } from '../../../../shared/worth'

const DAY_MS = 24 * 60 * 60 * 1000

/** The next rank of the ability the log last bought, priced from that purchase and the last day of gains. */
export function nextAaPlan(state: LevelingSnap, now: number): { ability: string; cost: number; shortfall: number; etaHours: number | null } | null {
  const spend = state.aaSpends[state.aaSpends.length - 1]
  if (!spend || !(spend.cost > 0)) return null
  const ability = spend.ability.replace(/\s+\d+$/, '').trim() || spend.ability
  const held = spend.rank ?? 1
  let points = 0
  for (const gain of state.aaGains) {
    if (gain.ts >= now - DAY_MS && gain.ts <= now) points += gain.amount
  }
  const lastGain = state.aaGains[state.aaGains.length - 1]
  const unspent = lastGain && lastGain.ts <= now ? lastGain.nowHave : 0
  const plan = aaPlan({
    catalog: [{ id: ability, name: ability, maxRank: held + 1, costPerRank: spend.cost }],
    held: { [ability]: held },
    targets: { [ability]: held + 1 },
    unspent,
    pointsLast24h: points
  })
  return { ability, ...plan }
}

/** A drop in the stated level is a reincarnation. The climb is the time until 50 again. */
export function climbsFromLevels(levels: readonly LevelEvent[]): { started: number; finished: number; ms: number }[] {
  const ordered: { ts: number; level: number }[] = []
  for (const level of levels) ordered.push({ ts: level.ts, level: level.level })
  ordered.sort((a, b) => a.ts - b.ts)
  const events: ProgressionEvent[] = []
  let prev: { ts: number; level: number } | undefined
  for (const level of ordered) {
    if (prev && level.level < prev.level) events.push({ kind: 'reincarnation', ts: level.ts })
    events.push({ kind: 'level', ts: level.ts, level: level.level })
    prev = level
  }
  return reincarnationClimbs(events)
}
