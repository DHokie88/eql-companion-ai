import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SpellLibraryService, type SpellRpc } from '../src/main/spellLibrary/service'
import type { SpellDataset } from '../src/shared/spellLibrary'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
function dataset(root: string): SpellDataset {
  return { installId: root, snapshotId: `snapshot-${root}`, contentId: `content-${root}`, parserVersion: '1',
    firstObserved: '2026-10-18T00:00:00Z', recordCount: 3,
    hashes: { 'spells_us.txt': 'a', 'spells_us_str.txt': 'b', 'dbstr_us.txt': 'c' } }
}
function rig(check: (root: string) => Promise<unknown>, readerResponse?: () => Promise<unknown>) {
  let root = 'A'
  let onReady: (() => void) | null = null
  const installs: string[] = [], queries: { method: string; args: unknown }[] = []
  const engine: string[] = []
  const errors: unknown[] = []
  const writer: SpellRpc = { async call<T>(method: string, input?: unknown): Promise<T> {
    const args = input as { root: string }
    if (method === 'status') return { installId: args.root, dataset: null, storageBytes: 0, checkedAt: null } as T
    if (method === 'check') return await check(args.root) as T
    return {} as T
  }, stop() { /* Fake worker has no resources. */ } }
  const reader: SpellRpc = { async call<T>(method: string, args?: unknown): Promise<T> {
    queries.push({ method, args }); return (readerResponse ? await readerResponse() : { okay: true }) as T
  }, stop() { /* Fake worker has no resources. */ } }
  const service = new SpellLibraryService({ userData: 'profile', workerDirectory: 'workers', root: () => root,
    changed(status) { if (status.phase === 'ready') onReady?.() }, log: (e) => errors.push(e),
    selectInstallation() { /* Isolation is pinned by installReference calls below. */ },
    prepareReference: async () => ({}), installReference: (r) => installs.push(r),
    activateEngine: async (r) => { engine.push(r); return true }, createWorker: (role) => role === 'writer' ? writer : reader })
  return { service, installs, engine, errors, queries, root: (next: string) => { root = next }, onReady: (callback: () => void) => { onReady = callback } }
}
const published = (root: string) => ({ dataset: dataset(root), materializedDir: `profile/spells/materialized/${root}` })

test('overlapping checks coalesce and a root change discards the old activation', async () => {
  const old = deferred<unknown>(), next = deferred<unknown>(), beganNext = deferred<boolean>()
  let checks = 0
  const r = rig(async (root) => { checks++; if (root === 'A') return old.promise; beganNext.resolve(true); return next.promise })
  try {
    const first = r.service.check('startup')
    assert.equal(r.service.check('manual'), first)
    await Promise.resolve(); await Promise.resolve()
    assert.equal(checks, 1)
    r.root('B'); r.service.check('installation-change')
    old.resolve(published('A')); await first; await beganNext.promise
    assert.deepEqual(r.installs, [])
    next.resolve(published('B'))
    await r.service.check('manual')
    assert.deepEqual(r.installs, ['B'])
    assert.equal(r.service.status().dataset?.installId, 'B')
    assert.equal(checks, 2)
  } finally { r.service.stop() }
})

test('failed refresh retains prior revision; history queries carry no accidental snapshot filter', async () => {
  let fail = false
  const r = rig(async (root) => { if (fail) throw new Error('synthetic malformed record'); return published(root) })
  try {
    await r.service.check('startup')
    const before = r.service.status().dataset
    await r.service.query('history', { page: 1 })
    await r.service.query('detail', { id: 101, snapshotId: undefined })
    assert.deepEqual(r.queries[0], { method: 'history', args: { installId: 'A', query: { page: 1 } } })
    assert.equal((r.queries[1].args as { query: { snapshotId: string } }).query.snapshotId, before?.snapshotId)
    fail = true
    await r.service.check('manual')
    assert.equal(r.service.status().phase, 'error')
    assert.equal(r.service.status().dataset, before)
    assert.deepEqual(r.installs, ['A'])
    await r.service.replayActivation()
    assert.deepEqual(r.engine, ['A', 'A'])
  } finally { r.service.stop() }
})

test('a query from an old installation cannot resolve successfully after selection changes', async () => {
  const reply = deferred<unknown>()
  const r = rig(async (root) => published(root), () => reply.promise)
  try {
    await r.service.check('startup')
    const oldQuery = r.service.query('detail', { id: 101 })
    const refused = assert.rejects(oldQuery, /installation changed/)
    r.root('B')
    await r.service.check('installation-change')
    reply.resolve({ dataset: dataset('A') })
    await refused
    assert.equal(r.service.status().dataset?.installId, 'B')
  } finally { r.service.stop() }
})

test('a manual check requested at the ready notification captures a fresh bundle', async () => {
  let checks = 0
  let repeated: Promise<unknown> | null = null
  const r = rig(async (root) => { checks++; return published(root) })
  r.onReady(() => { if (checks === 1) repeated = r.service.check('manual') })
  try {
    await r.service.check('startup')
    await repeated
    assert.equal(checks, 2)
  } finally { r.service.stop() }
})
