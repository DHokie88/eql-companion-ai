import type { ClassAbbr } from '../classCombo'
import { GEAR_STAT_KEYS, type GearRow, type GearStats } from '../planner/gear'
import { gearRatio } from '../planner/gearScale'
import { profileWeights, type BuildWeights } from './profiles'
export const STRATEGY_KEYS = [...GEAR_STAT_KEYS, 'RATIO'] as const
export const STRATEGY_IDS = ['s1', 's2', 's3', 's4', 's5'] as const
export type StrategyStat = typeof STRATEGY_KEYS[number]
export interface BuildStrategy { id: string; name: string; base: 'tank' | 'dps' | 'heal' | 'solo' | 'custom'; weights: BuildWeights; minimums: BuildWeights; caps: BuildWeights }
const NAMES = ['Tank', 'DPS', 'Healer', 'Solo', 'Custom'] as const
const BASES = ['tank', 'dps', 'heal', 'solo', 'custom'] as const
export function defaultBuildStrategies(): BuildStrategy[] {
  return STRATEGY_IDS.map((id, i) => ({ id, name: NAMES[i], base: BASES[i], weights: {}, minimums: {}, caps: {} }))
}
function object(raw: unknown): raw is Record<string, unknown> { return raw !== null && typeof raw === 'object' && !Array.isArray(raw) }
function numbers(raw: unknown, max: number): BuildWeights {
  const out: BuildWeights = {}
  if (!object(raw)) return out
  for (const key of STRATEGY_KEYS) {
    const value = raw[key]
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max) out[key] = value
  }
  return out
}
function strategy(raw: unknown, fallback: BuildStrategy): BuildStrategy {
  if (!object(raw)) return fallback
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 60) : ''
  return { ...fallback, name: name || fallback.name,
    base: BASES.includes(raw.base as BuildStrategy['base']) ? raw.base as BuildStrategy['base'] : fallback.base,
    weights: numbers(raw.weights, 1000), minimums: numbers(raw.minimums, 1_000_000), caps: numbers(raw.caps, 1_000_000) }
}
export function normalizeBuildStrategies(raw: unknown): BuildStrategy[] {
  const entries: unknown[] = Array.isArray(raw) ? raw as unknown[] : []
  return defaultBuildStrategies().map((fallback) => strategy(entries.find((v) => object(v) && v.id === fallback.id), fallback))
}
function soloWeights(classes: readonly ClassAbbr[]): BuildWeights {
  const tank = profileWeights('tank', classes), dps = profileWeights('dps', classes), heal = profileWeights('heal', classes)
  const out: BuildWeights = {}
  for (const key of STRATEGY_KEYS) out[key] = (tank[key] ?? 0) * 0.5 + (dps[key] ?? 0) * 0.3 + (heal[key] ?? 0) * 0.2
  return out
}
export function strategyWeights(value: BuildStrategy, classes: readonly ClassAbbr[]): BuildWeights {
  let base: BuildWeights
  if (value.base === 'custom') base = { HP: 1, AC: 1 }
  else if (value.base === 'solo') base = soloWeights(classes)
  else base = profileWeights(value.base, classes)
  return { ...base, ...value.weights }
}
function stat(stats: GearStats, key: StrategyStat): number | undefined { return key === 'RATIO' ? gearRatio(stats) : stats[key] }
export function strategyItemScore(stats: GearStats, value: BuildStrategy, classes: readonly ClassAbbr[]): number {
  return strategyScorer(value, classes)(stats)
}
/** Prepare weights once for scoring a full catalog rather than once per item. */
export function strategyScorer(value: BuildStrategy, classes: readonly ClassAbbr[]): (stats: GearStats) => number {
  const weights = strategyWeights(value, classes)
  return (stats) => scoreWithWeights(stats, value, weights)
}
function scoreWithWeights(stats: GearStats, value: BuildStrategy, weights: BuildWeights): number {
  let total = 0
  for (const key of STRATEGY_KEYS) {
    const amount = stat(stats, key)
    if (amount === undefined) continue
    const cap = value.caps[key]
    total += (cap === undefined ? amount : Math.min(amount, cap)) * (weights[key] ?? 0)
  }
  return total
}
export function strategyAllows(row: GearRow, value: BuildStrategy): boolean {
  return STRATEGY_KEYS.every((key) => {
    const min = value.minimums[key]
    if (min === undefined || min === 0) return true
    const amount = stat(row.stats, key)
    return amount !== undefined && amount >= min
  })
}
