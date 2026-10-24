import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRuntimeDiscord } from '../src/main/oracle/runtimeDiscord.ts'
import { runtimeFixture, updateRuntimeCheck } from './discordRuntimeFixture.mts'

test('runtime snapshots replace bundled data, reload unchanged-content checks, and retain the last valid generation on failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'oracle-discord-'))
  try {
    const read = createRuntimeDiscord()
    const bundled = await read(root)
    assert.match(bundled.snapshot.refreshWarning ?? '', /bundled/)
    assert.equal(bundled.snapshot.lastCheckedAt, undefined)
    await runtimeFixture(root)
    const first = await read(root)
    assert.equal(first.snapshot.lastCheckedAt, '2026-10-24T12:45:28Z')
    assert.equal(first.snapshot.refreshWarning, undefined)
    assert.ok(first.sources.length > 0)
    assert.equal(await read(root), first, 'identical generation reuses the index')
    await updateRuntimeCheck(root, '2026-10-24T19:00:00Z')
    const second = await read(root)
    assert.equal(second.snapshot.lastCheckedAt, '2026-10-24T19:00:00Z', 'a quiet Discord still advances the check time')
    assert.equal(second.snapshot.latestMessageDate, first.snapshot.latestMessageDate)

    const patchPath = join(root, 'runtime/patchNotes.json')
    const patch = JSON.parse(await readFile(patchPath, 'utf8'))
    patch.count++
    await writeFile(patchPath, JSON.stringify(patch))
    // A changed manifest invalidates the cached generation; hashes alone cannot certify the schema.
    await updateRuntimeCheck(root, '2026-10-25T11:00:00Z')
    const invalid = await read(root)
    assert.equal(invalid.snapshot.lastCheckedAt, second.snapshot.lastCheckedAt)
    assert.match(invalid.snapshot.refreshWarning ?? '', /last usable snapshot/)
    assert.equal(invalid.sources, second.sources)
    await runtimeFixture(root, '2026-10-25T11:00:00Z')
    const recovered = await read(root)
    assert.equal(recovered.snapshot.refreshWarning, undefined)
    assert.equal(recovered.snapshot.lastCheckedAt, '2026-10-25T11:00:00Z')

    const sums = join(root, 'SHA256SUMS.json')
    await rename(sums, `${sums}.previous`)
    assert.equal((await read(root)).sources, recovered.sources, 'interrupted folder switch retains the usable generation')
    await rename(`${sums}.previous`, sums)
    // After a changed publication, unverified bytes must never enter either feed or search.
    await updateRuntimeCheck(root, '2026-10-25T19:00:00Z')
    await writeFile(patchPath, '{}')
    assert.equal((await read(root)).sources, recovered.sources)
    const other = await read(join(root, 'different-install'))
    assert.equal(other.snapshot.lastCheckedAt, undefined, 'game-root changes cannot reuse another installation snapshot')
  } finally { await rm(root, { recursive: true, force: true }) }
})
