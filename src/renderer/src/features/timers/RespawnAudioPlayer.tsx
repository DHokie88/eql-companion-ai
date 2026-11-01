import { useEffect, useRef } from 'react'
import { RespawnAudioClock } from '@shared/respawnAudio'
import { useRespawnSnap, useSecondsClock } from './useRespawn'
import { playRespawnDing, useRespawnAudio } from './respawnAudio'

/** Mounted once for the app, independent of the visible tab and the zone filter. */
export function RespawnAudioPlayer(): null {
  const snap = useRespawnSnap()
  const now = useSecondsClock()
  const { prefs, ready } = useRespawnAudio()
  const clock = useRef(new RespawnAudioClock())
  const watched = new Set(snap.prefs.watches.map((w) => w.key))
  const armed = ready && Object.keys(prefs).some((key) => watched.has(key))
  useEffect(() => {
    void window.eq.setRespawnAudioArmed(armed)
    return () => {
      void window.eq.setRespawnAudioArmed(false)
    }
  }, [armed])
  useEffect(() => {
    if (!ready) return
    const liveWatches = new Set(snap.prefs.watches.map((w) => w.key))
    const fired = clock.current.tick(snap.rows, prefs, liveWatches, now)
    // Each timer keeps its selected sound and gain, including timers due together.
    for (const row of fired) void playRespawnDing(prefs[row.key])
  }, [snap, prefs, ready, now])
  return null
}
