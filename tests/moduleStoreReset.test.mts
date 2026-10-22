// Engine-world resets keep the last display but must reject old promise replies and cursors.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createModuleStore, type ModuleBridge } from '../src/renderer/src/lib/moduleStore'
import { MODULE_WORLD_CHANGED, type ModuleChanged, type ModuleSnapshot } from '../src/shared/types'

type Resolve = (v: ModuleSnapshot<unknown> | null) => void
type Store = ReturnType<typeof createModuleStore>

interface Spy {
  readonly bridge: ModuleBridge
  /** Every `getModuleSnapshot` call, in order, by module id. */
  readonly fetches: string[]
  /** How many `getModuleSnapshot` calls named this module. */
  fetchesOf(moduleId: string): number
  /** Answer the OLDEST unanswered fetch for this module with a snapshot. */
  reply(moduleId: string, state: unknown, seq: number): Promise<void>
  /** Answer the NEWEST fetch, so replies spanning an engine reset can land in either order. */
  replyNewest(moduleId: string, state: unknown, seq: number): Promise<void>
  /** Answer the oldest unanswered fetch with NO snapshot — the engine-absent reply. */
  replyNone(moduleId: string): Promise<void>
  /** A `module:changed` frame from main. */
  push(moduleId: string, seq: number): void
  /** Main finished rebuilding the world under a new character. */
  switchCharacter(): void
  /** How many bridge listeners are currently installed, across both channels. */
  listeners(): number
  /** The store's scheduler, and the animation frame that runs whatever it collected. */
  schedule(run: () => void): void
  runFrame(): void
  frames(): number
}

function spyBridge(): Spy {
  const fetches: string[] = []
  const waiting = new Map<string, Resolve[]>()
  let cursorCbs: ((c: ModuleChanged) => void)[] = []
  let charCbs: (() => void)[] = []
  let armed: (() => void)[] = []

  const answer = async (moduleId: string, v: ModuleSnapshot<unknown> | null, newest = false): Promise<void> => {
    const queue = waiting.get(moduleId) ?? []
    const next = newest ? queue.pop() : queue.shift()
    assert.ok(next, `nothing was waiting on a ${moduleId} snapshot`)
    next(v)
    // Two turns: one for the `.then` inside the store, one for anything it chained.
    await Promise.resolve()
    await Promise.resolve()
  }

  const bridge = {
    getModuleSnapshot: (moduleId: string) => {
      fetches.push(moduleId)
      return new Promise<ModuleSnapshot<unknown> | null>((resolve) => {
        waiting.set(moduleId, [...(waiting.get(moduleId) ?? []), resolve])
      })
    },
    onModuleChanged: (cb: (c: ModuleChanged) => void) => {
      cursorCbs = [...cursorCbs, cb]
      return (): void => {
        cursorCbs = cursorCbs.filter((x) => x !== cb)
      }
    },
    onCharacter: (cb: () => void) => {
      charCbs = [...charCbs, cb]
      return (): void => {
        charCbs = charCbs.filter((x) => x !== cb)
      }
    }
  } as unknown as ModuleBridge

  return {
    bridge,
    fetches,
    fetchesOf: (moduleId) => fetches.filter((f) => f === moduleId).length,
    reply: (moduleId, state, seq) => answer(moduleId, { seq, state }),
    replyNewest: (moduleId, state, seq) => answer(moduleId, { seq, state }, true),
    replyNone: (moduleId) => answer(moduleId, null),
    push: (moduleId, seq) => {
      for (const cb of cursorCbs) cb({ moduleId, seq })
    },
    switchCharacter: () => {
      for (const cb of charCbs) cb()
    },
    listeners: () => cursorCbs.length + charCbs.length,
    schedule: (run) => {
      armed = [...armed, run]
    },
    runFrame: () => {
      const due = armed
      armed = []
      for (const run of due) run()
    },
    frames: () => armed.length
  }
}

/** A store over a fresh spy. Returned together because every test needs both. */
function harness(): { spy: Spy; store: Store } {
  const spy = spyBridge()
  return { spy, store: createModuleStore({ bridge: spy.bridge, schedule: spy.schedule }) }
}

for (const newestFirst of [false, true]) {
  test(`world-reset replies cannot restore an old snapshot (${newestFirst ? 'new reply first' : 'old reply first'})`, async () => {
    const { spy, store } = harness()
    const off = store.subscribe('bazaar', () => undefined)
    spy.push(MODULE_WORLD_CHANGED, -1)
    spy.runFrame()
    assert.equal(spy.fetchesOf('bazaar'), 2)
    const fresh = { rows: [], live: [{ seq: 1, speaker: 'NewWorld' }] }
    if (newestFirst) {
      await spy.replyNewest('bazaar', fresh, 1)
      await spy.reply('bazaar', { rows: [], live: [{ seq: 900, speaker: 'OldWorld' }] }, 900)
    } else {
      await spy.reply('bazaar', { rows: [], live: [{ seq: 900, speaker: 'OldWorld' }] }, 900)
      assert.equal(store.getSnapshot('bazaar'), null, 'a pre-reset reply cannot become the baseline')
      await spy.reply('bazaar', fresh, 1)
    }
    assert.strictEqual(store.getSnapshot('bazaar'), fresh)
    off()
  })
}

test('world reset accepts restarted cursor numbers and still catches a cursor racing its new read', async () => {
  const { spy, store } = harness()
  const off = store.subscribe('loot', () => undefined)
  const held = [{ item: 'Held' }]
  await spy.reply('loot', held, 900)
  spy.push(MODULE_WORLD_CHANGED, -1)
  assert.strictEqual(store.getSnapshot('loot'), held, 'the existing display policy is preserved')
  spy.runFrame()
  spy.push('loot', 2)
  await spy.reply('loot', [{ item: 'New at 1' }], 1)
  spy.runFrame()
  assert.equal(spy.fetchesOf('loot'), 3, 'a new-space cursor at 2 is not compared against old 900')
  await spy.reply('loot', [{ item: 'New at 2' }], 2)
  assert.deepEqual(store.getSnapshot('loot'), [{ item: 'New at 2' }])
  off()
})

test('a dormant entry cannot absorb its pre-reset pending reply, and reopens with a fresh read', async () => {
  const { spy, store } = harness()
  const keepOpen = store.subscribe('character', () => undefined)
  const old = store.subscribe('bazaar', () => undefined)
  old()
  spy.push(MODULE_WORLD_CHANGED, -1)
  spy.runFrame()
  assert.equal(spy.fetchesOf('bazaar'), 1, 'dormant modules do not refresh eagerly')
  await spy.reply('bazaar', { old: true }, 900)
  assert.equal(store.getSnapshot('bazaar'), null)
  const current = store.subscribe('bazaar', () => undefined)
  assert.equal(spy.fetchesOf('bazaar'), 2)
  await spy.reply('bazaar', { current: true }, 1)
  assert.deepEqual(store.getSnapshot('bazaar'), { current: true })
  current(); keepOpen()
})

test('unmounting after a world reset drops both old and replacement replies', async () => {
  const { spy, store } = harness()
  const off = store.subscribe('bazaar', () => undefined)
  spy.push(MODULE_WORLD_CHANGED, -1); spy.runFrame(); off()
  await spy.replyNewest('bazaar', { new: true }, 1)
  await spy.reply('bazaar', { old: true }, 900)
  assert.equal(store.getSnapshot('bazaar'), null)
  assert.equal(spy.listeners(), 0)
})
