/** Focused Gear tier labels against a real inventory dump and simulated fractional tier. */
import type { Page } from 'playwright-core'
import { buildIfStale, check, dumpArtifacts, failures, reportRun, settle, settleCount } from './appHarness.mjs'
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
  await page.evaluate(() => localStorage.setItem('eq.gear.columnWidths', JSON.stringify({ name: 64 })))
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
  const resize = page.getByTestId('gear-resize-name')
  check('the saved narrow Item width is used before labels are shown', await resize.getAttribute('aria-valuenow') === '64')
  await page.click('[data-testid="gear-owned-stats-toggle"]')
  await selectItem(page, OWNED_KEY)
  const ownedReady = await settle(async () => (await page.locator(`${row(OWNED_KEY)} [data-testid="gear-item-tier-label"]`).innerText()) === '(yours +5)', (ok) => ok, { timeoutMs: 30_000 })
  check('the owned tier label is ready', ownedReady)
  const geometry = await page.locator(row(OWNED_KEY)).evaluate((el) => {
    const cell = el.querySelector('td')?.getBoundingClientRect()
    const name = el.querySelector('[data-testid="planner-donor-name"]')?.getBoundingClientRect()
    const label = el.querySelector('[data-testid="gear-item-tier-label"]')?.getBoundingClientRect()
    return { cell: cell?.width ?? 0, name: name?.width ?? 0, labelRight: label?.right ?? Infinity,
      cellRight: cell?.right ?? 0, rowHeight: el.getBoundingClientRect().height }
  })
  check('the Item cell has room for its name and tier label at a saved narrow width',
    geometry.cell >= 220 && geometry.name >= 80 && geometry.labelRight <= geometry.cellRight && Math.abs(geometry.rowHeight - 37) <= 1,
    JSON.stringify(geometry))
  check('the resize handle reports the temporary Item minimum', await resize.getAttribute('aria-valuemin') === '220')
  check('showing the tier does not overwrite the saved width', await page.evaluate(() => JSON.parse(localStorage.getItem('eq.gear.columnWidths') ?? '{}').name === 64))
  await checkOwnedTierLabel(page, OWNED_KEY)
  await selectItem(page, UNOWNED_KEY)
  await checkSimulatedTierLabel(page, UNOWNED_KEY)
  const restored = await settle(async () => await resize.getAttribute('aria-valuenow') === '64', (ok) => ok, { timeoutMs: 15_000 })
  check('turning labels off restores the saved width and normal resize minimum', restored && await resize.getAttribute('aria-valuemin') === '64')
  await resize.focus()
  await page.keyboard.press('ArrowRight')
  check('the restored Item width can still be resized', await settle(async () => await resize.getAttribute('aria-valuenow') === '80', (ok) => ok, { timeoutMs: 15_000 }))
  await page.click('[data-testid="gear-owned-stats-toggle"]')
  await settle(async () => await resize.getAttribute('aria-valuenow') === '220', (ok) => ok, { timeoutMs: 15_000 })
  const handle = await resize.boundingBox()
  if (!handle) throw new Error('Item resize handle is not visible')
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x - 100, handle.y + handle.height / 2)
  await page.mouse.up()
  check('dragging cannot save an Item width below its visible minimum',
    await page.evaluate(() => JSON.parse(localStorage.getItem('eq.gear.columnWidths') ?? '{}').name === 220))
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
