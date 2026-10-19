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
async function choose(page: Page, id: string, label: string): Promise<void> {
  await settle(() => page.getByTestId(id).getByRole('combobox').isEnabled(), Boolean)
  await page.getByTestId(id).click()
  await page.getByRole('option', { name: label, exact: true }).click()
}
async function rank(page: Page, value: number, label: string): Promise<void> {
  await choose(page, 'spells-global-rank', label)
  await context(page, (c) => c.preferences.emulation.rank === value && c.preferences.mode === (value === 0 ? 'client' : 'emulate'))
}
async function mine(page: Page, checked: boolean): Promise<void> {
  const toggle = page.getByTestId('spells-show-mine').getByRole('checkbox')
  if (await toggle.isChecked() !== checked) await toggle.click()
  await context(page, (c) => (c.preferences.mode === 'mine') === checked)
  await settle(() => toggle.isChecked(), (value) => value === checked)
}
async function amount(page: Page, expected: string): Promise<void> {
  await settle(() => page.getByTestId('spells-amount-101-damage').innerText(), (text) => text === expected)
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
  assert.equal(await settle(() => row.getByTestId('spell-owned-rank').innerText(), (t) => t === 'Yours IX'), 'Yours IX')
  assert.equal(await page.getByTestId('spells-global-rank').getByRole('combobox').isEnabled(), true)
  assert.equal(await page.getByTestId('spells-modifiers-panel').count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Emulate', exact: true }).count(), 0)
  const tops = await page.evaluate(() => ['spells-classes', 'spells-level-picker', 'spells-show-mine', 'spells-global-rank', 'spells-target-count'].map((id) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect().top))
  assert.ok(Math.max(...tops) - Math.min(...tops) < 16, `one control row: ${tops}`)
  await amount(page, '40')
  await mine(page, true); await amount(page, '61')
  await rank(page, 5, 'V'); await amount(page, '52')
  assert.equal(await page.getByTestId('spells-show-mine').getByRole('checkbox').isChecked(), false)
  await choose(page, 'spell-preview-rank-101', 'III')
  await context(page, (c) => c.preferences.emulation.ranks['101']?.rank === 3)
  await mine(page, true); await amount(page, '61')
  await mine(page, false); await amount(page, '47')
  await rank(page, 10, 'X'); await amount(page, '64')
  assert.deepEqual((await context(page, (c) => c.preferences.emulation.rank === 10)).preferences.emulation.ranks, {})
  await mine(page, true); await amount(page, '61')
  await mine(page, false); await amount(page, '64')
  assert.doesNotMatch(await row.innerText(), /Partial estimate|Partial scenario|Range |→/)
  await rank(page, 5, 'V'); await amount(page, '52')
  await page.getByTestId('spells-compare-101').click()
  await page.getByTestId('spells-open-101').click()
  await settle(() => page.getByTestId('spells-hp-values').innerText(), (t) => t.includes('40 → 52'))
  assert.match(await page.getByTestId('spells-hp-values').innerText(), /Mote rank V/)
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
    assert.equal(await page.getByTestId('spells-show-mine').getByRole('checkbox').isDisabled(), true)
    await rank(page, 5, 'V'); await amount(page, '52')
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
  await rank(page, 5, 'V'); await amount(page, '52')
  await dumpArtifacts(page, 'compact-spell-controls')
  await launch.close()
  launch = await launchOnFixture(staged, { userData: profile }); page = await mainWindow(launch.app)
  await openSpells(page)
  await context(page, (c) => c.preferences.mode === 'emulate' && c.preferences.emulation.rank === 5); await amount(page, '52')
  await rank(page, 0, '0'); await amount(page, '40')
  await launch.close(); await characterless(staged)
  console.log('Compact spell controls: row layout, group reset, Show mine, exact overrides, detail/Compare parity, live ranks, persistence, characterless preview and unchanged history passed.')
} catch (error) { await dumpArtifacts(page, 'compact-spell-controls-failure'); throw error }
finally { await launch.close(); await removeUserData(profile); await staged.dispose() }
