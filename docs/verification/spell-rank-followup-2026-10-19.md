# Rank 0-X follow-up and efficiency formatting

Oracle 0.5.0, 2026-10-19. This updates the 0.4.0 findings in
[the original audit](spell-ranks-and-browse-2026-10-19.md).

## Concrete correction: duration intervals are not damage pulse count

Read-only examination of completed ordinary DoT applications found an extra
periodic damage pulse beyond the duration counter. The first pulse follows
server tick timing, rather than being the separate SPA 79 initial hit.

Anonymous facts from manually inspected local applications:

| Spell/rank | Base duration intervals | Ranked intervals | Observed periodic pulses |
| --- | ---: | ---: | ---: |
| Venom of the Snake X | 6 | 9 | 10 |
| Envenomed Bolt X | 6 | 9 | 10 |
| Ignite Blood VIII | 7 | 10 | 11 |

Venom X on August 31 at 16:49:00 has periodic events at +1, +7, +13, +19,
+25, +31, +37, +43, +49 and +55 seconds, followed by wear-off. Its separate
initial hit was 48. Two further inspected Venom applications and three
Envenomed applications show the same ten-event pattern. Ignite Blood VIII
has eleven periodic events at +3, +9, ... +63 seconds before wear-off;
a second inspected application agrees. Dark Soul, Asystole and Odium
provide additional supporting examples. Aggregate counts across the full
log can be contaminated by reused target names and were not treated as
clean, independent applications.

The Ignite Blood VIII case also supports rounding duration rather than
flooring it: round(7 * 1.4) = 10 intervals, with 11 pulses. Flooring would
predict one fewer. Ordinary damage calculations now retain durationTicks
separately from ticks (pulse count). Rank duration scales the former and
adds the extra pulse once. The conservative DPS delivery window allows
one six-second period per pulse, including the possible first-tick wait.

This rule is applied to supported finite ordinary player damage-over-time
calculations. Bard songs and healing retain their previous pulse behavior;
unknown durations and repeated-area applications retain exclusions. Pulse
count at every rank is a model extrapolation from the inspected ranks,
not eleven separately observed casts for every spell.

No raw personal logs or game spell rows were copied into the repository.
Regression fixtures retain only anonymous timing/count facts and synthetic
spell definitions.

## Still unresolved: hybrid initial damage

The client initial-hit amounts are 33 for Venom and 41 for Envenomed.
At X, the +6% initial-hit assumption predicts 52 and 65 before equipment.
Early observed hit distributions of 42-50 and 53-63 instead fit +3%
followed by a 1%-20% focus roll. This is counterevidence to the assumption,
not sufficient isolation of resistance, worn focus and temporary buffs.
Later noncritical maxima differ, demonstrating why a whole-log maximum
cannot establish an unmodified spell value.

The reference itself marks hybrid initial scaling as unverified. Oracle
therefore retains that provisional rule, explicitly marks hybrid estimates
partial, and identifies the uncertainty in the 0-X table. It does not
silently replace an unverified +6% assumption with a supposedly exact +3%.
An isolated initial hit without damage focus/buffs, together with caster
level and displayed rank, is needed to resolve this confidently.

## Category costs and timing now match the selected rank

The [original model implementation](https://github.com/Amerzel/eql-info/blob/71960ca33cb2a200ae0dc246ded304b0fc97b37b/docs/static/js/upgrades.js)
also supplies mana and timing reductions. Oracle previously applied its
damage rules while retaining base mana/timing, which made efficiency and
modeled DPS inconsistent with that model. Supported HP estimates now use:

- Mana: round(base mana * (100 - 2 * rank) / 100).
- Cast: -2% of base per rank for direct damage; -4% for DoTs/healing.
- Recovery: -2% of base per rank, nearest tenth with ties down.
- Positive reuse: -2% of base per rank, truncated seconds, minimum one
  second. Zero reuse stays zero pending evidence of a minimum in that
  case. Rank 0 retains the raw client value. Invalid input timing remains
  excluded. The reference's generic minimum could also apply to zero,
  but that has not been established by the inspected examples.

These are community-model assumptions, not newly verified server source.
Healing, AA, resists, focus interactions and repeated areas are not made
exact by this change. Rank 0 keeps captured base mana and timing.
Comparison baselines retain their own base mana denominator. Browse mana,
mana sorting, cast columns and modeled DPS use the evaluated values.

## Conflagration example

The supplied player record ID 659 reaches 900 base damage at level 50,
with 250 mana and a five-second cast. Applying the direct-damage category
model produces the following one-target, equipment-free progression:

| Rank | Modeled damage | Modeled mana | Damage/mana |
| --- | ---: | ---: | ---: |
| 0 | 900 | 250 | 3.60 |
| I | 954 | 245 | 3.89 |
| II | 1,008 | 240 | 4.20 |
| III | 1,062 | 235 | 4.52 |
| IV | 1,116 | 230 | 4.85 |
| V | 1,170 | 225 | 5.20 |
| VI | 1,224 | 220 | 5.56 |
| VII | 1,278 | 215 | 5.94 |
| VIII | 1,332 | 210 | 6.34 |
| IX | 1,386 | 205 | 6.76 |
| X | 1,440 | 200 | 7.20 |

This is not an exact IX row extracted from the client. The file audit
remains inconclusive about every unused numeric field. The matching
message-string rows do not supply these upgrade amounts. Local observed
Conflagration IX damage is affected by equipment, buffs, criticals and
resistance; its maximum is not a valid rank-only calibration.

The user independently reported IX at level 50 with focus effects enabled:
description damage 900, parenthesized mana 150, cast 4.07s, recovery 1.2s,
reuse 1s, fire resist modifier -145 and range 230. The user confirmed 900
is description text, not an observed combat hit, and that the window has
no focus-off control. The 150-mana value is equipment-adjusted and does
not establish rank-only mana. Recovery agrees with the model. Raw
Conflagration reuse is 1.5 seconds, so the reported one-second reuse also
agrees. It does not establish behavior for a zero-reuse client record.
The raw resist modifier is -10; -10 - 15 * 9 = -145 agrees exactly with
the reported IX modifier and supports interpreting the suffix as rank 9.
Raw range 200 versus reported 230 is consistent with a separate range
focus. Damage rank scaling still needs an
actual hit isolated from damage focus/buffs/resists; this tooltip does
not validate a 900-damage IX combat result.

The local inventory export lists Mana Preservation II on a worn exaltation,
Spell Haste II on another, and Extended Range II on a third. That is supporting
evidence for separating the parenthesized values from the rank-only ladder,
not a complete reproduction of the active gear state. Oracle currently models
damage/healing focus amounts, not mana-preservation or casting-haste focuses.
It therefore does not reproduce the reported 150 mana or 4.07-second cast.
The rank-only mana/cast columns must not be presented as those equipped values.

## User-visible changes and verification

Damage/mana now always has two decimal places across Browse, highlights,
comparison, rankings, Leveling and detail text. Sorting retains precision.
Spell details add a collapsible rank 0-X breakdown with separate initial
hit, per-pulse damage, pulse count, duration counter, mana and cast time.
Its values omit equipment and focus. The existing detail stat block is
explicitly labeled as client base values.

Model versions are incremented to 7. Production build, lint/typecheck and
release-notes gate pass. The full unit suite passes 5,210 tests, with 24
skipped and no failures (25.4 seconds). All three targeted desktop specs
pass in run `2026-10-19T21-16-32-518Z`: spell analysis (216.4s), modifiers
and the new rank table (118.3s), and Leveling analysis (35.8s). The real
launcher startup check passes against production renderer/preload and
the release engine in an isolated profile. Hidden screenshots timed out;
desktop assertions and DOM artifacts confirm the displayed values.

The first desktop run exposed a stale whole-number efficiency assertion
(`6` versus the intended `6.00`); the final run uses the new two-decimal
expectation. The initial unit run exposed old pulse-count expectations,
which were updated alongside independent log-count regression coverage.
Outputs are preserved in `C:/Users/andrew/EQL/output/oracle-ranks-*.log`.
