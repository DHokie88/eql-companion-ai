# EQ Oracle spell estimates

Spells provides three independent readings: **Client values**, **Show mine**, and **Emulate**.
The selected mode and emulation preferences are remembered locally for an installation, server,
and character. A new profile starts on Client values. Without a selected character, Show mine is
unavailable and emulation lasts only for the current app session.

## Model

All baselines come from the immutable captured client catalog. Character estimates apply the
existing measured mote damage/healing rules to each supported HP effect, then the best qualifying
damage/healing focus, before aggregating instant and full-duration periodic amounts. Base/I keeps
the existing no-extra-bonus interpretation. These are estimates, not official server formulas.
Focus uses its percentage band's midpoint, with the minimum/maximum available beside the result.

The numeric focus decoder reads the same captured snapshot as the target spell. Exact name joins
to equipment focus names must be unique. Supported qualification checks include encoded spell-level
decay, polarity, resist, target, HP effect, spell ID, duration, cast time and combat classification.
Unknown limits, ambiguous spell identities, unsupported layouts and unavailable evidence are
reported rather than silently granting a bonus. Client names ending in a numeral do not establish
an EQL mote rank. Observed rank lines that collapse distinct numeric records are unresolved.

Show mine uses only the active character's observed ranks and exact-character inventory export.
An export is a dated equipment snapshot; use `/outputfile inventory` in game to refresh it.
Missing inventory, unreadable inventory, unresolved items and a valid export with no focus are
distinct states. Partial estimates explain any omitted inputs.

Emulate inherits detected inputs until overridden. A global exact mote rank and individual
spell-ID overrides can preview upgrades or lower ranks. Individual overrides win. Focus can be
inherited, explicitly absent, or selected by numeric catalog ID with its real limits. Reset clears
emulation assumptions. Emulation never rewrites rank observations or inventory evidence.

Mana, cast/recovery/recast time, duration and targets retain client values. Efficiency uses client
mana cost, with zero-mana results separate. AA, bard singing/instruments, critical hits, resists,
mana/casting modifiers, stacking, recourse and repeated-wave behavior remain outside this release.
Non-HP buffs retain their client records. Leveling and supplementary wiki cards retain their
existing behavior; their older base-data sources can differ from this client-backed library.

## Runtime and interface

The typed spellLibrary bridge adds modifier-context reads, validated preference updates, focus
selection and small context-change notifications. Existing requests without evaluation settings
retain their original client-value results. Evaluated replies retain baseline values alongside
the chosen estimate, rank/focus provenance, ranges, partial status and model version.

Main owns detected inputs and sends one immutable context to the query worker. Character,
installation, relevant rank/equipment changes and source activation invalidate the appropriate
context. Repeated observations that only move log timestamps do not rerun catalog-wide ranking.
Old replies cannot replace a newer character/input/dataset result. Source history remains raw;
settings and model changes never create game-patch snapshots or restart the live engine.

Validation includes pure rules, coordinator races and persistence, worker queries across all
surfaces, synthetic end-to-end mode/override/refresh tests, baseline Spells and legacy card
regressions, typecheck/lint/full units, the production build and real Open-Fork.cmd startup gate.
