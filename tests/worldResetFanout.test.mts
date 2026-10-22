// Invoke the production rebuild/cursor fan-outs with only Electron window delivery and unrelated
// telemetry adapters replaced. Meter windows must hear resets without receiving ordinary cursors.
import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { createRequire, Module } from 'node:module'
import { IPC } from '../src/shared/ipc'
import { MODULE_WORLD_CHANGED, OVERLAY_KINDS, type OverlayKind } from '../src/shared/types'

const require = createRequire(import.meta.url)
const savedModules = new Map<string, NodeModule | undefined>()
const sends: { target: OverlayKind | 'main'; channel: string; args: unknown[] }[] = []
const missing = new Set<OverlayKind>()
const destroyed = new Set<OverlayKind>()

function replaceModule(path: string, exports: object): void {
  const resolved = require.resolve(path)
  savedModules.set(resolved, require.cache[resolved])
  const replacement = new Module(resolved)
  replacement.exports = exports
  replacement.loaded = true
  require.cache[resolved] = replacement
}

replaceModule('../src/main/windows.ts', {
  getOverlayWindow: (kind: OverlayKind) => missing.has(kind) ? null : {
    isDestroyed: () => destroyed.has(kind),
    webContents: { send: (channel: string, ...args: unknown[]) => sends.push({ target: kind, channel, args }) }
  },
  sendToMain: (channel: string, ...args: unknown[]) => sends.push({ target: 'main', channel, args })
})
replaceModule('../src/main/perfAttribution.ts', { timeSeam: (_name: string, run: () => void) => run() })
replaceModule('../src/main/switchNudge.ts', { noteTailLine: () => undefined })
replaceModule('../src/main/telemetry/breadcrumbs.ts', { noteEventKind: () => undefined })
replaceModule('../src/main/spellLibrary/modifierEvents.ts', { notifySpellModifierInputs: () => undefined })
const { COMBAT_RESET_OVERLAYS, MODULE_READING_OVERLAYS, sendWorldRebuilt, setWorldRebuiltObserver } =
  require('../src/main/worldRebuilt.ts') as typeof import('../src/main/worldRebuilt')
const { pushModuleChanged, pushWorldChanged } = require('../src/main/dataServer/serveDeltas.ts') as
  typeof import('../src/main/dataServer/serveDeltas')
const modules: OverlayKind[] = ['events', 'buffs', 'debuffs', 'xp', 'respawn', 'farm', 'run']
const meters: OverlayKind[] = ['fight', 'overall', 'heal-fight', 'heal-overall']
const character = { name: 'Primitive', server: 'freeport', logPath: 'C:/EQ/Logs/eqlog_Primitive_freeport.txt' }

beforeEach(() => {
  sends.length = 0
  missing.clear()
  destroyed.clear()
  setWorldRebuiltObserver(null)
})
after(() => {
  setWorldRebuiltObserver(null)
  for (const [path, saved] of savedModules) {
    if (saved) require.cache[path] = saved
    else Reflect.deleteProperty(require.cache, path)
  }
})

function recipients(channel: string): (OverlayKind | 'main')[] {
  return sends.filter((send) => send.channel === channel).map((send) => send.target)
}

test('four reset-only meters stay separate from all seven module-reading overlay kinds', () => {
  assert.deepEqual(COMBAT_RESET_OVERLAYS, meters)
  assert.deepEqual(MODULE_READING_OVERLAYS, modules)
  assert.ok(meters.every((kind) => !MODULE_READING_OVERLAYS.includes(kind)))
})

test('a character rebuild reaches main, every module overlay and every meter exactly once', () => {
  sendWorldRebuilt(character)
  assert.deepEqual(recipients(IPC.onCharacter), ['main', ...modules, ...meters])
  for (const send of sends) assert.strictEqual(send.args[0], character)
  assert.deepEqual(recipients(IPC.onModuleChanged), [])
})

test('same-character rebuilds and clearing a character are still genuine reset deliveries', () => {
  sendWorldRebuilt(character)
  sendWorldRebuilt(character)
  sendWorldRebuilt(null)
  for (const target of ['main', ...modules, ...meters]) {
    const frames = sends.filter((send) => send.target === target && send.channel === IPC.onCharacter)
    assert.equal(frames.length, 3, target)
    assert.strictEqual(frames[0].args[0], character)
    assert.strictEqual(frames[1].args[0], character)
    assert.equal(frames[2].args[0], null)
  }
})

test('engine world replacement sends the sentinel to all readers including meters', () => {
  pushWorldChanged()
  assert.deepEqual(recipients(IPC.onModuleChanged), ['main', ...modules, ...meters])
  for (const send of sends.filter((frame) => frame.channel === IPC.onModuleChanged)) {
    assert.deepEqual(send.args, [{ moduleId: MODULE_WORLD_CHANGED, seq: -1 }])
  }
})

test('ordinary module pushes reach existing readers and never the meter reset-only fan-out', () => {
  pushModuleChanged('loot', 42)
  assert.deepEqual(recipients(IPC.onModuleChanged), ['main', ...modules])
  for (const kind of meters) assert.ok(!recipients(IPC.onModuleChanged).includes(kind))
  for (const send of sends.filter((frame) => frame.channel === IPC.onModuleChanged)) {
    assert.deepEqual(send.args, [{ moduleId: 'loot', seq: 42 }])
  }
})

test('missing/destroyed overlays are skipped and unrelated window kinds receive no reset', () => {
  missing.add('fight')
  destroyed.add('heal-overall')
  missing.add('buffs')
  destroyed.add('run')
  sendWorldRebuilt(character)
  pushWorldChanged()
  const expected = ['main', ...modules, ...meters].filter((kind) =>
    !missing.has(kind as OverlayKind) && !destroyed.has(kind as OverlayKind))
  assert.deepEqual(recipients(IPC.onCharacter), expected)
  assert.deepEqual(recipients(IPC.onModuleChanged), expected)
  for (const kind of OVERLAY_KINDS.filter((k) => !modules.includes(k) && !meters.includes(k))) {
    assert.ok(!sends.some((send) => send.target === kind), `${kind} does not consume combat/module worlds`)
  }
})

test('the existing in-process rebuild observer still runs once after window delivery', () => {
  let calls = 0
  setWorldRebuiltObserver((current) => {
    calls++
    assert.strictEqual(current, character)
    assert.deepEqual(recipients(IPC.onCharacter), ['main', ...modules, ...meters])
  })
  sendWorldRebuilt(character)
  assert.equal(calls, 1)
})
