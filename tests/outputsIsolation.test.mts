// Real discovery and parsers over temporary EQ roots; only the Electron-backed configuration
// and warning sink are replaced. The test runner isolates this module cache from other suites.
import { after, afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire, Module } from 'node:module'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { outputKind, ownsOutputFile } from '../src/shared/outputs/kinds'

const require = createRequire(import.meta.url)
let root = ''
const warnings: unknown[][] = []
const savedModules = new Map<string, NodeModule | undefined>()

function replaceModule(path: string, exports: object): void {
  const resolved = require.resolve(path)
  savedModules.set(resolved, require.cache[resolved])
  const replacement = new Module(resolved)
  replacement.exports = exports
  replacement.loaded = true
  require.cache[resolved] = replacement
}

replaceModule('../src/main/log/config.ts', { effectiveEqRoot: () => root })
replaceModule('../src/main/errorLog.ts', { logWarn: (...args: unknown[]) => warnings.push(args) })
const { findOutputFile, loadOutput, loadInventoryDump, loadAchievements, outputStatus } =
  require('../src/main/outputs/index.ts') as typeof import('../src/main/outputs/index')

after(() => {
  for (const [path, saved] of savedModules) {
    if (saved) require.cache[path] = saved
    else Reflect.deleteProperty(require.cache, path)
  }
})

beforeEach(() => {
  root = fs.mkdtempSync(join(tmpdir(), 'eqo-output-isolation-'))
  warnings.length = 0
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

const fixtures = join(import.meta.dirname, 'fixtures')
const kinds = ['inventory', 'achievements'] as const

function writeDump(kind: typeof kinds[number], name: string): string {
  const suffix = outputKind(kind).fileKind
  const path = join(root, `${name}-${suffix}.txt`)
  fs.copyFileSync(join(fixtures, `Primitive_freeport-${suffix}.txt`), path)
  return path
}

function load(kind: typeof kinds[number], name?: string, server?: string): unknown {
  return kind === 'inventory' ? loadInventoryDump(name, server) : loadAchievements(name, server)
}

for (const kind of kinds) {
  test(`${kind}: another character remains discoverable but cannot supply saved progress`, () => {
    const other = writeDump(kind, 'Other_freeport')
    assert.equal(findOutputFile(kind, 'Primitive', 'freeport'), other)
    assert.equal(outputStatus(kind, { name: 'Primitive', server: 'freeport' }).path, other)
    assert.ok(loadOutput(kind, 'Primitive', 'freeport'), 'generic display reader keeps its fallback')
    assert.equal(load(kind, 'Primitive', 'freeport'), null)
    assert.deepEqual(warnings, [], 'ownership refusal is an ordinary missing dump')
  })

  test(`${kind}: same character on another server and name lookalikes are refused`, () => {
    for (const name of ['Primitive_firiona', 'OtherPrimitive_freeport', 'Primitive_freeport-backup']) {
      const path = writeDump(kind, name)
      assert.equal(findOutputFile(kind, 'Primitive', 'freeport'), path)
      assert.equal(load(kind, 'Primitive', 'freeport'), null, name)
      fs.unlinkSync(path)
    }
  })

  test(`${kind}: own mixed-case name and server win over a newer other character`, () => {
    const own = writeDump(kind, 'pRiMiTiVe_FrEePoRt')
    const other = writeDump(kind, 'Other_freeport')
    fs.utimesSync(own, 1_700_000_000, 1_700_000_000)
    fs.utimesSync(other, 1_700_000_100, 1_700_000_100)
    assert.equal(findOutputFile(kind, 'Primitive', 'freeport'), own)
    if (kind === 'inventory') {
      const loaded = loadInventoryDump('Primitive', 'freeport')
      assert.equal(loaded?.path, own)
      assert.ok(loaded && loaded.dump.sections.length > 0, 'real inventory rows are parsed')
    } else {
      const loaded = loadAchievements('Primitive', 'freeport', () => 123)
      assert.equal(loaded?.path, own)
      assert.ok(loaded && loaded.unlocks.length > 0, 'real earned claims are parsed')
      assert.equal(loaded?.source.readAt, 123)
    }
  })

  test(`${kind}: legacy serverless files and unnamed-character fallback remain available`, () => {
    const legacy = writeDump(kind, 'Primitive')
    assert.ok(load(kind, 'Primitive', 'freeport'), 'legacy exact character name')
    assert.ok(load(kind, 'Primitive'), 'character without a server')
    fs.unlinkSync(legacy)
    writeDump(kind, 'Other_freeport')
    assert.ok(load(kind), 'unknown character retains newest-file fallback')
    assert.ok(load(kind, undefined, 'freeport'), 'server alone cannot identify a character')
  })

  test(`${kind}: no output file returns no dump`, () => {
    assert.equal(load(kind, 'Primitive', 'freeport'), null)
    assert.deepEqual(warnings, [])
  })
}

test('ownership checks use the whole basename on either path separator', () => {
  const inventory = outputKind('inventory')
  assert.ok(ownsOutputFile(inventory, 'C:\\EQ\\Primitive_FREEPORT-INVENTORY.TXT', 'primitive', 'freeport'))
  assert.ok(ownsOutputFile(inventory, '/eq/Primitive_freeport-Inventory.txt', 'Primitive', 'freeport'))
  assert.equal(ownsOutputFile(inventory, '/eq/Alt_Primitive_freeport-Inventory.txt', 'Primitive', 'freeport'), false)
})

for (const kind of kinds) {
  test(`${kind}: a file removed between status and read warns and returns no dump`, (t) => {
    const path = writeDump(kind, 'Primitive_freeport')
    const stat = fs.statSync
    let stats = 0
    t.mock.method(fs, 'statSync', (...args: Parameters<typeof fs.statSync>) => {
      const result = stat(...args)
      if (args[0] === path && ++stats === 2) fs.unlinkSync(path)
      return result
    })
    assert.equal(load(kind, 'Primitive', 'freeport'), null)
    assert.equal(stats, 2, 'discovery and status both statted a real file before its removal')
    assert.equal(warnings.length, 1)
    assert.match(String(warnings[0][0]), new RegExp(`Could not read ${kind} dump`))
    assert.ok(String(warnings[0][0]).includes(path))
    assert.equal((warnings[0][1] as NodeJS.ErrnoException).code, 'ENOENT')
  })
}
