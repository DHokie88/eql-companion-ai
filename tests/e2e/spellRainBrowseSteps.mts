/** Target controls must change Browse arithmetic, not only ranking scenarios. */
import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import { dumpArtifacts, settle } from './appHarness.mjs'

async function choose(page: Page, id: string, name: string): Promise<void> {
  await page.getByTestId(id).click()
  await page.getByRole('option', { name, exact: true }).click()
}
async function rainAmount(page: Page): Promise<string> {
  return page.getByTestId('spells-amount-302-damage').innerText()
}
export async function browseRainChecks(page: Page): Promise<void> {
  await page.getByTestId('spells-search').fill('302')
  const row = page.getByTestId('spells-record')
  assert.equal(await settle(() => row.count(), (n) => n === 1), 1)
  assert.equal(await page.getByTestId('spells-sort-type').count(), 0, 'one matching type is redundant')
  for (let targets = 1; targets <= 4; targets++) {
    await choose(page, 'spells-target-count', `${targets} target${targets > 1 ? 's' : ''}`)
    const expected = targets === 1 ? '60' : '80'
    assert.equal(await settle(() => rainAmount(page), (value) => value === expected), expected)
    const compact = `20 × ${targets === 1 ? 3 : 4}`
    assert.equal(await settle(() => row.getByTestId('rain-summary-302').innerText(), (value) => value === compact), compact)
    assert.doesNotMatch(await row.getByTestId('spells-amount-302-damage').innerText(), /Partial|Range|→/)
    const efficiencyColumn = await page.getByRole('table', { name: 'Spell catalog' }).locator('thead th').evaluateAll((headers) => headers.findIndex((header) => header.textContent?.replace(/\s/g, '').includes('Damage/Mana')))
    assert.equal(await row.locator('td').nth(efficiencyColumn).innerText(), targets === 1 ? '6' : '8', 'efficiency uses one client mana payment')
  }
  await choose(page, 'spells-target-count', '3 targets')
  assert.equal(await settle(() => row.getByTestId('rain-summary-302').innerText(), (value) => value === '20 × 4'), '20 × 4')
  await page.getByTestId('spells-open-302').click()
  const detail = page.getByTestId('spells-detail')
  assert.equal(await settle(() => detail.getByTestId('spells-amount-302-damage').innerText(), (value) => value === '80'), '80')
  assert.match(await settle(() => detail.getByTestId('rain-summary-302').first().innerText(), (value) => value.includes('3 + 1')), /3 \+ 1/)
  await page.getByTestId('spells-detail-back').click()
  assert.equal(await page.getByTestId('spells-search').inputValue(), '302')
  assert.equal(await rainAmount(page), '80')
  await choose(page, 'spells-target-count', 'Spell maximum')
  assert.equal(await settle(() => rainAmount(page), (value) => value === '80'), '80')
  assert.equal(await settle(() => row.getByTestId('rain-summary-302').innerText(), (value) => value === 'max 20 × 4'), 'max 20 × 4')
  await choose(page, 'spells-target-count', '4 targets')
  assert.equal(await settle(() => row.getByTestId('rain-summary-302').innerText(), (value) => value === '20 × 4'), '20 × 4')
  await dumpArtifacts(page, 'rain-browse')
  await page.getByTestId('spells-reset-filters').click()
}
export async function categoryAndTableChecks(page: Page): Promise<void> {
  const table = page.getByRole('table', { name: 'Spell catalog' })
  assert.equal(await table.getByTestId('spells-sort-category').count(), 1)
  await page.getByTestId('spells-type-dd').click()
  await table.getByTestId('spells-sort-subcategory').waitFor()
  assert.equal(await table.getByTestId('spells-sort-category').count(), 0, 'DD uses the same category suppression as the dropdown')
  await page.getByTestId('spells-type-all').click()
  await table.getByTestId('spells-sort-category').waitFor()
  await table.getByTestId('spells-sort-category').click()
  await choose(page, 'spells-category', 'Test category')
  assert.equal(await table.getByTestId('spells-sort-category').count(), 0)
  const subcategory = table.getByTestId('spells-sort-subcategory')
  await subcategory.waitFor()
  assert.equal(await settle(() => subcategory.locator('..').getAttribute('aria-sort'), (value) => value === 'ascending'), 'ascending')
  await choose(page, 'spells-subcategory', 'Test subcategory')
  assert.equal(await table.getByTestId('spells-sort-subcategory').count(), 0)
  const alignments = await table.getByTestId('spells-record').first().locator('td').evaluateAll((cells) => cells.slice(2).map((cell) => getComputedStyle(cell).textAlign))
  assert.ok(alignments.length > 0 && alignments.every((alignment) => alignment === 'center'))
  await page.getByTestId('spells-type-rain').click()
  assert.equal(await settle(() => table.getByTestId('spells-record').count(), (n) => n === 1), 1)
  assert.equal(await settle(() => table.getByTestId('spells-open-302').count(), (n) => n === 1), 1)
  assert.match(await table.getByTestId('spells-record').innerText(), /Lava Storm/i)
  await choose(page, 'spells-type-cap', 'AOE8')
  assert.equal(await settle(() => table.getByTestId('spells-record').count(), (n) => n === 1), 1)
  assert.equal(await settle(() => table.getByTestId('spells-open-301').count(), (n) => n === 1), 1)
  assert.match(await table.getByTestId('spells-record').innerText(), /Test Area/i)
  assert.equal(await table.getByTestId('spells-sort-type').count(), 0)
  await page.getByTestId('spells-reset-filters').click()
}
