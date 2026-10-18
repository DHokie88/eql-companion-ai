import type { ClientSpellEffect, ClientSpellRecord } from './spellLibrary'
import { clientSpellEffectAmount, clientSpellDurationTicks } from './clientSpellCalculations'
import { clientSpellEffectLabel } from './clientSpellParser'

export interface SpellEffectDescription { slot: number; spa: number; label: string; text: string; neutral: boolean }
export interface SpellPresentation { level: number; duration: string; target: string; range: string; resist: string; effects: SpellEffectDescription[] }
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
function healthText(effect: ClientSpellEffect, value: number, record: ClientSpellRecord): string {
  const verb = effect.base < 0 ? 'Deals' : 'Restores'
  const unit = effect.base < 0 ? 'damage' : 'health'
  const timing = effect.spa === 0 && record.durationFormula !== 0 ? ' every tick (6 seconds)' : ' once'
  return `${verb} ${number(value)} ${unit}${timing}.`
}
function effectText(effect: ClientSpellEffect, record: ClientSpellRecord, level: number): string {
  const value = clientSpellEffectAmount(effect, level)
  if (effect.spa === 254) return 'Unused client effect slot.'
  if (value === null) return `${String(record.fields[`effect${effect.slot}`] ?? clientSpellEffectLabel(effect.spa))}. Magnitude uses an unsupported client formula; no estimate is assumed.`
  if (effect.spa === 3 || effect.spa === 11) return speedText(effect, value)
  if (effect.spa === 0 || effect.spa === 79) return healthText(effect, value, record)
  if (effect.spa >= 1 && effect.spa <= 10) return `${effect.base < 0 ? 'Decreases' : 'Increases'} ${clientSpellEffectLabel(effect.spa).toLowerCase()} by ${number(value)}${value === 0 ? ' (no change)' : ''}.`
  return capturedDescription(effect, record)
}
function capturedDescription(effect: ClientSpellEffect, record: ClientSpellRecord): string {
  const captured = record.fields[`effect${effect.slot}`]
  return typeof captured === 'string' ? captured.replace(/([a-z])([A-Z])/g, '$1 $2') : `${clientSpellEffectLabel(effect.spa)}. Client base ${effect.base}, formula ${effect.calc}, limit ${effect.limit}, maximum ${effect.max}.`
}
/** Client-only, level-evaluated explanations. It never simulates non-HP buff statistics. */
export function describeClientSpell(record: ClientSpellRecord, level: number): SpellPresentation {
  return {
    level, duration: duration(record, level), target: String(record.fields.targetName ?? `Client target type ${record.target}`),
    range: `Casting range ${number(record.range)} game units${record.aeRange > 0 ? `; area radius ${number(record.aeRange)} game units` : '; no area radius'}.`,
    resist: String(record.fields.resistName ?? 'Unspecified'),
    effects: record.effects.map((effect) => ({ slot: effect.slot, spa: effect.spa, label: clientSpellEffectLabel(effect.spa), text: effectText(effect, record, level),
      neutral: effect.spa === 254 || (effect.base === 0 && effect.max === 0 && effect.limit === 0 && effect.calc === 100) }))
  }
}
