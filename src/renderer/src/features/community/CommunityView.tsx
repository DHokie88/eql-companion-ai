import { useEffect, useState, type JSX } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import type { CommunityCategory, CommunityFeed } from '@shared/oracle'
import { AskOracle, sourceDate } from '../oracle/AskOracle'
import { CommunityCoverage } from './CommunityCoverage'
import { CommunityEntryCard } from './CommunityEntryCard'
import { DiscordRefreshControls } from './DiscordRefreshControls'

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
  const [category, setCategory] = useState<CommunityCategory>('highlights')
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
    window.addEventListener('oracle-refresh-complete', refresh)
    return () => { alive = false; clearTimeout(timer); clearInterval(interval); window.removeEventListener('focus', refresh); window.removeEventListener('oracle-refresh-complete', refresh) }
  }, [scope, category, query, offset])
  return <Box sx={{ p: 3, height: '100%', overflow: 'auto' }} data-testid="community-view"><Stack spacing={2} sx={{ maxWidth: 1150, mx: 'auto' }}>
    <Box><Typography variant="h4">New in EQL</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Must-read EQL news and opportunities, with the evidence one click away.</Typography></Box>
    <Paper variant="outlined" sx={{ p: 2 }}><AskOracle initialScope="discord" /></Paper>
    {feed && <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap"><Chip size="small" variant="outlined" label={`${feed.snapshot.recordCount.toLocaleString()} saved Discord records`} /><Chip size="small" variant="outlined" label={`Last checked: ${checkedTime(feed.snapshot.lastCheckedAt)}`} /><Chip size="small" variant="outlined" label={`Latest saved message: ${sourceDate(feed.snapshot.latestMessageDate)}`} /><Chip size="small" variant="outlined" label={`Package assembled: ${sourceDate(feed.snapshot.exportedAt)}`} /></Stack>}
    <DiscordRefreshControls onError={() => setError('The background check could not start. Try again in a moment.')} />
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
    {category === 'highlights' && <Typography variant="body2" color="text.secondary">Highlights explain what changed and why you should care: limited rewards, major releases, unusual bonuses and useful opportunities. Routine questions and chat do not qualify. Quiet days may have no highlights.</Typography>}
    {busy && <Stack direction="row" spacing={1} role="status"><CircularProgress size={18} /><Typography>Loading saved updates…</Typography></Stack>}
    {error && <Alert severity="error">{error}</Alert>}
    {feed && !busy && <>
      <Typography variant="body2" color="text.secondary" data-testid="community-count">{feed.total === 0 ? (category === 'highlights' ? 'No must-read highlights in the current snapshot match these filters.' : 'No matching updates.') : `${offset + 1} - ${Math.min(offset + 25, feed.total)} of ${feed.total.toLocaleString()} ${category === 'highlights' ? 'highlights' : 'updates'}`}</Typography>
      {feed.entries.map(entry => <CommunityEntryCard key={entry.id} entry={entry} category={categories[entry.category]} onError={() => setError('The source link could not be opened.')} />)}
      <Stack direction="row" spacing={1}><Button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</Button><Button disabled={offset + 25 >= feed.total} onClick={() => setOffset(offset + 25)}>Next</Button></Stack>
    </>}
    {feed && <CommunityCoverage notes={feed.snapshot.coverageGaps} />}
  </Stack></Box>
}
