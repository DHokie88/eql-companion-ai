/** Character overlays over immutable client calculations. This module does not
 * alter legacy Leveling/card scaling, source snapshots, or observed ownership.
 */
import { calculateClientSpell, type ClientSpellAmountTransform } from './clientSpellCalculations'
import { qualifyClientSpellFocus } from './clientSpellFocus'
import { SpellModifierCatalog, type CatalogFocusSource } from './clientSpellModifierCatalog'
import { scaleSpellDamage, scaleSpellHeal } from './spellScale'
import type { ClientSpellRecord, SpellCalculation, SpellClass, SpellMetric } from './spellLibrary'
import type { SpellModifierApplied, SpellModifierContext } from './spellModifiers'
import type { BardInstrumentEstimate } from './bardInstruments'
import { bardEffectImpact, bardInstrumentAmount } from './bardSongRules'

export { SpellModifierCatalog } from './clientSpellModifierCatalog'
export interface SpellModifierEvaluation {
  level: number
  metric: SpellMetric
  classes: SpellClass[]
  context: SpellModifierContext
}
type AppliedFocus = NonNullable<SpellModifierApplied['focus']>

function candidateHit(source: CatalogFocusSource, record: ClientSpellRecord, options: SpellModifierEvaluation, ticks: number): { hit: AppliedFocus | null; warning: string | null } {
  const { focus, item } = source
  if (focus.kind !== null && focus.kind !== options.metric) return { hit: null, warning: null }
  const qualified = qualifyClientSpellFocus(focus, record, { level: options.level, classes: options.classes, ticks })
  if (qualified.unknown) return { hit: null, warning: `${focus.name}: ${qualified.unknown}` }
  if (qualified.pct <= 0) return { hit: null, warning: null }
  return { hit: { id: focus.id, name: focus.name, item, minPct: qualified.minPct, maxPct: qualified.maxPct, pct: qualified.pct }, warning: null }
}

function bestFocus(record: ClientSpellRecord, options: SpellModifierEvaluation, catalog: SpellModifierCatalog, ticks: number): { focus: AppliedFocus | null; warnings: string[]; simulated: boolean } {
  const resolution = catalog.focusSources(options.context)
  const warnings = [...resolution.warnings]
  const hits: AppliedFocus[] = []
  for (const source of resolution.sources) {
    const { hit, warning } = candidateHit(source, record, options, ticks)
    if (warning) warnings.push(warning)
    if (hit) hits.push(hit)
  }
  hits.sort((a, b) => b.pct - a.pct || a.id - b.id || a.item.localeCompare(b.item))
  return { focus: hits[0] ?? null, warnings, simulated: resolution.simulated }
}

function transformFor(metric: SpellMetric, rank: number | null, pct: number, instrument?: { record: ClientSpellRecord; estimate: BardInstrumentEstimate | null }): ClientSpellAmountTransform {
  const scale = metric === 'damage' ? scaleSpellDamage : scaleSpellHeal
  return (amount, effect) => {
    const ranked = scale(amount, rank)
    return (instrument?.estimate ? bardInstrumentAmount(ranked, effect, { record: instrument.record, multiplier: instrument.estimate.bestMultiplier }) : ranked) * (1 + pct / 100)
  }
}

function withMetadata(baseline: SpellCalculation, result: SpellCalculation, options: SpellModifierEvaluation, applied: Omit<SpellModifierApplied, 'baseline' | 'mode' | 'modelVersion' | 'contextRevision'>): SpellCalculation {
  return {
    ...result,
    restrictions: [...result.restrictions.map((text) => applied.instrument && text === 'Bard singing and instrument modifiers are not included.' ? 'Supported instrument equipment scaling is included; AA and temporary singing bonuses are excluded.' : text), 'Mote scaling uses measured estimates. Efficiency uses client mana cost; duration and casting times are unchanged.'],
    modifiers: {
      mode: options.context.preferences.mode, modelVersion: options.context.modelVersion, contextRevision: options.context.revision,
      baseline: { instant: baseline.instant, perTick: baseline.perTick, ticks: baseline.ticks, total: baseline.total, perMana: baseline.perMana }, ...applied
    }
  }
}
function instrumentWarnings(record: ClientSpellRecord, instrument: BardInstrumentEstimate | null): string[] {
  if (instrument) return [...instrument.warnings, ...record.effects.filter((effect) => [0, 79].includes(effect.spa) && bardEffectImpact(effect, record) === 'unsupported').map((effect) => `Instrument scaling for HP effect SPA ${effect.spa} is unsupported; its instrument stage uses the client amount.`)]
  return record.classes.some((entry) => entry.code === 'BRD') ? ['Bard instrument modifiers are not modeled for this unknown or non-song client skill.'] : []
}
function equippedProjection(record: ClientSpellRecord, options: SpellModifierEvaluation, inputs: { instrument: BardInstrumentEstimate | null; rank: number | null; pct: number }): Pick<SpellCalculation, 'instant' | 'perTick' | 'ticks' | 'total' | 'perMana'> | undefined {
  if (!inputs.instrument) return undefined
  const estimate = { ...inputs.instrument, bestMultiplier: inputs.instrument.equippedMultiplier }
  const { instant, perTick, ticks, total, perMana } = calculateClientSpell(record, options.level, options.metric, transformFor(options.metric, inputs.rank, inputs.pct, { record, estimate }))
  return { instant, perTick, ticks, total, perMana }
}

/** One consistent context for Browse, details, comparison, and catalog ranking.
 * The default client path has no metadata and remains structurally identical.
 */
export function evaluateModifiedSpell(record: ClientSpellRecord, options: SpellModifierEvaluation, catalog: SpellModifierCatalog): SpellCalculation {
  const { level, metric, context } = options
  const baseline = calculateClientSpell(record, level, metric)
  if (context.preferences.mode === 'client') return baseline
  const rank = catalog.rank(record, context)
  const focus = bestFocus(record, options, catalog, baseline.ticks ?? 0)
  const instrument = catalog.instruments.resolve(record, context, level)
  const inputs = { record, estimate: instrument }
  const pct = focus.focus?.pct ?? 0
  const warnings = [...new Set([...context.warnings, ...rank.warnings, ...focus.warnings, ...instrumentWarnings(record, instrument)])]
  const result = calculateClientSpell(record, level, metric, transformFor(metric, rank.rank, pct, inputs))
  const range = focus.focus && baseline.total !== null ? {
    min: calculateClientSpell(record, level, metric, transformFor(metric, rank.rank, focus.focus.minPct, inputs)).total ?? 0,
    max: calculateClientSpell(record, level, metric, transformFor(metric, rank.rank, focus.focus.maxPct, inputs)).total ?? 0
  } : null
  return withMetadata(baseline, result, options, {
    rank: rank.rank, rankSource: rank.source, focus: focus.focus, range,
    ...(instrument ? { instrument } : {}),
    equippedInstrument: equippedProjection(record, options, { instrument, rank: rank.rank, pct }),
    partial: warnings.length > 0, simulated: rank.source === 'simulated' || focus.simulated, warnings
  })
}
