import { useEffect, useState } from 'react'
import type { SpellClass } from '@shared/spellLibrary'
import type { SpellRankingCategory, SpellLibraryFocus } from '@shared/spellAnalysis'
import type { Dispatch, SetStateAction } from 'react'
import type { SpellTargetCount } from '@shared/spellAnalysis'
import type { AppRouting } from '../../appRouting'
import { useSpellWorkspaceState } from './spellWorkspace'

export type SpellLibraryTab = 'browse' | 'rankings' | 'compare' | 'by-level' | 'history'
export function useSpellViewState(routing: AppRouting, ready = true) {
  const [mode, setMode] = useSpellWorkspaceState<'character' | 'custom' | 'all'>('scope', 'character')
  const [pickedClasses, setClasses] = useSpellWorkspaceState<SpellClass[]>('classes', [])
  const [pickedLevel, setLevel] = useSpellWorkspaceState<number | null>('level', null)
  const [savedTab, setTab] = useSpellWorkspaceState<SpellLibraryTab>('active-tab', 'browse')
  const tab = savedTab === 'rankings' ? 'browse' : savedTab
  const [selected, setSelected] = useSpellWorkspaceState<number[]>('comparison-selection', [])
  const [bestInLine, setBestInLine] = useSpellWorkspaceState('browse-best-in-line', false)
  const [timelineId, setTimelineId] = useState<number | null>(null)
  const [previewLevel, setPreviewLevel] = useState<number | null>(null)
  const [previewScope, setPreviewScope] = useState<'single' | 'pack'>('single')
  const [focusCategory, setFocusCategory] = useState<SpellRankingCategory | undefined>()
  const [focusScope, setFocusScope] = useState<'single' | 'pack' | undefined>()
  const [browseTargets, setBrowseTargets] = useState<SpellTargetCount | null>(null)
  useEffect(() => {
    const focus = routing.libraryFocus
    if (!focus || !ready) return
    setTab(focus.tab === 'rankings' ? 'browse' : focus.tab)
    if (focus.tab === 'rankings') setBrowseTargets(focusedTargets(focus))
    if (focus.level !== undefined) setLevel(focus.level)
    if (focus.classes) { setClasses(focus.classes); setMode('custom') }
    setFocusCategory(focus.category)
    setPreviewScope(focus.analysis?.scope ?? 'single')
    setFocusScope(focus.analysis?.scope)
    openFocusedSpell(focus, routing, { setSelected, setPreviewLevel })
    routing.clearLibraryFocus()
  }, [routing, ready, setTab, setLevel, setClasses, setMode, setSelected])
  const toggle = (id: number): void => setSelected((ids) => ids.includes(id) ? ids.filter((n) => n !== id) : ids.length < 4 ? [...ids, id] : ids)
  const clearComparison = (): void => setSelected([])
  const open = (id: number, scope: 'single' | 'pack' = 'single'): void => { setPreviewLevel(null); setPreviewScope(scope); routing.openLibrarySpell(id) }
  const preview = (id: number, level: number): void => { setPreviewLevel(level); setPreviewScope('single'); routing.openLibrarySpell(id) }
  return { mode, setMode, pickedClasses, setClasses, pickedLevel, setLevel, tab, setTab, selected, toggle, clearComparison, timelineId, setTimelineId,
    previewLevel, previewScope, focusCategory, setFocusCategory, focusScope, setFocusScope, browseTargets, setBrowseTargets, bestInLine, setBestInLine, open, preview }
}

function focusedTargets(focus: SpellLibraryFocus): SpellTargetCount | null {
  return focus.analysis?.scope === 'single' ? 1 : focus.analysis?.targets ?? null
}

function openFocusedSpell(focus: SpellLibraryFocus, routing: AppRouting, state: { setSelected: Dispatch<SetStateAction<number[]>>; setPreviewLevel: (level: number | null) => void }): void {
  const id = focus.id
  if (id === undefined) return
  if (focus.tab === 'compare') state.setSelected((ids) => ids.includes(id) ? ids : [...ids, id].slice(0, 4))
  else { state.setPreviewLevel(focus.level ?? null); routing.openLibrarySpell(id) }
}
