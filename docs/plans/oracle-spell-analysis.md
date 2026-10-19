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
Browse uses the selected pack size, including when its DD filter includes area spells. Opening
a Browse record preserves that scope. Healing stays per recipient. The DD/DoT ranking views
explicitly show one-target full casts; AOE rankings use pack totals.

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

## Visible mote rank previews and observation badges

The always-visible mote preview dropdown switches between client values, detected values, or an
Emulate group default. Exact numeric-ID row overrides are available in Emulate across Browse,
Rankings, Compare, By level and details. Group changes preserve matching per-spell overrides;
their count and a clear action stay visible. Base=0 and Base/I=1 remain exact choices, and previews
below an observed rank are allowed. Existing profile/session persistence owns these preferences.

Green Yours VII badges mean highest observed upgraded rank from the selected character's own
cast/resist or merge logs. They are not a complete spellbook scan. Missing, ambiguous and Base/I
evidence produces no upgraded badge. The worker resolves observations independently of simulation,
requires exact full base-name identity and catalog-wide uniqueness, and stamps evidence with the
character key, context revision and snapshot ID. Retained replies from another context cannot
display a badge. A lone classic-suffix record cannot borrow an observation of its stripped name.

Modifier model 3 tightens that observation association. Source parser versions, captured spell
history and live combat state are unchanged by previews, badges or preference updates.

## Rain scope and table clarity

Analysis model 4 exposes per-hit amounts and ideal potential-hit allocations for verified rains.
The whole-cast formula remains min(available waves × requested targets, hit budget). For a
three-wave/four-hit rain, 1/2/3/4 targets illustrate 1+1+1, 2+2, 3+1, and 4 opportunities.
Mana is paid once. These are pack totals, not equal damage per target; movement and resists can
reduce realized damage. The captured 7500 ms window remains the conservative rate denominator
input, rather than asserting the last active pulse happens then.

The scope bug was in Browse's request: it always selected single-target analysis despite the pack
control. Browse now sends pack scope and preserves it when opening details. DD/DoT rankings
retain their explicitly labeled one-target scope. Ordinary AOE4/AOE8 caps remain separate from
RAIN's across-wave hit budget. Specific type filters and subcategory sorting scan the full catalog
before paging. Category detail narrows with its filters and columns after Spell are centered.

Reference implementation inspected 2026-10-18: [EQEmu beacon](https://github.com/EQEmu/Server/blob/master/zone/beacon.cpp)
retains the shared budget between pulses; [EQEmu AESpell](https://github.com/EQEmu/Server/blob/master/zone/effects.cpp)
spends it per target attempt. Its OldRainTargets rule can change that behavior. The reference and
cached EQL community spell pages support the model; this is not a fresh EQL server measurement.
The current local Frost Storm ID 660 at level 50 reads 512 per hit and 271 mana: 1536/5.667897
for one target, 2048/7.557196 for two through four. This was checked read-only against the player's
client files. Calculation, view and equipment changes create no captured source-history entries.
