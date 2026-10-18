import type { ClientSpellRecord, SpellCalculation, SpellDataset, SpellMetric } from '../../shared/spellLibrary'
import type { SpellModifierContext } from '../../shared/spellModifiers'
import { calculateClientSpell, CLIENT_SPELL_CALCULATION_SCOPE } from '../../shared/clientSpellCalculations'
import { evaluateModifiedSpell, SpellModifierCatalog } from '../../shared/clientSpellModifiers'
import { classesArg, evaluationArg } from './queryValidation'
import type { SpellLibraryStorage } from './storage'

export type SpellCalculator = (record: ClientSpellRecord, level: number, metric: SpellMetric) => SpellCalculation

/** Retains one compact catalog index; live character inputs belong only to the current request. */
export class WorkerSpellEvaluation {
  private cached: { id: string; catalog: SpellModifierCatalog } | null = null
  constructor(private readonly storage: SpellLibraryStorage) {}
  catalog(dataset: SpellDataset): SpellModifierCatalog {
    if (this.cached?.id !== dataset.snapshotId) {
      this.cached = { id: dataset.snapshotId, catalog: new SpellModifierCatalog(this.storage.records(dataset.snapshotId)) }
    }
    return this.cached.catalog
  }
  calculator(dataset: SpellDataset | null, query: Record<string, unknown>, context: unknown): SpellCalculator {
    const options = evaluationArg(query.evaluation)
    if (!options) return calculateClientSpell
    const modifiers = context as SpellModifierContext | undefined
    if (modifiers?.revision !== options.contextRevision || modifiers.preferences?.mode !== options.mode) {
      throw new Error('Spell modifier inputs changed. Refresh the results.')
    }
    if (options.mode === 'client' || !dataset) return calculateClientSpell
    if (options.mode === 'mine' && !modifiers.character) throw new Error('Select a character to use Show mine.')
    const catalog = this.catalog(dataset)
    const classes = options.classes ?? classesArg(query.classes) ?? []
    return (record, level, metric) => evaluateModifiedSpell(record, { level, metric, classes, context: modifiers }, catalog)
  }
}

export function spellEvaluationScope(query: Record<string, unknown>): string {
  const options = evaluationArg(query.evaluation)
  if (!options || options.mode === 'client') return CLIENT_SPELL_CALCULATION_SCOPE
  return `${options.mode === 'emulate' ? 'Simulated' : 'Detected-character'} estimate: measured mote rules and qualifying worn damage/healing focus, one target, full duration. Efficiency uses client mana cost. AA, bard instruments, critical hits, resists, mana/cast-time modifiers, recourse and repeated waves are excluded. Partial estimates identify missing inputs.`
}
