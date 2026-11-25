/** Giver and the place the quest starts. A Starts In label wins over the top-table zone. */
export function questPlaceLabel(quest: { giver?: string; startZone?: string; startsIn?: string }): string {
  const place = quest.startsIn && quest.startsIn.length > 0 ? quest.startsIn : quest.startZone
  return [quest.giver, place].filter((part) => part !== undefined && part.length > 0).join(' · ')
}
