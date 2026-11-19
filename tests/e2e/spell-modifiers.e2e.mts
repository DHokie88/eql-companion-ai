/** Compact rank controls through real observations, workers, persistence and navigation. */
import assert from 'node:assert/strict'
import { unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from 'playwright-core'
import { SPELL_SOURCE_FILES } from '../../src/shared/spellLibrary'
import type { SpellModifierContext } from '../../src/shared/spellModifiers'
import { spellBundle, spellFields } from '../fixtures/spell-library/synthetic'
import { buildIfStale, settle, dumpArtifacts } from './appHarness.mjs'
import { mainWindow, makeUserData, removeUserData } from './appWindow.mjs'
import { launchOnFixture, stageFixture, type FixtureLog } from './logFixture.mjs'

async function context(page: Page, accepts: (value: SpellModifierContext) => boolean): Promise<SpellModifierContext> {
  return settle(() => page.evaluate(() => window.eq.spellLibrary.modifierContext()), accepts, { timeoutMs: 30_000 })
}
async function openSpells(page: Page): Promise<void> {
  const notice = page.getByTestId('telemetry-notice-off')
  if (await notice.isVisible()) await notice.click()
  await page.getByTestId('nav-spells').click()
  await page.getByTestId('spells-classes').click()
  await page.getByTestId('spells-classes-all').click()
  await page.getByTestId('spells-open-101').waitFor()
}
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
async function rank(page: Page, value: number): Promise<void> {
  const slider = page.getByTestId('spells-browse-toolbar').getByRole('slider', { name: 'Spell rank' })
  await slider.focus()
  if (value === 10) await page.keyboard.press('End')
  else {
    await page.keyboard.press('Home')
    for (let step = 1; step < value; step++) await page.keyboard.press('ArrowRight')
  }
  const seen = await context(page, (c) => c.preferences.browse?.rank === value && c.preferences.mode !== 'client')
  assert.equal(seen.preferences.browse?.rank, value)
  assert.notEqual(seen.preferences.mode, 'client')
  assert.equal(await settle(() => page.getByTestId('spells-browse-toolbar').getByTestId('spells-rank-label').innerText(), (text) => text === ROMAN[value]), ROMAN[value])
}
async function mine(page: Page, checked: boolean): Promise<void> {
  const toggle = page.getByTestId('spells-use-my-ranks').getByRole('checkbox')
  if (await toggle.isChecked() !== checked) await toggle.click()
  await context(page, (c) => c.preferences.browse?.useMyRanks === checked)
  await settle(() => toggle.isChecked(), (value) => value === checked)
}
async function rowRank(page: Page, id: number, label: string): Promise<void> {
  await page.getByTestId(`spell-preview-rank-${id}`).click()
  const option = page.getByRole('menuitem', { name: label, exact: true })
  if (id !== 101 || label !== 'III') {
    await option.click()
    return
  }
  await option.waitFor()
  await page.keyboard.press('Home')
  for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowDown')
  assert.equal(await option.evaluate((element) => element === document.activeElement), true)
  await dumpArtifacts(page, 'rank-override-menu')
  await page.keyboard.press('Enter')
}
async function amount(page: Page, expected: string): Promise<void> {
  assert.equal(await settle(() => page.getByTestId('spells-amount-101-damage').innerText(), (text) => text === expected), expected)
}
function stageSources(staged: FixtureLog): void {
  const first = spellFields(101, 'Test Ember', 174), second = spellFields(102, 'Test Tide', 174)
  second[173] = '1|79|-50|0|100|50'
  const focus = spellFields(110, 'Test Damage Focus', 174); focus[28] = '1'; focus[173] = '1|124|10|20|100|0'
  const internal = spellFields(6864, 'Test Ember', 174); internal[47] = '255'
  const sources = spellBundle([first, second, focus, internal].map((fields) => fields.join('^')))
  for (const name of SPELL_SOURCE_FILES) writeFileSync(join(staged.installDir, name), sources[name])
}
async function compactControls(page: Page): Promise<void> {
  const row = page.getByTestId('spells-record').filter({ has: page.getByTestId('spells-open-101') })
  assert.equal(await page.getByTestId('spell-owned-rank').count(), 0)
  await amount(page, '42')
  const toolbar = await page.getByTestId('spells-browse-toolbar').boundingBox()
  const filters = await page.getByTestId('spells-filter-panel').boundingBox()
  assert.ok(toolbar && filters && toolbar.y >= filters.y + filters.height - 4, 'rank toolbar sits below the main filters')
  assert.equal(await page.locator('[data-testid^="spells-highlight-"]').count(), 0)
  assert.equal(await page.getByTestId('spells-level-picker').count(), 0)
  assert.equal(await page.getByTestId('spells-show-mine').count(), 0)
  assert.equal(await page.getByTestId('spells-modifiers-panel').count(), 0)
  await page.getByTestId('spells-columns').click()
  await page.getByTestId('spells-column-spa').click()
  await page.keyboard.press('Escape')
  const spa = await page.getByTestId('spell-spa-101').innerText()
  assert.match(spa, /SPA 79/)
  assert.match(spa, /SPA 254/)
  await mine(page, true)
  assert.equal(await settle(() => row.getByTestId('spell-owned-rank').innerText(), (t) => t === 'Yours IX'), 'Yours IX')
  await amount(page, '61')
  await rank(page, 5)
  await amount(page, '61')
  assert.equal(await page.getByTestId('spells-use-my-ranks').getByRole('checkbox').isChecked(), true)
  await rowRank(page, 101, 'III')
  await context(page, (c) => c.preferences.emulation.ranks['101']?.rank === 3)
  await amount(page, '47')
  assert.match(await page.getByTestId('spell-preview-rank-101').innerText(), /III manual/)
  await rowRank(page, 102, 'IV')
  await context(page, (c) => c.preferences.emulation.ranks['102']?.rank === 4 && c.preferences.emulation.ranks['101']?.rank === 3)
  await page.getByTestId('spell-preview-rank-101').click()
  await page.getByTestId('spell-rank-auto-101').click()
  await context(page, (c) => c.preferences.emulation.ranks['101'] === undefined && c.preferences.emulation.ranks['102']?.rank === 4)
  await amount(page, '61')
  await rank(page, 10)
  await amount(page, '61')
  await mine(page, false)
  await amount(page, '64')
  assert.doesNotMatch(await row.innerText(), /Partial estimate|Partial scenario|Range |→/)
  await page.getByTestId('spells-search').fill('Ember')
  await page.getByTestId('spells-search').fill('')
  await context(page, (c) => c.preferences.browse?.rank === 10 && c.preferences.emulation.ranks['102']?.rank === 4)
  await rank(page, 5)
  await amount(page, '52')
  await page.getByTestId('spells-compare-101').click()
  await page.getByTestId('spells-open-101').click()
  const detail = page.getByTestId('spells-detail')
  await settle(() => detail.getByTestId('spells-hp-values').innerText(), (t) => t.includes('40 → 52'))
  assert.match(await detail.getByTestId('spells-hp-values').innerText(), /Mote rank V/)
  await page.getByTestId('spell-rank-progression').getByRole('button').click()
  assert.equal(await page.locator('[data-testid^="spell-rank-row-"]').count(), 11)
  assert.deepEqual(await page.getByTestId('spell-rank-row-9').getByRole('cell').allTextContents(), ['IX', '61', '0', '0', '-', '61', '33', '1.85', '2.05s'])
  await page.getByTestId('spells-detail-back').click()
  await page.getByTestId('spells-tab-compare').click()
  await amount(page, '52')
  await page.getByTestId('spells-tab-browse').click()
  assert.equal((await page.evaluate(() => window.eq.spellLibrary.history())).snapshots.length, 1)
}
async function characterless(staged: FixtureLog): Promise<void> {
  unlinkSync(staged.logPath)
  const profile = makeUserData()
  writeFileSync(join(profile, 'everquest-companion-progress.json'), JSON.stringify({ eqInstallDir: staged.installDir }))
  const launch = await launchOnFixture(staged, { userData: profile, waitForEngine: false })
  try {
    const page = await mainWindow(launch.app); await openSpells(page)
    assert.equal(await page.getByTestId('spells-use-my-ranks').getByRole('checkbox').isEnabled(), true)
    await rank(page, 5); await amount(page, '52')
    assert.equal((await context(page, (c) => c.preferences.browse?.rank === 5)).preferences.emulation.ranks['101'], undefined)
  } finally { await launch.close(); await removeUserData(profile) }
}
buildIfStale()
const staged = stageFixture('e2e-combat.log'), profile = makeUserData()
stageSources(staged); staged.append('You begin casting Test Ember IX.')
let launch = await launchOnFixture(staged, { userData: profile }), page = await mainWindow(launch.app)
try {
  await context(page, (c) => c.ranks?.['test ember']?.rank === 9)
  await openSpells(page); await compactControls(page)
  await mine(page, true); staged.append('You begin casting Test Ember X.')
  await context(page, (c) => c.ranks?.['test ember']?.rank === 10); await amount(page, '64')
  await rank(page, 5); await amount(page, '64')
  await context(page, (c) => c.preferences.emulation.ranks['102']?.rank === 4 && c.preferences.browse?.rank === 5)
  await dumpArtifacts(page, 'compact-spell-controls')
  await launch.close()
  launch = await launchOnFixture(staged, { userData: profile }); page = await mainWindow(launch.app)
  await openSpells(page)
  await context(page, (c) => c.preferences.browse?.useMyRanks === true && c.preferences.browse?.rank === 5 && c.preferences.emulation.ranks['102']?.rank === 4)
  await amount(page, '64')
  await launch.close(); await characterless(staged)
  console.log('Compact spell controls: row layout, group reset, Show mine, exact overrides, detail/Compare parity, live ranks, persistence, characterless preview and unchanged history passed.')
} catch (error) { await dumpArtifacts(page, 'compact-spell-controls-failure'); throw error }
finally { await launch.close(); await removeUserData(profile); await staged.dispose() }
