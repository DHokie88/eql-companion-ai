/** Copy the Combat log's current parsed/unparsed rows through the real main-process clipboard. */
import { readFileSync, writeFileSync } from 'node:fs'
import type { ElectronApplication, Page } from 'playwright-core'
import { buildIfStale, check, dumpArtifacts, failures, reportRun, settle, settleCount, settleGone, settleStable, waitHydrated } from './appHarness.mjs'
import { mainWindow } from './appWindow.mjs'
import { launchOnFixture, stageFixture } from './logFixture.mjs'

const COPY = '[data-testid="copy-fight-log"]'
const LOG = '[data-testid="combat-log"]'

function clipboard(app: ElectronApplication, write?: string): Promise<string> {
  return app.evaluate(({ clipboard: cb }, text: string | undefined) => {
    if (text !== undefined) cb.writeText(text)
    return cb.readText()
  }, write)
}

/** Read every displayed row, including those outside the scroll viewport, preserving its spans. */
function rows(page: Page): Promise<string[]> {
  return page.evaluate((sel) => Array.from(document.querySelector(sel)?.children ?? [])
    .filter((row) => row.querySelectorAll('span').length === 3)
    .map((row) => Array.from(row.querySelectorAll('span')).map((span) => span.textContent ?? '').join(' ')), LOG)
}

async function copyRows(app: ElectronApplication, page: Page, label: string): Promise<string[]> {
  const expected = await rows(page)
  await clipboard(app, 'e2e-copy-fight-log-sentinel')
  await page.click(COPY)
  check(`${label}: copy confirms success`, await settleCount(page, `${COPY} [data-testid="CheckIcon"]`) === 1)
  check(`${label}: successful copy says Copied`, (await page.locator(COPY).innerText()).trim() === 'Copied')
  const actual = await clipboard(app)
  check(`${label}: clipboard equals every displayed timestamp, category and text`, actual === expected.join('\n'), `${expected.length} rows`)
  check(`${label}: feedback returns to Copy fight log`, await settleGone(page, `${COPY} [data-testid="CheckIcon"]`))
  return expected
}

async function main(): Promise<void> {
  buildIfStale()
  const log = stageFixture('e2e-combat.log')
  // Keep only the harness's disposable file empty. The committed fixture remains untouched.
  const messages = readFileSync(log.logPath, 'utf8').trim().split(/\r?\n/).map((line) => line.replace(/^\[[^\]]+\] /, ''))
  writeFileSync(log.logPath, '')
  const { app, close } = await launchOnFixture(log)
  let page: Page | null = null
  const priorText = await clipboard(app)
  try {
    page = await mainWindow(app)
    await page.click('[data-testid="nav-combat"]', { timeout: 60_000 })
    await waitHydrated(page)
    if (await page.locator('[data-testid="telemetry-notice-off"]').count()) {
      await page.click('[data-testid="telemetry-notice-off"]')
      await settleGone(page, '[data-testid="telemetry-notice"]')
    }
    await page.waitForSelector(COPY)
    check('an empty combat log disables copying', await page.locator(COPY).isDisabled())
    await clipboard(app, 'e2e-empty-log-sentinel')
    await page.locator(COPY).evaluate((button: HTMLButtonElement) => button.click())
    check('an empty log leaves the clipboard alone', await clipboard(app) === 'e2e-empty-log-sentinel')

    // Replay real fixture messages into the live tail, enough to overflow the bounded log.
    log.appendAt(new Date(), ...messages.slice(-150))
    const parsed = await settle(() => rows(page!), (lines) => lines.length > 10)
    check('parsed rows arrive through the live tail', parsed.length > 10)
    check('the log overflows, so copying must include rows beyond the viewport', await page.locator(LOG).evaluate((el) => el.scrollHeight > el.clientHeight))
    await copyRows(app, page, 'parsed')
    await page.getByLabel('show unparsed', { exact: true }).check()
    check('show unparsed is enabled', await page.getByLabel('show unparsed', { exact: true }).isChecked())
    // The current Rust fold emits no unparsed category (combat/tests/more.rs); the copy must
    // still match exactly what this state displays, including any future unparsed rows.
    await settleStable(() => rows(page!))
    await copyRows(app, page, 'show unparsed')
    if (failures.length) await dumpArtifacts(page, 'combat-log-copy-FAIL')
  } finally {
    if (priorText) await clipboard(app, priorText)
    await close()
    await log.dispose()
  }
  reportRun()
}

main().catch((error: unknown) => {
  console.error('e2e: combat-log-copy harness error', error)
  process.exitCode = 1
})
