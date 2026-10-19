// The release gate for what's new (JOS-73): a tag may not ship without release notes.
//
// The app tells the user what changed by reading src/shared/releaseNotes.ts, which is committed
// SOURCE — so the failure mode is not a crash, it is silence: tag v0.9.0, publish it, the fleet
// auto-updates, and the What's new panel simply has nothing to say about the build everybody is
// now running. Nothing anywhere would have complained. This is the thing that complains, in the
// one job that publishes.
//
// It runs the SAME `releaseNotesProblems` the unit suite runs, so the shape rules have one
// definition, and adds the only rule CI can check that a checkout cannot: the tag being built
// must have an entry. A prerelease tag (`v0.9.0-rc.1`) satisfies it with 0.9.0's entry — the
// prerelease is that release, being rehearsed.
//
// Usage: node --import tsx scripts/check-release-notes.mjs [<tag or version>]
//   With no argument it checks the notes' SHAPE only, which is what a local run wants.
//   Exit 0 = fine, exit 1 = the reason, on stderr.

import { readFileSync } from 'node:fs'
import { hasReleaseNote, latestReleaseVersion, releaseNotesProblems } from '../src/shared/oracleReleaseNotes.ts'
import { parseVersion } from '../src/shared/releaseNotes.ts'

const ref = process.argv[2] ?? ''
const problems = releaseNotesProblems()
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
if (pkg.version !== latestReleaseVersion()) {
  problems.push(`package.json version ${pkg.version} must match the newest Oracle release note ${latestReleaseVersion()}`)
}

if (ref !== '' && !hasReleaseNote(ref)) {
  problems.push(
    `${ref} has no entry in src/shared/oracleReleaseNotes.ts — add an Oracle release note before tagging`
  )
}
if (ref !== '') {
  const tag = parseVersion(ref)
  if (`${tag.major}.${tag.minor}.${tag.patch}` !== pkg.version) {
    problems.push(`${ref} does not match package.json version ${pkg.version}`)
  }
}

if (problems.length > 0) {
  console.error('release notes check FAILED:')
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}

console.log(ref === '' ? 'release notes check OK (shape)' : `release notes check OK (${ref})`)
