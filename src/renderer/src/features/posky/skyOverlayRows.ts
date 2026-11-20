// Project the existing Sky progress without recounting inventory, achievements or turn-ins.
import { orderSkyOverlayRows, type SkyOverlayRow } from '../../../../shared/skyQuestOverlay'
import type { ItemMarks } from '../../../../shared/itemKnowledge'
import { hasEveryItem } from './questCompletion'
import type { QuestProgress } from './useProgress'

type OverlayQuest = Pick<QuestProgress, 'key' | 'className' | 'name' | 'reward' | 'giver' | 'needCount' | 'missing'> & {
  items: readonly Pick<QuestProgress['items'][number], 'name' | 'have' | 'need'>[]
}

export function skyOverlayRows(
  quests: readonly OverlayQuest[],
  marksOf: (name: string) => Pick<ItemMarks, 'iconId'> | undefined
): SkyOverlayRow[] {
  return orderSkyOverlayRows(quests.map((q) => ({
    key: q.key,
    className: q.className,
    name: q.name,
    reward: q.reward,
    giver: q.giver,
    items: q.items.map((it) => ({ name: it.name, have: it.have, need: it.need, iconId: marksOf(it.name)?.iconId })),
    ready: hasEveryItem(q)
  })))
}
