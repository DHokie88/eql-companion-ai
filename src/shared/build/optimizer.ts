// THE BUILD OPTIMIZER (EQ Zera, 2026-09-06): candidates per slot, the best reachable set, and the
// upgrades from here to there — pure functions over the gear index rows the Gear tab already has.
//
// One row is scored once per profile (`itemScore`); a set's score is the sum over its cells. The
// reference set uses a distinct-item assignment and a haste-aware improvement. It remains an
// estimate: two-handed weapons and every possible haste-dependent rearrangement are not modeled.
//
// LOOPS, NOT `.filter`/`.sort` OVER ROWS: ruling 4 (eslint.domainMunging.mjs). The candidate list
// is sorted as `Scored` records, which is what a score is.

import type { ClassAbbr } from '../classCombo'
import type { GearRow } from '../planner/gear'
import { equipSlotOf, type PlanSlotId } from '../planner/types'
import { itemScore, type BuildWeights } from './profiles'
import { maximumAssignment } from './assignment'
import { estimatedManaGain, type ManaEstimate } from './manaEstimate'

export interface BuildContext {
  score?: (row: GearRow) => number
  /** Haste's weighted contribution, including any strategy cap. */
  hasteScore?: (row: GearRow) => number
  mana?: ManaEstimate
  classes: readonly ClassAbbr[]
  weights: BuildWeights
  /** rows the current filters exclude (out of era, not owned, …) */
  excluded?: (row: GearRow) => boolean
  /** how many upgrade options `upgradesFor` lists per cell (default 3) */
  perCell?: number
  /** Items actually worn before any hypothetical plan swaps. */
  wornKeys?: ReadonlySet<string>
  /** A named item whose stats are unknown cannot be treated as an empty cell. */
  unknownCells?: ReadonlySet<PlanSlotId>
}

const DEFAULT_PER_CELL = 3

export interface Scored {
  row: GearRow
  score: number
}

/** A row a member of this loadout can wear: a stated class list that names none of ours excludes it. */
export function wearable(row: GearRow, classes: readonly ClassAbbr[]): boolean {
  if (row.classes.length === 0 || classes.length === 0) return true
  return row.classes.some((c) => classes.includes(c))
}

/** Every row that fits `cell` under the context, best first. */
export function candidatesForCell(rows: readonly GearRow[], cell: PlanSlotId, ctx: BuildContext): Scored[] {
  const slot = equipSlotOf(cell)
  const out: Scored[] = []
  for (const row of rows) {
    if (slot !== null && !row.slots.includes(slot)) continue
    if (slot === null && row.slots.length === 0) continue
    if (!wearable(row, ctx.classes)) continue
    if (ctx.excluded?.(row)) continue
    out.push({ row, score: ctx.score ? ctx.score(row) : itemScore(row.stats, ctx.weights) })
  }
  out.sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name))
  return out
}

export type BuildSet = ReadonlyMap<PlanSlotId, GearRow | null>

/** The set's score under the weights: the sum over its filled cells. */
export function hastePoints(row: GearRow, weights: BuildWeights, hasteScore?: (row: GearRow) => number): number {
  return Math.max(0, hasteScore ? hasteScore(row) : (row.stats.HASTE ?? 0) * (weights.HASTE ?? 0))
}

export function buildScore(set: BuildSet, weights: BuildWeights, score?: (row: GearRow) => number, hasteScore?: (row: GearRow) => number): number {
  let total = 0
  let bestHaste = 0
  for (const row of set.values()) if (row) {
    const haste = hastePoints(row, weights, hasteScore)
    total += (score ? score(row) : itemScore(row.stats, weights)) - haste
    bestHaste = Math.max(bestHaste, haste)
  }
  return total + bestHaste
}

function otherHasteScore(set: BuildSet, cell: PlanSlotId, ctx: BuildContext): number {
  let best = 0
  for (const [otherCell, row] of set) if (otherCell !== cell && row) best = Math.max(best, hastePoints(row, ctx.weights, ctx.hasteScore))
  return best
}

/** Change to the whole set when one cell is replaced. */
export function replacementGain(candidate: GearRow, current: GearRow | null, otherHaste: number, ctx: BuildContext): number {
  const score = ctx.score ?? ((row: GearRow) => itemScore(row.stats, ctx.weights))
  const newHaste = hastePoints(candidate, ctx.weights, ctx.hasteScore)
  const oldHaste = current ? hastePoints(current, ctx.weights, ctx.hasteScore) : 0
  return score(candidate) - newHaste - (current ? score(current) - oldHaste : 0)
    + Math.max(otherHaste, newHaste) - Math.max(otherHaste, oldHaste)
    + (ctx.mana ? estimatedManaGain(ctx.mana, current, candidate) : 0)
}

function improveAssignment(out: Map<PlanSlotId, GearRow | null>, cells: readonly PlanSlotId[], rows: readonly GearRow[], ctx: BuildContext): void {
  let bestGain = 0
  let replacement: { cell: PlanSlotId; row: GearRow } | undefined
  const taken = new Set<string>()
  for (const row of out.values()) if (row) taken.add(row.key)
  for (const cell of cells) {
    const current = out.get(cell) ?? null
    const otherHaste = otherHasteScore(out, cell, ctx)
    for (const candidate of candidatesForCell(rows, cell, ctx)) {
      if (taken.has(candidate.row.key)) continue
      const gain = replacementGain(candidate.row, current, otherHaste, ctx)
      if (gain > bestGain) { bestGain = gain; replacement = { cell, row: candidate.row } }
    }
  }
  if (replacement) out.set(replacement.cell, replacement.row)
}

/**
 * An estimated strong set with distinct items and at most one haste contribution.
 */
export function bestBuild(rows: readonly GearRow[], cells: readonly PlanSlotId[], ctx: BuildContext): Map<PlanSlotId, GearRow | null> {
  const withoutHaste = { ...ctx, score: (row: GearRow) =>
    (ctx.score ? ctx.score(row) : itemScore(row.stats, ctx.weights)) - hastePoints(row, ctx.weights, ctx.hasteScore) }
  const lists = cells.map((cell) => candidatesForCell(rows, cell, withoutHaste).slice(0, cells.length))
  const picks = maximumAssignment(lists)
  const out = new Map<PlanSlotId, GearRow | null>(cells.map((cell, i) => [cell, picks[i] ?? null]))
  // Improve the additive assignment by the strongest single haste-aware replacement.
  improveAssignment(out, cells, rows, ctx)
  return out
}

export interface CellUpgrade {
  cell: PlanSlotId
  current: GearRow | null
  currentScore: number
  /** the candidates that beat what is worn, best first, each with its gain */
  options: (Scored & { delta: number; mana?: { raw: number; derived: number; weight: number } })[]
}

function manaBreakdown(mana: ManaEstimate, current: GearRow | null, candidate: GearRow): NonNullable<CellUpgrade['options'][number]['mana']> {
  return { raw: (candidate.stats.MP ?? 0) - (current?.stats.MP ?? 0),
    derived: estimatedManaGain({ ...mana, manaWeight: 1 }, current, candidate), weight: mana.manaWeight }
}

function upgradesForCell({ rows, set, cell, ctx, worn, perCell }: { rows: readonly GearRow[]; set: BuildSet; cell: PlanSlotId; ctx: BuildContext; worn: ReadonlySet<string>; perCell: number }): CellUpgrade {
  const current = set.get(cell) ?? null
  const currentScore = current ? (ctx.score ? ctx.score(current) : itemScore(current.stats, ctx.weights)) : 0
  const options: CellUpgrade['options'] = []
  if (ctx.unknownCells?.has(cell)) return { cell, current, currentScore, options }
  const otherHaste = otherHasteScore(set, cell, ctx)
  for (const c of candidatesForCell(rows, cell, ctx)) {
    if (worn.has(c.row.key)) continue
    const delta = replacementGain(c.row, current, otherHaste, ctx)
    if (delta > 0) {
      const mana = ctx.mana ? manaBreakdown(ctx.mana, current, c.row) : undefined
      options.push({ ...c, delta, ...(mana ? { mana } : {}) })
    }
  }
  options.sort((a, b) => b.delta - a.delta || a.row.name.localeCompare(b.row.name))
  return { cell, current, currentScore, options: options.slice(0, perCell) }
}

/** For every cell, what would improve it — the candidates that score above what is worn there. */
export function upgradesFor(rows: readonly GearRow[], set: BuildSet, cells: readonly PlanSlotId[], ctx: BuildContext): CellUpgrade[] {
  const perCell = ctx.perCell ?? DEFAULT_PER_CELL
  const worn = new Set<string>()
  for (const key of ctx.wornKeys ?? []) worn.add(key)
  for (const row of set.values()) if (row) worn.add(row.key)
  return cells.map((cell) => upgradesForCell({ rows, set, cell, ctx, worn, perCell }))
}

/** Keep the best options per slot and put the strongest slot improvements first. */
export function groupUpgrades(upgrades: readonly CellUpgrade[], perCell = 3): CellUpgrade[] {
  const groups: CellUpgrade[] = []
  for (const up of upgrades) {
    const options = up.options.slice(0, perCell)
    if (options.length > 0) groups.push({ ...up, options })
  }
  groups.sort((a, b) => b.options[0].delta - a.options[0].delta || a.cell.localeCompare(b.cell))
  return groups
}

/** Rank distinct items by their greatest single-slot gain across the entire set. */
export function rankUpgrades(upgrades: readonly CellUpgrade[], limit = 50): CellUpgrade[] {
  const best = new Map<string, CellUpgrade>()
  for (const up of upgrades) for (const option of up.options) {
    const previous = best.get(option.row.key)
    if (!previous || option.delta > previous.options[0].delta) best.set(option.row.key, { ...up, options: [option] })
  }
  return [...best.values()].sort((a, b) => b.options[0].delta - a.options[0].delta
    || a.options[0].row.name.localeCompare(b.options[0].row.name)).slice(0, limit)
}
