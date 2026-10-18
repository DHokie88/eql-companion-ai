import { RAIN_PAGES } from './rainSpellResearch'
import type { ClientSpellRecord } from './spellLibrary'

// Numeric target vocabulary from the complete client parser, not wiki spellings.
const AREA_TARGETS = new Set([2, 4, 8, 20, 24, 25, 32, 36, 37, 40, 42, 44, 45, 50])
const RESEARCH_WINDOW_MS = 7500
const RESEARCH_HIT_CAP = 4
const RESEARCHED_RAIN = new Map(RAIN_PAGES.map((page) => [page.name, page]))

export function isAreaTarget(target: number): boolean { return AREA_TARGETS.has(target) }

export interface ClientSpellMechanics {
  waves: number
  hitCap: number | null
  deliveryMs: number
  capSource: string
  reason: string | null
}

/** A positive client cap is evidence; zero, missing and negative are unknown. */
export function clientSpellTargetCap(record: ClientSpellRecord): number | null {
  const value = record.fields.aeMaxTargets
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}

function compatibleRain(record: ClientSpellRecord): boolean {
  const damaging = record.effects.some((effect) => [0, 79].includes(effect.spa) && effect.base < 0)
  const unsupported = record.effects.some((effect) => [100, 101, 334].includes(effect.spa) && effect.base < 0)
  return record.classes.some((entry) => entry.level > 0 && entry.level < 255)
    && !record.beneficial && record.target === 8 && record.durationFormula === 0 && record.durationCap === 0
    && record.aoeDurationMs === RESEARCH_WINDOW_MS && clientSpellTargetCap(record) === RESEARCH_HIT_CAP
    && damaging && !unsupported
}

function mechanicsIdentity(record: ClientSpellRecord): string {
  return JSON.stringify([
    record.name, record.target, record.beneficial, record.classes, record.effects,
    record.durationFormula, record.durationCap, record.aoeDurationMs, record.fields.aeMaxTargets
  ])
}

function unsupportedRain(reason: string): ClientSpellMechanics {
  return { waves: 0, hitCap: null, deliveryMs: 0, capSource: 'Repeated-wave mechanics are unverified.', reason }
}

/** Immutable, snapshot-specific bindings. NPC rows and classic suffixes never
 * inherit a researched player's mechanics merely by sharing part of a name.
 */
export class SpellMechanicsCatalog {
  private readonly bindings = new Map<number, ClientSpellMechanics>()
  private readonly identities = new Map<number, string>()

  constructor(records: Iterable<ClientSpellRecord>) {
    const candidates = new Map<string, ClientSpellRecord[]>()
    for (const record of records) {
      if (this.identities.has(record.id)) throw new Error(`Duplicate catalog spell ID ${record.id}.`)
      this.identities.set(record.id, mechanicsIdentity(record))
      if (!RESEARCHED_RAIN.has(record.name) || !compatibleRain(record)) continue
      const group = candidates.get(record.name) ?? []
      group.push(record)
      candidates.set(record.name, group)
    }
    for (const [name, matches] of candidates) {
      if (matches.length !== 1) continue
      const page = RESEARCHED_RAIN.get(name)
      if (!page) continue
      this.bindings.set(matches[0].id, {
        waves: page.waves, hitCap: RESEARCH_HIT_CAP, deliveryMs: RESEARCH_WINDOW_MS, reason: null,
        capSource: `Captured client whole-cast hit budget ${RESEARCH_HIT_CAP}, validated against researched ${page.waves}-wave rain behavior.`
      })
    }
  }

  resolve(record: ClientSpellRecord): ClientSpellMechanics {
    if (this.identities.get(record.id) !== mechanicsIdentity(record)) return unsupportedRain('Spell mechanics do not belong to this captured catalog identity.')
    const bound = this.bindings.get(record.id)
    if (bound) return bound
    if (RESEARCHED_RAIN.has(record.name)) {
      return unsupportedRain('Researched rain name has no unique compatible player record in this snapshot. Expected targeted-area direct damage, no buff duration, a 7500 ms wave window and a captured 4-hit budget.')
    }
    if (record.aoeDurationMs > 0) {
      return unsupportedRain('Repeated-wave behavior is unverified. Repeated DoT applications are not multiplied by their full duration.')
    }
    return { waves: 1, hitCap: clientSpellTargetCap(record), deliveryMs: 0, capSource: 'Captured client target cap.', reason: null }
  }
}
