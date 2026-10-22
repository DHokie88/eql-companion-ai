// Run the real watcher across synchronous bridge resets without rendering a loading/null frame.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire, Module } from 'node:module'
import { mountHook } from './hookHost.mts'
import { MODULE_WORLD_CHANGED, type ModuleChanged } from '../src/shared/types'
import type { BazaarSnap, LiveOffer } from '../src/shared/bazaar'
import type { BazaarWatchlist } from '../src/shared/bazaarWatch'

const require = createRequire(import.meta.url)
const savedModules = new Map<string, NodeModule | undefined>()
let snap: BazaarSnap | null = null
const signals: unknown[][] = []
const characters = new Set<() => void>()
const worlds = new Set<(change: ModuleChanged) => void>()
const list: BazaarWatchlist = { entries: [{
  item: 'Fleeting Quiver', tier: null, wts: true, wtb: false,
  wtsMax: null, wtsShare: null, wtbMin: null
}] }

function replaceModule(path: string, exports: object): void {
  const resolved = require.resolve(path)
  savedModules.set(resolved, require.cache[resolved])
  const replacement = new Module(resolved)
  replacement.exports = exports
  replacement.loaded = true
  require.cache[resolved] = replacement
}

replaceModule('../src/renderer/src/lib/useModule.ts', { useModule: () => snap })
replaceModule('../src/renderer/src/features/bazaar/useBazaarWatch.ts', { useBazaarWatch: () => ({ list }) })
replaceModule('../src/renderer/src/features/alerts/player.tsx', {
  fireAppSignal: (...args: unknown[]) => signals.push(args)
})
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
Object.defineProperty(globalThis, 'window', { configurable: true, value: { eq: {
  onCharacter: (callback: () => void) => {
    characters.add(callback)
    return () => characters.delete(callback)
  },
  onModuleChanged: (callback: (change: ModuleChanged) => void) => {
    worlds.add(callback)
    return () => worlds.delete(callback)
  }
} } })
const { default: BazaarWatcher } = require('../src/renderer/src/features/bazaar/BazaarWatcher.tsx') as
  typeof import('../src/renderer/src/features/bazaar/BazaarWatcher')

after(() => {
  for (const [path, saved] of savedModules) {
    if (saved) require.cache[path] = saved
    else Reflect.deleteProperty(require.cache, path)
  }
  if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

function offers(seq: number): BazaarSnap {
  const offer: LiveOffer = {
    seq, at: '2026-10-22 12:00:00', speaker: 'Leric', dir: 'sell',
    item: 'Fleeting Quiver', tier: 0, price: 10
  }
  return { rows: [], live: [offer] }
}

test('character and engine-world callbacks reset the real watcher without needing a null snapshot', () => {
  snap = offers(100)
  const host = mountHook(BazaarWatcher)
  try {
    assert.equal(signals.length, 0, 'initial replay is a baseline')
    snap = offers(101)
    host.render()
    assert.equal(signals.length, 1)
    for (const callback of characters) callback()
    host.render()
    snap = offers(1)
    host.render()
    assert.equal(signals.length, 1, 'new character history does not alert')
    snap = offers(2)
    host.render()
    assert.equal(signals.length, 2, 'the restarted live cursor can alert')
    for (const callback of worlds) callback({ moduleId: MODULE_WORLD_CHANGED, seq: 0 })
    snap = offers(10)
    host.render()
    assert.equal(signals.length, 2, 'engine rebuild history is also a baseline')
    snap = offers(11)
    host.render()
    assert.equal(signals.length, 3)
    for (const callback of worlds) callback({ moduleId: 'loot', seq: 100 })
    snap = offers(12)
    host.render()
    assert.equal(signals.length, 4, 'ordinary module notifications do not reset the feed')
  } finally {
    host.unmount()
  }
  assert.equal(characters.size, 0)
  assert.equal(worlds.size, 0)
})
