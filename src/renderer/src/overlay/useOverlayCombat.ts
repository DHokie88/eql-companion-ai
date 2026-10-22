import { useLayoutEffect, useRef, useState } from 'react'
import { createCombatFeed, subscribeCombatFeed, type CombatFeed, type CombatFeedView } from '../features/combat/combatFeed'

/**
 * Views the main-process combat engine for a floating overlay (Task #52; per-kind in Task #54).
 *
 * Same event-driven poll pattern as the main app's `useCombat` (immediate refresh on the throttled
 * `combat:activity` nudge + a 1s fallback poll for the idle "active" decay), pared down to what an
 * overlay needs. It talks to the engine over the minimal `window.eqOverlay` bridge.
 *
 * `selectedId` drives which segment the snapshot resolves (LIVE fight, a finalized fight, the live
 * zone, or a finalized zone session). No timeline is ever requested (overlays never show one).
 *
 * IT ASKS FOR EXACTLY WHAT THE MAIN WINDOW ASKS FOR — the authoritative sources, you and each pet
 * as their own row. There used to be a `combinePets` flag here (wired, wrongly, to whether the
 * overlay was a FIGHT meter), which had the engine fold the pet into a synthetic "You +pets"
 * source: a second answer to "what is my damage", visible side by side with the Combat tab's.
 * That fold is gone from the engine entirely; pet layout is `petRows.meterPanel`'s job now, on
 * both surfaces (owner ruling, 2026-08-04).
 */
export function useOverlayCombat(selectedId: string | undefined): CombatFeedView {
  const [view, setView] = useState<CombatFeedView>({ snap: null, updating: false })
  const feed = useRef<CombatFeed | null>(null)

  useLayoutEffect(() => {
    const current = createCombatFeed((opts) => window.eqOverlay.getCombatSnapshot(opts), setView)
    feed.current = current
    const stop = subscribeCombatFeed(window.eqOverlay, current)
    return () => { feed.current = null; stop() }
  }, [])

  useLayoutEffect(() => {
    // Modest selector payload; overlays never request a timeline.
    feed.current?.configure({ selectedId, maxSegments: 30 })
  }, [selectedId])

  return view
}
