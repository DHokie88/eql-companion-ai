import { LEVEL_MAX } from '../leveling/viewedLevel'

/** Browse eligibility steppers stop at the Leveling tab's ceiling, not the parser's 255. */
export const BROWSE_LEVEL_MIN = 0
export const BROWSE_LEVEL_MAX = LEVEL_MAX

export type BrowseLevelSource = 'who' | 'stated' | 'fallback'

/**
 * Automatic Max is the latest valid `/who` (`CharacterSnap.lastWho`).
 * A stated level is only the fallback when no `/who` is in range.
 * With neither, Max is LEVEL_MAX and the caption does not claim a detected level.
 * Missing and out-of-range values are never treated as level 0.
 */
export function automaticBrowseMax(lastWho: number | null | undefined, stated: number | null | undefined): { level: number; source: BrowseLevelSource } {
  if (wholeCharacterLevel(lastWho)) return { level: lastWho, source: 'who' }
  if (wholeCharacterLevel(stated)) return { level: stated, source: 'stated' }
  return { level: BROWSE_LEVEL_MAX, source: 'fallback' }
}

export function browseLevelCaption(source: BrowseLevelSource, level: number): string {
  if (source === 'who') return `Max from latest /who · ${level}`
  if (source === 'stated') return `No /who yet · character level ${level}`
  return `No known character level · max ${level}`
}

function wholeCharacterLevel(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= BROWSE_LEVEL_MAX
}

/** Arrow steps reject a move that would leave the band or invert Min and Max. */
export function stepBrowseLevel(current: number, delta: number, other: number, side: 'min' | 'max'): number {
  const next = current + delta
  if (!Number.isInteger(next) || next < BROWSE_LEVEL_MIN || next > BROWSE_LEVEL_MAX) return current
  if (side === 'min' && next > other) return current
  if (side === 'max' && next < other) return current
  return next
}

/** Whole numbers commit. Values above the ceiling clamp. An inverted draft is rejected and left invalid. */
export function commitBrowseLevel(draft: string, other: number, side: 'min' | 'max'): { ok: true; value: number } | { ok: false; error: string } {
  const text = draft.trim()
  if (!/^\d+$/.test(text)) return { ok: false, error: 'Enter a whole spell level.' }
  let value = Number(text)
  if (value > BROWSE_LEVEL_MAX) value = BROWSE_LEVEL_MAX
  if (side === 'min' && value > other) return { ok: false, error: 'Minimum spell level must not exceed maximum spell level.' }
  if (side === 'max' && value < other) return { ok: false, error: 'Minimum spell level must not exceed maximum spell level.' }
  return { ok: true, value }
}
