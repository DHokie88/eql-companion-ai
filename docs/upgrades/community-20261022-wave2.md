# EQ Oracle 0.10.0: selected community features and operating record

This is the second integration wave of PR #1, following the 0.9.4 ownership safeguards in commit `769c037e0dfcac52e8a228440b426b76ae538f36`. The [original comparison](community-20261022.md), [release index](community-20261022-releases.json), and [tree inventory](community-20261022-inventory.json) retain the original audit evidence. This document supersedes their **prepared** labels for the features implemented below.

## Sources and evidence boundary

| Repository | Reviewed branch and commit | Relationship to EQO |
|---|---|---|
| [DHokie88/eql-companion-ai](https://github.com/DHokie88/eql-companion-ai) | EQO base `467a03af866ab64d00f93976d38475c258475ea1` | Preserved local Oracle behavior; dedicated review baseline and integration branch |
| [Zeratfule/EQ-Zera](https://github.com/Zeratfule/EQ-Zera) | main / v1.26.1 `780c7afb3fe71f65db2cd8ae9d8c191b8ecc9db4` | Already an ancestor; no whole-repository upgrade needed at this pin |
| [brianmontanaweb/everquest-companion](https://github.com/brianmontanaweb/everquest-companion) | main `ad6857f2d5286291d23ed6975b46212805cb0d78`; v1.17.0 tag is `5e301216fdd1eed692230d9c29677d21b2703db9` | Secondary reference; overlap evaluated against Oracle and Zera implementations |
| [kaltinril/everquest-companion](https://github.com/kaltinril/everquest-companion) | main_community / community-0.1.0-test.30 `ab9d6279e7beb029cecffa319d166ead9961c1cf` | Donor for the selected vertical slices below; TEST.20 through TEST.30 releases inspected |

No repository was blindly merged. Donor source was read at these pinned revisions, then adapted around Oracle's engine, IPC, store, UI and lifecycle boundaries. File differences are not automatically feature gaps. This work establishes the listed capabilities, not exhaustive feature or dataset parity across every path in all three sources.

## Implemented capability ledger

| Capability | Result and integration evidence | Source provenance |
|---|---|---|
| Character/server export ownership | Inventory, achievements and Gear ownership/worn-focus caches reject foreign dumps; legacy serverless behavior retained. Existing 0.9.4 changes stay in this PR. | Community `22fef99f0e56e1cd0893bd4312683acb370fc4ec`, `2d7a3ccbbfb9906d591d1d244b14f05598a9f59e`, `62fc5e7e2e909df04b13f5df62b82c7caf638ca6`; local cache follow-through |
| Discovery I/O races | Missing/unreadable listed files or directories no longer interrupt discovery. Existing explicit folder/log overrides and candidate ordering retained. | Community `d54dc5817f04f99c5c3cec896816ae2a6c8e57b3`, `3754cf114a8a74882192fa46894cf72e64b0f3ec`; 20 new deterministic filesystem tests |
| Bazaar | Normal navigation tab; Rust trade-chat parser/module, daily item/tier WTS/WTB/barter history, per-unit prices, named quotes, charts, tier conversion, outliers, wish/quest/tradeskill filters, CSV export, persistent watches and app alerts. Committed local item facts are batched; no new wiki-fetch path. | Donor head above; parser/quote audit `f18aa58e1987a9742107ddf31a1936c43206f778`, rendered Who-list audit `cfd291f91caa5042d2fd1ecf99dfd28da63dc918`. Imported production paths: `modules/bazaar*.rs`, `shared/bazaar*.ts`, `features/bazaar/*`; all IPC/store/module/nav/alert wiring adapted locally |
| Sky starred-quest overlay | Optional and off by default. Shares existing Oracle quest counts, count-source selection and manual corrections; stays current with the tab closed. Items/icons, ready ordering, click-back navigation, independent bounds and icons toggle. | Community `862bf321dad8e83c02f08bd27a81a907bd4d9c4e`, adapted without replacing Oracle progress arithmetic; additional local stale-reply/world-reset guards in the progress lifecycle and generic module cache |
| Combat reads | One outstanding request per consumer; coalesced refreshes, preserved last valid result while hydrating or temporarily unavailable, Updating badge, stale generation/disposal guards. True empty/selection/world changes clear old data. Damage and healing meters receive reset events without subscribing to ordinary generic-module polling. | Community `1ad3b4855244ede19208c7ba18e35afa0ba31ae8`; local adaptation avoids a cross-mount cache because Oracle combat snapshots lack a trusted world identifier |
| Checkpoint compatibility | Bazaar participates in Oracle's existing engine checkpoint contract. Round trips preserve quotes, deduplication, announcements, live queue and installed knowledge; malformed/future formats are refused atomically. | Local integration required because the donor removed the architecture Oracle still uses; six new checkpoint tests plus existing fold checkpoint parity |

Bazaar watches apply only to new live offers; replay/first hydration does not issue historical alerts. Character/world resets clear the cursor and Heard list before a new baseline. The inherited `alerts.appFired` main handler does not yet add renderer-origin app signals to the engine's generic alert history/event feed. Sound/banner dispatch and the Bazaar Heard list work independently. End-to-end assertions observe the actual alert IPC/banner and Heard list; they do not invent an engine history command.

## Preserved custom behavior

Oracle's versioned spell library, `clientSpells.activate`, immutable spell snapshot identifiers, spell/modifier calculations, Gear priorities and widths, chest/corpse loot distinctions, product identity, settings, disabled telemetry/updater endpoints, and existing manual/inventory/log Sky math remain. The imported features use the generic module-snapshot transport; protocol/generated schema replacement, engine renaming, upstream installers, deployment workflows and mobile applications were excluded.

Engine checkpoints are saved derived state used on log attach/reopen to avoid rebuilding a large log from scratch. They are a startup/reload aid, not proof of lower live-tail latency. Oracle actively uses them; this port preserves that contract. The engine binary/input/log-prefix validation continues to decide whether a saved checkpoint is safe to restore.

## Codeweaver changes actually active

Codeweaver is the separate local Git repository `/home/andrew/codeweave`, not EQO. Its implementation commit is `8cd23de1f3e37d32f42c5bb627a74cf23f4e1594`; it was integrated with a merge commit `def15972a27be3222bde77b59fcaafca25fa68be` into its current operator branch `codex/oracle-peer-review`. It has no configured Git remote, so there is no Codeweaver GitHub PR to link.

The default 60-day rule now runs before Steward's automatic source work. It uses the watched branch HEAD's committer timestamp, retires optional sources at 60 elapsed UTC days, exempts the primary, and treats failed/unknown/future-dated observations as unknown rather than dead. Retired sources retain their cached snapshots and comparison evidence but receive no automatic Git probe, fetch or lazy-network read until explicit manual re-enabling. Manual commands remain deliberate operator actions. No daemon, scheduler, paid model call or autonomous candidate authority was added. Operator lessons were committed separately at `4e4c34acd0686abcd897813e6231bb8d1fc3a46e` and `cc764a75f077a95f54e478d54fe0df9d673531ef`.

All three sources now have explicit `watch_ref` entries in the [evidence specification](community-20261022-wave2-codeweave.toml) and deployed external workspace `/home/andrew/codeweave-eqo-community-20261022`. A real observation on 2026-10-22 confirmed all ACTIVE: Zera activity 2026-10-18, Brian 2026-09-24, Kaltinril 2026-10-22. The [persisted observation](community-20261022-watch.json) records exact heads and timestamps. Watching status does not move the pinned comparison baseline or authorize merges. No periodic scheduler is installed; the rule applies when Steward runs.

Codeweaver's `docs/plans/multi-upstream-operator-support.md` records Andrew's direction: track parity across **all** sources with provenance, distinguish adopted/equivalent/rejected/pending states, make dependency/test closure visible, send nonobvious semantic/UI conflicts to the human, and auto-prepare additive low-conflict work. It also records the observed graph-size limit and future Hermes-manager/Codex-director division. These are explicit next design requirements, not claims that those orchestration capabilities shipped here.

Council testing exposed a reproducibility gap: Hermes's Linux profile selected a relative npm shim inside a hidden home toolchain, while the successful operator runs selected system Node/npm. The sandbox could not resolve that shim's sibling runtime files. Preserve both failure and supported-toolchain results; future Codeweaver work should declare and validate toolchain closure without widening access to private host directories. Windows SSH also needed an explicit project-bin/toolchain PATH in the verification runner. Its token could not follow the dependency junction, so final qualification used a separate physical-dependency checkout at the same committed revision. The SSH session also lacks an interactive cursor and supplies a different account-domain environment: inherited cursor/ACL tests failed there, while the full interactive desktop unit suite passed. Future council preflight must route desktop-bound tests explicitly.

Andrew requested that the council handle routine execution rather than spend Codex tokens on test running. Hermes tasks `t_a2391ee1` and `t_5a539309` performed the independent Codeweaver verification and Windows build/static/release/factoring checks; Codex reviewed failures and ran the Windows desktop-dependent unit, launcher and feature gates. The current managed council repository policy lists only `hermes-custom`, so this uses a bounded test-operator task and the existing AORUS cockpit access skill. Extending managed repository aliases for EQO/Codeweaver and providing AGY with bounded cross-source planning evidence remain concrete setup work; they are not silently enabled by this integration.

## Remaining work and explicit hold

- Factions baseline/evidence UI, buff conflict diagnostics, Wiki Gaps/OCR and durable log archive are still separate unimplemented capabilities. Their concrete paths, source commits and integration boundaries remain in the original comparison. Archive rotation changes live files and needs recovery testing before use.
- Gear index yielding/read timing and login-selection policy remain candidates; preserve Oracle calculations and explicit selections. Gear/Spells display alternatives with a nonobvious preference conflict require Andrew's input.
- Brian loot virtualization uses a different identity model; preserve Oracle `sourceKind` rather than replacing it. AA `aa.ts` is identical at all four pins; Oracle's `aaLedger.ts`/`aaPace.ts` match Zera and Kaltinril, while Brian differs. Differences require semantic review rather than another unconditional port.
- EQO's original `ai-foundation` checkout remains at its prior head with its two pre-existing modified build-info files. PR #1 targets `review/eqo-baseline-20261022`; merging there does not reconcile the 93 earlier unpublished commits with default `ai-foundation`.
- Andrew reports increased real-time lag and pages failing to refresh. **Log-monitoring redesign/optimization is explicitly on hold until this integration is finished.** This work makes no measured claim that the live-tail lag has been diagnosed or fixed. Next investigation should measure tail-to-engine-to-IPC-to-render delay and lost/coalesced invalidations against a safe replay before selecting a change.

## Verification

Windows candidate: `6824656bc4898d98616d03120464e5caa2455270`.

- Hermes: matching release engine build, full three-project TypeScript check, full ESLint and desktop UI build passed in the separate physical-dependency verification checkout.
- Codex, interactive Windows desktop: full unit suite passed, 5,365 passed / 24 skipped / 0 failed (5,389 total). This preserves the desktop-specific tests rather than suppressing them for an SSH session.
- Windows Rust release fold/knowledge suites: 491 passed, one ignored, including six Bazaar checkpoint tests and existing checkpoint parity.
- Codeweaver: 369 tests passed in native operator runs and independently under Hermes with the system toolchain. Its original profile-toolchain failure is retained as described above.

- Codex, normal desktop worktree: rebuilt matching engine/UI and passed the real Open-Fork.cmd launcher gate, Bazaar E2E (19 checks), and Sky overlay E2E (23 checks, including real character switching).
- Hermes's SSH launcher attempt logged a GPU-process crash (exit 34). A subsequent alternate-checkout interactive attempt lost its debugging connection. The normal desktop-worktree launcher then passed with no error suppression or GPU-setting changes. These failed environment/path attempts remain in the local evidence; they are not reported as successful runs.
- Combat dashboard E2E: passed (241 checks), including live staged combat, scope changes, narrow/wide layouts, chart interactions and pet ownership/folding. No renderer console errors. Its optional screenshot timed out; the passing HTML artifact was retained, and no PNG coverage is claimed.
- Final release-note/version, Rust-factoring and whitespace checks passed. Oracle is 0.10.0. The original dirty checkout and live player files/processes were preserved.

The first-wave specification remains unchanged as historical evidence. The wave-two specification adds explicit watched branches; the deployed primary remains the original pinned analysis baseline because fork goals/identity and incorporation state must not be rebound to a new externally committed candidate. The new EQO candidate is retained separately in the analysis clone as `codeweave/community-review-20261022`; no Codeweaver acceptance or incorporation is claimed. All app runs use hidden test windows, isolated profiles and staged logs/exports; live game files and the running player profile are not modified.
