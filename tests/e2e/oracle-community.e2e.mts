/** Built worker + IPC + UI. Real references; model failure is explicit, never simulated AI. */
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildIfStale, ROOT } from './appHarness.mjs'
import { launchApp, mainWindow, makeUserData, removeUserData } from './appWindow.mjs'

buildIfStale()
const profile = makeUserData()
const install = join(profile, 'empty-game')
mkdirSync(join(install, 'Logs'), { recursive: true })
const launched = await launchApp({ userData: profile, installDir: install })
try {
  const page = await mainWindow(launched.app)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.locator('[data-testid="nav-community"]').click()
  await page.locator('[data-testid="community-entry"]').first().waitFor({ timeout: 40_000 })
  assert.match(await page.locator('[data-testid="community-view"]').innerText(), /[\d,]+ saved Discord records/)
  await page.locator('[data-testid="community-search"]').fill('loadout')
  await page.waitForFunction(() => document.querySelector('[data-testid="community-count"]')?.textContent?.includes('updates') && !document.querySelector('[role="status"]'))
  assert.ok(await page.locator('[data-testid="community-entry"]').count() > 0)
  await page.locator('[data-testid="community-entry"]').first().click()
  assert.ok(await page.getByRole('button', { name: 'Open original post', exact: true }).count() > 0)
  await page.locator('[data-testid="nav-oracle"]').click()
  await page.locator('[data-testid="oracle-view"]').waitFor()
  // No game log is present: both reference tabs must work without a character.
  await page.evaluate(() => window.eq.configureOracle({ host: 'nonexistent-eqo-test.invalid', address: '', model: 'qwen38' }))
  await page.locator('[data-testid="oracle-question"]').fill('What does Pillar of Fire do?')
  await page.locator('[data-testid="oracle-submit"]').click()
  await page.locator('[data-testid="oracle-answer"]').waitFor({ timeout: 70_000 })
  const fallback = await page.locator('[data-testid="oracle-answer"]').innerText()
  assert.match(fallback, /Reference search/)
  assert.match(fallback, /Pillar of Fire/)
  assert.match(fallback, /could not be found|Could not reach/)
  assert.ok(await page.locator('[data-testid="oracle-citation"]').count() > 0)
  // A no-evidence question must not invent an answer, or contact the model.
  await page.locator('[data-testid="oracle-question"]').fill('unfindablezzzxxyz')
  await page.locator('[data-testid="oracle-submit"]').click()
  await page.getByText(/I could not find enough matching evidence/).waitFor()
  assert.equal(await page.locator('[data-testid="oracle-citation"]').count(), 0)
  const address = process.env.EQ_ORACLE_LIVE_ADDRESS
  if (address) {
    await page.evaluate(address => window.eq.configureOracle({ host: 'aw', address, model: 'qwen38' }), address)
    const status = await page.evaluate(() => window.eq.testOracleConnection())
    assert.ok(status.available, status.message)
    await page.locator('[data-testid="oracle-question"]').fill('What does Pillar of Fire do?')
    await page.locator('[data-testid="oracle-submit"]').click()
    await page.getByText('Answer · qwen38', { exact: true }).waitFor({ timeout: 70_000 })
    assert.ok(await page.locator('[data-testid="oracle-citation"]').count() > 0)
    await page.locator('[data-testid="oracle-citation"]').first().click()
    await page.getByRole('button', { name: 'Open source', exact: true }).first().waitFor()
    console.log('PASS: built Electron UI answered through local qwen38 with catalog citations')
  }
  assert.deepEqual(errors, [])
  const artifacts = join(ROOT, 'tests/e2e/artifacts/oracle-community')
  mkdirSync(artifacts, { recursive: true })
  await page.screenshot({ path: join(artifacts, 'oracle.png'), fullPage: false })
  console.log('PASS: news filters/source links, global question box, offline fallback, no evidence, no-character access')
} finally { await launched.close(); await removeUserData(profile) }
