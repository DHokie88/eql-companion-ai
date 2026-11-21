import type { Page } from 'playwright-core'
import { check, countOf, settle } from './appHarness.mjs'

const row = (key: string): string => `[data-testid="gear-row"][data-item-key="${key}"]`
const label = (key: string): string => `${row(key)} [data-testid="gear-item-tier-label"]`
const textOf = (page: Page, selector: string): Promise<string> =>
  page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.innerText ?? '', selector)

export async function checkOwnedTierLabel(page: Page, key: string): Promise<void> {
  check('owned item names identify the tier used for their stats', (await textOf(page, label(key))).trim() === '(yours +5)')
  await page.hover(row(key))
  const shown = await settle(async () => (await countOf(page, '[data-testid="gear-compare-owned-stats"]')) > 0, (ok) => ok, { timeoutMs: 15_000 })
  check('the owned comparison identifies the tier-floor estimate', shown)
}

export async function checkSimulatedTierLabel(page: Page, key: string): Promise<void> {
  check('unowned item names show the simulated tier', (await textOf(page, label(key))).trim() === '(+2)')
  const title = await page.getAttribute(label(key), 'title')
  check('the simulated tier identifies partial progress', title?.includes('3/4 progress') === true, title ?? '')
  await page.click('[data-testid="gear-owned-stats-toggle"]')
  check('tier labels disappear when owned stats are off', (await countOf(page, label(key))) === 0)
}
