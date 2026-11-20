import { createHash } from 'node:crypto'
import type { ClientSpellRecord, SpellChangeCounts, SpellChangeKind, SpellFieldDifference } from '../../shared/spellLibrary'
import { INTERPRETED_SPELL_COLUMNS, clientSpellColumnIndex, clientSpellColumnShift } from '../../shared/clientSpellParser'

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}
export function identityHash(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex')
}
export function emptyCounts(): SpellChangeCounts {
  return { added: 0, changed: 0, removed: 0, interpreted: 0, rawOnly: 0 }
}
function interpretedFields(record: ClientSpellRecord): Record<string, unknown> {
  const { rawFields: _raw, layout: _layout, fields: _fields, ...interpreted } = record
  return interpreted
}
function changedKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .sort().filter((key) => a[key] !== b[key] && stableJson(a[key]) !== stableJson(b[key]))
}
function pushRaw(result: SpellFieldDifference[], field: string, before: string | null | undefined, after: string | null | undefined): void {
  if ((before ?? '') === (after ?? '')) return
  result.push({ field, before: before ?? null, after: after ?? null, kind: 'raw-only' })
}
function legacyRawDifferences(before: ClientSpellRecord, after: ClientSpellRecord, result: SpellFieldDifference[]): void {
  for (let i = 0; i < 173; i++) {
    if (INTERPRETED_SPELL_COLUMNS.has(i)) continue
    const oldIndex = clientSpellColumnIndex(before.layout, i)
    const newIndex = clientSpellColumnIndex(after.layout, i)
    if (before.rawFields[oldIndex] !== after.rawFields[newIndex]) result.push({
      field: `rawFields[${i}] (173-layout index)`, before: before.rawFields[oldIndex], after: after.rawFields[newIndex], kind: 'raw-only'
    })
  }
}
function wideRawDifferences(before: ClientSpellRecord, after: ClientSpellRecord, result: SpellFieldDifference[]): void {
  if (before.layout !== 190 || after.layout !== 190) return
  for (let i = 173; i <= 188; i++) {
    if (before.rawFields[i] === after.rawFields[i]) continue
    result.push({ field: `rawFields[${i}] (190-layout column)`, before: before.rawFields[i] ?? null, after: after.rawFields[i] ?? null, kind: 'raw-only' })
  }
}
function trailingRawDifferences(before: ClientSpellRecord, after: ClientSpellRecord, result: SpellFieldDifference[]): void {
  if (before.layout !== after.layout) return
  const end = Math.max(before.rawFields.length, after.rawFields.length)
  for (let i = before.layout; i < end; i++) pushRaw(result, `rawFields[${i}] (trailing column)`, before.rawFields[i], after.rawFields[i])
}
function rawDifferences(before: ClientSpellRecord, after: ClientSpellRecord): SpellFieldDifference[] {
  const result: SpellFieldDifference[] = []
  legacyRawDifferences(before, after, result)
  if (clientSpellColumnShift(before.layout) === 1 && clientSpellColumnShift(after.layout) === 1) {
    pushRaw(result, 'rawFields[74] (inserted column)', before.rawFields[74], after.rawFields[74])
  }
  wideRawDifferences(before, after, result)
  trailingRawDifferences(before, after, result)
  return result
}
function namedDifferences(before: ClientSpellRecord, after: ClientSpellRecord, parserChanged: boolean): SpellFieldDifference[] {
  return changedKeys(before.fields, after.fields).map((field) => {
    const kind = parserChanged ? 'parser-upgrade' : 'interpreted'
    return { field: `fields.${field}`, before: before.fields[field] ?? null, after: after.fields[field] ?? null, kind }
  })
}
export function spellDifferences(
  before: ClientSpellRecord | null,
  after: ClientSpellRecord | null,
  parserChanged = false
): SpellFieldDifference[] {
  if (!before || !after) {
    if (!before && !after) return []
    return [{ field: 'record', before, after, kind: before ? 'removed' : 'added' }]
  }
  const a = interpretedFields(before)
  const b = interpretedFields(after)
  const result: SpellFieldDifference[] = changedKeys(a, b).map((field) => ({
    field, before: a[field] ?? null, after: b[field] ?? null, kind: parserChanged ? 'parser-upgrade' : 'interpreted'
  }))
  if (before.layout !== after.layout) result.push({ field: 'layout', before: before.layout, after: after.layout, kind: 'format' })
  return [...result, ...namedDifferences(before, after, parserChanged), ...rawDifferences(before, after)]
}
export function changeKind(differences: SpellFieldDifference[]): SpellChangeKind {
  const kinds = differences.map((diff) => diff.kind)
  return ['added', 'removed', 'parser-upgrade', 'interpreted', 'format', 'raw-only']
    .find((kind) => kinds.includes(kind as SpellChangeKind)) as SpellChangeKind
}
export function countChanges(before: Iterable<ClientSpellRecord>, after: ClientSpellRecord[], parserChanged: boolean): SpellChangeCounts {
  const prior = new Map(Array.from(before, (record) => [record.id, record]))
  const counts = emptyCounts()
  for (const record of after) {
    const old = prior.get(record.id) ?? null
    prior.delete(record.id)
    if (!old) { counts.added++; continue }
    const diffs = spellDifferences(old, record, parserChanged)
    if (!diffs.length) continue
    counts.changed++
    if (diffs.some((diff) => ['interpreted', 'parser-upgrade'].includes(diff.kind))) counts.interpreted++
    else counts.rawOnly++
  }
  counts.removed = prior.size
  return counts
}
