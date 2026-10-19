/** Three value modes through the real character, worker, preload and renderer paths. */
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
  await page.locator('[data-testid="nav-spells"]').click()
  await page.locator('[data-testid="spells-mode-client"]').waitFor()
  await page.getByTestId('spells-classes').click()
  await page.getByTestId('spells-classes-all').click()
  await page.locator('[data-testid="spells-open-101"]').waitFor()
}

async function mode(page: Page, value: 'client' | 'mine' | 'emulate'): Promise<void> {
  await page.locator(`[data-testid="spells-mode-${value}"]`).click()
  await context(page, (valueContext) => valueContext.preferences.mode === value)
  await settle(() => page.locator(`[data-testid="spells-mode-${value}"]`).getAttribute('aria-pressed'), (pressed) => pressed === 'true')
}

async function modifiers(page: Page): Promise<void> {
  const summary = page.locator('[data-testid="spells-modifiers-panel"] .MuiAccordionSummary-root').first()
  if (await summary.getAttribute('aria-expanded') !== 'true') await summary.click()
}

async function choose(page: Page, testId: string, option: string): Promise<void> {
  await page.locator(`[data-testid="${testId}"]`).click()
  await page.getByRole('option', { name: option, exact: true }).click()
  await settle(() => page.locator('[data-testid="spells-mode-emulate"]').isEnabled(), Boolean)
}

async function amountText(page: Page, id = 101): Promise<string> {
  return page.locator(`[data-testid="spells-amount-${id}-damage"]`).first().innerText()
}

async function engineEpoch(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const connection = await window.eq.engineConnect()
    if (!connection) throw new Error('Engine did not connect')
    return new Promise<number>((resolve, reject) => {
      let buffer = ''
      const timer = setTimeout(() => { connection.close(); reject(new Error('Engine health timed out')) }, 10_000)
      connection.onData((bytes) => {
        buffer += bytes
        for (;;) {
          const end = buffer.indexOf('\n')
          if (end < 0) break
          const message = JSON.parse(buffer.slice(0, end)) as { kind: string; id?: number; result?: { epoch: number } }
          buffer = buffer.slice(end + 1)
          if (message.kind === 'hello') connection.write(JSON.stringify({ id: 1, op: 'session.health', params: {} }) + '\n')
          if (message.id === 1 && message.result) { clearTimeout(timer); connection.close(); resolve(message.result.epoch) }
        }
      })
      connection.write(JSON.stringify({ op: 'hello', token: connection.token, protocolVersion: 1 }) + '\n')
    })
  })
}

function stageSources(staged: FixtureLog): void {
  const first = spellFields(101, 'Test Ember', 174)
  const second = spellFields(102, 'Test Tide', 174)
  second[173] = '1|79|-50|0|100|50'
  const focus = spellFields(110, 'Test Damage Focus', 174)
  focus[28] = '1'
  focus[173] = '1|124|10|20|100|0'
  // Real catalog shape: a castable player spell and a classless internal spell
  // share a display name. Only the player ID may inherit cast/merge evidence.
  const internal = spellFields(6864, 'Test Ember', 174)
  internal[47] = '255'
  const sources = spellBundle([first.join('^'), second.join('^'), focus.join('^'), internal.join('^')])
  for (const name of SPELL_SOURCE_FILES) writeFileSync(join(staged.installDir, name), sources[name])
}

async function detectedAndSimulated(page: Page): Promise<void> {
  await openSpells(page)
  await rankPreviewControls(page)
  assert.match(await amountText(page), /^40/)
  await mode(page, 'mine')
  await settle(() => amountText(page), (text) => text.includes('40 → 61'))
  await modifiers(page)
  assert.match(await page.locator('[data-testid="spells-detected-inputs"]').innerText(), /No inventory export/)
  await page.locator('[data-testid="spells-compare-101"]').click()
  await page.locator('[data-testid="spells-search"]').fill('Test Ember')
  await mode(page, 'emulate')
  assert.equal(await page.locator('[data-testid="spells-search"]').inputValue(), 'Test Ember', 'mode changes preserve the current search')
  await page.locator('[data-testid="spells-search"]').fill('')
  await choose(page, 'spells-global-rank', '0')
  await choose(page, 'spells-rank-101', 'V')
  await choose(page, 'spells-focus-mode', 'No damage/healing focus')
  await settle(() => amountText(page), (text) => text.includes('40 → 52'))
  assert.match(await amountText(page), /Simulated/)
  await page.locator('[data-testid="spells-open-101"]').click()
  await settle(() => page.locator('[data-testid="spells-hp-values"]').innerText(), (text) => text.includes('40 → 52'))
  await settle(() => page.getByTestId('spells-detail').getByTestId('spell-owned-rank').innerText(), (text) => text === 'Yours IX')
  assert.match(await page.locator('[data-testid="spells-hp-values"]').innerText(), /Mote rank V \(simulated\)/)
  await page.locator('[data-testid="spells-detail-back"]').click()
  await page.locator('[data-testid="spells-tab-compare"]').click()
  await settle(() => amountText(page), (text) => text.includes('40 → 52'))
  await page.getByTestId('spells-tab-browse').click()
  await page.getByTestId('spells-type-dd').click()
  await page.getByTestId('spells-group-ranked').click()
  await settle(() => page.getByTestId('spells-group-ranked').innerText(), (text) => /Ranked \(2\)/.test(text))
  // The smaller client amount wins after the exact-ID override across the entire eligible catalog.
  const rows = page.getByTestId('spells-record')
  await settle(() => rows.first().innerText(), (text) => /Test Ember/i.test(text))
  assert.match(await rows.nth(0).innerText(), /Test Ember/i)
  assert.match(await rows.nth(0).getByTestId('spell-owned-rank').innerText(), /Yours IX/)
  await page.locator('[data-testid="spells-tab-compare"]').click()
  await mode(page, 'mine')
  await settle(() => amountText(page), (text) => text.includes('40 → 61'))
  await mode(page, 'emulate')
  await settle(() => amountText(page), (text) => text.includes('40 → 52'))
}

async function rankPreviewControls(page: Page): Promise<void> {
  const known = page.getByTestId('spells-record').filter({ has: page.getByTestId('spells-open-101') })
  const unknown = page.getByTestId('spells-record').filter({ has: page.getByTestId('spells-open-102') })
  assert.equal(await settle(() => known.getByTestId('spell-owned-rank').innerText(), (text) => text === 'Yours IX'), 'Yours IX')
  assert.equal(await unknown.getByTestId('spell-owned-rank').count(), 0)
  assert.equal(await page.getByTestId('spells-global-rank').getByRole('combobox').isDisabled(), true, 'base mode has no simulated rank input')
  await mode(page, 'emulate')
  await choose(page, 'spells-global-rank', 'V')
  await context(page, (value) => value.preferences.mode === 'emulate' && value.preferences.emulation.rank === 5)
  assert.ok((await settle(() => amountText(page), (text) => text.includes('40 → 52'))).includes('40 → 52'))
  await choose(page, 'spell-preview-rank-101', 'III')
  await context(page, (value) => value.preferences.emulation.ranks['101']?.rank === 3)
  await choose(page, 'spells-global-rank', 'X')
  const exact = await context(page, (value) => value.preferences.emulation.rank === 10)
  assert.equal(exact.preferences.emulation.ranks['101'].rank, 3)
  assert.equal(await settle(() => known.getByTestId('spell-owned-rank').innerText(), (text) => text === 'Yours IX'), 'Yours IX')
  await choose(page, 'spell-preview-rank-101', '0')
  await context(page, (value) => value.preferences.emulation.ranks['101']?.rank === 0)
  assert.ok((await settle(() => amountText(page), (text) => text.includes('40 → 40'))).includes('40 → 40'))
  await choose(page, 'spell-preview-rank-101', 'I')
  await context(page, (value) => value.preferences.emulation.ranks['101']?.rank === 1)
  assert.ok((await settle(() => amountText(page), (text) => text.includes('40 → 42'))).includes('40 → 42'), 'explicit I adds the measured 6% damage step, independently of Base=0')
  assert.equal(await settle(() => known.getByTestId('spell-owned-rank').innerText(), (text) => text === 'Yours IX'), 'Yours IX')
  await page.getByTestId('spells-clear-rank-overrides').click()
  await context(page, (value) => Object.keys(value.preferences.emulation.ranks).length === 0)
  await choose(page, 'spells-global-rank', '0')
  await context(page, (value) => value.preferences.emulation.rank === 0)
  await dumpArtifacts(page, 'rank-controls-emulate')
  await choose(page, 'spells-global-rank', 'Auto')
  await context(page, (value) => value.preferences.emulation.rank === null)
  await mode(page, 'mine')
  assert.ok((await settle(() => amountText(page), (text) => text.includes('40 → 61'))).includes('40 → 61'))
  const panelSummary = page.locator('[data-testid="spells-modifiers-panel"] .MuiAccordionSummary-root').first()
  await panelSummary.click()
  await dumpArtifacts(page, 'rank-badges-preview')
  await panelSummary.click()
  await mode(page, 'client')
  await context(page, (value) => value.preferences.mode === 'client')
}

async function focusAndReset(page: Page): Promise<void> {
  await modifiers(page)
  await choose(page, 'spells-focus-mode', 'Choose simulated focus effects')
  await page.locator('[data-testid="spells-focus-110"]').click()
  await context(page, (value) => value.preferences.emulation.focusIds.includes(110))
  await settle(() => amountText(page), (text) => text.includes('40 → 59'))
  await page.locator('[data-testid="spells-calculation"]').first().locator('.MuiAccordionSummary-root').click()
  assert.match(await page.locator('[data-testid="spells-calculation"]').first().innerText(), /10% - 20%/)
  await page.locator('[data-testid="spells-modifiers-panel"] .MuiAccordionSummary-root').first().click()
  await dumpArtifacts(page, 'spell-modifiers-ready')
  const history = await page.evaluate(() => window.eq.spellLibrary.history())
  assert.equal(history.snapshots.length, 1, 'modifiers never create a source snapshot')
  await page.locator('[data-testid="spells-tab-history"]').click()
  await page.locator('[data-testid="spells-observation"]').first().waitFor()
  await page.locator('[data-testid="spells-tab-browse"]').click()
  await page.locator('[data-testid="spells-open-101"]').waitFor()
}

async function characterless(staged: FixtureLog): Promise<void> {
  unlinkSync(staged.logPath)
  const profile = makeUserData()
  writeFileSync(join(profile, 'everquest-companion-progress.json'), JSON.stringify({ eqInstallDir: staged.installDir }))
  const launch = await launchOnFixture(staged, { userData: profile, waitForEngine: false })
  try {
    const page = await mainWindow(launch.app)
    await openSpells(page)
    assert.equal(await page.locator('[data-testid="spells-mode-mine"]').isDisabled(), true)
    await mode(page, 'emulate')
    await modifiers(page)
    await choose(page, 'spells-global-rank', 'V')
    await choose(page, 'spells-focus-mode', 'No damage/healing focus')
    await settle(() => amountText(page), (text) => text.includes('40 → 52'))
    assert.match(await page.locator('[data-testid="spells-modifier-controls"]').innerText(), /lasts for this session/)
  } finally { await launch.close(); await removeUserData(profile) }
}

buildIfStale()
const staged = stageFixture('e2e-combat.log')
const userData = makeUserData()
stageSources(staged)
staged.append('You begin casting Test Ember IX.')
let launch = await launchOnFixture(staged, { userData })
let page = await mainWindow(launch.app)
page.setDefaultTimeout(20_000)
try {
  await context(page, (value) => Object.values(value.ranks ?? {}).some((rank) => rank.name === 'Test Ember' && rank.rank === 9))
  const epoch = await engineEpoch(page)
  await detectedAndSimulated(page)
  await mode(page, 'mine')
  staged.append('You begin casting Test Ember X.')
  await context(page, (value) => Object.values(value.ranks ?? {}).some((rank) => rank.name === 'Test Ember' && rank.rank === 10))
  await settle(() => amountText(page), (text) => text.includes('40 → 64'))
  await mode(page, 'emulate')
  await settle(() => amountText(page), (text) => text.includes('40 → 52'))
  await focusAndReset(page)
  assert.equal(await engineEpoch(page), epoch, 'modifier settings and live rank updates do not reattach the engine')
  await launch.close()
  launch = await launchOnFixture(staged, { userData })
  page = await mainWindow(launch.app)
  await openSpells(page)
  const restored = await context(page, (value) => value.preferences.mode === 'emulate')
  assert.equal(restored.preferences.emulation.ranks['101'].rank, 5)
  assert.deepEqual(restored.preferences.emulation.focusIds, [110])
  await settle(() => amountText(page), (text) => text.includes('40 → 59'))
  await modifiers(page)
  await page.locator('[data-testid="spells-emulation-reset"]').click()
  const reset = await context(page, (value) => value.preferences.emulation.rank === null && Object.keys(value.preferences.emulation.ranks).length === 0)
  assert.equal(reset.preferences.mode, 'emulate')
  assert.deepEqual(reset.preferences.emulation.focusIds, [])
  await mode(page, 'client')
  await settle(() => amountText(page), (text) => text.trim() === '40')
  await launch.close()
  await characterless(staged)
  console.log('Spell modifiers: detected, simulated, focus, detail, rankings, reset, persistence, history, and no-character checks passed.')
} catch (error) {
  await dumpArtifacts(page, 'spell-modifiers-failure')
  throw error
} finally {
  await launch.close()
  await removeUserData(userData)
  await staged.dispose()
}
