import { pageEraKey } from '../pageEraDb'
import type { SpellEraLabel } from '../../shared/spellBrowseEra'
import spellBrowseEra from '../data/spellBrowseEra.json'

const names = spellBrowseEra.names as Record<string, SpellEraLabel>

/** Definitive era for an exact documented spell name. Anything else stays unknown. */
export function spellEraLabel(name: string): SpellEraLabel {
  const label = names[pageEraKey(name)]
  return label === 'classic' || label === 'kunark' || label === 'later' ? label : 'unknown'
}
