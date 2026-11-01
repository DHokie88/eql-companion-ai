// One character-scoped document and selection shared by Character, Build and Wishlist.
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { applyLoadoutChange, matchingLoadout, type LoadoutChange, type LoadoutId, type LoadoutState } from '@shared/loadouts'
import { resolvedClasses } from '@shared/classCombo'
import { useComboSnap } from '../profiles/ClassComboData'
interface Snapshot { state: LoadoutState | null; ready: boolean; error: string | null; pinnedId: LoadoutId | null; busy: boolean }
let snapshot: Snapshot = { state: null, ready: false, error: null, pinnedId: null, busy: false }
const listeners = new Set<() => void>()
let generation = 0, watching = false, loading = false, pending = 0
let writes: Promise<void> = Promise.resolve()
function emit(next: Snapshot): void { snapshot = next; for (const fn of [...listeners]) fn() }
function subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn) } }
function read(): void {
  if (loading) return
  loading = true
  const mine = generation
  void window.eq.loadoutsGet().then((state) => {
    if (mine === generation) emit({ ...snapshot, state, ready: true })
  }).catch((err: unknown) => {
    if (mine === generation) emit({ ...snapshot, ready: true, error: err instanceof Error ? err.message : 'Loadouts could not be read.' })
  }).finally(() => { if (mine === generation) loading = false })
}
function watch(): void {
  if (watching) return
  watching = true
  window.eq.onCharacter(() => {
    generation++; pending = 0; loading = false
    emit({ state: null, ready: false, error: null, pinnedId: null, busy: false })
    read()
  })
  read()
}
function commit(run: (characterId: string) => Promise<LoadoutState>): Promise<void> {
  const characterId = snapshot.state?.characterId
  if (!characterId) return Promise.reject(new Error('Select a character first.'))
  const mine = generation
  pending++
  emit({ ...snapshot, busy: true, error: null })
  const task = writes.catch(() => { /* A failed edit must not block later edits. */ }).then(async () => {
    if (mine !== generation) return
    const state = await run(characterId)
    if (mine !== generation) return
    pending--
    if (pending === 0) emit({ ...snapshot, state, busy: false })
  }).catch((err: unknown) => {
    if (mine !== generation) return
    pending = Math.max(0, pending - 1)
    emit({ ...snapshot, busy: pending > 0, error: err instanceof Error ? err.message : 'The loadout could not be saved.' })
    if (pending === 0) read()
    throw err
  })
  writes = task
  return task
}
function update(change: LoadoutChange): Promise<void> {
  if (snapshot.state) {
    emit({ ...snapshot, state: { ...snapshot.state, book: applyLoadoutChange(snapshot.state.book, change) } })
  }
  return commit((id) => window.eq.loadoutsUpdate(id, change))
}
function capture(id: LoadoutId): Promise<void> { return commit((characterId) => window.eq.loadoutsCapture(characterId, id)) }
function select(id: LoadoutId | null): void { emit({ ...snapshot, pinnedId: id }) }
export function useLoadouts() {
  const snap = useSyncExternalStore(subscribe, () => snapshot)
  const combo = useComboSnap()
  const current = combo.current
  const liveClasses = useMemo(() => current ? resolvedClasses(current) : [], [current])
  const confirmed = current !== null && current.slots.length > 0 && current.slots.every((s) => s.candidates.length === 1 && s.provenance !== 'inferred')
  const live = snap.state && confirmed ? matchingLoadout(snap.state.book, liveClasses) : null
  const selected = snap.pinnedId ? snap.state?.book.loadouts.find((lo) => lo.id === snap.pinnedId) ?? null : live
  useEffect(watch, [])
  const empty = snap.state?.book.loadouts.every((lo) => lo.classes.length === 0) ?? false
  const signature = liveClasses.join('/')
  useEffect(() => {
    if (snap.ready && empty && confirmed && liveClasses.length > 0) {
      void update({ kind: 'edit', id: 'lo1', classes: liveClasses }).catch(() => { /* Error is shown in the shared bar. */ })
    }
  }, [snap.ready, empty, confirmed, signature, liveClasses])
  return { ...snap, live, selected, liveClasses, confirmed, following: snap.pinnedId === null,
    classes: selected?.classes ?? liveClasses, update, capture, select }
}
