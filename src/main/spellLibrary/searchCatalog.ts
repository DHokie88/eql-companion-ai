import type { SpellMechanicsCatalog } from '../../shared/clientSpellMechanics'
import type { ClientSpellRecord, SpellDataset, SpellSearchResult, SpellSummary } from '../../shared/spellLibrary'
import { clientSpellType, compareSpellValues, minimumSpellLevel, spellBrowseSortValue } from '../../shared/clientSpellBrowse'
import { matchesSpellSearch, spellSearchOptions } from './browseQuery'
import { levelArg, pageArgs } from './queryValidation'
import type { SpellLibraryStorage } from './storage'
import type { SpellCalculator } from './workerEvaluation'

export function catalogSummary(record: ClientSpellRecord, classes: ReturnType<typeof spellSearchOptions>['classes'], mechanics?: SpellMechanicsCatalog): SpellSummary {
  const { id, name, rank, mana, category, subcategory, beneficial, target } = record
  return { id, name, rank, classes: record.classes, mana, category, subcategory, beneficial, target,
    learnedLevel: minimumSpellLevel(record.classes, classes), spellType: clientSpellType(record, mechanics) }
}
function evaluate(record: ClientSpellRecord, row: SpellSummary, level: number, calculate: SpellCalculator): void {
  row.calculations = record.effects.some((e) => [0, 79, 100, 101, 334].includes(e.spa))
    ? [calculate(record, level, record.beneficial ? 'healing' : 'damage')] : []
}

function collect(storage: SpellLibraryStorage, dataset: SpellDataset | null, options: ReturnType<typeof spellSearchOptions>, input: { evaluateRow: (record: ClientSpellRecord, row: SpellSummary) => void; mechanics?: SpellMechanicsCatalog }) {
  const matches: SpellSummary[] = [], categories = new Set<string>(), subcategories = new Set<string>()
  if (dataset) for (const record of storage.records(dataset.snapshotId)) {
    if (record.category) categories.add(record.category)
    if (record.subcategory && (!options.category || record.category === options.category)) subcategories.add(record.subcategory)
    if (!matchesSpellSearch(record, options, input.mechanics)) continue
    const row = catalogSummary(record, options.classes, input.mechanics)
    input.evaluateRow(record, row)
    matches.push(row)
  }
  return { matches, categories: [...categories].sort(), subcategories: [...subcategories].sort() }
}

/** Sort the complete filtered catalog in the query worker, then evaluate just the requested page when possible. */
export function searchCatalog(storage: SpellLibraryStorage, dataset: SpellDataset | null, query: Record<string, unknown>, dependencies: { calculate: SpellCalculator; mechanics?: SpellMechanicsCatalog }): SpellSearchResult {
  const { calculate, mechanics } = dependencies
  const options = spellSearchOptions(query)
  const { page, pageSize } = pageArgs(query)
  const calculateAll = options.sortBy === 'amount' || options.sortBy === 'efficiency'
  const level = calculateAll || query.evaluation !== undefined || query.analysis !== undefined ? levelArg(query.level) : undefined
  const { matches, categories, subcategories } = collect(storage, dataset, options, { mechanics, evaluateRow: (record, row) => {
    if (calculateAll && level !== undefined) evaluate(record, row, level, calculate)
  } })
  matches.sort((a, b) => compareSpellValues(spellBrowseSortValue(a, options.sortBy, options.selected),
    spellBrowseSortValue(b, options.sortBy, options.selected), options.direction) || a.id - b.id)
  const records = matches.slice((page - 1) * pageSize, page * pageSize)
  if (!calculateAll && level !== undefined && dataset) for (const row of records) {
    const record = storage.record(dataset.snapshotId, row.id)
    if (record) evaluate(record, row, level, calculate)
  }
  return { dataset, total: matches.length, page, pageSize, records, categories, subcategories }
}
