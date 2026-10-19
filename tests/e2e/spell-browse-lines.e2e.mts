/** Best-in-line grouping through the real query worker and renderer, using synthetic client records. */
/** Three buffs share one captured EQEmu line (same line, target, stat-effect slot); the bolt is not a line candidate. */
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
  fields[172] = `1|1|${strength}|0|100|0`
  return fields
}

const rows = [
  ...ward(906, 'Ward Alpha', 10, 10),
  ...ward(907, 'Ward Beta', 30, 20),
  ...ward(908, 'Ward Gamma', 20, 30),
]
const bolt = spellFields(909, 'Test Bolt'); bolt[14] = '10'; bolt[47] = '10'; bolt[172] = '1|0|-50|0|100|0'
rows.push(bolt)

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
  await page.getByTestId('spells-sort-name').click()
  const rowIds = () => page.getByTestId('spells-record').evaluateAll((elements) => elements.map((e) => Number(e.getAttribute('data-spell-id'))))
  await settle(async () => ({ ids: await rowIds(), loading: await page.getByLabel('Searching spells').count() }),
    ({ ids, loading }) => !loading && ids.join(',') === '906,907,908,909', { timeoutMs: 30_000 })

  // Best in line ON: one line (906/907/908) collapses to its strongest member; the non-candidate bolt is untouched.
  await page.getByTestId('spells-best-in-line').click()
  await settle(async () => ({ ids: await rowIds(), loading: await page.getByLabel('Searching spells').count() }),
    ({ ids, loading }) => !loading && ids.join(',') === '907,909', { timeoutMs: 30_000 })
  const count = await settle(() => page.getByTestId('spells-browse').getByText(/matching spells/).first().innerText(), (t) => t.includes('matching spells'))
  assert.match(count, /4 matching spells · 2 rows with Best in line/, 'uncollapsed count is reported next to the collapsed row count')

  // The carrot on the best row expands its alternatives, best to worst.
  await page.getByTestId('spells-expand-907').click()
  await settle(async () => ({ ids: await rowIds(), loading: await page.getByLabel('Searching spells').count() }),
    ({ ids, loading }) => !loading && ids.join(',') === '907,908,906,909', { timeoutMs: 30_000 })
  const alternatives = await page.locator('[data-testid="spells-record"][data-alternative]').count()
  assert.equal(alternatives, 2, 'alternatives render under their best row')

  // Best in line OFF: every match is visible again.
  await page.getByTestId('spells-best-in-line').click()
  await settle(async () => ({ ids: await rowIds(), loading: await page.getByLabel('Searching spells').count() }),
    ({ ids, loading }) => !loading && ids.join(',') === '906,907,908,909', { timeoutMs: 30_000 })
  dumpArtifacts(page, 'browse-lines-ready')
  console.log('PASS spell Browse lines: best-in-line collapses a shared EQEmu line, expands alternatives best to worst, and reports the uncollapsed count.')
} catch (error) { await dumpArtifacts(page, 'spell-browse-lines-failure'); throw error }
finally { await launched.close(); await staged.dispose(); await removeUserData(profile) }
