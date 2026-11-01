import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { WikiDatasetClient } from '../src/main/wikiDatasetClient'
class FakeWorker extends EventEmitter {
  request: { id: number } | null = null
  throws = false
  terminations = 0
  postMessage(request: { id: number }): void {
    if (this.throws) throw new Error('post failed')
    this.request = request
  }
  async terminate(): Promise<number> { this.terminations++; return 0 }
  answer(): void { this.emit('message', { id: this.request?.id, ok: true, kind: 'load', cache: null }) }
}
const load = { type: 'load' as const, cacheDir: '/profile/wiki-dataset' }
test('a retired worker exit cannot reject its replacement request', async () => {
  const first = new FakeWorker(), second = new FakeWorker()
  const workers = [first, second]
  const client = new WikiDatasetClient(() => workers.shift()!, 25)
  await assert.rejects(client.call(load), /timed out/)
  const next = client.call(load)
  first.emit('exit', 0)
  second.answer()
  assert.deepEqual(await next, { id: 2, ok: true, kind: 'load', cache: null })
  client.stop()
  assert.equal(first.terminations, 1)
  assert.equal(second.terminations, 1)
})
test('post failures clean up their deadline; stop rejects owned work and prevents restart', async () => {
  const worker = new FakeWorker()
  const client = new WikiDatasetClient(() => worker, 25)
  worker.throws = true
  await assert.rejects(client.call(load), /post failed/)
  worker.throws = false
  const next = client.call(load)
  client.stop()
  await assert.rejects(next, /stopped/)
  await assert.rejects(client.call(load), /stopped/)
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(worker.terminations, 1)
})
