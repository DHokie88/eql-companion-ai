/** Compare controls stay beside spell names, including in a horizontally overflowing table. */
import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import { buildIfStale, dumpArtifacts, settle } from './appHarness.mjs'
import { mainWindow } from './appWindow.mjs'
import { launchOnFixture, stageFixture } from './logFixture.mjs'
import { stageAnalysisSources } from './spellAnalysisFixture.mjs'

async function choose(page: Page, id: string, name: string): Promise<void> {
  await page.getByTestId(id).click()
  await page.getByRole('option', { name, exact: true }).click()
}
async function selectSpell(page: Page, id: number): Promise<void> {
  await page.getByTestId('spells-search').fill(String(id))
  await page.getByTestId(`spells-compare-${id}`).click()
}
async function emptyComparison(page: Page): Promise<void> {
  await page.getByText('Add up to four spells from Browse or Progression.', { exact: true }).waitFor()
  assert.equal(await page.getByTestId('spells-calculation').count(), 0)
  assert.equal(await page.getByTestId('spells-compare').locator('table').count(), 0)
  assert.equal(await page.getByTestId('spells-tab-compare').textContent(), 'Compare')
  assert.equal(await page.getByTestId('spells-clear-comparison').isDisabled(), true)
}
async function compareControls(page: Page): Promise<void> {
  await page.getByTestId('spells-tab-compare').click()
  assert.equal(await settle(() => page.getByTestId('spells-calculation').count(), (n) => n === 4), 4)
  assert.equal(await page.getByTestId('spells-tab-compare').textContent(), 'Compare (4/4)')
  await choose(page, 'compare-reference', 'Lava Storm (302)')
  await choose(page, 'spells-global-rank', 'V')
  await choose(page, 'spell-preview-rank-301', 'III')
  const summary = page.getByTestId('compare-effects-738')
  assert.match(await summary.innerText(), /Slows attacks by 30%/)
  assert.match(await summary.innerText(), /Slows movement by 80%/)
  const positions = await page.getByTestId('spells-compare').locator('[data-testid^="spells-remove-"]').evaluateAll((buttons) => buttons.map((button) => {
    const bounds = button.getBoundingClientRect()
    const container = button.closest('table')!.parentElement!
    return { inViewport: bounds.left >= 0 && bounds.right <= window.innerWidth, scrollLeft: container.scrollLeft }
  }))
  assert.equal(positions.length, 4)
  assert.ok(positions.every((position) => position.inViewport && position.scrollLeft === 0), 'every remove control is accessible without horizontal scrolling')
  await summary.scrollIntoViewIfNeeded()
  await dumpArtifacts(page, 'spell-compare-controls-ready')
  await page.getByRole('button', { name: 'Remove Lava Storm from comparison', exact: true }).click()
  assert.equal(await settle(() => page.getByTestId('spells-calculation').count(), (n) => n === 3), 3)
  assert.equal(await page.getByTestId('spells-remove-302').count(), 0)
  for (const id of [201, 301, 738]) assert.equal(await page.getByTestId(`spells-remove-${id}`).count(), 1)
  assert.equal(await page.getByTestId('spells-tab-compare').textContent(), 'Compare (3/4)')
  assert.match(await page.getByTestId('compare-reference').innerText(), /Test New Fifty \(201\)/)
  await page.getByTestId('spells-clear-comparison').click()
  await emptyComparison(page)
  await page.getByTestId('spells-tab-browse').click()
  await selectSpell(page, 301)
  await page.getByTestId('spells-tab-compare').click()
  await page.getByTestId('spell-preview-rank-301').waitFor()
  assert.match(await page.getByTestId('spells-global-rank').innerText(), /V/)
  assert.match(await page.getByTestId('spell-preview-rank-301').innerText(), /III/)
  await page.getByTestId('spells-clear-comparison').click()
  await page.getByTestId('spells-tab-browse').click()
  await page.getByTestId('spells-tab-compare').click()
  await emptyComparison(page)
}

buildIfStale()
const staged = stageFixture('e2e-combat.log'), count = stageAnalysisSources(staged)
const launch = await launchOnFixture(staged)
const page = await mainWindow(launch.app)
page.setDefaultTimeout(20_000)
try {
  await settle(() => page.evaluate(() => window.eq.spellLibrary.status()), (s) => s.dataset?.recordCount === count, { timeoutMs: 120_000 })
  const notice = page.getByTestId('telemetry-notice-off')
  if (await notice.isVisible()) await notice.click()
  const win = await launch.app.browserWindow(page)
  await win.evaluate((w) => { if (w.isMaximized()) w.unmaximize(); w.setBounds({ ...w.getBounds(), width: 900, height: 950 }) })
  await settle(() => page.evaluate(() => window.innerWidth), (width) => width <= 920)
  await page.getByTestId('nav-spells').click()
  await page.getByTestId('spells-classes').click(); await page.getByTestId('spells-classes-all').click()
  await page.getByTestId('spells-level').fill('50')
  await page.getByTestId('spells-group-all').click()
  for (const id of [201, 301, 302, 738]) await selectSpell(page, id)
  await compareControls(page)
  console.log('PASS Compare: visible remove controls, selected-reference fallback, slow percentages, clear all, preserved ranks and empty selection after tab roundtrip.')
} catch (error) { await dumpArtifacts(page, 'spell-compare-controls-failure'); throw error }
finally { await launch.close(); await staged.dispose() }
