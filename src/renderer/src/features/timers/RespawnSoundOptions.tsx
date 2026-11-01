import { useEffect, useState, type JSX } from 'react'
import { Box, Slider, Stack, Typography } from '@mui/material'
import type { AlertSoundRef, SoundPack } from '@shared/types'
import { resolveRespawnSound } from './respawnAudio'
import SoundPicker from '../alerts/SoundPicker'
import { DEFAULT_PACK_ID } from '../alerts/suggestions'

function useInstalledSounds(): {
  packs: SoundPack[]
  defaultPackId: string
  loaded: boolean
  failed: boolean
} {
  const [packs, setPacks] = useState<SoundPack[]>([])
  const [defaultPackId, setDefaultPackId] = useState(DEFAULT_PACK_ID)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    const load = (): void => {
      void Promise.all([window.eq.listSoundPacks(), window.eq.getSoundPackPrefs()])
        .then(([next, prefs]) => {
          if (!active) return
          setPacks(next)
          setDefaultPackId(prefs.defaultPackId ?? DEFAULT_PACK_ID)
          setLoaded(true)
          setFailed(false)
        })
        .catch(() => {
          if (active) {
            setFailed(true)
            setLoaded(true)
          }
        })
    }
    const off = window.eq.onSoundPacksChanged(load)
    load()
    return () => {
      active = false
      off()
    }
  }, [])
  return { packs, defaultPackId, loaded, failed }
}

/** Shares the installed-pack list with Alerts, including My sounds; follows live pack changes. */
export function RespawnSoundOptions({
  sound,
  volume,
  onSound,
  onVolume
}: {
  sound?: AlertSoundRef
  volume: number
  onSound: (sound: AlertSoundRef) => void
  onVolume: (volume: number) => void
}): JSX.Element {
  const { packs, defaultPackId, loaded, failed } = useInstalledSounds()
  const resolved = resolveRespawnSound(sound, packs, defaultPackId)
  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">
        Sound
      </Typography>
      {resolved.status !== 'missing' && (
        <Box
          data-testid="respawn-audio-picker"
          sx={{
            '& .MuiSelect-root': { minWidth: '0 !important', flex: 1, width: 0 },
            '& .MuiStack-root': { width: '100%' }
          }}
        >
          <SoundPicker
            packs={packs}
            packId={resolved.packId}
            soundId={resolved.soundId}
            defaultPackId={defaultPackId}
            onChange={(packId, soundId) => onSound({ packId, soundId })}
          />
        </Box>
      )}
      {resolved.status === 'substituted' && (
        <Typography variant="caption" color="warning.main">
          Selected sound unavailable; the displayed replacement will play.
        </Typography>
      )}
      {resolved.status === 'missing' && (
        <Typography variant="caption" color="text.secondary">
          {!loaded
            ? 'Loading sounds...'
            : failed
              ? 'Could not load sounds. Reopen to retry.'
              : 'No sound pack available. Add one in Alerts.'}
        </Typography>
      )}
      <Box>
        <Typography variant="caption" color="text.secondary">
          Timer volume ({Math.round(volume * 100)}%)
        </Typography>
        <Slider
          size="small"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          aria-label="Timer volume"
          data-testid="respawn-audio-volume"
          onChange={(_event, value) => onVolume(value as number)}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
        />
      </Box>
      <Typography variant="caption" color="text.secondary">
        Alerts master volume and mute also apply.
      </Typography>
    </Stack>
  )
}
