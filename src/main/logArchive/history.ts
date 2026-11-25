import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { CHARACTER_LOG_NAME } from '../log/discovery'
import type { SealedFightArchive } from '../../shared/fightArchive'
import { readArchivedHistory, type ArchivedFight } from '../../shared/worth'
import { fightsInLogFile } from './sealedLog'

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

function addFight(fights: ArchivedFight[], row: ArchivedFight): void {
  fights.push(row)
}

/** JSON `{ fights: [] }` plus sealed log copies. The live `eqlog_*.txt` is never opened. */
function collectArchive(dir: string, live: string, fights: ArchivedFight[]): void {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    if (basename(name) === live) continue
    const path = join(dir, name)
    if (name.endsWith('.json')) {
      for (const row of fightsIn(path)) addFight(fights, row)
      continue
    }
    if (!name.endsWith('.txt') && !name.endsWith('.log')) continue
    for (const row of fightsInLogFile(path, name)) addFight(fights, row)
  }
}

/** Older `eqlog_*.txt` files beside the live one. The newest file is left unread. */
function collectSiblingLogs(logsDir: string, live: string, fights: ArchivedFight[]): void {
  if (!existsSync(logsDir)) return
  for (const name of readdirSync(logsDir)) {
    if (name === live || !CHARACTER_LOG_NAME.test(name)) continue
    for (const row of fightsInLogFile(join(logsDir, name), name)) addFight(fights, row)
  }
}

/**
 * Sealed fights from `Logs/archive` and from every `eqlog_*.txt` except the live one.
 * The live log is only named, never opened and never renamed.
 */
export function readSealedFights(logsDir: string): SealedFightArchive {
  const logName = liveLogName(logsDir)
  const fights: ArchivedFight[] = []
  collectArchive(join(logsDir, 'archive'), logName, fights)
  collectSiblingLogs(logsDir, logName, fights)
  const sealed: { count: number }[] = []
  for (const _fight of fights) sealed.push({ count: 1 })
  const history = readArchivedHistory({ count: 0 }, sealed, fights.length > 0, logName)
  return { fights, logName: history.logName }
}
