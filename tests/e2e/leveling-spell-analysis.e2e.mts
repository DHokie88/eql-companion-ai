/** Leveling is a compact reader of the same numeric-ID analysis queries as expanded Spells. */
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from 'playwright-core'
import { SPELL_SOURCE_FILES } from '../../src/shared/spellLibrary'
import type { SpellModifierContext, SpellValueMode } from '../../src/shared/spellModifiers'
import { spellBundle, spellFields } from '../fixtures/spell-library/synthetic'
import { buildIfStale, dumpArtifacts, settle, waitHydrated } from './appHarness.mjs'
import { mainWindow } from './appWindow.mjs'
import { launchOnFixture, stageFixture, type FixtureLog } from './logFixture.mjs'
import { playWho } from './gameplay.mjs'

function row(id: number, name: string, level: number, options: { damage: number; target?: number }): string {
  const { damage, target = 5 } = options
  const fields = spellFields(id, name)
  fields[38] = String(level) // PAL, a resolved class in the leveling fixture.
  fields[47] = '255'
  fields[14] = '10'
  fields[30] = String(target)
  fields[143] = '6'
  fields[172] = `1|79|-${damage}|0|100|${damage}`
  return fields.join('^')
}

function stageSources(staged: FixtureLog): void {
  const rows = Array.from({ length: 12 }, (_, index) => row(101 + index, `Test Ranked ${index + 1}`, 12, { damage: 40 + index }))
  rows.push(row(201, 'Test New Fifty', 50, { damage: 80 }), row(202, 'Test New Sibling', 50, { damage: 70 }))
  rows.push(row(301, 'Test Area', 30, { damage: 25, target: 8 }), row(401, 'Test Upcoming', 51, { damage: 100 }))
  const sources = spellBundle(rows)
  for (const name of SPELL_SOURCE_FILES) writeFileSync(join(staged.installDir, name), sources[name])
}

async function context(page: Page, mode: SpellValueMode): Promise<SpellModifierContext> {
  return settle(() => page.evaluate(() => window.eq.spellLibrary.modifierContext()), (value) => value.preferences.mode === mode)
}

async function expected(page: Page, category: 'dd' | 'aoe' = 'dd') {
  return page.evaluate(async (categoryTab) => {
    const state = await window.eq.spellLibrary.modifierContext()
    const classes = ['PAL', 'MNK', 'ENC'] as const
    return window.eq.spellLibrary.rankings({ level: 50, classes: [...classes], categoryTab,
      analysis: { scope: categoryTab === 'aoe' ? 'pack' : 'single', targets: state.preferences.targets ?? 4 },
      evaluation: { mode: state.preferences.mode, contextRevision: state.revision, classes: [...classes] },
      sortBy: 'efficiency', direction: 'desc', group: 'ranked', page: 1, pageSize: 40 })
  }, category)
}

async function compactParity(page: Page): Promise<void> {
  await page.locator('[data-testid="nav-leveling"]').click()
  await page.locator('[data-testid="best-spells-row"]').first().waitFor()
  const ranked = await expected(page)
  assert.ok(ranked.records.length > 10)
  await settle(() => page.locator('[data-testid="best-spells-name"]').first().getAttribute('data-id'), (id) => id === String(ranked.records[0].id))
  assert.equal(await page.locator('[data-testid="best-spells-row"]').count(), 10)
  assert.equal(await page.locator('[data-testid="best-spells-section"]').getAttribute('data-sort'), 'efficiency')
  await page.locator('[data-testid="best-spells-more"]').click()
  assert.equal(await page.locator('[data-testid="best-spells-row"]').count(), ranked.records.length)
  await page.locator('[data-testid="best-spells-search"]').fill('101')
  await settle(() => page.locator('[data-testid="best-spells-row"]').count(), (count) => count === 1)
  assert.equal(await page.locator('[data-testid="best-spells-row"]').first().getAttribute('data-id'), '101')
  await page.locator('[data-testid="best-spells-search"]').fill('')
  await settle(() => page.locator('[data-testid="best-spells-row"]').count(), (count) => count === 10)
}

async function sharedModesAndTargets(page: Page): Promise<void> {
  const next = await page.evaluate(async () => {
    const state = await window.eq.spellLibrary.modifierContext()
    return window.eq.spellLibrary.updateModifiers({ expectedRevision: state.revision, preferences: {
      ...state.preferences, mode: 'emulate', emulation: { ...state.preferences.emulation, rank: 5, focus: 'none' }
    } })
  })
  await settle(() => page.locator('[data-testid="best-spells"]').getAttribute('data-context'), (revision) => revision === next.revision)
  await settle(() => page.locator('[data-testid="best-spells-mode-emulate"]').getAttribute('aria-pressed'), (pressed) => pressed === 'true')
  const ranked = await expected(page)
  const first = ranked.records[0]
  await settle(() => page.locator(`[data-testid="spells-amount-${first.id}-damage"]`).innerText(), (text) => text.includes(String(first.calculation.total)) && text.includes('Simulated'))
  await page.locator('[data-testid="best-spells-mode-client"]').click()
  await context(page, 'client')
  await page.locator('[data-testid="best-spells-tab"][data-tab="aoe"]').click()
  const area = await expected(page, 'aoe')
  await settle(() => page.locator('[data-testid="best-spells-row"]').count(), (count) => count === 1)
  assert.match(await page.locator('[data-testid="spells-amount-301-damage"]').innerText(), new RegExp(String(area.records[0].calculation.total)))
  await page.locator('[data-testid="best-spells-targets"]').click()
  await page.getByRole('option', { name: '2 targets', exact: true }).click()
  const changed = await settle(() => page.evaluate(() => window.eq.spellLibrary.modifierContext()), (value) => value.preferences.targets === 2)
  await settle(() => page.locator('[data-testid="best-spells"]').getAttribute('data-context'), (revision) => revision === changed.revision)
  await settle(() => page.locator('[data-testid="spells-amount-301-damage"]').innerText(), (text) => text.trim() === '50')
}

async function unlocksAndRouting(page: Page): Promise<void> {
  const panel = page.locator('[data-testid="new-at-level-client-spells"]')
  await settle(() => panel.locator('[data-testid="new-at-level-client-spell"]').count(), (count) => count === 2)
  assert.match(await panel.innerText(), /Client eligibility, not confirmed ownership/)
  assert.match(await page.locator('[data-testid="new-at-level"]').innerText(), /Skills, disciplines & innates/)
  await panel.locator('[data-testid="new-at-level-spell-search"]').fill('202')
  await settle(() => panel.locator('[data-testid="new-at-level-client-spell"]').count(), (count) => count === 1)
  assert.equal(await panel.locator('[data-testid="new-at-level-client-spell"]').getAttribute('data-id'), '202')
  await panel.getByRole('button', { name: 'Add to Compare', exact: true }).click()
  await page.locator('[data-testid="spells-tab-compare"][aria-selected="true"]').waitFor()
  assert.match(await page.locator('[data-testid="spells-tab-compare"]').innerText(), /1\/4/)
  await page.locator('[data-testid="nav-leveling"]').click()
  await page.locator('[data-testid="new-at-level-spell-name"]').first().click()
  await page.locator('[data-testid="spells-detail-back"]').waitFor()
  assert.match(await page.locator('[data-testid="spells-hp-values"]').innerText(), /80|70/)
  await page.locator('[data-testid="spells-detail-back"]').click()
  await page.locator('[data-testid="leveling-view"]').waitFor()
}

buildIfStale()
const staged = stageFixture('e2e-leveling.log')
stageSources(staged)
const launch = await launchOnFixture(staged)
const page = await mainWindow(launch.app)
page.setDefaultTimeout(20_000)
try {
  await waitHydrated(page)
  playWho(staged)
  await settle(() => page.evaluate(() => window.eq.spellLibrary.status()), (value) => value.dataset?.recordCount === 16, { timeoutMs: 30_000 })
  await compactParity(page)
  await sharedModesAndTargets(page)
  await unlocksAndRouting(page)
  const scrollbars = await page.locator('[data-testid="best-spells"], [data-testid="new-at-level"]').evaluateAll((elements) => elements.filter((element) => {
    const style = getComputedStyle(element)
    return ['auto', 'scroll'].includes(style.overflowY) && element.scrollHeight > element.clientHeight
  }).length)
  assert.equal(scrollbars, 0, 'Leveling spell panels use the page scroller')
  console.log('Leveling spell analysis: worker parity, default efficiency, disclosure/search, shared modes/targets, numeric eligibility, routing and page scroll passed.')
} catch (error) {
  await dumpArtifacts(page, 'leveling-spell-analysis-failure')
  throw error
} finally {
  await launch.close()
  await staged.dispose()
}
