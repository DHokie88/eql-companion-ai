/** Shared Gear checks for the independently launched Gear e2e specs. */
import type { Page } from 'playwright-core'
import {
  check,
  countOf,
  note,
  settle,
  settleCount
} from './appHarness.mjs'
import type { FixtureLog } from './logFixture.mjs'
// JOS-297's steps are a MODULE (the plannerSteps.mts precedent): everything they need is standing
// here, and this file is at the repo's 400-code-line factoring ceiling. `pickColumns`/`resetColumns`
// come from it too: since JOS-302 deleted the stat thresholds, naming a column in the picker is the
// only way to put one on the table, and the upgrade step below needs three of them.
import {
  cellText,
  pickColumns,
  resetColumns,
  type GearColumnFixture
} from './gearColumnSteps.mjs'
// JOS-302's class, slot-union and weapon-type steps, likewise.
import { clearPicks, pickIn, stepGearSlotPicks } from './gearFilterSteps.mjs'
import { checkOwnedTierLabel, checkSimulatedTierLabel } from './gearUpgradeLabelSteps.mjs'
// Phase 0's scaler and phase 2's ratio, so the EXPECTED numbers are computed rather than typed.
import { gearRatio, scaleGearRow } from '../../src/shared/planner/gearScale'
import type { GearRow } from '../../src/shared/planner/gear'
import type { ItemUpgradeState } from '../../src/shared/itemUpgrade'

const NAV = '[data-testid="nav-gear"]'
/**
 * The area's own tab, and why the entry clicks it as well as the row (JOS-324).
 *
 * `nav-gear` is now the door to FOUR tabs and it opens the one you last used, which is exactly
 * what a person wants and exactly what a spec must not depend on — this file's second launch
 * reuses the first's `userData`, so "whatever was last open" is a value one earlier step could
 * change. Clicking the tab after the row costs nothing and pins the entry.
 */
const TAB = '[data-testid="tab-gear"]'
const VIEW = '[data-testid="gear-view"]'
const LIST = '[data-testid="gear-list"]'
const ROW = '[data-testid="gear-row"]'
const COUNT = '[data-testid="gear-count"]'
const EMPTY = '[data-testid="gear-empty"]'
const SEARCH = '[data-testid="gear-search"] input'
const ERA_TOGGLE = '[data-testid="gear-era-toggle"]'
// The slot picker's own selector moved to `gearFilterSteps.mts` with the step that drives it. It is
// still `gear-slot` — a ChipMultiSelect wearing a single-select's testid, on purpose (JOS-302).
const WEAPON_PICKER = '[data-testid="gear-weapon"]'
const SORT_RATIO = '[data-testid="gear-sort-RATIO"]'
const TIER_SLIDER = '[data-testid="gear-tier-slider"] input[type="range"]'
const FRACTION_SLIDER = '[data-testid="gear-fraction-slider"] input[type="range"]'
const UPGRADE_LABEL = '[data-testid="gear-upgrade-label"]'
// ---- phase 4 (JOS-285) ----
const OWNED_TOGGLE = '[data-testid="gear-owned-toggle"]'
const OWNED_HEADER = '[data-testid="gear-owned-header"]'
const OWNED_CELL = '[data-testid="gear-cell-owned"]'
const DUMP_LINE = '[data-testid="gear-dump-line"]'
/** The row key every index in this app joins on — and, from phase 4, the ownership join key. */
const THELVORN_KEY = 'thelvorn, blade of light'

/**
 * The dump the app is handed, and the two rows read out of it.
 *
 * `Thelvorn, Blade of Light +5` is on Primary and `Thelvorn, Blade of Light (Exaltation)` is in
 * one of its sockets — so `Equipped +5` is also the assertion that the exaltation row did NOT
 * become a second copy (gearOwnership.ts, rule 2).
 */
const THELVORN_OWNED = 'Equipped +5'
/** The one key ring the fold does not count, and the word its exclusion has to be stated in. */
const UNCOUNTED_RING = 'Activated'

/**
 * THE SECOND WITNESS: an item the corpus has, the dump does NOT name, and the LOG will. Secondary
 * slot and Classic era, so neither the era toggle nor a slot filter can hide it from this spec.
 */
const LOOTED_ITEM = 'Shiny Brass Shield'
const LOOTED_KEY = 'shiny brass shield'

/**
 * Thelvorn's BASE vector, exactly as `tests/gearIndex.test.mts` asserts the corpus states it. Only
 * the fields the scaler reads are filled in; everything else is what a `GearRow` requires.
 */
const THELVORN_BASE: GearRow = {
  key: THELVORN_KEY,
  name: 'Thelvorn, Blade of Light',
  searchKey: THELVORN_KEY,
  slots: ['PRIMARY'],
  classes: ['PAL'],
  races: ['ALL'],
  flags: [],
  quest: false,
  playerCrafted: false,
  stats: { WIS: 15, DMG: 20, DELAY: 26, WEIGHT: 3 },
  effects: []
}

/** "Tier 2   3 / 4" — the owner screenshot every phase-0 number in this repo is verified against. */
const CHECKPOINT: ItemUpgradeState = { full: 2, fraction: 3 }

/**
 * WHAT JOS-297's STEPS ARE TOLD (gearColumnSteps.mts) — the same row again, plus the plus-state the
 * upgrade step leaves the global selector at, so the picker's own numbers assertion can compute its
 * expectation from `scaleGearRow` exactly as `expectedAt` does below.
 */
const COLUMNS: GearColumnFixture = { row: THELVORN_BASE, state: CHECKPOINT }

const until = (fn: () => Promise<boolean>, ms: number): Promise<boolean> => settle(fn, (ok) => ok, { timeoutMs: ms })

const textOf = (page: Page, sel: string): Promise<string> =>
  page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.innerText ?? '', sel)

/** Box + scroll geometry — enough to prove a growing list is a BOUNDED scroller. */
function boxOf(page: Page, sel: string): Promise<{ h: number; scrollH: number; clientH: number } | null> {
  return page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) return null
    return { h: Math.round(el.getBoundingClientRect().height), scrollH: el.scrollHeight, clientH: el.clientHeight }
  }, sel)
}

/** `"212 of 6,814 items"` → `[212, 6766]`. The readout is the only place the total is stated. */
async function counts(page: Page): Promise<{ shown: number; total: number }> {
  const text = await textOf(page, COUNT)
  const nums = [...text.matchAll(/[\d,]+/g)].map((m) => Number(m[0].replace(/,/g, '')))
  return { shown: nums[0] ?? 0, total: nums[1] ?? 0 }
}

// `cellText` — one numeric cell of one row, as text, where `''` covers both "the row is not on
// screen" and "the item states none" — now comes from gearColumnSteps.mjs (imported above). It
// lived here AND there, byte for byte, until JOS-324 needed four lines of budget in this file.

/** Type into a filter box and let the DEFERRED filter land — the count settling IS the condition. */
async function typeAndSettle(page: Page, sel: string, value: string): Promise<number> {
  await page.fill(sel, value, { timeout: 15_000 })
  let last = -1
  await settle(
    async () => {
      const { shown } = await counts(page)
      const stable = shown === last
      last = shown
      return stable
    },
    (ok) => ok,
    { timeoutMs: 15_000 }
  )
  return last
}

/** 1. THE NAV ROW MOUNTS THE TABLE — with nothing selected first. That is the owner's ruling. */
async function stepMount(page: Page): Promise<boolean> {
  const hasRow = await page.waitForSelector(NAV, { timeout: 60_000 }).then(
    () => true,
    () => false
  )
  if (!check('the nav drawer has a Gear row', hasRow)) return false
  // CASE-INSENSITIVE ON PURPOSE. `innerText` reports RENDERED text, and the 2026-09-06 theme
  // rework sets `text-transform: uppercase` on the nav rail's labels (NavDrawer.tsx), so this
  // reads "GEAR beta". The claim is the row's NAME; its casing belongs to the theme.
  const label = (await textOf(page, NAV)).replace(/\s+/g, ' ').trim()
  check('…and it is called Gear', /gear/i.test(label), `reads "${label}"`)
  await page.click(NAV, { timeout: 15_000 })

  // …and the area it opens offers Gear as its FIRST tab (JOS-324). See TAB above for why the spec
  // clicks it rather than trusting the row's last-used memory.
  const hasTab = await until(async () => (await countOf(page, TAB)) > 0, 30_000)
  if (!check('…and the row opens an area whose first tab is Gear', hasTab)) return false
  await page.click(TAB, { timeout: 15_000 })

  const mounted = await until(async () => (await countOf(page, VIEW)) > 0, 30_000)
  if (!mounted) {
    const noLogs = (await textOf(page, 'main')).includes('No EverQuest logs found')
    check('clicking Gear mounts the table (or the no-logs empty state explains why not)', noLogs)
    if (noLogs) note('no character logs on this machine — the app shows its fresh-machine empty state')
    return false
  }
  check('clicking the Gear nav row mounts the table with no plan and no selection first', mounted)
  return true
}

/** 2. THE TABLE IS THE COMMITTED CORPUS, IN A BOUNDED SCROLLER. */
async function stepRows(page: Page): Promise<boolean> {
  const listed = (await settleCount(page, ROW, 1, { timeoutMs: 60_000 })) > 0
  if (!check('the gear table renders rows from the committed item index', listed, await textOf(page, EMPTY))) {
    return false
  }
  const { shown, total } = await counts(page)
  check(
    'the table states how much of the index it is showing',
    total >= 6000 && shown > 0 && shown <= total,
    `${String(shown)} of ${String(total)}`
  )
  // WINDOWED: the mounted rows are a screenful, not the answer — the count readout is the answer.
  const mounted = await countOf(page, ROW)
  check(
    'the list is windowed — the DOM holds a screenful, never the whole result',
    mounted < shown || shown < 60,
    `${String(mounted)} rows mounted for ${String(shown)} matches`
  )
  const box = await boxOf(page, LIST)
  check(
    'the gear list is its own scroller (a growing list never grows the page)',
    box !== null && box.h > 0 && box.scrollH >= box.clientH,
    box ? `${String(box.h)}px tall · scrollHeight ${String(box.scrollH)} vs clientHeight ${String(box.clientH)}` : 'absent'
  )
  return true
}

/**
 * 3. THE ERA TOGGLE HOLDS ROWS BACK — asserted as an IDENTITY, never as a number.
 *
 * The committed corpus documents every expansion, so "off shows more" is a fact about the wiki
 * rather than about today's scrape. It is turned OFF and LEFT off: Thelvorn's era is the corpus's
 * business, and a later step reading its numbers must not depend on that verdict.
 */
async function stepEra(page: Page): Promise<void> {
  const before = (await counts(page)).shown
  await page.click(ERA_TOGGLE, { timeout: 15_000 })
  const grew = await until(async () => (await counts(page)).shown > before, 15_000)
  const after = (await counts(page)).shown
  check(
    'the Current era filter is ON by default and switching it off reveals more of the corpus',
    grew,
    `${String(before)} in era → ${String(after)} in total`
  )
}

/**
 * 3b. THE OWNERSHIP JOIN — the phase this ticket exists for, read off two different transports.
 *
 * The dump half is already on disk when the app launches, so its assertion is simply what the cell
 * says. The LOG half is written here, while the app is up, and travels chokidar → Tailer → parser
 * → loot module → delta → the join's memo: an item the dump does not name reads `Looted`, which is
 * the answer JOS-285 asked for and the one a wiki tab can never give.
 */
async function stepOwnedCells(page: Page, log: FixtureLog): Promise<void> {
  // The `/outputfile` freshness line, RE-USED rather than restated: this tab renders JOS-253/268's
  // own component, so the dump's two instants have exactly one author on this screen.
  check('the Gear tab carries the /outputfile freshness line rather than its own age', (await countOf(page, DUMP_LINE)) === 1)

  await typeAndSettle(page, SEARCH, 'thelvorn')
  const owned = await cellText(page, THELVORN_KEY, 'owned')
  check(
    'a row the staged dump names says WHERE it is and at what +N',
    owned === THELVORN_OWNED,
    `reads "${owned}", wanted "${THELVORN_OWNED}"`
  )
  // The same row has a `(Exaltation)` child in the dump. One copy, not two — rule 2 of the join.
  check('…and the item`s own (Exaltation) row did not become a second copy', !owned.includes(' · '), owned)

  const hint = await page.getAttribute(OWNED_HEADER, 'title', { timeout: 15_000 })
  check(
    'the Owned header admits which key rings the fold does not count - "not counted" is not "not owned"',
    (hint ?? '').includes(UNCOUNTED_RING),
    (hint ?? '').slice(-160)
  )

  // THE SECOND WITNESS, written into the very log the app is tailing.
  log.append(`--You have looted a ${LOOTED_ITEM} from a decaying skeleton corpse.--`)
  await typeAndSettle(page, SEARCH, LOOTED_ITEM)
  const looted = await until(async () => (await cellText(page, LOOTED_KEY, 'owned')) === 'Looted', 30_000)
  check(
    'an item the LOG saw looted and the dump does not name reads Looted, live',
    looted,
    `reads "${await cellText(page, LOOTED_KEY, 'owned')}"`
  )
}

/**
 * 3c. THE OWNER'S CHECKBOX. Asserted as an IDENTITY and an INVARIANT, never as a number: the
 * corpus grows, so what is pinned is that the filter removes rows, keeps only rows the join can
 * say something about, and is fully reversible.
 */
async function stepOwnedFilter(page: Page): Promise<void> {
  const all = await typeAndSettle(page, SEARCH, '')
  await page.click(OWNED_TOGGLE, { timeout: 15_000 })
  const narrowed = await until(async () => (await counts(page)).shown < all, 15_000)
  const shown = (await counts(page)).shown
  check(
    'Owned narrows the corpus to copies in the inventory dump',
    narrowed && shown > 0,
    `${String(all)} in era → ${String(shown)} owned`
  )

  // THE INVARIANT: every surviving row has something to say. A blank Owned cell under this filter
  // would mean a row got through that the join knows nothing about.
  const blanks = await page.evaluate(
    (sel) => [...document.querySelectorAll(sel)].filter((c) => (c as HTMLElement).innerText.trim() === '').length,
    OWNED_CELL
  )
  check('every row the filter keeps states where it is', blanks === 0, `${String(blanks)} blank`)

  // The looted-but-not-in-the-dump arm — the one the checkbox exists for, and the one an ownership
  // index alone cannot answer.
  await typeAndSettle(page, SEARCH, LOOTED_ITEM)
  check('a looted item absent from the dump does not survive the Owned filter', (await countOf(page, `${ROW}[data-item-key="${LOOTED_KEY}"]`)) === 0)

  // …and something neither witness has ever seen is gone, and comes back when the filter is off.
  await typeAndSettle(page, SEARCH, 'fungus covered scale tunic')
  const hiddenWhenOn = await countOf(page, ROW)
  await page.click(OWNED_TOGGLE, { timeout: 15_000 })
  const backWhenOff = await until(async () => (await countOf(page, ROW)) > 0, 15_000)
  check(
    'an item neither the dump nor the log has seen is hidden by the filter and returns without it',
    hiddenWhenOn === 0 && backWhenOff,
    `${String(hiddenWhenOn)} rows with the filter on`
  )
  await typeAndSettle(page, SEARCH, '')
  check('…and turning it off restores the whole corpus', (await counts(page)).shown === all)
}

/** 4. SEARCH NARROWS THE TABLE, and it finds an item by name. */
async function stepSearch(page: Page): Promise<boolean> {
  const total = (await counts(page)).shown
  const shown = await typeAndSettle(page, SEARCH, 'thelvorn')
  check('typing narrows the table', shown > 0 && shown < total, `${String(shown)} of ${String(total)}`)
  const found = await countOf(page, `${ROW}[data-item-key="${THELVORN_KEY}"]`)
  check('…to the item that was typed, keyed by the corpus join key', found === 1, `${String(found)} matching rows`)
  return found === 1
}

/**
 * 5. THE SLOT PICKER, AND A SECOND FILTER ON TOP OF IT.
 *
 * IT USED TO BE "a stat threshold and a slot filter combine", and the fourth owner ask (JOS-302)
 * deleted the threshold half outright — the typed-chip step, the "every surviving row states the
 * stat" step and the "the stat asked about gets a column" step with it. The replacement is the same
 * claim over controls that still exist: the slot picks AND with the weapon type, and the picker
 * (not a threshold) is what puts a stat on the table.
 *
 * The union half of the slot picker lives in `gearFilterSteps.stepGearSlotPicks` — a module for the
 * line budget, not because it is a different subject. It leaves exactly one slot picked, which is
 * the state the steps below were written against, and returns the count that narrowing produced.
 */
async function stepFilters(page: Page): Promise<void> {
  await typeAndSettle(page, SEARCH, '')
  const all = (await counts(page)).shown
  const afterSlot = await stepGearSlotPicks(page, all)

  await pickIn(page, WEAPON_PICKER, 'One-handed')
  const combined = await until(async () => (await counts(page)).shown < afterSlot, 15_000)
  const afterBoth = (await counts(page)).shown
  check(
    'two filters COMBINE — slot AND weapon type, never one replacing the other',
    combined && afterBoth > 0,
    `${String(afterSlot)} primaries → ${String(afterBoth)} that are also one-handers, of ${String(all)}`
  )
  // …and the second one comes back off, leaving the PRIMARY narrowing the steps below expect.
  await clearPicks(page, WEAPON_PICKER)
  check(
    '…and dropping the second leaves the first exactly as it was',
    await until(async () => (await counts(page)).shown === afterSlot, 15_000),
    `${String((await counts(page)).shown)} of ${String(afterSlot)}`
  )
}

/** 6. SORTING BY RATIO IS MONOTONE, and it reads `gearRatio` rather than a second opinion. */
async function stepSort(page: Page): Promise<void> {
  await page.click(SORT_RATIO, { timeout: 15_000 })
  const ratios = await until(async () => {
    const values = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="gear-cell-RATIO"]')]
        .map((c) => (c as HTMLElement).innerText.trim())
        .filter((t) => t !== '')
    )
    return values.length > 1
  }, 15_000)
  if (!check('sorting by ratio leaves weapons on screen with ratios to compare', ratios)) return

  const values = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="gear-cell-RATIO"]')].map((c) => (c as HTMLElement).innerText.trim())
  )
  const numbers = values.filter((t) => t !== '').map(Number)
  const descending = numbers.every((n, i) => i === 0 || numbers[i - 1] >= n)
  check(
    'a ratio sort ranks the visible rows highest first',
    descending,
    numbers.slice(0, 5).map((n) => n.toFixed(2)).join(' ')
  )
  // …and NOTHING that lacks a ratio is ranked among them: an absent value sorts last, never as 0.
  const firstBlank = values.indexOf('')
  check(
    'a row with no ratio never outranks one that has a ratio',
    firstBlank === -1 || values.slice(firstBlank).every((t) => t === ''),
    `first blank at ${String(firstBlank)} of ${String(values.length)}`
  )
}

/** Focus a slider and drive it with the keyboard — the same path the control gives a user. */
async function driveSlider(page: Page, sel: string, keys: readonly string[]): Promise<void> {
  await page.focus(sel, { timeout: 15_000 })
  for (const key of keys) await page.press(sel, key, { timeout: 15_000 })
}

/** What `scaleGearRow` says this row reads at one state — the expectation, computed not typed. */
function expectedAt(state: ItemUpgradeState): { dmg: string; wis: string; ratio: string } {
  const s = scaleGearRow(THELVORN_BASE, state).stats
  return { dmg: String(s.DMG), wis: String(s.WIS), ratio: gearRatio(s)?.toFixed(2) ?? '' }
}

/** The three cells this step is about, read off the screen. */
async function screenAt(page: Page): Promise<{ dmg: string; wis: string; ratio: string }> {
  return {
    dmg: await cellText(page, THELVORN_KEY, 'DMG'),
    wis: await cellText(page, THELVORN_KEY, 'WIS'),
    ratio: await cellText(page, THELVORN_KEY, 'RATIO')
  }
}

/**
 * Tier 0 → 2 (Home, then two steps), then every banked point of that tier (End on the fraction
 * slider, whose maximum IS 2^full - 1). Keyboard rather than a drag: same control, same handler,
 * no pixel arithmetic to get wrong.
 */
async function setCheckpoint(page: Page): Promise<void> {
  await driveSlider(page, TIER_SLIDER, ['Home', 'ArrowRight', 'ArrowRight'])
  const fractionAppeared = await until(async () => (await countOf(page, FRACTION_SLIDER)) > 0, 10_000)
  check('a tier with exp to bank offers the fraction slider beside it', fractionAppeared)
  if (fractionAppeared) await driveSlider(page, FRACTION_SLIDER, ['End'])

  const label = (await textOf(page, UPGRADE_LABEL)).replace(/\s+/g, ' ').trim()
  const says = label.includes('Tier 2') && label.includes('3/4') && label.includes('+27.5%')
  check('the selector says what it is simulating, in the item window’s own words', says, label)
}

/**
 * 7. THE GLOBAL PLUS-STATE SELECTOR — the one this phase exists for.
 *
 * The table is narrowed to Thelvorn, its three columns are ASKED FOR BY NAME in the columns picker,
 * and the cells are read TWICE: at base, and at the owner's checkpoint (tier 2 + 3/4). Both
 * readings are compared against `scaleGearRow`'s own answer, computed here — so what is pinned is
 * that the screen and phase 0 agree, not a number somebody typed into a spec.
 *
 * THE COLUMNS USED TO ARRIVE BY THRESHOLD (`dmg 1`, `wis 10` derived them as a side effect), and
 * JOS-302 deleted the thresholds. Naming them in the picker is strictly better for this step: it
 * needed the COLUMNS and never the narrowing, and a floor of `dmg 1` was always a filter that had
 * to be proved harmless before the assertion could trust it.
 */
async function stepUpgrade(page: Page): Promise<void> {
  // ONLY THE TWO THAT ARE NOT ALREADY THERE. The picker's first click PROMOTES the derived seed
  // (`toggleColumn(base, key)` where base is what the checkboxes were showing), so picking DMG and
  // WIS adds them to the core four — and picking RATIO, which IS one of the core four, would toggle
  // it OFF and leave `screenAt` reading a blank ratio cell. Measured, not assumed: that is exactly
  // what the first run of this step did.
  await pickColumns(page, ['DMG', 'WIS'])
  await typeAndSettle(page, SEARCH, 'thelvorn')
  const onScreen = (await countOf(page, `${ROW}[data-item-key="${THELVORN_KEY}"]`)) === 1
  if (!check('the upgrade step has its row, with the three columns it asked the picker for', onScreen)) return

  const base = expectedAt({ full: 0, fraction: 0 })
  const atBase = await screenAt(page)
  check(
    'at base the table states the corpus’s own numbers',
    atBase.dmg === base.dmg && atBase.wis === base.wis,
    `screen DMG ${atBase.dmg} WIS ${atBase.wis} ratio ${atBase.ratio}`
  )

  await setCheckpoint(page)

  const want = expectedAt(CHECKPOINT)
  await until(async () => (await cellText(page, THELVORN_KEY, 'DMG')) === want.dmg, 15_000)
  const got = await screenAt(page)
  check(
    'moving the global selector restates every displayed number at that plus — scaleGearRow’s answer, exactly',
    got.dmg === want.dmg && got.wis === want.wis && got.ratio === want.ratio,
    `screen ${got.dmg}/${got.wis}/${got.ratio} · scaleGearRow ${want.dmg}/${want.wis}/${want.ratio}`
  )
  // DELAY never scales, which is the whole reason the ratio moved — 0.77 at base, 0.96 here.
  check('…and the ratio moved because the damage did and the delay did not', want.ratio !== base.ratio, `${base.ratio} → ${want.ratio}`)
  await page.click('[data-testid="gear-owned-stats-toggle"]')
  const owned = expectedAt({ full: 5, fraction: 0 })
  const ownedScreen = await until(async () => { const reading = await screenAt(page); return reading.dmg === owned.dmg && reading.wis === owned.wis && reading.ratio === owned.ratio }, 15_000)
  check('owned stats use the inventory tier instead of the slider', ownedScreen)
  await checkOwnedTierLabel(page, THELVORN_KEY)
  const unownedKey = 'zraxthril forged flamberge' // Primary, not in the inventory fixture, base damage 9.
  await typeAndSettle(page, SEARCH, unownedKey)
  const unownedVisible = await until(async () => (await countOf(page, `${ROW}[data-item-key="${unownedKey}"]`)) === 1, 15_000)
  const simulatedDamage = String(scaleGearRow({ ...THELVORN_BASE, stats: { DMG: 9 } }, CHECKPOINT).stats.DMG)
  check('unowned primary uses simulated damage with owned stats enabled', unownedVisible && (await cellText(page, unownedKey, 'DMG')) === simulatedDamage && ['', 'Looted'].includes(await cellText(page, unownedKey, 'owned')))
  await checkSimulatedTierLabel(page, unownedKey)
  check('unowned item keeps simulated damage after switching owned stats off', (await cellText(page, unownedKey, 'DMG')) === simulatedDamage)
  await typeAndSettle(page, SEARCH, 'thelvorn')
  check('turning owned stats off restores the simulation', await until(async () => (await cellText(page, THELVORN_KEY, 'DMG')) === want.dmg, 15_000))
  // HAND THE COLUMNS BACK TO THE DERIVATION. `stepGearColumns` below starts from whatever choice it
  // is handed and TOGGLES, so a list left here would silently un-pick two of the keys it picks.
  await resetColumns(page)
}


export { COLUMNS, THELVORN_BASE, stepMount, stepRows, stepEra, stepOwnedCells, stepOwnedFilter,
  stepSearch, stepFilters, stepSort, stepUpgrade, setCheckpoint }
