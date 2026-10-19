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

/** Ideal stationary-pack opportunities, not promises about which mob takes a hit.
 * One shared budget is spent across pulses; resists may consume opportunities too.
 */
function rainWaveHits(mechanics: ClientSpellMechanics, scenario: AnalysisScenario): number[] | null {
  if (scenario.reason || mechanics.waves <= 1 || scenario.hits === null) return null
  const targets = scenario.requestedTargets === 'maximum' ? mechanics.hitCap : scenario.requestedTargets
  if (targets === null) return null
  let remaining = scenario.hits
  const waves: number[] = []
  for (let wave = 0; wave < mechanics.waves && remaining > 0; wave++) {
    const spent = Math.min(targets, remaining)
    waves.push(spent)
    remaining -= spent
  }
  return waves
}

function deliveryKind(record: ClientSpellRecord, mechanics: ClientSpellMechanics): SpellAnalysis['deliveryKind'] {
  if (mechanics.reason) return 'unverified'
  if (mechanics.waves > 1) return 'rain'
  return isAreaTarget(record.target) ? 'aoe' : 'single'
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
    deliveryKind: deliveryKind(record, mechanics), perHitTotal: mechanics.reason ? null : calculation.total,
    waveHits: rainWaveHits(mechanics, scenario),
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
  const restrictions = result.restrictions.map((restriction) => analysis.scope === 'aggregate pack total'
    ? restriction.replace('values are per target.', 'analyzed values are aggregate pack totals.') : restriction)
  return {
    ...result, analysis,
    reasons: [...new Set([...result.reasons, ...scenario.reason ? [scenario.reason] : []])],
    restrictions: [...restrictions, 'Analysis rates are modeled cycle estimates, not measured combat output. Mana is spent once per cast.']
  }
}
