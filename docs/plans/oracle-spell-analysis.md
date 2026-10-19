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
English labels/descriptions. The leading summary remains an unmodified client reading; supported
bard instrument effects have a separate equipment comparison beneath it.
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

AA, criticals, resists, mana/cast-time modifiers, stacking analysis, effective healing
after overheal, and unverified repeated waves remain outside this model.

## Bard instrument equipment estimates

Show mine uses the strongest known qualifying carried source, including bag contents, and shows
the equipped-at-export result alongside it. Required swaps are explicit. Banked items, loose
exaltations, orphaned sockets and ornaments do not contribute. Equipped Slot7 exaltations and
native resonance stats enter the same exact-name-to-numeric-ID resolution against the captured
catalog. Missing/ambiguous definitions and unsupported focus limits stay visible as coverage gaps.
An identical inventory re-export updates provenance without another full-catalog calculation scan.

SPA413 provides the supported fixed base-effect modifier; 140 means a gear factor of 2.4, not 1.4.
SPA411 class gates must all pass; SPA414 skill alternatives choose the matching Singing, String,
Percussion, Brass or Wind family. Sources do not add together. Unsupported formulas, limits or
sub-10-percent focus precision are rejected. Discipline flags use a calculation-only read of the
original column98 (99 in the shifted layout); malformed, missing and nonzero flags reject song
classification without changing the source parser or immutable history.

Supported HP arithmetic runs client effect -> measured mote rounding -> per-effect instrument
truncation -> qualifying HP focus -> ticks/hits/targets. Browse, details, Compare, Rankings,
By level and Leveling share that worker calculation. The separate song table isolates equipment
for supported HP, movement, stats, resist, rune and shield effects; attack haste/slow and periodic
mana stay unchanged. Unknown effects/formulas never gain invented modified values. Singing
records do not borrow percussion/string sources.

These are partial gear-only estimates: trained song skill and unchanged other worn HP focus are
assumed. Equipment conflict optimization, AA, Amplification, temporary singing effects and unknown
EQL server/song/movement caps are excluded. Excessive raw movement slows show no final effective
percentage. Emulate retains detected instrument evidence while independently simulating its
existing mote/focus settings. Calculation model versions advance independently of source history.

Decoding references (consulted 2026-10-18; EQL behavior still needs separate verification):

- [EQEmu per-effect rules](https://github.com/EQEmu/Server/blob/master/common/spdat.cpp)
- [EQEmu instrument arithmetic](https://github.com/EQEmu/Server/blob/master/zone/client_mods.cpp)
- [EQEmu focus limits and effect application](https://github.com/EQEmu/Server/blob/master/zone/spell_effects.cpp)
- [Current client IS_SKILL mapping](https://github.com/rumstil/eqspellparser/blob/master/core/SpellParserCurrent.cs)
