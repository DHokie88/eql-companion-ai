import { useEffect, useRef, useState, type JSX } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, CircularProgress, MenuItem, Stack, TextField, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { ORACLE_KINDS, type OracleAnswer, type OracleScope } from '@shared/oracle'

const labels: Record<OracleScope, string> = { all: 'All EQL references', discord: 'Discord', items: 'Items', spells: 'Spells', quests: 'Quests', mobs: 'Mobs', classes: 'Classes', help: 'EQ Oracle help' }
export function sourceDate(date: string | null): string { return date ? date.slice(0, 10) : 'Date unavailable' }
export function AskOracle({ initialScope = 'all', initialQuestion = '' }: { initialScope?: OracleScope; initialQuestion?: string }): JSX.Element {
  const [question, setQuestion] = useState(initialQuestion)
  const [scope, setScope] = useState<OracleScope>(initialScope)
  const [answer, setAnswer] = useState<OracleAnswer | null>(null)
  const [asked, setAsked] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const current = useRef<string | null>(null)
  useEffect(() => () => {
    if (current.current) void window.eq.cancelOracle(current.current).catch(() => undefined)
    current.current = null
  }, [])
  const ask = async (): Promise<void> => {
    if (busy || !question.trim()) return
    const id = crypto.randomUUID()
    current.current = id
    setBusy(true); setError(''); setAnswer(null); setAsked(question.trim())
    try {
      const result = await window.eq.askOracle({ id, question, scope })
      if (current.current === id) setAnswer(result)
    } catch (e) { if (current.current === id) setError(e instanceof Error ? e.message : 'The question could not be answered.') }
    finally { if (current.current === id) { current.current = null; setBusy(false) } }
  }
  return <Stack spacing={2} data-testid="oracle-ask">
    <Stack direction="row" spacing={1} alignItems="center"><AutoAwesomeIcon color="primary" /><Typography variant="h6">Ask EQ Oracle</Typography><Chip size="small" label="Local AI" variant="outlined" /></Stack>
    <Typography variant="body2" color="text.secondary">Ask about EQL. Answers use saved references and cite the evidence. Your live character, inventory and combat state are not included yet. Each question is independent.</Typography>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="flex-start">
      <TextField multiline minRows={2} maxRows={6} fullWidth label="Your EQL question" placeholder="What does Pillar of Fire do? Where does this item drop?" value={question}
        slotProps={{ htmlInput: { maxLength: 2000, 'data-testid': 'oracle-question' } }} disabled={busy} onChange={e => setQuestion(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void ask() } }} />
      <Stack spacing={1} sx={{ minWidth: 185 }}>
        <TextField select size="small" label="Search in" value={scope} disabled={busy} onChange={e => setScope(e.target.value as OracleScope)}>
          {ORACLE_KINDS.map(k => <MenuItem key={k} value={k}>{labels[k]}</MenuItem>)}
        </TextField>
        <Button variant="contained" disabled={busy || !question.trim()} onClick={() => void ask()} data-testid="oracle-submit">Ask Oracle</Button>
      </Stack>
    </Stack>
    {busy && <Stack direction="row" spacing={2} alignItems="center" role="status"><CircularProgress size={18} /><Typography variant="body2">Searching references and asking the local model…</Typography><Button onClick={() => { if (current.current) void window.eq.cancelOracle(current.current).catch(() => setError('Could not cancel the question.')) }}>Cancel</Button></Stack>}
    {error && <Alert severity="error">{error}</Alert>}
    {answer && <Box data-testid="oracle-answer" sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>{asked}</Typography>
      <Chip size="small" label={answer.mode === 'ai' ? `Answer · ${answer.model ?? 'local model'}` : 'Reference search'} sx={{ mb: 1 }} />
      <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{answer.answer}</Typography>
      {answer.notice && <Alert severity={answer.mode === 'ai' ? 'info' : 'warning'} sx={{ my: 2 }}>{answer.notice}</Alert>}
      {answer.citations.map(c => <Accordion key={c.number} disableGutters elevation={0} data-testid="oracle-citation" sx={{ borderTop: 1, borderColor: 'divider' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}><Stack><Typography variant="subtitle2">[{c.number}] {c.title}</Typography><Typography variant="caption" color="text.secondary">{labels[c.kind]} · {sourceDate(c.date)}</Typography></Stack></AccordionSummary>
        <AccordionDetails><Typography variant="caption" color="text.secondary">{c.attribution}</Typography><Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', my: 1 }}>{c.text}</Typography>
          {c.url ? <Button size="small" onClick={() => void window.eq.openOracleSource(c.url ?? '').catch(() => setError('The source link could not be opened.'))}>Open source</Button> : <Typography variant="caption">Source link unavailable</Typography>}
        </AccordionDetails>
      </Accordion>)}
    </Box>}
  </Stack>
}
