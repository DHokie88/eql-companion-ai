import { useEffect, useState } from 'react'
import { useSpellRevision } from './libraryState'

/** An old installation, revision, filter, or unmounted view may never replace a newer answer. */
export function useLibraryQuery<T>(load: () => Promise<T>, refresh?: string | null, enabled = true): { data: T | null; loading: boolean; error: string | null } {
  const revision = useSpellRevision()
  const [value, setValue] = useState<{ data: T | null; loading: boolean; error: string | null }>({ data: null, loading: true, error: null })
  useEffect(() => {
    if (!enabled) return
    let alive = true
    setValue({ data: null, loading: true, error: null })
    void load().then((data) => {
      if (alive) setValue({ data, loading: false, error: null })
    }).catch((error: unknown) => {
      if (alive) setValue({ data: null, loading: false, error: error instanceof Error ? error.message : String(error) })
    })
    return () => { alive = false }
  }, [load, revision, refresh, enabled])
  return value
}
