// itemUpgrade.ts — what an item's stat block reads at any ` +N` upgrade state.
//
// Based on the EQL Wiki's MIT-licensed shared scaling rules, revision 4. See
// itemScaling/README.md for the pinned source, observed fixtures and unsupported fields.
//
// ============================================================================
// THE STATE
// ============================================================================
// An upgrade state is the in-game item window's `Tier N   x / y` row:
//   full     = N, the tier, 0..10
//   fraction = x, merge exp banked toward the next tier, 0 .. 2^full - 1  (y IS 2^full,
//              which `itemStats.expToNextTier` already states — one home for that curve)
// so effectiveLevel = full + fraction / 2^full, the percent label is effectiveLevel * 10,
// and totalProgression = 2^full + fraction (the argument the WEIGHT curve takes, and the
// only place fraction enters a non-linear term). Tier 10 is the cap and banks nothing, so
// there are exactly 1024 reachable states: Σ(2^full for full 0..9) + 1.
//
import rules from './itemScaling/rules.json'
import type { ItemStat, ItemStatBlock } from './itemStats'
import { ITEM_MAX_TIER } from './itemStats'

// ---- state ---------------------------------------------------------------------

/** The in-game `Tier N   x / y` row: `full` = N, `fraction` = x (and y is always 2^full). */
export interface ItemUpgradeState {
  full: number
  fraction: number
}

export const ITEM_UPGRADE_BASE: ItemUpgradeState = { full: 0, fraction: 0 }

/** Total number of reachable states (0..9 with their fractions, plus the capped tier 10). */
export const ITEM_UPGRADE_STATE_COUNT = 1024

/**
 * The only legal spelling of a state: `full` an integer in 0..10, `fraction` an integer in
 * 0 .. 2^full - 1, and FORCED to 0 at both ends — tier 0 has no denominator to bank against
 * and tier 10 is the cap, so neither can carry partial exp. Everything downstream may assume
 * a normalized state; `scaleStatBlock` normalizes what it is handed.
 */
export function normalizeUpgradeState(state: ItemUpgradeState): ItemUpgradeState {
  const full = Math.min(ITEM_MAX_TIER, Math.max(0, Math.trunc(state.full) || 0))
  if (full === 0 || full === ITEM_MAX_TIER) return { full, fraction: 0 }
  const max = 2 ** full - 1
  return { full, fraction: Math.min(max, Math.max(0, Math.trunc(state.fraction) || 0)) }
}

/**
 * THE ONE READING OF A ` +N` THE GAME WROTE DOWN (JOS-416).
 *
 * An inventory dump — and an item name anywhere else the client prints one — states the TIER and
 * stops: the `x / y` half of the item window's row is in no file this app can read. So a name that
 * says ` +5` is `{full: 5, fraction: 0}`, and a name that says nothing at all is the BASE state
 * rather than a guess. That makes every number derived from it a FLOOR on what the item really
 * reads, which is the only safe direction, and it is written here — not at each call site — so the
 * Character sheet's gear sum and the Gear tab's comparison cannot drift into two readings of the
 * same suffix.
 *
 * `undefined` is "the name carried no suffix", NEVER tier 0 arriving by another road; both answer
 * `ITEM_UPGRADE_BASE` because an un-upgraded item and an item at tier 0 read identically.
 */
export function upgradeStateForTier(tier: number | undefined): ItemUpgradeState {
  return tier === undefined ? ITEM_UPGRADE_BASE : normalizeUpgradeState({ full: tier, fraction: 0 })
}

/** `full + fraction / 2^full` — the slider's position, and the multiplier every stat reads. */
export function effectiveLevel(state: ItemUpgradeState): number {
  const s = normalizeUpgradeState(state)
  return s.full + s.fraction / 2 ** s.full
}

/** `2^full + fraction` — merge exp banked in total. Only the WEIGHT curve consumes it. */
export function totalProgression(state: ItemUpgradeState): number {
  const s = normalizeUpgradeState(state)
  return 2 ** s.full + s.fraction
}

/** The headline percentage: `effectiveLevel * 10` (tier 2 + 3/4 → 27.5). */
export function upgradePercent(state: ItemUpgradeState): number {
  return effectiveLevel(state) * 10
}

/** `upgradePercent` as the window draws it: `+27.5%`, `+30%`, `+100%`. */
export function percentLabel(state: ItemUpgradeState): string {
  return `+${Number(upgradePercent(state).toFixed(3)).toString()}%`
}

// ---- rounding helpers -----------------------------------------------------------

/** Round half AWAY FROM ZERO at `digits` decimals (Excel's ROUND, not `Math.round`). */
export function excelRound(value: number, digits = 0): number {
  const f = 10 ** digits
  const x = value * f
  return (x < 0 ? -Math.round(-x) : Math.round(x)) / f
}

/** Ceil AWAY FROM ZERO at `digits` decimals (Excel's ROUNDUP). */
export function excelRoundUp(value: number, digits = 0): number {
  const f = 10 ** digits
  return (value < 0 ? -Math.ceil(-value * f) : Math.ceil(value * f)) / f
}

// ---- stat keys ------------------------------------------------------------------

/**
 * How a stat key scales. `unchanged` covers fields with no supported rule here, such as
 * heroic stats, Attack, damage bonus, Accuracy and effect magnitudes.
 */
export type UpgradeStatClass = 'primary' | 'flat' | 'damage' | 'backstab' | 'range' | 'delay' | 'weight' | 'accuracy' | 'unchanged'

/**
 * Key aliases match the whole normalized key. A compound name such as `MANA REGEN`
 * stays distinct from `MANA`, and `HEROIC STR` stays distinct from `STR`.
 */
const KEY_ALIASES = new Map([
    ['MANA_REGEN', 'MANA_REGEN'],
    ['ENDURANCE', 'END'],
    ['HP_REGEN', 'HP_REGEN'],
    ['END_REGEN', 'END_REGEN'],
    ['ENDURANCE_REGEN', 'END_REGEN'],
    ['DISEASE', 'SV_DISEASE'],
    ['POISON', 'SV_POISON'],
    ['DAMAGE', 'DMG'],
    ['BACKSTAB_DMG', 'BACKSTAB'],
    ['BACKSTAB_DAMAGE', 'BACKSTAB'],
    ['ATK_DELAY', 'DELAY'],
    ['REGEN', 'HP_REGEN'],
    ['ENDUR', 'END'],
    ['MAGIC', 'SV_MAGIC'],
    ['MANA', 'MP'],
    ['FIRE', 'SV_FIRE'],
    ['COLD', 'SV_COLD'],
    ['WT', 'WEIGHT'],
    ['SVVOID', 'SV_VOID'],
    ['VOID', 'SV_VOID'],
    ['RESISTVOID', 'SV_VOID'],
    ['SVCORRUPTION', 'SV_CORRUPTION'],
    ['CORRUPTION', 'SV_CORRUPTION'],
    ['RESISTCORRUPTION', 'SV_CORRUPTION']
])

/** `sv magic` / `SV  MAGIC` / `Mana Regen` → `SV_MAGIC` / `SV_MAGIC` / `MANA_REGEN`. */
export function normalizeStatKey(key: string): string {
  const k = key.trim().toUpperCase().replace(/[\s.-]+/g, '_').replace(/:+$/, '')
  return KEY_ALIASES.get(k) ?? k
}

const PRIMARY_KEYS = new Set([
  'AC', 'STR', 'STA', 'AGI', 'DEX', 'WIS', 'INT', 'CHA', 'HP', 'MP', 'END',
  'SV_FIRE', 'SV_COLD', 'SV_POISON', 'SV_MAGIC', 'SV_DISEASE'
])
const FLAT_KEYS = new Set(['HP_REGEN', 'MANA_REGEN', 'END_REGEN', 'HASTE'])
const VOID_KEYS = new Set(['SV_VOID', 'SV_CORRUPTION'])

/** Which rule a key scales by. Takes a RAW key; normalization happens here. */
export function upgradeStatClass(key: string): UpgradeStatClass {
  const k = normalizeStatKey(key)
  if (k === 'DMG') return 'damage'
  if (k === 'BACKSTAB') return 'backstab'
  if (k === 'RANGE') return 'range'
  if (k === 'DELAY') return 'delay'
  if (k === 'WEIGHT') return 'weight'
  if (k === 'ACCURACY' || k === 'ATK') return 'accuracy'
  if (FLAT_KEYS.has(k)) return 'flat'
  if (PRIMARY_KEYS.has(k) || VOID_KEYS.has(k)) return 'primary'
  return 'unchanged'
}

// ---- the scaling rules ----------------------------------------------------------

/**
 * PRIMARY (AC, the seven attributes, HP/MP/END, and supported saves):
 *   base == 0            → 0            (an absent stat stays absent)
 *   0 < base <= 10       → base + full  (FRACTION IGNORED — this is the "+1 per tier" the
 *                                        old research note mistook for a floor rule)
 *   base > 10            → floor(base + base * effective / 10)
 *   base < 0             → small penalties shrink by the tier, larger ones by their rounded
 *                          proportional increase. Neither crosses zero.
 */
export function scalePrimary(base: number, state: ItemUpgradeState): number {
  const s = normalizeUpgradeState(state)
  if (base === 0 || s.full === 0) return base
  const { smallThreshold, divisor } = rules.primary
  if (base > smallThreshold) return Math.floor(base + base * effectiveLevel(s) / divisor)
  if (base > 0) return base + s.full
  const magnitude = Math.abs(base)
  const recovery = magnitude <= smallThreshold ? s.full : excelRound(magnitude * effectiveLevel(s) / divisor)
  return Math.min(0, base + recovery)
}

/** WEAPON DMG: `base + floor(base * effective / 10)` — +10% per level, and it reads the fraction. */
export function scaleDamage(base: number, state: ItemUpgradeState): number {
  if (base <= 0) return base
  return base + Math.floor(base * effectiveLevel(state) / rules.damage.divisor)
}

/** Backstab follows the wiki's screenshot-derived working model. */
export function scaleBackstab(base: number, state: ItemUpgradeState): number {
  if (base <= 0) return base
  return base + Math.floor(base * effectiveLevel(state) / rules.backstab.divisor)
}

/** A stated numeric range grows by the whole tier. */
export function scaleRange(base: number, state: ItemUpgradeState): number {
  if (base < 0) return base
  return base + rules.range.perTier * normalizeUpgradeState(state).full
}

/** FLAT (the three regens, Haste): `base + full`, fraction ignored. */
export function scaleFlat(base: number, state: ItemUpgradeState): number {
  if (base <= 0) return base
  return base + rules.flat.perTier * normalizeUpgradeState(state).full
}

function decimalParts(value: number): { numerator: number; denominator: number } {
  const [digits, exponent = '0'] = String(value).split('e')
  const [whole, decimal = ''] = digits.split('.')
  const power = decimal.length - Number(exponent)
  return {
    numerator: Number(whole + decimal) * 10 ** Math.max(0, -power),
    denominator: 10 ** Math.max(0, power)
  }
}

const WEIGHT_RATE = decimalParts(rules.weight.perLog2)

/** At a whole tier the coefficient is decimal. Keep it exact through the display ceiling. */
function wholeTierWeight(base: number, full: number, factor: number): number | undefined {
  const weight = decimalParts(base)
  const numerator = weight.numerator * (WEIGHT_RATE.denominator - WEIGHT_RATE.numerator * full) * factor
  const denominator = weight.denominator * WEIGHT_RATE.denominator
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) return undefined
  const remainder = numerator % denominator
  return ((numerator - remainder) / denominator + Number(remainder > 0)) / factor
}

/** Fractional tiers retain the logarithmic curve and the ceiling to a displayed tenth. */
export function scaleWeight(base: number, state: ItemUpgradeState): number {
  const s = normalizeUpgradeState(state)
  const { minimumBase, perLog2, precision } = rules.weight
  if (s.full === 0 || base <= minimumBase) return base
  const factor = 10 ** precision
  const level = s.fraction === 0 ? s.full : Math.log(totalProgression(s)) / Math.LN2
  const exact = s.fraction === 0 ? wholeTierWeight(base, s.full, factor) : undefined
  return Math.max(0, exact ?? Math.ceil(base * (1 - perLog2 * level) * factor) / factor)
}

/**
 * Explicit weapon Accuracy follows the wiki curve. A generated accuracy line is context the
 * item did not state, so it stays at the number the parser already has.
 */
export function scaleAccuracy(base: number, state: ItemUpgradeState, source: 'explicit' | 'generated'): number {
  if (source !== 'explicit') return base
  const s = normalizeUpgradeState(state)
  if (s.full === 0 || !Number.isFinite(base)) return base
  const { perLog2, precision } = rules.accuracy
  const factor = 10 ** precision
  const level = s.fraction === 0 ? s.full : Math.log(totalProgression(s)) / Math.LN2
  return Math.ceil((base + perLog2 * level) * factor) / factor
}

/**
 * A listed Void base scales like any other resist. When the base field is absent and the item
 * qualifies, the rank-based Void line is the one the wiki adds.
 */
export function voidAtTier(listed: number | undefined, state: ItemUpgradeState, qualifies: boolean): number | undefined {
  if (listed !== undefined) return scalePrimary(listed, state)
  const s = normalizeUpgradeState(state)
  if (!qualifies || s.full === 0) return undefined
  return upgradeVoidBonus(state)
}

// ---- SV VOID synthesis ----------------------------------------------------------

/**
 * The wiki grants Void when at least two different qualifying primary or regen values are known.
 * Haste and intrinsic Void do not qualify. A known zero is a value.
 */
const VOID_TRIGGER_KEYS = new Set([...PRIMARY_KEYS, 'HP_REGEN', 'MANA_REGEN', 'END_REGEN'])

/** Whether an upgraded copy of this block gains the synthetic SV VOID line. */
export function synthesizesVoidSave(block: ItemStatBlock, state: ItemUpgradeState): boolean {
  if (normalizeUpgradeState(state).full === 0) return false
  const seen = new Set<string>()
  if (block.ac !== undefined && Number.isFinite(block.ac)) seen.add('AC')
  for (const st of [...block.stats, ...block.saves]) {
    const k = normalizeStatKey(st.key)
    if (VOID_KEYS.has(k)) return false
    if (VOID_TRIGGER_KEYS.has(k) && singleNumber(st.value) !== undefined) seen.add(k)
  }
  return seen.size >= rules.void.minimumQualifiers
}

export function upgradeVoidBonus(state: ItemUpgradeState): number {
  return rules.void.perTier * normalizeUpgradeState(state).full
}

// ---- stat-value text ------------------------------------------------------------

/** `+15` → 15, `36%` → 36, `-5` → -5. `undefined` when the value states no number. */
function statNumber(value: string): number | undefined {
  const m = /-?\d+(?:\.\d+)?/.exec(value)
  return m ? Number(m[0]) : undefined
}

function singleNumber(value: string): number | undefined {
  const match = /^([+-]?\d+(?:\.\d+)?)\s*%?$/.exec(value.trim())
  if (!match) return undefined
  const number = Number(match[1])
  return Number.isFinite(number) ? number : undefined
}

/**
 * Re-render a scaled value in the SOURCE's own spelling: the leading `+` survives only if
 * the item wrote one, and any trailing unit (`%`) is carried across verbatim.
 */
function renderStatValue(source: string, scaled: number): string {
  const hadPlus = /^\s*\+/.test(source)
  const suffix = /\d\s*(%)\s*$/.exec(source)?.[1] ?? ''
  const body = scaled > 0 && hadPlus ? `+${scaled}` : String(scaled)
  return `${body}${suffix}`
}

function scaleStat(stat: ItemStat, state: ItemUpgradeState): ItemStat {
  const cls = upgradeStatClass(stat.key)
  if (cls !== 'primary' && cls !== 'flat') return stat
  const base = statNumber(stat.value)
  if (base === undefined) return stat
  const scaled = cls === 'primary' ? scalePrimary(base, state) : scaleFlat(base, state)
  return scaled === base ? stat : { key: stat.key, value: renderStatValue(stat.value, scaled) }
}

/** WT is stored as TEXT ("3.0"), so an unreadable or unscaled weight survives verbatim. */
function scaleWeightText(weight: string | undefined, state: ItemUpgradeState): string | undefined {
  if (weight === undefined) return undefined
  const base = statNumber(weight)
  if (base === undefined) return weight
  const scaled = scaleWeight(base, state)
  return scaled === base ? weight : scaled.toFixed(1)
}

/** Keep a composite or unknown range intact until its components are understood. */
function scaleRangeText(range: string, state: ItemUpgradeState): string {
  const text = range.trim()
  if (!/^[+-]?\d+$/.test(text)) return range
  const base = Number(text)
  if (!Number.isSafeInteger(base)) return range
  const scaled = scaleRange(base, state)
  return scaled === base ? range : renderStatValue(range, scaled)
}

// ---- the API --------------------------------------------------------------------

/**
 * The same item at `state`. Returns a NEW block; the input is never mutated.
 *
 * DELAY never scales, which is the whole reason a weapon's damage RATIO improves: the ratio
 * a caller draws is `damageRatio(scaled.dmg, scaled.atkDelay)` — scaled DMG over the BASE
 * delay — rendered `.toFixed(2)`, exactly as the item window does (Thelvorn at tier 2 + 3/4
 * is 25/26 = 0.9615… → "0.96"). `toFixed` is round-half-away-from-zero on the decimal
 * representation, which is the same direction as `excelRound`; no separate helper is needed.
 *
 * Everything the reference leaves alone is COPIED, not recomputed: flags, slot, class/race,
 * skill, damage bonus, size, effects, exaltation sockets and `extras`.
 */
export function scaleStatBlock(block: ItemStatBlock, state: ItemUpgradeState): ItemStatBlock {
  const s = normalizeUpgradeState(state)
  const saves = block.saves.map((sv) => scaleStat(sv, s))
  if (synthesizesVoidSave(block, s)) saves.push({ key: 'SV VOID', value: `+${upgradeVoidBonus(s)}` })

  return {
    ...block,
    stats: block.stats.map((st) => scaleStat(st, s)),
    saves,
    ...(block.ac === undefined ? {} : { ac: scalePrimary(block.ac, s) }),
    ...(block.dmg === undefined ? {} : { dmg: scaleDamage(block.dmg, s) }),
    ...(block.backstab === undefined ? {} : { backstab: scaleBackstab(block.backstab, s) }),
    ...(block.range === undefined ? {} : { range: scaleRangeText(block.range, s) }),
    weight: scaleWeightText(block.weight, s),
    flags: [...block.flags],
    effects: [...block.effects],
    exaltationSlots: [...block.exaltationSlots],
    extras: [...block.extras]
  }
}
