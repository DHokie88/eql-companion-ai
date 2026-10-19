import { clientSpellDurationTicks, clientSpellEffectAmount } from './clientSpellCalculations'
import type { ClientSpellEffect, ClientSpellRecord, SpellSummary } from './spellLibrary'

/** Conservative lines, not a general server stacking simulator.
 * Reference: https://github.com/EQEmu/Server/blob/master/zone/spells.cpp
 * https://docs.eqemu.dev/server/spells/spell-buff-stacking/
 * Equal recast durations, names and DoT/rain types are NOT shared timers.
 */
export interface SpellLineCandidate { key: string; value: number; duration: number }
const STATS = new Set([1, 2, 4, 5, 6, 7, 8, 9, 10, 15])
function meaningful(effect: ClientSpellEffect): boolean {
  return effect.spa !== 254 && !(effect.spa === 10 && effect.base === 0 && effect.max === 0 && [0, 100].includes(effect.calc))
}
function unsupportedRecord(record: ClientSpellRecord): boolean {
  return !record.classes.length || record.aoeDurationMs > 0 || Number(record.fields.recourse) > 0 || record.classes.some((c) => c.code === 'BRD')
}
export function spellLineCandidate(record: ClientSpellRecord, level: number): SpellLineCandidate | null {
  const lineId = record.fields.displayNameId, duration = clientSpellDurationTicks(record, level)
  if (typeof lineId !== 'number' || lineId <= 0 || duration === null || duration <= 0 || unsupportedRecord(record)) return null
  const effects = record.effects.filter(meaningful)
  if (effects.length !== 1) return null
  const effect = effects[0]
  if (!record.beneficial || !STATS.has(effect.spa) || effect.base <= 0) return null
  const value = clientSpellEffectAmount(effect, level)
  if (value === null) return null
  return { key: `${lineId}:${record.target}:${effect.slot}/${effect.spa}`, value, duration }
}
/** Complete filtered result, before sorting/pagination. Oversized or ambiguous lines
 * stay visible; no connected-component inference from partial conflicts.
 */
export function bestSpellLines(rows: SpellSummary[], candidates: ReadonlyMap<number, SpellLineCandidate>): SpellSummary[] {
  const buckets = new Map<string, SpellSummary[]>(), output: SpellSummary[] = []
  for (const row of rows) {
    const candidate = candidates.get(row.id)
    if (!candidate) { output.push(row); continue }
    const bucket = buckets.get(candidate.key) ?? []
    bucket.push(row); buckets.set(candidate.key, bucket)
  }
  for (const [key, bucket] of buckets) {
    if (bucket.length < 2 || bucket.length > 32) { output.push(...bucket); continue }
    bucket.sort((a, b) => {
      const ca = candidates.get(a.id), cb = candidates.get(b.id)
      if (!ca || !cb) return a.id - b.id
      return cb.value - ca.value || cb.duration - ca.duration || a.mana - b.mana || a.id - b.id
    })
    const [best, ...alternatives] = bucket
    const reason = 'Same captured spell line, target and stat-effect slot. Ordered by base effect strength at this level, then duration and mana. Reference stacking rules; server exceptions may differ.'
    output.push({ ...best, line: { key, reason, alternatives } })
  }
  return output
}
