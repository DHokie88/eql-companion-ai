import type { ReleaseNote } from './releaseNotes'

/** The original EQ Oracle releases. */
export const ORACLE_RELEASE_ARCHIVE: readonly ReleaseNote[] = [
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
