import { useCallback, useEffect } from 'react'
import type { SpellBrowseSort, SpellBrowseType, SpellClass, SpellMetric, SpellSearchQuery } from '@shared/spellLibrary'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import { useLibraryQuery } from './useLibraryQuery'
import { useSearchText } from './useSearchText'
import { useSpellSort } from './SpellTableControls'
import { useSpellPageReset, useSpellWorkspaceState } from './spellWorkspace'
import type { SpellAnalysisOptions, SpellRankingCategory } from '@shared/spellAnalysis'

export interface BrowseFilters {
  text: string; min: string; max: string | null; category: string; subcategory: string; effect: string
  type: SpellBrowseType | ''; polarity: 'beneficial' | 'detrimental' | ''; mana: 'free' | 'cost' | ''
}
export function defaultBrowseFilters(): BrowseFilters { return { text: '', min: '', max: null, category: '', subcategory: '', effect: '', type: '', polarity: '', mana: '' } }
function typeMetric(type: BrowseFilters['type']): SpellMetric | null {
  if (type === 'heal' || type === 'hot') return 'healing'
  return type === 'dd' || type === 'dot' || type === 'rain' || type.startsWith('aoe') ? 'damage' : null
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

export function useSpellBrowse({ classes, level, allSpells, evaluation, selected, analysis, enabled = true }: {
  classes: SpellClass[]; level: number; allSpells: boolean; evaluation: SpellEvaluationOptions; selected: number[]; analysis?: SpellAnalysisOptions; enabled?: boolean
}) {
  const [filters, setFilters] = useSpellWorkspaceState('browse-filters', defaultBrowseFilters())
  const [page, setPage] = useSpellWorkspaceState('browse-page', 1)
  const sort = useSpellSort<SpellBrowseSort>('efficiency', 'desc', 'id')
  const [group, setGroup] = useSpellWorkspaceState<NonNullable<SpellSearchQuery['group']>>('browse-group', 'all')
  const [metric, setMetric] = useSpellWorkspaceState<SpellMetric>('browse-metric', 'damage')
  const [columns, setColumns] = useSpellWorkspaceState<SpellBrowseSort[]>('browse-columns', [])
  const queryText = useSearchText(filters.text)
  const { min, category, subcategory, effect, type, polarity, mana } = filters
  const maximum = filters.max ?? String(level)
  const invalid = browseFilterError(filters, maximum)
  const classKey = classes.join(','), selectedKey = sort.field === 'selected' ? selected.join(',') : ''
  useSpellPageReset(`${classKey}:${level}:${allSpells}:${sort.field}:${sort.direction}:${group}:${metric}`, setPage)
  const load = useCallback(() => {
    if (invalid) return Promise.reject(new Error(invalid))
    const query: SpellSearchQuery = { text: queryText, classes: classKey ? classKey.split(',') as SpellClass[] : [], level, allSpells, allLevels: true,
      minLevel: min === '' ? undefined : Number(min), maxLevel: maximum === '' ? undefined : Number(maximum),
      category: category || undefined, subcategory: subcategory || undefined, effect: effect === '' ? undefined : Number(effect),
      type: type || undefined, polarity: polarity || undefined, mana: mana || undefined, group, metric, includeHighlights: true,
      sortBy: sort.field, direction: sort.direction, selectedIds: selectedKey ? selectedKey.split(',').map(Number) : [], page, pageSize: 40, evaluation, analysis }
    return window.eq.spellLibrary.search(query)
  }, [queryText, classKey, level, allSpells, min, category, subcategory, effect, type, polarity, mana, maximum, sort.field, sort.direction, selectedKey, page, evaluation, invalid, analysis, group, metric])
  const result = useLibraryQuery(load, undefined, enabled)
  const effectiveCategory = category || (type && result.data?.matchingCategories?.length === 1 ? result.data.matchingCategories[0] : '')
  useEffect(() => { adjustCategorySort(sort, effectiveCategory, subcategory) }, [effectiveCategory, subcategory, sort])
  const change = <K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]): void => {
    const category = key === 'category' ? value : filters.category
    const subcategory = key === 'category' ? '' : key === 'subcategory' ? value : filters.subcategory
    adjustCategorySort(sort, category, subcategory)
    const newMetric = key === 'type' ? typeMetric(value as BrowseFilters['type']) : null
    if (newMetric) setMetric(newMetric)
    setFilters((current) => ({ ...current, [key]: value, ...(key === 'category' ? { subcategory: '' } : {}) })); setPage(1)
  }
  const reset = (): void => { setFilters(defaultBrowseFilters()); setPage(1); if (sort.field === 'subcategory') sort.selectSort('category', sort.direction) }
  const selectSort = sort.selectSort
  const focusCategory = useCallback((category: SpellRankingCategory): void => {
    setFilters((current) => ({ ...current, type: category })); setMetric(typeMetric(category) ?? 'damage')
    setGroup('ranked'); selectSort('efficiency', 'desc'); setPage(1)
  }, [setFilters, setMetric, setGroup, selectSort, setPage])
  return { ...result, filters, maximum, change, reset, page, setPage, sort, invalid, group, setGroup, metric, setMetric, columns, setColumns, focusCategory }
}
