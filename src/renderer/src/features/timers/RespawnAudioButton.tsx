import { useState, type JSX } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { formatRespawnDuration, parseRespawnDuration, type RespawnRow } from '@shared/respawn'
import type { RespawnAudioOption } from '@shared/respawnAudio'
import type { AlertSoundRef } from '@shared/types'
import { RespawnSoundOptions } from './RespawnSoundOptions'
import { playRespawnDing, useRespawnAudio } from './respawnAudio'

function LeadInput({
  draft,
  setDraft
}: {
  draft: string
  setDraft: (value: string) => void
}): JSX.Element {
  const parsed = parseRespawnDuration(draft)
  return (
    <TextField
      size="small"
      label="Time before expiry"
      value={draft}
      data-testid="respawn-audio-lead"
      onChange={(event) => setDraft(event.target.value)}
      error={!parsed.ok}
      helperText={
        parsed.ok
          ? `Warn ${formatRespawnDuration(parsed.sec)} before expiry`
          : 'Enter a duration such as 1m or 30s (1 second to 7 days).'
      }
    />
  )
}

function TimingFields({
  row,
  mode,
  draft,
  setMode,
  setDraft
}: {
  row: RespawnRow
  mode: string
  draft: string
  setMode: (mode: string) => void
  setDraft: (draft: string) => void
}): JSX.Element {
  const parsed = parseRespawnDuration(draft)
  return (
    <>
      <TextField
        select
        size="small"
        label="Play sound"
        value={mode}
        data-testid="respawn-audio-mode"
        onChange={(event) => setMode(event.target.value)}
      >
        <MenuItem value="off">Off</MenuItem>
        <MenuItem value="end">When it ends</MenuItem>
        <MenuItem value="before">Before it expires</MenuItem>
      </TextField>
      {mode === 'before' && <LeadInput draft={draft} setDraft={setDraft} />}
      {mode === 'before' &&
        parsed.ok &&
        row.estimateMs !== undefined &&
        parsed.sec * 1000 >= row.estimateMs && (
          <Typography variant="caption" color="warning.main">
            This warning is longer than the timer. It will wait for a longer timer.
          </Typography>
        )}
    </>
  )
}

function RespawnAudioDialog({
  row,
  option,
  onClose
}: {
  row: RespawnRow
  option?: RespawnAudioOption
  onClose: () => void
}): JSX.Element {
  const lead = option?.leadSec
  const [sound, setSound] = useState<AlertSoundRef | undefined>(option?.sound)
  const [volume, setVolume] = useState(option?.volume ?? 1)
  const [mode, setMode] = useState(lead === undefined ? 'off' : lead === 0 ? 'end' : 'before')
  const [draft, setDraft] = useState(lead ? formatRespawnDuration(lead) : '1m')
  const [message, setMessage] = useState('')
  const parsed = parseRespawnDuration(draft)
  const valid = mode !== 'before' || parsed.ok
  const save = async (): Promise<void> => {
    if (!valid) return
    try {
      await window.eq.setRespawnAudio(
        row.key,
        mode === 'off'
          ? null
          : { leadSec: mode === 'end' ? 0 : parsed.ok ? parsed.sec : 0, sound, volume }
      )
      onClose()
    } catch {
      setMessage('Could not save. Please try again.')
    }
  }
  return (
    <Dialog
      open
      onClose={() => onClose()}
      maxWidth="sm"
      fullWidth
      data-testid="respawn-audio-dialog"
    >
      <DialogTitle>Timer sound - {row.display}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TimingFields row={row} mode={mode} draft={draft} setMode={setMode} setDraft={setDraft} />
          <RespawnSoundOptions
            sound={sound}
            volume={volume}
            onSound={setSound}
            onVolume={setVolume}
          />
          {message && (
            <Typography variant="caption" role="status">
              {message}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          data-testid="respawn-audio-test"
          onClick={() => {
            void playRespawnDing({ leadSec: 0, sound, volume }).then(setMessage)
          }}
        >
          Test sound
        </Button>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!valid}
          data-testid="respawn-audio-save"
          onClick={() => {
            void save()
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function RespawnAudioButton({
  row,
  onOpenChange
}: {
  row: RespawnRow
  onOpenChange: (open: boolean) => void
}): JSX.Element {
  const { prefs } = useRespawnAudio()
  const option = Object.prototype.hasOwnProperty.call(prefs, row.key) ? prefs[row.key] : undefined
  const lead = option?.leadSec
  const [open, setOpen] = useState(false)
  const changeOpen = (next: boolean): void => {
    setOpen(next)
    onOpenChange(next)
  }
  const label =
    lead === undefined
      ? 'Sound off'
      : lead === 0
        ? 'Sound at end'
        : `Sound -${formatRespawnDuration(lead)}`
  return (
    <>
      <Button
        size="small"
        color={lead === undefined ? 'inherit' : 'primary'}
        data-testid="respawn-audio"
        aria-label={`Sound for ${row.display}`}
        onClick={(event) => {
          event.stopPropagation()
          changeOpen(true)
        }}
      >
        {label}
      </Button>
      {open && <RespawnAudioDialog row={row} option={option} onClose={() => changeOpen(false)} />}
    </>
  )
}
