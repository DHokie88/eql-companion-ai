import { useEffect, useState, type JSX } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Button, Stack, TextField, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { DEFAULT_ORACLE_CONNECTION, type OracleConnection as Connection, type OracleStatus } from '@shared/oracle'

export function OracleConnection(): JSX.Element {
  const [connection, setConnection] = useState<Connection>(DEFAULT_ORACLE_CONNECTION)
  const [status, setStatus] = useState<OracleStatus | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    void window.eq.getOracleStatus().then(s => { if (alive) { setStatus(s); setConnection(s.connection) } }).catch(() => { if (alive) setError('Connection settings could not be read.') })
    return () => { alive = false }
  }, [])
  const save = async (test: boolean): Promise<void> => {
    setBusy(true); setError('')
    try {
      const saved = await window.eq.configureOracle(connection)
      setStatus(test ? await window.eq.testOracleConnection() : saved)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the connection.') }
    finally { setBusy(false) }
  }
  return <Accordion variant="outlined" disableGutters data-testid="oracle-connection">
    <AccordionSummary expandIcon={<ExpandMoreIcon />}><Stack><Typography variant="subtitle2">Global assistant connection</Typography><Typography variant="caption" color="text.secondary">One local model for every question box in EQ Oracle</Typography></Stack></AccordionSummary>
    <AccordionDetails><Stack spacing={2}>
      <Typography variant="body2">Uses your existing access to aw. Only your question and selected reference excerpts are sent to the local model. No paid AI service is used.</Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField size="small" label="Computer alias" value={connection.host} disabled={busy} onChange={e => setConnection({ ...connection, host: e.target.value })} helperText="Existing SSH alias, usually aw" />
        <TextField size="small" label="Address override (optional)" value={connection.address} disabled={busy} onChange={e => setConnection({ ...connection, address: e.target.value })} helperText="For example, its Tailscale or LAN address" />
        <TextField size="small" label="Local model" value={connection.model} disabled={busy} onChange={e => setConnection({ ...connection, model: e.target.value })} />
      </Stack>
      <Stack direction="row" spacing={1}><Button disabled={busy} onClick={() => void save(false)}>Save</Button><Button variant="outlined" disabled={busy} onClick={() => void save(true)}>{busy ? 'Checking…' : 'Save & test connection'}</Button></Stack>
      {status && <Alert severity={status.available === false ? 'warning' : status.available ? 'success' : 'info'}>{status.message}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
    </Stack></AccordionDetails>
  </Accordion>
}
