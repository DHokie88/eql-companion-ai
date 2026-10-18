/** Captured-ID spell checks alongside the unchanged chart/AA/skills/layout regression steps. */
import type { Page } from 'playwright-core'
import { check, settle } from './appHarness.mjs'
import { playWho } from './gameplay.mjs'
import type { FixtureLog } from './logFixture.mjs'

export async function stepNewAtLevel(page: Page, log: FixtureLog): Promise<void> {
  playWho(log)
  await settle(() => page.getByTestId('new-at-level-client-spell').count(), (n) => n === 2, { timeoutMs: 20_000 })
  check('the client catalog supplies two exact-ID spell unlocks at this character level', await page.getByTestId('new-at-level-client-spell').count() === 2)
  check('the skill and discipline list remains alongside the captured spell list', (await page.getByTestId('new-at-level').innerText()).includes('Skills, disciplines & innates'))
}
export async function stepUnlockSearch(page: Page): Promise<void> {
  const search = page.getByTestId('new-at-level-spell-search')
  await search.fill('202')
  await settle(() => page.getByTestId('new-at-level-client-spell').count(), (n) => n === 1)
  check('the compact spell search resolves an exact numeric ID within the selected level', await page.getByTestId('new-at-level-client-spell').getAttribute('data-id') === '202')
  await search.fill('')
  await settle(() => page.getByTestId('new-at-level-client-spell').count(), (n) => n === 2)
}
export async function stepClientEligibility(page: Page): Promise<void> {
  const panel = await page.getByTestId('new-at-level-client-spells').innerText()
  check('client eligibility is labeled without claiming ownership or acquisition', panel.includes('Client eligibility, not confirmed ownership or acquisition'))
  check('each row retains numeric identity, class requirements, mana and rank evidence', /#201.*PAL 50.*WIZ 50.*10 mana/s.test(panel) && panel.includes('Mote rank unknown'))
}
export async function stepSpellCard(page: Page): Promise<void> {
  await page.getByTestId('new-at-level-spell-name').first().click()
  await page.getByTestId('spell-effect-summary').waitFor()
  check('the compact spell link opens the numeric-ID client detail with readable effects', (await page.getByTestId('spells-detail').innerText()).includes('ID 201'))
  await page.getByTestId('spells-detail-back').click()
  await page.getByTestId('leveling-view').waitFor()
  check('Back from a client spell returns to Leveling', await page.getByTestId('new-at-level').isVisible())
}
export async function stepBestSpells(page: Page): Promise<void> {
  await page.getByTestId('best-spells-row').first().waitFor()
  check('the compact ranking defaults to client-mana efficiency', await page.getByTestId('best-spells-section').getAttribute('data-sort') === 'efficiency')
  const first = await page.getByTestId('best-spells-name').first().getAttribute('data-id')
  check('the best spell is selected from the whole eligible captured catalog', first === '145', `ID ${first}`)
  await page.getByTestId('best-spells-level-next').click()
  await settle(() => page.getByTestId('new-at-level-value').innerText(), (text) => text === 'Level 51')
  await settle(() => page.getByTestId('new-at-level-client-spell').first().getAttribute('data-id'), (id) => id === '401')
  check('one level step updates eligibility and rankings in both columns', await page.getByTestId('best-spells').getAttribute('data-level') === '51')
  await page.getByTestId('best-spells-level-prev').click()
  await settle(() => page.getByTestId('new-at-level-client-spell').count(), (n) => n === 2)
}
