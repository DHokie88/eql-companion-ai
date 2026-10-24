import { useEffect, useState, type JSX } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { CommunityCategory, CommunityFeed } from '@shared/oracle'
import { AskOracle, sourceDate } from '../oracle/AskOracle'

const categories: Record<CommunityCategory, string> = { all: 'All updates', patches: 'Patch notes', highlights: 'Highlights', issues: 'Bug reports', classes: 'Class discussions', guides: 'Guides', events: 'Guild events' }
function checkedTime(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Unavailable'
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value))
}
function RefreshNotices({ snapshot }: { snapshot?: CommunityFeed['snapshot'] }): JSX.Element {
  return <>
    {snapshot?.refreshWarning && <Alert severity="warning">{snapshot.refreshWarning}</Alert>}
    {snapshot?.lastCheckedAt && Date.now() - Date.parse(snapshot.lastCheckedAt) > 12 * 60 * 60_000 && <Alert severity="warning">The last successful Discord check was over 12 hours ago. Updates may be delayed.</Alert>}
  </>
}
export default function CommunityView(): JSX.Element {
  const [feed, setFeed] = useState<CommunityFeed | null>(null)
  const [scope, setScope] = useState<'all' | 'official' | 'guild'>('all')
  const [category, setCategory] = useState<CommunityCategory>('all')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    setBusy(true); setError('')
    const refresh = (): void => {
      void window.eq.getCommunityFeed({ scope, category, query, offset, limit: 25 }).then(result => {
        if (alive) setFeed(result)
      }).catch(() => { if (alive) { setFeed(null); setError('The Discord snapshot could not be loaded. Check the imported package and try again.') } })
        .finally(() => { if (alive) setBusy(false) })
    }
    const timer = setTimeout(refresh, query ? 250 : 0)
    const interval = setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    return () => { alive = false; clearTimeout(timer); clearInterval(interval); window.removeEventListener('focus', refresh) }
  }, [scope, category, query, offset])
  return <Box sx={{ p: 3, height: '100%', overflow: 'auto' }} data-testid="community-view"><Stack spacing={2} sx={{ maxWidth: 1150, mx: 'auto' }}>
    <Box><Typography variant="h4">What’s New</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>EQL updates and conversations, with a path back to the original post.</Typography></Box>
    <Paper variant="outlined" sx={{ p: 2 }}><AskOracle initialScope="discord" /></Paper>
    {feed && <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap"><Chip size="small" variant="outlined" label={`${feed.snapshot.recordCount.toLocaleString()} saved Discord records`} /><Chip size="small" variant="outlined" label={`Last checked: ${checkedTime(feed.snapshot.lastCheckedAt)}`} /><Chip size="small" variant="outlined" label={`Latest saved message: ${sourceDate(feed.snapshot.latestMessageDate)}`} /><Chip size="small" variant="outlined" label={`Package assembled: ${sourceDate(feed.snapshot.exportedAt)}`} /></Stack>}
    <Typography variant="caption" color="text.secondary">Discord checks: 7 a.m., 3 p.m. and 9 p.m. Eastern. Updates appear automatically after each completed refresh.</Typography>
    <RefreshNotices snapshot={feed?.snapshot} />
    <Alert severity="info">This is a saved Discord snapshot. “Official server” identifies where a post appeared; it does not verify a player’s claim. Guild shop prices are historical posts.</Alert>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      <TextField size="small" select label="Server" value={scope} onChange={e => { setScope(e.target.value as typeof scope); setOffset(0) }} sx={{ minWidth: 170 }}>
        <MenuItem value="all">Both servers</MenuItem><MenuItem value="official">Official server</MenuItem><MenuItem value="guild">Guild server</MenuItem>
      </TextField>
      <TextField size="small" select label="Show" value={category} onChange={e => { setCategory(e.target.value as CommunityCategory); setOffset(0) }} sx={{ minWidth: 190 }}>
        {Object.entries(categories).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
      </TextField>
      <TextField size="small" fullWidth label="Search updates" value={query} onChange={e => { setQuery(e.target.value); setOffset(0) }} slotProps={{ htmlInput: { maxLength: 200, 'data-testid': 'community-search' } }} />
    </Stack>
    {busy && <Stack direction="row" spacing={1} role="status"><CircularProgress size={18} /><Typography>Loading saved updates…</Typography></Stack>}
    {error && <Alert severity="error">{error}</Alert>}
    {feed && !busy && <>
      <Typography variant="body2" color="text.secondary" data-testid="community-count">{feed.total === 0 ? 'No matching updates.' : `${offset + 1} - ${Math.min(offset + 25, feed.total)} of ${feed.total.toLocaleString()} updates`}</Typography>
      {feed.entries.map(entry => <Accordion key={entry.id} variant="outlined" disableGutters data-testid="community-entry">
        <AccordionSummary expandIcon={<ExpandMoreIcon />}><Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap"><Chip size="small" label={categories[entry.category]} /><Typography variant="caption" color="text.secondary">{sourceDate(entry.date)} · {entry.origin === 'official' ? 'Official server' : 'Guild server'} · {entry.author ?? 'Author unavailable'}</Typography></Stack>
          <Typography variant="subtitle1" sx={{ overflowWrap: 'anywhere' }}>{entry.title}</Typography>
        </Stack></AccordionSummary>
        <AccordionDetails><Typography variant="caption" color="text.secondary">{entry.caveat}</Typography><Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', mt: 1 }}>{entry.body}</Typography>
          {entry.url ? <Button sx={{ mt: 1 }} size="small" onClick={() => void window.eq.openOracleSource(entry.url ?? '').catch(() => setError('The source link could not be opened.'))}>Open original post</Button> : <Typography variant="caption">Source link unavailable</Typography>}
        </AccordionDetails>
      </Accordion>)}
      <Stack direction="row" spacing={1}><Button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</Button><Button disabled={offset + 25 >= feed.total} onClick={() => setOffset(offset + 25)}>Next</Button></Stack>
    </>}
    {feed && <Accordion disableGutters variant="outlined"><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="subtitle2">Coverage and missing data</Typography></AccordionSummary><AccordionDetails><Stack spacing={1}>{feed.snapshot.coverageGaps.map(gap => <Typography variant="body2" color="text.secondary" key={gap}>{gap}</Typography>)}</Stack></AccordionDetails></Accordion>}
  </Stack></Box>
}
