import type { ReleaseNote } from './releaseNotes'

/** The original EQ Oracle releases. */
export const ORACLE_RELEASE_ARCHIVE: readonly ReleaseNote[] = [
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
