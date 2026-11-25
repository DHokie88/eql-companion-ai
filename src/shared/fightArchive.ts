import type { FightSearchHit, FightSearchResult } from './combat'
import { readArchivedHistory, searchArchivedFights, type ArchivedFight } from './worth'

export interface SealedFightArchive {
  fights: ArchivedFight[]
  /** The live log's file name. Reading sealed history does not change it. */
  logName: string
}

/** Live hits plus sealed matches. Empty query adds nothing. Newer start time first. */
export function mergeArchivedHits(
  live: FightSearchResult,
  sealed: readonly ArchivedFight[],
  query: string,
  logName: string
): FightSearchResult & { logName: string } {
  const extra = searchArchivedFights(sealed, query)
  const history = readArchivedHistory(
    { count: live.corpus },
    sealed.map(() => ({ count: 1 })),
    sealed.length > 0,
    logName
  )
  const seen = new Set(live.hits.map((hit) => hit.summary.id))
  const archived: FightSearchHit[] = []
  for (const fight of extra) {
    if (seen.has(fight.id)) continue
    archived.push({
      score: 1,
      summary: {
        id: fight.id,
        kind: 'fight',
        name: fight.name,
        zone: fight.zone,
        durationSec: 0,
        total: 0,
        dps: 0,
        activeSec: 0,
        activeDps: 0,
        startTs: fight.startTs,
        active: false,
        enemyHealTotal: 0
      }
    })
  }
  const hits = [...live.hits, ...archived].sort((a, b) => b.summary.startTs - a.summary.startTs || a.summary.id.localeCompare(b.summary.id))
  return { hits, corpus: history.value.count, logName: history.logName }
}
