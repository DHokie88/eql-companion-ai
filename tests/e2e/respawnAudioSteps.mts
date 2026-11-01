import {
  assertTimerSound,
  readTimerAudio,
  restoreTimerAudio,
  stepChooseTimerSound
} from './respawnAudioChoiceSteps.mjs'
import type { ElectronApplication, Page } from 'playwright-core'
import type { FixtureLog } from './logFixture.mjs'
import { check, settle, settleStable } from './appHarness.mjs'
import type { RespawnPrefs } from '../../src/shared/respawn.ts'

/** A visible card must disappear on opening Sound, then return to ordinary hover afterward. */
async function stepAudioDialogHover(page: Page, row: string): Promise<void> {
  const card = page
    .locator('[role="tooltip"]')
    .filter({ has: page.locator('[data-testid="mob-card-note"]') })
  await page.locator(row).hover({ position: { x: 12, y: 12 } })
  await card.waitFor({ state: 'visible', timeout: 10000 })
  check('timer mob card is visible before opening Sound', await card.isVisible())
  await page.click(`${row} [data-testid="respawn-audio"]`)
  await page.locator('[data-testid="respawn-audio-dialog"]').waitFor({ state: 'visible' })
  await card.waitFor({ state: 'hidden', timeout: 10000 })
  check('opening Sound dismisses the already open mob card', !(await card.isVisible()))
  await page
    .locator('[data-testid="respawn-audio-dialog"] [data-testid="respawn-audio-mode"]')
    .hover()
  const absent = await settleStable(() => card.isVisible(), { pollMs: 150, stable: 5 })
  check('mob card stays hidden while pointing inside Sound', !absent)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.mouse.move(0, 0)
  await page.locator(row).hover({ position: { x: 12, y: 12 } })
  await card.waitFor({ state: 'visible', timeout: 10000 })
  check('normal mob hover returns after closing Sound', await card.isVisible())
  await page.mouse.move(0, 0)
}

/** Real UI + store + live engine clock + existing audio playback, with playback intercepted. */
export async function stepRespawnAudio(
  page: Page,
  log: FixtureLog,
  mob: string,
  app: ElectronApplication
): Promise<void> {
  const row = `[data-testid="respawn-row"][data-respawn-mob="${mob}"]`
  await stepAudioDialogHover(page, row)
  await page.click(`${row} [data-testid="respawn-audio"]`)
  await page.click('[data-testid="respawn-audio-mode"] [role="combobox"]')
  await page.getByRole('option', { name: 'Before it expires', exact: true }).click()
  await page.fill('[data-testid="respawn-audio-lead"] input', 'garbage')
  check(
    'timer audio refuses malformed warning durations',
    await page.locator('[data-testid="respawn-audio-save"]').isDisabled()
  )
  await page.fill('[data-testid="respawn-audio-lead"] input', '1m')
  await page.click('[data-testid="respawn-audio-save"]')
  const saved = await settle(
    () => page.evaluate(() => window.eq.getRespawnAudio()),
    (prefs) => prefs[mob]?.leadSec === 60
  )
  check('timer audio warning persists through IPC', saved[mob]?.leadSec === 60)
  await page.click(`${row} [data-testid="respawn-audio"]`)
  check(
    'timer audio reopens with the saved warning',
    (await page.locator('[data-testid="respawn-audio-lead"] input').inputValue()) === '1m'
  )
  await stepChooseTimerSound(page, row, mob)
  await page.click('[data-testid="respawn-audio-mode"] [role="combobox"]')
  await page.getByRole('option', { name: 'When it ends', exact: true }).click()
  await page.click('[data-testid="respawn-audio-save"]')
  const original = await page.evaluate(() => window.eq.getRespawn())
  await page.evaluate(
    async ({ prefs, key }: { prefs: RespawnPrefs; key: string }) => {
      await window.eq.setRespawn({
        ...prefs,
        watches: prefs.watches.map((w) => (w.key === key ? { ...w, customSec: 8 } : w))
      })
      await window.eq.setAlertPrefs({ globalVolume: 0.7, muted: false })
    },
    { prefs: original, key: mob }
  )
  const background = await app.evaluate(({ BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows().find((win) =>
      win.webContents.getURL().includes('/index.html')
    )
    if (!main) return null
    main.minimize()
    return main.webContents.getBackgroundThrottling()
  })
  check(
    'armed timer disables background throttling before the hidden/minimized cycle',
    background === false,
    String(background)
  )
  log.append(`You have slain ${mob}!`)
  await page.click('[data-testid="nav-overview"]')
  const played = await settle(
    async () => (await readTimerAudio(page)).length,
    (n) => n > 0,
    { timeoutMs: 20000 }
  )
  check(
    'timer sound reaches the existing player after leaving Timers',
    played === 1,
    String(played)
  )
  const once = await settleStable(async () => (await readTimerAudio(page)).length, {
    timeoutMs: 4000,
    pollMs: 300,
    stable: 7
  })
  check('timer expiry only plays once', once === 1)
  await assertTimerSound(page, (await readTimerAudio(page))[0], 'Automatic timer sound')
  await restoreTimerAudio(page)
  await page.evaluate(
    async ({ prefs, key }: { prefs: RespawnPrefs; key: string }) => {
      await window.eq.setRespawnAudio(key, null)
      await window.eq.setRespawn(prefs)
    },
    { prefs: original, key: mob }
  )
  await page.click('[data-testid="nav-timers"]')
}
