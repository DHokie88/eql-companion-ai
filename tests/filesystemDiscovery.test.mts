// Real discovery over temporary EQ installs. Replace only the persisted store, then induce
// syscall failures on exact temp paths so permission/race coverage is deterministic on Windows.
import { after, afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire, Module } from 'node:module'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
let root = ''
let logs = ''
let override = ''
const storePath = require.resolve('../src/main/store.ts')
const savedStore = require.cache[storePath]
const store = new Module(storePath)
store.exports = { getEqInstallDir: () => override }
store.loaded = true
require.cache[storePath] = store
const config = require('../src/main/log/config.ts') as typeof import('../src/main/log/config')
const { findOutputFile } = require('../src/main/outputs/discovery.ts') as
  typeof import('../src/main/outputs/discovery')
const savedLogPath = process.env.EQ_LOG_PATH

beforeEach(() => {
  root = fs.mkdtempSync(join(tmpdir(), 'eqo-fs-discovery-'))
  logs = join(root, 'Logs')
  fs.mkdirSync(logs)
  override = root
  Reflect.deleteProperty(process.env, 'EQ_LOG_PATH')
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))
after(() => {
  if (savedStore) require.cache[storePath] = savedStore
  else Reflect.deleteProperty(require.cache, storePath)
  if (savedLogPath === undefined) Reflect.deleteProperty(process.env, 'EQ_LOG_PATH')
  else process.env.EQ_LOG_PATH = savedLogPath
})

function datedFile(directory: string, file: string, seconds: number): string {
  const path = join(directory, file)
  fs.writeFileSync(path, 'test file\n')
  fs.utimesSync(path, seconds, seconds)
  return path
}

function denied(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`deterministic filesystem ${code}`), { code })
}

test('outputs preserve exact character preference, newest fallback and kind filtering', () => {
  const own = datedFile(root, 'Primitive_freeport-Inventory.txt', 1_700_000_000)
  const newest = datedFile(root, 'Other_freeport-Inventory.txt', 1_700_000_100)
  datedFile(root, 'Primitive_freeport-Achievements.txt', 1_700_000_200)
  assert.equal(findOutputFile('inventory', 'Primitive', 'freeport'), own)
  assert.equal(findOutputFile('inventory', 'Missing', 'freeport'), newest)
  assert.equal(findOutputFile('inventory'), newest)
})

test('a dump removed after readdir is skipped while another candidate remains usable', (t) => {
  const gone = datedFile(root, 'Primitive_freeport-Inventory.txt', 1_700_000_100)
  const other = datedFile(root, 'Other_freeport-Inventory.txt', 1_700_000_000)
  const stat = fs.statSync
  t.mock.method(fs, 'statSync', (...args: Parameters<typeof fs.statSync>) => {
    if (args[0] === gone) fs.unlinkSync(gone)
    return stat(...args)
  })
  assert.equal(findOutputFile('inventory', 'Primitive', 'freeport'), other)
  assert.equal(fs.existsSync(gone), false, 'the stat saw an actual deleted file')
})

test('an inaccessible dump does not hide other readable candidates', (t) => {
  const blocked = datedFile(root, 'Primitive_freeport-Inventory.txt', 1_700_000_100)
  const other = datedFile(root, 'Other_freeport-Inventory.txt', 1_700_000_000)
  const stat = fs.statSync
  t.mock.method(fs, 'statSync', (...args: Parameters<typeof fs.statSync>) => {
    if (args[0] === blocked) throw denied('EACCES')
    return stat(...args)
  })
  assert.equal(findOutputFile('inventory', 'Primitive', 'freeport'), other)
})

for (const code of ['EACCES', 'EPERM', 'ENOENT']) {
  test(`an output root listing failure (${code}) is no dump`, (t) => {
    datedFile(root, 'Primitive_freeport-Inventory.txt', 1_700_000_000)
    const read = fs.readdirSync
    t.mock.method(fs, 'readdirSync', (...args: Parameters<typeof fs.readdirSync>) => {
      if (args[0] === root) throw denied(code)
      return read(...args)
    })
    assert.equal(findOutputFile('inventory', 'Primitive', 'freeport'), null)
  })
}

test('a missing install root or a file used as root has no output dumps', () => {
  override = join(root, 'missing-install')
  assert.equal(findOutputFile('inventory'), null)
  // Mocking the persisted root alone cannot force a file as root: normalization properly
  // resolves an existing file to its parent. A nonexistent child through a file still tests
  // the real ENOTDIR listing without changing that path interpretation policy.
  const file = datedFile(root, 'plain-file', 1_700_000_000)
  override = join(file, 'install')
  assert.equal(findOutputFile('inventory'), null)
})

test('character listing keeps newest-first ordering and ignores non-character files', () => {
  const older = datedFile(logs, 'eqlog_Primitive_freeport.txt', 1_700_000_000)
  const newer = datedFile(logs, 'eqlog_Other_freeport.txt', 1_700_000_100)
  datedFile(logs, 'notes.txt', 1_700_000_200)
  datedFile(logs, 'eqlog_invalid.txt', 1_699_999_900)
  assert.deepEqual(config.listCharacters().map((c) => c.logPath), [newer, older])
  assert.equal(config.resolveActiveCharacter()?.logPath, newer)
})

for (const method of ['listCharacters', 'resolveActiveCharacter'] as const) {
  test(`${method}: a log removed after readdir does not displace a readable log`, (t) => {
    const gone = datedFile(logs, 'eqlog_Gone_freeport.txt', 1_700_000_100)
    const other = datedFile(logs, 'eqlog_Other_freeport.txt', 1_700_000_000)
    const stat = fs.statSync
    t.mock.method(fs, 'statSync', (...args: Parameters<typeof fs.statSync>) => {
      if (args[0] === gone) fs.unlinkSync(gone)
      return stat(...args)
    })
    const found = method === 'listCharacters'
      ? config.listCharacters().map((c) => c.logPath)
      : [config.resolveActiveCharacter()?.logPath]
    assert.deepEqual(found, [other])
    assert.equal(fs.existsSync(gone), false)
  })
}

for (const code of ['EACCES', 'EPERM']) {
  test(`unreadable Logs (${code}) lists no characters and preserves the Settings verdict`, (t) => {
    datedFile(logs, 'eqlog_Primitive_freeport.txt', 1_700_000_000)
    const read = fs.readdirSync
    t.mock.method(fs, 'readdirSync', (...args: Parameters<typeof fs.readdirSync>) => {
      if (args[0] === logs) throw denied(code)
      return read(...args)
    })
    assert.deepEqual(config.listCharacters(), [])
    assert.equal(config.resolveActiveCharacter(), null)
    const resolved = config.resolveEqDir()
    assert.equal(resolved.root, root)
    assert.equal(resolved.source, 'manual')
    assert.equal(resolved.readable, 'unreadable')
    assert.equal(resolved.readError, code)
  })
}

test('missing Logs and a regular file named Logs yield no characters', () => {
  fs.rmdirSync(logs)
  assert.deepEqual(config.listCharacters(), [])
  assert.equal(config.resolveActiveCharacter(), null)
  fs.writeFileSync(logs, 'not a directory')
  assert.deepEqual(config.listCharacters(), [])
  assert.equal(config.resolveActiveCharacter(), null)
})

test('log stat failures leave parseable identity but exclude inaccessible discovery candidates', (t) => {
  const blocked = datedFile(logs, 'eqlog_Primitive_freeport.txt', 1_700_000_100)
  const other = datedFile(logs, 'eqlog_Other_freeport.txt', 1_700_000_000)
  const stat = fs.statSync
  t.mock.method(fs, 'statSync', (...args: Parameters<typeof fs.statSync>) => {
    if (args[0] === blocked) throw denied('EPERM')
    return stat(...args)
  })
  assert.equal(config.parseLogName(blocked)?.name, 'Primitive')
  assert.equal(config.parseLogName(blocked)?.lastPlayed, undefined)
  assert.deepEqual(config.listCharacters().map((c) => c.logPath), [other])
  assert.equal(config.resolveActiveCharacter()?.logPath, other)
})

test('explicit log selection wins over newer logs even when Logs cannot be listed', (t) => {
  const selected = datedFile(logs, 'eqlog_Primitive_freeport.txt', 1_700_000_000)
  datedFile(logs, 'eqlog_Other_freeport.txt', 1_700_000_100)
  process.env.EQ_LOG_PATH = selected
  const read = fs.readdirSync
  t.mock.method(fs, 'readdirSync', (...args: Parameters<typeof fs.readdirSync>) => {
    if (args[0] === logs) throw denied('EACCES')
    return read(...args)
  })
  assert.equal(config.resolveActiveCharacter()?.logPath, selected)
})

test('root, Logs and logfile persisted overrides keep the same normalized root', () => {
  const log = datedFile(logs, 'eqlog_Primitive_freeport.txt', 1_700_000_000)
  for (const picked of [root, logs, log]) {
    override = picked
    assert.equal(config.effectiveEqRoot(), root)
    assert.deepEqual(config.listCharacters().map((c) => c.logPath), [log])
  }
})

test('invalid output kinds still reject programmer errors outside filesystem catches', () => {
  assert.throws(() => findOutputFile('invalid' as 'inventory'), /Unknown output kind/)
})

for (const reader of ['listCharacters', 'resolveActiveCharacter', 'findOutputFile'] as const) {
  test(`${reader}: disappearance of the only listed candidate yields no files`, (t) => {
    const output = reader === 'findOutputFile'
    const gone = datedFile(output ? root : logs,
      output ? 'Primitive_freeport-Inventory.txt' : 'eqlog_Primitive_freeport.txt', 1_700_000_000)
    const stat = fs.statSync
    t.mock.method(fs, 'statSync', (...args: Parameters<typeof fs.statSync>) => {
      if (args[0] === gone) fs.unlinkSync(gone)
      return stat(...args)
    })
    if (output) assert.equal(findOutputFile('inventory'), null)
    else if (reader === 'listCharacters') assert.deepEqual(config.listCharacters(), [])
    else assert.equal(config.resolveActiveCharacter(), null)
  })
}
