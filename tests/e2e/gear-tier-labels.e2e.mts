/** Focused Gear tier labels against a real inventory dump and simulated fractional tier. */
import type { Page } from 'playwright-core'
import { buildIfStale, check, countOf, dumpArtifacts, failures, reportRun, settle, settleCount } from './appHarness.mjs'
import { mainWindow } from './appWindow.mjs'
import { launchOnFixture } from './logFixture.mjs'
import { clearPicks } from './gearFilterSteps.mjs'
import { checkOwnedTierLabel, checkSimulatedTierLabel } from './gearUpgradeLabelSteps.mjs'

const OWNED_KEY = 'thelvorn, blade of light'
const UNOWNED_KEY = 'zraxthril forged flamberge'
const SEARCH = '[data-testid="gear-search"] input'
const row = (key: string): string => `[data-testid="gear-row"][data-item-key="${key}"]`

async function selectItem(page: Page, name: string): Promise<void> {
  await page.fill(SEARCH, name)
  await settleCount(page, row(name), 1, { timeoutMs: 30_000 })
}

async function steps(page: Page): Promise<void> {
  await page.click('[data-testid="nav-gear"]', { timeout: 60_000 })
  await page.click('[data-testid="tab-gear"]', { timeout: 30_000 })
  await settleCount(page, '[data-testid="gear-row"]', 1, { timeoutMs: 60_000 })
  await clearPicks(page, '[data-testid="gear-classes"]')
  await page.click('[data-testid="gear-era-toggle"]')
  const tier = '[data-testid="gear-tier-slider"] input[type="range"]'
  await page.focus(tier)
  for (const key of ['Home', 'ArrowRight', 'ArrowRight']) await page.press(tier, key)
  const fraction = '[data-testid="gear-fraction-slider"] input[type="range"]'
  await page.focus(fraction)
  await page.press(fraction, 'End')
  const sliderReady = await settle(async () => (await page.getByTestId('gear-upgrade-label').innerText()).includes('3/4'), (ok) => ok, { timeoutMs: 15_000 })
  check('the simulation is tier 2 with 3/4 progress', sliderReady)
  await page.click('[data-testid="gear-owned-stats-toggle"]')
  await selectItem(page, OWNED_KEY)
  const ownedReady = await settle(async () => (await page.locator(`${row(OWNED_KEY)} [data-testid="gear-item-tier-label"]`).innerText()) === '(yours +5)', (ok) => ok, { timeoutMs: 30_000 })
  check('the owned tier label is ready', ownedReady)
  await checkOwnedTierLabel(page, OWNED_KEY)
  await selectItem(page, UNOWNED_KEY)
  await checkSimulatedTierLabel(page, UNOWNED_KEY)
}

async function main(): Promise<void> {
  buildIfStale()
  const launch = await launchOnFixture('e2e-planner.log', { inventory: 'Primitive_freeport-Inventory.txt' })
  try {
    const page = await mainWindow(launch.app)
    try {
      await steps(page)
      if (failures.length) await dumpArtifacts(page, 'gear-tier-labels-FAIL')
    } catch (error) {
      await dumpArtifacts(page, 'gear-tier-labels-FAIL')
      throw error
    }
  } finally {
    await launch.close()
  }
  reportRun()
}

main().catch((error: unknown) => { console.error('e2e: harness error —', error); process.exitCode = 1 })
