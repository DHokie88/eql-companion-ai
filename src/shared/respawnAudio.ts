import type { RespawnRow } from './respawn'
import type { AlertSoundRef } from './types'

/** Missing entry means off; zero lead means expiry. Optional fields preserve the original ding. */
export interface RespawnAudioOption {
  leadSec: number
  sound?: AlertSoundRef
  volume?: number
}
export type RespawnAudioPrefs = Record<string, RespawnAudioOption>
export const RESPAWN_AUDIO_MAX_SEC = 7 * 24 * 3600
const SAFE_SOUND_ID = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/
function safeSoundId(raw: unknown): raw is string {
  return typeof raw === 'string' && raw.length > 0 && raw.length <= 128 && SAFE_SOUND_ID.test(raw)
}
function normalizeSound(raw: unknown): AlertSoundRef | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const sound = raw as Partial<AlertSoundRef>
  if (
    !safeSoundId(sound.packId) ||
    typeof sound.soundId !== 'string' ||
    !sound.soundId.trim() ||
    sound.soundId.length > 128
  )
    return undefined
  return { packId: sound.packId, soundId: sound.soundId }
}
function validVolume(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}
/** Accept the original numeric store entries without moving their trigger or changing their ding. */
export function normalizeRespawnAudioOption(raw: unknown): RespawnAudioOption | undefined {
  const value = typeof raw === 'number' ? { leadSec: raw } : raw
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const option = value as Partial<RespawnAudioOption>
  const lead = option.leadSec
  if (
    typeof lead !== 'number' ||
    !Number.isInteger(lead) ||
    lead < 0 ||
    lead > RESPAWN_AUDIO_MAX_SEC
  )
    return undefined
  const clean: RespawnAudioOption = { leadSec: lead }
  const sound = normalizeSound(option.sound)
  if (sound) clean.sound = sound
  if (validVolume(option.volume)) clean.volume = option.volume
  return clean
}
export function normalizeRespawnAudio(raw: unknown): RespawnAudioPrefs {
  const out: RespawnAudioPrefs = Object.create(null) as RespawnAudioPrefs
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw).slice(0, 200)) {
    if (!key || key.length > 64 || key !== key.trim().toLowerCase()) continue
    const clean = normalizeRespawnAudioOption(value)
    if (clean)
      Object.defineProperty(out, key, {
        value: clean,
        enumerable: true,
        writable: true,
        configurable: true
      })
  }
  return out
}

interface AlarmState {
  base: number
  due: number
  last: number
  fired: boolean
}
/** Baseline silently; only crossing a future threshold fires. Long sleep/replay gaps are silent. */
function isActive(
  row: RespawnRow,
  lead: number | undefined,
  watched: ReadonlySet<string>
): boolean {
  if (lead === undefined || !watched.has(row.key) || row.estimateMs === undefined) return false
  if (lead * 1000 >= row.estimateMs) return false
  return row.seenTs === undefined || row.seenTs <= row.baseTs
}
function crosses(prior: AlarmState | undefined, state: AlarmState, now: number): boolean {
  if (prior?.base !== state.base || prior.due !== state.due || state.fired) return false
  return prior.last < state.due && state.due <= now && now >= prior.last && now - prior.last <= 5000
}
export class RespawnAudioClock {
  private states = new Map<string, AlarmState>()
  tick(
    rows: readonly RespawnRow[],
    prefs: RespawnAudioPrefs,
    watched: ReadonlySet<string>,
    now: number
  ): RespawnRow[] {
    const next = new Map<string, AlarmState>()
    const fired: RespawnRow[] = []
    for (const row of rows) {
      const lead = Object.prototype.hasOwnProperty.call(prefs, row.key)
        ? prefs[row.key]?.leadSec
        : undefined
      const prior = this.states.get(row.id)
      const state: AlarmState = {
        base: row.baseTs,
        due: row.baseTs + (row.estimateMs ?? 0) - (lead ?? 0) * 1000,
        last: now,
        fired: prior?.base === row.baseTs && prior.fired
      }
      const active = isActive(row, lead, watched)
      if (active && crosses(prior, state, now)) {
        state.fired = true
        fired.push(row)
      }
      if (!active) state.due = Number.NaN
      next.set(row.id, state)
    }
    this.states = next
    return fired
  }
}
