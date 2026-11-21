/** The weapon view works even when the player's regular columns hide Ratio. */
import type { Page } from 'playwright-core'
import { check, countOf, settle, settleCount } from './appHarness.mjs'
import { cellText, pickColumns } from './gearColumnSteps.mjs'
import { clearPicks, pickIn } from './gearFilterSteps.mjs'
import { runGearSuite } from './gearSuiteRunner.mjs'

const WEAPONS = '[data-testid="gear-weapons-toggle"]'
const SEARCH = '[data-testid="gear-search"] input'
const WEAPON_TYPE = '[data-testid="gear-weapon"]'
const ROW = '[data-testid="gear-row"]'
const THELVORN = 'thelvorn, blade of light'
const ARMOR = 'indicolite breastplate'
const sortButton = (key: string): string => `[data-testid="gear-sort-${key}"]`
const rowFor = (key: string): string => `${ROW}[data-item-key="${key}"]`

async function waitForRows(page: Page, selector = ROW): Promise<boolean> {
  return (await settleCount(page, selector, 1, { timeoutMs: 30_000 })) > 0
}

function sortDirection(page: Page, key: string): Promise<string | null> {
  return page.locator(`${sortButton(key)} >> xpath=ancestor::th`).getAttribute('aria-sort')
}

async function ratiosInOrder(page: Page, direction: 'ascending' | 'descending'): Promise<boolean> {
  return settle(async () => {
    const readings = await page.getByTestId('gear-cell-RATIO').allTextContents()
    const numbers = readings.filter((s) => s.trim() !== '').map(Number)
    if (numbers.length < 2 || readings.slice(0, numbers.length).some((s) => s.trim() === '')) return false
    return numbers.every((n, i) => i === 0 || (direction === 'ascending' ? n >= numbers[i - 1] : n <= numbers[i - 1]))
  }, Boolean, { timeoutMs: 15_000 })
}

async function checkWeaponColumns(page: Page): Promise<void> {
  await page.fill(SEARCH, 'thelvorn')
  if (!check('the known one-handed weapon survives search', await waitForRows(page, rowFor(THELVORN)))) return
  const [hand, type, dmg, delay, ratio] = await Promise.all(['HAND', 'WEAPON_TYPE', 'DMG', 'DELAY', 'RATIO'].map((key) => cellText(page, THELVORN, key)))
  check('weapon cells show the catalog skill and handedness', hand === 'One-handed' && type === '1H Slashing', `${hand} · ${type}`)
  check('ratio is calculated from the displayed damage and delay', Number(delay) > 0 && ratio === (Number(dmg) / Number(delay)).toFixed(2), `${dmg} / ${delay} = ${ratio}`)
  await pickIn(page, WEAPON_TYPE, 'Two-handed')
  check('the Two-handed filter still excludes the searched one-handed weapon', await settle(async () => (await countOf(page, rowFor(THELVORN))) === 0, Boolean))
  await clearPicks(page, WEAPON_TYPE)
  check('clearing Weapon type brings the searched weapon back', await waitForRows(page, rowFor(THELVORN)))
  await page.click('[data-testid="gear-owned-stats-toggle"]')
  const ownedRatio = await settle(() => cellText(page, THELVORN, 'RATIO'), (n) => n === '1.15')
  check('the comparison ratio uses the highest tier owned for the weapon', ownedRatio === '1.15', ownedRatio)
  await page.click('[data-testid="gear-owned-stats-toggle"]')
}

async function checkWeaponRanking(page: Page): Promise<void> {
  await page.fill(SEARCH, '')
  check('Weapons opens ranked by highest ratio', await sortDirection(page, 'RATIO') === 'descending' && await ratiosInOrder(page, 'descending'))
  await page.click(sortButton('RATIO'))
  check('clicking Ratio reverses the numeric ranking', await sortDirection(page, 'RATIO') === 'ascending' && await ratiosInOrder(page, 'ascending'))
  for (const key of ['HAND', 'WEAPON_TYPE']) {
    await page.click(sortButton(key))
    check(`${key} can be sorted alphabetically`, await sortDirection(page, key) === 'ascending')
  }
}

await runGearSuite('gear-weapon-comparison', async (_app, page) => {
  if (!check('Gear has loaded', await waitForRows(page))) return
  await clearPicks(page, '[data-testid="gear-classes"]')
  await page.click('[data-testid="gear-era-toggle"]')
  await pickColumns(page, ['RATIO'])
  await page.click(sortButton('name'))
  const normalSort = await sortDirection(page, 'name')
  check('regular Gear uses the chosen layout without Ratio', await countOf(page, sortButton('RATIO')) === 0)
  await page.fill(SEARCH, ARMOR)
  check('the catalog contains the searched armor piece', await waitForRows(page, rowFor(ARMOR)))
  await page.click(WEAPONS)
  check('Weapons keeps the search and excludes the armor piece', await page.locator(SEARCH).inputValue() === ARMOR && await settle(async () => (await countOf(page, rowFor(ARMOR))) === 0, Boolean))
  const required = ['RATIO', 'DMG', 'DELAY', 'HAND', 'WEAPON_TYPE', 'DMG_BONUS', 'BACKSTAB', 'RANGE', 'HASTE', 'PROC']
  check('the weapon layout exposes every comparison column', (await Promise.all(required.map((key) => countOf(page, sortButton(key))))).every((n) => n === 1))
  await checkWeaponRanking(page)
  await checkWeaponColumns(page)
  await page.click(WEAPONS)
  check('leaving Weapons restores the previous sort and column choices', await sortDirection(page, 'name') === normalSort && await countOf(page, sortButton('RATIO')) === 0)
})
