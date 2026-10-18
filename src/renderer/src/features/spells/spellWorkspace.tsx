import { createContext, type Dispatch, type ReactNode, type SetStateAction, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'

const Workspace = createContext('session')
const session = new Map<string, unknown>()
export function SpellWorkspace({ identity, children }: { identity: string; children: ReactNode }) {
  return <Workspace.Provider value={identity}>{children}</Workspace.Provider>
}
function load<T>(key: string, initial: T): T {
  try {
    const text = key.includes(':session:') ? undefined : localStorage.getItem(key)
    const saved: unknown = text ? JSON.parse(text) : session.get(key)
    return saved === undefined || saved === null ? initial : saved as T
  } catch { return initial }
}
/** UI preferences only, in Chromium's userData storage; characterless choices stay in memory. */
export function useSpellWorkspaceState<T>(name: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const identity = useContext(Workspace)
  const defaults = useRef(initial)
  const key = `eqo:spells:${identity}:${name}`
  const [saved, setSaved] = useState(() => ({ key, value: load(key, defaults.current) }))
  const value = saved.key === key ? saved.value : load(key, defaults.current)
  const update: Dispatch<SetStateAction<T>> = useCallback((action) => setSaved((previous) => {
    const current = previous.key === key ? previous.value : load(key, defaults.current)
    return { key, value: typeof action === 'function' ? (action as (v: T) => T)(current) : action }
  }), [key])
  useEffect(() => {
    if (saved.key !== key) { setSaved({ key, value: load(key, defaults.current) }); return }
    session.set(key, saved.value)
    if (!key.includes(':session:')) try { localStorage.setItem(key, JSON.stringify(saved.value)) } catch { /* Storage may be unavailable. */ }
  }, [key, saved])
  return [value, update]
}

export function useSpellPageReset(key: string, setPage: (page: number) => void): void {
  const previous = useRef(key)
  useEffect(() => {
    if (previous.current !== key) { previous.current = key; setPage(1) }
  }, [key, setPage])
}
export function useSpellScroll(name: string, ready: boolean): void {
  const identity = useContext(Workspace)
  useLayoutEffect(() => {
    if (!ready) return
    const key = `${identity}:scroll:${name}`
    let scroller = document.querySelector<HTMLElement>('[data-testid="spells-view"]')?.parentElement ?? null
    while (scroller && !['auto', 'scroll'].includes(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement
    if (!scroller) return
    const element = scroller
    element.scrollTop = Number(session.get(key) ?? 0)
    const save = (): void => { session.set(key, element.scrollTop) }
    element.addEventListener('scroll', save, { passive: true })
    return () => { element.removeEventListener('scroll', save) }
  }, [identity, name, ready])
}
