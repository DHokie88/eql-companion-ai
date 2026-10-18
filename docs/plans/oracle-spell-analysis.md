# Oracle spell analysis

Spells now contains Browse, Rankings, Compare, By level, and History. Browse remains the initial
view for a new character profile. The captured SQLite catalog and numeric spell IDs remain the
source of truth; equipment, emulation, and calculation-model updates never create source snapshots.

Rankings scan the filtered catalog in the query worker before sorting and paging 40 records.
Damage/healing per client mana is the default. Zero-mana and unsupported records have separate
groups. Optional columns expose timing, duration, ticks, waves, targets and hits. Highlights select
the corresponding global sort. Leveling consumes the same queries and links into these views.

AOE starts with four requested targets, shared across character profiles' Spells and Leveling.
Ordinary AOE respects a captured finite cap. Unknown caps support a labeled partial scenario at
a chosen count, while Spell maximum is unavailable. Verified rains require an exact, uniquely
compatible player definition in the active snapshot; their whole-cast hit budget caps waves times
targets. The existing researched three-wave/four-hit examples are not defaults for arbitrary waves.
Healing stays per recipient. DD shows one-target full casts, including verified rain waves.

Modeled cycle DPS/HPS divides full amount by cast plus max(recovery, recast, delivery). Delivery
includes full periodic duration or a verified wave window. This is a ranking estimate, not measured
combat output or a rotation. Unsupported timing removes only the rate when amount remains known.

Details lead with plain-English, level-evaluated client effects: slow/haste percentages, duration,
target, resist and range. The technical table retains SPA numbers and raw formula fields beside
English labels/descriptions. Non-HP buff effects remain unmodified client readings in every mode.
Supported HP details/comparisons expose baseline, mote/focus stages, per-effect contributions,
ticks/hits, total, client-mana efficiency and the timing denominator. Comparisons support four IDs
and a reference spell; zero/unknown reference percentages are unavailable.

By level groups earliest eligibility across the selected class union. At this level and Upcoming
do not imply ownership, scroll availability or server acquisition. Preview uses the eligible level
without replacing the workspace caster level. Lists stay mounted behind details to preserve their
filters, selection, paging and scroll. UI choices live separately from observations, scoped to
installation/server/character; characterless choices remain in memory for the session.

Verification includes pure analysis/query/English-effect fixtures, the full unit suite, desktop
Spells and Leveling regressions, typecheck/lint, the production build, and the real Open-Fork.cmd
startup gate. Desktop fixtures use hand-authored client rows and isolated profiles beside the
running game. Optional Leveling photo sessions can be disabled with EQ_E2E_HIDDEN_ONLY=1.

AA, instruments, criticals, resists, mana/cast-time modifiers, stacking analysis, effective healing
after overheal, and unverified repeated waves remain outside this model.
