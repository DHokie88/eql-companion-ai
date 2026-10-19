import { SPELL_CLASSES, type SpellClass, type SpellMetric } from '../../shared/spellLibrary'
import { integerArg, objectArgs, stringArg } from './workerProtocol'
import type { SpellEvaluationOptions } from '../../shared/spellModifiers'

export function evaluationArg(input: unknown): SpellEvaluationOptions | undefined {
  if (input === undefined) return undefined
  const value = queryObject(input, ['mode', 'contextRevision', 'classes', 'rankOnly'])
  if (value.rankOnly !== undefined && typeof value.rankOnly !== 'boolean') throw new Error('Invalid rank-only option')
  if (!['client', 'mine', 'emulate'].includes(String(value.mode))) throw new Error('Invalid spell value mode')
  const revision = stringArg(value.contextRevision, 'contextRevision')
  if (revision.length > 256) throw new Error('Invalid context revision')
  return { mode: value.mode as SpellEvaluationOptions['mode'], contextRevision: revision, classes: classesArg(value.classes), ...(value.rankOnly === undefined ? {} : { rankOnly: value.rankOnly }) }
}

export function queryObject(input: unknown, allowed: string[]): Record<string, unknown> {
  const query = input === undefined ? {} : objectArgs(input)
  for (const key of Object.keys(query)) if (!allowed.includes(key)) throw new Error(`Unknown query field: ${key}`)
  return query
}
export function pageArgs(query: Record<string, unknown>): { page: number; pageSize: number } {
  return { page: integerArg(query.page ?? 1, 'page', 1, 1000000), pageSize: integerArg(query.pageSize ?? 50, 'pageSize', 1, 200) }
}
export function optionalText(value: unknown, name: string, max = 512): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.length > max) throw new Error(`Invalid ${name}`)
  return value.trim()
}
export function snapshotArg(value: unknown): string | undefined {
  if (value === undefined) return undefined
  const id = stringArg(value, 'snapshotId')
  if (!/^s-[a-f0-9]{64}$/.test(id)) throw new Error('Invalid snapshotId')
  return id
}
export function requiredSnapshotArg(value: unknown): string {
  const id = snapshotArg(value)
  if (!id) throw new Error('Missing snapshotId')
  return id
}
export function spellId(value: unknown): number { return integerArg(value, 'spell ID', 0, 2147483647) }
export function levelArg(value: unknown): number { return integerArg(value, 'level', 1, 255) }
export function classesArg(value: unknown): SpellClass[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > 16 || value.some((code) => !SPELL_CLASSES.includes(code as SpellClass))) {
    throw new Error('Invalid spell classes')
  }
  return value as SpellClass[]
}
export function metricArg(value: unknown): SpellMetric {
  if (value !== 'damage' && value !== 'healing') throw new Error('Invalid spell metric')
  return value
}
