import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import {
  RELEASE_NOTES,
  UPSTREAM_BASE,
  hasReleaseNote,
  latestReleaseVersion,
  releaseNotesProblems,
  resolveOracleNotesSeen,
  whatsNewState
} from '../src/shared/oracleReleaseNotes'

test('Oracle package, lockfile, notes, and upstream provenance agree', () => {
  const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
  const pkg = read('../package.json')
  const lock = read('../package-lock.json')
  const fork = read('../ai-fork.json')
  assert.deepEqual(releaseNotesProblems(), [])
  assert.equal(pkg.version, latestReleaseVersion())
  assert.equal(lock.version, pkg.version)
  assert.equal(lock.packages[''].version, pkg.version)
  assert.equal(UPSTREAM_BASE.version, fork.baseline.tag.replace(/^v/, ''))
  assert.equal(UPSTREAM_BASE.commit, fork.baseline.commit)
  assert.equal(hasReleaseNote(UPSTREAM_BASE.version), false)
})

test('a legacy upstream seen stamp cannot suppress Oracle news', () => {
  for (const stamp of ['1.26.1', '0.28.0', '0.1.0']) {
    const seen = resolveOracleNotesSeen(undefined, stamp)
    assert.equal(seen, '0.1.0')
    assert.deepEqual(whatsNewState(seen).newVersions, RELEASE_NOTES.filter((n) => n.version !== '0.1.0').map((n) => n.version))
  }
})

test('fresh, seen, explicit reset, and invalid stamps remain distinct', () => {
  assert.equal(whatsNewState(resolveOracleNotesSeen(undefined, undefined)).fresh, true)
  assert.deepEqual(whatsNewState(resolveOracleNotesSeen('0.2.0', '1.26.1')).newVersions, [])
  assert.equal(resolveOracleNotesSeen(null, '1.26.1'), null)
  assert.equal(resolveOracleNotesSeen(undefined, 'junk'), null)
  assert.equal(resolveOracleNotesSeen('junk', '1.26.1'), '0.1.0')
  assert.equal(resolveOracleNotesSeen('0.3.0', '1.26.1'), '0.3.0')
})

test('the release gate accepts Oracle tags and refuses upstream tags', () => {
  const run = (tag: string) => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-release-notes.mjs', tag], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8'
  })
  const own = run(`v${latestReleaseVersion()}`)
  assert.equal(own.status, 0, own.stderr)
  const upstream = run(`v${UPSTREAM_BASE.version}`)
  assert.equal(upstream.status, 1)
  assert.match(upstream.stderr, /no entry in src\/shared\/oracleReleaseNotes/)
})
