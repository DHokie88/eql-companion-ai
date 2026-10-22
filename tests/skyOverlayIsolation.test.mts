// Drive the real progress lifecycle and storage publisher with deferred IPC replies. No count
// arithmetic is replaced in production; synthetic rows here isolate lifecycle from quest data.
import assert from 'node:assert/strict'
import { after, beforeEach, test, type TestContext } from 'node:test'
import { createRequire, Module } from 'node:module'
import { setImmediate } from 'node:timers/promises'
import { useLayoutEffect } from 'react'
import { mountHook, type HookHost } from './hookHost.mts'
import { useProgressState } from '../src/renderer/src/features/posky/useProgressState'
import { EMPTY_SKY_OVERLAY, SKY_OVERLAY_KEY, parseSkyOverlay } from '../src/shared/skyQuestOverlay'
import { MODULE_WORLD_CHANGED, type CharacterRef, type ModuleChanged, type ProgressState } from '../src/shared/types'
import type { QuestProgress } from '../src/renderer/src/features/posky/useProgress'

const require = createRequire(import.meta.url)
const savedModules = new Map<string, NodeModule | undefined>()
function replaceModule(path: string, exports: object): void {
  const resolved = require.resolve(path)
  savedModules.set(resolved, require.cache[resolved])
  const replacement = new Module(resolved)
  replacement.exports = exports
  replacement.loaded = true
  require.cache[resolved] = replacement
}
const starred = { has: () => true }
const marks = (): undefined => undefined
replaceModule('../src/renderer/src/features/favorites/useQuestFlags.ts', { useQuestFavorites: () => starred })
replaceModule('../src/renderer/src/lib/itemMarks.ts', {
  useItemMarksReader: () => marks,
  fetchItemMarks: () => Promise.resolve({})
})
const { useSkyOverlayFeed } = require('../src/renderer/src/features/posky/useSkyOverlayFeed.ts') as
  typeof import('../src/renderer/src/features/posky/useSkyOverlayFeed')
const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const savedStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
after(() => {
  for (const [path, saved] of savedModules) {
    if (saved) require.cache[path] = saved
    else Reflect.deleteProperty(require.cache, path)
  }
  for (const [key, saved] of [['window', savedWindow], ['localStorage', savedStorage]] as const) {
    if (saved) Object.defineProperty(globalThis, key, saved)
    else Reflect.deleteProperty(globalThis, key)
  }
})

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  let reject: (error: Error) => void = () => undefined
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
let progressReads: ReturnType<typeof deferred<ProgressState>>[] = []
let characterReads: ReturnType<typeof deferred<CharacterRef | null>>[] = []
const characters = new Set<(character: CharacterRef | null) => void>()
const worlds = new Set<(change: ModuleChanged) => void>()
const inventories = new Set<() => void>()
const pushes = new Set<(progress: ProgressState) => void>()
let stored = new Map<string, string>()
let writes: string[] = []
beforeEach(() => {
  progressReads = []; characterReads = []; stored = new Map(); writes = []
  characters.clear(); worlds.clear(); inventories.clear(); pushes.clear()
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { eq: {
    getProgress: () => { const read = deferred<ProgressState>(); progressReads.push(read); return read.promise },
    getCharacter: () => { const read = deferred<CharacterRef | null>(); characterReads.push(read); return read.promise },
    onCharacter: (cb: (c: CharacterRef | null) => void) => { characters.add(cb); return () => characters.delete(cb) },
    onModuleChanged: (cb: (c: ModuleChanged) => void) => { worlds.add(cb); return () => worlds.delete(cb) },
    onInventoryReload: (cb: () => void) => { inventories.add(cb); return () => inventories.delete(cb) },
    onProgress: (cb: (p: ProgressState) => void) => { pushes.add(cb); return () => pushes.delete(cb) }
  } } })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value); if (key === SKY_OVERLAY_KEY) writes.push(value) }
  } })
})

const state = (have: number): ProgressState => ({ inventory: { 'sky pearl': have }, completedQuests: [] })
const character = (name: string): CharacterRef => ({ name, server: 'freeport', logPath: `/eq/Logs/eqlog_${name}_freeport.txt` })
function changeCharacter(name: string): void { for (const cb of characters) cb(character(name)) }
function resetWorld(): void { for (const cb of worlds) cb({ moduleId: MODULE_WORLD_CHANGED, seq: -1 }) }
function reload(): void { for (const cb of inventories) cb() }
const payload = () => parseSkyOverlay(stored.get(SKY_OVERLAY_KEY) ?? null)

function mount(t: TestContext): HookHost<ReturnType<typeof useProgressState>> {
  const host = mountHook(useProgressState)
  t.after(() => host.unmount())
  return host
}

test('a character switch clears progress and ignores earlier progress/character reads', async (t) => {
  const host = mount(t)
  progressReads[0].resolve(state(1))
  await setImmediate(); host.render()
  assert.equal(host.value.progress?.inventory['sky pearl'], 1)
  const oldWorld = host.value.world.current
  host.act(() => changeCharacter('Beta'))
  assert.equal(host.value.progress, null)
  assert.equal(host.value.character, 'Beta')
  assert.ok(host.value.world.current > oldWorld)
  characterReads[0].resolve(character('Alpha'))
  progressReads[1].resolve(state(0))
  await setImmediate(); host.render()
  assert.equal(host.value.character, 'Beta')
  assert.equal(host.value.progress?.inventory['sky pearl'], 0)
})

test('inventory reads apply only the newest request, and an intervening push wins over a read', async (t) => {
  const host = mount(t)
  reload(); reload()
  progressReads[2].resolve(state(2))
  await setImmediate(); host.render()
  progressReads[1].resolve(state(1)); progressReads[0].resolve(state(0))
  await setImmediate(); host.render()
  assert.equal(host.value.progress?.inventory['sky pearl'], 2)
  reload()
  host.act(() => { for (const cb of pushes) cb(state(3)) })
  progressReads[3].resolve(state(4))
  await setImmediate(); host.render()
  assert.equal(host.value.progress?.inventory['sky pearl'], 3)
})

test('same-character world reset clears data and ignores late old-world getters', async (t) => {
  const host = mount(t)
  progressReads[0].resolve(state(1)); characterReads[0].resolve(character('Alpha'))
  await setImmediate(); host.render()
  reload()
  host.act(resetWorld)
  assert.equal(host.value.progress, null)
  assert.equal(host.value.character, null)
  characterReads[1].resolve(character('Alpha')); progressReads[2].resolve(state(0))
  progressReads[1].resolve(state(99))
  await setImmediate(); host.render()
  assert.equal(host.value.character, 'Alpha')
  assert.equal(host.value.progress?.inventory['sky pearl'], 0)
  const count = progressReads.length
  host.act(() => { for (const cb of worlds) cb({ moduleId: 'loot', seq: 8 }) })
  assert.equal(progressReads.length, count, 'ordinary module cursors do not reset progress')
})

test('old action completion setters cannot cross worlds or survive disposal', async (t) => {
  const host = mount(t)
  const commitAlpha = host.value.setProgress
  host.act(() => changeCharacter('Beta'))
  progressReads[1].resolve(state(0))
  await setImmediate(); host.render()
  host.act(() => commitAlpha(state(99)))
  assert.equal(host.value.progress?.inventory['sky pearl'], 0, 'late inventory/manual/turn-in completion refused')
  host.act(() => host.value.setProgress(state(2)))
  assert.equal(host.value.progress?.inventory['sky pearl'], 2)
  const commitBeta = host.value.setProgress
  host.unmount()
  commitBeta(state(50)); progressReads[0].resolve(state(90)); characterReads[0].resolve(character('Alpha'))
  await setImmediate()
  assert.equal(host.render().progress?.inventory['sky pearl'], 2)
  assert.equal(characters.size + worlds.size + inventories.size + pushes.size, 0)
})

test('a current-world action completion invalidates older pending store reads', async (t) => {
  const host = mount(t)
  host.act(() => host.value.setProgress(state(3)))
  progressReads[0].resolve(state(1))
  await setImmediate(); host.render()
  assert.equal(host.value.progress?.inventory['sky pearl'], 3)
})

test('failed reads leave an empty world and a later inventory refresh recovers', async (t) => {
  const host = mount(t)
  progressReads[0].reject(new Error('read failed')); characterReads[0].reject(new Error('character failed'))
  await setImmediate(); host.render()
  assert.equal(host.value.progress, null)
  reload(); progressReads[1].resolve(state(1))
  await setImmediate(); host.render()
  assert.equal(host.value.progress?.inventory['sky pearl'], 1)
})

function rows(progress: ProgressState | null): QuestProgress[] {
  if (!progress) return []
  const have = progress.inventory['sky pearl'] ?? 0
  return [{
    key: 'Bard::Test', className: 'Bard', name: 'Test', needCount: 1, haveCount: have,
    missing: have ? [] : ['Sky Pearl'], ratio: have, turnIns: 0, logTurnIns: 0, completed: false,
    items: [{ name: 'Sky Pearl', have, need: 1, held: have, who: [], where: '', droppers: [] }]
  }]
}

test('storage clears synchronously on character reset even before React renders, then publishes only the new world', async (t) => {
  const host = mountHook(() => {
    const progress = useProgressState()
    useSkyOverlayFeed(rows(progress.progress), progress.progress !== null, progress.world)
    return progress
  })
  t.after(() => host.unmount())
  progressReads[0].resolve(state(1)); await setImmediate(); host.render()
  assert.equal(payload().rows[0].ready, true)
  changeCharacter('Beta')
  assert.deepEqual(payload(), EMPTY_SKY_OVERLAY, 'storage clears in the reset callback, before any React render')
  progressReads[1].resolve(state(0)); await setImmediate(); host.render()
  assert.equal(payload().loaded, true, 'batched null-to-fresh state does not strand publication')
  assert.equal(payload().rows[0].ready, false)
  host.unmount()
  assert.deepEqual(payload(), EMPTY_SKY_OVERLAY)
})

test('a reset between render and effect cannot republish that render’s old holdings', async (t) => {
  let resetDuringCommit = false
  const host = mountHook(() => {
    const progress = useProgressState()
    useSkyOverlayFeed(rows(progress.progress), progress.progress !== null, progress.world)
    useLayoutEffect(() => { if (resetDuringCommit) resetWorld() }, [resetDuringCommit])
    return progress
  })
  t.after(() => host.unmount())
  progressReads[0].resolve(state(1)); await setImmediate(); host.render()
  assert.equal(payload().rows[0].ready, true)
  writes.length = 0
  // Change the rendered progress so an old-world publication effect is pending at the reset.
  host.value.setProgress(state(2)); resetDuringCommit = true
  host.render()
  assert.deepEqual(payload(), EMPTY_SKY_OVERLAY)
  assert.ok(writes.every((raw) => !parseSkyOverlay(raw).loaded), 'no intermediate storage write exposes old-world rows')
})
