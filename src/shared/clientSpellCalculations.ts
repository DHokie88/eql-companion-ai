/** Unmodified client formulas from the standalone SpellQueries.py, separate from
 * Oracle's existing wiki/focus/rank overlays. Unsupported cases stay unknown.
 */
import type { ClientSpellEffect, ClientSpellRecord, SpellCalculation, SpellMetric } from './spellLibrary'

export const CLIENT_SPELL_CALCULATION_SCOPE = 'Unmodified client values, one target, full duration. Excludes resists, critical hits, focus, upgrades, AA, singing/instruments, invocations, server-only modifiers and recourse/triggered effects. Client eligibility does not confirm scroll availability. These values are not a ceiling on actual combat damage.'

const FACTORS: Record<number, number> = { 101: 0.5, 102: 1, 103: 2, 104: 3, 105: 4, 106: 5, 109: 0.25, 110: 1 / 6, 119: 1 / 8, 121: 1 / 3, 143: 0.75 }
const THRESHOLDS: Record<number, readonly [number, number]> = {
  111: [16, 6], 112: [24, 8], 113: [34, 10], 114: [44, 15], 115: [15, 7], 116: [24, 10], 117: [34, 13], 118: [44, 20]
}
const POST_50 = [1, 2, 3, 4, 5, 10, 15, 20, 25]
const POST_30: Record<number, number> = { 139: 0.5, 140: 1, 141: 1.5 }
const DURATIONS: Record<number, (level: number) => number> = {
  0: () => 0, 1: (l) => Math.max(1, Math.floor(l / 2)), 2: (l) => Math.floor(l / 2) + 5, 3: (l) => l * 30,
  4: () => 50, 5: () => 2, 6: (l) => Math.floor(l / 2) + 2, 7: (l) => l, 8: (l) => l + 10,
  9: (l) => l * 2 + 10, 10: (l) => l * 3 + 10, 11: (l) => l * 30 + 90, 12: (l) => Math.max(1, Math.floor(l / 4)),
  13: (l) => l * 4 + 10, 14: (l) => 5 * (l + 2), 15: (l) => 10 * (l + 10)
}

function effectDelta(calc: number, level: number): number | null {
  if (calc === 0 || calc === 100) return 0
  if (Number.isInteger(calc) && calc >= 1 && calc <= 10) return level * calc
  if (FACTORS[calc] !== undefined) return Math.trunc(level * FACTORS[calc])
  const threshold = THRESHOLDS[calc]
  if (threshold) return Math.max(0, level - threshold[0]) * threshold[1]
  if (calc >= 124 && calc <= 132) return Math.max(0, level - 50) * POST_50[calc - 124]
  if (POST_30[calc] !== undefined) return Math.trunc(Math.max(0, level - 30) * POST_30[calc])
  return null
}

export function clientSpellEffectAmount(effect: ClientSpellEffect, level: number): number | null {
  const delta = effectDelta(effect.calc, level)
  if (delta === null) return null
  const base = Math.abs(effect.base)
  const cap = Math.abs(effect.max)
  const amount = base + delta
  if (!cap) return amount
  // Some definitions decrease toward a smaller cap as level increases.
  return cap < base && delta > 0 ? Math.max(base - delta, cap) : Math.min(amount, cap)
}

export function clientSpellDurationTicks(record: ClientSpellRecord, level: number): number | null {
  const formula = record.durationFormula
  const ticks = formula >= 200 ? formula : DURATIONS[formula]?.(level)
  if (ticks === undefined || !Number.isFinite(ticks)) return null
  return record.durationCap > 0 ? Math.min(ticks, record.durationCap) : ticks
}

function targetRestrictions(record: ClientSpellRecord): string[] {
  const target = typeof record.fields.targetName === 'string' ? record.fields.targetName : `target type ${record.target}`
  const restrictions = [`Target: ${target}; values are per target.`]
  if (record.classes.length === 1 && record.classes[0].code === 'BRD') restrictions.push('Bard singing and instrument modifiers are not included.')
  if (Number(record.fields.recourse) > 0) restrictions.push('Recourse effects are not included.')
  if (record.effects.some((effect) => ![0, 79, 254].includes(effect.spa))) restrictions.push('Only selected damage/healing HP effects are included; other effects are shown in spell details.')
  return restrictions
}

function emptyCalculation(record: ClientSpellRecord, metric: SpellMetric): SpellCalculation {
  return {
    id: record.id, name: record.name, metric, mana: record.mana, target: record.target,
    instant: null, perTick: null, ticks: null, total: null, perMana: null, reasons: [], restrictions: targetRestrictions(record)
  }
}

function calculationProblems(record: ClientSpellRecord, effects: ClientSpellEffect[], level: number): string[] {
  const unknown = effects.filter((effect) => clientSpellEffectAmount(effect, level) === null).map((effect) => effect.calc)
  const reasons: string[] = []
  if (unknown.length) reasons.push(`Unsupported effect formula: ${[...new Set(unknown)].join(', ')}.`)
  const ticks = clientSpellDurationTicks(record, level)
  if (ticks === null) reasons.push(`Unsupported or untimed duration formula: ${record.durationFormula}.`)
  else if (!Number.isInteger(ticks) || ticks < 0) reasons.push(`Fractional or negative client duration (${ticks} ticks) is not modeled.`)
  if (record.aoeDurationMs > 0) reasons.push(`Repeated-wave timing is not modeled (${record.aoeDurationMs} ms).`)
  return reasons
}

/** Runs only after all formulas and durations pass validation, once per HP slot. */
export type ClientSpellAmountTransform = (amount: number, effect: ClientSpellEffect) => number

function finishCalculation(result: SpellCalculation, effects: ClientSpellEffect[], level: number, options: { ticks: number; transform?: ClientSpellAmountTransform }): SpellCalculation {
  const { ticks, transform } = options
  let instant = 0
  let perTick = 0
  for (const effect of effects) {
    const base = clientSpellEffectAmount(effect, level)
    if (base === null) continue
    const amount = transform ? transform(base, effect) : base
    if (effect.spa === 0 && ticks > 0) perTick += amount
    else instant += amount
  }
  const total = instant + perTick * ticks
  return {
    ...result, instant, perTick, ticks, total, perMana: result.mana > 0 ? Math.round(total / result.mana * 1_000_000) / 1_000_000 : null,
    restrictions: [...result.restrictions, ...(result.mana <= 0 ? ['Zero mana: excluded from efficiency rankings; amount remains available.'] : [])]
  }
}

/** A single spell at a stated caster level. Null metrics are excluded, never zero. */
function unmodeledHpEffects(record: ClientSpellRecord, sign: number): ClientSpellEffect[] {
  return record.effects.filter((effect) => [100, 101, 334].includes(effect.spa) && effect.base * sign > 0)
}

function selectedHpEffects(record: ClientSpellRecord, sign: number): ClientSpellEffect[] {
  return record.effects.filter((effect) => (effect.spa === 0 || effect.spa === 79) && effect.base * sign > 0)
}

export function calculateClientSpell(record: ClientSpellRecord, level: number, metric: SpellMetric, transform?: ClientSpellAmountTransform): SpellCalculation {
  const result = emptyCalculation(record, metric)
  const invalid = requestProblem(level, metric)
  if (invalid) { result.reasons.push(invalid); return result }
  const sign = metric === 'damage' ? -1 : 1
  const unmodeled = unmodeledHpEffects(record, sign)
  if (unmodeled.length) {
    result.reasons.push(`HP effect SPA ${unmodeled.map((effect) => effect.spa).join(', ')} is outside this version's supported formulas.`)
    return result
  }
  const effects = selectedHpEffects(record, sign)
  if (!effects.length || record.beneficial !== (metric === 'healing')) {
    result.reasons.push(`No matching ${metric} HP effect in this ${record.beneficial ? 'beneficial' : 'detrimental'} client definition.`)
    return result
  }
  result.reasons = calculationProblems(record, effects, level)
  const ticks = clientSpellDurationTicks(record, level)
  if (result.reasons.length || ticks === null) return result
  return finishCalculation(result, effects, level, { ticks, transform })
}

function requestProblem(level: number, metric: SpellMetric): string | null {
  if (!Number.isInteger(level) || level < 1 || level > 255) return 'Caster level must be a whole number from 1 to 255.'
  if (metric !== 'damage' && metric !== 'healing') return 'Unsupported calculation metric.'
  return null
}
