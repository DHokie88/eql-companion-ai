import { useEffect, useState } from 'react'
import type { SpellClass } from '@shared/spellLibrary'
import type { SpellRankingCategory } from '@shared/spellAnalysis'
import type { AppRouting } from '../../appRouting'
import { useSpellWorkspaceState } from './spellWorkspace'

export type SpellLibraryTab = 'browse' | 'rankings' | 'compare' | 'by-level' | 'history'
export function useSpellViewState(routing: AppRouting, ready = true) {
  const [mode, setMode] = useSpellWorkspaceState<'character' | 'custom' | 'all'>('scope', 'character')
  const [pickedClasses, setClasses] = useSpellWorkspaceState<SpellClass[]>('classes', [])
  const [pickedLevel, setLevel] = useSpellWorkspaceState<number | null>('level', null)
  const [tab, setTab] = useSpellWorkspaceState<SpellLibraryTab>('active-tab', 'browse')
  const [selected, setSelected] = useSpellWorkspaceState<number[]>('comparison-selection', [])
  const [timelineId, setTimelineId] = useState<number | null>(null)
  const [previewLevel, setPreviewLevel] = useState<number | null>(null)
  const [previewScope, setPreviewScope] = useState<'single' | 'pack'>('single')
  const [focusCategory, setFocusCategory] = useState<SpellRankingCategory | undefined>()
  const [focusScope, setFocusScope] = useState<'single' | 'pack' | undefined>()
  useEffect(() => {
    const focus = routing.libraryFocus
    if (!focus || !ready) return
    setTab(focus.tab)
    if (focus.level !== undefined) setLevel(focus.level)
    if (focus.classes) { setClasses(focus.classes); setMode('custom') }
    setFocusCategory(focus.category)
    setPreviewScope(focus.analysis?.scope ?? 'single')
    setFocusScope(focus.analysis?.scope)
    const id = focus.id
    if (id !== undefined) {
      if (focus.tab === 'compare') setSelected((ids) => ids.includes(id) ? ids : [...ids, id].slice(0, 4))
      else { setPreviewLevel(focus.level ?? null); routing.openLibrarySpell(id) }
    }
    routing.clearLibraryFocus()
  }, [routing, ready, setTab, setLevel, setClasses, setMode, setSelected])
  const toggle = (id: number): void => setSelected((ids) => ids.includes(id) ? ids.filter((n) => n !== id) : ids.length < 4 ? [...ids, id] : ids)
  const open = (id: number, scope: 'single' | 'pack' = 'single'): void => { setPreviewLevel(null); setPreviewScope(scope); routing.openLibrarySpell(id) }
  const preview = (id: number, level: number): void => { setPreviewLevel(level); setPreviewScope('single'); routing.openLibrarySpell(id) }
  return { mode, setMode, pickedClasses, setClasses, pickedLevel, setLevel, tab, setTab, selected, toggle, timelineId, setTimelineId,
    previewLevel, previewScope, focusCategory, setFocusCategory, focusScope, setFocusScope, open, preview }
}
