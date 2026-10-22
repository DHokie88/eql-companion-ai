import { linesForClass, type SpellLine } from '../data/spellLineLookup'
import { bestSpellLines, type SpellLineCandidate } from '../../shared/clientSpellLines'
import { compareSpellValues, spellBrowseSortValue } from '../../shared/clientSpellBrowse'
import { SPELL_CLASSES, type ClientSpellRecord, type SpellClass, type SpellSummary } from '../../shared/spellLibrary'
import type { spellSearchOptions } from './browseQuery'

type Options = ReturnType<typeof spellSearchOptions>
interface Membership { key: string; reason: string; tier?: number }
interface LabelGroup { membership: Membership; rows: SpellSummary[]; tiers: Set<number> }
const nameKey = (name: string): string => name.trim().toLowerCase().replace(/[`\u2018\u2019]/g, "'").replace(/\s+/g, ' ')

// Reuse the imported companion ladders. Whole names preserve genuine Rune I-V
// spell names; punctuation normalization joins client Al`Kabor to wiki Al'Kabor.
function replacementIndex(code: SpellClass) {
  const names = new Map<string, { line: SpellLine; tier: number }>()
  for (const line of linesForClass(code)) {
    if (!line.ladder) continue
    for (const member of line.members) {
      const key = nameKey(member.name)
      if (!names.has(key)) names.set(key, { line, tier: member.level })
    }
  }
  return names
}
const REPLACEMENTS = new Map(SPELL_CLASSES.map((code) => [code, replacementIndex(code)]))

function rawInteger(record: ClientSpellRecord, index: number): number | null {
  const raw = record.rawFields[index + (record.layout === 174 ? 1 : 0)]?.trim()
  if (!raw || !/^\d+$/.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) ? value : null
}

/** Read the captured timer_id, not the recast duration. The optional column at
 * index 74 shifts both timer_id and the following discipline flag by one.
 * Source rows remain unchanged, including snapshots imported by parser v1.
 */
export function capturedSpellTimer(record: ClientSpellRecord): string | null {
  if (record.rawFields.length !== record.layout) return null
  const id = rawInteger(record, 97), flag = rawInteger(record, 98)
  if (id === null || id === 0 || flag === null) return null
  return `${flag > 0 ? 'discipline' : 'spell'}:${id}`
}

function eligibleClasses(record: ClientSpellRecord, options: Options) {
  const ceiling = options.maxLevel ?? (options.allLevels || options.allSpells ? undefined : options.level)
  return record.classes.filter((entry) => (!options.classes.length || options.classes.includes(entry.code))
    && (options.minLevel === undefined || entry.level >= options.minLevel)
    && (ceiling === undefined || entry.level <= ceiling))
}
function memberships(record: ClientSpellRecord, options: Options): Membership[] {
  const classes = eligibleClasses(record, options)
  if (!classes.length) return []
  const result: Membership[] = []
  for (const entry of classes) {
    const found = REPLACEMENTS.get(entry.code)?.get(nameKey(record.name))
    if (!found) continue
    result.push({ key: `replacement:${entry.code}:${found.line.id}:${record.target}:${Number(record.beneficial)}`,
      tier: found.tier, reason: `${entry.code} replacement line: ${found.line.name}.` })
  }
  const timer = capturedSpellTimer(record)
  if (timer) result.push({ key: `timer:${timer}`, reason: `Spells share recast timer ${timer.split(':')[1]}${timer.startsWith('discipline:') ? ' (discipline)' : ''}.` })
  return result
}

function statChoiceOrder(rows: SpellSummary[], candidates: ReadonlyMap<number, SpellLineCandidate>) {
  const key = candidates.get(rows[0].id)?.key
  if (!key || key.startsWith('dot:') || !rows.every((row) => candidates.get(row.id)?.key === key)) return null
  return (a: SpellSummary, b: SpellSummary): number => {
    const ca = candidates.get(a.id), cb = candidates.get(b.id)
    if (!ca || !cb) return a.id - b.id
    return cb.value - ca.value || cb.duration - ca.duration || a.mana - b.mana || a.id - b.id
  }
}
function choiceMetric(options: Options): 'amount' | 'efficiency' | 'rate' {
  return options.sortBy === 'efficiency' || options.sortBy === 'rate' ? options.sortBy : 'amount'
}
function compareChoices(a: SpellSummary, b: SpellSummary, options: Options): number {
  const metric = choiceMetric(options)
  // The best choice stays strongest even when the table is sorted ascending.
  return compareSpellValues(spellBrowseSortValue(a, metric, options.selected),
    spellBrowseSortValue(b, metric, options.selected), 'desc')
    || (b.learnedLevel ?? 0) - (a.learnedLevel ?? 0) || a.mana - b.mana || a.id - b.id
}

/** Complete eligible matches only. Union explicit replacement/timer memberships
 * so a family crossing a shared cooldown cannot appear in two top-level groups.
 * Same-level replacement branches and oversized groups remain visible.
 */
function collectLabels(rows: SpellSummary[], records: ReadonlyMap<number, ClientSpellRecord>, options: Options): LabelGroup[] {
  const labels = new Map<string, LabelGroup>()
  for (const row of rows) {
    const record = records.get(row.id)
    if (!record) continue
    for (const membership of memberships(record, options)) {
      const group = labels.get(membership.key) ?? { membership, rows: [], tiers: new Set<number>() }
      group.rows.push(row)
      if (membership.tier !== undefined) group.tiers.add(membership.tier)
      labels.set(membership.key, group)
    }
  }
  return [...labels.values()].filter((group) => group.rows.length > 1 && group.rows.length <= 32
    && (group.membership.tier === undefined || group.tiers.size === group.rows.length))
}

function connectedChoices(rows: SpellSummary[], verified: LabelGroup[]) {
  const parents = new Map<number, number>(rows.map((row) => [row.id, row.id]))
  const find = (id: number): number => {
    const parent = parents.get(id) ?? id
    if (parent === id) return id
    const root = find(parent); parents.set(id, root); return root
  }
  for (const group of verified) for (const row of group.rows.slice(1)) parents.set(find(row.id), find(group.rows[0].id))
  const buckets = new Map<number, SpellSummary[]>()
  for (const row of rows) {
    const root = find(row.id), bucket = buckets.get(root) ?? []
    bucket.push(row); buckets.set(root, bucket)
  }
  return { buckets, find }
}

function choiceReason(best: SpellSummary, options: Options, statGroup: boolean): string {
  if (statGroup) return 'Strongest stat effect is shown first, then duration and mana.'
  return metricReason(best.beneficial, options)
}
function metricReason(beneficial: boolean, options: Options): string {
  const amount = beneficial ? 'healing' : 'damage', metric = choiceMetric(options)
  const label = metric === 'efficiency' ? `${amount} per mana` : metric === 'rate' ? `${amount} per second` : amount
  return `Best ${label} at the selected level, target count and modifiers is shown first.`
}

export function bestCatalogSpellLines(rows: SpellSummary[], records: ReadonlyMap<number, ClientSpellRecord>, candidates: ReadonlyMap<number, SpellLineCandidate>, options: Options): SpellSummary[] {
  const verified = collectLabels(rows, records, options), { buckets, find } = connectedChoices(rows, verified)
  const fallback: SpellSummary[] = [], output: SpellSummary[] = []
  for (const [root, bucket] of buckets) {
    if (bucket.length < 2 || bucket.length > 32) { fallback.push(...bucket); continue }
    const statOrder = statChoiceOrder(bucket, candidates)
    bucket.sort(statOrder ?? ((a, b) => compareChoices(a, b, options)))
    const evidence = verified.filter((group) => find(group.rows[0].id) === root)
    const [best, ...alternatives] = bucket
    output.push({ ...best, line: { key: evidence.map((group) => group.membership.key).sort().join('|'),
      reason: `${evidence.map((group) => group.membership.reason).join(' ')} ${choiceReason(best, options, statOrder !== null)}`, alternatives } })
  }
  return [...output, ...bestSpellLines(fallback, candidates, {
    compare: (a, b) => compareChoices(a, b, options),
    reason: metricReason(false, options)
  })]
}
