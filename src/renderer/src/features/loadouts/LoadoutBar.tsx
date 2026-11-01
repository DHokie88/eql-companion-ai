import { useEffect, useState, type JSX } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import type { CharacterLoadout } from '@shared/loadouts'
import type { ClassAbbr } from '@shared/classCombo'
import ClassPicker from '../profiles/ClassPicker'
import { useLoadouts } from './useLoadouts'
function EditLoadout({ value, close }: { value: CharacterLoadout; close: () => void }): JSX.Element {
  const api = useLoadouts()
  const [name, setName] = useState(value.name)
  const [classes, setClasses] = useState<ClassAbbr[]>(value.classes)
  const [error, setError] = useState<string | null>(null)
  const save = (): void => {
    void api.update({ kind: 'edit', id: value.id, name, classes }).then(close).catch((err: unknown) => setError(String(err)))
  }
  return <Dialog open onClose={close} maxWidth="sm" fullWidth>
    <DialogTitle>Edit {value.id.toUpperCase()}</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <TextField label="Loadout name" value={name} onChange={(e) => setName(e.target.value)} slotProps={{ htmlInput: { maxLength: 60 } }} data-testid="loadout-name" />
      <ClassPicker picked={classes} onToggle={(c) => setClasses((old) => old.includes(c) ? old.filter((x) => x !== c) : old.length < 3 ? [...old, c] : old)} />
      <Typography variant="body2">Class order: {classes.join(' / ') || 'Choose up to three classes'}</Typography>
      <Button onClick={() => setClasses(api.liveClasses)} disabled={!api.confirmed}>Use current /who classes</Button>
      <Typography variant="caption">Changing classes keeps the saved equipment dated and labelled with its original class mix. Build plans and actual gear are separate.</Typography>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack></DialogContent>
    <DialogActions><Button onClick={close}>Cancel</Button><Button onClick={save} disabled={api.busy} data-testid="loadout-save">Save</Button></DialogActions>
  </Dialog>
}
function LoadoutButton({ lo, selectedId, liveId, select, edit }: { lo: CharacterLoadout; selectedId?: string; liveId?: string; select: () => void; edit: () => void }): JSX.Element {
  return <Button variant={selectedId === lo.id ? 'contained' : 'outlined'} onClick={select} onDoubleClick={edit} data-testid={`loadout-${lo.id}`} sx={{ minWidth: 100 }}>
    <Box><Typography variant="caption" display="block">{lo.id.toUpperCase()} {liveId === lo.id ? '· LIVE' : ''}</Typography>
    <Typography variant="caption" display="block">{lo.classes.join(' / ') || 'Unassigned'}</Typography></Box>
  </Button>
}
function ContextLine(): JSX.Element {
  const { selected, following, liveClasses } = useLoadouts()
  const line = selected ? `${following ? 'Following live' : 'Viewing'}: ${selected.name} · ${selected.classes.join(' / ') || 'classes not set'}` : `Live: ${liveClasses.join(' / ') || 'classes not confirmed; use /who'}. Choose a loadout to set its classes.`
  return <Typography variant="caption" color="text.secondary" data-testid="loadout-context">{line}{selected?.capture ? ` · Equipment saved ${new Date(selected.capture.capturedAt).toLocaleString()}` : ''}</Typography>
}
function CaptureButton(): JSX.Element {
  const api = useLoadouts()
  const selected = api.selected
  const match = selected !== null && api.confirmed && selected.classes.slice().sort().join('/') === api.liveClasses.slice().sort().join('/')
  const save = (): void => { if (selected) void api.capture(selected.id).catch(() => { /* Shared error. */ }) }
  return <Button disabled={!match || api.busy} onClick={save} data-testid="loadout-capture">Save current equipment</Button>
}
export function LoadoutBar({ capture = false }: { capture?: boolean }): JSX.Element {
  const api = useLoadouts()
  const [editing, setEditing] = useState<CharacterLoadout | null>(null)
  useEffect(() => { setEditing(null) }, [api.state?.characterId])
  const selected = api.selected
  return <Stack spacing={0.75} sx={{ flexShrink: 0 }} data-testid="loadout-bar">
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
      <Button variant={api.following ? 'contained' : 'outlined'} onClick={() => api.select(null)} data-testid="loadout-follow">Follow live</Button>
      {api.state?.book.loadouts.map((lo) => <LoadoutButton key={lo.id} lo={lo} selectedId={selected?.id} liveId={api.live?.id} select={() => api.select(lo.id)} edit={() => setEditing(lo)} />)}
      <Button disabled={!selected} onClick={() => { if (selected) setEditing(selected) }} data-testid="loadout-edit">Edit loadout</Button>
      {capture && <CaptureButton />}
    </Stack>
    <ContextLine />
    {api.error && <Alert severity="warning">{api.error}</Alert>}
    {editing && <EditLoadout value={editing} close={() => setEditing(null)} />}
  </Stack>
}
