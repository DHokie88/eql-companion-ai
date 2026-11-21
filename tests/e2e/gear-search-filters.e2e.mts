/** Search, filters, sorting and simulated upgrades, isolated from persistence checks. */
import { settleCount } from './appHarness.mjs'
import { clearPicks, stepGearWeaponTypes } from './gearFilterSteps.mjs'
import { stepGearEffectiveHp } from './gearEffectiveHpSteps.mjs'
import { stepSearch, stepFilters, stepSort, stepUpgrade } from './gearSuiteSteps.mjs'
import { runGearSuite } from './gearSuiteRunner.mjs'

await runGearSuite('gear-search-filters', async (_app, page) => {
  await settleCount(page, '[data-testid="gear-row"]', 1, { timeoutMs: 60_000 })
  await clearPicks(page, '[data-testid="gear-classes"]')
  await page.click('[data-testid="gear-era-toggle"]')
  if (!(await stepSearch(page))) return
  await stepGearWeaponTypes(page)
  await stepGearEffectiveHp(page)
  await stepFilters(page)
  await stepSort(page)
  await stepUpgrade(page)
})
