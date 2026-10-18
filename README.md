# EQ Oracle (EQO)

A Windows desktop companion for **EverQuest Legends**. It reads the log file the game already
writes and turns it into live views: a DPS meter, floating overlays, Plane of Sky quest tracking,
loot and item knowledge, XP/AA progress, raid-target history, buff timers, and sound alerts.

It reads your log and the three client spell data files. Nothing is injected into EverQuest,
no game files are modified, no game memory is read, and gameplay is never automated.

## Origin

EQ Oracle (EQO) is a development fork of EQ Zera / [everquest-companion](https://github.com/jmoyers/everquest-companion)
("EQ Legends Companion") by Josh Moyers. The original app is still
published and still works for the game: get it from its
[releases page](https://github.com/jmoyers/everquest-companion/releases/latest). The upstream
README is preserved as [`README.upstream.md`](README.upstream.md); the upstream architecture
guide is [`AGENTS.md`](AGENTS.md) and is still the best map of the code.

## What changed in the fork

- **Renamed** to EQ Oracle (EQO).
- **Spells below Leveling.** Browse exact client IDs and ranks, compare unmodified damage and
  healing, and inspect captured versions and field changes in History. Oracle checks all three
  spell files on startup, detected client launches, installation changes, and manual request.
  SQLite and compressed source history stay under the existing profile's `spells/` directory.
- **Character spell estimates.** Switch between Client values, Show mine, and Emulate for measured
  mote upgrades and qualifying worn damage/healing focus. Preview exact ranks and real focus
  effects, inspect partial coverage and roll ranges, and retain the unchanged client baseline.
  See [the modifier model](docs/plans/eq-oracle-spell-modifiers.md) for supported inputs and exclusions.
  History begins at the first captured baseline and is retained indefinitely. See
  [`docs/plans/eq-oracle-spells.md`](docs/plans/eq-oracle-spells.md).
- **The Z Engine.** The Rust log engine (`engine/`) is the fork's own line of development now: the
  process is `zengine.exe`, its cost on a real log is measured by `npm run engine:baseline` and
  recorded under `docs/zengine/`, and the program of work is in `docs/zengine/README.md`.
- **Auto-update is disabled for Oracle.** There is no Oracle release feed yet. The upstream
  EQ Zera feed is disabled so it cannot replace this fork. Existing signing checks remain in
  place for when an Oracle release channel is configured. The inherited release workflow is
  dormant until Oracle publishing, signing and updater metadata are configured together.
- **Gold EQO crest.** `npm run gen:icon` packages `build/icon-source.png` into the desktop,
  taskbar, tray, installer, site and share-page icon assets.
- **Telemetry and feedback are dark.** No endpoint is compiled in
  (`src/main/telemetry/net.ts`, `src/main/feedback/net.ts`). Nothing leaves your machine
  except the same third-party lookups upstream made: eqlwiki.com (items/mobs/images),
  the community sound-pack registry, and the on-demand Kokoro voice model download.
- Upstream CI workflows are parked in `.github/workflows-upstream-disabled/`; the fork's own
  are `.github/workflows/ci.yml` and `release.yml` (tag-driven, signed builds).
- Settings still live in `%AppData%\everquest-companion\` so an existing install's data is
  picked up unchanged.

## Building

See [`SETUP.md`](SETUP.md). Feature plans are in [`ROADMAP.md`](ROADMAP.md).

## License

Functional Source License 1.1 with MIT future license (FSL-1.1-MIT). See [`LICENSE`](LICENSE)
and [`NOTICE`](NOTICE). In short: use, modify, and share it freely for any non-commercial
purpose; do not sell it or offer it as a paid service until the MIT conversion date.
Copyright (c) 2026 Josh Moyers (original work). Copyright (c) 2026 Jack Thomas and contributors (EQ Oracle additions, under the same license). See [`NOTICE`](NOTICE).
