import type { SpellModifierPreferences, SpellModifierUpdate } from '../../shared/spellModifiers'

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected modifier settings object')
  return value as Record<string, unknown>
}

function keys(value: Record<string, unknown>, expected: string[]): void {
  const actual = Object.keys(value)
  if (actual.length !== expected.length || actual.some((key) => !expected.includes(key))) {
    throw new Error('Unexpected or missing modifier setting')
  }
}

function rank(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10) {
    throw new Error('Mote rank must be an integer from 0 through 10')
  }
  return value
}

function spellId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 2147483647) {
    throw new Error('Invalid client spell ID')
  }
  return value
}

function overrides(value: unknown): SpellModifierPreferences['emulation']['ranks'] {
  const rows = object(value)
  if (Object.keys(rows).length > 256) throw new Error('Too many per-spell rank overrides')
  const result: SpellModifierPreferences['emulation']['ranks'] = {}
  for (const [id, entry] of Object.entries(rows)) {
    if (!/^[1-9]\d*$/.test(id)) throw new Error('Invalid client spell ID')
    spellId(Number(id))
    const row = object(entry)
    keys(row, ['rank', 'name'])
    if (typeof row.name !== 'string' || row.name.trim().length === 0 || row.name.length > 256) {
      throw new Error('Rank overrides require the exact spell name')
    }
    result[id] = { name: row.name, rank: rank(row.rank) }
  }
  return result
}

function focusIds(value: unknown): number[] {
  if (!Array.isArray(value) || value.length > 64) throw new Error('Invalid simulated focus selection')
  const ids = value.map((id: unknown) => spellId(id))
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate simulated focus ID')
  return ids.sort((a, b) => a - b)
}

/** Every renderer and disk preference enters through this complete, bounded shape. */
export function validateModifierPreferences(value: unknown): SpellModifierPreferences {
  const prefs = object(value)
  keys(prefs, ['mode', 'emulation'])
  if (prefs.mode !== 'client' && prefs.mode !== 'mine' && prefs.mode !== 'emulate') throw new Error('Invalid spell value mode')
  const emulation = object(prefs.emulation)
  keys(emulation, ['rank', 'ranks', 'focus', 'focusIds'])
  if (!['detected', 'none', 'selected'].includes(String(emulation.focus))) throw new Error('Invalid focus mode')
  return {
    mode: prefs.mode,
    emulation: {
      rank: emulation.rank === null ? null : rank(emulation.rank),
      ranks: overrides(emulation.ranks),
      focus: emulation.focus as SpellModifierPreferences['emulation']['focus'],
      focusIds: focusIds(emulation.focusIds)
    }
  }
}

export function validateModifierUpdate(value: unknown): SpellModifierUpdate {
  const update = object(value)
  keys(update, ['expectedRevision', 'preferences'])
  if (typeof update.expectedRevision !== 'string' || update.expectedRevision.length > 128) {
    throw new Error('Invalid modifier context revision')
  }
  return { expectedRevision: update.expectedRevision, preferences: validateModifierPreferences(update.preferences) }
}
