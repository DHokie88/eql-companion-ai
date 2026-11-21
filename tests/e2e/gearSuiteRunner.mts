/** One isolated fixture per Gear spec; persistence runs two launches over the same profile. */
import type { ElectronApplication, Page } from 'playwright-core'
import { buildIfStale, check, dumpArtifacts, failures, reportRun } from './appHarness.mjs'
import { mainWindow, makeUserData, removeUserData } from './appWindow.mjs'
import { launchOnFixture, stageFixture, type FixtureLog } from './logFixture.mjs'
import { stepMount } from './gearSuiteSteps.mjs'

type Steps = (app: ElectronApplication, page: Page, log: FixtureLog) => Promise<void>

export async function runGearSuite(name: string, firstSteps: Steps, secondSteps?: Steps): Promise<void> {
  buildIfStale()
  const consoleErrors: string[] = []
  const userData = makeUserData()
  const log = stageFixture('e2e-planner.log', { inventory: 'Primitive_freeport-Inventory.txt' })
  const run = async (steps: Steps, suffix: string): Promise<void> => {
    const launch = await launchOnFixture(log, { userData })
    try {
      const page = await mainWindow(launch.app)
      page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
      page.on('pageerror', (error) => consoleErrors.push(String(error)))
      try {
        if (await stepMount(page)) await steps(launch.app, page, log)
        if (failures.length) await dumpArtifacts(page, `${name}-${suffix}-FAIL`)
      } catch (error) {
        await dumpArtifacts(page, `${name}-${suffix}-FAIL`)
        throw error
      }
    } finally {
      await launch.close()
    }
  }
  try {
    await run(firstSteps, 'first')
    if (secondSteps) await run(secondSteps, 'relaunch')
  } finally {
    await removeUserData(userData)
    await log.dispose()
  }
  check('no renderer console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
  reportRun()
}
