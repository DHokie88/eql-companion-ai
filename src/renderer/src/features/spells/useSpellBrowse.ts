import { useCallback, useEffect, useState } from 'react'
import type { SpellBrowseSort, SpellBrowseType, SpellClass, SpellSearchQuery } from '@shared/spellLibrary'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import { useLibraryQuery } from './useLibraryQuery'
import { useSearchText } from './useSearchText'
import { useSpellSort } from './SpellTableControls'

export interface BrowseFilters {
  text: string; min: string; max: string | null; category: string; subcategory: string; effect: string
  type: SpellBrowseType | ''; polarity: 'beneficial' | 'detrimental' | ''; mana: 'free' | 'cost' | ''
}
function defaults(): BrowseFilters { return { text: '', min: '', max: null, category: '', subcategory: '', effect: '', type: '', polarity: '', mana: '' } }
function filterError(filters: BrowseFilters, maximum: string): string | null {
  const levels = [filters.min, maximum].filter((value) => value !== '')
  if (levels.some((value) => !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 255)) return 'Spell levels must be whole numbers from 1 to 255.'
  if (filters.min && maximum && Number(filters.min) > Number(maximum)) return 'Minimum spell level must not exceed maximum spell level.'
  if (filters.effect && (!/^\d+$/.test(filters.effect) || Number(filters.effect) > 100000)) return 'Effect must be a whole SPA number from 0 to 100000.'
  return null
}

export function useSpellBrowse({ classes, level, allSpells, evaluation, selected }: {
  classes: SpellClass[]; level: number; allSpells: boolean; evaluation: SpellEvaluationOptions; selected: number[]
}) {
  const [filters, setFilters] = useState(defaults)
  const [page, setPage] = useState(1)
  const sort = useSpellSort<SpellBrowseSort>('id')
  const queryText = useSearchText(filters.text)
  const { min, category, subcategory, effect, type, polarity, mana } = filters
  const maximum = filters.max ?? (allSpells ? '' : String(level))
  const invalid = filterError(filters, maximum)
  const classKey = classes.join(','), selectedKey = sort.field === 'selected' ? selected.join(',') : ''
  useEffect(() => { setPage(1) }, [classKey, level, allSpells, sort.field, sort.direction])
  const load = useCallback(() => {
    if (invalid) return Promise.reject(new Error(invalid))
    const query: SpellSearchQuery = { text: queryText, classes: classKey ? classKey.split(',') as SpellClass[] : [], level, allSpells, allLevels: true,
      minLevel: min === '' ? undefined : Number(min), maxLevel: maximum === '' ? undefined : Number(maximum),
      category: category || undefined, subcategory: subcategory || undefined, effect: effect === '' ? undefined : Number(effect),
      type: type || undefined, polarity: polarity || undefined, mana: mana || undefined,
      sortBy: sort.field, direction: sort.direction, selectedIds: selectedKey ? selectedKey.split(',').map(Number) : [], page, pageSize: 40, evaluation }
    return window.eq.spellLibrary.search(query)
  }, [queryText, classKey, level, allSpells, min, category, subcategory, effect, type, polarity, mana, maximum, sort.field, sort.direction, selectedKey, page, evaluation, invalid])
  const result = useLibraryQuery(load)
  const change = <K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]): void => {
    setFilters((current) => ({ ...current, [key]: value, ...(key === 'category' ? { subcategory: '' } : {}) })); setPage(1)
  }
  const reset = (): void => { setFilters(defaults()); setPage(1) }
  return { ...result, filters, maximum, change, reset, page, setPage, sort, invalid }
}
