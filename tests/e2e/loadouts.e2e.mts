import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import { buildIfStale, check, reportRun, dumpArtifacts } from './appHarness.mjs'
import { mainWindow, makeUserData, removeUserData } from './appWindow.mjs'
import { launchOnFixture, stageFixture, type FixtureLog } from './logFixture.mjs'
// Exact own-/who shapes from committed cw1-who-anchored.log, lines112 and134.
const WHO1 = '[7 CLR/BER] Primitive (Froglok)  ZONE: West Commonlands (commons)'
const WHO2 = '[7 PAL/ENC] Primitive (Froglok)  ZONE: West Commonlands (commons)'
const options = { inventory: 'Primitive_freeport-Inventory.txt' }
async function gear(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="nav-gear"]', { timeout: 60000 })
  if (await page.locator('[data-testid="telemetry-notice-off"]').count()) await page.click('[data-testid="telemetry-notice-off"]')
  await page.click('[data-testid="nav-gear"]')
  await page.waitForSelector('[data-testid="tab-character"]')
}
async function waitCapture(page: Page, index: number): Promise<void> {
  await page.waitForFunction(async (i) => !!(await window.eq.loadoutsGet()).book.loadouts[i].capture, index)
}
async function firstRun(userData: string, log: FixtureLog): Promise<void> {
  console.log('loadouts: launching fixture')
  const launched = await launchOnFixture(log, { userData })
  let page: Page | null = null
  try {
    page = await mainWindow(launched.app)
    await gear(page)
    const ids = await page.locator('[data-testid="tab-gear"], [data-testid="tab-character"], [data-testid="tab-build"], [data-testid="tab-wishlist"], [data-testid="tab-planner"], [data-testid="tab-crafting"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')))
    assert.deepEqual(ids,['tab-gear','tab-character','tab-build','tab-wishlist','tab-planner','tab-crafting'])
    check('gear tabs follow search, actual gear, build, wishlist, exaltations, crafting',true)
    await page.click('[data-testid="tab-character"]')
    launched.log.append(WHO1)
    await page.waitForFunction(async () => (await window.eq.loadoutsGet()).book.loadouts[0].classes.join('/') === 'CLR/BER', undefined, { timeout: 30000 })
    assert.equal(await page.locator('[data-testid^="loadout-lo"]').count(),5)
    await page.waitForFunction(() => !(document.querySelector('[data-testid="loadout-capture"]') as HTMLButtonElement)?.disabled)
    await page.click('[data-testid="loadout-capture"]')
    await waitCapture(page,0)
    const original = await page.evaluate(async () => (await window.eq.loadoutsGet()).book.loadouts[0].capture)
    assert.ok(original?.sheet.cells.some((cell) => cell.item !== null))
    const rejected = await page.evaluate(async () => window.eq.loadoutsUpdate('somebody-else',{kind:'edit',id:'lo1',name:'wrong'}).then(()=>false,()=>true))
    assert.equal(rejected,true)
    check('actual equipment capture is saved and cross-character writes are rejected',true)
    await page.click('[data-testid="loadout-lo5"]')
    await page.click('[data-testid="tab-build"]')
    await page.waitForSelector('[data-testid="build-no-dump"]')
    assert.match(await page.locator('[data-testid="build-no-dump"]').innerText(), /No saved equipment for this loadout/)
    await page.getByRole('button', { name: 'Follow live inventory' }).click()
    await page.waitForSelector('[data-testid="build-no-dump"]', { state: 'detached' })
    assert.match(await page.locator('[data-testid="build-toolbar"]').innerText(), /current inventory/)
    assert.match(await page.locator('[data-testid="build-cell-ANY1"]').innerText(), /Brigandine Tunic/)
    assert.match(await page.locator('[data-testid="build-cell-ANY2"]').innerText(), /Midnight Clad Straps/)
    check('an uncaptured loadout explains the available inventory and can return to live equipment', true)
    await page.click('[data-testid="tab-character"]')
    await page.click('[data-testid="loadout-lo2"]')
    await page.click('[data-testid="loadout-edit"]')
    await page.locator('[data-testid="loadout-name"] input').fill('Caster plan')
    await page.click('[data-testid="combo-class-PAL"]')
    await page.click('[data-testid="combo-class-ENC"]')
    await page.click('[data-testid="loadout-save"]')
    await page.waitForSelector('[data-testid="loadout-save"]',{state:'detached'})
    launched.log.append(WHO2)
    await page.waitForFunction(() => !(document.querySelector('[data-testid="loadout-capture"]') as HTMLButtonElement)?.disabled)
    await page.click('[data-testid="loadout-capture"]')
    await waitCapture(page,1)
    launched.log.append(WHO1)
    await page.waitForFunction(() => document.querySelector('[data-testid="loadout-lo1"]')?.textContent?.includes('LIVE'))
    assert.match(await page.locator('[data-testid="loadout-context"]').innerText(),/Viewing: Caster plan/)
    check('a live class change cannot pull the user out of a manually selected planning loadout',true)
    await page.click('[data-testid="tab-build"]')
    await page.waitForSelector('[data-testid="build-meter-custom"]',{timeout:30000})
    await page.click('[data-testid="build-meter-custom"]')
    await page.waitForFunction(async () => (await window.eq.loadoutsGet()).book.loadouts[1].strategyId === 's5')
    await page.click('[data-testid="build-edit-strategies"]')
    await page.locator('[data-testid="strategy-select"] [role="combobox"]').click()
    await page.getByRole('option',{name:'Custom',exact:true}).click()
    await page.getByRole('spinbutton',{name:'HP weight',exact:true}).fill('4.5')
    await page.waitForFunction(async () => (await window.eq.loadoutsGet()).book.strategies[4].weights.HP === 4.5)
    await page.click('[data-testid="strategy-reset"]')
    await page.waitForFunction(async () => Object.keys((await window.eq.loadoutsGet()).book.strategies[4].weights).length === 0)
    await page.getByRole('button',{name:'Close',exact:true}).click()
    await page.getByRole('button',{name:'Try in plan',exact:true}).first().click()
    await page.waitForFunction(async () => Object.keys((await window.eq.loadoutsGet()).book.loadouts[1].plan).length > 0)
    const after = await page.evaluate(async () => (await window.eq.loadoutsGet()).book)
    assert.deepEqual(after.loadouts[0].capture,original)
    assert.deepEqual(after.loadouts[0].plan,{})
    assert.ok(Object.values(after.loadouts[1].plan).some((item) => item.tier >= 5), 'a suggested swap retains its scored tier')
    const wish = page.getByRole('button',{name:'Wishlist',exact:true}).first()
    await wish.click()
    await page.waitForFunction(async () => (await window.eq.loadoutsGet()).book.loadouts[1].wishKeys.length > 0)
    await page.click('[data-testid="build-load-optimal"]', { timeout: 60000 })
    await page.waitForFunction(async () => {
      const plan = Object.values((await window.eq.loadoutsGet()).book.loadouts[1].plan)
      return plan.length > 5 && plan.every((item) => item.key === '__eq_empty_slot__' || item.tier === 5)
    }, undefined, { timeout: 60000 })
    assert.ok((await page.locator('[data-testid^="build-cell-"]').allInnerTexts()).some((text) => text.includes(' +5')), 'the loaded tier is visible on the plan')
    const optimalPlan = await page.evaluate(async () => (await window.eq.loadoutsGet()).book.loadouts[1].plan)
    await page.waitForFunction(() => !(document.querySelector('[data-testid="build-load-owned"]') as HTMLButtonElement)?.disabled, undefined, { timeout: 60000 })
    await page.click('[data-testid="build-load-owned"]', { timeout: 60000 })
    await page.waitForFunction(async (previous) => {
      const current = (await window.eq.loadoutsGet()).book.loadouts[1].plan
      const plan = Object.values(current)
      const entries = (await window.eq.gearOwnership()).entries
      const owned = new Set(entries.filter(([, rows]) => rows.some((row) => !row.exaltation)).map(([key]) => key))
      return JSON.stringify(current) !== previous && plan.some((item) => item.key !== '__eq_empty_slot__') &&
        plan.every((item) => item.key === '__eq_empty_slot__' || (item.tier >= 5 && owned.has(item.key)))
    }, JSON.stringify(optimalPlan), { timeout: 60000 })
    check('optimal loads +5, and best owned loads only inventory items into the saved plan', true)
    await page.click('[data-testid="tab-wishlist"]')
    await page.click('[data-testid="wishlist-selected-loadout"]')
    const book = await page.evaluate(async () => (await window.eq.loadoutsGet()).book)
    const wishes = await page.evaluate(() => window.eq.getWishlist())
    assert.ok(book.loadouts[1].wishKeys.some((key) => wishes.entries.some((entry) => entry.itemKey === key)))
    check('strategy edits/reset, independent plans and missing-item wishlist links persist through IPC',true)
  } catch (error) { if (page) await dumpArtifacts(page,'loadouts-FAIL'); throw error }
  finally { await launched.close() }
}
async function secondRun(userData: string, log: FixtureLog): Promise<void> {
  console.log('loadouts: launching fixture')
  const launched = await launchOnFixture(log, { userData })
  try {
    console.log('loadouts: restart launch ready')
    const page = await mainWindow(launched.app)
    await gear(page)
    await page.click('[data-testid="tab-character"]')
    launched.log.append(WHO1)
    await page.waitForFunction(() => document.querySelector('[data-testid="loadout-context"]')?.textContent?.includes('Following live'))
    const saved = await page.evaluate(() => window.eq.loadoutsGet())
    assert.equal(saved.book.loadouts[1].name,'Caster plan')
    assert.ok(saved.book.loadouts[1].capture)
    assert.ok(Object.keys(saved.book.loadouts[1].plan).length > 0)
    assert.ok(saved.book.loadouts[1].wishKeys.length > 0)
    check('restart restores saved equipment, plans and wishlist links and defaults selection back to live',true)
  } finally { await launched.close() }
}
async function main(): Promise<void> {
  buildIfStale()
  const userData = makeUserData()
  const log = stageFixture('e2e-planner.log',options)
  try { await firstRun(userData,log); await secondRun(userData,log) } finally { await removeUserData(userData); await log.dispose() }
  reportRun()
}
main().catch((err: unknown) => { console.error(err); process.exitCode=1 })
