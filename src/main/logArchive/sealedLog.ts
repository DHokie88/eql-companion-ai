// Fight lines in a sealed log copy. The live file is never opened here.

import { readFileSync } from 'node:fs'
import { parseEqTimestamp } from '../../shared/spellKey'
import type { ArchivedFight } from '../../shared/worth'

const SLAIN = /^\[([^\]]+)\] You have slain (.+)!$/
const ENTERED = /^\[([^\]]+)\] You have entered (.+)\.$/

/** Slain lines in one log, with the zone from the latest `You have entered` line before each. */
export function fightsInLogText(text: string, fileId: string): ArchivedFight[] {
  const fights: ArchivedFight[] = []
  let zone: string | undefined
  let line = 0
  for (const raw of text.split(/\r?\n/)) {
    line += 1
    const entered = ENTERED.exec(raw)
    if (entered) {
      zone = entered[2]
      continue
    }
    const slain = SLAIN.exec(raw)
    if (!slain) continue
    fights.push({
      id: `${fileId}:${String(line)}`,
      name: slain[2],
      ...(zone === undefined ? {} : { zone }),
      startTs: parseEqTimestamp(slain[1])
    })
  }
  return fights
}

/** Read one sealed copy. A file that is not text contributes nothing. */
export function fightsInLogFile(file: string, fileId: string): ArchivedFight[] {
  try {
    return fightsInLogText(readFileSync(file, 'utf8'), fileId)
  } catch {
    return []
  }
}
