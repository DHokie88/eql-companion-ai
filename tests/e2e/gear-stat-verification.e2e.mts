import { check, settle, settleCount } from './appHarness.mjs'
import { clearPicks } from './gearFilterSteps.mjs'
import { runGearSuite } from './gearSuiteRunner.mjs'

const VAMBRACES = 'lustrous russet vambraces'

await runGearSuite('gear-stat-verification', async (_app, page) => {
  await clearPicks(page, '[data-testid="gear-classes"]')
  await page.fill('[data-testid="gear-search"] input', VAMBRACES)
  const selector = `[data-testid="gear-row"][data-item-key="${VAMBRACES}"]`
  if (!check('Gear finds the Vambraces', await settleCount(page, selector, 1, { timeoutMs: 30_000 }) === 1)) return
  const row = page.locator(selector)
  const ac = row.getByTestId('gear-cell-AC')
  check('corrected base AC has evidence in the table', await ac.textContent() === '13' &&
    await ac.getAttribute('data-stat-source') === 'verified' && await ac.getAttribute('title') === 'Ruby verified')
  await row.hover()
  check('the comparison shows verification for base AC',
    await settle(async () => (await page.getByTestId('gear-compare-stats').textContent())?.includes('AC 13 ✓') ?? false, Boolean))
  await page.click('[data-testid="gear-owned-stats-toggle"]')
  const estimated = await settle(async () => await ac.getAttribute('data-stat-source') === 'estimated', Boolean, { timeoutMs: 30_000 })
  check('the owned +2 AC uses the corrected base and is marked as an estimate', estimated &&
    await ac.textContent() === '15' && await row.getByTestId('gear-item-tier-label').textContent() === '(yours +2)')
})
