import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { CHARACTER_LOG_NAME } from '../log/discovery'
import type { SealedFightArchive } from '../../shared/fightArchive'
import { readArchivedHistory, type ArchivedFight } from '../../shared/worth'

function liveLogName(logsDir: string): string {
  if (!existsSync(logsDir)) return ''
  let best = ''
  let bestMs = -1
  for (const name of readdirSync(logsDir)) {
    if (!CHARACTER_LOG_NAME.test(name)) continue
    let ms = 0
    try { ms = statSync(join(logsDir, name)).mtimeMs } catch { continue }
    if (ms >= bestMs) { bestMs = ms; best = name }
  }
  return best
}

function fightsIn(file: string): ArchivedFight[] {
  let raw: unknown
  try { raw = JSON.parse(readFileSync(file, 'utf8')) } catch { return [] }
  const rows = raw && typeof raw === 'object' && Array.isArray((raw as { fights?: unknown }).fights)
    ? (raw as { fights: unknown[] }).fights
    : []
  const fights: ArchivedFight[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const fight = row as { id?: unknown; name?: unknown; zone?: unknown; startTs?: unknown }
    if (typeof fight.id !== 'string' || typeof fight.name !== 'string' || typeof fight.startTs !== 'number') continue
    fights.push({
      id: fight.id,
      name: fight.name,
      ...(typeof fight.zone === 'string' ? { zone: fight.zone } : {}),
      startTs: fight.startTs
    })
  }
  return fights
}

/**
 * Read `Logs/archive/*.json`. Each file is `{ "fights": [...] }`.
 * The live `eqlog_*.txt` is only named, never opened for write and never renamed.
 */
export function readSealedFights(logsDir: string): SealedFightArchive {
  const logName = liveLogName(logsDir)
  const dir = join(logsDir, 'archive')
  const fights: ArchivedFight[] = []
  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.json') || basename(name) === logName) continue
      fights.push(...fightsIn(join(dir, name)))
    }
  }
  const history = readArchivedHistory({ count: 0 }, fights.map(() => ({ count: 1 })), fights.length > 0, logName)
  return { fights, logName: history.logName }
}
