import { buildIfStale, check, dumpArtifacts, failures, reportRun } from './appHarness.mjs'
import { mainWindow, makeUserData, removeUserData } from './appWindow.mjs'
import { launchOnFixture, stageFixture } from './logFixture.mjs'
import { stepGearFeedback, stepGearFeedbackRelaunched } from './gearFeedbackSteps.mjs'

async function main(): Promise<void> {
  buildIfStale()
  const userData = makeUserData()
  const fixture = stageFixture('e2e-planner.log', { inventory: 'Primitive_freeport-Inventory.txt' })
  try {
    const first = await launchOnFixture(fixture, { userData })
    try {
      const page = await mainWindow(first.app)
      await page.locator('[data-testid="nav-gear"]').click()
      await page.locator('[data-testid="gear-row"]').first().waitFor()
      await page.locator('[data-testid="gear-owned-header"]').waitFor()
      await stepGearFeedback(page)
      await dumpArtifacts(page, failures.length ? 'gear-priorities-FAIL' : 'gear-priorities-pass')
    } finally { await first.close() }
    const second = await launchOnFixture(fixture, { userData })
    try {
      const page = await mainWindow(second.app)
      await page.locator('[data-testid="nav-gear"]').click()
      await page.locator('[data-testid="gear-row"]').first().waitFor()
      await stepGearFeedbackRelaunched(page)
      check('Score sort survives a restart', (await page.locator('[data-testid="gear-sort-SCORE"]').getAttribute('class'))?.includes('Mui-active') === true)
    } finally { await second.close() }
  } finally {
    await removeUserData(userData)
    await fixture.dispose()
  }
  reportRun()
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1 })
