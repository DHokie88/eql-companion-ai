import { useEffect, useState, type JSX } from 'react'
import { Button, Stack, Typography } from '@mui/material'
import type { OracleRefreshStatus } from '@shared/oracleRefresh'

export function DiscordRefreshControls({ onError }: { onError: () => void }): JSX.Element {
  const [state, setState] = useState<OracleRefreshStatus['state']>('idle')
  useEffect(() => {
    let alive = true
    const unsubscribe = window.eq.onOracleRefresh(status => { if (alive) setState(status.state) })
    void window.eq.getOracleRefreshStatus().then(status => { if (alive) setState(status.state) }).catch(() => undefined)
    return () => { alive = false; unsubscribe() }
  }, [])
  const checkNow = (): void => {
    setState('queued')
    void window.eq.requestOracleRefresh().then(status => setState(status.state))
      .catch(() => { setState('failed'); onError() })
  }
  const busy = state === 'queued' || state === 'running'
  return <Stack direction="row" spacing={2} alignItems="center">
    <Typography variant="caption" color="text.secondary">Discord checks: 7 a.m., 3 p.m. and 9 p.m. Eastern, plus a background check after opening EQO. You can keep using the app while it runs.</Typography>
    <Button size="small" sx={{ flexShrink: 0 }} disabled={busy} onClick={checkNow}>{busy ? 'Checking…' : 'Check now'}</Button>
  </Stack>
}
