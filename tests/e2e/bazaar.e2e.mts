/** Bazaar vertical slice against a staged EQ log: engine offers, prices/quotes/search, real watch
 * controls, alerts while another tab is open, duplicate suppression and process persistence. */
import type { Page } from 'playwright-core'
import { buildIfStale, check, countOf, dumpArtifacts, failures, reportRun, settle, settleGone } from './appHarness.mjs'
import { mainWindow, makeUserData, removeUserData } from './appWindow.mjs'
import { launchOnFixture, stageFixture, type FixtureLaunch } from './logFixture.mjs'
import type { BazaarSnap } from '../../src/shared/bazaar'
import type { BazaarWatchlist } from '../../src/shared/bazaarWatch'
import type { AlertDef } from '../../src/shared/alertTypes'

const ITEM = 'Fleeting Quiver'
const ROW = '[data-testid="bazaar-row-Fleeting Quiver|0"]'
interface Bridge {
  getModuleSnapshot: <T>(id: string) => Promise<{ state: T } | null>
  getBazaarWatch: () => Promise<BazaarWatchlist>
  listAlerts: () => Promise<AlertDef[]>
}
async function snapshot<T>(page: Page, id: string): Promise<T | null> {
  return page.evaluate(async (id) => {
    const result = await (window as unknown as { eq: Bridge }).eq.getModuleSnapshot<T>(id)
    return result?.state ?? null
  }, id)
}
async function contents(page: Page, selector: string): Promise<string> {
  return page.$eval(selector, (element) => element.textContent ?? '').catch(() => '')
}
async function dismissNotice(page: Page): Promise<void> {
  const notice = '[data-testid="telemetry-notice"]'
  await page.waitForSelector(notice, { timeout: 20_000 }).catch(() => undefined)
  if (await countOf(page, notice)) {
    await page.click('[data-testid="telemetry-notice-off"]')
    await settleGone(page, notice)
  }
}
async function watchState(page: Page): Promise<BazaarWatchlist> {
  return page.evaluate(() => (window as unknown as { eq: Bridge }).eq.getBazaarWatch())
}
interface AppFire { alertId: string; context: string }
interface Banner { alertId: string; text: string }
async function observeFires(launch: FixtureLaunch): Promise<void> {
  // The existing appFired handler deliberately records no engine history. Observe the real IPC
  // leaving AlertPlayer instead of claiming that known, separate history gap is implemented.
  await launch.app.evaluate(({ ipcMain }) => {
    const state = globalThis as typeof globalThis & { eqoBazaarFires?: AppFire[]; eqoBazaarBanners?: Banner[] }
    state.eqoBazaarFires = []
    state.eqoBazaarBanners = []
    ipcMain.on('alerts:appFired', (_event, payload: AppFire) => {
      if (payload?.alertId === 'bazaar-watch') state.eqoBazaarFires?.push(payload)
    })
    ipcMain.on('alerts:banner', (_event, payload: Banner) => {
      if (payload?.alertId === 'bazaar-watch') state.eqoBazaarBanners?.push(payload)
    })
  })
}
async function observedFires(launch: FixtureLaunch): Promise<AppFire[]> {
  return launch.app.evaluate(() => (globalThis as typeof globalThis & { eqoBazaarFires?: AppFire[] }).eqoBazaarFires ?? [])
}
async function checkOffers(page: Page, launch: FixtureLaunch): Promise<void> {
  launch.log.append(
    "Trader tells General:1, 'WTS Fleeting Quiver 5k'",
    "Buyer tells General:1, 'WTB Fleeting Quiver 3k'"
  )
  const state = await settle(() => snapshot<BazaarSnap>(page, 'bazaar'),
    (state) => state?.rows.some((row) => row.item === ITEM && row.dir === 'sell' && row.prices?.includes(5000)) === true,
    { timeoutMs: 30_000 })
  check('real engine folds the staged chat into a priced Bazaar offer', state?.rows.some((row) => row.item === ITEM && row.dir === 'sell' && row.prices?.includes(5000)) === true)
  await page.click('[data-testid="nav-bazaar"]')
  await page.waitForSelector(ROW, { timeout: 30_000 })
  const row = await contents(page, ROW)
  check('the item row shows both asking and offered prices', row.includes('5k') && row.includes('3k'), row)
  const quote = await settle(() => contents(page, '[data-testid="bazaar-quotes"]'),
    (text) => text.includes('Trader') && text.includes('WTS Fleeting Quiver 5k'), { timeoutMs: 15_000 })
  check('the detail retains who offered and their quoted message', quote.includes('Trader') && quote.includes('WTS Fleeting Quiver 5k'), quote)
  await page.fill('[data-testid="bazaar-search"]', 'never-a-real-item')
  const gone = await settleGone(page, ROW, { timeoutMs: 10_000 })
  check('search filters the served item out', gone)
  await page.fill('[data-testid="bazaar-search"]', 'fleeting')
  await page.waitForSelector(ROW)
  check('case-insensitive search restores the item', await countOf(page, ROW) === 1)
}
async function enableWatch(page: Page): Promise<void> {
  await page.locator('[data-testid="bazaar-watch-on"] input').check()
  await page.locator('[data-testid="bazaar-watch-wts"] input').check()
  await page.fill('[data-testid="bazaar-watch-wts-max"]', '6k')
  await page.locator('[data-testid="bazaar-search"]').click()
  const saved = await settle(() => watchState(page),
    (list) => list.entries.some((watch) => watch.item === ITEM && watch.wts && watch.wtsMax === 6000),
    { timeoutMs: 10_000 })
  check('the real watch UI persists its WTS switch and price threshold', saved.entries.some((watch) => watch.item === ITEM && watch.wts && watch.wtsMax === 6000))
  const alerts = await page.evaluate(() => (window as unknown as { eq: Bridge }).eq.listAlerts())
  check('a seeded enabled alert handles the Bazaar app signal', alerts.some((alert) => alert.id === 'bazaar-watch' && alert.enabled && alert.trigger.type === 'app' && alert.trigger.signal === 'bazaarWatch'))
  check('enabling a watch does not alert on previously seen quotes', await countOf(page, '[data-testid="bazaar-heard"]') === 0)
}
async function liveAlert(page: Page, launch: FixtureLaunch): Promise<void> {
  const before = (await observedFires(launch)).length
  await page.click('[data-testid="nav-combat"]')
  launch.log.append("Freshseller tells General:1, 'WTS Fleeting Quiver 4k'")
  const fires = await settle(() => observedFires(launch), (fires) => fires.length === before + 1, { timeoutMs: 30_000 })
  check('a matching live offer fires the actual alert IPC with the Bazaar tab closed', fires.length === before + 1, JSON.stringify(fires))
  check('the alert carries the matched item, seller, price and threshold reason',
    fires.at(-1)?.context === 'Freshseller WTS Fleeting Quiver 4k (at or under your 6k)', JSON.stringify(fires.at(-1)))
  const banners = await launch.app.evaluate(() => (globalThis as typeof globalThis & { eqoBazaarBanners?: Banner[] }).eqoBazaarBanners ?? [])
  check('the alert banner receives fully expanded capture tokens',
    banners.length === 1 && banners[0].text === 'Freshseller WTS Fleeting Quiver 4k - at or under your 6k', JSON.stringify(banners))
  launch.log.append(
    "Freshseller tells General:1, 'WTS Fleeting Quiver 4k'",
    "Expensive tells General:1, 'WTS Fleeting Quiver 9k'"
  )
  const advanced = await settle(() => snapshot<BazaarSnap>(page, 'bazaar'),
    (state) => state?.rows.some((row) => row.quotes?.some((quote) => quote.who === 'Expensive')) === true,
    { timeoutMs: 20_000 })
  check('later nonmatching chat advances the real feed', advanced?.rows.some((row) => row.quotes?.some((quote) => quote.who === 'Expensive')) === true)
  await page.click('[data-testid="nav-bazaar"]')
  const heard = await settle(() => contents(page, '[data-testid="bazaar-heard"]'),
    (text) => text.includes('Freshseller') && text.includes('4k'), { timeoutMs: 15_000 })
  check('returning to Bazaar shows the missed watch alert', heard.includes('Freshseller') && heard.includes('4k'), heard)
  check('repeated quotes and over-threshold prices do not add fires', (await observedFires(launch)).length === before + 1)
  check('the heard list contains exactly one live match', await countOf(page, '[data-testid="bazaar-heard"] p') === 1)
  await page.click('[data-testid="nav-combat"]')
  await page.click('[data-testid="nav-bazaar"]')
  await page.waitForSelector('[data-testid="bazaar-watch-wts-max"]')
  check('the watch survives a tab remount', await page.inputValue('[data-testid="bazaar-watch-wts-max"]') === '6k')
}
async function checkRestart(launch: FixtureLaunch): Promise<void> {
  const page = await mainWindow(launch.app)
  const list = await watchState(page)
  check('the watch survives a full process restart', list.entries.some((watch) => watch.item === ITEM && watch.wts && watch.wtsMax === 6000))
  await page.click('[data-testid="nav-bazaar"]')
  await page.waitForSelector(ROW, { timeout: 30_000 })
  check('the replay restores the real quoted item after restart', (await contents(page, ROW)).includes(ITEM))
  check('replayed chat does not populate live alert history', await countOf(page, '[data-testid="bazaar-heard"]') === 0)
}
async function main(): Promise<void> {
  buildIfStale()
  const log = stageFixture('e2e-leveling.log')
  const userData = makeUserData()
  let launch: FixtureLaunch | null = null
  let page: Page | null = null
  try {
    launch = await launchOnFixture(log, { userData })
    await observeFires(launch)
    page = await mainWindow(launch.app)
    await dismissNotice(page)
    await checkOffers(page, launch)
    await enableWatch(page)
    await liveAlert(page, launch)
    await launch.close()
    launch = await launchOnFixture(log, { userData })
    page = await mainWindow(launch.app)
    await checkRestart(launch)
  } catch (error) {
    check('the isolated Bazaar spec completes', false, String(error))
  } finally {
    if (failures.length && page && !page.isClosed()) await dumpArtifacts(page, 'bazaar')
    await launch?.close()
    await log.dispose()
    await removeUserData(userData)
  }
  reportRun()
}
void main()
