import type { FightSearchResult } from '../../../../shared/combat'
import { mergeArchivedHits, type SealedFightArchive } from '../../../../shared/fightArchive'

/** Live fight search plus sealed history. A sealed-history failure leaves the live hits in place. */
export async function searchPickerFights(
  query: string,
  limit: number,
  live: (text: string, limit: number) => Promise<FightSearchResult>,
  sealed: () => Promise<SealedFightArchive>
): Promise<FightSearchResult & { logName?: string }> {
  const found = await live(query, limit)
  try {
    const archive = await sealed()
    return mergeArchivedHits(found, archive.fights, query, archive.logName)
  } catch {
    return found
  }
}
