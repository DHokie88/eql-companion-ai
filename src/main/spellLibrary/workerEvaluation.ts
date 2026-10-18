import type { ClientSpellRecord, SpellCalculation, SpellDataset, SpellMetric } from '../../shared/spellLibrary'
import type { SpellModifierContext } from '../../shared/spellModifiers'
import { calculateClientSpell, CLIENT_SPELL_CALCULATION_SCOPE } from '../../shared/clientSpellCalculations'
import { evaluateModifiedSpell, SpellModifierCatalog } from '../../shared/clientSpellModifiers'
import { analyzeClientSpell, SpellMechanicsCatalog } from '../../shared/clientSpellAnalysis'
import { analysisArg } from './analysisValidation'
import { classesArg, evaluationArg } from './queryValidation'
import type { SpellLibraryStorage } from './storage'

export type SpellCalculator = (record: ClientSpellRecord, level: number, metric: SpellMetric) => SpellCalculation

function modifierInputs(query: Record<string, unknown>, context: unknown) {
  const options = evaluationArg(query.evaluation)
  const modifiers = context as SpellModifierContext | undefined
  if (options && (modifiers?.revision !== options.contextRevision || modifiers.preferences?.mode !== options.mode)) {
    throw new Error('Spell modifier inputs changed. Refresh the results.')
  }
  if (options?.mode === 'mine' && !modifiers?.character) throw new Error('Select a character to use Show mine.')
  return { options, modifiers: options ? modifiers : undefined }
}

/** Retains one compact catalog index; live character inputs belong only to the current request. */
export class WorkerSpellEvaluation {
  private cached: { id: string; catalog: SpellModifierCatalog; mechanics: SpellMechanicsCatalog | null } | null = null
  constructor(private readonly storage: SpellLibraryStorage) {}
  catalog(dataset: SpellDataset): SpellModifierCatalog {
    if (this.cached?.id !== dataset.snapshotId) {
      this.cached = { id: dataset.snapshotId, catalog: new SpellModifierCatalog(this.storage.records(dataset.snapshotId)), mechanics: null }
    }
    return this.cached.catalog
  }
  private mechanics(dataset: SpellDataset): SpellMechanicsCatalog {
    this.catalog(dataset)
    if (!this.cached) throw new Error('Spell catalog is unavailable')
    this.cached.mechanics ??= new SpellMechanicsCatalog(this.storage.records(dataset.snapshotId))
    return this.cached.mechanics
  }
  detectedRank(dataset: SpellDataset, record: ClientSpellRecord, input: unknown): number | null {
    const context = input as SpellModifierContext | undefined
    if (!context?.character) return null
    return this.catalog(dataset).rank(record, { ...context, preferences: { ...context.preferences, mode: 'mine' } }).rank
  }
  calculator(dataset: SpellDataset | null, query: Record<string, unknown>, context: unknown): SpellCalculator {
    const { options, modifiers } = modifierInputs(query, context)
    const analysis = analysisArg(query.analysis)
    if (!dataset) return calculateClientSpell
    if (analysis) return this.analysisCalculator(dataset, query, modifiers)
    if (!options || options.mode === 'client' || !modifiers) return calculateClientSpell
    const catalog = this.catalog(dataset)
    const classes = options.classes ?? classesArg(query.classes) ?? []
    return (record, level, metric) => evaluateModifiedSpell(record, { level, metric, classes, context: modifiers }, catalog)
  }
  private analysisCalculator(dataset: SpellDataset, query: Record<string, unknown>, context: SpellModifierContext | undefined): SpellCalculator {
    const analysis = analysisArg(query.analysis)
    if (!analysis) throw new Error('Spell analysis settings are required')
    const dependencies = { modifiers: this.catalog(dataset), mechanics: this.mechanics(dataset) }
    const classes = evaluationArg(query.evaluation)?.classes ?? classesArg(query.classes) ?? []
    return (record, level, metric) => analyzeClientSpell(record, { level, metric, classes, context, analysis }, dependencies)
  }
}

export function spellEvaluationScope(query: Record<string, unknown>): string {
  const analysis = analysisArg(query.analysis)
  if (analysis) return `${analysis.scope === 'pack' ? 'Aggregate pack total' : 'One-target full cast'}. Supported direct effects, full-duration periodic effects and verified rain hit budgets. Modeled cycle rate divides amount by cast time plus the maximum of recovery, recast and delivery. Efficiency uses client mana cost. Partial estimates identify missing inputs and unknown caps.`
  const options = evaluationArg(query.evaluation)
  if (!options || options.mode === 'client') return CLIENT_SPELL_CALCULATION_SCOPE
  return `${options.mode === 'emulate' ? 'Simulated' : 'Detected-character'} estimate: measured mote rules and qualifying worn damage/healing focus, one target, full duration. Efficiency uses client mana cost. AA, bard instruments, critical hits, resists, mana/cast-time modifiers, recourse and repeated waves are excluded. Partial estimates identify missing inputs.`
}
