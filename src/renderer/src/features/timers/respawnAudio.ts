import { useEffect, useState } from 'react'
import type { RespawnAudioOption, RespawnAudioPrefs } from '@shared/respawnAudio'
import type { AlertSoundRef, SoundPack } from '@shared/types'
import { fallbackPack } from '../alerts/SoundPicker'
import { resolveSoundRef, type SoundRefResolution } from '@shared/soundPacks'
import { playSound } from '../alerts/soundCache'
import { currentPrefs } from '../alerts/player'
import { DEFAULT_PACK_ID } from '../alerts/suggestions'

let cached: RespawnAudioPrefs = {}
let ready = false
let started = false
const listeners = new Set<() => void>()
function receive(prefs: RespawnAudioPrefs): void {
  cached = prefs
  ready = true
  for (const listener of listeners) listener()
}
export function useRespawnAudio(): {
  prefs: RespawnAudioPrefs
  ready: boolean
} {
  const [, render] = useState(0)
  useEffect(() => {
    const update = (): void => render((v) => v + 1)
    listeners.add(update)
    if (!started) {
      started = true
      let pushed = false
      window.eq.onRespawnAudio((prefs) => {
        pushed = true
        receive(prefs)
      })
      void window.eq.getRespawnAudio().then((prefs) => {
        if (!pushed) receive(prefs)
      })
    }
    update()
    return () => {
      listeners.delete(update)
    }
  }, [])
  return { prefs: cached, ready }
}

/** Use the same fallback pack as Alerts' picker, and resolve missing refs visibly in the editor. */
export function resolveRespawnSound(
  sound: AlertSoundRef | undefined,
  packs: SoundPack[],
  preferred?: string
): SoundRefResolution {
  const packId = fallbackPack(packs, preferred)?.id ?? preferred ?? DEFAULT_PACK_ID
  const soundId = 'task-acknowledge-blip-02'
  return resolveSoundRef(sound ?? { packId, soundId }, packs, {
    defaultPackId: packId,
    fallbackSoundId: soundId
  })
}

/** The installed pack resolver and the alert player's sound/volume seam, also used by Test. */
export async function playRespawnDing(option?: RespawnAudioOption): Promise<string> {
  const volume = currentPrefs()
  if (volume.muted || volume.globalVolume <= 0) return 'Sound is muted in Alerts.'
  try {
    const [packs, prefs] = await Promise.all([
      window.eq.listSoundPacks(),
      window.eq.getSoundPackPrefs()
    ])
    const ref = resolveRespawnSound(option?.sound, packs, prefs.defaultPackId)
    if (ref.status === 'missing') return 'No sound pack available. Add one in Alerts.'
    const result = await playSound(
      ref.packId,
      ref.soundId,
      volume.globalVolume * (option?.volume ?? 1)
    )
    return result.started ? 'Test sound played.' : 'Sound could not play. Check your audio output.'
  } catch {
    return 'Sound could not load. Check your sound pack in Alerts.'
  }
}
