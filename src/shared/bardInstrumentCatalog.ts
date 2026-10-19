import type { BardInstrumentChoice, BardInstrumentEstimate, BardInstrumentSource } from './bardInstruments'
import type { ClientSpellRecord } from './spellLibrary'
import type { SpellModifierContext } from './spellModifiers'
import { bardSongFamily } from './bardSongRules'

interface Definition { id: number; name: string; multiplier: number; skills: number[]; classes: number[]; reason: string | null }
const key = (name: string): string => name.trim().toLowerCase()
const songModelWarning = 'Gear-only instrument estimate: assumes the song skill is trained and other worn focus stays active after a required swap. Equipment conflicts, AA, Amplification, temporary song bonuses and server song/movement caps are not included; EQL behavior may differ from the reference model.'

function definition(record: ClientSpellRecord): Definition | null {
  const heads = record.effects.filter((effect) => effect.spa === 413)
  if (!heads.length) return null
  const head = heads[0], limits = record.effects.filter((effect) => effect.spa !== 413 && effect.spa !== 254)
  const invalidHead = heads.length !== 1 || head.calc !== 100 || head.limit !== 0 || head.max !== 0 || !Number.isSafeInteger(head.base) || head.base < 0 || head.base > 1000 || head.base % 10 !== 0
  const invalidLimits = limits.some((effect) => ![411, 414].includes(effect.spa) || effect.calc !== 100 || effect.limit !== 0 || effect.max !== 0 || !Number.isSafeInteger(effect.base) || effect.base < 0)
  return { id: record.id, name: record.name, multiplier: 1 + head.base / 100,
    skills: limits.filter((effect) => effect.spa === 414).map((effect) => effect.base),
    classes: limits.filter((effect) => effect.spa === 411).map((effect) => effect.base),
    reason: invalidHead || invalidLimits ? 'Unsupported base-effect instrument formula or qualification limits.' : null }
}
function qualifies(value: Definition, record: ClientSpellRecord): boolean {
  return (!value.skills.length || value.skills.includes(Number(record.fields.skill))) && value.classes.every((mask) => (mask & 256) !== 0)
}
function strongest(choices: BardInstrumentChoice[]): BardInstrumentChoice | null {
  return [...choices].sort((a, b) => b.multiplier - a.multiplier || Number(a.requiresEquip) - Number(b.requiresEquip) || a.effectId - b.effectId || a.item.localeCompare(b.item) || a.location.localeCompare(b.location))[0] ?? null
}
function instrumentSources(context: SpellModifierContext) { return context.inventory.instruments?.sources ?? [] }
/** Shares the parent catalog's complete exact-name index, including duplicate/internal IDs. */
export class BardInstrumentCatalog {
  private definitions = new Map<number, Definition>()
  constructor(private readonly names: ReadonlyMap<string, number[]>) {}
  add(record: ClientSpellRecord): void { const value = definition(record); if (value) this.definitions.set(record.id, value) }
  handles(name: string): boolean {
    return (this.names.get(key(name)) ?? []).some((id) => this.definitions.has(id))
  }
  resolve(record: ClientSpellRecord, context: SpellModifierContext, level: number): BardInstrumentEstimate | null {
    const family = bardSongFamily(record)
    if (!family) return null
    const inventory = context.inventory, warnings = new Set(inventory.instruments?.warnings ?? [])
    if (inventory.state !== 'ready' || !inventory.instruments) warnings.add('Instrument coverage is unknown until this character has a readable inventory export. Run /outputfile inventory in EQ.')
    const sources = instrumentSources(context)
    const choices = sources.flatMap((source) => this.choice(source, record, level, warnings))
    const equipped = strongest(choices.filter((choice) => !choice.requiresEquip)), bestCarried = strongest(choices)
    warnings.add(songModelWarning)
    return { mode: context.preferences.mode, family, equipped, bestCarried, equippedMultiplier: equipped?.multiplier ?? 1, bestMultiplier: bestCarried?.multiplier ?? 1,
      knownSources: sources.filter((source) => source.basis === 'resonance stat' || this.handles(source.effect)),
      exportedAt: inventory.exportedAt, partial: true, warnings: [...warnings] }
  }
  private choice(source: BardInstrumentSource, record: ClientSpellRecord, level: number, warnings: Set<string>): BardInstrumentChoice[] {
    if ((source.requiredLevel ?? 0) > level) return []
    const ids = this.names.get(key(source.effect)) ?? []
    if (ids.length !== 1) {
      if (source.basis === 'resonance stat' || /^(singing|brass|string|wind|percussion) resonance \d+$/i.test(source.effect) || this.handles(source.effect)) warnings.add(`${source.item}: ${source.effect} ${ids.length ? 'matches multiple client IDs' : 'is absent from this snapshot'}; no instrument bonus was assumed.`)
      return []
    }
    const value = this.definitions.get(ids[0])
    if (!value) return []
    if (value.reason) { warnings.add(`${source.item}: ${source.effect}: ${value.reason}`); return [] }
    if (!qualifies(value, record)) return []
    return [{ item: source.item, location: source.location, effect: value.name, effectId: value.id, multiplier: value.multiplier, requiresEquip: !source.equipped }]
  }
}
