import type { GearRow } from '../planner/gear'
import type { Scored } from './optimizer'

interface AssignmentState { u: number[]; v: number[]; match: number[]; previous: number[] }
function nextColumn({ cell, keys, scores, state, min, used, from }: { cell: number; keys: string[]; scores: Map<string, number>[]; state: AssignmentState; min: number[]; used: boolean[]; from: number }): [number, number] {
  let delta = Infinity, next = 0
  for (let j = 1; j < min.length; j += 1) {
    if (used[j]) continue
    const score = j <= keys.length ? scores[cell - 1].get(keys[j - 1]) : 0
    const cost = (score === undefined || !Number.isFinite(score) ? 1e15 : -score) - state.u[cell] - state.v[j]
    if (cost < min[j]) { min[j] = cost; state.previous[j] = from }
    if (min[j] < delta) { delta = min[j]; next = j }
  }
  return [next, delta]
}
function adjust(state: AssignmentState, min: number[], used: boolean[], delta: number): void {
  for (let j = 0; j < min.length; j += 1) {
    if (used[j]) { state.u[state.match[j]] += delta; state.v[j] -= delta } else min[j] -= delta
  }
}
function augment(state: AssignmentState, last: number): void {
  let col = last
  do {
    const next = state.previous[col]
    state.match[col] = state.match[next]
    col = next
  } while (col !== 0)
}

/** Maximum-weight one-item-per-cell assignment, with a free empty choice per cell. */
export function maximumAssignment(lists: readonly (readonly Scored[])[]): (GearRow | null)[] {
  const rows = new Map<string, GearRow>()
  const scores = lists.map((list) => {
    const map = new Map<string, number>()
    for (const { row, score } of list) {
      rows.set(row.key, row)
      map.set(row.key, score)
    }
    return map
  })
  const keys = [...rows.keys()]
  const n = lists.length
  const m = keys.length + n
  // Rectangular Hungarian algorithm: each row (cell) receives a distinct column (item or empty).
  const state: AssignmentState = { u: Array<number>(n + 1).fill(0), v: Array<number>(m + 1).fill(0),
    match: Array<number>(m + 1).fill(0), previous: Array<number>(m + 1).fill(0) }
  for (let i = 1; i <= n; i += 1) {
    state.match[0] = i
    let col = 0
    const min = Array<number>(m + 1).fill(Infinity)
    const used = Array<boolean>(m + 1).fill(false)
    do {
      used[col] = true
      const [next, delta] = nextColumn({ cell: state.match[col], keys, scores, state, min, used, from: col })
      adjust(state, min, used, delta)
      col = next
    } while (state.match[col] !== 0)
    augment(state, col)
  }
  const result: (GearRow | null)[] = Array<GearRow | null>(n).fill(null)
  for (let j = 1; j <= keys.length; j += 1) {
    if (state.match[j] !== 0 && scores[state.match[j] - 1].has(keys[j - 1])) result[state.match[j] - 1] = rows.get(keys[j - 1]) ?? null
  }
  return result
}
