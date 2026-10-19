import type { BardInstrumentEstimate, BardSongEffectEstimate, BardSongPresentation } from './bardInstruments'
import type { ClientSpellEffect, ClientSpellRecord } from './spellLibrary'
import type { SpellPresentation } from './clientSpellDescriptions'
import { describeClientSpellEffect } from './clientSpellDescriptions'
import { clientSpellEffectAmount } from './clientSpellCalculations'
import { bardEffectImpact, bardImpactExplanation, bardInstrumentAmount } from './bardSongRules'

function instrumentText(effect: ClientSpellEffect, record: ClientSpellRecord, input: { level: number; multiplier: number }): string | null {
  if (bardEffectImpact(effect, record) === 'unsupported') return null
  const amount = clientSpellEffectAmount(effect, input.level)
  if (amount === null) return null
  const scaled = bardInstrumentAmount(amount, effect, { record, multiplier: input.multiplier })
  if (effect.spa === 3 && effect.base < 0 && scaled >= 100) return `Raw scaling gives ${scaled}% movement slow; the effective reduction is unavailable because the server cap is unknown.`
  return describeClientSpellEffect(effect, record, input.level, scaled) + (effect.spa === 3 && input.multiplier !== 1 ? ' Raw effect before server movement caps.' : '')
}
/** These rows isolate equipment; combined HP rank/focus estimates are returned separately. */
export function bardSongPresentation(record: ClientSpellRecord, presentation: SpellPresentation, inputs: BardInstrumentEstimate): BardSongPresentation {
  const effects: BardSongEffectEstimate[] = []
  for (const effect of record.effects) {
    const client = presentation.effects.find((entry) => entry.slot === effect.slot)
    if (!client || client.neutral) continue
    effects.push({ slot: effect.slot, label: client.label, impact: bardEffectImpact(effect, record), explanation: bardImpactExplanation(effect, record),
      client: client.text, equipped: instrumentText(effect, record, { level: presentation.level, multiplier: inputs.equippedMultiplier }),
      bestCarried: instrumentText(effect, record, { level: presentation.level, multiplier: inputs.bestMultiplier }) })
  }
  return { inputs, effects }
}
