import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import type { CombatSnapshot, SnapshotOpts } from '../src/shared/combat'
import { MODULE_WORLD_CHANGED, type ModuleChanged } from '../src/shared/types'
import { createCombatFeed, subscribeCombatFeed, type CombatFeedView } from '../src/renderer/src/features/combat/combatFeed'

function snapshot(id: string, hydrating = false): CombatSnapshot {
  return {
    selectedId: id, selected: null, segments: [], inCombat: false, recent: [], stance: {},
    poison: { coat: { combat: [] }, slow: { pulls: 0, landed: 0, noLand: 0, window: 0 } },
    zoneSessions: [], hydrating, roster: { members: [], seen: false, lastSignalTs: 0 }
  }
}

function harness() {
  const requests: { opts: SnapshotOpts; resolve: (s: CombatSnapshot) => void; reject: (e: Error) => void }[] = []
  const views: CombatFeedView[] = []
  const feed = createCombatFeed((opts) => new Promise((resolve, reject) => {
    requests.push({ opts, resolve, reject })
  }), (view) => views.push(view))
  return { feed, requests, views, view: () => views.at(-1) }
}

test('overlapping activity/poll requests coalesce into one pending follow-up', async () => {
  const h = harness()
  h.feed.configure({ maxSegments: 100, timeline: true })
  for (let i = 0; i < 20; i++) h.feed.refresh()
  assert.equal(h.requests.length, 1)
  h.requests[0].resolve(snapshot('first'))
  await setImmediate()
  assert.equal(h.requests.length, 2)
  h.requests[1].resolve(snapshot('second'))
  await setImmediate()
  assert.equal(h.requests.length, 2, 'twenty nudges never become twenty queued requests')
  assert.equal(h.view()?.snap?.selectedId, 'second')
  h.feed.dispose()
})

test('pending, hydrating and rejected reads retain the last same-world answer with Updating', async () => {
  const h = harness()
  const real = snapshot('real')
  h.feed.configure({})
  h.requests[0].resolve(real)
  await setImmediate()
  assert.deepEqual(h.view(), { snap: real, updating: false })
  h.feed.refresh()
  assert.deepEqual(h.view(), { snap: real, updating: true }, 'slow outstanding read leaves values drawn')
  h.requests[1].resolve(snapshot('stand-in', true))
  await setImmediate()
  assert.deepEqual(h.view(), { snap: real, updating: true })
  h.feed.refresh()
  h.requests[2].reject(new Error('temporary IPC failure'))
  await setImmediate()
  assert.deepEqual(h.view(), { snap: real, updating: true })
  h.feed.refresh()
  const fresh = snapshot('fresh')
  h.requests[3].resolve(fresh)
  await setImmediate()
  assert.deepEqual(h.view(), { snap: fresh, updating: false })
  h.feed.dispose()
})

test('a first hydrating answer stays a loading state and a fresh empty selection replaces prior data', async () => {
  const h = harness()
  h.feed.configure({})
  const initial = snapshot('initial', true)
  h.requests[0].resolve(initial)
  await setImmediate()
  assert.deepEqual(h.view(), { snap: initial, updating: false })
  h.feed.refresh()
  h.requests[1].resolve(snapshot('old-selection'))
  await setImmediate()
  h.feed.refresh()
  const empty = snapshot('')
  h.requests[2].resolve(empty)
  await setImmediate()
  assert.deepEqual(h.view(), { snap: empty, updating: false }, 'hydrating, not empty data, identifies an unavailable read')
  h.feed.dispose()
})

test('world reset clears immediately and an old-world completion cannot repaint or leak into retention', async () => {
  const h = harness()
  h.feed.configure({})
  h.requests[0].resolve(snapshot('character-a'))
  await setImmediate()
  h.feed.refresh()
  h.feed.resetWorld()
  assert.deepEqual(h.view(), { snap: null, updating: false })
  assert.equal(h.requests.length, 2, 'new world waits for the existing physical IPC request')
  h.requests[1].resolve(snapshot('late-character-a'))
  await setImmediate()
  assert.equal(h.requests.length, 3)
  assert.deepEqual(h.view(), { snap: null, updating: false })
  const newWorldLoading = snapshot('character-b-loading', true)
  h.requests[2].resolve(newWorldLoading)
  await setImmediate()
  assert.deepEqual(h.view(), { snap: newWorldLoading, updating: false })
  h.feed.dispose()
})

test('selection changes clear immediately, suppress late answers and read only the latest options', async () => {
  const h = harness()
  h.feed.configure({ selectedId: 'fight:a', timeline: true })
  h.requests[0].resolve(snapshot('fight:a'))
  await setImmediate()
  h.feed.refresh()
  h.feed.configure({ selectedId: 'fight:b', timeline: true })
  h.feed.configure({ selectedId: 'fight:c', timeline: false })
  assert.deepEqual(h.view(), { snap: null, updating: false })
  assert.equal(h.requests.length, 2)
  h.requests[1].resolve(snapshot('fight:a-late'))
  await setImmediate()
  assert.equal(h.requests.length, 3)
  assert.deepEqual(h.requests[2].opts, { selectedId: 'fight:c', timeline: false })
  assert.deepEqual(h.view(), { snap: null, updating: false })
  h.requests[2].resolve(snapshot('fight:c'))
  await setImmediate()
  assert.equal(h.view()?.snap?.selectedId, 'fight:c')
  h.feed.dispose()
})

test('dispose suppresses completion, queued refresh, resets and later reconfiguration', async () => {
  const h = harness()
  h.feed.configure({})
  h.feed.refresh()
  h.feed.dispose()
  h.requests[0].resolve(snapshot('late-unmounted'))
  h.feed.refresh()
  h.feed.resetWorld()
  h.feed.configure({ selectedId: 'new' })
  await setImmediate()
  assert.deepEqual(h.views, [])
  assert.equal(h.requests.length, 1)
})

test('a rejected obsolete read cannot restore the previous world', async () => {
  const h = harness()
  h.feed.configure({})
  h.requests[0].resolve(snapshot('old'))
  await setImmediate()
  h.feed.refresh()
  h.feed.resetWorld()
  h.requests[1].reject(new Error('late old-world timeout'))
  await setImmediate()
  assert.deepEqual(h.view(), { snap: null, updating: false })
  h.feed.dispose()
})

test('different consumers never share retained snapshots', async () => {
  const a = harness()
  const b = harness()
  a.feed.configure({})
  a.requests[0].resolve(snapshot('a'))
  b.feed.configure({})
  b.requests[0].resolve(snapshot('b-loading', true))
  await setImmediate()
  assert.equal(a.view()?.snap?.selectedId, 'a')
  assert.equal(b.view()?.snap?.selectedId, 'b-loading')
  assert.equal(b.view()?.updating, false)
  a.feed.dispose()
  b.feed.dispose()
})

test('real character/world subscriptions reset while ordinary module changes do not; cleanup stops all work', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  const h = harness()
  let activity: (() => void) | undefined
  let character: (() => void) | undefined
  let moduleChanged: ((change: ModuleChanged) => void) | undefined
  let removed = 0
  const stop = subscribeCombatFeed({
    onCombatActivity: (cb) => { activity = cb; return () => { activity = undefined; removed++ } },
    onCharacter: (cb) => { character = cb; return () => { character = undefined; removed++ } },
    onModuleChanged: (cb) => { moduleChanged = cb; return () => { moduleChanged = undefined; removed++ } }
  }, h.feed)
  t.after(stop)
  h.feed.configure({})
  h.requests[0].resolve(snapshot('real'))
  await setImmediate()
  moduleChanged?.({ moduleId: 'loot', seq: 12 })
  assert.equal(h.requests.length, 1)
  assert.equal(h.view()?.snap?.selectedId, 'real')
  t.mock.timers.tick(1000)
  activity?.()
  assert.equal(h.requests.length, 2)
  moduleChanged?.({ moduleId: MODULE_WORLD_CHANGED, seq: -1 })
  assert.deepEqual(h.view(), { snap: null, updating: false })
  h.requests[1].resolve(snapshot('old-epoch'))
  await setImmediate()
  h.requests[2].resolve(snapshot('same-character-new-epoch'))
  await setImmediate()
  character?.()
  assert.deepEqual(h.view(), { snap: null, updating: false })
  const count = h.requests.length
  stop()
  assert.equal(removed, 3)
  assert.equal(activity, undefined)
  assert.equal(character, undefined)
  assert.equal(moduleChanged, undefined)
  t.mock.timers.tick(20_000)
  h.requests[count - 1].resolve(snapshot('unmounted'))
  await setImmediate()
  assert.equal(h.requests.length, count)
  assert.deepEqual(h.view(), { snap: null, updating: false })
})
