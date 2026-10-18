/** Numeric focus rules decoded from the captured client catalog. EQEmu's spdat.h
 * and CalcFocusEffect define the SPA vocabulary; EQL remains a measured estimate.
 * Unknown limits fail closed instead of dropping a restriction from the focus.
 */
import type { ClientSpellEffect, ClientSpellRecord, SpellClass, SpellMetric } from './spellLibrary'

export interface ClientSpellFocus {
  id: number
  name: string
  kind: SpellMetric | null
  minPct: number
  maxPct: number
  limits: ClientSpellEffect[]
  reason: string | null
}
export interface FocusQualification {
  minPct: number
  maxPct: number
  pct: number
  unknown: string | null
}
export interface ClientFocusSpell { level: number; classes: SpellClass[]; ticks: number }

const LIMITS = new Set([134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 311])
const INCLUSIONS = new Set([135, 136, 137, 139])
const CASTING_SKILLS = new Set([4, 5, 14, 18, 24, 41])

function bandProblem(head: ClientSpellEffect): string | null {
  if (head.calc !== 100 || head.max !== 0) return 'The focus uses an unsupported percentage formula.'
  if (!Number.isFinite(head.base) || !Number.isFinite(head.limit)) return 'The focus percentage is invalid.'
  if (head.base < 0 || head.limit < 0) return 'Negative focus percentages are not modeled.'
  if (head.limit > 0 && head.limit < head.base) return 'The focus percentage band is reversed.'
  return null
}

function limitProblem(effect: ClientSpellEffect): string | null {
  if (!LIMITS.has(effect.spa)) return `Unsupported focus effect or limit SPA ${effect.spa}.`
  if (effect.calc !== 100 || effect.max !== 0 || !Number.isInteger(effect.base)) return `Unsupported focus limit formula in SPA ${effect.spa}.`
  const secondary = secondaryLimitProblem(effect)
  if (secondary) return secondary
  if ([138, 141, 311].includes(effect.spa) && ![0, 1].includes(effect.base)) return `Unsupported focus limit value in SPA ${effect.spa}.`
  if ([140, 142, 143, 144].includes(effect.spa) && effect.base < 0) return `Negative focus bound in SPA ${effect.spa}.`
  return null
}

function secondaryLimitProblem(effect: ClientSpellEffect): string | null {
  if (effect.spa !== 134) return effect.limit !== 0 ? `Unsupported secondary limit in SPA ${effect.spa}.` : null
  if (effect.base < 1 || !Number.isFinite(effect.limit) || effect.limit < 0) return 'The focus level cap or encoded decay is invalid.'
  return null
}

/** Null means this is not a damage/healing focus definition. Multi-head records
 * stay visible as unsupported options rather than applying one head's limits to another.
 */
export function decodeClientSpellFocus(record: ClientSpellRecord): ClientSpellFocus | null {
  const heads = record.effects.filter((effect) => effect.spa === 124 || effect.spa === 125)
  const head = heads[0]
  if (!head) return null
  const limits = record.effects.filter((effect) => effect !== head && effect.spa !== 254)
  const reason = heads.length !== 1 ? 'Multiple focus heads are not modeled.' : bandProblem(head) ?? limits.map(limitProblem).find(Boolean) ?? null
  const kinds = new Set(heads.map((effect) => effect.spa))
  const kind = kinds.size > 1 ? null : head.spa === 124 ? 'damage' : 'healing'
  return { id: record.id, name: record.name, kind, minPct: head.base, maxPct: head.limit || head.base, limits, reason }
}

function spellLevel(record: ClientSpellRecord, input: ClientFocusSpell): number | null {
  const levels = record.classes.filter((entry) => input.classes.includes(entry.code) && entry.level <= input.level).map((entry) => entry.level)
  // The catalog is a union of the character's classes. Use its earliest eligible
  // acquisition level; the caster level is never a substitute for spell level.
  return levels.length ? Math.min(...levels) : null
}

function combatClassification(record: ClientSpellRecord): 'spell' | 'combat' | null {
  if (record.fields.isDiscipline === true || record.fields.isDiscipline === 1) return 'combat'
  if (record.fields.isCombatProc === true || record.fields.isCombatProc === 1) return 'combat'
  if (record.mana > 0 && record.classes.length && CASTING_SKILLS.has(Number(record.fields.skill))) return 'spell'
  return null
}

function inclusionMatch(effect: ClientSpellEffect, record: ClientSpellRecord): boolean | null {
  const value = Math.abs(effect.base)
  if (effect.spa === 135) return typeof record.fields.resist === 'number' ? record.fields.resist === value : null
  if (effect.spa === 136) return record.target === value
  if (effect.spa === 139) return record.id === value
  return record.effects.some((slot) => slot.spa === value)
}

interface LimitOutcome { pass: boolean; scale: number; unknown: string | null }
const pass: LimitOutcome = { pass: true, scale: 1, unknown: null }
const fail: LimitOutcome = { pass: false, scale: 0, unknown: null }
function unknown(message: string): LimitOutcome { return { pass: false, scale: 0, unknown: message } }

function levelOutcome(effect: ClientSpellEffect, record: ClientSpellRecord, input: ClientFocusSpell): LimitOutcome {
  const level = spellLevel(record, input)
  if (level === null) return unknown('Focus eligibility needs a resolved eligible caster class and spell level.')
  if (effect.spa === 142) return level >= effect.base ? pass : fail
  const over = Math.max(0, level - effect.base)
  if (!over) return pass
  if (!effect.limit) return fail
  const left = 100 - over * effect.limit
  return left >= 1 ? { ...pass, scale: left / 100 } : fail
}

function boundedOutcome(effect: ClientSpellEffect, record: ClientSpellRecord, input: ClientFocusSpell): LimitOutcome {
  const values: Record<number, boolean> = {
    138: record.beneficial === (effect.base === 1), 140: input.ticks >= effect.base,
    141: (record.durationFormula === 0) === (effect.base === 1),
    143: record.castMs >= effect.base, 144: record.castMs <= effect.base
  }
  if (effect.spa !== 311) return values[effect.spa] ? pass : fail
  const classification = combatClassification(record)
  if (classification === null) return unknown('Spell, combat-skill, or proc classification is unknown; this focus was not applied.')
  return (classification === 'combat') === (effect.base === 1) ? pass : fail
}

function alternativeOutcome(effects: ClientSpellEffect[], record: ClientSpellRecord, input: ClientFocusSpell): LimitOutcome {
  if (INCLUSIONS.has(effects[0].spa)) {
    const matches = effects.map((effect) => inclusionMatch(effect, record))
    if (matches.includes(true)) return pass
    return matches.includes(null) ? unknown(`Focus limit SPA ${effects[0].spa} cannot be resolved.`) : fail
  }
  const results = effects.map((effect) => [134, 142].includes(effect.spa) ? levelOutcome(effect, record, input) : boundedOutcome(effect, record, input))
  const passing = results.filter((result) => result.pass).sort((a, b) => b.scale - a.scale)
  return passing[0] ?? results.find((result) => result.unknown) ?? fail
}

/** Inclusion alternatives OR within a family, families AND, exclusions veto. */
export function qualifyClientSpellFocus(focus: ClientSpellFocus, record: ClientSpellRecord, input: ClientFocusSpell): FocusQualification {
  const empty = { minPct: 0, maxPct: 0, pct: 0, unknown: focus.reason }
  if (focus.reason) return empty
  const groups = new Map<number, ClientSpellEffect[]>()
  for (const effect of focus.limits) {
    if (INCLUSIONS.has(effect.spa) && effect.base < 0) {
      const match = inclusionMatch(effect, record)
      if (match === null) return { ...empty, unknown: `Focus exclusion SPA ${effect.spa} cannot be resolved.` }
      if (match) return empty
    } else groups.set(effect.spa, [...groups.get(effect.spa) ?? [], effect])
  }
  const outcomes = [...groups.values()].map((effects) => alternativeOutcome(effects, record, input))
  if (outcomes.some((outcome) => !outcome.pass && !outcome.unknown)) return empty
  const unresolved = outcomes.find((outcome) => outcome.unknown)?.unknown
  if (unresolved) return { ...empty, unknown: unresolved }
  const scale = Math.min(1, ...outcomes.map((outcome) => outcome.scale))
  const minPct = focus.minPct * scale
  const maxPct = focus.maxPct * scale
  return { minPct, maxPct, pct: (minPct + maxPct) / 2, unknown: null }
}
