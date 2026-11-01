# EQ Oracle enhancements from Eye of Zomm and EQL Tools Companion

Status: source analysis complete; first item-dataset integration prepared in an isolated candidate. EQO remains the main program by Andrew's explicit decision. This report does not claim the new features are deployed or accepted.

## Exact sources and current baseline

- Current committed Windows Oracle: f18df6e55237964f89868a967aaeb487e52c9411, version 0.14.2. The working tree is preparing 0.15.0 respawn audio; those unrelated tracked and untracked edits are excluded and preserved.
- Canonical AW project currently reports 2a42d3ee40c5a17e1daa9e3529d8d3d2259416b1 / 0.1.0. It is substantially behind Windows. This analysis uses a clean snapshot of the most recent committed Windows source, not the older AW checkout and not the unfinished October23 Update31 candidate.
- Eye of Zomm: https://github.com/Maergoth/EQL-EOZ/releases/tag/v1.0.0 ; exact commit 11796e8f00cb44784784d9cf29e10749cf798545. Wiki-owned item formulas: Maergoth/EQLWiki commit 780b61946cdb7167cb88ff38eb7d1fe53bd59d3e, bundled rules revision 3.
- EQL Tools Companion: https://github.com/sowoky/eqltools-companion ; exact main dffe5d2a6ad6529672be162450592a8359b2abc5, version 0.35.0. Its vendor modules are exported copies of eqltools.com's canonical private source. Preserve that export revision and attribution when adapting; this is not permission to alter the upstream vendor tree.
- EOZ live wiki dataset: GitHub dataset branch commit 54638d7aa6498741a2912115d378c082d39919f5, manifest20261101T123256Z-52e0eb8675bc, generated2026-11-01T12:32:58Z, SHA256cfe337cbad044a6a1893abb293db1a88b47374315f232425d040770a51a28d90.

## Functional mapping agreed with Andrew

| Eye of Zomm | Oracle equivalent | Enhancement decision |
|---|---|---|
| NPCs | Mobs | Enrich the existing workflow, retain zone/instance identity. |
| Overview | Leveling | Compare individual counters and live-session handling; no duplicate top-level tab. |
| Drops and Items | Loot and Zone Loot | Compare knowledge/freshness/filters; preserve actual loot history. |
| Character | Character under Gear | Add observed/OCR evidence through the existing character model. |
| Triggers | Alerts | Compare trigger capabilities rather than replacing Oracle's alert engine. |
| Combat | Combat | Keep Oracle's established engine and fixtures; port only proven gaps. |
| Live Map | Unique live spatial workflow | High-value separate map enhancement, not equivalent to Oracle's static Maps view. |
| Contribute to Wiki | No equivalent end-to-end workflow | High-value optional contribution module with review/history boundaries. |
| Screen reading | No equivalent shared source/OCR coordinator in committed Oracle | High priority: observed character/item facts and contribution capture. |

EQL Tools adds genuinely different questions to the existing Gear/Inventory area: Valet chooses what to equip from owned items; Spare asks what is redundant across all classes; Pet plans a pet loadout; Exaltation audits identify usable/unique stones and empty/idle sockets. Those are additions, not reasons to switch the application base.

## Wiki database: verified architecture and limitations

EOZ's world data is a structured JSON export, not a direct SQL connection from the desktop to the wiki. server/BuildEyeOfZommPack.php reads local MediaWiki data on the wiki server; server/eoz-publish-dataset.sh compresses/hashes it and the dataset branch distributes it. desktop/main.cjs checks the manifest, validates the download digest, decodes the pack, writes an atomic cache and keeps offline fallback. Installed formula code is separately pinned in the application; it is not downloaded as executable JavaScript with the dataset.

The retrieved production pack contains137 zones,9,683 NPC records and11,380 item records, plus lootSourceCounts, lootSets, wikiRelationshipCoverage, icons and wikiEntities. NPC records are not synonymous with distinct NPC names: normal/raid/zone variants must survive. Relationship completeness flags qualify missing-drop/discovery claims; a count of zero without complete coverage is not proof of no source. Record revision IDs and generated times support provenance.

Compressed data is6,547,228 bytes but expands to126,697,101 bytes. Hashing, decompression, JSON parsing, normalization and persistence should run off Oracle's main/log thread, with byte caps, body deadlines and a single-flight operation. A small normalized item overlay can feed existing Oracle lookup/planner interfaces; it does not require a second database service or wholesale app import.

### The apparent extra-item difference

Oracle's bundled snapshot has11,518 distinct item-page titles;11,187 exact titles overlap EOZ,193 are only in EOZ, and331 are only in Oracle. THESE ARE RAW TITLE COUNTS, NOT VALID-EQL COVERAGE SCORES.

All 331 Oracle-only titles were checked through7 batched public MediaWiki requests at one request per second. Every resolved page currently has an Itempage template; none was missing and none had a DNE template. Primary evidence classifications:96 identity/name/redirect differences,66 later-or-special-era claims,4 deletion-notice reviews,165 unresolved current wiki item pages. The unresolved group is not certified as currently available in EQL. Four delete notices are not themselves proof an item was removed from the game.

Andrew's hypothesis is plausible but cannot explain the whole difference from counts alone. Both sources contain later-era data: EOZ has1,494 Kunark and2,687 Velious items despite meta.currentEra=Classic. EOZ's exporter also defaults an unrecognized/missing category to Classic; that label alone is not proof of current Legends availability. Do not automatically delete Oracle-only rows, call them superior coverage, or automatically admit every EOZ row as current EQL.

Use separate concepts: canonical page/name identity, wiki era claim, explicit non-Legends/deletion notices, and actual observed game evidence. Preserve unknowns and show why an item was filtered. Retain source/record revision dates and normal/raid variants. The row-level audit is evidence/oracle-only-item-checked.json.

### EQL Tools data

EQL Tools ships a different family of versioned datasets: item-tooltips 11,253records, gear 6,891records, quest-items 4,056item entries, Sky 3,057item entries/2,996 names and kill data 76 zones in this source snapshot. These units differ and cannot be ranked by count. main.js refreshes each file on its own 12 h clock and retries failed files separately; source tests verify this. Its ordinary refresh parses JSON but lacks EOZ's compressed-content checksum contract and bounded transfer/decompression pattern. Prefer the stronger shared cache transport while preserving per-source schema/clock/provenance. Never overwrite all source types into one unversioned dictionary.

## Recommended ports and implementation boundaries

| Priority | Enhancement | Source boundary | Oracle integration and acceptance proof |
|---|---|---|---|
| 1 | Verified wiki-managed item refresh | EOZ desktop/main.cjs, server exporter and dataset manifest | Worker-backed bounded checksum validation, atomic local cache, explicit source freshness and offline fallback; feed existing item/Gear interfaces. Bad hash/schema/oversize/stall cannot replace last-good data. Preserve recipes, Sky/quest associations, aliases and era uncertainty. |
| 1 | Screen reading | EOZ desktop/capture-host.cjs, capture reader/service/journal/image helpers; app/capture-source.js, screen-read-parser.js; capture preloads | One Oracle-owned opt-in coordinator, selected source, source/session/character/generation identity, 1FPS capture and bounded local OCR. Stage editable observations. Master off stops every capture/OCR route immediately. Character capture owns its source and pauses contribution capture. Test switch/stop/replacement races and actual supported skins. |
| 1 | Live Map | EOZ app/map-overlay*, viewer/route/collision modules and read-only desktop archive bridge | Add live spatial layer to Maps/overlay; preserve logged coordinate conventions and zone/instance aliases. Reuse supported archive geometry/worker contracts with a narrow bridge. Never synthesize movement or game commands. Validate known coordinate fixtures and cross-zone movement before claiming in-game accuracy. |
| 1 | Inventory Spare and owned-item ranking | eqltools vendor/spare-core.js, inventory-core.js, gear-score.js, tier.js and required attribute/combat tables | Pure Oracle adapter over owned rows, class/slot/race/deity restrictions and paired-slot capacity. Compare at equal upgrade tiers and retain current-tier distinction. Exclude or mark effects, clickies, procs, instruments, quest/key/crafting value and Exaltations as unscored. A stat ranking is not an automatic sell/delete recommendation. |
| 2 | Wiki contributions with history | EOZ wiki-client, contribution-plan/history, discovery verification, attachments and capture coordination modules | Local drafts/proof first; explicit Preview then account-scoped Publish for actual wiki edits. Preserve duplicate/current-revision checks, partial outcomes/history and separate login session. Port no automatic uploads/background observation collection by default. Missing cached records alone cannot claim a wiki gap. |
| 2 | Shared wiki tier formulas | EOZ app/vendor/item-scaling-core.js/rules/source receipt; app/item-scaling.js | Version-pinned pure adapter; regression-test all 1,024 tier/progression states and explicitBackstab/Accuracy/Range/Void/weight cases against Oracle outputs. Preserve observed character totals. Formula changes need a dedicated explained release, not hidden data-refresh code. |
| 2 | Valet, pet loadouts and Exaltation audits | eqltools vendor/valet-core.js, pet-core.js, exalt-core.js, exalt-wants.js, exalt-slots.js | Extend existing Gear workspace. Reuse Oracle item IDs/effect identities, profile/trio selection and current inventory. Mark source model assumptions and unavailable pet/class facts; keep unknown socket contents unknown. |
| 3 | Focused parser/trigger/counter improvements | Both donors' parser/combat/trigger modules | First demonstrate an Oracle gap with the same scrubbed log fixture, then port only the behavior. Preserve Rust protocol parity, pet/charm ownership and current profiles. Equivalent tab names do not prove equivalent implementation. |

## Important scoring distinction

EQL Tools gear-score.js documents its HP-equivalent scorer as a model with overridable rates. The September1 INT/WIS correction uses one observed gear swap to estimate a local post-200 slope; extending it across the whole 201+ band is explicitly labelled a model. Do not silently replace Oracle priorities or label those rates verified server mechanics. Its pool selection, AC softcap table and class/placement context are required inputs; omitting them changes the ranking. The scorer also states what it cannot value. Keep these explanations visible wherever its recommendations are used.

## Tier dependency reconciliation

EQL Tools vendor/tier.js is an older integer-tier rule applied generically to positive stat keys, leaving negative values unchanged. EOZ vendors a later wiki-owned rule engine with stat families, fractional progress, weapon Accuracy/Backstab/Range rules and negative-stat behavior. Oracle has its own older wiki-derived implementations in itemUpgrade.ts and planner/gearScale.ts. Therefore copying the Spare/Valet scorer with its original tier dependency would introduce contradictory predictions. The port needs a narrow EQLTier adapter backed by the selected, versioned Oracle tier contract, with fixture parity and explicit notes for changed results; one stat formula owner remains in Oracle.

## Data, state and application ownership

Oracle remains the only owner of active character identity, profiles, log tailing, inventory identity, timers and local edits. Donors provide versioned source capabilities and data. Use adapters over a shared Oracle contract, not donor store/profile paths or several competing log readers. Keep callbacks/workers cancellable and use exact source receipts for future refresh. No unrelated-history Git merge, upstream updater feed or branding import is needed.

## Verification so far

Codeweaver 0.2.0 at tool commit eec5f3a7fba9031a9d3d9c5f3ae67adef2c68431 generated locked inventories, focused source briefs and a three-repository forest/comparison. Current forest reports 3 sources. Its static wiki-dataset shortlist returned no challenger because the relevant donor behavior is in a desktop monolith; retain-primary here is NOT proof against the manually verified donor capability. Focused validatePack/transfer briefs and real source tests supplement that retrieval gap. No invented native Codeweaver candidate qualification/acceptance is claimed.

EOZ validation: 199 package-script checks were exercised individually in an isolated validation clone: 198 passed; the raid exporter behavioral check requires PHP, unavailable on AW. The normal npm test run also stopped at that PHP dependency. Passing checks include real local OCR fixture recognition and bundled runtime digest checks, cache corruption/size/deadline/offline cases, item scaling, discovery and UI-source contracts. This is source/fixture evidence, not a live Windows game capture or deployed Oracle proof.

EQL Tools scripts/main-check.mjs passed its log truncation/cursor, per-file refresh/retry and schema-fallback checks. It has no comparable complete npm test script in this export. Further behavioral probes and adapted Oracle regressions are required before any scoring port is accepted.

Hermes read-only analysis task t_97bd1a61 timed out at 902 seconds and was archived; its worker termination was checked. It produced no accepted report. Hermes adapter-proposal task t_811a8dc7 also timed out without code and was archived after worker termination was checked. AORUS native Grok supplied the first worker, transport, Preferences and lookup integration. Codex independently reviewed it, fixed cache/worker races, reconciled timestamps, validated cached record shapes, and added coupled regression tests. Grok OAuth preflight reported grok.com; no paidAPI fallback was used. Existing native tools/queues were reused.

## Delivery gate

Current production Oracle and its pending respawn-audio work are untouched. New code is isolated on codex/eoz-wiki-data under the implementation directory. Required checks before calling an Oracle change verified: Windows production build, typecheck, lint, meaningful units/affected desktop exercises and the real Open-Fork.cmd startup test. Keep normal release notes and exact donor provenance. Explicit product acceptance remains separate from technical verification. Dirty user work is never reset or silently incorporated.

## Integration evidence: real dataset projection

The first pure Oracle adapter now passes 8 focused checks and a real-pack projection. The production source has 12 groups where distinct wiki titles collide under Oracle's case-insensitive game-item key (24 records, including capitalization variants of Rune Casing). Those records are retained in an explicit quarantine rather than arbitrarily replacing a reviewed Oracle identity. 11,356 source pages are admitted to the active item overlay. All 11,518 original Oracle page identities remain present in the merged corpus; this is a preservation check, not certification that they are currently available in EQL. The normalized cache is 8,313,597 bytes. The corrected standalone projection check completed in about 1.65 seconds; that work belongs on a worker thread, not the log/main thread. Future cache activation is on the next Oracle launch so existing per-window datasets stay coherent.

The EQL Tools synthetic pure-domain probe verifies paired-slot capacity, all-class niche protection, effect caveats and inclusion of the real softcap table. It reports its own tier outputs (base 15 at +1 = 16; negative -5 at +5 remains -5) and model mana slopes (1, 2.5, 0.654), exposing the reconciliation needed before adapting it to Oracle. This is not a new in-game mechanics measurement.


## First implementation scope

Candidate version 0.16.0 is reserved above the unrelated in-progress 0.15.0 audio work. No live checkout, profile, updater or telemetry settings are changed. Preferences > Wiki data offers a manual bounded download. The immutable session cache activates on the next launch, avoiding inconsistent renderer/main indexes. Item lookup, Gear and Exaltation candidate searches consume that item overlay; held-clicky and worn-focus specialty readers remain bundled and are not certified by this increment. NPC and zone totals describe the export only. Existing era evidence wins over the export's coarse tag; the donor claim remains separately attributed.

The actual November 1 pack projects 11,356 unambiguous item pages from 11,380 source records, with 24 records in 12 case-sensitive page identity conflicts held aside. It merges to 11,646 distinct pages and preserves all 11,518 original Oracle page identities. The normalized cache is about 8 MB. Source time is 12:32:52 UTC; manifest publication time is 12:32:58 UTC. Neither time promises that every edit made today is present.

This increment does not implement OCR, Live Map, Spare/Valet/Pet or wiki publishing. Those remain the concrete source-backed port recommendations above. Oracle remains the base. The Codeweaver plan/review and separate Windows qualification receipts accompany delivery; technical verification does not imply Andrew's product acceptance.
