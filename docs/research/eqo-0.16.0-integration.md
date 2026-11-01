# Oracle 0.16.0 integration

Andrew authorized completing and committing the source-informed upgrade on
2026-11-01. Oracle remains the main application. This delivery selects the
highest-priority wiki data foundation from the EOZ/EQL Tools comparison; it does
not claim to ship every feature in the donor analysis.

## Result

Preferences > Wiki data refreshes the wiki-managed item export in a background
worker. It checks compressed SHA-256, declared/actual size, schema and bounded
decoding, writes an atomic cache, and keeps last-good data on failure. New data
activates at the next launch so item lookup, Gear and Exaltation candidate
searches use a consistent session corpus.

Oracle-only item page identities, quest/crafting links, aliases and existing era
evidence are retained. Distinct wiki pages that collide under game lookup keys
are held aside, not chosen by export order. NPC/zone totals describe the export;
this increment does not replace their current catalogs or specialized held-clicky
and worn-focus indexes. Era tags remain source claims, not game-availability proof.

The actual November 1 download passed: 11,380 source item records, 11,356 usable
pages, 24 records in 12 identity conflicts held aside, and 11,646 merged pages.
Every original Oracle item page identity was retained. Export generation was
12:32:52 UTC; publication does not promise that every edit posted today is present.

Existing timer-audio work is included: selected sound/volume, expiry or advance
notification, preview, master mute/volume, and per-character preferences. The
unmerged Reddit feature's premature release notes were preserved in
[their draft](../plans/reddit-rss-unmerged.md), outside delivered release history.

## Codeweaver provenance

- Oracle base: f18df6e55237964f89868a967aaeb487e52c9411.
- EOZ v1.0.0: 11796e8f00cb44784784d9cf29e10749cf798545.
- EQL Tools comparison: dffe5d2a6ad6529672be162450592a8359b2abc5.
- Reviewed and verified candidate: eq-oracle-eoz100-20261101T150647.682874Z.
- Candidate implementation: 3f0021c3c0a01808c28785c117d95d682db0673b.
- Native accepted/incorporated fork commit: 902c4e3dcb7412e2435412e17ed44c2fe2722c34.
- Native incorporation receipt: 94806557d3856d83f7938b617de7510f.
- Operator authority: Codex acting on Andrew's explicit November 1 instruction to
  finish the upgrade, incorporate it and commit it. This is recorded delegated
  authority, not a claim that Andrew independently inspected each patch byte.

The original candidate passed Codeweaver's own isolated typecheck, lint, build,
focused tests and release-note check. Its Windows unit/UI/startup evidence is
separate. Codeweaver's feedback command rejects the external-lead evidence kind;
the actual native candidate, acceptance and incorporation receipts remain
preserved directly. No feedback success is fabricated.

Current delivery evidence is at
`C:/Users/andrew/EQL/reviews/eqo-integration-20261101/`; original donor evidence
is at `/home/andrew/codeweaver-eqo-eoz-20261101/evidence/`. The dated local-work
snapshot, original hashes and patches preserve pre-integration changes.

## Scope remaining outside this release

OCR/screen capture, Live Map, Spare/Valet/Pet and automatic wiki publishing are
not enabled. Their source-backed recommendations remain in the donor analysis.
The old unrelated Update 31 candidate is not silently promoted by this upgrade.
No push, installer publication, telemetry activation or engine reconfiguration
is part of this integration.

## Combined Windows validation

The final wiki/audio combination passed typecheck, full lint, production build
and release-note validation. Its unit suite passed 5,298 tests with 24 skipped
and no failures. The real Open-Fork.cmd startup passed. Both isolated Electron
scenarios passed: wiki dataset lookup/Gear/failure recovery and timer audio
preview, persisted choices/volume and one-shot notification across navigation.
The unchanged Rust engine matches the verified release source.

The supplementary Hermes review t_2b8f8aa7 did not finish within its 600-second
limit and produced no review findings/artifacts. Its original and automatic retry
were archived and their worker termination was verified before closing this
work. It is recorded as incomplete, not counted as a successful independent
review. Codex reviewed the implementation directly; Codeweaver verification and
the combined Windows checks above provide the recorded technical evidence.
