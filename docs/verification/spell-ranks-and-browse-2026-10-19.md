# Spell ranks, source evidence and Browse corrections

Date: 2026-10-19. Oracle 0.4.0.

Follow-up: [Oracle 0.5.0 findings](spell-rank-followup-2026-10-19.md)
correct the missing DoT pulse and add rank costs/timing and a 0-X breakdown.
The findings below document the earlier 0.4.0 implementation.

## What the supplied files establish

The inspected `C:/Users/andrew/EQL/spells_us.txt` has 74,001 records and SHA-256
`8a502ccb6fb78e8384196d935f16695a7513878278de9088878006bd94202b21`.
The exact-name player Conflagration is ID 659, physical line 657, in the
174-column layout. Its HP effect supplies the base/caster-level calculation,
which reaches 900 at caster level 50. The other exact-name record, ID 6864,
has no player class levels and is a different definition.

There is no exact-name Conflagration IX row. A substring search DOES match
Distant Conflagration IX, a different spell. This is why substring search alone
cannot settle the question.

There is a numeric rank-related column: raw zero-based index 135 in this layout
(134 after removing the inserted column). Both Conflagration records contain
zero. The separate Ethereal Conflagration/base/Rk. II/Rk. III records contain
1/5/10. Oracle retains these raw columns but does not use this native rank code
as a character's mote rank. Observed mote ranks still come from character evidence.

The matching `spells_us_str.txt` rows for IDs 659/6864 contain cast/landing/fade
messages, not damage numbers. No game files or extracted spell rows were added
to this repository.

These checks establish specific observed contents. They DO NOT constitute proof
that no unused numeric field could encode additional rank behavior. The earlier
blanket claim that rank data does not exist in the file was too strong. No
authoritative server source establishing the complete mote implementation was
obtained during this work.

## Formula provenance and limits

The [Spell Explorer model](https://amerzel.github.io/eql-info/#/upgrades) and its
[pinned implementation](https://github.com/Amerzel/eql-info/blob/71960ca33cb2a200ae0dc246ded304b0fc97b37b/docs/static/js/upgrades.js)
publish category rules reconstructed from community tooltip/cast observations.
They describe server-pushed upgrades; that description is a source claim, not
independent proof about every field in the supplied client files.

Oracle's client-library rank model now uses:

- Direct HP hit: base plus `floor(base * 6 * rank / 100)`.
- Periodic damage: base tick plus `floor(baseTick * 3 * rank / 100)`.
- DoT ticks: `round(baseTicks * (100 + 5 * rank) / 100)`.
- Hybrid total: separately scaled initial hit plus scaled tick times scaled ticks.
- Healing retains the prior observed +3% model; the reference marks healing and
  some hybrid/HoT assumptions as less certain. They are not promoted to exact facts.

The legacy upstream card model is unchanged. The client-library model versions
are incremented to 6. The calculation details identify the community model and
retain the limitation that efficiency/cycle estimates use client mana and cast
times. This is not a complete reproduction of server mana/timing/AA/resist rules.

For Conflagration at level 50, this model gives 1,386 at IX. Applying a 10.5%
focus midpoint gives 1,531.53, explaining the screenshot's fractional value.
Browse now omits equipment focus/instruments and shows whole-point rank values;
details and equipment projections remain separate. Neither number is claimed
to be an exact IX entry read directly from the supplied spell file.

## Browse behavior

Columns use explicit relative proportions with a compact minimum width. Repeated
DD/DoT category text is suppressed when that type is selected. Modeled DPS is
rounded for display; sorting retains underlying precision.

Best in line now accepts compatible detrimental HP-over-time lines with an
optional initial HP hit and disease/poison counters. It requires the same
captured line, target, resist and effect slots, and refuses additional unsupported
effects, recourse, bard definitions and unverified repeated applications. It
orders by full-cast modeled rank damage. Venom of the Snake and Envenomed Bolt
resolve to the same key; independent lines remain separate. This is not a general
server buff-stacking simulator or shared-timer implementation.

Infectious Cloud has a captured four-target cap and is labeled AoE4 DoT. Its
nonzero area-duration field still prevents an unverified repeated-application
damage total; classification does not invent that behavior.

The separate AOE-cap filter is removed. Targets chooses a one-to-eight-enemy
scenario; calculations still respect a spell's own cap. Old maximum/oversized UI
preferences are clamped to eight without rewriting captured data. The internal
analysis API retains its prior wider scenario support for compatibility.

Regression coverage includes every explicit rank 0-X for direct and hybrid
damage, focus exclusion in Browse, poison-line grouping, independent-line
preservation, area-DoT labels and older target preference normalization.

## Windows verification

- Production build, node/web/share typecheck, lint and release-notes gate pass.
- Full unit suite: 5,208 passed, 24 skipped, zero failed in 24.6 seconds.
- Six relevant desktop specs pass across preserved runs. Grouping/columns and
  bard instruments passed in `2026-10-19T20-43-05-274Z`; corrected Browse controls,
  spell analysis, modifiers and Leveling passed in `2026-10-19T20-47-01-952Z`.
  The first run also exposed the initial table's width failure, a debounced-search
  test race and a test reselecting an unchanged rank option. Those failures are
  preserved, and the corrected interactions assert their final values.
- A final isolated fixture against the final renderer checks long spell names,
  a five-digit ID, rank-only integer damage, rounded DPS, DD category suppression,
  and actual table/container geometry: table 1,004 CSS pixels, container 1,004,
  scroll width 1,004. Its visible screenshot was inspected. Evidence is at
  `C:/Users/andrew/EQL/output/oracle-0.4.0-browse.png` and
  `oracle-feedback-preview.log` in that directory. The temporary diagnostic script
  was removed after use.
- The real `Open-Fork.cmd` startup test passes with production UI/preload and the
  release engine in an isolated profile. The final source-comment correction is
  followed by another production build and launcher verification.

Outputs are preserved as `C:/Users/andrew/EQL/output/oracle-feedback-*.log`;
desktop artifacts remain in ignored `tests/e2e/artifacts/<run-id>/` directories.
Hidden-window screenshots sometimes timed out; the final visible fixture provides
the visual check. No game files, profiles or observed ranks were modified.
