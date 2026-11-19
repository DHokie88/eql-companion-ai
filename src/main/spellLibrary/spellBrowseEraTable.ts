import { pageEraKey } from '../pageEraDb'
import type { SpellEraLabel } from '../../shared/spellBrowseEra'
import spellBrowseEra from '../data/spellBrowseEra.json'

const names = spellBrowseEra.names as Record<string, SpellEraLabel>

const eraScopes = new Map<string, ReadonlySet<string>>()

/**
 * Names that belong to more than one client record. A wiki era is an exact name join.
 * Two modern or internal IDs with that name are not one identity, so they stay unknown.
 */
export function ambiguousSpellNames(records: Iterable<{ name: string }>): ReadonlySet<string> {
  const counts = new Map<string, number>()
  for (const record of records) {
    const key = pageEraKey(record.name)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const ambiguous = new Set<string>()
  for (const [key, count] of counts) if (count > 1) ambiguous.add(key)
  return ambiguous
}

/** Full-snapshot scope, reused by later detail reads for the same capture. */
export function cachedAmbiguousSpellNames(snapshotId: string, records: Iterable<{ name: string }>): ReadonlySet<string> {
  const hit = eraScopes.get(snapshotId)
  if (hit) return hit
  const ambiguous = ambiguousSpellNames(records)
  eraScopes.set(snapshotId, ambiguous)
  if (eraScopes.size > 4) {
    const oldest = eraScopes.keys().next().value
    if (oldest !== undefined) eraScopes.delete(oldest)
  }
  return ambiguous
}

/** Definitive era for an exact documented spell name. Anything else stays unknown. */
export function spellEraLabel(name: string, ambiguous?: ReadonlySet<string>): SpellEraLabel {
  const key = pageEraKey(name)
  if (ambiguous?.has(key)) return 'unknown'
  const label = names[key]
  return label === 'classic' || label === 'kunark' || label === 'later' ? label : 'unknown'
}
