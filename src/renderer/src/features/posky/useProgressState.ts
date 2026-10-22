import { useCallback, useEffect, useRef, useState } from 'react'
import { MODULE_WORLD_CHANGED, type ProgressState } from '../../../../shared/types'

/** Keep asynchronous store reads and action replies inside the world that requested them. */
export function useProgressState(): {
  progress: ProgressState | null
  character: string | null
  world: Readonly<{ current: number }>
  setProgress: (progress: ProgressState) => void
} {
  const [progress, applyProgress] = useState<ProgressState | null>(null)
  const [character, setCharacter] = useState<string | null>(null)
  const world = useRef(0)
  const [generation, setGeneration] = useState(0)
  const mounted = useRef(false)
  const readTicket = useRef(0)
  const setProgress = useCallback((next: ProgressState): void => {
    if (!mounted.current || generation !== world.current) return
    readTicket.current++
    applyProgress(next)
  }, [generation])

  useEffect(() => {
    let alive = true
    mounted.current = true
    setGeneration(world.current)
    const refreshProgress = (): void => {
      const epoch = world.current
      const issued = ++readTicket.current
      void window.eq.getProgress().then((next) => {
        if (alive && epoch === world.current && issued === readTicket.current) applyProgress(next)
      }, () => undefined)
    }
    const refreshCharacter = (): void => {
      const epoch = world.current
      void window.eq.getCharacter().then((next) => {
        if (alive && epoch === world.current) setCharacter(next?.name ?? null)
      }, () => undefined)
    }
    const invalidate = (): void => { world.current++ }
    const reset = (): void => {
      invalidate()
      readTicket.current++
      applyProgress(null)
      setGeneration(world.current)
    }
    const offProgress = window.eq.onProgress((next) => {
      if (!alive) return
      readTicket.current++ // A push is newer than any outstanding read.
      applyProgress(next)
    })
    const offInv = window.eq.onInventoryReload(refreshProgress)
    const offChar = window.eq.onCharacter((next) => {
      reset()
      setCharacter(next?.name ?? null)
      refreshProgress()
    })
    const offWorld = window.eq.onModuleChanged((change) => {
      if (change.moduleId !== MODULE_WORLD_CHANGED) return
      reset()
      setCharacter(null)
      refreshCharacter()
      refreshProgress()
    })
    refreshProgress()
    refreshCharacter()
    return () => {
      alive = false
      mounted.current = false
      invalidate()
      offProgress()
      offInv()
      offChar()
      offWorld()
    }
  }, [])
  return { progress, character, world, setProgress }
}
