import type { SpellAnalysisOptions, SpellAnalysisSort, SpellRankingCategory, SpellTargetCount } from '../../shared/spellAnalysis'
import { integerArg } from './workerProtocol'
import { queryObject } from './queryValidation'

export function targetCountArg(value: unknown): SpellTargetCount {
  return value === 'maximum' ? value : integerArg(value, 'target count', 1, 100)
}
export function analysisArg(value: unknown): SpellAnalysisOptions | undefined {
  if (value === undefined) return undefined
  const options = queryObject(value, ['scope', 'targets'])
  if (options.scope !== 'single' && options.scope !== 'pack') throw new Error('Invalid spell analysis scope')
  return { scope: options.scope, targets: targetCountArg(options.targets) }
}
export function choiceArg<T extends string>(value: unknown, name: string, choices: readonly T[]): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new Error(`Invalid ${name}`)
  return value as T
}
export const RANKING_CATEGORIES: readonly SpellRankingCategory[] = ['dd', 'dot', 'aoe', 'heal', 'hot']
export const ANALYSIS_SORTS: readonly SpellAnalysisSort[] = ['id', 'name', 'level', 'amount', 'mana', 'efficiency', 'rate', 'cast', 'recovery', 'recast', 'duration', 'ticks', 'waves', 'targets', 'hits']
