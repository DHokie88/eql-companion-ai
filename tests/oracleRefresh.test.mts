import test from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as wait } from 'node:timers/promises'
import { createOracleRefreshController } from '../src/main/oracle/refreshController.ts'
import { refreshArgs } from '../src/main/oracle/refreshTransport.ts'
import { oracleRefreshStatus, type OracleRefreshStatus } from '../src/shared/oracleRefresh.ts'

const checked = '2026-10-25T11:00:00Z'
const result = (state: OracleRefreshStatus['state']): OracleRefreshStatus => ({ state, message: state, lastCheckedAt: state === 'complete' ? checked : null })
function fixture(remote: Parameters<typeof createOracleRefreshController>[0]['remote'], options: { timeoutMs?: number; verify?: () => Promise<void> } = {}) {
  const seen: OracleRefreshStatus[] = []
  let complete = 0
  let finish!: () => void
  const done = new Promise<void>(resolve => { finish = resolve })
  const controller = createOracleRefreshController({ remote, publish: status => { seen.push(status) },
    verify: options.verify ?? (() => Promise.resolve()), completed: () => { complete++; finish() }, delayMs: 10, pollMs: 10, timeoutMs: options.timeoutMs ?? 5000 })
  return { controller, seen, done, completed: () => complete }
}
test('startup is delayed and scheduled once; joined refresh completes across polls', { timeout: 5000 }, async () => {
  const calls: string[] = []
  const f = fixture(async (command, force) => { calls.push(`${command}:${force}`); return result(calls.length < 3 ? 'running' : 'complete') })
  const keepAlive = setTimeout(() => assert.fail('The background check did not complete.'), 5000)
  try {
    f.controller.start(); f.controller.start()
    assert.deepEqual(calls, [])
    await f.done
    assert.deepEqual(calls, ['request:false', 'status:false', 'status:false'])
    assert.equal(f.completed(), 1)
    assert.equal(f.controller.status().state, 'complete')
  } finally { clearTimeout(keepAlive); f.controller.stop() }
})
test('manual checks share pending work and do not launch a second running harvest', async () => {
  let release!: (value: OracleRefreshStatus) => void
  const calls: string[] = []
  const f = fixture((command, force) => { calls.push(`${command}:${force}`); return new Promise(resolve => { release = resolve }) })
  try {
    const first = f.controller.request()
    assert.equal(first, f.controller.request())
    release(result('running'))
    await first
    assert.equal((await f.controller.request()).state, 'running')
    assert.deepEqual(calls, ['request:true'])
  } finally { f.controller.stop() }
})
test('unavailable remote and invalid local publication report failure without success notification', async () => {
  const unavailable = fixture(async () => { throw new Error('Offline; saved updates remain available.') })
  await unavailable.controller.request()
  assert.equal(unavailable.controller.status().state, 'failed')
  assert.equal(unavailable.completed(), 0)
  unavailable.controller.stop()
  const invalid = fixture(async () => result('complete'), { verify: async () => { throw new Error('Snapshot checksum rejected.') } })
  await invalid.controller.request()
  assert.equal(invalid.controller.status().state, 'failed')
  assert.equal(invalid.completed(), 0)
  invalid.controller.stop()
})
test('deadline stops polling; shutdown aborts a request and discards late completion', async () => {
  const expired = fixture(async () => result('running'), { timeoutMs: 1 })
  await expired.controller.request()
  await wait(50)
  assert.equal(expired.controller.status().state, 'failed')
  expired.controller.stop()
  let signal: AbortSignal | undefined
  let release!: (value: OracleRefreshStatus) => void
  const late = fixture((_command, _force, incoming) => { signal = incoming; return new Promise(resolve => { release = resolve }) })
  const pending = late.controller.request()
  late.controller.stop()
  assert.equal(signal?.aborted, true)
  release(result('complete'))
  await pending
  assert.equal(late.completed(), 0)
})
test('malformed status and unsafe SSH host input are rejected; commands are fixed', () => {
  assert.equal(oracleRefreshStatus(result('complete')).lastCheckedAt, checked)
  for (const value of [null, {}, { ...result('running'), state: 'unknown' }, { ...result('complete'), lastCheckedAt: 'never' }, { ...result('running'), completedAt: 'invalid' }]) assert.throws(() => oracleRefreshStatus(value))
  assert.throws(() => refreshArgs({ host: 'aw;whoami', address: '', model: 'qwen38' }, 'request', true))
  const args = refreshArgs({ host: 'aw', address: '192.168.0.106', model: 'qwen38' }, 'request', true)
  assert.equal(args.at(-1), 'python3 /home/andrew/eql-discord-harvest/refresh_control.py request --force')
  assert.ok(args.includes('StrictHostKeyChecking=yes'))
  assert.equal(refreshArgs({ host: 'aw', address: '', model: 'qwen38' }, 'status', true).at(-1), 'python3 /home/andrew/eql-discord-harvest/refresh_control.py status')
})
