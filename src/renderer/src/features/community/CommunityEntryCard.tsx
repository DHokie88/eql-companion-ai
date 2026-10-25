import type { JSX } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { CommunityEntry } from '@shared/oracle'
import { sourceDate } from '../oracle/AskOracle'

const kinds = { 'limited-reward': 'Limited-time reward', release: 'New content', bonus: 'Unusual bonus', farming: 'Farming tip', sale: 'Limited-time sale', event: 'Event / giveaway', server: 'Server news', issue: 'Progression blocker' }
function SourceButton({ url, label, onError }: { url: string; label: string; onError: () => void }): JSX.Element {
  return <Button size="small" onClick={() => void window.eq.openOracleSource(url).catch(onError)}>{label}</Button>
}
export function CommunityEntryCard({ entry, category, onError }: { entry: CommunityEntry; category: string; onError: () => void }): JSX.Element {
  const highlight = entry.highlight
  if (highlight) return <Paper variant="outlined" sx={{ p: 2, borderLeft: 3, borderLeftColor: 'primary.main' }} data-testid="community-entry">
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip size="small" color="primary" variant="outlined" label={kinds[highlight.kind]} />
        <Chip size="small" variant="outlined" label={highlight.confidence === 'community-report' ? 'Player reports · unverified' : 'Announcement'} />
        <Typography variant="caption" color="text.secondary">{sourceDate(entry.date)} · {entry.origin === 'official' ? 'Official server' : 'Guild server'}</Typography>
      </Stack>
      <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>{entry.title}</Typography>
      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{entry.body}</Typography>
      <Typography variant="body2" color="text.secondary"><strong>Why it matters:</strong> {highlight.whyItMatters}</Typography>
      {highlight.expiresAt && <Typography variant="caption" color="warning.main">Ends {new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(highlight.expiresAt))}</Typography>}
      {!highlight.expiresAt && ['limited-reward', 'sale', 'event'].includes(highlight.kind) && <Typography variant="caption" color="warning.main">End time not provided — check the original post.</Typography>}
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {highlight.sources.map((link, i) => <SourceButton key={link.url} url={link.url} label={i === 0 ? 'Open original post' : link.label} onError={onError} />)}
        {highlight.relatedLinks.map(link => <SourceButton key={link.url} {...link} onError={onError} />)}
      </Stack>
      <Typography variant="caption" color="text.secondary">{entry.caveat}</Typography>
    </Stack>
  </Paper>
  return <Accordion variant="outlined" disableGutters data-testid="community-entry">
    <AccordionSummary expandIcon={<ExpandMoreIcon />}><Stack spacing={0.5} sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap"><Chip size="small" label={category} /><Typography variant="caption" color="text.secondary">{sourceDate(entry.date)} · {entry.origin === 'official' ? 'Official server' : 'Guild server'} · {entry.author ?? 'Author unavailable'}</Typography></Stack>
      <Typography variant="subtitle1" sx={{ overflowWrap: 'anywhere' }}>{entry.title}</Typography>
    </Stack></AccordionSummary>
    <AccordionDetails><Typography variant="caption" color="text.secondary">{entry.caveat}</Typography><Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', mt: 1 }}>{entry.body}</Typography>
      {entry.url ? <SourceButton url={entry.url} label="Open original post" onError={onError} /> : <Typography variant="caption">Source link unavailable</Typography>}
    </AccordionDetails>
  </Accordion>
}
