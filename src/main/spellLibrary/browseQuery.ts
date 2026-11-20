import type { SpellMechanicsCatalog } from '../../shared/clientSpellMechanics'
import { SPELL_BROWSE_SORTS, type ClientSpellRecord, type SpellBrowseSort, type SpellBrowseType, type SpellSortDirection } from '../../shared/spellLibrary'
import { matchesSpellType, minimumSpellLevel } from '../../shared/clientSpellBrowse'
import { spellEraAdmits, type SpellEraFilter } from '../../shared/spellBrowseEra'
import { classesArg, levelArg, optionalText, spellLevelBound } from './queryValidation'
import { spellEraLabel } from './spellBrowseEraTable'
import { integerArg } from './workerProtocol'
import { clientSpellDescription } from '../../shared/clientSpellDescriptions'

export const SEARCH_QUERY_FIELDS = ['snapshotId', 'text', 'classes', 'level', 'category', 'subcategory', 'effect', 'allSpells', 'allLevels',
  'minLevel', 'maxLevel', 'type', 'polarity', 'mana', 'sortBy', 'direction', 'selectedIds', 'page', 'pageSize', 'evaluation', 'analysis', 'group', 'metric', 'includeHighlights', 'bestInLine', 'hpFilter', 'era', 'includeEffects', 'browseRank']

function optionalChoice<T extends string>(value: unknown, name: string, choices: readonly T[]): T | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new Error(`Invalid ${name}`)
  return value as T
}
function optionalBoolean(value: unknown, name: string): boolean {
  if (value !== undefined && typeof value !== 'boolean') throw new Error(`Invalid ${name}`)
  return value === true
}
function spellTypeArg(value: unknown): SpellBrowseType | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'string' && /^aoe[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value.slice(3))) && Number(value.slice(3)) <= 2147483647) return value as SpellBrowseType
  return optionalChoice<SpellBrowseType>(value, 'spell type', ['dd', 'dot', 'aoe', 'rain', 'heal', 'hot', 'other'])
}
function selection(value: unknown): number[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 4) throw new Error('Invalid selected spell IDs')
  return value.map((id: unknown) => integerArg(id, 'selected spell ID', 0, 2147483647))
}

function resultOptions(query: Record<string, unknown>) {
  return { group: optionalChoice(query.group, 'result group', ['all', 'ranked', 'zero-mana', 'excluded'] as const) ?? 'all',
    metric: optionalChoice(query.metric, 'metric', ['damage', 'healing'] as const) ?? 'damage',
    includeHighlights: optionalBoolean(query.includeHighlights, 'includeHighlights') }
}
export function spellSearchOptions(query: Record<string, unknown>) {
  const minLevel = query.minLevel === undefined ? undefined : spellLevelBound(query.minLevel)
  const maxLevel = query.maxLevel === undefined ? undefined : spellLevelBound(query.maxLevel)
  if (minLevel !== undefined && maxLevel !== undefined && minLevel > maxLevel) throw new Error('Minimum spell level must not exceed maximum spell level')
  return {
    classes: classesArg(query.classes) ?? [], level: query.level === undefined ? undefined : levelArg(query.level),
    text: optionalText(query.text, 'text')?.toLowerCase(), category: optionalText(query.category, 'category', 256),
    subcategory: optionalText(query.subcategory, 'subcategory', 256),
    effect: query.effect === undefined ? undefined : integerArg(query.effect, 'effect', 0, 100000),
    allSpells: optionalBoolean(query.allSpells, 'allSpells'), allLevels: optionalBoolean(query.allLevels, 'allLevels'), minLevel, maxLevel,
    type: spellTypeArg(query.type),
    bestInLine: optionalBoolean(query.bestInLine, 'bestInLine'),
    hpFilter: optionalChoice(query.hpFilter, 'HP filter', ['damage', 'healing'] as const),
    ...resultOptions(query),
    polarity: optionalChoice(query.polarity, 'polarity', ['beneficial', 'detrimental'] as const),
    era: optionalChoice<SpellEraFilter>(query.era, 'era', ['current', 'preview', 'unknown', 'all']),
    mana: optionalChoice(query.mana, 'mana filter', ['free', 'cost'] as const),
    sortBy: optionalChoice<SpellBrowseSort>(query.sortBy, 'sort column', SPELL_BROWSE_SORTS) ?? 'id',
    direction: optionalChoice<SpellSortDirection>(query.direction, 'sort direction', ['asc', 'desc']) ?? 'asc', selected: new Set(selection(query.selectedIds))
  }
}
type SearchOptions = ReturnType<typeof spellSearchOptions> & { levelsInRange?: boolean }

export function spellSearchLearnedLevel(record: ClientSpellRecord, options: SearchOptions): number | null {
  const low = options.minLevel ?? 0, high = options.maxLevel ?? 255
  const entries = options.levelsInRange ? record.classes.filter(({ level }) => level >= low && level <= high) : record.classes
  return minimumSpellLevel(entries, options.classes)
}

function matchesLevel(record: ClientSpellRecord, options: SearchOptions): boolean {
  const learned = spellSearchLearnedLevel(record, options)
  const ceiling = options.maxLevel ?? (options.allLevels || options.allSpells ? undefined : options.level)
  // Null is unknown or NPC. A minimum of 0 does not promote that absence into a learned level.
  if (learned === null) return options.classes.length === 0 && options.minLevel === undefined && ceiling === undefined
  return (options.minLevel === undefined || learned >= options.minLevel) && (ceiling === undefined || learned <= ceiling)
}
function matchesText(record: ClientSpellRecord, text: string): boolean {
  return /^\d+$/.test(text) ? record.id === Number(text) : `${record.name} ${clientSpellDescription(record)}`.toLowerCase().includes(text)
}
function matchesTraits(record: ClientSpellRecord, options: SearchOptions, mechanics?: SpellMechanicsCatalog): boolean {
  if (options.hpFilter) {
    const sign = options.hpFilter === 'damage' ? -1 : 1
    if (record.beneficial !== (sign === 1) || !record.effects.some((effect) => [0, 79, 100, 101, 334].includes(effect.spa) && effect.base * sign > 0)) return false
  }
  if (options.type && !matchesSpellType(record, options.type, mechanics)) return false
  if (options.polarity && record.beneficial !== (options.polarity === 'beneficial')) return false
  if (options.mana === 'free' && record.mana !== 0) return false
  return options.mana !== 'cost' || record.mana > 0
}
export function matchesSpellSearch(record: ClientSpellRecord, options: SearchOptions, mechanics?: SpellMechanicsCatalog, ambiguous?: ReadonlySet<string>): boolean {
  if (options.text && !matchesText(record, options.text)) return false
  if (options.category && record.category !== options.category) return false
  if (options.subcategory && record.subcategory !== options.subcategory) return false
  if (options.effect !== undefined && !record.effects.some((slot) => slot.spa === options.effect)) return false
  if (options.era && !spellEraAdmits(spellEraLabel(record.name, ambiguous), options.era)) return false
  return matchesLevel(record, options) && matchesTraits(record, options, mechanics)
}
