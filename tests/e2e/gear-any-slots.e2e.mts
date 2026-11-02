import { buildIfStale, dumpArtifacts, reportRun } from './appHarness.mjs'
import { mainWindow, makeUserData, removeUserData } from './appWindow.mjs'
import { launchOnFixture, stageFixture } from './logFixture.mjs'
import { stepGearCompare } from './gearCompareSteps.mjs'
import type { GearRow } from '../../src/shared/planner/gear'

const row: GearRow = {
  key: 'thelvorn, blade of light', name: 'Thelvorn, Blade of Light', searchKey: 'thelvorn, blade of light',
  slots: ['PRIMARY'], classes: ['PAL'], races: ['ALL'], flags: [], quest: false, playerCrafted: false,
  stats: { WIS: 15, DMG: 20, DELAY: 26, WEIGHT: 3 }, effects: []
}

async function main(): Promise<void> {
  buildIfStale()
  const userData = makeUserData()
  const log = stageFixture('e2e-planner.log', { inventory: 'Primitive_freeport-Inventory.txt' })
  const launched = await launchOnFixture(log, { userData })
  try {
    const page = await mainWindow(launched.app)
    try {
      await page.waitForSelector('[data-testid="nav-gear"]', { timeout: 60000 })
      if (await page.locator('[data-testid="telemetry-notice-off"]').count()) await page.click('[data-testid="telemetry-notice-off"]')
      await page.click('[data-testid="nav-gear"]')
      await page.click('[data-testid="tab-gear"]')
      await page.waitForSelector('[data-testid="gear-row"]', { timeout: 60000 })
      await stepGearCompare(launched.app, page, row)
    } catch (error) { await dumpArtifacts(page, 'gear-any-slots-FAIL'); throw error }
  } finally { await launched.close(); await removeUserData(userData); await log.dispose() }
  reportRun()
}
main().catch((err: unknown) => { console.error(err); process.exitCode = 1 })
