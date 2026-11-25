/**
 * The New tools tab. Each row is the shipped function's result, read back from the page.
 *
 * Run: `node --import tsx tests/e2e/run-all.mts worth`
 */
import type { Page } from 'playwright-core'
import { buildIfStale, check, countOf, dumpArtifacts, failures, reportRun, settle } from './appHarness.mjs'
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
    const quest = await textOf(page, '[data-testid="worth-quest"]')
    check('quest pages read Starts In and the Summary checklist', quest.includes('East Freeport') && quest.includes('Hail the guard'), quest)
    check('spell files prefer spells_us.txt', (await textOf(page, '[data-testid="worth-spells"]')) === 'spells_us.txt')
    const scale = await textOf(page, '[data-testid="worth-scale"]')
    check('listed Void and explicit Accuracy scale, generated Accuracy does not', scale.includes('Void 6 / 2') && scale.includes('accuracy 15 vs 10'), scale)
    check('Best in slot names the higher score', (await textOf(page, '[data-testid="worth-bis"]')).includes('Best Steel'))
    check('archived history keeps the log name', (await textOf(page, '[data-testid="worth-archive"]')).includes('eqlog_Zarzac.txt'))
    check('the quests tab is still on the rail', (await countOf(page, '[data-testid="nav-quests"]')) === 1)
    const before = await textOf(page, '[data-testid="worth-loot-order"]')
    await page.click('[data-testid="loot-col-item"]')
    const after = await textOf(page, '[data-testid="worth-loot-order"]')
    check('the item column changes the loot order', before !== after, `${before} -> ${after}`)
    await page.click('[data-testid="worth-signin"]')
    check('signing in is what sends the loot', (await textOf(page, '[data-testid="worth-upload"]')).includes('Send 2'))
    await page.click('[data-testid="nav-loot"]')
    await page.waitForSelector('[data-testid="loot-list"]', { timeout: 15_000 })
    const beforeLootSign = await page.getAttribute('[data-testid="loot-list"]', 'data-loot-send')
    check('loot upload stays off before signing in on the Loot tab', beforeLootSign === 'no', String(beforeLootSign))
    await page.click('[data-testid="loot-sign-in"]')
    const lootPage = page
    const afterLootSign = await settle(
      () => lootPage.getAttribute('[data-testid="loot-list"]', 'data-loot-send'),
      (v) => v === 'yes',
      { timeoutMs: 5_000 }
    )
    check('signing in on the Loot tab enables loot upload', afterLootSign === 'yes', String(afterLootSign))
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
