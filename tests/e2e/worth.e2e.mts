/**
 * The New tools tab. Each row is the shipped function's result, read back from the page.
 *
 * Run: `node --import tsx tests/e2e/run-all.mts worth`
 */
import type { Page } from 'playwright-core'
import { buildIfStale, check, countOf, dumpArtifacts, failures, reportRun } from './appHarness.mjs'
import { mainWindow } from './appWindow.mjs'
import { launchOnFixture } from './logFixture.mjs'

function textOf(page: Page, sel: string): Promise<string> {
  return page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.innerText ?? '', sel)
}

async function answerNotice(page: Page): Promise<void> {
  if ((await countOf(page, '[data-testid="telemetry-notice"]')) === 0) return
  await page.click('[data-testid="telemetry-notice-off"]')
}

async function main(): Promise<void> {
  buildIfStale()
  const { app, close } = await launchOnFixture('e2e-telemetry.log', { waitForEngine: false })
  let page: Page | null = null
  try {
    page = await mainWindow(app)
    await page.waitForSelector('[data-testid="nav-overview"]', { timeout: 60_000 })
    await answerNotice(page)
    for (const id of ['nav-oracle', 'nav-bazaar', 'nav-zoneloot', 'nav-maps']) {
      check(`${id} is on the rail`, (await countOf(page, `[data-testid="${id}"]`)) === 1)
    }
    await page.click('[data-testid="nav-worth"]')
    await page.waitForSelector('[data-testid="worth-view"]', { timeout: 15_000 })
    const aa = await textOf(page, '[data-testid="worth-aa"]')
    check('the AA planner states a shortfall', aa.includes('shortfall 3'), aa)
    check('Nektropos is in the zone table', (await textOf(page, '[data-testid="worth-zones"]')).includes('nektropos'))
    check('archived history keeps the log name', (await textOf(page, '[data-testid="worth-archive"]')).includes('eqlog_Zarzac.txt'))
    const before = await textOf(page, '[data-testid="worth-loot-order"]')
    await page.click('[data-testid="loot-col-item"]')
    const after = await textOf(page, '[data-testid="worth-loot-order"]')
    check('the item column changes the loot order', before !== after, `${before} -> ${after}`)
    await page.click('[data-testid="worth-signin"]')
    check('signing in is what sends the loot', (await textOf(page, '[data-testid="worth-upload"]')).includes('Send 2'))
    await page.click('[data-testid="nav-oracle"]')
    check('Ask EQ Oracle is still a destination', (await countOf(page, '[data-testid="nav-oracle"]')) === 1)
    if (failures.length) await dumpArtifacts(page, 'worth-FAIL')
  } finally {
    await close()
  }
  reportRun()
}

main().catch((err: unknown) => {
  console.error('e2e: harness error -', err)
  process.exit(1)
})
