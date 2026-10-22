import { useEffect, useMemo } from 'react'
import { EMPTY_SKY_OVERLAY, SKY_OVERLAY_KEY } from '../../../../shared/skyQuestOverlay'
import { MODULE_WORLD_CHANGED } from '../../../../shared/types'
import { useQuestFavorites } from '../favorites/useQuestFlags'
import { fetchItemMarks, useItemMarksReader } from '../../lib/itemMarks'
import { skyOverlayRows } from './skyOverlayRows'
import type { QuestProgress } from './useProgress'

// The Sky quest overlay's feed (sky-quest-overlay): the starred quests, as the Sky tab counts them,
// written to the storage the overlay window shares with this one (shared/skyQuestOverlay.ts). Item
// icons come from `items:marks`, the committed item database only, never the wiki.

/** Keep the overlay's rows in step with `quests`; a write happens only when they change. */
export function useSkyOverlayFeed(
  quests: readonly QuestProgress[],
  loaded: boolean,
  world: Readonly<{ current: number }>
): void {
  const generation = world.current
  const starred = useQuestFavorites()
  const marksOf = useItemMarksReader()
  const shown = useMemo(() => quests.filter((q) => starred.has(q.key)), [quests, starred])
  // One batched ask per new set of item names; a name already asked is not asked again.
  const names = useMemo(() => [...new Set(shown.flatMap((q) => q.items.map((it) => it.name)))].join('\n'), [shown])
  useEffect(() => {
    if (names) void fetchItemMarks(names.split('\n'))
  }, [names])
  const raw = useMemo(() => {
    const rows = loaded ? skyOverlayRows(shown, marksOf) : []
    return JSON.stringify({ loaded, rows })
  }, [shown, loaded, marksOf])
  useEffect(() => {
    const reset = (): void => writePayload(JSON.stringify(EMPTY_SKY_OVERLAY))
    const offCharacter = window.eq.onCharacter(reset)
    const offWorld = window.eq.onModuleChanged((change) => {
      if (change.moduleId === MODULE_WORLD_CHANGED) reset()
    })
    return () => {
      reset()
      offCharacter()
      offWorld()
    }
  }, [])
  useEffect(() => {
    // A reset can arrive after render but before this effect; never republish that render's rows.
    if (generation === world.current) writePayload(raw)
  }, [raw, generation, world])
}

function writePayload(raw: string): void {
  try {
    if (localStorage.getItem(SKY_OVERLAY_KEY) !== raw) localStorage.setItem(SKY_OVERLAY_KEY, raw)
  } catch {
    // Storage refused the write: keep the main-window tracker usable.
  }
}
