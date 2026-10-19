// Oracle owns its release sequence. Keep imported EQ-Zera history in releaseNotes.ts
// so an upstream refresh cannot become Oracle's version or its unread-news stamp.
import {
  hasReleaseNote as hasNote,
  latestReleaseVersion as latestVersion,
  releaseNotesProblems as notesProblems,
  variantLastSeen as variantSeen,
  whatsNewState as newsState,
  type ReleaseNote,
  type WhatsNewVariant
} from './releaseNotes'

export { hasReportedEntry } from './releaseNotes'
export type { ReleaseEntry, ReleaseEntryKind, ReleaseNote, WhatsNewState, WhatsNewVariant } from './releaseNotes'

export const UPSTREAM_BASE = {
  project: 'EQ-Zera',
  version: '1.26.1',
  commit: '780c7afb3fe71f65db2cd8ae9d8c191b8ecc9db4'
} as const

export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: '0.2.0',
    date: '2026-10-19',
    entries: [
      { kind: 'new', text: 'Spells brings your spell library, mana-efficiency rankings, level planning, and comparisons together. Search by name or ID, filter classes and levels, and compare up to four spells.' },
      { kind: 'new', text: 'Show mine estimates supported spell values using detected mote ranks and worn focus. Emulate lets you try other ranks and equipment assumptions without changing your character data.' },
      { kind: 'new', text: 'Bard songs show supported instrument effects, with equipped and best-carried instrument comparisons. Missing evidence and unsupported effects are identified beside the estimates.' },
      { kind: 'new', text: 'Spell history keeps captured versions of your three game spell files and explains additions, removals, and field changes. History starts with the first version Oracle observes.' },
      { kind: 'fixed', text: 'Spell details explain supported effects in plain English, including slow, haste, targets, and range. Rain comparisons show target scenarios and shared hit budgets.', fromReport: true },
      { kind: 'fixed', text: 'Imported desktop fixes from EQ-Zera 1.26.1 restore missing wiki loot, correct equipment slots and Sky rewards, and repair respawn and crawl data.' },
      { kind: 'changed', text: 'Browse combines spell rankings with sortable columns, filters, rank previews, and observed-rank badges. Leveling uses the same spell estimates.' },
      { kind: 'changed', text: 'Oracle now has its own version and release history. The upstream base is listed separately, and older EQ-Zera notes remain available below.' }
    ]
  },
  {
    version: '0.1.0',
    date: '2026-10-13',
    entries: [
      { kind: 'new', text: 'Established the EQ Oracle fork with its own desktop identity and launcher, building on the existing EQ-Zera toolkit.' }
    ]
  }
]

export function latestReleaseVersion(notes: readonly ReleaseNote[] = RELEASE_NOTES): string {
  return latestVersion(notes)
}

export function hasReleaseNote(version: string, notes: readonly ReleaseNote[] = RELEASE_NOTES): boolean {
  return hasNote(version, notes)
}

export function releaseNotesProblems(notes: readonly ReleaseNote[] = RELEASE_NOTES): string[] {
  return notesProblems(notes)
}

export function whatsNewState(lastSeen: string | null | undefined, notes: readonly ReleaseNote[] = RELEASE_NOTES) {
  return newsState(lastSeen, notes)
}

export function variantLastSeen(variant: WhatsNewVariant, notes: readonly ReleaseNote[] = RELEASE_NOTES): string | null {
  return variantSeen(variant, notes)
}

/** Existing upstream readers get Oracle's first upgrade once. Explicit null means
 * fresh/reset; preserve the legacy stamp and never compare it against Oracle versions. */
export function resolveOracleNotesSeen(oracle: unknown, legacy: unknown): string | null {
  if (oracle === null) return null
  if (typeof oracle === 'string' && /^\d+\.\d+\.\d+$/.test(oracle)) return oracle
  return typeof legacy === 'string' && /^\d+\.\d+\.\d+$/.test(legacy) ? '0.1.0' : null
}
