import type { BardInstrumentFamily, BardSongEffectEstimate } from './bardInstruments'
import type { ClientSpellEffect, ClientSpellRecord } from './spellLibrary'

const FAMILIES: Readonly<Record<number, BardInstrumentFamily>> = { 12: 'brass', 41: 'singing', 49: 'string', 54: 'wind', 70: 'percussion' }
const SCALED = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 46, 47, 48, 49, 50, 55, 59, 78])
const FIXED = new Set([11, 12, 13, 14, 18, 19, 21, 27, 28, 29, 30, 31, 57, 63, 86, 89, 98, 119, 152, 158, 160, 161, 162, 179, 180, 254, 260, 261, 270, 298, 310, 314, 315, 316, 329, 351, 361, 417])

export function bardSongFamily(record: ClientSpellRecord): BardInstrumentFamily | null {
  // IS_SKILL / CombatSkill: original current-client column 98, shifted after the 174-layout insertion.
  // Read it for calculations only; a new model must not reinterpret immutable source-history rows.
  const discipline = record.rawFields[record.layout === 174 ? 99 : 98]
  if (record.fields.isDiscipline || discipline?.trim() !== '0') return null
  return record.classes.some((entry) => entry.code === 'BRD') ? FAMILIES[Number(record.fields.skill)] ?? null : null
}
export function bardEffectImpact(effect: ClientSpellEffect, record: ClientSpellRecord): BardSongEffectEstimate['impact'] {
  if (effect.spa === 15) return record.durationFormula === 0 ? 'scales' : 'unchanged'
  if (SCALED.has(effect.spa)) return 'scales'
  return FIXED.has(effect.spa) ? 'unchanged' : 'unsupported'
}
/** Equipment scaling uses the reference's integer truncation per effect, before HP focus. */
export function bardInstrumentAmount(amount: number, effect: ClientSpellEffect, input: { record: ClientSpellRecord; multiplier: number }): number {
  return bardEffectImpact(effect, input.record) === 'scales' ? Math.trunc(amount * input.multiplier + 1e-9) : amount
}
export function bardImpactExplanation(effect: ClientSpellEffect, record: ClientSpellRecord): string {
  if ([11, 98, 119].includes(effect.spa)) return 'Attack-speed slow and haste do not scale with instruments in the reference model.'
  if (effect.spa === 15 && record.durationFormula !== 0) return 'Periodic mana regeneration does not scale with instruments in the reference model.'
  const impact = bardEffectImpact(effect, record)
  if (impact === 'scales') return 'A qualifying modifier for this song skill scales this effect; the strongest known qualifying source is used.'
  return impact === 'unchanged' ? 'This effect remains at its client value; instruments do not multiply it.' : 'Instrument behavior for this SPA is not supported. No modified value is assumed.'
}
