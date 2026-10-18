import { createHash } from 'node:crypto'
import type { ClientSpellRecord, SpellChangeCounts, SpellChangeKind, SpellFieldDifference } from '../../shared/spellLibrary'
import { INTERPRETED_SPELL_COLUMNS } from '../../shared/clientSpellParser'

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
    .sort().filter((key) => stableJson(a[key]) !== stableJson(b[key]))
}
function rawDifferences(before: ClientSpellRecord, after: ClientSpellRecord): SpellFieldDifference[] {
  const result: SpellFieldDifference[] = []
  for (let i = 0; i < 173; i++) {
    if (INTERPRETED_SPELL_COLUMNS.has(i)) continue
    const oldIndex = i + (before.layout === 174 && i >= 74 ? 1 : 0)
    const newIndex = i + (after.layout === 174 && i >= 74 ? 1 : 0)
    if (before.rawFields[oldIndex] !== after.rawFields[newIndex]) result.push({
      field: `rawFields[${i}] (173-layout index)`, before: before.rawFields[oldIndex], after: after.rawFields[newIndex], kind: 'raw-only'
    })
  }
  if (before.layout === 174 && after.layout === 174 && before.rawFields[74] !== after.rawFields[74]) {
    result.push({ field: 'rawFields[74] (inserted column)', before: before.rawFields[74], after: after.rawFields[74], kind: 'raw-only' })
  }
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
