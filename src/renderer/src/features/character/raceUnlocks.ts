import { raceUnlockOrder } from '../../../../shared/worth'

/** The unfinished race closest to done. A race already switched on has no gap. */
export function nextRaceUnlock(races: readonly { id: string; label: string }[], enabled: readonly string[]): string | null {
  const on = new Set(enabled)
  const rows = []
  for (const race of races) rows.push({ race: race.label, have: on.has(race.id) ? 1 : 0, need: 1, factions: [] as { name: string; fastest: string }[] })
  const ordered = raceUnlockOrder(rows)
  for (const row of ordered) if (row.need > row.have) return row.race
  return null
}
