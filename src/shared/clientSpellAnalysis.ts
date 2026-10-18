/** Pure HP analysis over one immutable source snapshot and modifier context.
 * Callers that do not request analysis continue using the original calculators.
 */
import { calculateClientSpell } from './clientSpellCalculations'
import { evaluateModifiedSpell, type SpellModifierCatalog } from './clientSpellModifiers'
import { isAreaTarget, SpellMechanicsCatalog } from './clientSpellMechanics'
import { SPELL_ANALYSIS_MODEL_VERSION } from './spellAnalysis'
import { analysisContributions, analysisTiming, scaleAnalysisCalculation } from './clientSpellAnalysisDetails'
import type { ClientSpellRecord, SpellCalculation, SpellClass, SpellMetric } from './spellLibrary'
import type { SpellAnalysis, SpellAnalysisOptions } from './spellAnalysis'
import type { SpellModifierContext } from './spellModifiers'
import type { ClientSpellMechanics } from './clientSpellMechanics'

export { isAreaTarget, SpellMechanicsCatalog } from './clientSpellMechanics'
export interface ClientSpellAnalysisOptions {
  level: number
  metric: SpellMetric
  classes: SpellClass[]
  context?: SpellModifierContext
  analysis: SpellAnalysisOptions
}
interface AnalysisScenario {
  scope: SpellAnalysis['scope']
  requestedTargets: SpellAnalysis['requestedTargets']
  effectiveTargets: number | null
  singleHits: number
  hits: number | null
  capSource: string
  warnings: string[]
  reason: string | null
}

function packHits(requested: number, mechanics: ClientSpellMechanics): { effectiveTargets: number | null; hits: number } {
  if (mechanics.waves > 1) return { effectiveTargets: null, hits: Math.min(mechanics.waves * requested, mechanics.hitCap ?? Infinity) }
  const effectiveTargets = Math.min(requested, mechanics.hitCap ?? requested)
  return { effectiveTargets, hits: effectiveTargets }
}

function scenarioFor(record: ClientSpellRecord, options: ClientSpellAnalysisOptions, mechanics: ClientSpellMechanics): AnalysisScenario {
  const singleHits = Math.min(mechanics.waves, mechanics.hitCap ?? mechanics.waves)
  const base: AnalysisScenario = {
    scope: 'one-target full cast', requestedTargets: 1, effectiveTargets: 1, singleHits,
    hits: singleHits, capSource: mechanics.capSource, warnings: [], reason: mechanics.reason
  }
  if (options.metric === 'healing' || options.analysis.scope === 'single' || !isAreaTarget(record.target)) return base
  const maximum = options.analysis.targets === 'maximum'
  const targetCap = mechanics.hitCap
  const requested = maximum ? targetCap : options.analysis.targets
  if (requested === null || requested === 'maximum') {
    return { ...base, scope: 'aggregate pack total', requestedTargets: 'maximum', effectiveTargets: null, hits: null, reason: 'Spell maximum is unavailable: the captured definition states no finite target cap.' }
  }
  return {
    ...base, scope: 'aggregate pack total', requestedTargets: options.analysis.targets,
    ...packHits(requested, mechanics),
    capSource: targetCap === null ? 'No finite client cap is known; chosen target count is an explicit assumption.' : mechanics.capSource,
    warnings: targetCap === null ? ['AOE target cap is unknown; this partial estimate assumes every requested target is hit.'] : []
  }
}

function requestProblem(options: ClientSpellAnalysisOptions): string | null {
  const { scope, targets } = options.analysis
  if (scope !== 'single' && scope !== 'pack') return 'Unsupported analysis scope.'
  if (targets !== 'maximum' && (!Number.isSafeInteger(targets) || targets < 1 || targets > 100)) return 'Target count must be a whole number from 1 to 100, or spell maximum.'
  return null
}

function calculationFor(record: ClientSpellRecord, options: ClientSpellAnalysisOptions, catalog: SpellModifierCatalog): SpellCalculation {
  return options.context
    ? evaluateModifiedSpell(record, { ...options, context: options.context }, catalog)
    : calculateClientSpell(record, options.level, options.metric)
}

function buildAnalysis(record: ClientSpellRecord, options: ClientSpellAnalysisOptions, input: { calculation: SpellCalculation; mechanics: ClientSpellMechanics; scenario: AnalysisScenario }): SpellAnalysis {
  const { calculation, mechanics, scenario } = input
  const single = scaleAnalysisCalculation(calculation, mechanics.reason ? null : scenario.singleHits)
  const total = scaleAnalysisCalculation(calculation, scenario.reason ? null : scenario.hits)
  const warnings = [...new Set([...calculation.modifiers?.warnings ?? [], ...scenario.warnings])]
  return {
    modelVersion: SPELL_ANALYSIS_MODEL_VERSION, level: options.level, contextRevision: options.context?.revision ?? null,
    scenario: { ...options.analysis }, scope: scenario.scope, requestedTargets: scenario.requestedTargets,
    effectiveTargets: scenario.effectiveTargets, waves: mechanics.reason ? null : mechanics.waves,
    hits: scenario.reason ? null : scenario.hits, hitCap: mechanics.hitCap, capSource: scenario.capSource,
    singleTargetTotal: single.total, packTotal: scenario.scope === 'aggregate pack total' ? total.total : null,
    partial: warnings.length > 0, warnings,
    timing: analysisTiming(record, total, mechanics),
    contributions: analysisContributions(record, calculation, { level: options.level, hits: scenario.reason ? null : scenario.hits })
  }
}

/** Analysis is explicit: legacy/default clients retain their original results. */
export function analyzeClientSpell(record: ClientSpellRecord, options: ClientSpellAnalysisOptions, catalog: { modifiers: SpellModifierCatalog; mechanics: SpellMechanicsCatalog }): SpellCalculation {
  const mechanics = catalog.mechanics.resolve(record)
  const scenario = scenarioFor(record, options, mechanics)
  scenario.reason = requestProblem(options) ?? scenario.reason
  // Only verified, direct-only rains bypass the old repeated-wave exclusion.
  const source = mechanics.waves > 1 && !mechanics.reason ? { ...record, aoeDurationMs: 0 } : record
  const calculation = calculationFor(source, options, catalog.modifiers)
  const analysis = buildAnalysis(record, options, { calculation, mechanics, scenario })
  const result = scaleAnalysisCalculation(calculation, scenario.reason ? null : scenario.hits)
  return {
    ...result, analysis,
    reasons: [...new Set([...result.reasons, ...scenario.reason ? [scenario.reason] : []])],
    restrictions: [...result.restrictions, 'Analysis rates are modeled cycle estimates, not measured combat output. Mana is spent once per cast.']
  }
}
