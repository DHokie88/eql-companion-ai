import { useCallback, useEffect, useRef, useState } from 'react'
import type { SpellModifierContext, SpellModifierPreferences } from '@shared/spellModifiers'
import { useSpellRevision } from './libraryState'

export interface SpellModifiersState {
  context: SpellModifierContext | null
  saving: boolean
  loading: boolean
  error: string | null
  update: (preferences: SpellModifierPreferences) => void
}

/** Character/context changes invalidate both reads and writes already in flight. */
export function useSpellModifiers(): SpellModifiersState {
  const revision = useSpellRevision()
  const [context, setContext] = useState<SpellModifierContext | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const turn = useRef(0)
  const writing = useRef(false)
  const current = useRef(context)
  current.current = context
  useEffect(() => {
    let alive = true
    const invalidate = (): number => ++turn.current
    const refresh = (clear: boolean): void => {
      const ticket = invalidate()
      if (clear) setContext(null)
      setLoading(true)
      setError(null)
      void window.eq.spellLibrary.modifierContext().then((next) => {
        if (alive && turn.current === ticket) { setContext(next); setLoading(false) }
      }).catch((cause: unknown) => {
        if (alive && turn.current === ticket) { setError(message(cause)); setLoading(false) }
      })
    }
    const offCharacter = window.eq.onCharacter(() => refresh(true))
    const offModifiers = window.eq.spellLibrary.onModifiersChanged(() => refresh(false))
    refresh(true)
    return () => { alive = false; invalidate(); offCharacter(); offModifiers() }
  }, [revision])
  const update = useCallback((preferences: SpellModifierPreferences): void => {
    const previous = current.current
    if (!previous || writing.current) return
    writing.current = true
    setSaving(true)
    setError(null)
    const ticket = turn.current
    void window.eq.spellLibrary.updateModifiers({ expectedRevision: previous.revision, preferences }).then((next) => {
      if (turn.current === ticket) setContext(next)
    }).catch((cause: unknown) => {
      if (turn.current === ticket) setError(message(cause))
    }).finally(() => { writing.current = false; setSaving(false) })
  }, [])
  return { context, saving, loading, error, update }
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : String(cause) }
