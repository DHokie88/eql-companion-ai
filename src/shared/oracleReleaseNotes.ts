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
    version: '0.9.3',
    date: '2026-10-22',
    entries: [
      { kind: 'fixed', text: 'Best in line now uses the existing Companion replacement families and captured shared cooldown timers, including area damage and rain spells. The strongest choice follows your selected values, targets and modifiers; expand its alternatives to see the older spells. Counts and highlights follow the collapsed choices.', fromReport: true }
    ]
  },
  {
    version: '0.9.2',
    date: '2026-10-22',
    entries: [
      { kind: 'fixed', text: 'Ordinary four- and eight-target area damage spells, including Pillar of Fire, now show damage per mana in comparisons and efficiency rankings. Full-duration area damage and captured target caps are included.', fromReport: true }
    ]
  },
  {
    version: '0.9.1',
    date: '2026-10-21',
    entries: [
      { kind: 'changed', text: 'Gear uses tighter default widths, centered headers and short resist labels. Long class lists fit two compact lines; complete tank and caster groups use Tanks and Casters.', fromReport: true },
      { kind: 'changed', text: 'Haste, STR, STA, Fire and Cold priorities are optional in More stats.', fromReport: true }
    ]
  },
  {
    version: '0.9.0',
    date: '2026-10-21',
    entries: [
      { kind: 'changed', text: 'Gear preview and wish-list actions have their own compact icon column. Data columns use tighter, centered cells and sortable headers.', fromReport: true },
      { kind: 'new', text: 'Set priorities for individual stats and resists from Off to Top. Add Poison, Disease, CHA or AGI through More stats. Sort by Score for a weighted ranking or click any data column to sort it directly.', fromReport: true }
    ]
  },
  {
    version: '0.8.0',
    date: '2026-10-21',
    entries: [
      { kind: 'fixed', text: 'Gear gives item names more room and keeps stat columns compact.', fromReport: true },
      { kind: 'new', text: 'Drag Gear column dividers to resize them. Widths are remembered across tab changes and app restarts.', fromReport: true }
    ]
  },
  {
    version: '0.7.1',
    date: '2026-10-20',
    entries: [
      { kind: 'fixed', text: 'Sky inventory refresh now confirms what loaded and reports failures instead of silently doing nothing.', fromReport: true },
      { kind: 'changed', text: 'Click counts set by hand in Plane of Sky to compare each correction with your export and restore automatic counting for individual items. Manual corrections continue to take priority until you release them.', fromReport: true }
    ]
  },
  {
    version: '0.7.0',
    date: '2026-10-20',
    entries: [
      { kind: 'new', text: 'Compare has a remove button beside each spell name and a Clear all button above the list.', fromReport: true },
      { kind: 'changed', text: 'Bard and other slow spells show attack and movement slow percentages in their descriptions and comparison rows at the selected level.', fromReport: true }
    ]
  },
  {
    version: '0.6.0',
    date: '2026-10-19',
    entries: [
      { kind: 'new', text: 'Copy fight log copies the rows shown in the Combat log, including timestamps and categories. It follows the show unparsed toggle.', fromReport: true }
    ]
  },
  {
    version: '0.5.0',
    date: '2026-10-19',
    entries: [
      { kind: 'fixed', text: 'Damage/mana now displays exactly two decimal places across Browse, comparison, rankings and Leveling.', fromReport: true },
      { kind: 'fixed', text: 'Ordinary DoT totals include the application pulse observed in combat logs, separately from duration. Modeled mana and casting cycles now apply rank reductions consistently.' },
      { kind: 'new', text: 'Spell details show a rank 0-X breakdown of initial hits, periodic pulses, duration, mana and cast time. Unverified hybrid initial damage is identified explicitly.' }
    ]
  },
  {
    version: '0.4.0',
    date: '2026-10-19',
    entries: [
      { kind: 'fixed', text: 'Browse uses compact column widths, hides repeated Direct Damage and Damage Over Time categories when their type is selected, and rounds damage and modeled DPS to whole points.', fromReport: true },
      { kind: 'changed', text: 'Browse damage uses the client base and selected or observed mote rank without equipment focus. Spell details retain equipment estimates. Rank rules are identified as a community model, with separate direct-hit, DoT-tick and DoT-duration scaling.' },
      { kind: 'new', text: 'Best in line now supports captured poison and other compatible DoT lines, including separate initial-hit and periodic effects. Area DoTs show their captured target cap, such as AoE4 DoT.' },
      { kind: 'changed', text: 'Removed the separate AOE cap filter. Targets selects a scenario from one to eight enemies and respects each spell\'s own cap. Older oversized or maximum previews open at eight.' }
    ]
  },
  {
    version: '0.3.0',
    date: '2026-10-19',
    entries: [
      { kind: 'new', text: 'Best in line groups supported stat buffs, such as AC buffs, using their captured line, target and effect slot. It shows the strongest base effect at the current level; expand its arrow for alternatives in strength order. Unverified DoT, rain and shared-timer relationships stay separate. Counts include every matching spell.' },
      { kind: 'changed', text: 'All damage and All heals share the type row with a compact AOE cap and Columns picker. Every column except Spell and Class/Level is selectable, including Description. A uniform Type column hides automatically.' },
      { kind: 'changed', text: 'Damage/Mana headers wrap to two lines. Removed the separate Level column and mana filter, renamed Polarity to Helpful / harmful, and simplified the level control to left/right arrows.' }
    ]
  },
  {
    version: '0.2.2',
    date: '2026-10-19',
    entries: [
      { kind: 'changed', text: 'Spell controls share one row: Classes, Level, Show mine, Rank, and Targets. Choosing a rank resets every spell preview and turns off Show mine; the toggle restores detected inputs.', fromReport: true },
      { kind: 'changed', text: 'Spell lists show one damage or healing number, with a short per-hit calculation for rains. Equipment inputs, ranges, and calculation limits remain available in tooltips and spell details.' },
      { kind: 'fixed', text: 'Type buttons now hide repeated category labels consistently with the category dropdown, using every matching spell rather than only the current page.' }
    ]
  },
  {
    version: '0.2.1',
    date: '2026-10-19',
    entries: [
      { kind: 'fixed', text: 'Show mine and Yours badges now recognize observed mote ranks when an internal spell shares the player spell\'s name, including Conflagration IX. Duplicate player spells and classic spell lines remain unresolved rather than borrowing another record\'s rank.', fromReport: true }
    ]
  },
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
