# EQ Oracle local spell library

Spells appears below Leveling and above Buffs. Browse, Compare, and History use the player's
`spells_us.txt`, `spells_us_str.txt`, and `dbstr_us.txt` from the configured EQ installation.
Class and level filters express client eligibility, not confirmed ownership or acquisition.
The catalog retains numeric IDs, full names, ranks, internal/NPC records, every raw column,
decoded effects, descriptions, messages, and category names. Legacy name-based links still
open the supplementary wiki/lineage page with their existing Back navigation.

## Checks and publication

Checks run at Oracle startup, when the existing five-second presence worker sees a new client
identity (PID plus kernel creation time), when the configured installation changes, and through
Check for updates. A launch never changes the selected installation. No scheduled task or
closed-app watcher is installed.

Every check hashes all three complete files. Two observations must match one second apart;
captured bytes are copied and the originals rehashed before import. Unstable/unavailable reads
retry after 2, 5, 10, and 30 seconds. Overlapping checks coalesce; installation changes supersede
old replies. An unsuccessful refresh leaves the last valid catalog available and reports its error.

The import worker uses built-in `node:sqlite`, WAL, foreign keys, prepared statements and an
atomic publication transaction. A separate query worker pins one read transaction per request.
Neither worker writes to the game installation. The database, content-addressed gzip archives,
and temporary reader generations live in `app.getPath('userData')/spells/`.

Source content identities depend only on the three hashes. Parser generations have separate
snapshot identities; unchanged interpreted records share immutable revision rows. Observations
are ordered independently of content, so A to B to A records a rollback without duplicating A's
source files. Field differences are persisted with publication and can also be calculated between
arbitrary captured snapshots. Unknown raw changes, layout changes, and parser changes are labeled.
Only active/pending reader generations keep uncompressed source files; older ones reconstruct
from archives. No automatic history pruning is performed.

Dates mean first observed by Oracle, not an official patch date. History starts at the first
baseline. Versions that changed while Oracle was closed cannot be reconstructed without older files.

## References and calculations

The pure TypeScript parser accepts 173 columns and the 174-column layout with its inserted
column. TypeScript and Rust compatibility projections share synthetic interpretation fixtures.
The full SQLite catalog is authoritative; name projections deliberately retain their old collapsing
behavior for existing consumers.

Activation preloads captured references outside the engine's world lock and swaps its immutable
spell handle under installation/epoch/request guards. It does not attach, reset combat, or rebuild
the live fold. Successful engine attaches replay the selected reference. TypeScript, Leveling, and
renderer caches follow the installation/revision and discard stale asynchronous answers.

Compare accepts up to four IDs. Rankings scan the full eligible catalog in one dataset and
separate direct, full-duration periodic, zero-mana, and excluded results. The pure calculation
layer follows the standalone spell site's supported effect/duration rules. Results are unmodified
client values per target, not combat ceilings. Unsupported formulas and repeated waves are
excluded explicitly. Focus, AA, motes, instruments, crits, resists, and chained recourse are outside
this model. SPA 100/334 and complete-heal models remain explicit exclusions in this first version.

The typed `window.eq.spellLibrary` bridge exposes status/check, paginated search, exact-ID detail,
comparison/ranking, snapshots, change lists, before/after and per-spell timelines. Replies identify
their dataset. Subscriptions carry small status/revision messages. No SQL or filesystem access is
exposed by this bridge. AI, web research, stacking, modifier simulation, and durable combat history
remain separate milestones.

## Validation

Synthetic parser/calculation, capture, SQLite/WAL, process-identity and coordinator tests run in
`npm test`. `tests/e2e/spell-library.e2e.mts` exercises real workers, preload/UI, source refresh,
history/diffs, rollback, pagination, failed publication, restart recovery, and unchanged engine epoch.
Run it with `node --import tsx tests/e2e/spell-library.e2e.mts`.

The fork gate remains `npm run typecheck`, `npm run lint`, `npm test`, affected Rust tests,
`npm run build:engine`, `npm run build`, and `npm run test:startup` using the real `Open-Fork.cmd`.
Finish the app build before running the full unit suite: its symbolication checks inspect the
emitted bundles/maps and must not race a rebuild of `out/`.
Game source bytes and derived private catalogs must never be committed.
