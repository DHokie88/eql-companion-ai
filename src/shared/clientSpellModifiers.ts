/** Character overlays over immutable client calculations. This module does not
 * alter legacy Leveling/card scaling, source snapshots, or observed ownership.
 */
import { calculateClientSpell, type ClientSpellAmountTransform } from './clientSpellCalculations'
import { qualifyClientSpellFocus } from './clientSpellFocus'
import { SpellModifierCatalog, type CatalogFocusSource } from './clientSpellModifierCatalog'
import { rankedHpAmount, rankDotDuration, rankHpMana } from './clientSpellRankRules'
import type { ClientSpellRecord, SpellCalculation, SpellClass, SpellMetric } from './spellLibrary'
import type { SpellModifierApplied, SpellModifierContext } from './spellModifiers'
import type { BardInstrumentEstimate } from './bardInstruments'
import { bardEffectImpact, bardInstrumentAmount } from './bardSongRules'

export { SpellModifierCatalog } from './clientSpellModifierCatalog'
export interface SpellModifierEvaluation {
  rankOnly?: boolean
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

function transformFor(metric: SpellMetric, rank: number | null, pct: number, instrument: { record: ClientSpellRecord; estimate: BardInstrumentEstimate | null }): ClientSpellAmountTransform {
  return (amount, effect) => {
    const ranked = rankedHpAmount(instrument.record, effect, amount, { metric, rank })
    return (instrument?.estimate ? bardInstrumentAmount(ranked, effect, { record: instrument.record, multiplier: instrument.estimate.bestMultiplier }) : ranked) * (1 + pct / 100)
  }
}

function withMetadata(baseline: SpellCalculation, result: SpellCalculation, options: SpellModifierEvaluation, applied: Omit<SpellModifierApplied, 'baseline' | 'mode' | 'modelVersion' | 'contextRevision'>): SpellCalculation {
  return {
    ...result,
    restrictions: [...result.restrictions.map((text) => applied.instrument && text === 'Bard singing and instrument modifiers are not included.' ? 'Supported instrument equipment scaling is included; AA and temporary singing bonuses are excluded.' : text), 'Community rank model: +6% per direct hit, +3% per damage tick and +5% DoT duration per rank. Healing uses the observed +3% model. Mana uses -2% per rank; cast time uses -2% for direct damage and -4% for DoTs/heals. Recovery/reuse use the community rounding model. Damage pulse counts include the observed application pulse. Other server effects are excluded.',
      ...(applied.rank === 1 && applied.rankSource === 'simulated' ? ['Simulated rank I uses the category model assumption, not an official server formula.'] : [])],
    modifiers: {
      mode: options.context.preferences.mode, modelVersion: options.context.modelVersion, contextRevision: options.context.revision,
      baseline: { mana: baseline.mana, instant: baseline.instant, perTick: baseline.perTick, ticks: baseline.ticks, total: baseline.total, perMana: baseline.perMana }, ...applied
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
  const { instant, perTick, ticks, total, perMana } = rankHpMana(rankDotDuration(calculateClientSpell(record, options.level, options.metric, transformFor(options.metric, inputs.rank, inputs.pct, { record, estimate })), inputs.rank), inputs.rank)
  return { instant, perTick, ticks, total, perMana }
}
function equipmentFor(record: ClientSpellRecord, options: SpellModifierEvaluation, catalog: SpellModifierCatalog, ticks: number) {
  if (options.rankOnly) return { focus: { focus: null, warnings: [], simulated: false }, instrument: null, warnings: [] }
  const focus = bestFocus(record, options, catalog, ticks)
  const instrument = catalog.instruments.resolve(record, options.context, options.level)
  return { focus, instrument, warnings: [...focus.warnings, ...instrumentWarnings(record, instrument)] }
}
function hybridWarnings(record: ClientSpellRecord): string[] {
  return record.durationFormula > 0 && record.effects.some((effect) => effect.spa === 79 && effect.base < 0)
    ? ['Hybrid initial-hit rank scaling is unverified. The +6% model conflicts with some observed poison hits; tick scaling and pulse count are separate.'] : []
}

/** One consistent context for Browse, details, comparison, and catalog ranking.
 * The default client path has no metadata and remains structurally identical.
 */
export function evaluateModifiedSpell(record: ClientSpellRecord, options: SpellModifierEvaluation, catalog: SpellModifierCatalog): SpellCalculation {
  const { level, metric, context } = options
  const baseline = calculateClientSpell(record, level, metric)
  if (context.preferences.mode === 'client') return baseline
  const rank = catalog.rank(record, context)
  const { focus, instrument, warnings: equipmentWarnings } = equipmentFor(record, options, catalog, baseline.ticks ?? 0)
  const inputs = { record, estimate: instrument }
  const pct = focus.focus?.pct ?? 0
  const warnings = [...new Set([...context.warnings, ...rank.warnings, ...equipmentWarnings, ...hybridWarnings(record)])]
  const result = rankHpMana(rankDotDuration(calculateClientSpell(record, level, metric, transformFor(metric, rank.rank, pct, inputs)), rank.rank), rank.rank)
  const range = focus.focus && baseline.total !== null ? {
    min: rankDotDuration(calculateClientSpell(record, level, metric, transformFor(metric, rank.rank, focus.focus.minPct, inputs)), rank.rank).total ?? 0,
    max: rankDotDuration(calculateClientSpell(record, level, metric, transformFor(metric, rank.rank, focus.focus.maxPct, inputs)), rank.rank).total ?? 0
  } : null
  return withMetadata(baseline, result, options, {
    ...(options.rankOnly ? { rankOnly: true } : {}),
    rank: rank.rank, rankSource: rank.source, focus: focus.focus, range,
    ...(instrument ? { instrument } : {}),
    equippedInstrument: equippedProjection(record, options, { instrument, rank: rank.rank, pct }),
    partial: warnings.length > 0, simulated: rank.source === 'simulated' || focus.simulated, warnings
  })
}
