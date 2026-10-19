import { useCallback, useEffect, useRef, useState } from 'react'
import type { SpellModifierContext, SpellModifierPreferences } from '@shared/spellModifiers'
import { sameSpellModifierCharacter, saveSpellModifierPreferences, spellModifierProfileKey } from '@shared/spellModifierUpdates'
import { useSpellRevision } from './libraryState'

export interface SpellModifiersState {
  context: SpellModifierContext | null
  saving: boolean
  loading: boolean
  error: string | null
  update: (preferences: SpellModifierPreferences) => void
}

/** Selection changes cancel writes; same-profile fact changes rebase stale saves. */
export function useSpellModifiers(): SpellModifiersState {
  const revision = useSpellRevision()
  const [context, setContext] = useState<SpellModifierContext | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const turn = useRef(0)
  const writing = useRef(false)
  const pendingWrites = useRef<(() => Promise<void>)[]>([])
  const current = useRef(context)
  const alive = useRef(true)
  const selectionTurn = useRef(0)
  const refreshCurrent = useRef<() => void>(() => undefined)
  current.current = context
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    let alive = true
    const invalidate = (): number => ++turn.current
    const refresh = (clear: boolean): void => {
      const ticket = invalidate()
      if (clear) setContext(null)
      setLoading(true)
      setError(null)
      void window.eq.spellLibrary.modifierContext().then((next) => {
        if (alive && turn.current === ticket) { current.current = next; setContext(next); setLoading(false) }
      }).catch((cause: unknown) => {
        if (alive && turn.current === ticket) { setError(message(cause)); setLoading(false) }
      })
    }
    refreshCurrent.current = () => refresh(false)
    const offCharacter = window.eq.onCharacter((character) => {
      const changed = !sameSpellModifierCharacter(current.current, character)
      if (changed) selectionTurn.current++
      refresh(changed)
    })
    const offModifiers = window.eq.spellLibrary.onModifiersChanged(() => refresh(false))
    refresh(true)
    return () => { alive = false; invalidate(); offCharacter(); offModifiers() }
  }, [revision])
  const update = useCallback((preferences: SpellModifierPreferences): void => {
    const previous = current.current
    if (!previous) return
    setError(null)
    const selection = selectionTurn.current
    const isCurrent = (): boolean => alive.current && selectionTurn.current === selection &&
      (current.current === null || spellModifierProfileKey(current.current) === spellModifierProfileKey(previous))
    const save = (): Promise<void> => saveSpellModifierPreferences(previous, preferences, {
      read: () => window.eq.spellLibrary.modifierContext(),
      write: (update) => window.eq.spellLibrary.updateModifiers(update), isCurrent
    }).then(() => {
      if (isCurrent()) { setError(null); refreshCurrent.current() }
    }).catch((cause: unknown) => {
      if (isCurrent()) setError(message(cause))
    })
    pendingWrites.current.push(save)
    if (writing.current) return
    writing.current = true
    setSaving(true)
    const drain = async (): Promise<void> => {
      while (pendingWrites.current.length) await pendingWrites.current.shift()?.()
    }
    void drain().finally(() => { writing.current = false; if (alive.current) setSaving(false) })
  }, [])
  return { context, saving, loading, error, update }
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : String(cause) }
