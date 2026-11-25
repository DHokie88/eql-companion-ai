import { crawlMarks, followLoggedLoc, routeTo } from '../../../../shared/worth'

export interface TrailSample {
  x: number
  y: number
  z: number
}

/** Heading from the last two logged positions, and a route that refuses a blocked cell. */
export function followTrail(
  samples: readonly TrailSample[],
  blocked: (x: number, y: number) => boolean
): { here: ReturnType<typeof followLoggedLoc>; route: { x: number; y: number }[] | null } {
  const here = followLoggedLoc(samples)
  if (!here || samples.length < 2) return { here, route: null }
  const prev = samples[samples.length - 2]
  return { here, route: routeTo({ x: prev.x, y: prev.y }, { x: here.x, y: here.y }, blocked) }
}

export function crawlList(names: readonly string[], killed: readonly string[]): { name: string; cleared: boolean }[] {
  return crawlMarks(names, killed)
}

interface SegmentBox {
  x1: number
  y1: number
  x2: number
  y2: number
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/** A map-file segment crosses the loc cell the route walker is standing on. */
function segmentHits(box: SegmentBox): boolean {
  let t0 = 0
  let t1 = 1
  const dx = box.x2 - box.x1
  const dy = box.y2 - box.y1
  const p = [-dx, dx, -dy, dy]
  const q = [box.x1 - box.minX, box.maxX - box.x1, box.y1 - box.minY, box.maxY - box.y1]
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false
      continue
    }
    const r = q[i] / p[i]
    if (p[i] < 0) {
      if (r > t1) return false
      if (r > t0) t0 = r
    } else {
      if (r < t0) return false
      if (r < t1) t1 = r
    }
  }
  return t0 <= t1
}

/**
 * Cells a map line blocks, in `/loc` space (`ew` = -mapX, `ns` = -mapY).
 * `coords` is the map file's `[x1,y1,z1,x2,y2,z2]` list.
 */
export function locBlocked(coords: ArrayLike<number> | null, count: number): (x: number, y: number) => boolean {
  if (!coords || count <= 0) return () => false
  return (x, y) => {
    const minX = x - 0.5
    const maxX = x + 0.5
    const minY = y - 0.5
    const maxY = y + 0.5
    for (let i = 0; i < count; i++) {
      const at = i * 6
      const x1 = -coords[at]
      const y1 = -coords[at + 1]
      const x2 = -coords[at + 3]
      const y2 = -coords[at + 4]
      if (segmentHits({ x1, y1, x2, y2, minX, maxX, minY, maxY })) return true
    }
    return false
  }
}

export interface TrailStep {
  samples: TrailSample[]
  loc: TrailSample
  blocked: (x: number, y: number) => boolean
  names: readonly string[]
  killed: readonly string[]
}

/**
 * Push a logged position. A route through a blocked cell is refused and the sample is dropped.
 * The first sample has no route to refuse. Crawl marks come back with the decision.
 */
export function stepTrail(step: TrailStep): { place: boolean; crawl: { name: string; cleared: boolean }[] } {
  const samples = step.samples
  samples.push(step.loc)
  const followed = followTrail(samples, step.blocked)
  const crawl = crawlList(step.names, step.killed)
  if (samples.length >= 2 && followed.route === null) {
    samples.pop()
    return { place: false, crawl }
  }
  if (samples.length > 12) samples.shift()
  const heading = followed.here?.headingDeg
  return { place: heading !== undefined && Number.isFinite(heading), crawl }
}

export function paneMobNames(mobs: readonly { name: string }[]): string[] {
  const names: string[] = []
  for (const mob of mobs) names.push(mob.name)
  return names
}

export function killedDisplays(mobs: Record<string, { count: number; display: string }> | null | undefined): string[] {
  if (!mobs) return []
  const names: string[] = []
  for (const key of Object.keys(mobs)) {
    const info = mobs[key]
    if (info && info.count > 0 && info.display) names.push(info.display)
  }
  return names
}

export function clearedNames(crawl: readonly { name: string; cleared: boolean }[]): string[] {
  const names: string[] = []
  for (const row of crawl) if (row.cleared) names.push(row.name)
  return names
}
