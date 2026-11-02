import type { GearRow } from '../planner/gear'
import type { PlanSlotId } from '../planner/types'
import { weaponTypeOf } from '../planner/weaponType'
import { bestBuild, buildScore, type BuildContext, type BuildSet } from './optimizer'
import { estimatedManaGain, gearManaScore, type ManaEstimate } from './manaEstimate'
import { itemScore } from './profiles'

/** One or more real or hypothetical copies at the same tier. */
export interface PlanCandidate { row: GearRow; tier: number; count: number }
export interface PlannedItem { row: GearRow; tier: number }
export type LoadedPlan = Map<PlanSlotId, PlannedItem | null>

function twoHanded(row: GearRow): boolean {
  const type = weaponTypeOf(row.skill)
  return type === '2HS' || type === '2HB' || type === '2HP'
}

/** Expand copies with internal identities, keeping lore items limited to one. */
function expandCandidates(candidates: readonly PlanCandidate[], value: (row: GearRow) => number): { rows: GearRow[]; originals: Map<string, PlannedItem> } {
  const rows: GearRow[] = []
  const originals = new Map<string, PlannedItem>()
  const loreSeen = new Set<string>()
  const sorted = [...candidates].sort((a, b) => value(b.row) - value(a.row) || b.tier - a.tier)
  for (const candidate of sorted) {
    const lore = candidate.row.flags.some((flag) => /\blore\b/i.test(flag))
    if (lore && loreSeen.has(candidate.row.key)) continue
    if (lore) loreSeen.add(candidate.row.key)
    const count = Math.min(lore ? 1 : 4, Math.max(0, candidate.count))
    for (let i = 0; i < count; i += 1) {
      const key = `plan-copy-${String(rows.length)}`
      rows.push({ ...candidate.row, key })
      originals.set(key, { row: candidate.row, tier: candidate.tier })
    }
  }
  return { rows, originals }
}

function evaluatedSet(base: BuildSet, picked: BuildSet, cells: readonly PlanSlotId[], clearSecondary: boolean): Map<PlanSlotId, GearRow | null> {
  const result = new Map(base)
  for (const cell of cells) result.set(cell, picked.get(cell) ?? null)
  if (clearSecondary) result.set('SECONDARY', null)
  return result
}

/** Estimated full-set assignment. Retains locked unknown cells and respects two-handed weapons. */
export function estimatedPlan({ candidates, cells, worn, locked, ctx, mana }: {
  candidates: readonly PlanCandidate[]; cells: readonly PlanSlotId[]; worn: BuildSet;
  locked: ReadonlySet<PlanSlotId>; ctx: BuildContext; mana: ManaEstimate
}): LoadedPlan {
  const score = ctx.score ?? ((row: GearRow) => itemScore(row.stats, ctx.weights))
  const { rows, originals } = expandCandidates(candidates, (row) => score(row) + estimatedManaGain(mana, null, row))
  const available = cells.filter((cell) => !locked.has(cell))
  const linear = new Map<string, number>()
  for (const row of rows) linear.set(row.key, score(row) + estimatedManaGain(mana, null, row))
  const assignmentCtx: BuildContext = { ...ctx, mana: undefined, excluded: undefined,
    score: (row) => linear.get(row.key) ?? 0,
    allowsCell: (row, cell) => cell !== 'PRIMARY' || !twoHanded(row) }
  const normal = bestBuild(rows, available, assignmentCtx)
  let chosen = evaluatedSet(worn, normal, available, false)
  if (available.includes('PRIMARY') && available.includes('SECONDARY')) {
    const withoutSecondary = available.filter((cell) => cell !== 'SECONDARY')
    const twoHand = bestBuild(rows, withoutSecondary, { ...assignmentCtx, allowsCell: undefined })
    const alternate = evaluatedSet(worn, twoHand, withoutSecondary, true)
    const value = (set: BuildSet): number => buildScore(set, ctx.weights, ctx.score, ctx.hasteScore) + gearManaScore(mana, worn.values(), set.values())
    if (value(alternate) > value(chosen)) chosen = alternate
  }
  const result: LoadedPlan = new Map()
  for (const cell of available) {
    const row = chosen.get(cell)
    result.set(cell, row ? originals.get(row.key) ?? null : null)
  }
  return result
}
