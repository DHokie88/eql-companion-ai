import { test } from 'node:test'
import assert from 'node:assert/strict'
import { singleFlight, replyOnce } from '../src/main/wikiDatasetTransfer'
test('single-flight shares one run and a reply is delivered once', async () => {
  let runs = 0
  const slot: { current: Promise<number> | null } = { current: null }
  let release: () => void = () => { /* Cleanup cannot replace the original result. */ }
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const first = singleFlight(slot, async () => {
    runs += 1
    await gate
    return runs
  })
  const second = singleFlight(slot, async () => {
    runs += 1
    return 9
  })
  release()
  assert.equal(await first, 1)
  assert.equal(await second, 1)
  assert.equal(runs, 1)

  const sent: unknown[] = []
  const state = { sent: false }
  replyOnce(state, (message) => sent.push(message), { id: 1 })
  replyOnce(state, (message) => sent.push(message), { id: 1 })
  assert.equal(sent.length, 1)
})
