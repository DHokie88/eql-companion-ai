// Real Electron preload, worker entry, Preferences and lookup/Gear consumers. No network:
// EQ_E2E disables downloads, and this spec seeds only its own temporary profile.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from 'playwright-core'
import { buildIfStale, check, reportRun } from './appHarness.mjs'
import { mainWindow, makeUserData, removeUserData } from './appWindow.mjs'
import { launchOnFixture } from './logFixture.mjs'
import { decodeWikiDataset } from '../../src/main/wikiDatasetCodec'

async function openCard(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="nav-preferences"]', { timeout: 60_000 })
  if (await page.locator('[data-testid="telemetry-notice-off"]').count()) {
    await page.click('[data-testid="telemetry-notice-off"]')
  }
  await page.click('[data-testid="nav-preferences"]')
  await page.click('[data-testid="prefs-rail-wiki-data"]')
  await page.waitForSelector('[data-testid="wiki-dataset-refresh"]', { timeout: 20_000 })
}

async function main(): Promise<void> {
  buildIfStale()
  const userData = makeUserData()
  const cacheDir = join(userData, 'wiki-dataset')
  const file = join(cacheDir, 'wiki-dataset.json')
  try {
    const first = await launchOnFixture('e2e-copy.log', { userData })
    try {
      const page = await mainWindow(first.app)
      await openCard(page)
      await page.waitForFunction(() => document.querySelector('[data-testid="wiki-dataset-setting"]')?.textContent?.includes('shipped corpora'))
      check('fresh launch uses bundled items without downloading', !existsSync(file))
    } finally { await first.close() }

    const stamp = '2026-11-01T12:32:52Z'
    const cache = decodeWikiDataset({ meta: { schemaVersion: 3, sample: false, generatedAt: stamp },
      zones: [{ name: 'Qeynos' }], npcs: [], items: [{ wikiTitle: 'Wiki Dataset Test Sword',
        name: 'Wiki Dataset Test Sword', revisionId: 123, era: 'Unknown',
        displayLines: ['MAGIC ITEM', 'Slot: PRIMARY', 'Class: WAR', 'AC: 42', 'HP: +123'] }] },
      { version: 'isolated-fixture-v1', generatedAt: stamp, sha256: 'a'.repeat(64) }, stamp)
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(file, JSON.stringify(cache))
    const before = readFileSync(file)
    const second = await launchOnFixture('e2e-copy.log', { userData })
    try {
      const page = await mainWindow(second.app)
      await openCard(page)
      await page.waitForFunction(() => document.querySelector('[data-testid="wiki-dataset-setting"]')?.textContent?.includes('isolated-fixture-v1'))
      const proof = await page.evaluate(async () => {
        const item = await window.eq.lookupItem('Wiki Dataset Test Sword')
        const gear = await window.eq.gearIndex()
        return { page: item.page, ac: item.stats?.ac, revision: item.wikiDataset?.revisionId,
          gearHasItem: gear.rows.some((row) => row.name === 'Wiki Dataset Test Sword') }
      })
      assert.deepEqual(proof, { page: 'Wiki Dataset Test Sword', ac: 42, revision: 123, gearHasItem: true })
      check('saved worker cache reaches item lookup and Gear through the actual preload', true)
      await page.click('[data-testid="wiki-dataset-refresh"]')
      await page.waitForFunction(() => document.querySelector('[data-testid="wiki-dataset-setting"]')?.textContent?.includes('downloads are disabled during isolated tests'))
      check('failed refresh remains retryable', await page.locator('[data-testid="wiki-dataset-refresh"]').isEnabled())
      check('failed refresh keeps the saved dataset byte for byte', before.equals(readFileSync(file)))
    } finally { await second.close() }
  } finally { await removeUserData(userData) }
  reportRun()
}
main().catch((err: unknown) => { console.error(err); process.exitCode = 1 })
