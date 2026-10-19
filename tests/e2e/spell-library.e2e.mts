/** Synthetic, three-file import through the real workers, preload, renderer and Rust engine. */
import assert from 'node:assert/strict'
import { writeFileSync, statSync, utimesSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from 'playwright-core'
import { SPELL_SOURCE_FILES, type SpellLibraryStatus, type SpellSourceFile } from '../../src/shared/spellLibrary'
import { spellBundle, spellFields } from '../fixtures/spell-library/synthetic'
import { buildIfStale, settle, dumpArtifacts } from './appHarness.mjs'
import { mainWindow, makeUserData, removeUserData } from './appWindow.mjs'
import { launchOnFixture, stageFixture, type FixtureLog } from './logFixture.mjs'

async function ready(page: Page, priorCheck?: string | null): Promise<SpellLibraryStatus> {
  const status = await settle(() => page.evaluate(() => window.eq.spellLibrary.status()),
    (s) => (priorCheck === undefined || s.checkedAt !== priorCheck) && (s.phase === 'ready' || s.phase === 'error'), { timeoutMs: 120_000 })
  assert.equal(status.phase, 'ready', JSON.stringify(status))
  return status
}

async function checkForUpdates(page: Page): Promise<SpellLibraryStatus> {
  const prior = await page.evaluate(() => window.eq.spellLibrary.status())
  if (await page.locator('[data-testid="library-spell-dialog"]').isVisible()) await page.evaluate(() => window.eq.spellLibrary.check())
  else await page.locator('[data-testid="spells-check"]').click()
  return ready(page, prior.checkedAt)
}

async function classAction(page: Page, action: 'all' | 'none' | 'mine'): Promise<void> {
  await page.getByTestId('spells-classes').click()
  await page.getByTestId(`spells-classes-${action}`).click()
}
async function recordCount(page: Page, expected: number): Promise<void> {
  await settle(() => page.getByTestId('spells-record').count(), (count) => count === expected)
  assert.equal(await page.getByTestId('spells-record').count(), expected)
}
async function classAndLevelControls(page: Page): Promise<void> {
  await settle(() => page.getByTestId('spells-level').inputValue(), (value) => value === '50')
  assert.equal(await page.getByTestId('spells-max-level').inputValue(), '50')
  await classAction(page, 'all')
  await recordCount(page, 2)
  await page.getByTestId('spells-max-level').fill('')
  await recordCount(page, 3)
  await classAction(page, 'none')
  await page.getByText('Choose one or more classes, or select All classes to browse spells.', { exact: true }).waitFor()
  assert.equal(await page.getByTestId('spells-record').count(), 0)
  await page.getByTestId('spells-classes').click()
  await page.getByRole('option', { name: 'WIZ', exact: true }).click()
  await page.keyboard.press('Escape')
  await recordCount(page, 2)
  await classAction(page, 'mine')
  await settle(() => page.getByTestId('spells-classes').innerText(), (value) => value.includes('WIZ') && value.includes('PAL') && value.includes('BRD'))
  await recordCount(page, 2)
  await classAction(page, 'all')
  await recordCount(page, 3)
  await page.getByTestId('spells-level-previous').click()
  await settle(() => page.getByTestId('spells-level').inputValue(), (value) => value === '49')
  await page.getByTestId('spells-level-next').click()
  await settle(() => page.getByTestId('spells-level').inputValue(), (value) => value === '50')
  await page.getByTestId('spells-level-previous').click()
  await settle(() => page.getByTestId('spells-level').inputValue(), (value) => value === '49')
}
async function unifiedRankings(page: Page): Promise<void> {
  await page.getByTestId('spells-group-ranked').click()
  await recordCount(page, 2)
  assert.match(await page.getByTestId('spells-group-ranked').innerText(), /Ranked \(2\)/i)
  await page.getByTestId('spells-highlight-efficiency').waitFor()
  assert.match(await page.getByTestId('spells-highlight-efficiency').innerText(), /Test Beacon II/)
  const metric = page.getByTestId('spells-browse').getByTestId('spells-metric')
  await metric.getByRole('button', { name: 'Healing', exact: true }).click()
  await recordCount(page, 1)
  assert.match(await page.getByTestId('spells-highlight-efficiency').innerText(), /Test Remedy/)
  await metric.getByRole('button', { name: 'Damage', exact: true }).click()
  await recordCount(page, 2)
  await page.getByTestId('spells-group-all').click()
  await recordCount(page, 3)
}

async function checkCharacterlessNavigation(log: FixtureLog, sources: Record<SpellSourceFile, string>): Promise<void> {
  const profile = makeUserData()
  unlinkSync(log.logPath)
  // A log-free installation is selected through the existing manual setting, not log discovery.
  writeFileSync(join(profile, 'everquest-companion-progress.json'), JSON.stringify({ eqInstallDir: log.installDir }))
  for (const name of SPELL_SOURCE_FILES) writeFileSync(join(log.installDir, name), sources[name])
  const launch = await launchOnFixture(log, { userData: profile, waitForEngine: false })
  try {
    const page = await mainWindow(launch.app)
    await ready(page)
    await page.locator('[data-testid="nav-spells"]').click()
    await classAction(page, 'all')
    await page.getByTestId('spells-max-level').fill('')
    await page.locator('[data-testid="spells-open-101"]').click()
    await page.getByRole('button', { name: 'Supplementary wiki / lineage' }).click()
    await page.locator('[data-testid="spell-page-back"]').waitFor()
    assert.equal(await page.locator('[data-testid="spell-page-title"]').innerText(), 'Test Beacon I')
    await page.locator('[data-testid="spell-page-back"]').click()
    await page.locator('[data-testid="spells-detail"]').waitFor()
  } finally { await launch.close(); await removeUserData(profile) }
}

/** Reads epoch through the existing broker. The per-launch token never leaves the page. */
async function engineEpoch(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const connection = await window.eq.engineConnect()
    if (!connection) throw new Error('Engine did not connect')
    return new Promise<number>((resolve, reject) => {
      let buffered = ''
      const timer = setTimeout(() => { connection.close(); reject(new Error('Health request timed out')) }, 10_000)
      connection.onData((bytes) => {
        buffered += bytes
        for (;;) {
          const end = buffered.indexOf('\n')
          if (end < 0) break
          const message = JSON.parse(buffered.slice(0, end)) as { kind: string; id?: number; result?: { epoch: number } }
          buffered = buffered.slice(end + 1)
          if (message.kind === 'hello') connection.write(JSON.stringify({ id: 1, op: 'session.health', params: {} }) + '\n')
          if (message.id === 1 && message.result) { clearTimeout(timer); connection.close(); resolve(message.result.epoch) }
        }
      })
      connection.write(JSON.stringify({ op: 'hello', token: connection.token, protocolVersion: 1 }) + '\n')
    })
  })
}

buildIfStale()
const staged = stageFixture('e2e-combat.log')
staged.append('[50 BRD/PAL/WIZ] Primitive (Human) ZONE: East Freeport (freporte)')
const userData = makeUserData()
const first = spellFields(101, 'Test Beacon I', 174), second = spellFields(102, 'Test Beacon II', 174)
const heal = spellFields(103, 'Test Remedy', 174)
heal[28] = '1'; heal[173] = '1|79|80|0|100|80'
heal[47] = '255' // Internal record: All spells must retain this even after a class filter.
second[173] = '1|79|-80|0|100|80'
const sources = spellBundle([first.join('^'), second.join('^'), heal.join('^')])
for (const file of SPELL_SOURCE_FILES) writeFileSync(join(staged.installDir, file), sources[file])
let launched = await launchOnFixture(staged, { userData })
let page = await mainWindow(launched.app)
page.setDefaultTimeout(20_000)
try {
  const baseline = await ready(page)
  assert.equal(baseline.dataset?.recordCount, 3)
  const epoch = await engineEpoch(page)
  const notice = page.getByTestId('telemetry-notice-off')
  if (await notice.isVisible()) await notice.click()
  await page.locator('[data-testid="nav-spells"]').click()
  await classAndLevelControls(page)
  await page.locator('[data-testid="spells-search"]').fill('102')
  await page.locator('[data-testid="spells-open-102"]').waitFor()
  await settle(() => page.locator('[data-testid="spells-record"]').count(), (count) => count === 1)
  assert.equal(await page.locator('[data-testid="spells-record"]').count(), 1)
  await page.locator('[data-testid="spells-search"]').fill('')
  await page.locator('[data-testid="spells-compare-101"]').click()
  await page.locator('[data-testid="spells-compare-102"]').click()
  await page.locator('[data-testid="spells-tab-compare"]').click()
  await settle(() => page.locator('[data-testid="spells-calculation"]').count(), (count) => count === 2)
  assert.ok(await page.locator('[data-testid="spells-calculation"]').count() >= 2)
  await page.locator('[data-testid="spells-tab-browse"]').click()
  await unifiedRankings(page)
  await page.locator('[data-testid="spells-open-101"]').click()
  await page.locator('[data-testid="spells-detail"]').waitFor()
  await settle(() => page.locator('[data-testid="spells-detail"]').innerText(), (text) => text.includes('Test Beacon I'))
  assert.match(await page.locator('[data-testid="spells-detail"]').innerText(), /Test Beacon I/)

  // Same-length, same-mtime string changes must refresh an already-mounted exact-ID record.
  const stringsPath = join(staged.installDir, 'dbstr_us.txt'), stamp = statSync(stringsPath)
  writeFileSync(stringsPath, sources['dbstr_us.txt'].replace('Deal #1 points', 'Send #1 points'))
  utimesSync(stringsPath, stamp.atime, stamp.mtime)
  const changed = await checkForUpdates(page)
  assert.notEqual(changed.dataset?.contentId, baseline.dataset?.contentId)
  await settle(() => page.locator('[data-testid="spells-detail"]').innerText(), (text) => text.includes('Send 40 points'))
  assert.match(await page.locator('[data-testid="spells-detail"]').innerText(), /Send 40 points/)
  assert.equal(await engineEpoch(page), epoch, 'reference activation must not reattach/reset the engine')
  await page.locator('[data-testid="spells-detail-back"]').click()
  await page.locator('[data-testid="spells-tab-history"]').click()
  await page.locator('[data-testid="spells-observation"]').first().waitFor()
  await page.getByRole('button', { name: '101 · Test Beacon I', exact: true }).click()
  await page.locator('[data-testid="spells-field-changes"]').waitFor()
  await settle(() => page.locator('[data-testid="spells-field-changes"]').innerText(), (text) => text.includes('description'))
  assert.match(await page.locator('[data-testid="spells-field-changes"]').innerText(), /description/)
  await page.locator('[data-testid="spells-timeline-id"]').fill('101')
  await page.locator('[data-testid="spells-timeline"]').waitFor()

  writeFileSync(stringsPath, sources['dbstr_us.txt'])
  const rollback = await checkForUpdates(page)
  assert.equal(rollback.dataset?.snapshotId, baseline.dataset?.snapshotId)
  const history = await page.evaluate(() => window.eq.spellLibrary.history())
  assert.equal(history.observations[0].outcome, 'rollback')
  await checkForUpdates(page)
  const unchanged = await page.evaluate(() => window.eq.spellLibrary.history())
  assert.equal(unchanged.snapshots.length, 2)
  assert.equal(unchanged.observations[0].outcome, 'unchanged')

  const pagedRows = Array.from({ length: 41 }, (_value, index) => spellFields(200 + index, `Test Page ${index}`, 174).join('^'))
  writeFileSync(join(staged.installDir, 'spells_us.txt'), sources['spells_us.txt'] + pagedRows.join('\n') + '\n')
  const expanded = await checkForUpdates(page)
  assert.equal(expanded.dataset?.recordCount, 44)
  await page.locator('[data-testid="spells-tab-browse"]').click()
  await page.locator('[data-testid="spells-pagination"]').waitFor()
  await page.getByRole('button', { name: 'Go to page 2', exact: true }).click()
  await settle(() => page.locator('[data-testid="spells-record"]').count(), (count) => count === 4)
  assert.equal(await page.locator('[data-testid="spells-record"]').count(), 4)
  await page.locator('[data-testid="spells-search"]').fill('240')
  await page.locator('[data-testid="spells-open-240"]').waitFor()
  await settle(() => page.locator('[data-testid="spells-record"]').count(), (count) => count === 1)
  assert.equal(await page.locator('[data-testid="spells-record"]').count(), 1)
  await page.locator('[data-testid="spells-search"]').fill('')
  await page.locator('[data-testid="spells-effect"]').fill('999')
  await settle(() => page.locator('[data-testid="spells-record"]').count(), (count) => count === 0)
  assert.equal(await page.locator('[data-testid="spells-record"]').count(), 0)
  await page.locator('[data-testid="spells-effect"]').fill('79')
  await page.locator('[data-testid="spells-open-101"]').waitFor()
  await dumpArtifacts(page, 'browse')

  writeFileSync(join(staged.installDir, 'spells_us.txt'), 'broken^partial\n')
  await page.locator('[data-testid="spells-check"]').click()
  const failed = await settle(() => page.evaluate(() => window.eq.spellLibrary.status()), (s) => s.phase === 'error')
  assert.equal(failed.phase, 'error')
  assert.equal(failed.dataset?.snapshotId, expanded.dataset?.snapshotId)
  assert.equal((await page.evaluate(() => window.eq.spellLibrary.detail({ id: 101 }))).record?.name, 'Test Beacon I')
  assert.equal(await engineEpoch(page), epoch)
  await launched.close()
  launched = await launchOnFixture(staged, { userData })
  page = await mainWindow(launched.app)
  const restored = await settle(() => page.evaluate(() => window.eq.spellLibrary.status()), (s) => s.phase === 'error', { timeoutMs: 60_000 })
  assert.equal(restored.dataset?.snapshotId, expanded.dataset?.snapshotId, 'relaunch restores the last valid catalog even with broken source files')
  assert.equal((await page.evaluate(() => window.eq.spellLibrary.detail({ id: 101 }))).record?.name, 'Test Beacon I')
  await page.getByTestId('nav-spells').click()
  await page.getByTestId('spells-tab-browse').click()
  await settle(() => page.getByTestId('spells-level').inputValue(), (value) => value === '49')
  assert.match(await page.getByTestId('spells-classes').innerText(), /All/)
  assert.equal(await page.getByTestId('spells-max-level').inputValue(), '')
  assert.equal(await page.getByTestId('spells-effect').inputValue(), '79')
  assert.equal(await page.getByTestId('spells-group-all').getAttribute('aria-selected'), 'true')
  await launched.close()
  await checkCharacterlessNavigation(staged, sources)
  console.log('PASS spell library: navigation, numeric IDs, search/filter/pagination, comparisons, rankings, string refresh, mounted details, history/diffs, rollback, deduplication, failed import, restart recovery and live engine epoch.')
} catch (error) {
  await dumpArtifacts(page, 'spell-library-failure')
  throw error
} finally { await launched.close(); await staged.dispose(); await removeUserData(userData) }
