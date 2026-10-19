/** Synthetic songs and source definitions; inventory evidence uses existing item-catalog names. */
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from 'playwright-core'
import { SPELL_SOURCE_FILES } from '../../src/shared/spellLibrary'
import { spellBundle, spellFields } from '../fixtures/spell-library/synthetic'
import { buildIfStale, dumpArtifacts, settle, waitHydrated } from './appHarness.mjs'
import { mainWindow } from './appWindow.mjs'
import { launchOnFixture, stageFixture, type FixtureLog } from './logFixture.mjs'

function stageSources(staged: FixtureLog): void {
  const song = spellFields(101, 'Test String Recovery')
  song[47] = '255'; song[43] = '1'; song[32] = '49'; song[28] = '1'; song[11] = '5'; song[12] = '2'; song[172] = '1|0|4|0|100|0'
  const slow = spellFields(738, 'Test Singing Binding')
  slow[47] = '255'; slow[43] = '1'; slow[32] = '41'; slow[11] = '5'; slow[12] = '2'; slow[172] = '1|3|-20|0|100|0$2|11|80|0|100|0'
  const haste = spellFields(8461, 'Test Supplemental Tempo', 174)
  haste[47] = '255'; haste[43] = '1'; haste[32] = '41'; haste[173] = '1|98|105|0|100|105'
  const focuses = [11, 14].map((rank) => {
    const fields = spellFields(1000 + rank, `String Resonance ${rank}`)
    fields[47] = '255'; fields[172] = `1|413|${rank * 10}|0|100|0$2|411|256|0|100|0$3|414|49|0|100|0`
    return fields.join('^')
  })
  const sources = spellBundle([song.join('^'), slow.join('^'), haste.join('^'), ...focuses])
  sources['dbstr_us.txt'] = sources['dbstr_us.txt'].replace(/^900\^6\^.*$/m, '900^6^Binds up to %T nearby enemies.^0^')
  for (const name of SPELL_SOURCE_FILES) writeFileSync(join(staged.installDir, name), sources[name])
}
function inventory(staged: FixtureLog, state: 'carried' | 'equipped' | 'removed'): void {
  const lute = state === 'equipped' ? 'Kelin`s Seven Stringed Lute' : 'Mystical Lute'
  const carried = state === 'carried' ? 'Kelin`s Seven Stringed Lute' : 'Mystical Lute'
  const rows = [`Secondary\t${lute}\t1\t1\t10`, ...(state === 'removed' ? [] : [`General 1\t${carried}\t2\t1\t10`]), 'Bank1\tKelin`s Seven Stringed Lute\t3\t1\t10']
  writeFileSync(join(staged.installDir, 'Primitive_freeport-Inventory.txt'), 'Location\tName\tID\tCount\tSlots\n' + rows.join('\n') + '\n')
}
async function epoch(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const connection = await window.eq.engineConnect()
    if (!connection) throw new Error('No engine connection')
    return new Promise<number>((resolve, reject) => {
      let buffer = ''
      const timer = setTimeout(() => { connection.close(); reject(new Error('Health request timed out')) }, 10_000)
      connection.onData((bytes) => {
        buffer += bytes
        for (;;) {
          const end = buffer.indexOf('\n'); if (end < 0) break
          const message = JSON.parse(buffer.slice(0, end)) as { kind: string; id?: number; result?: { epoch: number } }; buffer = buffer.slice(end + 1)
          if (message.kind === 'hello') connection.write(JSON.stringify({ id: 1, op: 'session.health', params: {} }) + '\n')
          if (message.id === 1 && message.result) { clearTimeout(timer); connection.close(); resolve(message.result.epoch) }
        }
      })
      connection.write(JSON.stringify({ op: 'hello', token: connection.token, protocolVersion: 1 }) + '\n')
    })
  })
}
async function mine(page: Page): Promise<void> {
  await page.getByTestId('nav-spells').click()
  await page.getByTestId('spells-classes').click()
  await page.getByTestId('spells-classes-all').click()
  await page.getByTestId('spells-open-101').click()
  const detail = page.getByTestId('spells-detail')
  await detail.getByTestId('spells-mode-mine').click()
  await settle(() => detail.getByTestId('spells-amount-101-healing').innerText(), (text) => text.includes('8 → 18'))
  const panel = detail.getByTestId('bard-song-instruments')
  assert.match(await panel.innerText(), /Mystical Lute.*2.1×/s)
  assert.match(await panel.innerText(), /Kelin`s Seven Stringed Lute.*2.4×.*Requires equipment swap/s)
  assert.match(await detail.getByTestId('bard-combined-hp').first().innerText(), /equipped instrument 16.*best carried 18/)
  await page.getByTestId('spells-detail-back').click()
  await page.getByTestId('spells-compare-101').click()
  await page.getByTestId('spells-tab-compare').click()
  await page.getByTestId('spells-metric').click(); await page.getByRole('option', { name: 'Healing', exact: true }).click()
  await settle(() => page.getByTestId('spells-calculation').innerText(), (text) => text.includes('8 → 18'))
}
async function refreshAndSinging(page: Page, staged: FixtureLog): Promise<void> {
  await page.getByTestId('spells-open-101').click()
  const detail = page.getByTestId('spells-detail')
  inventory(staged, 'equipped')
  await settle(() => detail.getByTestId('bard-combined-hp').first().innerText(), (text) => text.includes('equipped instrument 18'), { timeoutMs: 30_000 })
  const previous = await page.evaluate(() => window.eq.spellLibrary.modifierContext())
  inventory(staged, 'equipped')
  const refreshed = await settle(() => page.evaluate(() => window.eq.spellLibrary.modifierContext()), (value) => value.inventory.exportedAt !== previous.inventory.exportedAt)
  assert.equal(refreshed.revision, previous.revision, 'identical exports retain calculation context identity')
  const exported = new Date(refreshed.inventory.exportedAt!).toLocaleString()
  await settle(() => detail.getByTestId('bard-song-instruments').innerText(), (text) => text.includes(exported))
  inventory(staged, 'removed')
  await settle(() => detail.getByTestId('spells-amount-101-healing').innerText(), (text) => text.includes('8 → 16'), { timeoutMs: 30_000 })
  await page.getByTestId('spells-detail-back').click()
  await page.getByTestId('spells-tab-browse').click()
  await page.getByTestId('spells-type-hot').click()
  await page.getByTestId('spells-group-ranked').click()
  assert.equal(await settle(() => page.getByTestId('spells-amount-101-healing').innerText(), (text) => text === '8'), '8', 'Browse shows rank-only song HP; instrument projections remain in details')
  await page.getByTestId('nav-leveling').click()
  await page.locator('[data-testid="best-spells-tab"][data-tab="hot"]').click()
  await settle(() => page.getByTestId('spells-amount-101-healing').innerText(), (text) => text.includes('8 → 16'))
  await page.getByTestId('nav-spells').click(); await page.getByTestId('spells-tab-browse').click()
  await page.getByTestId('spells-reset-filters').click()
  await page.getByTestId('spells-group-all').click()
  await page.getByTestId('spells-open-738').click()
  await page.getByTestId('bard-effect-1').waitFor()
  const bard = page.getByTestId('bard-song-instruments')
  assert.match(await bard.innerText(), /Song skill: singing/)
  assert.match(await bard.innerText(), /do not substitute for a Singing modifier/)
  assert.match(await bard.innerText(), /No qualifying modifier found/)
  assert.match(await page.getByTestId('bard-effect-2').innerText(), /slow and haste do not scale/)
  assert.match(await page.getByTestId('bard-effect-1').innerText(), /Slows movement by 20%/)
}

async function detailAppearance(page: Page): Promise<void> {
  assert.equal(await page.getByTestId('spell-description').innerText(), 'Binds up to 8 nearby enemies.')
  const surface = await page.getByRole('dialog').evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, overlay: getComputedStyle(element).backgroundImage }))
  assert.equal(surface.background, 'rgb(15, 17, 21)'); assert.equal(surface.overlay, 'none')
  const summary = page.getByTestId('spell-effect-summary'), instruments = page.getByTestId('bard-song-instruments')
  assert.ok((await summary.boundingBox())!.y < (await instruments.boundingBox())!.y, 'spell effects lead the detail page')
  const technical = page.getByTestId('spells-technical-details').getByRole('button')
  assert.equal(await technical.getAttribute('aria-expanded'), 'false')
  await technical.click()
  assert.match(await page.getByRole('table', { name: 'Decoded client effects' }).innerText(), /SPA 3/)
  await technical.click()
  await dumpArtifacts(page, 'spell-detail-mine-clean')
  assert.equal(await instruments.getByRole('columnheader', { name: 'Base effect', exact: true }).count(), 1)
  await page.getByTestId('spells-detail').getByTestId('spells-mode-mine').click()
  await settle(() => instruments.getByRole('columnheader', { name: 'Base effect', exact: true }).count(), (count) => count === 0)
  await dumpArtifacts(page, 'spell-detail-client-clean')
}

async function supplementalHaste(page: Page): Promise<void> {
  await page.getByTestId('spells-detail-back').click()
  await page.getByTestId('spells-open-8461').click()
  const summary = page.getByTestId('spell-effect-summary')
  await settle(() => summary.innerText(), (text) => text.includes('Adds 5 percentage points'))
  assert.match(await summary.innerText(), /Supplemental spell haste \(type II\)/)
  assert.match(await summary.innerText(), /within the normal total-haste cap; adds no speed once that cap is reached/)
  await page.getByTestId('spells-technical-details').getByRole('button').click()
  assert.match(await page.getByRole('table', { name: 'Decoded client effects' }).innerText(), /Supplemental spell haste.*SPA 98.*Adds 5/s)
}

buildIfStale()
const staged = stageFixture('e2e-leveling.log')
stageSources(staged); inventory(staged, 'carried')
staged.append('[50 BRD/PAL/WIZ] Primitive (Dark Elf)  ZONE: East Freeport (freportn)')
const launch = await launchOnFixture(staged), page = await mainWindow(launch.app)
page.setDefaultTimeout(20_000)
try {
  await waitHydrated(page)
  const before = await epoch(page)
  await mine(page); await refreshAndSinging(page, staged)
  await detailAppearance(page)
  await supplementalHaste(page)
  assert.equal(await epoch(page), before)
  assert.equal((await page.evaluate(() => window.eq.spellLibrary.history())).snapshots.length, 1)
  await dumpArtifacts(page, 'bard-instruments-ready')
  console.log('Bard instruments: native resonance, best carried/equipped totals, swaps, Singing exclusions, live inventory refresh, cross-view parity, unchanged history and engine passed.')
} catch (error) { await dumpArtifacts(page, 'bard-instruments-failure'); throw error }
finally { await launch.close(); await staged.dispose() }
