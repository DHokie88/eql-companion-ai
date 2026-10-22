/** Best-in-line grouping through the real query worker and renderer, using synthetic client records. */
/** Captured stat lines, existing replacement ladders and exact shared timers retain expandable alternatives. */
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from 'playwright-core'
import { SPELL_SOURCE_FILES } from '../../src/shared/spellLibrary'
import { spellBundle, spellFields } from '../fixtures/spell-library/synthetic'
import { buildIfStale, settle, dumpArtifacts } from './appHarness.mjs'
import { mainWindow, makeUserData, removeUserData } from './appWindow.mjs'
import { launchOnFixture, stageFixture } from './logFixture.mjs'

function ward(id: number, name: string, strength: number, level: number): string[] {
  const fields = spellFields(id, name)
  fields[14] = String(level); fields[47] = String(level); fields[28] = '1'
  fields[11] = '3'; fields[12] = '500'
  fields[81] = '0'
  fields[172] = `1|1|${strength}|0|100|0`
  return fields
}
async function expectRows(page: Page, expected: number[]): Promise<void> {
  const result = await settle(async () => ({
    ids: await page.getByTestId('spells-record').evaluateAll((elements) => elements.map((e) => Number(e.getAttribute('data-spell-id')))),
    loading: await page.getByLabel('Searching spells').count()
  }), ({ ids, loading }) => !loading && ids.join(',') === expected.join(','), { timeoutMs: 30_000 })
  assert.deepEqual(result.ids, expected)
  assert.equal(result.loading, 0)
}
async function columnChecks(page: Page): Promise<void> {
  await page.getByTestId('spells-target-count').click()
  assert.equal(await page.getByRole('option').count(), 8)
  assert.equal(await page.getByRole('option', { name: '8 targets', exact: true }).count(), 1)
  await page.keyboard.press('Escape')
  assert.equal(await page.getByTestId('spells-level').getAttribute('type'), 'text', 'level has no spinner control')
  assert.match(await page.getByTestId('spells-sort-efficiency').innerText(), /Damage\/\s*\nMana/)
  await page.getByTestId('spells-type-other').click()
  await expectRows(page, [906, 907, 908])
  assert.equal(await page.getByTestId('spells-sort-type').count(), 0, 'uniform Type is hidden across the filtered result')
  await page.getByTestId('spells-columns').click()
  const selected = await page.getByRole('option', { selected: true }).evaluateAll((options) => options.map((option) => option.getAttribute('data-testid')!))
  for (const testId of selected) await page.getByTestId(testId).click()
  await page.keyboard.press('Escape')
  await expectRows(page, [906, 907, 908])
  const headers = page.locator('table[aria-label="Spell catalog"] th [data-testid^="spells-sort-"]')
  assert.deepEqual(await headers.allTextContents(), ['Spell', 'Class/Level'], 'all optional columns can be hidden')
  await page.getByTestId('spells-columns').click()
  await page.getByTestId('spells-column-description').click()
  await page.keyboard.press('Escape')
  assert.equal(await page.getByTestId('spells-sort-description').count(), 1)
  assert.equal(await headers.count(), 3, 'Description is available alongside the two required columns')
  assert.ok((await page.getByTestId('spells-record').first().locator('td').last().innerText()).length > 5)
}

const rows = [
  ward(906, 'Ward Alpha', 10, 10),
  ward(907, 'Ward Beta', 30, 20),
  ward(908, 'Ward Gamma', 20, 30),
]
const bolt = spellFields(909, 'Test Bolt'); bolt[14] = '10'; bolt[47] = '10'; bolt[172] = '1|0|-50|0|100|0'
rows.push(bolt)
const column = spellFields(910, 'Column of Frost'), pillar = spellFields(911, 'Pillar of Fire'), timed = spellFields(912, 'Test Shared Cooldown')
for (const [index, fields] of [column, pillar, timed].entries()) {
  fields[14] = '10'; fields[47] = index === 0 ? '8' : '15'; fields[30] = '8'; fields[13] = '5'; fields[143] = '4'
  fields[172] = `1|0|-${[80, 150, 100][index]}|0|100|0`
}
pillar[97] = '12'; timed[97] = '12'
rows.push(column, pillar, timed)

buildIfStale()
const staged = stageFixture('e2e-combat.log'), profile = makeUserData()
const sources = spellBundle(rows.map((r) => r.join('^')))
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
  await expectRows(page, [906, 907, 908, 909, 910, 911, 912])

  // Stat strength and the replacement/timer family each select one best choice.
  await page.getByTestId('spells-best-in-line').click()
  await expectRows(page, [907, 909, 911])
  const count = await settle(() => page.getByTestId('spells-browse').getByText(/matching spells/).first().innerText(), (t) => t.includes('matching spells'))
  assert.match(count, /7 matching spells · 3 rows with Best in line/, 'uncollapsed count is reported next to the collapsed row count')

  // The carrot on the best row expands its alternatives, best to worst.
  await page.getByTestId('spells-expand-907').click()
  await expectRows(page, [907, 908, 906, 909, 911])
  const alternatives = await page.locator('[data-testid="spells-record"][data-alternative]').count()
  assert.equal(alternatives, 2, 'alternatives render under their best row')
  await page.getByTestId('spells-expand-907').click()
  await page.getByTestId('spells-expand-911').click()
  await expectRows(page, [907, 909, 911, 912, 910])
  assert.equal(await page.locator('[data-testid="spells-record"][data-alternative]').count(), 2, 'replaced and shared-timer spells are expandable together')

  // Best in line OFF: every match is visible again.
  await page.getByTestId('spells-best-in-line').click()
  await expectRows(page, [906, 907, 908, 909, 910, 911, 912])
  await dumpArtifacts(page, 'browse-lines-ready')
  await columnChecks(page)
  console.log('PASS spell Browse lines: grouping, strength order, counts, uniform Type, optional columns, Description and compact controls.')
} catch (error) { await dumpArtifacts(page, 'spell-browse-lines-failure'); throw error }
finally { await launched.close(); await staged.dispose(); await removeUserData(profile) }
