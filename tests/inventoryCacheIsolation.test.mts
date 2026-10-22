// Exercise the real IPC registration and live worn-focus accessor with a fixed output identity.
// Discovery deliberately falls back to another character's path; a switch need not change mtime.
import { after, afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire, Module } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { IPC } from '../src/shared/ipc'
import { outputFileStatus, outputKind, ownsOutputFile } from '../src/shared/outputs/kinds'
import { NO_OWNERSHIP, type OwnershipPayload } from '../src/shared/planner/ownership'
import { parseInventoryDump } from '../src/main/outputs/inventoryParse'

const require = createRequire(import.meta.url)
const savedModules = new Map<string, NodeModule | undefined>()
const handlers = new Map<string, () => unknown>()
const inventory = outputKind('inventory')
const dump = parseInventoryDump(readFileSync(
  join(import.meta.dirname, 'fixtures', 'Primitive_freeport-Inventory.txt'), 'utf8'
))
const stamp = '2026-10-22T12:00:00.000Z'
let character: { name: string; server: string } | null = null
let found: { path: string; updatedAt: string } | null = null
let readable = true
let loads = 0

function replaceModule(path: string, exports: object): void {
  const resolved = require.resolve(path)
  savedModules.set(resolved, require.cache[resolved])
  const replacement = new Module(resolved)
  replacement.exports = exports
  replacement.loaded = true
  require.cache[resolved] = replacement
}

replaceModule('electron', { ipcMain: {
  handle: (channel: string, handler: () => unknown) => handlers.set(channel, handler)
} })
replaceModule('../src/main/session.ts', {
  getActiveCharacter: () => character,
  activeCharId: () => character ? `${character.name}@${character.server}` : null
})
replaceModule('../src/main/storePlans.ts', {})
replaceModule('../src/main/outputs/index.ts', {
  outputStatus: () => outputFileStatus(inventory, found),
  loadInventoryDump: (name?: string, server?: string) => {
    loads++
    if (!readable || !found || !ownsOutputFile(inventory, found.path, name, server)) return null
    return { path: found.path, loadedAt: found.updatedAt, dump }
  }
})
const { registerPlannerIpc } = require('../src/main/ipc/planner.ts') as typeof import('../src/main/ipc/planner')
const { currentWornFocus } = require('../src/main/planner/wornFocusCurrent.ts') as
  typeof import('../src/main/planner/wornFocusCurrent')
registerPlannerIpc()

function gearOwnership(): OwnershipPayload {
  const handler = handlers.get(IPC.gearOwnership)
  assert.ok(handler, 'the public gear ownership handler is registered')
  return handler() as OwnershipPayload
}

after(() => {
  for (const [path, saved] of savedModules) {
    if (saved) require.cache[path] = saved
    else Reflect.deleteProperty(require.cache, path)
  }
})
beforeEach(() => {
  character = { name: 'Primitive', server: 'freeport' }
  found = { path: 'C:/EQ/Primitive_freeport-Inventory.txt', updatedAt: stamp }
  readable = true
  loads = 0
})
afterEach(() => {
  found = null
  gearOwnership()
  currentWornFocus()
})

function primeCaches(): { owned: OwnershipPayload; focus: ReturnType<typeof currentWornFocus> } {
  const owned = gearOwnership()
  const focus = currentWornFocus()
  assert.equal(owned.path, found?.path)
  assert.ok(owned.entries.length > 0, 'real inventory yields ownership')
  assert.ok(focus.length > 0, 'real equipped inventory yields worn focus')
  assert.equal(loads, 2)
  return { owned, focus }
}

test('same-character inventory and focus reuse their cached result', () => {
  const { owned, focus } = primeCaches()
  assert.strictEqual(gearOwnership(), owned)
  assert.strictEqual(currentWornFocus(), focus)
  assert.equal(loads, 2, 'unchanged own path and mtime do not reparse')
})

for (const next of [{ name: 'Other', server: 'freeport' }, { name: 'Primitive', server: 'firiona' }]) {
  test(`switching to ${next.name}@${next.server} refuses the cached fallback and clears it`, () => {
    primeCaches()
    character = next
    // The output status still names the exact same fallback path and timestamp as before.
    assert.deepEqual(gearOwnership(), NO_OWNERSHIP)
    assert.deepEqual(currentWornFocus(), [])
    assert.equal(loads, 2, 'unowned discovery results are rejected before loading or cache hits')
    character = { name: 'Primitive', server: 'freeport' }
    readable = false
    assert.deepEqual(gearOwnership(), NO_OWNERSHIP, 'switch back cannot resurrect a cleared cache')
    assert.deepEqual(currentWornFocus(), [])
    assert.equal(loads, 4, 'switch back rechecks the loader instead of using stale cached data')
  })
}

for (const path of ['C:/EQ/PRIMITIVE_FREEPORT-INVENTORY.TXT', 'C:/EQ/Primitive-Inventory.txt']) {
  test(`own supported basename remains cacheable: ${path}`, () => {
    found = { path, updatedAt: stamp }
    const { owned, focus } = primeCaches()
    assert.strictEqual(gearOwnership(), owned)
    assert.strictEqual(currentWornFocus(), focus)
    assert.equal(loads, 2)
  })
}

test('an unnamed character retains newest-dump fallback and cache reuse', () => {
  character = null
  const { owned, focus } = primeCaches()
  assert.strictEqual(gearOwnership(), owned)
  assert.strictEqual(currentWornFocus(), focus)
  assert.equal(loads, 2)
})
