// THE UPGRADE FINDER (EQ Zera): one row, against what is on your body, under one profile — and the
// zones that would sell you the ones that win.
//
// WHY A VERDICT IS CHEAP, AND WHY THAT IS THE WHOLE DESIGN. `itemScore` is per row and a set's
// score is the SUM over its cells (optimizer.ts), so "does this item improve my set" needs nothing
// but the row and the worn item in each cell the row could occupy. No re-optimisation, no second
// `bestBuild`: a Zone Loot table of 6,896 rows can ask this question once per row on a keystroke.
//
// An item may also replace either of the two slot-agnostic equipment cells.
//
// THREE REFUSALS, ALL OF THEM LAW 1:
//   * a cell whose worn item the index cannot score gets NO verdict. "+40 Chest" against an item
//     whose stats we do not hold is a number we made up.
//   * an item already worn in any cell gets no verdict as a new acquisition.
//   * a row nobody in this loadout can wear, or one the caller's filters exclude, gets none at all.
//
// AND NO RANKING BEYOND SUMMED GAIN. The mob catalog states who drops what and where, with no
// rarity and no drop rate (lib/itemSources.ts). So a farm plan orders zones by the gain they hold
// and by nothing else; "the best camp" is not a fact this data contains.

import type { ClassAbbr } from '../classCombo'
import type { GearRow } from '../planner/gear'
import { ANY_CELLS, cellsForSlot, type PlanSlotId } from '../planner/types'
import { itemScore, type BuildWeights } from './profiles'
import { hastePoints, wearable, type BuildSet, type CellUpgrade } from './optimizer'
import { estimatedManaGain, type ManaEstimate } from './manaEstimate'

/** What one row is worth in the best cell it could take, against what is already there. */
export interface UpgradeVerdict {
  cell: PlanSlotId
  delta: number
  score: number
  currentScore: number
  /** the cell is empty or its worn item is unknown to the index - the gain is the whole score */
  againstNothing: boolean
}

export interface UpgradeContext {
  classes: readonly ClassAbbr[]
  weights: BuildWeights
  worn: BuildSet
  /** cells whose worn item the index could not score (WornUnknown) - a verdict is never given there */
  unknownCells: ReadonlySet<PlanSlotId>
  wornKeys?: ReadonlySet<string>
  mana?: ManaEstimate
  excluded?: (row: GearRow) => boolean
}

/** One cell's answer, or null where this file refuses to speak. */
function cellVerdict(row: GearRow, cell: PlanSlotId, score: number, ctx: UpgradeContext): UpgradeVerdict | null {
  if (ctx.unknownCells.has(cell)) return null
  const current = ctx.worn.get(cell) ?? null
  if (current !== null && current.key === row.key) return null
  const currentScore = current === null ? 0 : itemScore(current.stats, ctx.weights)
  let otherHaste = 0
  for (const [otherCell, item] of ctx.worn) if (otherCell !== cell && item) otherHaste = Math.max(otherHaste, hastePoints(item, ctx.weights))
  const currentHaste = current ? hastePoints(current, ctx.weights) : 0
  const nextHaste = hastePoints(row, ctx.weights)
  const delta = score - nextHaste - (currentScore - currentHaste)
    + Math.max(otherHaste, nextHaste) - Math.max(otherHaste, currentHaste)
    + (ctx.mana ? estimatedManaGain(ctx.mana, current, row) : 0)
  if (delta <= 0) return null
  return { cell, delta, score, currentScore, againstNothing: current === null }
}

/**
 * Would this row improve the worn set, and where? The BEST cell it could take, or null.
 *
 * "Best" is the largest gain, which is also the honest one: a ring that beats your weaker ring by
 * 40 and your stronger by 5 is a 40-point upgrade, because that is the swap you would make.
 */
export function upgradeVerdict(row: GearRow, ctx: UpgradeContext): UpgradeVerdict | null {
  if (!wearable(row, ctx.classes)) return null
  if (ctx.excluded?.(row) === true) return null
  if (alreadyWorn(row, ctx)) return null
  const score = itemScore(row.stats, ctx.weights)
  const seen = new Set<PlanSlotId>()
  let best: UpgradeVerdict | null = null
  for (const cell of eligibleCells(row, ctx)) {
    if (seen.has(cell)) continue
    seen.add(cell)
    best = better(best, cellVerdict(row, cell, score, ctx))
  }
  return best
}

function alreadyWorn(row: GearRow, ctx: UpgradeContext): boolean {
  if (ctx.wornKeys?.has(row.key)) return true
  for (const item of ctx.worn.values()) if (item?.key === row.key) return true
  return false
}

function eligibleCells(row: GearRow, ctx: UpgradeContext): PlanSlotId[] {
  const cells: PlanSlotId[] = []
  for (const slot of row.slots) for (const cell of cellsForSlot(slot)) cells.push(cell)
  if (row.slots.length > 0) for (const cell of ANY_CELLS) if (ctx.worn.has(cell)) cells.push(cell)
  return cells
}

/** The larger gain of two verdicts; ties keep the first cell the item's own slot order reached. */
function better(a: UpgradeVerdict | null, b: UpgradeVerdict | null): UpgradeVerdict | null {
  if (a === null) return b
  if (b === null) return a
  return b.delta > a.delta ? b : a
}

// ---------------------------------------------------------------------------------------------
// WHERE TO FARM
// ---------------------------------------------------------------------------------------------

/**
 * A drop source, structurally. The real type is `renderer/src/lib/itemSources.ts ItemSource`, which
 * carries a page title and the level text as well; declaring the two fields this file reads keeps
 * `src/shared/` free of anything renderer-side, the way every other shared module is.
 */
export interface FarmSource {
  mob: string
  /** `[]` is the page stating no zone, which is an answer and lands under `NO_ZONE_STATED`. */
  zones: readonly string[]
}

export interface FarmItem {
  row: GearRow
  cell: PlanSlotId
  delta: number
  mobs: string[]
}

export interface FarmZone {
  zone: string
  totalDelta: number
  items: FarmItem[]
}

/** What a source with no stated zone is filed under. A heading, never a guess at a place. */
export const NO_ZONE_STATED = 'Zone not stated'

const DEFAULT_MAX_ZONES = 12

/** One upgrade option on its way into the plan. */
interface FarmPick {
  row: GearRow
  cell: PlanSlotId
  delta: number
}

type ZoneItems = Map<string, Map<string, FarmItem>>

/**
 * File one (item, zone, mob) fact. An item already in this zone GAINS THE MOB and keeps its gain:
 * three mobs dropping one sword in one zone is one sword's worth of reason to go there, and adding
 * the delta three times would rank a zone by how many pages mention the item.
 */
function fileMob(byZone: ZoneItems, zone: string, pick: FarmPick, mob: string): void {
  let items = byZone.get(zone)
  if (!items) {
    items = new Map<string, FarmItem>()
    byZone.set(zone, items)
  }
  const existing = items.get(pick.row.key)
  if (!existing) {
    items.set(pick.row.key, { row: pick.row, cell: pick.cell, delta: pick.delta, mobs: [mob] })
    return
  }
  // The same row can be an option in two cells (a ring in both fingers). The larger gain is the
  // reason to farm it, and it names the cell.
  if (pick.delta > existing.delta) {
    existing.delta = pick.delta
    existing.cell = pick.cell
  }
  if (!existing.mobs.includes(mob)) existing.mobs.push(mob)
}

/** Every zone this option's sources name. An item with NO sources reaches no zone at all. */
function filePick(byZone: ZoneItems, pick: FarmPick, sources: readonly FarmSource[]): void {
  for (const source of sources) {
    const zones = source.zones.length === 0 ? [NO_ZONE_STATED] : source.zones
    for (const zone of zones) fileMob(byZone, zone, pick, source.mob)
  }
}

/** Zones by the gain they hold, items within a zone by theirs. Ties are alphabetical, not arbitrary. */
function rankZones(byZone: ZoneItems, maxZones: number): FarmZone[] {
  const out: FarmZone[] = []
  for (const [zone, items] of byZone) {
    const list = [...items.values()]
    list.sort((a, b) => b.delta - a.delta || a.row.name.localeCompare(b.row.name))
    let totalDelta = 0
    for (const item of list) totalDelta += item.delta
    out.push({ zone, totalDelta, items: list })
  }
  out.sort((a, b) => b.totalDelta - a.totalDelta || a.zone.localeCompare(b.zone))
  return out.slice(0, maxZones)
}

/**
 * The Build tab's upgrade suggestions, grouped into places you could go and get them.
 *
 * `sources` is injected rather than imported because the mob-catalog inversion is a renderer
 * singleton and this module is node-tested with a hand-authored one.
 */
export function farmPlan(
  upgrades: readonly CellUpgrade[],
  sources: (key: string) => readonly FarmSource[],
  opts: { maxZones?: number } = {}
): FarmZone[] {
  const byZone: ZoneItems = new Map()
  for (const up of upgrades) {
    for (const option of up.options) {
      filePick(byZone, { row: option.row, cell: up.cell, delta: option.delta }, sources(option.row.key))
    }
  }
  return rankZones(byZone, opts.maxZones ?? DEFAULT_MAX_ZONES)
}
