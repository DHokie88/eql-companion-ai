import { useEffect, useMemo, useState } from 'react'
import type { SpellAnalysisOptions, SpellLibraryFocus, SpellRankingCategory } from '@shared/spellAnalysis'
import { spellPreviewTargets } from '@shared/spellAnalysis'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import type { SpellClass } from '@shared/spellLibrary'
import { useSpellModifiers } from '../spells/useSpellModifiers'
import { useCurrentComboClasses } from './useLevelUnlocks'

/** Only resolved classes can claim eligibility; candidate classes remain provenance on the panel. */
export function useLevelingSpellAnalysis(category: SpellRankingCategory = 'dd') {
  const combo = useCurrentComboClasses()
  const modifiers = useSpellModifiers()
  const classKey = combo.resolved.join(',')
  const classes = useMemo(() => classKey ? classKey.split(',') as SpellClass[] : [], [classKey])
  const context = modifiers.context
  const targets = spellPreviewTargets(modifiers.context?.preferences.targets)
  const evaluation = useMemo<SpellEvaluationOptions | undefined>(() => context
    ? { mode: context.preferences.mode, contextRevision: context.revision, classes } : undefined, [context, classes])
  const analysis = useMemo<SpellAnalysisOptions>(() => ({ scope: category === 'aoe' ? 'pack' : 'single', targets }), [category, targets])
  return { classes, modifiers, evaluation, analysis }
}

/** The app owns navigation and Back history; compact panels only describe their destination. */
export function openLevelingSpells(focus: SpellLibraryFocus): void {
  window.dispatchEvent(new CustomEvent<SpellLibraryFocus>('eqo:spell-library-focus', { detail: focus }))
}

export function useSpellSearchText(): [string, (text: string) => void, string] {
  const [query, setQuery] = useState('')
  const [text, setText] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setText(query.trim()), 200)
    return () => window.clearTimeout(timer)
  }, [query])
  return [query, setQuery, text]
}
