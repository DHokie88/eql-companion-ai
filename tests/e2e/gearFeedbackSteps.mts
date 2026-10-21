import type { Page } from 'playwright-core'
import { check, countOf, settle } from './appHarness.mjs'

async function priority(page: Page, key: string, label: string): Promise<void> {
  await page.locator(`[data-testid="gear-priority-${key}"] [role="combobox"]`).click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

export async function stepGearFeedback(page: Page): Promise<void> {
  const layout = await page.evaluate(() => {
    const row = document.querySelector('[data-testid="gear-row"]')
    const actions = row?.querySelector('[data-testid="gear-cell-actions"]')
    const wish = actions?.querySelector('[data-testid="gear-wish"]')
    const preview = actions?.querySelector('[data-testid="gear-preview"]')
    return {
      icon: wish?.tagName === 'BUTTON' && wish.textContent === '' && wish.getAttribute('aria-label') !== null,
      separate: row?.children[0].querySelector('[data-testid="gear-wish"]') === null,
      preview: preview !== null,
      centered: [...(row?.children ?? [])].slice(2).every((cell) => getComputedStyle(cell).textAlign === 'center')
    }
  })
  check('wish is an accessible icon in the separate Actions column', layout.icon && layout.separate && layout.preview, JSON.stringify(layout))
  check('all cells to the right of Actions are centered', layout.centered)
  check('twelve individual stat priorities appear above the table', await countOf(page, '[data-testid="gear-priorities"] [role="combobox"]') === 13)
  for (const key of ['slot', 'classes', 'owned']) {
    const header = page.locator(`[data-testid="gear-sort-${key}"]`)
    await header.click()
    check(`${key} header activates its sort`, (await header.getAttribute('class'))?.includes('Mui-active') === true)
  }
  for (const key of ['AC', 'MP', 'HASTE', 'STR', 'STA', 'INT', 'WIS', 'DEX', 'SV_MAGIC', 'SV_FIRE', 'SV_COLD']) await priority(page, key, 'Off')
  await page.locator('[data-testid="gear-priority-extras"] [role="combobox"]').click()
  await page.getByRole('option', { name: 'CHA', exact: true }).click()
  await page.keyboard.press('Escape')
  check('optional CHA gets its own priority control', await countOf(page, '[data-testid="gear-priority-CHA"]') === 1)
  await priority(page, 'CHA', 'Off')
  await priority(page, 'HP', 'Top')
  const values = await settle(() => page.locator('[data-testid="gear-cell-SCORE"]').allTextContents(),
    (scores) => scores.length > 0 && Number(scores[0]) === 100)
  check('HP-only weighting ranks the best matching HP at Score 100', Number(values[0]) === 100, values.slice(0, 5).join(', '))
  check('weighted scores rank highest first', values.every((value, index) => index === 0 || Number(values[index - 1]) >= Number(value)))
  await page.locator('[data-testid="gear-sort-SCORE"]').click()
  const ascending = await settle(() => page.locator('[data-testid="gear-cell-SCORE"]').allTextContents(),
    (scores) => scores.length > 1 && scores.every((value, index) => index === 0 || Number(scores[index - 1]) <= Number(value)))
  const direction = await page.evaluate(() => document.querySelector('[data-testid="gear-sort-SCORE"]')?.closest('th')?.getAttribute('aria-sort'))
  check('Score header announces ascending order', direction === 'ascending', String(direction))
  check('Score header also reverses the weighted sort', ascending.length > 1 && ascending.every((value, index) => index === 0 || Number(ascending[index - 1]) <= Number(value)), ascending.slice(0, 8).join(', '))
  await page.locator('[data-testid="gear-priorities-reset"]').click()
  check('reset restores every priority to Normal', (await page.locator('[data-testid="gear-priorities"] [data-testid^="gear-priority-"]:not([data-testid="gear-priority-extras"]) [role="combobox"]').allTextContents()).every((text) => text === 'Normal'))
  await priority(page, 'HP', 'Top')
  await page.evaluate(() => { const list = document.querySelector('[data-testid="gear-list"]'); if (list) list.scrollLeft = 0 })
}

export async function stepGearFeedbackRelaunched(page: Page): Promise<void> {
  check('optional individual stats survive an app restart', await countOf(page, '[data-testid="gear-priority-CHA"]') === 1)
  check('chosen priorities survive an app restart', await page.locator('[data-testid="gear-priority-HP"] [role="combobox"]').textContent() === 'Top')
}
