/** Columns and form preferences keep their original shared-profile, two-launch contract. */
import { settleCount } from './appHarness.mjs'
import { clearPicks, pickIn } from './gearFilterSteps.mjs'
import { stepGearColumns, stepGearColumnsRelaunched } from './gearColumnSteps.mjs'
import { stepGearMemory, stepGearMemoryRelaunched } from './areaMemorySteps.mjs'
import { COLUMNS, setCheckpoint } from './gearSuiteSteps.mjs'
import { runGearSuite } from './gearSuiteRunner.mjs'

await runGearSuite('gear-persistence', async (_app, page) => {
  await settleCount(page, '[data-testid="gear-row"]', 1, { timeoutMs: 60_000 })
  await clearPicks(page, '[data-testid="gear-classes"]')
  await page.click('[data-testid="gear-era-toggle"]')
  await pickIn(page, '[data-testid="gear-slot"]', 'PRIMARY')
  await setCheckpoint(page)
  await stepGearColumns(page, COLUMNS)
  await stepGearMemory(page)
}, async (_app, page) => {
  await stepGearColumnsRelaunched(page)
  await stepGearMemoryRelaunched(page)
})
