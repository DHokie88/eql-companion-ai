/** Browse feedback through the real query worker and renderer, using synthetic client records. */
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from 'playwright-core'
import { SPELL_SOURCE_FILES } from '../../src/shared/spellLibrary'
import { spellBundle, spellFields } from '../fixtures/spell-library/synthetic'
import { buildIfStale, settle, dumpArtifacts } from './appHarness.mjs'
import { mainWindow, makeUserData, removeUserData } from './appWindow.mjs'
import { launchOnFixture, stageFixture } from './logFixture.mjs'

function rows(): string[][] {
  const records = Array.from({ length: 50 }, (_, index) => {
    const fields = spellFields(200 + index, `Test Bolt ${50 - index}`)
    fields[47] = String(index + 1); fields[14] = String(index + 1); fields[172] = `1|79|-${(index + 1) * 10}|0|100|0`
    return fields
  })
  const hymn = spellFields(7, 'Test Hymn of Restoration With a Long Wrapped Name'); hymn[47] = '255'; hymn[43] = '6'; hymn[28] = '1'; hymn[14] = '0'; hymn[172] = '1|100|10|0|100|0'; hymn[11] = '5'
  const dot = spellFields(900, 'Test Burn'); dot[47] = '20'; dot[11] = '5'; dot[172] = '1|0|-10|0|100|0'
  const ae = spellFields(901, 'Test Area'); ae[47] = '5'; ae[30] = '8'
  const heal = spellFields(902, 'Test Heal'); heal[28] = '1'; heal[47] = '30'; heal[172] = '1|79|80|0|100|0'
  const buff = spellFields(903, 'Test Ward'); buff[28] = '1'; buff[47] = '1'; buff[172] = '1|1|10|0|100|0'
  const npc = spellFields(904, 'Test Internal'); npc[47] = '255'
  return [hymn, ...records, dot, ae, heal, buff, npc]
}
async function visibleIds(page: Page): Promise<number[]> {
  return page.locator('[data-testid="spells-record"]').evaluateAll((elements) => elements.map((e) => Number(e.querySelector('td')?.textContent)))
}
async function expectIds(page: Page, expected: number[]): Promise<void> {
  const result = await settle(async () => ({ ids: await visibleIds(page), loading: await page.getByLabel('Searching spells').count() }),
    ({ ids, loading }) => !loading && ids.join(',') === expected.join(','), { timeoutMs: 30_000 })
  assert.deepEqual(result.ids, expected)
}
async function firstId(page: Page, id: number): Promise<void> {
  const result = await settle(async () => ({ ids: await visibleIds(page), loading: await page.getByLabel('Searching spells').count() }),
    (state) => !state.loading && state.ids[0] === id, { timeoutMs: 30_000 })
  assert.equal(result.ids[0], id)
}
async function choose(page: Page, testId: string, label: string): Promise<void> {
  await page.getByTestId(testId).click(); await page.getByRole('option', { name: label, exact: true }).click()
}

buildIfStale()
const staged = stageFixture('e2e-combat.log'), profile = makeUserData()
const sources = spellBundle(rows().map((r) => r.join('^')))
for (const file of SPELL_SOURCE_FILES) writeFileSync(join(staged.installDir, file), sources[file])
const launched = await launchOnFixture(staged, { userData: profile })
const page = await mainWindow(launched.app)
page.setDefaultTimeout(20_000)
try {
  await settle(() => page.evaluate(() => window.eq.spellLibrary.status()), (s) => s.phase === 'ready', { timeoutMs: 120_000 })
  const notice = page.getByTestId('telemetry-notice-off')
  if (await notice.isVisible()) await notice.click()
  await page.getByTestId('nav-spells').click()
  await page.getByTestId('spells-classes').click(); await page.getByTestId('spells-classes-all').click()
  await page.getByTestId('spells-level').fill('50')
  await page.getByTestId('spells-max-level').fill('')
  await page.getByTestId('spells-sort-id').click()
  await firstId(page, 7)
  const nameStyle = await page.getByTestId('spells-open-7').evaluate((button) => {
    const style = getComputedStyle(button)
    return { textAlign: style.textAlign, justifyContent: style.justifyContent, paddingLeft: style.paddingLeft }
  })
  assert.deepEqual(nameStyle, { textAlign: 'left', justifyContent: 'flex-start', paddingLeft: '0px' })
  const tableFits = await page.locator('table[aria-label="Spell catalog"]').evaluate((table) => {
    const container = table.parentElement
    return !!container && container.scrollWidth <= container.clientWidth + 2
  })
  assert.ok(tableFits, 'all Browse columns fit the default desktop width')
  await page.getByTestId('spells-search').evaluate((input) => input.scrollIntoView({ block: 'start' }))
  await dumpArtifacts(page, 'browse-controls-ready')
  assert.equal(await page.locator('table[aria-label="Spell catalog"] th [data-testid^="spells-sort-"]').count(), 11)
  await page.getByTestId('spells-sort-id').click(); await firstId(page, 904)
  assert.equal(await page.getByTestId('spells-sort-id').locator('..').getAttribute('aria-sort'), 'descending')
  const arrow = await page.getByTestId('spells-sort-id').evaluate((header) => {
    const icon = header.querySelector('svg')!.getBoundingClientRect()
    const label = header.children[1].getBoundingClientRect()
    return { above: icon.bottom <= label.top, centered: Math.abs((icon.left + icon.right) / 2 - (header.getBoundingClientRect().left + header.getBoundingClientRect().right) / 2) < 2 }
  })
  assert.deepEqual(arrow, { above: true, centered: true }, 'sort direction sits above its own column label')
  await page.getByTestId('spells-sort-id').click(); await firstId(page, 7)
  await page.getByTestId('spells-sort-mana').click(); await firstId(page, 7)
  await page.getByTestId('spells-sort-mana').click(); await firstId(page, 249)
  await page.getByRole('button', { name: 'Go to page 2', exact: true }).click()
  await firstId(page, 214)
  await page.getByTestId('spells-sort-name').click(); await firstId(page, 901)
  assert.equal(await page.getByRole('button', { name: 'page 1', exact: true }).getAttribute('aria-current'), 'page')

  await page.getByTestId('spells-min-level').fill('20'); await page.getByTestId('spells-max-level').fill('25')
  await expectIds(page, [224, 223, 222, 221, 220, 219, 900])
  await page.getByTestId('spells-min-level').fill('26')
  await page.getByText('Minimum spell level must not exceed maximum spell level.', { exact: true }).waitFor()
  await page.getByTestId('spells-reset-filters').click(); await firstId(page, 901)
  await page.getByTestId('spells-max-level').fill('')
  await page.getByTestId('spells-type-hot').click(); await expectIds(page, [7])
  await page.getByTestId('spells-type-dot').click(); await expectIds(page, [900])
  await page.getByTestId('spells-type-aoe').click(); await expectIds(page, [901])
  await page.getByTestId('spells-type-heal').click(); await expectIds(page, [902])
  await page.getByTestId('spells-type-other').click(); await expectIds(page, [903])
  await page.getByTestId('spells-type-all').click(); await firstId(page, 901)
  await choose(page, 'spells-mana', 'Zero mana'); await expectIds(page, [7])
  await choose(page, 'spells-polarity', 'Detrimental'); await expectIds(page, [])
  await page.getByText('No matching spells in this captured dataset.', { exact: true }).waitFor()
  await page.getByTestId('spells-reset-filters').click(); await firstId(page, 901)
  await choose(page, 'spells-category', 'Test category')
  await choose(page, 'spells-subcategory', 'Test subcategory')
  await page.getByTestId('spells-effect').fill('100'); await expectIds(page, [7])
  await page.getByTestId('spells-compare-7').click()
  await page.getByTestId('spells-reset-filters').click(); await firstId(page, 901)
  await page.getByTestId('spells-compare-901').click()
  await page.getByTestId('spells-sort-selected').click(); await page.getByTestId('spells-sort-selected').click()
  await firstId(page, 7)
  assert.deepEqual((await visibleIds(page)).slice(0, 2), [7, 901])
  await page.getByTestId('spells-open-7').click(); await page.getByTestId('spells-detail').waitFor()
  await page.getByTestId('spells-detail-back').click()
  await page.getByTestId('spells-tab-compare').click()
  await page.getByTestId('spells-calculation').first().waitFor()
  const selectedTable = page.getByTestId('spells-compare').locator('table').first()
  assert.equal(await selectedTable.locator('th [data-testid^="spells-sort-"]').count(), 8)
  await selectedTable.getByTestId('spells-sort-name').click()
  await settle(() => selectedTable.getByTestId('spells-calculation').first().innerText(), (text) => text.includes('Test Area'))
  assert.equal(await selectedTable.getByTestId('spells-open-7').evaluate((e) => getComputedStyle(e).textAlign), 'left')
  await page.getByTestId('spells-tab-browse').click()
  await firstId(page, 7)
  console.log('PASS spell Browse controls: wrapped-name alignment, all data headers, global sorting/pagination, level bounds and validation, type/category/subcategory/SPA/polarity/mana filters, reset, selection, detail/back and Compare sorting.')
} catch (error) { await dumpArtifacts(page, 'spell-browse-controls-failure'); throw error }
finally { await launched.close(); await staged.dispose(); await removeUserData(profile) }
