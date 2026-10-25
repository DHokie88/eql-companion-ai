import type { JSX } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Stack, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { coverageSummary } from '@shared/communityCoverage'

export function CommunityCoverage({ notes }: { notes: string[] }): JSX.Element {
  const rows = coverageSummary(notes)
  return <Accordion disableGutters variant="outlined" data-testid="community-coverage">
    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
      <Typography variant="subtitle2">Coverage notes</Typography>
    </AccordionSummary>
    <AccordionDetails>
      {rows.length === 0
        ? <Typography variant="body2" color="text.secondary">No saved coverage notes were provided.</Typography>
        : <Stack spacing={1}>{rows.map(row => <Stack key={row.id} spacing={0.25}>
          <Typography variant="body2" fontWeight="bold">{row.title}</Typography>
          <Typography variant="body2" color="text.secondary">{row.detail}</Typography>
        </Stack>)}</Stack>}
    </AccordionDetails>
  </Accordion>
}
