import type { GearStats } from '../shared/planner/gear'

interface GearStatCheck {
  /** Numeric base values cross-checked against Ruby's +0 record. */
  base: GearStats
  /** Known stale AC to replace. Other wiki values require another review. */
  staleAc?: number
}

// Sources and review dates live in docs/research/eqo-gear-data-20261121.md.
const checks: ReadonlyMap<string, GearStatCheck> = new Map([
  ['lustrous russet vambraces', { base: { AC: 13, STR: 9, DEX: 5, WEIGHT: 4.9 }, staleAc: 15 }],
  ['lustrous russet greaves', { base: { AC: 14, STR: 5, STA: 5, AGI: 5, WEIGHT: 5.6 }, staleAc: 15 }],
  ['lustrous russet helm', { base: { AC: 14, CHA: 5, INT: 5, WEIGHT: 4.5 }, staleAc: 15 }],
  ['lustrous russet breastplate', { base: { AC: 26, STR: 15, STA: 15, DEX: 15, WEIGHT: 7.5 } }],
  ['lustrous russet bracer', { base: { AC: 9, STR: 3, DEX: 3, SV_COLD: 7, SV_FIRE: 7, SV_MAGIC: 7, WEIGHT: 3 } }],
  ['lustrous russet gauntlets', { base: { AC: 11, HP: 50, STA: 5, DEX: 5, WEIGHT: 3.8 } }],
  ['lustrous russet boots', { base: { AC: 14, AGI: 5, INT: 5, WIS: 5, SV_DISEASE: 15, SV_POISON: 15, WEIGHT: 4.9 } }],
  ['golden efreeti greaves', { base: { AC: 15, AGI: 9, DEX: 10, WEIGHT: 5.6 } }],
  ['efreeti magi staff', { base: { AC: 5, DMG: 12, DELAY: 36, STA: 2, CHA: 2, INT: 5, WEIGHT: 2 } }]
])

export function gearStatCheck(page: string): GearStatCheck | undefined {
  return checks.get(page.toLowerCase().replaceAll('_', ' '))
}
