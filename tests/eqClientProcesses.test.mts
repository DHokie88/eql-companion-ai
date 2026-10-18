import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EqClientLaunches } from '../src/shared/eqClientProcess'
import { parsePresenceLine } from '../src/main/presenceProtocol'
import { createProcessScanner } from '../src/main/presenceProcessScan'

const client = (pid: number, creationTime = '100') => ({ pid, creationTime, exePath: 'C:\\EQ\\eqgame.exe' })
test('additional clients and PID reuse are launches, worker restart snapshots are not', () => {
  const detector = new EqClientLaunches()
  assert.equal(detector.observe([client(1)]).length, 1)
  assert.equal(detector.observe([client(1)]).length, 0)
  assert.deepEqual(detector.observe([client(1), client(2)]), [client(2)])
  assert.deepEqual(detector.observe([client(1, '200'), client(2)]), [client(1, '200')])
  detector.observe([])
  assert.equal(detector.observe([client(3)]).length, 1)
})
test('process protocol rejects malformed identities without inventing absence', () => {
  assert.deepEqual(parsePresenceLine(`P|${JSON.stringify([client(5)])}`), { t: 'clients', clients: [client(5)] })
  assert.equal(parsePresenceLine('P|[{"pid":1}]'), null)
  assert.equal(parsePresenceLine('P|oops'), null)
  assert.equal(parsePresenceLine('P|{}'), null)
  assert.deepEqual(parsePresenceLine('P|[]'), { t: 'clients', clients: [] })
})

test('one scan reports all real clients while preserving existing root-based overlay behavior', () => {
  const paths: Record<number, string> = { 1: 'C:\\EQ\\LaunchPad.exe', 2: 'C:\\EQ\\eqgame.exe', 3: 'D:\\OtherEQ\\eqgame.exe', 4: 'C:\\Other\\browser.exe' }
  const scan = createProcessScanner({ pids: () => [1, 2, 3, 4], imagePath: (pid) => paths[pid], creationTime: (pid) => String(100 + pid) })
  const result = scan('c:\\eq\\')
  assert.equal(result.running, 1)
  assert.deepEqual(result.clients?.map((p) => p.pid), [2, 3], 'a patcher under the install is not a client launch')
  assert.equal(createProcessScanner({ pids: () => [1], imagePath: (pid) => paths[pid], creationTime: () => '1' })('c:\\eq\\').running, 1)
})

test('enumeration and creation-time failures withhold process-set changes', () => {
  assert.deepEqual(createProcessScanner({ pids: () => null, imagePath: () => '', creationTime: () => null })(''), { running: -1, clients: null })
  assert.deepEqual(createProcessScanner({ pids: () => [2], imagePath: () => 'C:\\EQ\\eqgame.exe', creationTime: () => null })(''), { running: 1, clients: null })
})
