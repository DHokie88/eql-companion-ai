import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildIfStale } from './appHarness.mjs'
import { launchApp, mainWindow, makeUserData, removeUserData } from './appWindow.mjs'
import type { OracleRefreshStatus } from '../../src/shared/oracleRefresh.ts'

buildIfStale()
const profile = makeUserData()
const install = join(profile, 'empty-game')
mkdirSync(join(install, 'Logs'), { recursive: true })
writeFileSync(join(profile, 'everquest-companion-progress.json'), JSON.stringify({ eqInstallDir: install }))
const launched = await launchApp({ userData: profile, installDir: install })
try {
  const page = await mainWindow(launched.app)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.getByTestId('nav-community').click()
  await page.getByTestId('community-view').waitFor()
  const status = await page.evaluate(() => window.eq.getOracleRefreshStatus())
  assert.equal(status.state, 'idle', 'isolated tests cannot trigger live harvesting')
  await page.evaluate(() => {
    const probe = window as unknown as { refreshCompletions: number }
    probe.refreshCompletions = 0
    window.addEventListener('oracle-refresh-complete', () => { probe.refreshCompletions++ })
  })
  const push = (value: OracleRefreshStatus): Promise<void> => launched.app.evaluate(({ BrowserWindow }, payload) => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('oracle:refresh-changed', payload)
  }, value)
  await push({ state: 'running', lastCheckedAt: null, message: 'Checking Discord in the background. You can keep using EQ Oracle.' })
  await page.getByTestId('oracle-refresh-notice').getByText('Checking Discord in the background. You can keep using EQ Oracle.').waitFor()
  await page.getByTestId('nav-oracle').click()
  await page.getByTestId('oracle-view').waitFor()
  assert.ok(await page.getByTestId('oracle-refresh-notice').isVisible(), 'progress survives page navigation')
  await page.getByTestId('oracle-refresh-notice').getByRole('button', { name: 'Close' }).click()
  await page.getByTestId('oracle-refresh-notice').waitFor({ state: 'hidden' })
  await push({ state: 'running', lastCheckedAt: null, message: 'Checking Discord in the background. You can keep using EQ Oracle.' })
  assert.equal(await page.getByTestId('oracle-refresh-notice').count(), 0, 'polling respects a dismissed progress notice')
  await push({ state: 'complete', lastCheckedAt: '2026-10-25T11:00:00Z', message: 'Discord updates are ready.' })
  await page.getByTestId('oracle-refresh-notice').getByText('Discord updates are ready.').waitFor()
  assert.equal(await page.evaluate(() => (window as unknown as { refreshCompletions: number }).refreshCompletions), 1)
  await push({ state: 'failed', lastCheckedAt: '2026-10-25T11:00:00Z', message: 'The check failed. Saved updates remain available.' })
  await page.getByTestId('oracle-refresh-notice').getByRole('button', { name: 'Check now' }).waitFor()
  assert.equal(await page.evaluate(() => (window as unknown as { refreshCompletions: number }).refreshCompletions), 1, 'failure does not announce completion')
  assert.deepEqual(errors, [])
  console.log('PASS: refresh progress and completion across navigation, saved-data failure/retry, isolated network behavior')
} finally { await launched.close(); await removeUserData(profile) }
