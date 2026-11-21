// Startup replay wire shapes. Types only; this module has no runtime dependencies.

// ------------------------------------------------------- the startup replay reading (JOS-57)
//
// WHAT THIS IS FOR. The chunked replay (docs/plans/chunked-replay.md) and its duty cycle (JOS-50)
// are throttles tuned on ONE developer machine against ONE 1.35M-line log. Everything the app
// knows about whether they work is therefore a fact about that machine. These six numbers are the
// same launch measured on machines nobody here owns — the whole point of the ticket.
//
// NUMBERS ONLY, and structurally so: the same posture as `updateOutcome`'s `failureClass` (a
// message reduced to one of five words before it can reach an event). There is no field here a
// character, a server, a zone or a PATH could go in, and the one number that would itself be
// revealing — how big your log is — is a BUCKET INDEX before it is ever assigned.
//
// ONE LAUNCH IS ONE READING, and `src/main/perf.ts` enforces that at the seam: it is produced when
// the `replayDone` startup phase lands, which happens exactly once per process (`addMark` refuses
// a duplicate). A character SWITCH replays a log too — and is deliberately not measured, because a
// switch replay and a launch replay are different work under different conditions, and a
// population that mixed them could not answer "how long does starting this app take".

export interface StartupReplayStats {
  /** Wall clock of the startup replay, ms: `tailAttached` → `replayDone`. */
  replayMs: number
  /** Log events the historical scan folded. Ceiling `MAX_REPLAY_EVENTS`, not `MAX_COUNT`. */
  eventsReplayed: number
  /**
   * The duty the fold ACHIEVED, whole percent 0..100 — measured by the slicer, never the setting
   * it aimed at (Windows' 15.6 ms timer quantum decides what a rest is actually worth).
   */
  dutyPct: number
  /** The worst single main-loop block observed during the replay, ms. */
  maxBlockMs: number
  /** Probe ticks that were at least 50 ms late (`STARTUP_BLOCK_THRESHOLD_MS`). */
  blocksOver50: number
  /** Index into `LOG_SIZE_BYTES_EDGES`. A raw byte count is a fingerprint; a decade is not. */
  logSizeBucket: number
  /**
   * NEW BYTES SINCE THE LAST CLEAN SHUTDOWN, as an index into `NEW_BYTES_EDGES` (JOS-57 scope
   * addition, from the first-start-stutter investigation).
   *
   * WHY IT IS THE DISCRIMINATOR THE OTHER NUMBERS ARE MISSING: every existing figure here scales
   * with the WHOLE log, and the leading hypothesis for a first-launch stutter — an on-access
   * virus scanner reading bytes the OS has never cached — predicts the cost scales with the part
   * of the log nobody has read yet. Those two are the same number on a fresh install and very
   * different numbers on the tenth launch of the same day, which is exactly the pair of launches
   * the fleet can now tell apart.
   *
   * OPTIONAL, and absent means UNKNOWN rather than zero: no previous clean shutdown left a mark
   * (a first run, or a launch after a crash), or the log had shrunk under the mark (a rotation),
   * in which case the delta is not a smaller measurement but a meaningless one.
   */
  newBytesBucket?: number
  /** The replay's own timer drift, when enough ticks were observed to describe it. Optional. */
  stutter?: StartupStutterStats
  /**
   * How long the FIRST MEGABYTE of the log took to arrive, ms — the cold-disk hint. Optional:
   * absent when the log is smaller than a megabyte, which is a launch with nothing to read rather
   * than a launch that read it instantly.
   */
  firstMbMs?: number
}

/**
 * THE SYSTEM-STUTTER PROXY (JOS-57 scope addition) — what OUR OWN clock did during the replay.
 *
 * A fixed-interval heartbeat runs for the length of the fold and records how late each tick was.
 * Read BESIDE `maxBlockMs` and `dutyPct`, it separates two launches that look identical today:
 * drift that spikes while the worst main-loop block stays small is the MACHINE stuttering around
 * a process that is behaving, which is what report ...8QQC describes and what a max-block figure
 * structurally cannot see.
 *
 * THE HONEST LIMIT, stated where the numbers are declared: an in-process timer cannot prove WHO
 * failed to schedule it. What makes this a discriminator is the PAIR — a drift distribution that
 * moved while the block figure and the achieved duty did not — never this reading alone.
 *
 * ALL THREE OR NONE, and it is a shape rather than a rule: a percentile with no companion
 * percentile beside it, or a late-tick rate with no distribution, is uninterpretable.
 */
export interface StartupStutterStats {
  /** Median observed drift, as an index into `STUTTER_MS_EDGES` — the baseline. */
  p50Bucket: number
  /** 95th-percentile observed drift, same edges — the tail, and the interesting half. */
  p95Bucket: number
  /** Whole percent of ticks that were LATE by the probe's own threshold, 0..100. */
  latePct: number
}

// THE PRODUCER — `startupReplayStats`, which BUILDS one of these out of the raw facts main holds —
// lives in `./telemetryStartup.ts`, split out when JOS-57's scope addition pushed this file past
// the repo's 400-code-line ceiling. The cut follows a seam that was already there: what is HERE is
// the CONTRACT SHAPES, which the validator and the Lambda need; the edges and ceilings stay
// in telemetry.ts. The other file is the CLIENT-SIDE constructor, which nothing on the server has
// ever needed and which the ingest bundle no longer carries.
