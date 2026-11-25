// Player-facing rules added from the 2026-11-25 donor review.
// Pure functions. Electron and React call these; tests import them directly.

export interface AaCatalogEntry {
  id: string
  name: string
  maxRank: number
  costPerRank: number
}

/** Points to buy from the held rank up to the target, the shortfall after unspent points, and hours at the last-24h pace. */
export function aaPlan(input: {
  catalog: readonly AaCatalogEntry[]
  held: Readonly<Record<string, number>>
  targets: Readonly<Record<string, number>>
  unspent: number
  pointsLast24h: number
}): { cost: number; shortfall: number; etaHours: number | null } {
  let cost = 0
  for (const entry of input.catalog) {
    const held = clampRank(input.held[entry.id] ?? 0, entry.maxRank)
    const target = clampRank(input.targets[entry.id] ?? held, entry.maxRank)
    const ranks = Math.max(0, target - held)
    cost += ranks * entry.costPerRank
  }
  const shortfall = Math.max(0, cost - Math.max(0, input.unspent))
  const perHour = input.pointsLast24h / 24
  return { cost, shortfall, etaHours: perHour > 0 ? shortfall / perHour : null }
}

function clampRank(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(max, Math.max(0, Math.trunc(value)))
}

export interface RaceUnlock {
  race: string
  have: number
  need: number
  factions: readonly { name: string; fastest: string }[]
}

/** Closest to unlocking first. A finished race sorts after one that still has a gap. */
export function raceUnlockOrder(rows: readonly RaceUnlock[]): RaceUnlock[] {
  return [...rows].sort((a, b) => {
    const gapA = Math.max(0, a.need - a.have)
    const gapB = Math.max(0, b.need - b.have)
    if (gapA === 0 && gapB !== 0) return 1
    if (gapB === 0 && gapA !== 0) return -1
    if (gapA !== gapB) return gapA - gapB
    return a.race.localeCompare(b.race)
  })
}

export interface ProgressionEvent {
  kind: 'reincarnation' | 'level'
  ts: number
  level?: number
}

/** How long each re-level back to 50 took, from the reincarnation line to the next level-50 line. */
export function reincarnationClimbs(events: readonly ProgressionEvent[]): { started: number; finished: number; ms: number }[] {
  const ordered = [...events].sort((a, b) => a.ts - b.ts)
  const climbs: { started: number; finished: number; ms: number }[] = []
  let open: number | null = null
  for (const event of ordered) {
    if (event.kind === 'reincarnation') {
      open = event.ts
      continue
    }
    if (open !== null && event.kind === 'level' && (event.level ?? 0) >= 50 && event.ts >= open) {
      climbs.push({ started: open, finished: event.ts, ms: event.ts - open })
      open = null
    }
  }
  return climbs
}

/** Procs per minute from the classic 2.0 ppm model. Delay cancels, so haste is not an input. */
export function procsPerMinute(procRatePct: number): number {
  return 2 * (1 + procRatePct / 100)
}

/**
 * HP-equivalent of a damaging proc. `ratioWeight` is the profile's weapon-ratio price.
 * A profile that does not price weapon damage scores procs at 0.
 */
export function procScore(procDamage: number, procRatePct: number, ratioWeight: number): number {
  if (ratioWeight <= 0 || procDamage <= 0) return 0
  const dps = (procsPerMinute(procRatePct) * procDamage) / 60
  return (ratioWeight * dps) / 10
}

/** Endurance counts only for a class that spends it. */
export function enduranceScore(endurance: number, classSpendsEndurance: boolean): number {
  if (!classSpendsEndurance || !Number.isFinite(endurance)) return 0
  return endurance
}

/** A summoned temporary item is never a planned best-set pick. */
export function plannedSetAllows(temporary: boolean): boolean {
  return !temporary
}

export function ownTimeDps(total: number, ownSec: number): number {
  if (!(ownSec > 0) || !Number.isFinite(total)) return 0
  return total / ownSec
}

/** When to speak, in epoch ms, `leadSec` before the mob is due. */
export function respawnAlertAt(dueMs: number, leadSec: number): number {
  return dueMs - Math.max(0, leadSec) * 1000
}

/** Drag a split fraction. `minPx` is the smallest a pane may be. */
export function resizeFraction(current: number, deltaPx: number, trackPx: number, minPx: number): number {
  if (!(trackPx > 0)) return current
  const min = Math.min(0.49, minPx / trackPx)
  const next = current + deltaPx / trackPx
  return Math.min(1 - min, Math.max(min, next))
}

export interface GearPick {
  name: string
  slot: string
  score: number
  classes: readonly string[]
  temporary?: boolean
  owned?: boolean
}

/** Best item in each slot at the scores the caller already computed for one tier. */
export function bestInSlot(items: readonly GearPick[]): Map<string, GearPick> {
  const out = new Map<string, GearPick>()
  for (const item of items) {
    if (item.temporary) continue
    const prev = out.get(item.slot)
    if (!prev || item.score > prev.score) out.set(item.slot, item)
  }
  return out
}

/** Best owned, non-temporary item in each slot. */
export function valetPicks(items: readonly GearPick[]): Map<string, GearPick> {
  const out = new Map<string, GearPick>()
  for (const item of items) {
    if (item.temporary || item.owned === false) continue
    const prev = out.get(item.slot)
    if (!prev || item.score > prev.score) out.set(item.slot, item)
  }
  return out
}

/** Pet wears the best remaining item in each slot after the player's valet took its picks. */
export function petValetPicks(items: readonly GearPick[], player: ReadonlyMap<string, GearPick>): Map<string, GearPick> {
  const taken = new Set([...player.values()].map((item) => item.name))
  return valetPicks(items.filter((item) => !taken.has(item.name)))
}

/** Spare when every class that can wear it has a strictly better owned piece in the same slot. */
export function spareNames(items: readonly GearPick[]): string[] {
  const spare: string[] = []
  for (const item of items) {
    if (item.owned === false || item.classes.length === 0) continue
    const beatenForEveryClass = item.classes.every((cls) =>
      items.some((other) => other.name !== item.name && other.owned !== false && other.slot === item.slot && other.classes.includes(cls) && other.score > item.score)
    )
    if (beatenForEveryClass) spare.push(item.name)
  }
  return spare
}

export interface ExaltSocket {
  slot: string
  stone: string | null
  wants: readonly string[]
}

export function exaltAudit(sockets: readonly ExaltSocket[]): { empty: string[]; mismatched: string[] } {
  const empty: string[] = []
  const mismatched: string[] = []
  for (const socket of sockets) {
    if (socket.stone === null || socket.stone === '') {
      empty.push(socket.slot)
      continue
    }
    if (socket.wants.length > 0 && !socket.wants.includes(socket.stone)) mismatched.push(socket.slot)
  }
  return { empty, mismatched }
}

/** Gain times the hours of play a replacement would take. Higher is the better mote. */
export function voidMoteRank(items: readonly { name: string; gain: number; hoursToReplace: number }[]): { name: string; score: number }[] {
  return items
    .map((item) => ({ name: item.name, score: item.gain * item.hoursToReplace }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}

export function gearProgression(zones: readonly { name: string; minLevel: number; maxLevel: number; role: string }[], level: number, role: string): string[] {
  return zones
    .filter((zone) => zone.role === role && level >= zone.minLevel && level <= zone.maxLevel)
    .sort((a, b) => a.minLevel - b.minLevel || a.name.localeCompare(b.name))
    .map((zone) => zone.name)
}

export function spellLoadout(spells: readonly { name: string; stat: string; amount: number; pet: boolean }[], stat: string): { yours: string | null; pet: string | null } {
  const yours = bestSpell(spells.filter((spell) => !spell.pet && spell.stat === stat))
  const pet = bestSpell(spells.filter((spell) => spell.pet && spell.stat === stat))
  return { yours, pet }
}

function bestSpell(spells: readonly { name: string; amount: number }[]): string | null {
  let best: { name: string; amount: number } | null = null
  for (const spell of spells) {
    if (!best || spell.amount > best.amount) best = spell
  }
  return best?.name ?? null
}

/** The spell whose next mote buys the largest stated gain. */
export function nextMote(spells: readonly { name: string; moteGain: number }[]): string | null {
  return bestSpell(spells.map((spell) => ({ name: spell.name, amount: spell.moteGain })))
}

export function wikiGaps(seen: readonly string[], known: ReadonlySet<string> | readonly string[]): string[] {
  const have = known instanceof Set ? known : new Set([...known].map((name) => name.toLowerCase()))
  return seen.filter((name) => !have.has(name.toLowerCase()))
}

export function searchAchievements(rows: readonly { group: string; name: string }[], query: string): { group: string; name: string }[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...rows]
  return rows.filter((row) => `${row.group} ${row.name}`.toLowerCase().includes(needle))
}

export function unlockProgress(lines: readonly { family: string; label: string; have: number; need: number }[]): { family: string; label: string; remaining: number }[] {
  return lines
    .map((line) => ({ family: line.family, label: line.label, remaining: Math.max(0, line.need - line.have) }))
    .sort((a, b) => a.remaining - b.remaining || a.label.localeCompare(b.label))
}

export function skillRows(events: readonly { skill: string; level: number; ts: number }[]): { skill: string; level: number; raises: number }[] {
  const bySkill = new Map<string, { level: number; ts: number; raises: number }>()
  for (const event of [...events].sort((a, b) => a.ts - b.ts)) {
    const prev = bySkill.get(event.skill)
    if (!prev) {
      bySkill.set(event.skill, { level: event.level, ts: event.ts, raises: 1 })
      continue
    }
    if (event.level > prev.level) bySkill.set(event.skill, { level: event.level, ts: event.ts, raises: prev.raises + 1 })
  }
  return [...bySkill.entries()].map(([skill, row]) => ({ skill, level: row.level, raises: row.raises }))
}

export function factionStandings(rows: readonly { name: string; base: number; adjusted: number }[]): { name: string; base: number; adjusted: number; delta: number }[] {
  return rows.map((row) => ({ ...row, delta: row.adjusted - row.base })).sort((a, b) => a.name.localeCompare(b.name))
}

export function lootTags(flags: { tradeskill?: boolean; quest?: boolean; noDrop?: boolean }): string[] {
  const tags: string[] = []
  if (flags.quest) tags.push('Quest')
  if (flags.tradeskill) tags.push('Tradeskill')
  if (flags.noDrop) tags.push('No Drop')
  return tags
}

export function canMakeRecipe(recipe: { skill: string; trivial: number }, skills: Readonly<Record<string, number>>, ingredientsHeld: boolean): boolean {
  const level = skills[recipe.skill] ?? 0
  return ingredientsHeld && level >= recipe.trivial
}

export function macroSend(body: string, confirmed: boolean): { written: boolean; body: string } {
  return { written: confirmed && body.length > 0, body }
}

/** Bone name. Exact `<actor><attach>_DAG` wins over a suffix match. */
export function hangPoint(actor: string, attach: string): string {
  return `${actor.replace(/_ACTORDEF$/, '')}${attach}_DAG`
}

export function followLoggedLoc(samples: readonly { x: number; y: number; z: number }[]): { x: number; y: number; z: number; headingDeg: number } | null {
  const last = samples[samples.length - 1]
  if (!last) return null
  const prev = samples.length > 1 ? samples[samples.length - 2] : last
  const headingDeg = (Math.atan2(last.y - prev.y, last.x - prev.x) * 180) / Math.PI
  return { x: last.x, y: last.y, z: last.z, headingDeg }
}

export function routeTo(from: { x: number; y: number }, to: { x: number; y: number }, blocked: (x: number, y: number) => boolean): { x: number; y: number }[] | null {
  let x = Math.round(from.x)
  let y = Math.round(from.y)
  const x1 = Math.round(to.x)
  const y1 = Math.round(to.y)
  const dx = Math.abs(x1 - x)
  const dy = Math.abs(y1 - y)
  const sx = x < x1 ? 1 : -1
  const sy = y < y1 ? 1 : -1
  let err = dx - dy
  for (;;) {
    if (blocked(x, y)) return null
    if (x === x1 && y === y1) return [from, to]
    const doubled = 2 * err
    if (doubled > -dy) { err -= dy; x += sx }
    if (doubled < dx) { err += dx; y += sy }
  }
}

export function crawlMarks(names: readonly string[], killed: readonly string[]): { name: string; cleared: boolean }[] {
  const dead = new Set(killed.map((name) => name.toLowerCase()))
  return names.map((name) => ({ name, cleared: dead.has(name.toLowerCase()) }))
}

/** Examine-window lines such as `AC: 12` or `SV Void: 3`. */
export function parseExamine(text: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([^:]+):\s*([+-]?\d+(?:\.\d+)?)\s*$/.exec(line)
    if (!match) continue
    out[match[1].trim()] = Number(match[2])
  }
  return out
}

export function wikiContribution(input: { title: string; fact: string; confirmed: boolean }): { status: 'draft' | 'ready'; body: string } {
  const body = `== ${input.title} ==\n${input.fact.trim()}`
  return { status: input.confirmed && input.fact.trim().length > 0 ? 'ready' : 'draft', body }
}

export function lootUpload(count: number, signedIn: boolean): { send: boolean; count: number } {
  return { send: signedIn && count > 0, count: Math.max(0, count) }
}

export interface ArchivedFight {
  id: string
  name: string
  zone?: string
  startTs: number
}

/** Empty query is no hits. Otherwise name and zone are one haystack; newer start time breaks ties. */
export function searchArchivedFights(rows: readonly ArchivedFight[], query: string): ArchivedFight[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  return rows
    .filter((row) => `${row.name} ${row.zone ?? ''}`.toLowerCase().includes(needle))
    .sort((a, b) => b.startTs - a.startTs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Read sealed history onto the live snapshot. The live log's file name is returned unchanged. */
export function readArchivedHistory<T extends { count: number }>(live: T, sealed: readonly T[], enabled: boolean, logName: string): { value: T; logName: string } {
  if (!enabled || sealed.length === 0) return { value: live, logName }
  const count = sealed.reduce((sum, row) => sum + row.count, live.count)
  return { value: { ...live, count }, logName }
}

const SPELL_TABLE_NAME = /^spells_(.+)\.txt$/i

/** `spells_us.txt` when present, otherwise the first other `spells_<suffix>.txt` in lower-case order. */
export function pickSpellTable(names: readonly string[]): string | null {
  const tables = names.filter((name) => {
    const match = SPELL_TABLE_NAME.exec(name)
    return match !== null && !/_str$/i.test(match[1])
  })
  const us = tables.find((name) => name.toLowerCase() === 'spells_us.txt')
  if (us !== undefined) return us
  return [...tables].sort((a, b) => {
    const la = a.toLowerCase()
    const lb = b.toLowerCase()
    if (la !== lb) return la < lb ? -1 : 1
    return a < b ? -1 : a > b ? 1 : 0
  })[0] ?? null
}

export function companionSpellFile(table: string, kind: 'str' | 'dbstr'): string {
  const suffix = /^spells_(.+)\.txt$/i.exec(table)?.[1] ?? 'us'
  if (kind === 'str') return `spells_${suffix}_str.txt`
  return `dbstr_${suffix}.txt`
}
