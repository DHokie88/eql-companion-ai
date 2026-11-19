import { eraBadge, eraFromTag } from './planner/era'

export type SpellEraLabel = 'classic' | 'kunark' | 'later' | 'unknown'
export type SpellEraFilter = 'current' | 'preview' | 'unknown' | 'all'

/**
 * A banner token becomes a browse era only through the existing expansion table.
 * `Unknown` stays unset. A banner the expansion table does not name, but the wiki badge
 * treats as out, is later and stays out of Current and Preview.
 */
export function definitiveSpellEra(token: string): Exclude<SpellEraLabel, 'unknown'> | null {
  const folded = token.trim().toLowerCase().replace(/[\s_]+/g, '')
  if (folded === 'unknown') return null
  const expansion = eraFromTag(token)
  if (expansion === 'classic') return 'classic'
  if (expansion === 'kunark') return 'kunark'
  if (expansion === 'velious' || expansion === 'luclin') return 'later'
  return eraBadge(token) === 'out' ? 'later' : null
}

/** Current is confirmed Classic. Preview adds verified Kunark. Later stays out of both.
 * Unclassified rows stay visible in those two modes and keep the Unknown label.
 * The explicit `unknown` filter still matches only unclassified rows. */
export function spellEraAdmits(label: SpellEraLabel, filter: SpellEraFilter | undefined): boolean {
  if (filter === undefined || filter === 'all') return true
  if (label === 'later') return false
  if (filter === 'unknown') return label === 'unknown'
  if (label === 'unknown') return filter === 'current' || filter === 'preview'
  if (filter === 'current') return label === 'classic'
  return label === 'classic' || label === 'kunark'
}

export function spellEraCaption(label: SpellEraLabel): string {
  if (label === 'classic') return 'Classic'
  if (label === 'kunark') return 'Kunark'
  if (label === 'later') return 'Later'
  return 'Unknown'
}
