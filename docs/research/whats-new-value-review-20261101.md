# What's New / New in EQL: value and efficiency review

Reviewed November 1, 2026, approximately 1 PM America/New_York. EQO source: `ee69e4a0154b99598e89a2c95f26f39e154c2d8a` (0.17.0). Harvester source: `ff2b5319aa75f04861acc33f01e49ac195187d95`. This is an evaluation and recommendation, not an implementation change.

## Judgment

The current feature gives poor value for its collection and processing cost. The main failures are stale publication, coupling a small news digest to the complete research archive, and presenting an archive as a news workflow. Collecting more Discord history or using a larger model would not repair those failures.

A quiet day can legitimately produce zero highlights. Two highlights alone do not establish poor selection quality. Here, however, those two cards are old, the successful-check timestamp is over four days behind, and repeated failed checks have consumed substantial work without delivering fresh updates.

Keep the attributed archive for Ask EQ Oracle if a retrieval benchmark demonstrates its value. Give news a separate small, reliable publication and reading path.

## Measured state

Sizes below are decimal MB/GB; memory measurements use MiB/GiB.

| Measurement | Observed result |
|---|---|
| Published Discord records | 87,316 |
| Default Highlights result | 2 cards |
| All-updates result | 4,803 entries, mostly historical reports/discussions |
| Last successful live check | October 28, 08:18:31 EDT; `2026-10-28T12:18:31Z` |
| Current package assembled | October 29; assembly did not advance successful live-check time |
| Last saved top-level message date | October 29, 04:16:50 EDT |
| Available completed harvest logs since October 28 | 16 runs; 14 subsequent runs failed after the two successful ones |
| Aggregate failed-run work | 73,129 API requests; 21.3 collector wall-hours |
| New observations reported in those failed runs | 3,089; these are counters, not a deduplicated message audit |
| Latest completed quick check | 797 requests; 900.5 seconds; 59 new and 232 updated observations; failed |
| Median failed scheduled full check | 6,439 requests; 110.5 minutes |
| Accumulated raw archive on AW | Approximately 503 MB |
| Current Windows published reference folder | 540 MB across 36 files |
| Runtime dataset JSON | 234 MB |
| Q&A/facts portion | 197 MB; 84.2% of runtime dataset bytes |
| Previous Windows generations retained | 12; 4.21 GB, additional to the current folder |
| Isolated built news-worker cold request | 6.171 seconds to return the two highlights |
| Isolated process memory | 38 MiB baseline; 1,672 MiB sampled peak, approximately 1.63 GiB |
| Subsequent cached all-updates request | Approximately 3 ms additional elapsed time |

The default cards are “Nektropos Castle quest softlock workaround” (October 27) and “Free Werewolf Petamorph Wand in Marketplace” (October 22). The latter explicitly warns that its end date is unknown and availability may have changed. This review did not verify their current in-game validity.

The archive total is accumulated storage, not the amount downloaded on every refresh. The collector does use incremental message cursors. API request counts are measured from its logs; actual network byte totals were not captured. The memory probe includes the combined catalog and Discord search index in an isolated Node process, not total memory of Andrew's running EQO app.

## Findings, ordered by impact

### P1: One failed source prevents all newly collected information reaching the app

The latest finished check reports an invalid ID/parent/archive state during active-thread search. The same signature appears throughout the failed-run history; some runs also report DNS errors. The collector returns failure when its error list is nonempty. The pipeline invokes it with `check=True`, so extraction, editorial selection and publication do not run after that failure. Successful observations can remain in the raw archive while the app keeps its previous snapshot.

At observation time another startup check, begun November 1 at 12:53 EST, was still running. It was excluded from completed-run totals. The live service and raw files were not stopped or changed.

Relevant code: `Z:/eql-discord-harvest/harvest.py:465` and `:596`; `Z:/eql-discord-harvest/pipeline.py:17` and `:78`. The scheduled and startup services both use the same pipeline. Automatic checks have a 30-minute cooldown after a successful check; failed runs do not produce that fresh successful timestamp.

Recommended repair: isolate source failures and preserve validated last-good data per source. Publish healthy sources with explicit partial coverage and individual check times. Advance an overall complete-check timestamp only when its stated coverage was actually checked. Add source-specific retries/backoff so one bad thread search cannot waste every later cycle. Keep validation and atomic publication.

### P1: A two-card news screen loads and indexes the complete research corpus

`C:/Users/andrew/eql-companion-ai/src/main/oracle/worker.ts:12` calls both catalog loading and Discord loading for feed requests, then constructs `OracleIndex` before returning either a search or feed result. `C:/Users/andrew/eql-companion-ai/src/main/oracle/runtimeDiscord.ts:21` reads the complete published generation. `C:/Users/andrew/eql-companion-ai/src/main/oracle/discord.ts:25` walks all nine datasets, including Q&A/facts.

This is why opening news incurs archive-scale work even though the final digest is approximately 1.9 KB. Moving it off the log-tailing thread is good, and the unchanged-generation cache makes later reads fast. The cold load and every changed-generation rebuild are still disproportionate to the screen's purpose.

Recommended repair: read and validate a small standalone news manifest/digest for the feed. Initialize catalog search and historical Q&A indexes only when an assistant search needs them. Keep feed and search caches independent.

### P2: Publication transfers several representations of the same archive

`Z:/eql-discord-harvest/publish.py:233` checks the remote manifest. If anything differs, it creates an uncompressed tar of the entire staged reference directory (`:267`) and uploads it. The folder includes readable JSON, Markdown, runtime JSON and the source-import ZIP. A successful check changes refresh metadata and therefore the generation manifest, even when most large content files are unchanged.

Consequently the current publisher's changed-generation transfer is approximately the full 540 MB folder, rather than a changed-files delta. This is verified implementation behavior and local payload size, not a packet capture of a particular transfer. Previous generation directories are retained; twelve currently total 4.21 GB.

Recommended repair: publish the tiny news package independently; transfer changed content-addressed files or a compressed changed-files bundle for archive updates. Build the developer import ZIP on demand. Define a bounded retention policy for verified prior generations. Existing backups were not deleted during this review.

### P2: The collection schedule optimizes archive completeness over fresh news

The timer runs at 07:00, 15:00 and 21:00 Eastern. Scheduled checks revisit thousands of inactive archived threads for edits; startup quick checks reuse completed inactive archives but still search and read hundreds of sources. The last quick check reused 5,565 archives and still made 797 requests for 59 new observations.

Recommended repair: prioritize announcement/patch/status sources and changed active discussions on a short news cycle. Reconcile historical archives separately and less frequently. Preserve reasonable API pacing while reducing the number of unnecessary requests. Collect and expose per-source outcomes, not only a global record counter.

### P2: Large input volume is not connected to a useful-news workflow

The default category is Highlights (`C:/Users/andrew/eql-companion-ai/src/renderer/src/features/community/CommunityView.tsx:23`). Legacy highlight records become searchable sources but are not automatically digest cards (`C:/Users/andrew/eql-companion-ai/src/main/oracle/discord.ts:47`). That distinction is sensible: popularity and salience are not necessarily actionable news.

The editorial prefilter in `Z:/eql-discord-harvest/must_read.py:114` uses a narrow keyword expression, seven datasets, the last twelve replies per thread, at most 180 candidate sources and a 100,000-character evidence budget. Q&A/facts is not an editorial input, despite consuming most runtime bytes. These limits are visible design constraints; this review did not establish a numerical false-negative rate. Removing them blindly would add chat noise and larger model prompts.

The screen has no “new since I last read,” material-change grouping, local usefulness feedback, or mapping into the selected loadout, Build and Wishlist workflow. Regular thread dates use the starter's provenance; a new reply in an old thread can remain buried under its old card date. Highlights without a deadline can remain eligible for fourteen days (`C:/Users/andrew/eql-companion-ai/src/main/oracle/mustRead.ts:64`). Reopening the page does not mean the cards are newly discovered.

Recommended repair: label recent material changes and last successful source checks; group repeated discussion of the same change; offer current opportunities, confirmed announcements and relevant player findings separately. Match known item/spell/class/zone references to EQO detail pages and optionally the chosen loadout/wishlist. Every card should answer “what changed, why does it matter to me, what can I do, what evidence supports it?” Keep source trust and uncertainty explicit.

### P2: Editorial failures and rejection reasons do not have a product-level scorecard

The editor makes a draft and a grounding pass, then applies strict link, number, deadline and corroboration checks. On editor failure it can retain the prior digest or an empty digest while reporting a completed build. Preserving trustworthy old data is sensible, but the UI needs a separate editorial-success time and explanation for “no new cards.”

The latest failed collection jobs never reached this editorial stage, so a model change would not repair their publication failure. There is also no measured basis here to claim that the historical Q&A archive produces good assistant answers merely because it is large.

Recommended repair: count candidates, promotions, duplicate stories, expiry removals, rejection reasons and editorial failures. Evaluate a small manually labelled recent-news sample and a fixed set of useful player questions. Measure supported actionable findings and retrieval quality, not tokens or stored record count. This can remain local.

## Recommended implementation sequence

1. **Restore fresh publication.** Repair active-thread discovery failure handling, add per-source coverage/backoff, and verify one actual published refresh without overstating coverage.
2. **Make news inexpensive.** Separate the digest/feed path from the research search index; prioritize the small news transfer before archive reconciliation.
3. **Reduce repeated collection and copying.** Separate news and archive schedules, introduce changed-file transfer, and agree a bounded backup policy.
4. **Improve the product output.** Add unread/material-change state and actionable source-linked cards, then relevant class/loadout/item links.
5. **Prove value.** Use a labelled sample, a retrieval question set, source freshness and local helpfulness feedback to guide selection changes.

Suggested acceptance targets are proposals, not measured achievements: the common news-only path should not parse historical Q&A or construct the catalog search index; a source failure should not withhold validated changes from healthy sources; an unchanged archive should not be recopied because only a check timestamp changed; known high-value sample findings should be surfaced with correct provenance and expiry; and opening news should use a small fraction of the current cold-load time and memory.

Do not set a daily highlight quota. A trustworthy “checked successfully; nothing important changed” is useful. A busy collector behind stale cards is not.

## Evidence and scope

Live files, source and service state were inspected read-only. No extra Discord collection, AI editorial call, refresh request, schedule edit, profile edit or cleanup was triggered by the audit. One owned standalone built-worker probe read the existing snapshot and was terminated after its results. Documentation is the only repository change.

Codeweaver grounded selective source retrieval at exact EQO commit `ee69e4a0`; its brief was partial and omitted two excerpts under its context budget. Those relevant source files were also inspected directly. This is an audit, not a Codeweaver implementation/acceptance claim.

Machine-readable receipts and probe scripts: `C:/Users/andrew/EQL/reviews/eqo-whatsnew-20261101/`. AW evidence: `/home/andrew/codeweaver-eqo-news-audit-20261101/`. Files include `windows-snapshot-metrics.json`, `harvest-run-metrics.json`, `mirror-backups.json`, `isolated-feed-probe.json`, `discord-brief.json` and their evidence hashes. Earlier scratch-script syntax failure was corrected before measurements; none of its partial output was used as a result.
