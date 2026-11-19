import { useCallback, useEffect, useRef, useState } from 'react'
import type { SpellModifierContext, SpellModifierPreferences } from '@shared/spellModifiers'
import { sameSpellModifierCharacter, saveSpellModifierPreferences, spellModifierProfileKey } from '@shared/spellModifierUpdates'
import { useSpellRevision } from './libraryState'

export interface SpellModifiersState {
  context: SpellModifierContext | null
  confirmedContext: SpellModifierContext | null
  saving: boolean
  loading: boolean
  error: string | null
  update: (preferences: SpellModifierPreferences) => void
}

interface PreferenceEdit {
  original: SpellModifierContext
  preferences: SpellModifierPreferences
  selection: number
}

/** Selection changes cancel writes. The pending edit preserves the start of a burst. */
export function useSpellModifiers(): SpellModifiersState {
  const revision = useSpellRevision()
  const [context, setContext] = useState<SpellModifierContext | null>(null)
  const [confirmedContext, setConfirmedContext] = useState<SpellModifierContext | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)
  const writing = useRef(false)
  const queued = useRef<PreferenceEdit | null>(null)
  const current = useRef<SpellModifierContext | null>(null)
  const confirmed = useRef<SpellModifierContext | null>(null)
  const alive = useRef(true)
  const selectionTurn = useRef(0)
  const refreshCurrent = useRef<() => void>(() => undefined)

  const publish = useCallback((next: SpellModifierContext | null): void => {
    current.current = next
    setContext(next)
  }, [])
  const acknowledge = useCallback((next: SpellModifierContext | null): void => {
    confirmed.current = next
    setConfirmedContext(next)
    publish(next)
  }, [publish])

  useEffect(() => {
    alive.current = true
    let subscribed = true, refreshVersion = 0
    const refresh = (clear: boolean): void => {
      const ticket = ++refreshVersion
      const seenRequest = request.current
      const previous = current.current
      if (clear) acknowledge(null)
      setLoading(true)
      setError(null)
      void window.eq.spellLibrary.modifierContext().then((next) => {
        if (!subscribed || refreshVersion !== ticket) return
        const sameProfile = !clear || (previous !== null && spellModifierProfileKey(previous) === spellModifierProfileKey(next))
        if (!sameProfile || (!writing.current && request.current === seenRequest)) acknowledge(next)
        setLoading(false)
      }).catch((cause: unknown) => {
        if (subscribed && refreshVersion === ticket) { setError(message(cause)); setLoading(false) }
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
    return () => { subscribed = false; alive.current = false; offCharacter(); offModifiers() }
  }, [revision, acknowledge])

  const save = useCallback(async (edit: PreferenceEdit): Promise<boolean> => {
    const { original, preferences, selection } = edit
    const profile = spellModifierProfileKey(original)
    const isCurrent = (): boolean => alive.current && selectionTurn.current === selection &&
      (current.current === null || spellModifierProfileKey(current.current) === profile)
    if (!isCurrent()) return false
    try {
      const saved = await saveSpellModifierPreferences(original, preferences, {
        read: () => window.eq.spellLibrary.modifierContext(),
        write: (update) => window.eq.spellLibrary.updateModifiers(update),
        isCurrent
      }, confirmed.current ?? original)
      confirmed.current = saved
      if (queued.current?.selection !== selection) acknowledge(saved)
      return true
    } catch (cause: unknown) {
      if (!isCurrent()) return false
      const pending = queued.current
      if (pending?.selection === selection) pending.original = original
      else {
        acknowledge(confirmed.current)
        setError(message(cause))
      }
      return false
    }
  }, [acknowledge])

  const update = useCallback((preferences: SpellModifierPreferences): void => {
    const previous = current.current
    if (!previous) return
    setError(null)
    publish({ ...previous, preferences })
    request.current++
    const selection = selectionTurn.current
    const pending = queued.current
    queued.current = { original: pending?.selection === selection ? pending.original : previous, preferences, selection }
    if (writing.current) return
    writing.current = true
    setSaving(true)
    void drainPreferenceEdits(queued, save).then((saved) => {
      writing.current = false
      if (!alive.current) return
      setSaving(false)
      // Refresh once after the burst for evidence published while it was in flight.
      if (saved) refreshCurrent.current()
    })
  }, [publish, save])
  return { context, confirmedContext, saving, loading, error, update }
}

async function drainPreferenceEdits(queue: { current: PreferenceEdit | null }, save: (edit: PreferenceEdit) => Promise<boolean>): Promise<boolean> {
  let saved = false
  while (queue.current) {
    const edit = queue.current
    queue.current = null
    saved = await save(edit)
  }
  return saved
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : String(cause) }
