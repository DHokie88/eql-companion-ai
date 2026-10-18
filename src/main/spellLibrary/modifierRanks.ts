import type { SpellModifierContext } from '../../shared/spellModifiers'

function rankRow(value: unknown): { name: string; rank: number } | null {
  if (value === null || typeof value !== 'object') return null
  const row = value as { name?: unknown; rank?: unknown }
  if (typeof row.name !== 'string' || row.name.trim() === '' || typeof row.rank !== 'number') return null
  if (!Number.isInteger(row.rank) || row.rank < 1 || row.rank > 10) return null
  return { name: row.name, rank: row.rank }
}

/** Reduce the served fold to semantic evidence; cast timestamps and merge counts are not inputs. */
export function modifierRanks(state: unknown): SpellModifierContext['ranks'] {
  if (state === null || typeof state !== 'object' || Array.isArray(state)) return null
  const ranks: NonNullable<SpellModifierContext['ranks']> = {}
  for (const [key, value] of Object.entries(state)) {
    const row = rankRow(value)
    if (row === null) return null
    ranks[key] = row
  }
  return ranks
}
