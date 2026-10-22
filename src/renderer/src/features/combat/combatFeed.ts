// One consumer's combat reads, serialized across option and world changes. A hydrating stand-in
// means a temporarily unserved read; keep the last real answer only for the same world/selection.
// No cross-mount cache: this protocol does not carry a world id on combat snapshots.
import type { CombatSnapshot, SnapshotOpts } from '../../../../shared/combat'
import { MODULE_WORLD_CHANGED, type ModuleChanged } from '../../../../shared/types'

export interface CombatFeedView {
  snap: CombatSnapshot | null
  updating: boolean
}

export interface CombatFeed {
  configure: (opts: SnapshotOpts) => void
  refresh: () => void
  resetWorld: () => void
  dispose: () => void
}

/** IPC offers no cancellation. A reset invalidates the pending answer and queues ONE fresh read
 * behind it, instead of overlapping requests or letting a late old-character result repaint. */
export function createCombatFeed(
  read: (opts: SnapshotOpts) => Promise<CombatSnapshot>,
  show: (view: CombatFeedView) => void
): CombatFeed {
  let alive = true
  let inFlight = false
  let pending = false
  let generation = 0
  let opts: SnapshotOpts | null = null
  let last: CombatSnapshot | null = null

  const clear = (): void => {
    last = null
    show({ snap: null, updating: false })
  }
  const accept = (snap: CombatSnapshot): void => {
    if (!snap.hydrating) last = snap
    show({ snap: last ?? snap, updating: snap.hydrating && last !== null })
  }
  const readOnce = async (request: SnapshotOpts, issued: number): Promise<void> => {
    let snap: CombatSnapshot
    try {
      snap = await read(request)
    } catch {
      // Retry on the next poll; never resurrect an answer invalidated during the await.
      if (alive && issued === generation) show({ snap: last, updating: last !== null })
      return
    }
    if (alive && issued === generation) accept(snap)
  }
  const drain = async (): Promise<void> => {
    if (inFlight || !alive || !opts) return
    inFlight = true
    try {
      while (pending && alive && opts) {
        pending = false
        const issued = generation
        const request = opts
        if (last) show({ snap: last, updating: true })
        await readOnce(request, issued)
      }
    } finally {
      inFlight = false
    }
  }
  const refresh = (): void => {
    if (!alive || !opts) return
    pending = true
    void drain()
  }
  return {
    configure: (next) => {
      if (!alive || JSON.stringify(opts) === JSON.stringify(next)) return
      const changedSelection = opts?.selectedId !== next.selectedId
      opts = { ...next }
      generation++
      if (changedSelection) clear()
      refresh()
    },
    refresh,
    resetWorld: () => {
      if (!alive) return
      generation++
      clear()
      refresh()
    },
    dispose: () => {
      alive = false
      pending = false
      last = null
      generation++
    }
  }
}

export interface CombatFeedBridge {
  onCombatActivity: (cb: () => void) => () => void
  onCharacter: (cb: () => void) => () => void
  onModuleChanged: (cb: (change: ModuleChanged) => void) => () => void
}

/** Both real rebuild signals matter: the engine can replace a world without changing characters. */
export function subscribeCombatFeed(bridge: CombatFeedBridge, feed: CombatFeed): () => void {
  const offActivity = bridge.onCombatActivity(feed.refresh)
  const offCharacter = bridge.onCharacter(feed.resetWorld)
  const offWorld = bridge.onModuleChanged((change) => {
    if (change.moduleId === MODULE_WORLD_CHANGED) feed.resetWorld()
  })
  const timer = setInterval(feed.refresh, 1000)
  return () => {
    feed.dispose()
    clearInterval(timer)
    offActivity()
    offCharacter()
    offWorld()
  }
}
