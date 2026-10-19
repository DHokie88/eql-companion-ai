import type { ClientSpellEffect, ClientSpellRecord } from './spellLibrary'
import { clientSpellEffectAmount, clientSpellDurationTicks } from './clientSpellCalculations'
import { clientSpellEffectLabel } from './clientSpellParser'

export interface SpellEffectDescription { slot: number; spa: number; label: string; text: string; neutral: boolean }
export interface SpellPresentation { description: string; level: number; duration: string; target: string; range: string; resist: string; effects: SpellEffectDescription[]; bard?: import('./bardInstruments').BardSongPresentation }
/** Resolve display tokens against this captured record without rewriting source history. */
export function clientSpellDescription(record: ClientSpellRecord): string {
  const cap = record.fields.aeMaxTargets
  const targets = typeof cap === 'number' && Number.isSafeInteger(cap) && cap > 0 ? String(cap) : 'an unspecified number of'
  return record.description.replace(/%T\b/g, targets)
}
function number(value: number): string { return value.toLocaleString('en-US', { maximumFractionDigits: 3 }) }
function duration(record: ClientSpellRecord, level: number): string {
  const ticks = clientSpellDurationTicks(record, level)
  if (ticks === null) return String(record.fields.durationText ?? 'Duration cannot be calculated from this client formula.')
  if (ticks === 0) return 'Instant'
  const seconds = ticks * 6, minutes = Math.floor(seconds / 60)
  const text = minutes ? `${minutes}m${seconds % 60 ? ` ${number(seconds % 60)}s` : ''}` : `${number(seconds)} seconds`
  return `${text} (${number(ticks)} ticks)`
}
function speedText(effect: ClientSpellEffect, value: number): string {
  if (effect.spa === 3) return `${effect.base < 0 ? 'Slows movement' : 'Increases movement speed'} by ${number(value)}%.`
  if (value === 100) return 'Attack speed is unchanged (100% of normal).'
  const change = value < 100 ? `Slows attacks by ${number(100 - value)}%` : `Increases attack speed by ${number(value - 100)}%`
  const cap = effect.max > 0 ? ` Client cap: ${number(effect.max)}% of normal attack speed (${number(Math.abs(100 - effect.max))}% ${effect.max < 100 ? 'slow' : 'haste'}).` : ''
  return `${change} (${number(value)}% of normal attack speed).${cap}`
}
function hasteTypeText(effect: ClientSpellEffect, value: number): string {
  const bonus = effect.spa === 98 ? value - 100 : effect.base < 0 ? -value : value
  const type = effect.spa === 98 ? 'II' : 'III'
  if (bonus === 0) return `No attack-speed change (type ${type}).`
  if (bonus < 0) return `Reduces attack speed by ${number(-bonus)} percentage points (type ${type} slow, before slow mitigation). Instruments do not increase this effect. Server interactions are not simulated.`
  const scope = effect.spa === 98
    ? `Adds ${number(bonus)} percentage points of supplemental spell haste. Client value ${number(value)} means ${number(bonus)} points above the normal 100. Combines with ordinary spell haste (SPA 11) within the normal total-haste cap; adds no speed once that cap is reached. This is type II haste; cap-breaking overhaste is type III (SPA 119).`
    : `Adds ${number(bonus)} percentage points of type III overhaste. Applies after the ordinary total-haste cap, subject to a separate overhaste cap. Type II supplemental haste (SPA 98) stays within the ordinary cap.`
  return `${scope} Only the strongest source of this type applies; instruments do not multiply it. These are reference mechanics: EQL's exact cap and recipient-level rules require server verification. Total character haste is not simulated.`
}
function effectLabel(spa: number): string {
  const haste: Record<number, string> = { 98: 'Supplemental spell haste (type II)', 119: 'Overhaste (type III)' }
  return haste[spa] ?? clientSpellEffectLabel(spa)
}
function healthText(effect: ClientSpellEffect, value: number, record: ClientSpellRecord): string {
  const verb = effect.base < 0 ? 'Deals' : 'Restores'
  const unit = effect.base < 0 ? 'damage' : 'health'
  const timing = effect.spa === 0 && record.durationFormula !== 0 ? ' every tick (6 seconds)' : ' once'
  return `${verb} ${number(value)} ${unit}${timing}.`
}
function simpleEffectText(effect: ClientSpellEffect, value: number, record: ClientSpellRecord): string {
  if (effect.spa >= 1 && effect.spa <= 10) return `${effect.base < 0 ? 'Decreases' : 'Increases'} ${clientSpellEffectLabel(effect.spa).toLowerCase()} by ${number(value)}${value === 0 ? ' (no change)' : ''}.`
  if ([15, 46, 47, 48, 49, 50, 55, 59, 78].includes(effect.spa)) return `${clientSpellEffectLabel(effect.spa)}: ${effect.base < 0 ? '-' : '+'}${number(value)}${effect.spa === 15 && record.durationFormula !== 0 ? ' per tick (6 seconds)' : ''}.`
  return capturedDescription(effect, record)
}
export function describeClientSpellEffect(effect: ClientSpellEffect, record: ClientSpellRecord, level: number, override?: number): string {
  const value = override ?? clientSpellEffectAmount(effect, level)
  if (effect.spa === 254) return 'Unused client effect slot.'
  if (value === null) return `${String(record.fields[`effect${effect.slot}`] ?? clientSpellEffectLabel(effect.spa))}. Magnitude uses an unsupported client formula; no estimate is assumed.`
  if (effect.spa === 98 || effect.spa === 119) return hasteTypeText(effect, value)
  if (effect.spa === 3 || effect.spa === 11) return speedText(effect, value)
  if (effect.spa === 0 || effect.spa === 79) return healthText(effect, value, record)
  return simpleEffectText(effect, value, record)
}
function capturedDescription(effect: ClientSpellEffect, record: ClientSpellRecord): string {
  const captured = record.fields[`effect${effect.slot}`]
  return typeof captured === 'string' ? captured.replace(/([a-z])([A-Z])/g, '$1 $2') : `${clientSpellEffectLabel(effect.spa)}. Client base ${effect.base}, formula ${effect.calc}, limit ${effect.limit}, maximum ${effect.max}.`
}
/** Client-only, level-evaluated explanations. It never simulates non-HP buff statistics. */
export function describeClientSpell(record: ClientSpellRecord, level: number): SpellPresentation {
  return {
    description: clientSpellDescription(record), level, duration: duration(record, level), target: String(record.fields.targetName ?? `Client target type ${record.target}`),
    range: `Casting range ${number(record.range)} game units${record.aeRange > 0 ? `; area radius ${number(record.aeRange)} game units` : '; no area radius'}.`,
    resist: String(record.fields.resistName ?? 'Unspecified'),
    effects: record.effects.map((effect) => ({ slot: effect.slot, spa: effect.spa, label: effectLabel(effect.spa), text: describeClientSpellEffect(effect, record, level),
      neutral: effect.spa === 254 || (effect.base === 0 && effect.max === 0 && effect.limit === 0 && effect.calc === 100) }))
  }
}
