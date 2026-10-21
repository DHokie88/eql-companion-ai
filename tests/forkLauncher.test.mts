import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function isRunning(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false
    throw error
  }
}

test('Open-Fork.cmd passes its directory intact through CMD and START (including spaces)', {
  skip: process.platform !== 'win32', timeout: 30_000
}, async () => {
  const root = mkdtempSync(join(tmpdir(), 'EQL launcher with spaces '))
  try {
    for (const path of ['node_modules/electron/dist', 'out/main', 'engine/target/release']) {
      mkdirSync(join(root, path), { recursive: true })
    }
    copyFileSync(join(ROOT, 'Open-Fork.cmd'), join(root, 'Open-Fork.cmd'))
    // A real Windows executable parses the command line, then records Node's received argv.
    // A string assertion or CMD's own %1 would miss the trailing-backslash/quote defect.
    copyFileSync(process.execPath, join(root, 'node_modules/electron/dist/electron.exe'))
    writeFileSync(join(root, 'out/main/index.js'), '')
    writeFileSync(join(root, 'engine/target/release/zengine.exe'), '')
    writeFileSync(join(root, 'package.json'), JSON.stringify({ main: 'probe.cjs' }))
    writeFileSync(join(root, 'probe.cjs'), `require('node:fs').writeFileSync(${JSON.stringify(join(root, 'argv.json'))}, JSON.stringify({ pid: process.pid, argv: process.argv.slice(1), cwd: process.cwd() }))`)
    const launch = spawnSync(process.env.ComSpec ?? 'cmd.exe', [
      '/d', '/s', '/c', `""${join(root, 'Open-Fork.cmd')}" --launcher-probe "two words""`
    ], { cwd: tmpdir(), windowsHide: true, windowsVerbatimArguments: true, timeout: 5_000 })
    assert.equal(launch.status, 0, launch.stderr.toString())
    const output = join(root, 'argv.json')
    const deadline = Date.now() + 5_000
    while (!existsSync(output) && Date.now() < deadline) await delay(50)
    assert.ok(existsSync(output), 'the launcher never reached the app: CMD/START corrupted its app path')
    const received = JSON.parse(readFileSync(output, 'utf8')) as { pid: number; argv: string[]; cwd: string }
    assert.equal(resolve(received.argv[0]), root)
    assert.deepEqual(received.argv.slice(1), ['--launcher-probe', 'two words'])
    assert.equal(received.cwd, root)
    // START detaches: writing the result does not mean the process has released its cwd yet.
    const exitDeadline = Date.now() + 5_000
    let running = isRunning(received.pid)
    while (running && Date.now() < exitDeadline) {
      await delay(50)
      running = isRunning(received.pid)
    }
    assert.equal(running, false, 'the owned launcher probe must exit before removing its directory')
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 })
  }
})
