import type { ClientSpellRecord } from './spellLibrary'
import type { SpellModifierContext } from './spellModifiers'
import { romanRank } from './spellLines'

export type BrowseRankSource = 'override' | 'observed' | 'global' | 'baseline'
export interface ResolvedBrowseRank {
  /** Always I–X. Browse never selects raw rank 0. */
  rank: number
  source: BrowseRankSource
  label: string
  /** True only for a valid observed II–X rank while Use my ranks is on. */
  owned: boolean
}
export interface BrowseRankGuard {
  characterKey: string
  contextRevision: string
  snapshotId: string
}

const nameKey = (name: string): string => name.trim().toLowerCase()

function playerEligible(record: ClientSpellRecord): boolean {
  return record.classes.some((entry) => entry.level >= 1 && entry.level <= 254)
}

/** Per-ID override, I–X, exact name, player class row. Rank 0 and classless records fall through. */
function overrideRank(record: ClientSpellRecord, context: SpellModifierContext): number | null {
  if (!playerEligible(record)) return null
  const entry = context.preferences.emulation.ranks[String(record.id)]
  if (!entry || nameKey(entry.name) !== nameKey(record.name)) return null
  return Number.isInteger(entry.rank) && entry.rank >= 1 && entry.rank <= 10 ? entry.rank : null
}

function globalRank(context: SpellModifierContext): number | null {
  const rank = context.preferences.browse?.rank
  return typeof rank === 'number' && Number.isInteger(rank) && rank >= 1 && rank <= 10 ? rank : null
}

function resolved(rank: number, source: BrowseRankSource, owned: boolean): ResolvedBrowseRank {
  return { rank, source, label: romanRank(rank), owned }
}

/**
 * One browse order: valid per-ID/name override I–X, then a valid observed rank when Use my ranks
 * is on, then the global I–X preview, then baseline I. Observed I is not ownership.
 */
export function resolveBrowseRank(
  record: ClientSpellRecord,
  context: SpellModifierContext,
  catalog: { observedRank(record: ClientSpellRecord, context: SpellModifierContext): { rank: number | null } }
): ResolvedBrowseRank {
  const override = overrideRank(record, context)
  if (override !== null) return resolved(override, 'override', false)
  if (context.preferences.browse?.useMyRanks) {
    const observed = catalog.observedRank(record, context).rank
    if (observed !== null && observed >= 2 && observed <= 10) return resolved(observed, 'observed', true)
  }
  const global = globalRank(context)
  if (global !== null) return resolved(global, 'global', false)
  return resolved(1, 'baseline', false)
}

/** The result still belongs to this character, revision, and dataset. Rank I baseline can match. */
export function currentBrowseRank(selection: BrowseRankGuard | null | undefined, context: { characterKey: string | null; revision: string | null; snapshotId: string | null }): boolean {
  if (!selection || context.characterKey === null || context.revision === null || context.snapshotId === null) return false
  return selection.characterKey === context.characterKey && selection.contextRevision === context.revision && selection.snapshotId === context.snapshotId
}
