/** Built worker + IPC + UI. Real references; model failure is explicit, never simulated AI. */
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildIfStale, ROOT } from './appHarness.mjs'
import { launchApp, mainWindow, makeUserData, removeUserData } from './appWindow.mjs'
import { runtimeFixture, updateRuntimeCheck } from '../discordRuntimeFixture.mts'

buildIfStale()
const profile = makeUserData()
const install = join(profile, 'empty-game')
mkdirSync(join(install, 'Logs'), { recursive: true })
// An empty install has no character log for auto-discovery; use the normal saved folder setting.
writeFileSync(join(profile, 'everquest-companion-progress.json'), JSON.stringify({ eqInstallDir: install }))
const reference = join(install, 'reference/discord')
await runtimeFixture(reference)
// Synthetic editorial copy tests the digest UI without depending on a live event or the model.
const savedHighlights = JSON.parse(readFileSync(join(reference, 'runtime/highlightsOfficial.json'), 'utf8'))
const post = Object.values(savedHighlights.records)[0] as { provenance: { url: string } }
const digest = { schemaVersion: 1, generatedAt: '2026-10-25T12:00:00Z', entries: [{ id: 'e2e-reward',
  title: 'Seasonal quest — collect a limited-time illusion', summary: 'Complete the seasonal quest to collect the event reward.',
  whyItMatters: 'The free reward is available for a limited time.', kind: 'limited-reward', confidence: 'community-report',
  date: '2026-10-25T12:00:00Z', expiresAt: '2099-11-01T00:00:00Z',
  sources: [{ url: post.provenance.url, label: 'Event post' }], relatedLinks: [] }] }
writeFileSync(join(reference, 'runtime/mustRead.json'), JSON.stringify(digest))
await updateRuntimeCheck(reference, '2026-10-24T12:45:28Z')
const launched = await launchApp({ userData: profile, installDir: install })
try {
  const page = await mainWindow(launched.app)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.locator('[data-testid="nav-community"]').getByText('New in EQL', { exact: true }).waitFor()
  await page.locator('[data-testid="nav-community"]').click()
  await page.locator('[data-testid="community-view"]').getByRole('heading', { name: 'New in EQL', exact: true }).waitFor()
  await page.locator('[data-testid="community-entry"]').first().waitFor({ timeout: 40_000 })
  await page.getByText('Seasonal quest — collect a limited-time illusion', { exact: true }).waitFor()
  assert.equal(await page.locator('[data-testid="community-entry"]').count(), 1)
  assert.match(await page.locator('[data-testid="community-entry"]').innerText(), /Why it matters:/)
  assert.match(await page.locator('[data-testid="community-entry"]').innerText(), /Player reports · unverified/)
  await page.getByRole('button', { name: 'Open original post', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Check now', exact: true }).waitFor()
  assert.doesNotMatch(await page.locator('[data-testid="community-entry"]').innerText(), /paint job|Great Wolf|undead side/i)
  assert.match(await page.locator('[data-testid="community-view"]').innerText(), /[\d,]+ saved Discord records/)
  const initialSnapshot = await page.evaluate(() => window.eq.getCommunityFeed({}))
  assert.equal(initialSnapshot.snapshot.lastCheckedAt, '2026-10-24T12:45:28Z', JSON.stringify(initialSnapshot.snapshot))
  await page.getByText('Last checked: Oct 24, 8:45 AM EDT', { exact: true }).waitFor()
  await page.getByText(/Discord checks: 7 a.m., 3 p.m. and 9 p.m. Eastern/).waitFor()
  // Answer the isolated profile's first-run notice before interacting with the footer.
  const notice = page.getByTestId('telemetry-notice')
  if (await notice.isVisible()) {
    await page.getByTestId('telemetry-notice-off').click()
    await notice.waitFor({ state: 'hidden' })
  }
  const coverage = page.getByTestId('community-coverage')
  await coverage.getByRole('button', { name: 'Coverage notes', exact: true }).click()
  await coverage.locator('.MuiCollapse-entered').waitFor()
  for (const title of ['Historical channel access', 'Image-only prices', 'Poll results']) {
    await coverage.getByText(title, { exact: true }).waitFor()
    assert.equal(await coverage.getByText(title, { exact: true }).count(), 1)
  }
  assert.doesNotMatch(await coverage.innerText(), /HTTP 403|fifteen channels|user-token API/)
  const coverageArtifacts = join(ROOT, 'tests/e2e/artifacts/oracle-community')
  mkdirSync(coverageArtifacts, { recursive: true })
  await coverage.evaluate(element => element.scrollIntoView({ block: 'end' }))
  const coverageBounds = await coverage.boundingBox()
  assert.ok(coverageBounds)
  await page.screenshot({ path: join(coverageArtifacts, 'coverage.png'), clip: coverageBounds, timeout: 10_000 })
  await updateRuntimeCheck(reference, '2026-10-24T19:00:00Z')
  await page.evaluate(() => window.dispatchEvent(new Event('oracle-refresh-complete')))
  await page.getByText('Last checked: Oct 24, 3:00 PM EDT', { exact: true }).waitFor()
  await page.getByLabel('Show', { exact: true }).click()
  await page.getByRole('option', { name: 'All updates', exact: true }).click()
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
