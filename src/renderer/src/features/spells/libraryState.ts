import { useSyncExternalStore } from 'react'
import type { SpellLibraryStatus } from '@shared/spellLibrary'

const EMPTY: SpellLibraryStatus = { phase: 'idle', dataset: null, installation: null, checkedAt: null,
  message: 'Loading local spell catalog…', error: null, storageBytes: 0 }
let current = EMPTY
const listeners = new Set<() => void>()
let release: (() => void) | null = null
let turn = 0
function accept(status: SpellLibraryStatus): void {
  current = status
  for (const listener of listeners) listener()
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!release && window.eq.spellLibrary) {
    const mine = ++turn
    let observed = false
    release = window.eq.spellLibrary.onStatus((status) => { observed = true; if (turn === mine) accept(status) })
    void window.eq.spellLibrary.status().then((status) => {
      if (turn === mine && !observed) accept(status)
    }).catch(() => { /* The view retains the latest status subscription while startup retries. */ })
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) { release?.(); release = null; turn++ }
  }
}
export function spellRevisionKey(): string { return `${current.installation ?? ''}:${current.dataset?.snapshotId ?? 'pending'}` }
export function useSpellLibraryStatus(): SpellLibraryStatus { return useSyncExternalStore(subscribe, () => current) }
export function useSpellRevision(): string { return useSyncExternalStore(subscribe, spellRevisionKey) }
