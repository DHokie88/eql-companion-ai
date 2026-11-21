import type { GearRow } from './gear'

/** Join the combat effects stated on the catalog item. */
export function gearProcText(row: Pick<GearRow, 'effects'>): string {
  return row.effects.filter((effect) => effect.kind === 'combat').map((effect) => effect.name).join(' · ')
}
