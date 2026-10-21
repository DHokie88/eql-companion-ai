import type { Page } from 'playwright-core'
import { check, settle } from './appHarness.mjs'

export async function stepGearRefinement(page: Page): Promise<void> {
  const centers = await page.evaluate(() => [...document.querySelectorAll('[data-testid="gear-table"] th')].map((cell) => {
    const label = cell.querySelector('[data-testid^="gear-sort-"]') ?? cell
    const text = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
    if (!text) return 0
    const range = document.createRange()
    range.selectNodeContents(text)
    const word = range.getBoundingClientRect()
    const box = cell.getBoundingClientRect()
    return Math.abs((word.left + word.right) / 2 - (box.left + box.right) / 2)
  }))
  check('every header title is geometrically centered, including Item and sorted headers', centers.every((offset) => offset <= 2), centers.map((offset) => offset.toFixed(1)).join(', '))
  const era = page.locator('[data-testid="gear-era-toggle"]')
  const wasOn = (await era.getAttribute('class'))?.includes('MuiChip-colorPrimary') === true
  if (wasOn) await era.click()
  await page.locator('[data-testid="gear-search"] input').fill('Gallentine')
  const dense = await settle(() => page.locator('[data-testid="gear-cell-classes"] [data-compact="true"]').count(), (count) => count > 0)
  check('long class lists use the compact presentation', dense > 0)
  const sizes = await page.evaluate(() => [...document.querySelectorAll('[data-testid="gear-cell-classes"] [data-compact="true"]')].map((box) => ({
    lines: box.children.length,
    font: getComputedStyle(box).fontSize,
    row: box.closest('tr')?.getBoundingClientRect().height ?? 0
  })))
  check('compact classes occupy two 8px lines while rows remain 37px tall', sizes.length > 0 && sizes.every((size) => size.lines === 2 && size.font === '8px' && Math.abs(size.row - 37) <= 1), JSON.stringify(sizes))
  await page.locator('[data-testid="gear-search"] input').fill('')
  if (wasOn) await era.click()
}
