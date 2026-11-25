import { useState, type JSX } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Button, Stack, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { coverageSummary } from '@shared/communityCoverage'
import { noteDraft, noteGaps } from './coverageDraft'

export function CommunityCoverage({ notes }: { notes: string[] }): JSX.Element {
  const rows = coverageSummary(notes)
  const titles = []
  for (const row of rows) titles.push(row.title)
  const gaps = noteGaps(titles)
  const [ready, setReady] = useState<ReadonlySet<string>>(new Set())
  return <Accordion disableGutters variant="outlined" data-testid="community-coverage" data-gaps={gaps.length}>
    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
      <Typography variant="subtitle2">Coverage notes</Typography>
    </AccordionSummary>
    <AccordionDetails>
      {rows.length === 0
        ? <Typography variant="body2" color="text.secondary">No saved coverage notes were provided.</Typography>
        : <Stack spacing={1}>{rows.map(row => {
          const draft = noteDraft(row.title, row.detail, ready.has(row.id))
          return <Stack key={row.id} spacing={0.25} data-note={draft.status}>
            <Typography variant="body2" fontWeight="bold" title={draft.status}>{row.title}</Typography>
            <Typography variant="body2" color="text.secondary">{row.detail}</Typography>
            {draft.status === 'draft' && <Button size="small" onClick={() => setReady((prev) => {
              const next = new Set(prev)
              next.add(row.id)
              return next
            })}>Confirm note</Button>}
          </Stack>
        })}</Stack>}
    </AccordionDetails>
  </Accordion>
}
