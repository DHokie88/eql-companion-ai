import { crawlMarks, followLoggedLoc, routeTo } from '../../../../shared/worth'

/** Heading from the last two logged positions, and a route that refuses a blocked cell. */
export function followTrail(
  samples: readonly { x: number; y: number; z: number }[],
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
