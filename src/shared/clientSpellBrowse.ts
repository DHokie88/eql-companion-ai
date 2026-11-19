import { clientSpellTargetCap, type SpellMechanicsCatalog } from './clientSpellMechanics'
import { hasRepeatedWaveTiming } from './clientSpellDelivery'
import type { ClientSpellClass, ClientSpellRecord, SpellBrowseSort, SpellBrowseType, SpellCalculation, SpellClass, SpellSortDirection, SpellSummary } from './spellLibrary'

export const SPELL_TYPE_LABELS: Record<SpellBrowseType, string> = { dd: 'DD', dot: 'DoT', aoe: 'AOE', rain: 'RAIN', aoe4: 'AOE4', aoe8: 'AOE8', heal: 'Heal', hot: 'HoT', other: 'Buffs / utility' }
// Client target codes, shared with the complete parser's target-name vocabulary.
const AREA_TARGETS = new Set([2, 4, 8, 20, 24, 25, 32, 36, 37, 40, 42, 44, 45, 50])
const spellCollator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

/**
 * Lowest listed class level in scope. An empty class list is unknown or NPC, not level 0.
 * The parser omits client column 0 (cannot use) and 255, so a stored 0 is the only level-less row.
 */
export function minimumSpellLevel(entries: ClientSpellClass[], classes: readonly SpellClass[]): number | null {
  const eligible = entries.filter((entry) => !classes.length || classes.includes(entry.code))
  return eligible.length ? Math.min(...eligible.map((entry) => entry.level)) : null
}

export function clientSpellType(record: ClientSpellRecord, mechanics?: SpellMechanicsCatalog): SpellBrowseType {
  const sign = record.beneficial ? 1 : -1
  const hp = record.effects.filter((effect) => [0, 79, 100, 101, 334].includes(effect.spa) && effect.base * sign > 0)
  if (!hp.length) return 'other'
  const periodic = hp.some((effect) => effect.spa === 100 || (effect.spa === 0 && record.durationFormula !== 0))
  if (record.beneficial) return periodic ? 'hot' : 'heal'
  if (periodic) return 'dot'
  if (!AREA_TARGETS.has(record.target)) return 'dd'
  return directAreaType(record, mechanics)
}

function directAreaType(record: ClientSpellRecord, catalog?: SpellMechanicsCatalog): SpellBrowseType {
  const mechanics = catalog?.resolve(record)
  if (mechanics && !mechanics.reason && mechanics.waves > 1) return 'rain'
  if (hasRepeatedWaveTiming(record) || mechanics?.reason) return 'aoe'
  const cap = clientSpellTargetCap(record)
  return cap === null || cap > 2147483647 ? 'aoe' : `aoe${cap}`
}

export function matchesSpellType(record: ClientSpellRecord, type: SpellBrowseType, mechanics?: SpellMechanicsCatalog): boolean {
  const kind = clientSpellType(record, mechanics)
  if (type === 'dd') return kind === 'dd' || kind === 'rain' || kind.startsWith('aoe')
  if (/^aoe[1-9]\d*$/.test(type)) return AREA_TARGETS.has(record.target) && directAreaType(record, mechanics) === type
  if (type === 'aoe') return !record.beneficial && kind !== 'other' && AREA_TARGETS.has(record.target)
  return kind === type
}

export function spellTypeLabel(type: SpellBrowseType): string { return SPELL_TYPE_LABELS[type] ?? type.toUpperCase() }

/** Delivery geometry is separate from HP type: an area mez remains Buffs / utility. */
export function clientSpellTypeLabel(record: ClientSpellRecord, mechanics?: SpellMechanicsCatalog): string {
  const hpType = clientSpellType(record, mechanics)
  if (hpType === 'dot' && AREA_TARGETS.has(record.target)) {
    const cap = clientSpellTargetCap(record)
    return `${cap === null ? 'AoE' : `AoE${cap}`} DoT`
  }
  const type = AREA_TARGETS.has(record.target) ? directAreaType(record, mechanics) : clientSpellType(record, mechanics)
  return type === 'aoe' ? 'AOE ?' : spellTypeLabel(type)
}

/** Unknown values sort last in either direction; numeric IDs break ties across pages. */
export function compareSpellValues(a: string | number | null, b: string | number | null, direction: SpellSortDirection): number {
  if (a === null) return b === null ? 0 : 1
  if (b === null) return -1
  const result = typeof a === 'number' && typeof b === 'number' ? a - b : spellCollator.compare(String(a), String(b))
  return direction === 'asc' ? result : -result
}

/**
 * Class/Level sort key for the full result, before pagination.
 * One selected class uses that class's own requirement.
 * Several different requirements and no single selected class sort as unknown (null), after every comparable row.
 * Equal keys stay tied so the caller can break them with the numeric id.
 */
export function spellBrowseClassSortValue(record: SpellSummary, classes: readonly SpellClass[] = []): string | null {
  const scope = classes.length ? record.classes.filter((entry) => classes.includes(entry.code)) : record.classes
  if (!scope.length) return null
  const level = scope[0].level
  if (classes.length !== 1 && scope.some((entry) => entry.level !== level)) return null
  const ordered = classes.length === 1 ? [scope[0]] : [...scope].sort((a, b) => a.code.localeCompare(b.code))
  // Three digits keep level 8 before 58. compareSpellValues orders this one string in either direction.
  return `${ordered.map((entry) => entry.code).join(' / ')} ${String(ordered[0].level).padStart(3, '0')}`
}

export function spellBrowseSortValue(record: SpellSummary, field: SpellBrowseSort, selected: ReadonlySet<number>, classes: readonly SpellClass[] = []): string | number | null {
  if (field === 'amount' || field === 'efficiency') return summaryCalculationValue(record, field)
  if (field === 'classes') return spellBrowseClassSortValue(record, classes)
  if (field === 'description') return record.description ?? null
  return recordSortValue(record, field, selected)
    ?? analysisSortValue(record, field)
}
function summaryCalculationValue(record: SpellSummary, field: 'amount' | 'efficiency'): number | null {
  const calculation = record.calculations?.[0]
  return calculation?.[field === 'amount' ? 'total' : 'perMana'] ?? null
}
function summaryTypeLabel(record: SpellSummary): string | null {
  return record.typeLabel ?? (record.spellType ? spellTypeLabel(record.spellType) : null)
}
function recordSortValue(record: SpellSummary, field: Exclude<SpellBrowseSort, 'amount' | 'efficiency' | 'classes'>, selected: ReadonlySet<number>): string | number | null {
  switch (field) {
    case 'id': return record.id
    case 'name': return record.name
    case 'level': return record.learnedLevel ?? null
    case 'category':
    case 'subcategory': return record[field] || null
    case 'type': return summaryTypeLabel(record)
    case 'mana': return summaryMana(record)
    case 'selected': return Number(selected.has(record.id))
    default: return null
  }
}
function summaryMana(record: SpellSummary): number { return record.calculations?.[0]?.mana ?? record.mana }


function timingSortValues(record: SpellSummary): Partial<Record<SpellBrowseSort, number | null | undefined>> {
  const timing = record.calculations?.[0]?.analysis?.timing
  return { rate: timing?.rate, cast: timing?.castMs ?? record.castMs, recovery: timing?.recoveryMs ?? record.recoveryMs,
    recast: timing?.recastMs ?? record.recastMs, duration: timing?.deliveryMs }
}
function analysisSortValue(record: SpellSummary, field: SpellBrowseSort): number | null {
  const calculation = record.calculations?.[0], analysis = calculation?.analysis
  const values: Partial<Record<SpellBrowseSort, number | null | undefined>> = {
    ...timingSortValues(record), ticks: calculation?.ticks, waves: analysis?.waves,
    targets: analysis?.effectiveTargets, hits: analysis?.hits
  }
  return values[field] ?? null
}

export type SpellCalculationSort = 'name' | 'instant' | 'perTick' | 'total' | 'mana' | 'perMana' | 'scope' | 'rate'
function calculationSortValue(row: SpellCalculation, column: SpellCalculationSort): string | number | null {
  if (column === 'rate') return row.analysis?.timing.rate ?? null
  return column === 'scope' ? [...row.reasons, ...row.restrictions].join(' ') : row[column]
}
/** Presentation ordering for an already-selected comparison or globally-ranked result group. */
export function sortSpellCalculations(rows: SpellCalculation[], field: SpellCalculationSort, direction: SpellSortDirection): SpellCalculation[] {
  return [...rows].sort((a, b) => compareSpellValues(calculationSortValue(a, field), calculationSortValue(b, field), direction) || a.id - b.id)
}
