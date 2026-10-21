import type { GearRow } from '../../../../shared/planner/gear'

export const BASE_PRIORITY_STATS = [
  { key: 'AC', label: 'AC' }, { key: 'HP', label: 'HP' },
  { key: 'MP', label: 'Mana' }, { key: 'HASTE', label: 'Haste' },
  { key: 'STR', label: 'STR' }, { key: 'STA', label: 'STA' },
  { key: 'INT', label: 'INT' }, { key: 'WIS', label: 'WIS' }, { key: 'DEX', label: 'DEX' },
  { key: 'SV_MAGIC', label: 'Magic' }, { key: 'SV_FIRE', label: 'Fire' }, { key: 'SV_COLD', label: 'Cold' }
] as const
export const EXTRA_PRIORITY_STATS = [
  { key: 'SV_POISON', label: 'Poison' }, { key: 'SV_DISEASE', label: 'Disease' },
  { key: 'CHA', label: 'CHA' }, { key: 'AGI', label: 'AGI' }
] as const
export const PRIORITY_STATS = [...BASE_PRIORITY_STATS, ...EXTRA_PRIORITY_STATS]
export const PRIORITY_LEVELS = [
  { level: 1, label: 'Off', weight: 0 },
  { level: 2, label: 'Low', weight: 0.5 },
  { level: 3, label: 'Normal', weight: 1 },
  { level: 4, label: 'High', weight: 2 },
  { level: 5, label: 'Top', weight: 3 }
] as const
export type PriorityKey = (typeof PRIORITY_STATS)[number]['key']
export type GearPriorities = Record<PriorityKey, number>
export const DEFAULT_PRIORITIES: GearPriorities = {
  AC: 3, HP: 3, MP: 3, HASTE: 3, STR: 3, STA: 3, INT: 3, WIS: 3, DEX: 3,
  SV_MAGIC: 3, SV_FIRE: 3, SV_COLD: 3, SV_POISON: 3, SV_DISEASE: 3, CHA: 3, AGI: 3
}

export function sanitizePriorities(raw: unknown): GearPriorities {
  const result = { ...DEFAULT_PRIORITIES }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return result
  for (const { key } of PRIORITY_STATS) {
    const level: unknown = (raw as Record<string, unknown>)[key]
    if (typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 5) result[key] = level
  }
  return result
}

export function sanitizePriorityExtras(raw: unknown): PriorityKey[] {
  if (!Array.isArray(raw)) return []
  return EXTRA_PRIORITY_STATS.filter(({ key }) => raw.includes(key)).map(({ key }) => key)
}

export function activePriorityStats(extras: readonly PriorityKey[]) {
  return [...BASE_PRIORITY_STATS, ...EXTRA_PRIORITY_STATS.filter(({ key }) => extras.includes(key))]
}

/** Normalize each individual stat over matching items, then weight it. Off never removes rows. */
export function scoreGear<T extends Pick<GearRow, 'stats'>>(rows: readonly T[], priorities: GearPriorities, extras: readonly PriorityKey[] = []): (T & { priorityScore: number })[] {
  const stats = activePriorityStats(extras)
  const vectors = rows.map((row) => stats.map(({ key }) => row.stats[key] ?? 0))
  const maxima = stats.map((_, index) => vectors.reduce((max, values) => Math.max(max, values[index]), 0))
  const weights: number[] = stats.map(({ key }) => PRIORITY_LEVELS.find((option) => option.level === priorities[key])?.weight ?? 1)
  const total = weights.reduce((sum, weight, index) => sum + (maxima[index] > 0 ? weight : 0), 0)
  return rows.map((row, index) => ({
    ...row,
    priorityScore: total === 0 ? 0 : 100 * weights.reduce((sum, weight, group) =>
      sum + (maxima[group] > 0 ? vectors[index][group] / maxima[group] * weight : 0), 0) / total
  }))
}
