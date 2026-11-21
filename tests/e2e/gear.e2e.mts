/** Gear index, inventory, wish and comparison checks on an isolated fixture. */
import { check, pageOverflow } from './appHarness.mjs'
import { stepGearClassFilter } from './gearFilterSteps.mjs'
import { stepGearWish } from './gearWishSteps.mjs'
import { stepGearCompare } from './gearCompareSteps.mjs'
import { THELVORN_BASE, stepRows, stepEra, stepOwnedCells, stepOwnedFilter } from './gearSuiteSteps.mjs'
import { runGearSuite } from './gearSuiteRunner.mjs'

await runGearSuite('gear', async (app, page, log) => {
  if (!(await stepRows(page))) return
  await stepGearClassFilter(page)
  await stepGearWish(page)
  await stepEra(page)
  await stepOwnedCells(page, log)
  await stepOwnedFilter(page)
  await stepGearCompare(app, page, THELVORN_BASE)
  const over = await pageOverflow(page)
  check('Gear never scrolls the page (its table clips inside its own box)', over.doc === 0 && over.content === 0,
    `document +${String(over.doc)}px · content area +${String(over.content)}px`)
})
