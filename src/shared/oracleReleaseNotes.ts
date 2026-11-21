// Oracle owns its release sequence. Keep imported EQ-Zera history in releaseNotes.ts
// so an upstream refresh cannot become Oracle's version or its unread-news stamp.
import { ORACLE_RELEASE_ARCHIVE } from './oracleReleaseArchive'
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
  version: '1.28.0',
  commit: '61029a77297584e2bbb6f18ab0b5096eefb03094'
} as const

export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: '0.29.0',
    date: '2026-11-21',
    entries: [
      { kind: 'new', text: 'Gear marks numbers cross-checked against Ruby and shows when it estimates upgraded stats. Hover a value to see its source.' },
      { kind: 'fixed', text: 'Corrected base armor class for Lustrous Russet Vambraces (13), Greaves (14), and Helm (14) using Ruby’s item records.' }
    ]
  },
  {
    version: '0.28.0',
    date: '2026-11-20',
    entries: [
      { kind: 'new', text: 'Turn on Weapons in Gear to compare by damage divided by delay. Sort by ratio, damage, delay, handedness, weapon type, damage bonus, backstab, range, haste, or proc while keeping your existing filters. The ratio uses the stats shown for each item, including its owned or simulated tier.' }
    ]
  },
  {
    version: '0.27.0',
    date: '2026-11-20',
    entries: [
      { kind: 'new', text: 'With Use owned stats on, Gear shows each item’s owned tier or simulated tier beside its name. Hover the tier for details about partial progress.' },
      { kind: 'changed', text: 'Gear’s Slots menu is alphabetical, and the next-slot arrow follows the same order.' }
    ]
  },
  {
    version: '0.26.0',
    date: '2026-11-20',
    entries: [
      { kind: 'new', text: 'Press Play on the Overview or in the tray to start EverQuest Legends. Opt into Luclin character models per race in Preferences, Game. Play puts them back when the launcher reverts them. This changes a game file Daybreak does not support, so it is off until you accept the risk.' },
      { kind: 'new', text: 'Patch Notes lists the EverQuest Legends developers’ patch and hotfix notes. They download on launch, stay readable offline, and a new note shows an unread badge. Turn the launch check off in Preferences, Patch notes.' },
      { kind: 'new', text: 'The Character tab can draw Kerra, with all ten skin tones, and the Half Dark Elf.' },
      { kind: 'new', text: 'Preferences can build an optional in-game UI skin on the game’s Modern layout. Type /loadskin EQZera 1 in game to switch. It is built on your PC from your own game files and is off until you build it.' },
      { kind: 'changed', text: 'Item, mob, quest and spell data includes the EQ Legends wiki through November 15, including Castle Nektropos, Lake Nerius and the Nektropos Undercrofts.' }
    ]
  },
  {
    version: '0.25.0',
    date: '2026-11-20',
    entries: [
      { kind: 'new', text: 'Bazaar tracks offers from your trade chat. Browse asking prices and price history by item and tier, export quotes to CSV, and set watches for new matches. A very large history shows the newest rows.' },
      { kind: 'new', text: 'Follow starred Plane of Sky quests in an optional overlay. It updates even with the Sky tab closed and uses the same inventory, log, or combined counts as the tab.' },
      { kind: 'changed', text: 'The Combat dashboard and damage and healing overlays combine overlapping refreshes. They keep the last valid numbers visible while updating and clear them when the selected fight or character changes.' }
    ]
  },
  {
    version: '0.24.1',
    date: '2026-11-20',
    entries: [
      { kind: 'fixed', text: 'Character discovery skips malformed, missing, and unreadable log entries and keeps the most recent usable log.' },
      { kind: 'fixed', text: 'Inventory and achievements imports use the active character’s own exports. Gear and worn-focus previews clear stale data when switching characters.' }
    ]
  },
  {
    version: '0.24.0',
    date: '2026-11-20',
    entries: [
      { kind: 'new', text: 'Respawn timers can auto-adjust from qualifying kill gaps when you enable the option for a watched mob. The wiki estimate is used while the timer is waiting for observations.' }
    ]
  },
  {
    version: '0.23.2',
    date: '2026-11-20',
    entries: [
      { kind: 'changed', text: 'Spells explains the base client description and the modeled amount after rank, including how area hits, rain waves, or ticks contribute to the total.', fromReport: true },
      { kind: 'changed', text: 'Recast is shown by default. Global recovery remains an optional column. The modeled rate explains the same-spell cycle and its assumptions.', fromReport: true }
    ]
  },
  {
    version: '0.23.1',
    date: '2026-11-20',
    entries: [
      { kind: 'changed', text: 'The Spells catalog uses captured client records without guessed era labels or era filters.', fromReport: true },
      { kind: 'fixed', text: 'Spell name is the only required column in Browse, Compare, Progression and History spell lists. Every other column can be shown or hidden.', fromReport: true }
    ]
  },
  {
    version: '0.23.0',
    date: '2026-11-20',
    entries: [
      { kind: 'new', text: 'Spells History lists captured client updates by the time Oracle first saw them. Open an update to see added, changed and removed spells, filter by name or class, and view old and new field values.', fromReport: true },
      { kind: 'changed', text: 'Spell updates compare both captures with the same parser. Raw fields, layout changes and routine checks are available in expandable details.' }
    ]
  },
  {
    version: '0.22.2',
    date: '2026-11-20',
    entries: [
      { kind: 'changed', text: 'Class dropdowns list classes alphabetically by their displayed labels. In Spells, All, None, and My classes stay at the top.', fromReport: true }
    ]
  },
  {
    version: '0.22.1',
    date: '2026-11-20',
    entries: [
      { kind: 'fixed', text: "Spell descriptions convert stun times from milliseconds to seconds. Brusco's Bombastic Bellow now shows 8 seconds, Song of Highsun shows 1 second, and Denon's Bereavement shows 0.5 seconds.", fromReport: true }
    ]
  },
  {
    version: '0.22.0',
    date: '2026-11-20',
    entries: [
      { kind: 'new', text: 'Choose a column preset in Browse, Compare or Progression. Edit the Direct damage, Rain / area damage, Damage over time, Healing, Buffs, Debuffs and Utility presets in Preferences under Spell columns.', fromReport: true },
      { kind: 'new', text: 'Compare starts in Auto and picks the most common spell type in your selection. You can choose Damage, Healing, Buffs, Debuffs or Utility. Effect comparisons show base client effects and duration.', fromReport: true }
    ]
  },
  {
    version: '0.21.2',
    date: '2026-11-20',
    entries: [
      { kind: 'fixed', text: 'The Targets tooltip closes when you open the target menu.', fromReport: true },
      { kind: 'changed', text: 'Spells Browse has an optional Era column. Turn it on from Columns.', fromReport: true },
      { kind: 'fixed', text: 'Rain comparisons use the selected pack size for one enemy and for the whole pack. With two targets, a modeled rain hits one enemy twice and the pack four times.', fromReport: true },
      { kind: 'changed', text: 'Rain comparisons show the wave and hit limits. Target previews now support packs of up to 10 enemies. Compatible rain spells can also be recognized from client descriptions and landing messages.', fromReport: true },
      { kind: 'changed', text: 'Progression starts at your detected level. At level follows Min spell level, and Upcoming shows every level from Min through Max, inclusive.', fromReport: true },
      { kind: 'changed', text: 'Compare and Progression now offer the same optional spell columns as Browse. Each tab remembers its own choices.', fromReport: true }
    ]
  },
  {
    version: '0.21.1',
    date: '2026-11-19',
    entries: [
      { kind: 'new', text: 'Spells Browse has a global rank slider from I to X, a Use my ranks toggle, and a Current era filter with a Kunark preview. Open a spell to set its individual rank.' },
      { kind: 'fixed', text: 'Best in line keeps Ranger arrows separate from Wizard area spells when their client timer numbers match. Shared timer groups now require matching classes and compatible delivery.', fromReport: true },
      { kind: 'changed', text: 'Browse shows rank as text and keeps era in the toolbar. The chevron by a spell name expands its alternatives.', fromReport: true },
      { kind: 'fixed', text: 'Class/Level sorts numerically in both directions across the full result. Spell imports support the newer 190-column client records.', fromReport: true }
    ]
  },
  {
    version: '0.21.0',
    date: '2026-11-17',
    entries: [
      { kind: 'new', text: 'EQ Oracle checks for new wiki item data in the background at startup. It downloads only when the catalog changes. New data takes effect the next time Oracle opens.' }
    ]
  },
  {
    version: '0.20.1',
    date: '2026-11-17',
    entries: [
      { kind: 'fixed', text: 'Gear previews and rankings use corrected upgrade math for attributes, resists, weight, Backstab and single-value Range. Elemental and bane damage stay separate from base weapon damage.' },
      { kind: 'changed', text: 'Gear shows the date of the active wiki update. Refresh the item catalog in Preferences → Wiki data, then restart to use the download.' }
    ]
  },
  {
    version: '0.20.0',
    date: '2026-11-17',
    entries: [
      { kind: 'new', text: 'The right arrow beside Gear’s Slots picker replaces the current selection with the next slot, so you can compare gear one slot at a time. It starts at Head when the picker is empty and wraps back to Head after Ammo.' }
    ]
  },
  {
    version: '0.19.0',
    date: '2026-11-17',
    entries: [
      { kind: 'new', text: 'Gear can show stats at the highest tier you own while continuing to simulate unowned items. Inventory exports do not include partial progress toward the next tier, so owned stats use the start of the recorded tier.' },
      { kind: 'changed', text: 'The Owned filter now shows wearable copies in your inventory export, rather than items only seen in your loot history. Current era, Owned and Use owned stats sit beside the upgrade simulation.' }
    ]
  },
  {
    version: '0.18.0',
    date: '2026-11-14',
    entries: [
      { kind: 'new', text: 'The XP overlay shows separate rates and counts for Fragments of Potential alongside motes.' }
    ]
  },
  {
    version: '0.17.0',
    date: '2026-11-01',
    entries: [
      { kind: 'new', text: 'Five saved loadouts connect Character, Build and Wishlist. Follow your confirmed live classes or select a different loadout to plan; save actual equipment separately from Build experiments.' },
      { kind: 'new', text: 'Configure five named build strategies with stat weights, candidate minimums and score caps. Each loadout remembers its chosen strategy and planned swaps; add missing upgrades to its wishlist.' },
      { kind: 'changed', text: 'Gear tabs now follow your workflow: Gear, Character, Build, Wishlist, Exaltations, Crafting.' }
    ]
  },
  {
    version: '0.16.0',
    date: '2026-11-01',
    entries: [
      { kind: 'new', text: 'Preferences can download a checksum-verified EQL Wiki item dataset. Restart Oracle to use it in item lookup and Gear; your existing quest, crafting and extra item records stay available.' },
      { kind: 'fixed', text: 'Wiki pages with ambiguous item names are held for identity review. Wiki expansion labels remain source claims rather than proof that an item is available in current EQL.' }
    ]
  },
  {
    version: '0.15.0',
    date: '2026-11-01',
    entries: [
      { kind: 'new', text: 'Watched timers can play a selected sound when they end or at a time you choose before expiry. Preview the sound and set its volume; Alerts master volume and mute still apply.' }
    ]
  },
  {
    version: '0.14.2',
    date: '2026-10-25',
    entries: [
      { kind: 'fixed', text: 'Coverage notes now group repeated warnings into short explanations. Historical channel-access notes are clearly separated from current access, alongside the limits for image-only prices and poll results.' }
    ]
  },
  {
    version: '0.14.1',
    date: '2026-10-25',
    entries: [
      { kind: 'changed', text: 'The game news tab is now called New in EQL to distinguish it from EQ Oracle’s own release notes.' }
    ]
  },
  {
    version: '0.14.0',
    date: '2026-10-25',
    entries: [
      { kind: 'changed', text: 'Highlights now focus on must-read rewards, major releases, unusual bonuses and useful community findings. Each explains what matters in plain language and links to the supporting posts instead of repeating the thread.' },
      { kind: 'new', text: 'EQ Oracle checks Discord in the background shortly after opening. Keep using other pages while it works; a completion notice and taskbar flash let you know when the refreshed data is ready. Check now starts another check when needed.' },
      { kind: 'fixed', text: 'Scheduled Discord checks at 7 a.m., 3 p.m. and 9 p.m. Eastern share an in-progress harvest instead of treating an overlapping check as a failure.' }
    ]
  },
  {
    version: '0.13.0',
    date: '2026-10-24',
    entries: [
      { kind: 'new', text: 'Discord references refresh at 7 a.m., 3 p.m. and 9 p.m. Eastern. What’s New and Ask EQ Oracle pick up completed refreshes automatically, without rebuilding or restarting.' },
      { kind: 'fixed', text: 'What’s New shows the last successful Discord check separately from the latest saved message, warns when updates are overdue, and keeps the last usable snapshot if a refresh cannot be loaded.' }
    ]
  },
  {
    version: '0.12.0',
    date: '2026-10-24',
    entries: [
      { kind: 'new', text: 'Choose a sound and volume for each watched timer in its Sound settings. Test sound previews your selection before saving; Alerts master volume and mute still apply.' }
    ]
  },
  {
    version: '0.11.1',
    date: '2026-10-24',
    entries: [
      { kind: 'fixed', text: 'Opening a timer’s Sound settings dismisses the mob hover card so it cannot cover the dialog.' }
    ]
  },
  {
    version: '0.11.0',
    date: '2026-10-24',
    entries: [
      { kind: 'new', text: 'Watched respawn timers can play a sound when the countdown ends or at a time you choose before it ends. Set Sound on a running timer and preview the ding before saving. Alerts keep working while you use another page or minimize the app.' }
    ]
  },
  {
    version: '0.10.0',
    date: '2026-10-22',
    entries: [
      { kind: 'new', text: 'What’s New brings saved EQL Discord patch notes, highlights, bug reports, class discussions, guides and guild events into the sidebar, with dates, filters and links to original posts.' },
      { kind: 'new', text: 'Ask EQ Oracle searches items, spells, quests, mobs, classes and Discord through one shared local AI connection. Answers include source excerpts and dates. The reference search remains usable when the model is offline; live character state is not included yet.' }
    ]
  },
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
  ...ORACLE_RELEASE_ARCHIVE
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
