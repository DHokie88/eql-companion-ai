import { useCallback, useEffect } from 'react'
import type { SpellBrowseSort, SpellBrowseType, SpellClass, SpellMetric, SpellSearchQuery } from '@shared/spellLibrary'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import { useLibraryQuery } from './useLibraryQuery'
import { useSearchText } from './useSearchText'
import { useSpellSort } from './SpellTableControls'
import { useSpellPageReset, useSpellWorkspaceState } from './spellWorkspace'
import type { SpellAnalysisOptions, SpellRankingCategory } from '@shared/spellAnalysis'
import { browseColumns, DEFAULT_BROWSE_COLUMNS } from './spellBrowseColumns'

export interface BrowseFilters {
  text: string; min: string; max: string | null; category: string; subcategory: string; effect: string
  type: SpellBrowseType | ''; polarity: 'beneficial' | 'detrimental' | ''; mana: 'free' | 'cost' | ''
  hpFilter: SpellMetric | ''
}
export function defaultBrowseFilters(): BrowseFilters { return { text: '', min: '', max: null, category: '', subcategory: '', effect: '', type: '', polarity: '', mana: '', hpFilter: '' } }
function typeMetric(type: BrowseFilters['type']): SpellMetric | null {
  if (type === 'heal' || type === 'hot') return 'healing'
  return type === 'dd' || type === 'dot' || type === 'rain' || type.startsWith('aoe') ? 'damage' : null
}
function browseType(type: BrowseFilters['type']): SpellBrowseType | undefined {
  return type.startsWith('aoe') ? 'aoe' : type || undefined
}
function adjustCategorySort(sort: ReturnType<typeof useSpellSort<SpellBrowseSort>>, category: string | null, subcategory: string | null): void {
  if (category && subcategory && ['category', 'subcategory'].includes(sort.field)) sort.selectSort('name', 'asc')
  else if (category && sort.field === 'category') sort.selectSort('subcategory', sort.direction)
  else if (!category && sort.field === 'subcategory') sort.selectSort('category', sort.direction)
}
export function browseFilterError(filters: BrowseFilters, maximum: string): string | null {
  const levels = [filters.min, maximum].filter((value) => value !== '')
  if (levels.some((value) => !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 255)) return 'Spell levels must be whole numbers from 1 to 255.'
  if (filters.min && maximum && Number(filters.min) > Number(maximum)) return 'Minimum spell level must not exceed maximum spell level.'
  if (filters.effect && (!/^\d+$/.test(filters.effect) || Number(filters.effect) > 100000)) return 'Effect must be a whole SPA number from 0 to 100000.'
  return null
}
export function browseCategory(filters: BrowseFilters, data?: import('@shared/spellLibrary').SpellSearchResult | null): string {
  const categories = data?.matchingCategories?.filter(Boolean) ?? []
  if (!filters.category && filters.type === 'dd') return 'Direct Damage'
  if (!filters.category && filters.type === 'dot') return 'Damage Over Time'
  return filters.category || ((filters.type || filters.hpFilter) && categories.length === 1 ? categories[0] : '')
}
function useVisibleSort(input: { sort: ReturnType<typeof useSpellSort<SpellBrowseSort>>; filters: BrowseFilters; metric: SpellMetric; columns: SpellBrowseSort[]; data?: import('@shared/spellLibrary').SpellSearchResult | null }): void {
  const { sort, filters, metric, columns, data } = input
  const category = browseCategory(filters, data)
  useEffect(() => { adjustCategorySort(sort, category, filters.subcategory) }, [category, filters.subcategory, sort])
  const fields = browseColumns(metric, !category ? 'both' : filters.subcategory ? 'none' : 'subcategory', columns, data?.matchingTypes?.length === 1).map((column) => column.field).join(',')
  useEffect(() => {
    if (!fields.split(',').includes(sort.field) && !['category', 'subcategory'].includes(sort.field)) sort.selectSort('name', 'asc')
  }, [fields, sort])
}

export function useSpellBrowse({ classes, level, allSpells, evaluation, selected, analysis, bestInLine = false, enabled = true }: {
  classes: SpellClass[]; level: number; allSpells: boolean; evaluation: SpellEvaluationOptions; selected: number[]; analysis?: SpellAnalysisOptions; bestInLine?: boolean; enabled?: boolean
}) {
  const [filters, setFilters] = useSpellWorkspaceState('browse-filters', defaultBrowseFilters())
  const [page, setPage] = useSpellWorkspaceState('browse-page', 1)
  const sort = useSpellSort<SpellBrowseSort>('efficiency', 'desc', 'id')
  const [group, setGroup] = useSpellWorkspaceState<NonNullable<SpellSearchQuery['group']>>('browse-group', 'all')
  const [metric, setMetric] = useSpellWorkspaceState<SpellMetric>('browse-metric', 'damage')
  const [columns, setColumns] = useSpellWorkspaceState<SpellBrowseSort[]>('browse-visible-columns', DEFAULT_BROWSE_COLUMNS)
  const queryText = useSearchText(filters.text)
  const { min, category, subcategory, effect, type, polarity, hpFilter } = filters
  const maximum = filters.max ?? String(level)
  const invalid = browseFilterError(filters, maximum)
  const classKey = classes.join(','), selectedKey = sort.field === 'selected' ? selected.join(',') : ''
  useSpellPageReset(`${classKey}:${level}:${allSpells}:${sort.field}:${sort.direction}:${group}:${metric}:${bestInLine}`, setPage)
  const load = useCallback(() => {
    if (invalid) return Promise.reject(new Error(invalid))
    const query: SpellSearchQuery = { text: queryText, classes: classKey ? classKey.split(',') as SpellClass[] : [], level, allSpells, allLevels: true,
      minLevel: min === '' ? undefined : Number(min), maxLevel: maximum === '' ? undefined : Number(maximum),
      category: category || undefined, subcategory: subcategory || undefined, effect: effect === '' ? undefined : Number(effect),
      type: browseType(type), polarity: polarity || undefined, hpFilter: hpFilter || undefined, bestInLine, group, metric, includeHighlights: true,
      sortBy: sort.field, direction: sort.direction, selectedIds: selectedKey ? selectedKey.split(',').map(Number) : [], page, pageSize: 40, evaluation: { ...evaluation, rankOnly: true }, analysis }
    return window.eq.spellLibrary.search(query)
  }, [queryText, classKey, level, allSpells, min, category, subcategory, effect, type, polarity, hpFilter, bestInLine, maximum, sort.field, sort.direction, selectedKey, page, evaluation, invalid, analysis, group, metric])
  const result = useLibraryQuery(load, undefined, enabled)
  useVisibleSort({ sort, filters, metric, columns, data: result.data })
  const change = <K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]): void => {
    const category = key === 'category' ? value : filters.category
    const subcategory = key === 'category' ? '' : key === 'subcategory' ? value : filters.subcategory
    adjustCategorySort(sort, category, subcategory)
    const newMetric = key === 'hpFilter' && value ? value as SpellMetric : key === 'type' ? typeMetric(value as BrowseFilters['type']) : null
    if (newMetric) setMetric(newMetric)
    setFilters((current) => ({ ...current, [key]: value, ...(key === 'category' ? { subcategory: '' } : {}), ...(key === 'type' ? { hpFilter: '' } : key === 'hpFilter' ? { type: '' } : {}) })); setPage(1)
  }
  const reset = (): void => { setFilters(defaultBrowseFilters()); setPage(1); if (sort.field === 'subcategory') sort.selectSort('category', sort.direction) }
  const selectSort = sort.selectSort
  const focusCategory = useCallback((category: SpellRankingCategory): void => {
    setFilters((current) => ({ ...current, type: category, hpFilter: '' })); setMetric(typeMetric(category) ?? 'damage')
    setGroup('ranked'); selectSort('efficiency', 'desc'); setPage(1)
  }, [setFilters, setMetric, setGroup, selectSort, setPage])
  return { ...result, filters, maximum, change, reset, page, setPage, sort, invalid, group, setGroup, metric, setMetric, columns, setColumns, bestInLine, focusCategory }
}
