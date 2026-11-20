# EQ Oracle: three-upstream comparison and first safe port

Subsequent implementation wave: see [Oracle 0.10.0 results and current capability states](community-20261022-wave2.md). The prepared labels below describe the first-wave audit and are superseded there where implemented.

Comparison date: 2026-10-22. EQO base: [`467a03af866ab64d00f93976d38475c258475ea1`](https://github.com/DHokie88/eql-companion-ai/commit/467a03af866ab64d00f93976d38475c258475ea1).

## Implemented in this branch

Oracle 0.9.4 adapts three narrowly scoped community fixes:

- Inventory and achievement loaders refuse an export belonging to another character or an explicitly different server. The registry may still discover/display another character's newest file, but that file cannot become the selected character's inventory or earned Sky rewards.
- Matching is case-insensitive and checks the complete filename. Existing exact-character serverless exports and unnamed-character discovery remain supported.
- A dump deleted or locked after its status check produces a warning and no loaded dump, instead of escaping startup before the engine attaches.

Adapted from Kaltinril commits [`22fef99f0e56e1cd0893bd4312683acb370fc4ec`](https://github.com/kaltinril/everquest-companion/commit/22fef99f0e56e1cd0893bd4312683acb370fc4ec), [`2d7a3ccbbfb9906d591d1d244b14f05598a9f59e`](https://github.com/kaltinril/everquest-companion/commit/2d7a3ccbbfb9906d591d1d244b14f05598a9f59e), and [`62fc5e7e2e909df04b13f5df62b82c7caf638ca6`](https://github.com/kaltinril/everquest-companion/commit/62fc5e7e2e909df04b13f5df62b82c7caf638ca6). The donor adaptation changes `src/shared/outputs/kinds.ts` and `src/main/outputs/index.ts`. Thirteen loader integration tests exercise the real discovery and parsers with committed fixtures in temporary installations, including a deterministic deletion between status and read.

Independent code review also found an integration gap in the existing Gear ownership and worn-focus caches: their path/mtime keys could match another character's fallback file before reaching the loader. The patch additionally checks ownership before returning these cached results in `src/main/ipc/planner.ts` and `src/main/planner/wornFocusCurrent.ts`, with regressions that prime one character's cache and switch to another. This is local integration work, not a claim that the donor commits fixed these caches.

This prevents new incorrect imports; it does not rewrite existing saved inventory or undo historical progress that might already have been imported incorrectly. Failures during directory listing or the first discovery stat are a separate, prepared follow-up below.

## Verified source identities

EQO is [DHokie88/eql-companion-ai](https://github.com/DHokie88/eql-companion-ai), maintained locally at `C:/Users/andrew/eql-companion-ai`. `ai-fork.json` identifies its two existing sources. Codeweaver is the separate tool at `/home/andrew/codeweave`, inspected at `e0d4a9ba01622a608d2ab1958e024696af9cc72c`; EQO is not the Codeweaver implementation repository.

| Source | Selected branch snapshot | Release inspected | Local remote |
|---|---|---|---|
| [Zeratfule/EQ-Zera](https://github.com/Zeratfule/EQ-Zera) | `main` at [`780c7afb3fe71f65db2cd8ae9d8c191b8ecc9db4`](https://github.com/Zeratfule/EQ-Zera/commit/780c7afb3fe71f65db2cd8ae9d8c191b8ecc9db4) | [v1.26.1](https://github.com/Zeratfule/EQ-Zera/releases/tag/v1.26.1), same commit | `upstream` |
| [brianmontanaweb/everquest-companion](https://github.com/brianmontanaweb/everquest-companion) | `main` at [`ad6857f2d5286291d23ed6975b46212805cb0d78`](https://github.com/brianmontanaweb/everquest-companion/commit/ad6857f2d5286291d23ed6975b46212805cb0d78) | [v1.17.0](https://github.com/brianmontanaweb/everquest-companion/releases/tag/v1.17.0), tagged `5e301216fdd1eed692230d9c29677d21b2703db9`; selected main is newer | `brianmontanaweb` |
| [kaltinril/everquest-companion](https://github.com/kaltinril/everquest-companion) | `main_community` at [`ab9d6279e7beb029cecffa319d166ead9961c1cf`](https://github.com/kaltinril/everquest-companion/commit/ab9d6279e7beb029cecffa319d166ead9961c1cf) | [community-0.1.0-test.30](https://github.com/kaltinril/everquest-companion/releases/tag/community-0.1.0-test.30), same commit | `community` |

`jmoyers/everquest-companion` is the original ancestry/reference, not one of the two sources recorded in EQO's fork manifest. The unrelated original checkout was inspected only for identification and left untouched.

The release inspection covers Kaltinril TEST.20 through TEST.30. TEST.20 describes the first broad feature set; later releases add fixes, wiki workflows, local OCR, first-sight respawns, performance work and economy analytics. TEST.30 was published 2026-10-22 at 09:24:39 UTC. Source tags were checked independently of the release API's `target_commitish`. The release index is in `community-20261022-releases.json`.

## Code-level comparison and prioritized next work

The table records observed implementation differences and integration plans, not claims that entire features were imported. Paths are relative to each source snapshot above.

| Priority / state | Capability and evidence | Smallest safe integration and required tests |
|---|---|---|
| P0 / implemented | Character export isolation and post-status read failure: `src/main/outputs/index.ts`, `src/shared/outputs/kinds.ts`. | Surgical loader changes plus real-fixture ownership, case/server, unnamed/legacy, preference and read-race tests. |
| P1 / prepared | Discovery I/O races: EQO `outputs/discovery.ts` directly stats listed candidates. Community skips a vanished candidate in [`d54dc5817f04f99c5c3cec896816ae2a6c8e57b3`](https://github.com/kaltinril/everquest-companion/commit/d54dc5817f04f99c5c3cec896816ae2a6c8e57b3); log folder protections in [`3754cf114a8a74882192fa46894cf72e64b0f3ec`](https://github.com/kaltinril/everquest-companion/commit/3754cf114a8a74882192fa46894cf72e64b0f3ec). | Next bounded patch: test list-to-stat deletion, denied/unreadable directory, healthy remaining candidate, no game-file changes. Preserve selection order. |
| P1 / prepared | Combat stale reads and request coalescing: `features/combat/combatFeed.ts`, `useCombat.ts`, overlay polling; [`1ad3b4855244ede19208c7ba18e35afa0ba31ae8`](https://github.com/kaltinril/everquest-companion/commit/1ad3b4855244ede19208c7ba18e35afa0ba31ae8). | Retain last valid snapshot while updating. Test character/rebuild generations, stale completions and one request in flight before adapting both meter surfaces. |
| P1 / prepared | Main-thread diagnostics and sliced/prewarmed gear index: `src/main/dataServer/slowReads.ts`, `planner/gearIndex.ts`, `yieldingSteps.ts`; also `705d3890ac9e33095c311d47c6b0ed88ce15ae57`. | Split read timing from index changes. Prove index/result equivalence and preserve Oracle stat priorities; measure actual tab latency. |
| P1 / prepared | Character startup/login selection: `src/main/log/discovery.ts`, `session.ts`, `switchNudge.ts`; community `55efa319`, `d88a6745`. | Extract the pure selection helper first. Preserve explicit selection and Oracle `notifySpellModifierInputs`; test saved vs recently played character before adopting policy. |
| P1 / overlap | Brian loot scrolling/detail work: [`44c9a696`](https://github.com/brianmontanaweb/everquest-companion/commit/44c9a696), `features/loot/useLootDetail.ts`. Brian expands sortable headers at selected head `ad6857f2`. EQO already has `TableSortLabel` sorting; core `LootTables.tsx`/`lootSort.ts` match EQ-Zera. | Profile detail-render/windowing changes separately. Test sort stability and item detail across virtualization; preserve Oracle item upgrade and gear behavior. |
| P2 / partial overlap | First-sight respawn learning: `engine/crates/fold/src/modules/respawn_seen.rs`, `src/shared/respawn.ts`, new `respawnWatchList.ts`; [`22256d05bbaf55ec10071cf1d523bff6bdc5147d`](https://github.com/kaltinril/everquest-companion/commit/22256d05bbaf55ec10071cf1d523bff6bdc5147d). | EQO already has timers and seen evidence. Add speech/hail evidence and end an interval at first life evidence; separate kept overrides. Requires Rust tests/rebuild, shared schema, IPC/store, timer tab/overlay exercises. |
| P2 / absent | Bazaar: `engine/crates/fold/src/modules/bazaar*.rs`, `src/shared/bazaar*.ts`, `features/bazaar/BazaarView.tsx`, `storeBazaarWatch.ts`, `ipc/bazaarWatch.ts`; later quote audit `f18aa58e1987a9742107ddf31a1936c43206f778`. | Vertical slice: parsed trade offers → item identity → served module → read-only UI. Add watch/alert persistence later. Test ambiguous names, unpriced/uncertain quotes, outliers and character separation. |
| P2 / partial overlap | Factions: EQO has a character faction panel and fold module; community adds `features/factions/FactionsView.tsx`, `factionsEvidence.ts`, `ipc/factions.ts`, dump-backed baselines, quest/race work filters. Sources `197dcbcf526003cb5060777d2bf142bb866e0353`, `ce82628aa0ba2704551657a664e46b68266b81d9`. | Graduate verified `/outputfile faction` format and ownership first; then baseline plus live receipts, store/watch and dedicated UI. Test no double count and distinguish base standing from game-adjusted regard. Do not copy community feature gating. |
| P2 / mixed | Sky starred-quest overlay (`src/shared/skyQuestOverlay.ts`, `862bf321dad8e83c02f08bd27a81a907bd4d9c4e`) and buff conflicts (`shared/buffConflicts.ts`, fold module, `c98ae265709ab4eae5b91a2d3799b1e4d00a4372`). | Sky can share existing progress with a new optional overlay. Preserve Oracle counting. Buff conflicts need parser/fold/module registration and UI, plus measured overwrite/stack fixtures. AA `aa.ts`, `aaLedger.ts`, `aaPace.ts` already match EQO; do not treat AA as a missing feature. |
| P3 / absent | Wiki Gaps + screenshot OCR: `modules/gaps*.rs`, `features/gaps/GapsView.tsx`, `gapsCharacters.ts`, `src/main/shot/*`, `ipc/shot*.ts`. Head includes own-character exclusion `95b480ed` and wiki filename normalization `3aff82a0`. | First build read-only unknown-entity evidence from one character. Then persisted/all-character input, page drafts and screenshot capture. OCR adds `tesseract.js@7.0.0` and English data packaging. Test players/pets/redirects, evidence provenance, isolated characters, IPC and screenshot validation. |
| P3 / absent | Log archive: `src/main/logArchive/{actions,capture,backup,rotate,refold,segmentStore,history}.ts`, `src/shared/logArchive/*`, archived fight UI; recent fixes `2bbb73a5`, `3c2e5414`, `e52127c2`. | Separate project: durable recovery, second engine, history merging and interrupted rotation. It can write/rotate the live log; keep disabled until crash/recovery and preserved-history tests pass with synthetic installs. No live-log writes were authorized or performed here. |

Already covered or deliberately preserved:

- EQ-Zera v1.26.1 is an ancestor of EQO, not a pending wholesale upgrade.
- EQO already reads the newer client spell-file column layout in TypeScript and Rust. Its dedicated versioned spell catalog and calculations are more specific than the community fix; no spell-parser replacement was imported.
- EQO loot distinguishes `sourceKind: 'corpse'` from chest/container sources. Importing community `droppedBy.ts` blindly would discard that existing model.
- Community renames the engine crate/executable and changes protocol/module serving. Whole-schema replacement removes EQO's `clientSpells.activate` request/result and immutable `snapshotId` fields (`src/shared/dataServer/protocol.generated.ts`), breaking Oracle's custom spell library.
- Preserve Oracle session modifier notifications, Gear priorities/widths, profile and brand identity, Sky inventory behavior, telemetry/updater disablement. Exclude upstream installers, test-channel bypasses, release workflows, deployment ownership and the separate mobile project.

`community-20261022-inventory.json` records exact tree IDs, dependency differences and directory-level added/modified/deleted counts. The snapshots differ across 416 paths for EQ-Zera, 2,816 for Brian and 2,671 for Kaltinril. These are file differences, not counts of missing features. Data caches, formatting and fork customizations contribute; no exhaustive semantic or dataset equivalence is claimed.

## Codeweaver and upstream tracking actually configured

- All three upstream Git remotes are configured and fetched in the EQO repository. None is an automatic merge source.
- External workspace: `/home/andrew/codeweave-eqo-community-20261022`; specification: `composition.toml`; the isolated primary snapshot is `sources/oracle` at EQO base `467a03af...`.
- `fork-attach` completed with the primary classified as `fork` and all three sources classified as `upstream`, with the protected behaviors above recorded.
- Pinned acquisition, four source inventories, capability comparison and the bounded `ownsOutputFile` source brief completed. `community-20261022-codeweave.json` contains attachment/source locks, evidence hashes, report references and limitations. `community-20261022-codeweave.toml` is an evidence copy intended to be deployed outside source checkouts beside `sources/oracle`.
- The project is registered as `eq-oracle-three-upstreams` in Codeweaver's dashboard registry. No scheduler, autonomous execution, model invocation, paid call, candidate acceptance or incorporation was enabled.
- `fork-plan` prepared draft `proposal-20261022T142443.901656Z` for the nine runtime/test/version/release-note paths. Its patch SHA-256 is `eab919b6354c8b9f872765277c1ebd6b5d1d2913734bf1199f4dd8c9bed5bf14`; `git apply --check` succeeds against the isolated primary. It records the two adapted source paths and the local cache integration. This proposal was not executed or accepted in Codeweaver: runtime qualification was performed on Windows, and the documentary/tracking additions are outside that bounded implementation patch.
- Graph retrieval fell back to selective lexical evidence: the forest exceeded Codeweaver's 512 MiB streaming read bound. Actual Git diffs and source reads support this report; the graph does not establish dependency completeness.

To refresh, fetch `upstream`, `brianmontanaweb` and `community`; inspect new release tags and branch commits; deliberately update the external specification's source pins and primary snapshot; regenerate comparison/briefs before planning another patch. `ai-fork.json` records the branch names, exact reviewed commits and protected behavior. The snapshot remains pinned intentionally; `--refresh` alone does not change an exact-commit pin.

## Branch and review boundaries

The original `ai-foundation` checkout was 93 commits ahead of remote `origin/ai-foundation` and had two existing modified build-info files. It was not reset, rebuilt, switched, merged or pushed. The integration lives in a separate worktree on `integration/community-safe-20261022` based on its actual current head `467a03af...`.

The review base is `review/eqo-baseline-20261022` at that same head, so this PR can review just the selected port and evidence without folding 93 earlier unpublished commits into its diff. The baseline branch is a review reference, not a proposed default-branch update. Merging this PR into that reference does not deliver the preceding local history to `ai-foundation`; default-branch reconciliation remains separate.

No source repositories were merged, no release tag was created, no installer was published and no upstream application was installed. The candidate is for review, not an automatic live-profile migration.

## Verification

Windows AORUS, isolated worktree/profile and temporary EQ installation:

- Focused output suites: 68 passed, including 13 new loader tests. The cache integration adds six regressions (19 new tests total); its 50-test focused group also passed.
- `npm run check:release`: passed for Oracle 0.9.4; package and root lockfile versions agree.
- `npm run build`: passed.
- `npm run typecheck`: all three projects passed.
- `npm test` on the final runtime patch: 5,257 passed, 24 skipped, 0 failed (5,281 tests).
- `npm run test:startup`: passed, launching real `Open-Fork.cmd`, built UI/preload and release engine in an isolated profile.
- `npm run lint`: passed on the final runtime patch.
- `sky-inventory-autoload.e2e.mts` and `sky-achievements.e2e.mts`: passed again on the final runtime patch. They exercise appearance/rewrite pickup, startup reload, refresh confirmation/failure preservation, earned achievement claims and absent-dump behavior.
- Independent native Codex code review identified the cache-bypass gap; after its fix, a second review found no additional actionable issues.
- `git diff --check` and isolated-primary `git apply --check`: passed.

Some optional inventory artifact screenshots timed out while waiting for fonts; all E2E assertions passed and HTML artifacts were retained. No screenshot coverage beyond the captured artifacts is claimed.

Intermediate Windows logs are under the task's `work/` directory. E2E artifacts are local and ignored. The first startup check reused the existing matching Oracle release engine; the later E2E harness built the worktree's release engine from unchanged Rust inputs. No Rust behavior was modified in this port.
