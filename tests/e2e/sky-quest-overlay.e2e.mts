/** Sky overlay integration over an isolated EQ install: real stars, shared counts, live export
 * rewrites, manual corrections, navigation, and persisted overlay controls. */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ElectronApplication, Page } from 'playwright-core'
import { buildIfStale, check, countOf, dumpArtifacts, failures, reportRun, settle, settleGone } from './appHarness.mjs'
import { mainWindow, overlayWindow } from './appWindow.mjs'
import { launchOnFixture } from './logFixture.mjs'

const ROW = '[data-testid="sky-overlay-row"]'
const QUEST = 'Bard Test of Tone'
const ITEM = 'Light Woolen Mask'
const RUNE = 'Wind Rune Meda'
interface MainBridge {
  setCharacter: (path: string) => Promise<unknown>
  getCharacter: () => Promise<{ name: string } | null>
  toggleOverlay: (kind: string) => Promise<boolean>
  getOverlayState: () => Promise<Record<string, boolean>>
  setItemOverride: (key: string, name: string, count: number | null) => Promise<unknown>
}
interface OverlayBridge {
  getConfig: () => Promise<{ bounds?: { width: number; height: number }; skyIcons?: boolean }>
}

async function text(page: Page, selector: string): Promise<string> {
  return page.$eval(selector, (element) => element.textContent ?? '').catch(() => '')
}
async function source(page: Page, value: string): Promise<void> {
  await page.click('[data-testid="posky-count-source"]')
  await page.click(`li[role="option"][data-value="${value}"]`)
}
async function ready(overlay: Page, expected: boolean, label: string): Promise<void> {
  const value = await settle(
    () => overlay.$eval(ROW, (row) => row.getAttribute('data-sky-ready')).catch(() => null),
    (value) => value === String(expected), { timeoutMs: 20_000 }
  )
  check(label, value === String(expected), String(value))
}
function writeDump(root: string, complete: boolean): void {
  const rows = ['Location\tName\tID\tCount\tSlots', `General 1\t${ITEM}\t1234\t1\t0`]
  if (complete) rows.push(`General 2\t${RUNE}\t1235\t1\t0`)
  writeFileSync(join(root, 'Primitive_freeport-Inventory.txt'), `${rows.join('\n')}\n`, 'utf8')
}
async function toggle(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as { eq: MainBridge }).eq.toggleOverlay('skyQuests'))
}
async function starQuest(page: Page): Promise<void> {
  await page.click('[data-testid="nav-posky"]')
  await page.waitForSelector('[data-testid="posky-counts"]', { timeout: 60_000 })
  await page.fill('[data-testid="posky-search"] input', QUEST)
  await page.locator('[data-testid="posky-quest-row"]').filter({ hasText: QUEST })
    .locator('[aria-label="Favorite this quest"]').click()
}
async function controls(page: Page, overlay: Page, app: ElectronApplication): Promise<void> {
  const icons = await settle(() => countOf(overlay, `${ROW} img`), (count) => count >= 1, { timeoutMs: 15_000 })
  check('required items use their committed icons', icons >= 1)
  await overlay.click('[data-testid="sky-overlay-icons"]')
  const hidden = await settle(() => countOf(overlay, `${ROW} img`), (count) => count === 0, { timeoutMs: 10_000 })
  check('icons can be hidden', hidden === 0)
  const target = await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find((window) => new URL(window.webContents.getURL()).searchParams.get('kind') === 'skyQuests')
    if (!window) return null
    // Hidden Windows setBounds may omit the native resized event; exercise its real persistence listener.
    window.setBounds({ width: 520, height: 300 })
    window.emit('resized')
    return window.getBounds()
  })
  check('the Sky window supports independent bounds', target !== null)
  if (!target) return
  const saved = await settle(
    () => overlay.evaluate(() => (window as unknown as { eqOverlay: OverlayBridge }).eqOverlay.getConfig()),
    (config) => config.bounds?.width === target.width && config.bounds.height === target.height,
    { timeoutMs: 10_000 }
  )
  check('window bounds are persisted', saved.bounds?.width === target.width && saved.bounds.height === target.height)
  await toggle(page)
  await settle(() => overlay.isClosed(), Boolean, { timeoutMs: 10_000 })
  await toggle(page)
  const reopened = await overlayWindow(app, 'skyQuests')
  check('the Sky window reopens', reopened !== null)
  if (!reopened) return
  const config = await reopened.evaluate(() => (window as unknown as { eqOverlay: OverlayBridge }).eqOverlay.getConfig())
  check('reopening retains bounds and the icons choice', config.bounds?.width === target.width && config.bounds.height === target.height && config.skyIcons === false)
}
async function characterIsolation(page: Page, overlay: Page, other: string, original: string): Promise<void> {
  await page.evaluate((name) => (window as unknown as { eq: MainBridge }).eq.setItemOverride(name.toLowerCase(), name, 1), RUNE)
  await ready(overlay, true, 'the original character has its manual correction')
  await page.evaluate((path) => (window as unknown as { eq: MainBridge }).eq.setCharacter(path), other)
  const switched = await settle(() => page.evaluate(() => (window as unknown as { eq: MainBridge }).eq.getCharacter()), (c) => c?.name === 'Visitor', { timeoutMs: 20_000 })
  check('the test switches to the second isolated character', switched?.name === 'Visitor')
  const noReady = await settle(() => countOf(overlay, ROW + '[data-sky-ready="true"]'), (n) => n === 0, { timeoutMs: 20_000 })
  check('another character never inherits the original ready quest', noReady === 0)
  await page.evaluate((path) => (window as unknown as { eq: MainBridge }).eq.setCharacter(path), original)
  await ready(overlay, true, 'switching back restores only the original character correction')
  await page.evaluate((name) => (window as unknown as { eq: MainBridge }).eq.setItemOverride(name.toLowerCase(), name, null), RUNE)
}
async function main(): Promise<void> {
  buildIfStale()
  const { app, log, close } = await launchOnFixture('e2e-leveling.log', { others: { Visitor: 'e2e-leveling.log' } })
  const page = await mainWindow(app)
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  try {
    const notice = '[data-testid="telemetry-notice"]'
    await page.waitForSelector(notice, { timeout: 20_000 }).catch(() => undefined)
    if (await countOf(page, notice)) {
      await page.click('[data-testid="telemetry-notice-off"]')
      await settleGone(page, notice)
    }
    const initial = await page.evaluate(() => (window as unknown as { eq: MainBridge }).eq.getOverlayState())
    check('Sky overlay starts off', initial.skyQuests === false)
    await page.click('[aria-label="Floating DPS overlays"]')
    await page.click('[data-testid="overlay-menu-skyQuests"]')
    await page.keyboard.press('Escape')
    const overlay = await overlayWindow(app, 'skyQuests')
    check('the Overlay menu opens the Sky window', overlay !== null)
    if (!overlay) throw new Error('Sky overlay did not open')
    overlay.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
    await overlay.waitForSelector('[data-testid="sky-overlay"]')
    const empty = await settle(() => text(overlay, '[data-testid="sky-overlay-empty"]'), (value) => value.includes('No starred quests'), { timeoutMs: 30_000 })
    check('the empty window explains starring a quest', empty.includes('No starred quests'))
    await starQuest(page)
    await settle(() => countOf(overlay, ROW), (count) => count === 1, { timeoutMs: 15_000 })
    const label = await text(overlay, ROW)
    check('the real quest star reaches the separate overlay', label.includes('Mask of Song') && label.includes('Cilin Spellsinger'), label)
    await source(page, 'inventory')
    await ready(overlay, false, 'without an export the quest is incomplete')
    writeDump(log.installDir, true)
    await ready(overlay, true, 'the live inventory export completes the starred quest')
    await source(page, 'log')
    await ready(overlay, false, 'the always-mounted feed follows the tab source picker')
    await source(page, 'inventory')
    await ready(overlay, true, 'the inventory choice returns the exact exported counts')
    await page.click('[data-testid="nav-combat"]')
    writeDump(log.installDir, false)
    await ready(overlay, false, 'export rewrites update the overlay while the Sky tab is closed')
    await page.evaluate(({ name }) => (window as unknown as { eq: MainBridge }).eq.setItemOverride(name.toLowerCase(), name, 1), { name: RUNE })
    await ready(overlay, true, 'existing manual item corrections reach the overlay')
    await page.evaluate(({ name }) => (window as unknown as { eq: MainBridge }).eq.setItemOverride(name.toLowerCase(), name, null), { name: RUNE })
    await ready(overlay, false, 'removing the manual correction restores the inventory count')
    await overlay.click(ROW)
    await page.waitForSelector('[data-testid="posky-counts"]')
    check('an unlocked overlay row navigates to its Sky quest', await countOf(page, '[data-testid="posky-quest-row"][data-anchored="true"]') === 1)
    await characterIsolation(page, overlay, log.others.Visitor, log.logPath)
    await controls(page, overlay, app)
    check('neither renderer reports errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  } catch (error) {
    check('the Sky overlay spec completes', false, String(error))
  } finally {
    if (failures.length) await dumpArtifacts(page, 'sky-quest-overlay')
    await close()
  }
  reportRun()
}
void main()
