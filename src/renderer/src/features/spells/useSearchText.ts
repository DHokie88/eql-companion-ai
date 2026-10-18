import { useEffect, useState } from 'react'

/** Keep typing immediate while coalescing full-catalog searches on the query worker. */
export function useSearchText(text: string): string {
  const [query, setQuery] = useState(text)
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), 200)
    return () => { clearTimeout(timer) }
  }, [text])
  return query
}
