import type { ClientSpellRecord } from './spellLibrary'

// Numeric target vocabulary from the complete client parser, not wiki spellings.
const AREA_TARGETS = new Set([2, 4, 8, 20, 24, 25, 32, 36, 37, 40, 42, 44, 45, 50])

export function isAreaTarget(target: number): boolean { return AREA_TARGETS.has(target) }

/** A positive client cap is evidence; zero, missing and negative are unknown. */
export function clientSpellTargetCap(record: ClientSpellRecord): number | null {
  const value = record.fields.aeMaxTargets
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}

/** Captured ordinary capped AOE rows use 5/10 ms markers, including timed HP
 * effects. These describe one area application, not repeated full-duration casts.
 * Longer or unfamiliar windows still require verified repeated-wave mechanics.
 */
export function hasRepeatedWaveTiming(record: ClientSpellRecord): boolean {
  const ordinaryMarker = (record.aoeDurationMs === 5 || record.aoeDurationMs === 10)
    && isAreaTarget(record.target) && clientSpellTargetCap(record) !== null
  return record.aoeDurationMs > 0 && !ordinaryMarker
}
