/** Launch the desktop entry point itself, never a substitute electron.launch() command. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright-core'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** START detaches. Identify only this launch, including the pre-CDP failure path. */
function ownedPids(token: string): number[] {
  const found = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    'Get-CimInstance Win32_Process -Filter "Name = \'electron.exe\'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($env:EQL_SMOKE_TOKEN) -and -not $_.CommandLine.Contains("--type=") } | Select-Object -ExpandProperty ProcessId | ConvertTo-Json -Compress'
  ], { env: { ...process.env, EQL_SMOKE_TOKEN: token }, encoding: 'utf8', windowsHide: true, timeout: 5_000 })
  assert.equal(found.status, 0, `could not identify owned smoke processes: ${found.stderr}`)
  if (!found.stdout.trim()) return []
  const pids = JSON.parse(found.stdout) as number | number[]
  return Array.isArray(pids) ? pids : [pids]
}

function isolatedEnv(root: string): NodeJS.ProcessEnv {
  // Do not inherit game paths, engine overrides, Chromium flags or the caller's proxies.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/^(?:EQ_|EQC_|ELECTRON_|CHROME_|CHROMIUM_|NODE_OPTIONS$|(?:HTTP|HTTPS|ALL|NO)_PROXY$)/i.test(key)
  ))
  return {
    ...env, EQ_E2E: '1', EQ_E2E_USER_DATA: join(root, 'profile'),
    EQ_INSTALL_DIR: join(root, 'game'), NODE_ENV: 'production'
  }
}

async function mainPage(browser: Browser, deadline: number): Promise<Page> {
  while (Date.now() < deadline) {
    for (const page of browser.contexts().flatMap((context) => context.pages())) {
      if (await page.evaluate(() => typeof window.eq?.getCombatSnapshot === 'function').catch(() => false)) return page
    }
    await delay(100)
  }
  throw new Error('Open-Fork.cmd never loaded the main window and its real preload bridge')
}

test('the fork desktop launcher loads the built UI, preload and matching release engine', { timeout: 75_000 }, async () => {
  assert.equal(process.platform, 'win32', 'the desktop startup gate must run on Windows')
  for (const path of ['out/main/index.js', 'out/renderer/index.html', 'engine/target/release/zengine.exe']) {
    assert.ok(existsSync(join(ROOT, path)), `missing ${path}; run npm run build and npm run build:engine first`)
  }
  const root = mkdtempSync(join(tmpdir(), 'EQL startup '))
  const userData = join(root, 'profile')
  const deadline = Date.now() + 45_000
  let browser: Browser | undefined
  try {
    mkdirSync(join(root, 'game/Logs'), { recursive: true })
    copyFileSync(join(ROOT, 'tests/fixtures/e2e-telemetry.log'), join(root, 'game/Logs/eqlog_Primitive_freeport.txt'))
    const args = [
      '--remote-debugging-port=0', `--user-data-dir="${userData}"`, '--mute-audio',
      '--disable-background-networking', '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list="<-loopback>"'
    ]
    const launched = spawnSync(process.env.ComSpec ?? 'cmd.exe', [
      '/d', '/s', '/c', `""${join(ROOT, 'Open-Fork.cmd')}" ${args.join(' ')}"`
    ], { env: isolatedEnv(root), cwd: tmpdir(), windowsHide: true, windowsVerbatimArguments: true, timeout: 5_000 })
    assert.equal(launched.status, 0, launched.stderr.toString())
    const portFile = join(userData, 'DevToolsActivePort')
    while (!existsSync(portFile) && Date.now() < deadline) await delay(100)
    assert.ok(existsSync(portFile), 'Open-Fork.cmd never started Electron debugging; the app may have failed before loading')
    const [port, endpoint] = readFileSync(portFile, 'utf8').trim().split(/\r?\n/)
    browser = await chromium.connectOverCDP(`ws://127.0.0.1:${port}${endpoint}`, { timeout: Math.max(1, deadline - Date.now()) })
    const page = await mainPage(browser, deadline)
    assert.equal(await page.title(), 'EQ Oracle', 'the built main window must use the Oracle brand')
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.locator('[data-testid="overview-grid"]').waitFor({ state: 'attached', timeout: Math.max(1, deadline - Date.now()) })
    assert.equal(await page.getByText('EQ Oracle (EQO)', { exact: true }).count(), 1, 'the title bar must use the Oracle brand')
    await page.waitForFunction(async () => (await window.eq.engineLaunchState()).phase === 'live', undefined, {
      timeout: Math.max(1, deadline - Date.now())
    })
    const snapshot = await page.evaluate(() => window.eq.getCombatSnapshot())
    assert.ok(snapshot && typeof snapshot === 'object', 'the real preload IPC must answer from the engine')
    assert.equal(await page.locator('[data-testid="crash-report"]').count(), 0, 'startup rendered the ErrorBoundary fallback')
    assert.deepEqual(pageErrors, [], 'startup emitted an uncaught renderer error')
    const errorLog = join(userData, 'errors.log')
    assert.equal(existsSync(errorLog) ? readFileSync(errorLog, 'utf8').trim() : '', '', 'startup wrote errors.log')
    console.log('Open-Fork.cmd: main window, Overview, preload IPC and release engine are ready (isolated fixture).')
  } finally {
    // Never kill by image name: the user may have their own Companion open beside this run.
    const results = ownedPids(userData).map((pid) => {
      const killed = spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 5_000 })
      return { pid, status: killed.status, error: killed.error?.message }
    })
    await Promise.race([browser?.close().catch(() => undefined), delay(2_000, undefined, { ref: false })])
    assert.deepEqual(ownedPids(userData), [], `owned app survived teardown: ${JSON.stringify(results)}`)
    rmSync(root, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 })
  }
})
