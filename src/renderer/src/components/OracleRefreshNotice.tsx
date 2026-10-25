import { useEffect, useState, type JSX } from 'react'
import { Alert, Button, Snackbar } from '@mui/material'
import { ORACLE_REFRESH_COMPLETE_EVENT, type OracleRefreshStatus } from '@shared/oracleRefresh'

/** Stays mounted while the player uses other pages; a check never takes focus. */
export default function OracleRefreshNotice(): JSX.Element {
  const [status, setStatus] = useState<OracleRefreshStatus | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let alive = true
    let previous: OracleRefreshStatus['state'] | undefined
    const update = (next: OracleRefreshStatus): void => {
      if (!alive) return
      setStatus(next)
      if (next.state !== previous) setOpen(next.state !== 'idle')
      previous = next.state
      if (next.state === 'complete') window.dispatchEvent(new Event(ORACLE_REFRESH_COMPLETE_EVENT))
    }
    const unsubscribe = window.eq.onOracleRefresh(update)
    void window.eq.getOracleRefreshStatus().then(update).catch(() => {
      if (alive) { setStatus({ state: 'failed', lastCheckedAt: null, message: 'The background Discord check is unavailable. Saved updates remain available.' }); setOpen(true) }
    })
    return () => { alive = false; unsubscribe() }
  }, [])
  const busy = status?.state === 'running' || status?.state === 'queued'
  return <Snackbar open={open} autoHideDuration={busy ? null : 10_000} onClose={() => setOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
    <Alert severity={status?.state === 'failed' ? 'warning' : status?.state === 'complete' ? 'success' : 'info'}
      variant="filled" onClose={() => setOpen(false)} data-testid="oracle-refresh-notice"
      action={busy ? undefined : <Button color="inherit" size="small" onClick={() => { void window.eq.requestOracleRefresh().catch(() => { setStatus({ state: 'failed', lastCheckedAt: null, message: 'The Discord check could not start. Saved updates remain available.' }); setOpen(true) }) }}>Check now</Button>}>
      {status?.message}
    </Alert>
  </Snackbar>
}
