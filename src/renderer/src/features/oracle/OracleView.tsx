import type { JSX } from 'react'
import { Box, Paper, Stack, Typography } from '@mui/material'
import { AskOracle } from './AskOracle'
import { OracleConnection } from './OracleConnection'

export default function OracleView(): JSX.Element {
  return <Box sx={{ p: 3, overflow: 'auto', height: '100%' }} data-testid="oracle-view"><Stack spacing={3} sx={{ maxWidth: 1100, mx: 'auto' }}>
    <Box><Typography variant="h4">Your EQL reference desk</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Items, spells, quests, mobs, classes and community knowledge in one place.</Typography></Box>
    <Paper variant="outlined" sx={{ p: 3 }}><AskOracle /></Paper>
    <OracleConnection />
    <Typography variant="caption" color="text.secondary">Sources are bundled snapshots. Answers are AI interpretations, and Discord claims remain unverified. If the model is offline, you can still search and read the matching reference excerpts.</Typography>
  </Stack></Box>
}
