// The Sky tab and always-mounted overlay feed must observe one selection in the same window.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire, Module } from 'node:module'
import React from 'react'
import { mountHook } from './hookHost.mts'

const require = createRequire(import.meta.url)
const path = require.resolve('react')
const originalReact = require.cache[path]
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const values = new Map<string, string>([['eq.countSource', 'inventory']])
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value)
} })

// hookHost has no external-store dispatcher. Adapt only that primitive to its supported state
// and effect hooks; both hook instances still run the real useCountSource and its shared store.
function externalStore<T>(subscribe: (callback: () => void) => () => void, snapshot: () => T): T {
  const [value, setValue] = React.useState(snapshot)
  React.useEffect(() => {
    const off = subscribe(() => setValue(snapshot()))
    setValue(snapshot())
    return off
  }, [subscribe, snapshot])
  return value
}
const replacement = new Module(path)
replacement.exports = { ...React, useSyncExternalStore: externalStore }
replacement.loaded = true
require.cache[path] = replacement
const { useCountSource, setCountSource } = require('../src/renderer/src/features/posky/useCountSource.ts') as
  typeof import('../src/renderer/src/features/posky/useCountSource')

after(() => {
  if (originalReact) require.cache[path] = originalReact
  else Reflect.deleteProperty(require.cache, path)
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
})

test('both mounted source hooks retain the saved choice and follow each edit', () => {
  const tab = mountHook(useCountSource)
  const feed = mountHook(useCountSource)
  try {
    assert.equal(tab.value, 'inventory')
    assert.equal(feed.value, 'inventory')
    setCountSource('log')
    assert.equal(tab.render(), 'log')
    assert.equal(feed.render(), 'log')
    setCountSource('rebaseline')
    assert.equal(feed.render(), 'rebaseline')
    assert.equal(tab.render(), 'rebaseline')
    assert.equal(values.get('eq.countSource'), 'rebaseline')
  } finally {
    tab.unmount()
    feed.unmount()
  }
})
