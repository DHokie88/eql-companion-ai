import { gearProgression } from '../../../../shared/worth'

/** Start zones whose level band contains `level`. */
export function startZones(quests: readonly { startZone?: string; minLevel?: number }[], level: number): string[] {
  const zones: { name: string; minLevel: number; maxLevel: number; role: string }[] = []
  for (const quest of quests) {
    if (!quest.startZone || quest.minLevel === undefined) continue
    zones.push({ name: quest.startZone, minLevel: quest.minLevel, maxLevel: quest.minLevel + 10, role: 'any' })
  }
  return gearProgression(zones, level, 'any')
}

/** Giver and the place the quest starts. A Starts In label wins over the top-table zone. */
export function questPlaceLabel(quest: { giver?: string; startZone?: string; startsIn?: string }): string {
  const place = quest.startsIn && quest.startsIn.length > 0 ? quest.startsIn : quest.startZone
  return [quest.giver, place].filter((part) => part !== undefined && part.length > 0).join(' · ')
}
