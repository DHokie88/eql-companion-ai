import { useCallback } from 'react'
import type { SpellClass } from '@shared/spellLibrary'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import type { SpellRankingsQuery, SpellRankingCategory, SpellAnalysisSort, SpellTargetCount } from '@shared/spellAnalysis'
import { browseFilterError, defaultBrowseFilters, type BrowseFilters } from './useSpellBrowse'
import { useSpellPageReset, useSpellWorkspaceState } from './spellWorkspace'
import { useSearchText } from './useSearchText'
import { useLibraryQuery } from './useLibraryQuery'
import { useSpellSort } from './SpellTableControls'

export function useSpellRankings({ classes, level, evaluation, targets, initialCategory = 'dd' }: {
  classes: SpellClass[]; level: number; evaluation: SpellEvaluationOptions; targets: SpellTargetCount; initialCategory?: SpellRankingCategory
}) {
  const [filters, setFilters] = useSpellWorkspaceState('ranking-filters', defaultBrowseFilters())
  const [categoryTab, setCategory] = useSpellWorkspaceState<SpellRankingCategory>('ranking-category', initialCategory)
  const [group, setGroup] = useSpellWorkspaceState<NonNullable<SpellRankingsQuery['group']>>('ranking-group', 'ranked')
  const [page, setPage] = useSpellWorkspaceState('ranking-page', 1)
  const sort = useSpellSort<SpellAnalysisSort>('efficiency', 'desc', 'rankings')
  const text = useSearchText(filters.text), classKey = classes.join(',')
  const maximum = filters.max ?? String(level), invalid = browseFilterError(filters, maximum)
  const { min, category, subcategory, effect, polarity, mana } = filters
  const load = useCallback(() => {
    if (invalid) return Promise.reject(new Error(invalid))
    return window.eq.spellLibrary.rankings({ classes: classKey ? classKey.split(',') as SpellClass[] : [], level, evaluation,
      analysis: { scope: categoryTab === 'aoe' ? 'pack' : 'single', targets }, categoryTab, group,
      text, minLevel: min ? Number(min) : undefined, maxLevel: maximum ? Number(maximum) : undefined, allLevels: true,
      category: category || undefined, subcategory: subcategory || undefined, effect: effect === '' ? undefined : Number(effect),
      polarity: polarity || undefined, mana: mana || undefined, page, pageSize: 40, sortBy: sort.field, direction: sort.direction })
  }, [classKey, level, evaluation, targets, categoryTab, group, text, min, maximum, category, subcategory, effect, polarity, mana, page, sort.field, sort.direction, invalid])
  const result = useLibraryQuery(load)
  useSpellPageReset(`${classKey}:${level}:${categoryTab}:${group}:${sort.field}:${sort.direction}`, setPage)
  const change = <K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]): void => {
    setFilters((f) => ({ ...f, [key]: value, ...(key === 'category' ? { subcategory: '' } : {}) })); setPage(1)
  }
  const reset = (): void => { setFilters(defaultBrowseFilters()); setPage(1) }
  return { ...result, filters, maximum, invalid, change, reset, categoryTab, setCategory, group, setGroup, page, setPage, sort }
}
