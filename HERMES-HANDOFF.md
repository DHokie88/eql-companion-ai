# EQ Oracle recovery - completed in 0.3.0 (2026-10-19)

Subsequent screenshot feedback is addressed in Oracle 0.4.0. See
[the rank-source audit and Browse corrections](docs/verification/spell-ranks-and-browse-2026-10-19.md).

The 0.5.0 follow-up adds two-decimal efficiency, corrects the missing ordinary
DoT pulse and documents the remaining hybrid initial-hit uncertainty. See
[the follow-up evidence](docs/verification/spell-rank-followup-2026-10-19.md).

The Windows recovery below is complete. The original Hermes handoff is preserved
after this closure as historical evidence, not a remaining task list.

## Completed Windows recovery

- Reviewed the interrupted Codex request, both recovery commits and the current
  Windows checkout. Kept the restored rank-lineage suite and the separate captured
  line tests; no implementation was restarted from scratch.
- Finished lint-required factoring of Browse rendering and sorting. Shared category
  suppression between the table and sort controls.
- Repaired the grouping desktop fixture: complete rows rather than flattened
  fields, positive buff duration, no unintended recourse, and an explicit ID sort.
  Polling now asserts its final result instead of silently continuing on timeout.
- Exercised grouping, best-to-worst alternatives, uncollapsed counts, uniform Type
  suppression, hiding every optional column, Description and the spinner-free level
  control. Fixed the new column test's changing-selection locator before delivery.
- Corrected the healing filter's expected alphabetical order. Removed the attempted
  substitution of a calculated ranking group for the deleted raw-mana filter:
  unsupported zero-mana songs are not equivalent to supported zero-mana rankings.
  Broad healing and Helpful / harmful filtering remain asserted; ranking groups
  are covered by the separate spell-analysis desktop spec.
- Corrected the release notes' unsupported claim about grouping damage/DoT lines.
  Grouping remains conservative for supported stat buffs. Installed data confirms
  Armor of Faith, Guard and Holy Armor share a supported candidate key and order
  strongest to weakest at level 50. No game data was modified or copied into tests.
- Released the new grouping/columns/filter features locally as 0.3.0, following the
  fork's minor-for-features rule, with matching package/lockfile/Oracle notes.

## Final verification on Windows

All checks below passed against the delivered production sources:

- `npm run build`, then `npm test`: 5,205 passed, 24 skipped, zero failed
  (23.1 seconds for units). Build and unit execution did not overlap.
- `npm run typecheck`, `npm run lint`, `npm run check:release`, `git diff --check`.
- Five relevant desktop specs passed. Leveling, spell analysis and spell library
  passed in run `2026-10-19T20-07-42-532Z`; grouping/columns passed in run
  `2026-10-19T20-16-33-749Z`; corrected Browse controls passed in run
  `2026-10-19T20-18-50-557Z`. Earlier failing test runs remain preserved.
- `npm run test:startup`: real `Open-Fork.cmd`, main window, Overview, preload IPC
  and matching release engine ready in an isolated profile; passed in 6.7 seconds.
- Visually inspected the current Browse-controls PNG. Some other hidden-window
  screenshots timed out; their DOM artifacts and assertions remain available.

Runner output is preserved in `C:\Users\andrew\EQL\output\oracle-resume-*.log`;
desktop artifacts are under `tests/e2e/artifacts/<run-id>/` (ignored by Git).
The pre-existing tracked TypeScript build-cache changes are excluded from the
delivery commit. Nothing was pushed, tagged or published.

No work from the interrupted Oracle spell-table request remains unverified.
DoT/rain/shared-timer grouping remains unavailable where the captured data cannot
establish a replacement relationship; these spells stay visible individually.

## Original Hermes handoff (0.2.2)

State of `C:\Users\andrew\eql-companion-ai` as left by Hermes (aw agent):

- Branch `ai-foundation` is at **`86a0d53`** "Complete the 0.2.2 round-2
  spell table work" — the commit message carries the full rationale
  (what it changed, why the old suite came back, test evidence).
- `wip/oracle-0.2.2-round2` still holds GPT's original raw checkpoint
  (`983f2a8`); `oracle/0.2.2-round2` is the completed line
  (`983f2a8` → `86a0d53`). Nothing is pushed to GitHub.
- aw-side verification (in `~/.hermes/cache/scratch/oracle-work`):
  line suites 15/15, release notes 22/22, typecheck clean, release
  gate OK. Full unit suite on Linux is green except 3
  platform-specific tests (`zengine.exe`, `C:/` root, `touchFile`
  mtime) that fail identically at the `a2d1b7d` baseline on Linux and
  pass on Windows.
- Windows verification was started (typecheck passed; unit suite was
  running) and then stopped at Andrew's ask — nothing here is
  verified on the Windows host. To finish: `npm run typecheck`,
  `npm test`, `npm run check:release`, and the new spec
  `npm run test:e2e -- lines`. A ready runner with a stale-lock guard
  is at `C:\Users\andrew\oracle-gaunt.ps1` (logs to
  `oracle-gaunt.log`); run ONE instance at a time — two `node --test`
  runners in this checkout deadlock each other on shared stores
  (that wedge cost ~5h, root-caused 2026-10-19).
