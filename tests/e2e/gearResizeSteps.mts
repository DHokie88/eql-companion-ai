import type { Page } from 'playwright-core'
import { check, countOf, settle } from './appHarness.mjs'

const TABLE = '[data-testid="gear-table"]'
const HANDLE = '[data-testid="gear-resize-'
const parked: Record<string, number> = {}

function dimensions(page: Page, key: string): Promise<{ header: number; body: number }> {
  return page.evaluate((column) => {
    const handle = document.querySelector(`[data-testid="gear-resize-${column}"]`)
    const header = handle?.closest('th')
    const index = header instanceof HTMLTableCellElement ? header.cellIndex : -1
    const body = document.querySelector('[data-testid="gear-row"]')?.children[index]
    return { header: header?.getBoundingClientRect().width ?? 0, body: body?.getBoundingClientRect().width ?? 0 }
  }, key)
}

async function drag(page: Page, key: string, delta: number): Promise<void> {
  const handle = page.locator(`${HANDLE}${key}"]`)
  await handle.scrollIntoViewIfNeeded()
  const box = await handle.boundingBox()
  if (!box) throw new Error(`Missing resize handle for ${key}`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + delta, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
}

async function assertParked(page: Page, context: string): Promise<void> {
  for (const [key, expected] of Object.entries(parked)) {
    const ready = await settle(() => dimensions(page, key), (size) =>
      Math.abs(size.header - expected) <= 1 && Math.abs(size.body - expected) <= 1,
    { timeoutMs: 10_000 })
    check(`${key} width survives ${context} in both header and body`, Math.abs(ready.header - expected) <= 1 && Math.abs(ready.body - expected) <= 1, JSON.stringify(ready))
  }
}

export async function stepGearResize(page: Page): Promise<void> {
  const defaults = await page.evaluate(() => {
    const name = document.querySelector('[data-testid="gear-resize-name"]')?.closest('th')
    const ac = document.querySelector('[data-testid="gear-resize-AC"]')?.closest('th')
    return { name: name?.getBoundingClientRect().width ?? 0, ac: ac?.getBoundingClientRect().width ?? 0 }
  })
  check('defaults give Item readable space and keep short stats compact', defaults.name >= 439 && defaults.ac >= 87 && defaults.ac <= 100, JSON.stringify(defaults))
  const sortBefore = await page.locator('[data-testid="gear-sort-STR"]').getAttribute('class')
  for (const [key, delta] of [['name', 80], ['slot', 48], ['STR', 40]] as const) {
    const before = await dimensions(page, key)
    await drag(page, key, delta)
    parked[key] = Math.round(before.header + delta)
    const size = await dimensions(page, key)
    check(`dragging ${key} changes its width by ${delta}px`, Math.abs(size.header - parked[key]) <= 1, JSON.stringify(size))
  }
  check('dragging a stat divider does not change sorting', await page.locator('[data-testid="gear-sort-STR"]').getAttribute('class') === sortBefore)

  // Native pointer double-click and keyboard resizing use the same preference path.
  const slot = page.locator(`${HANDLE}slot"]`)
  await slot.dblclick()
  check('double-click restores a column default', Math.abs((await dimensions(page, 'slot')).header - 150) <= 1)
  await slot.focus()
  await page.keyboard.press('ArrowRight')
  parked.slot = 166
  await assertParked(page, 'keyboard resizing')

  await page.click('[data-testid="nav-overview"]')
  check('Gear unmounts before testing saved widths', (await countOf(page, TABLE)) === 0)
  await page.click('[data-testid="nav-gear"]')
  await page.waitForSelector(TABLE)
  await assertParked(page, 'navigation away and back')
  await page.evaluate(() => { const list = document.querySelector('[data-testid="gear-list"]'); if (list) list.scrollLeft = 0 })
}

export async function stepGearResizeRelaunched(page: Page): Promise<void> {
  await assertParked(page, 'an app restart')
}
