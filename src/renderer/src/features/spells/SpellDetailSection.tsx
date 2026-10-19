import type { JSX, ReactNode } from 'react'
import { Box } from '@mui/material'

/** Quiet surfaces separate topics without inheriting the dialog's elevation overlay. */
export function SpellDetailSection({ children }: { children: ReactNode }): JSX.Element {
  return <Box component="section" sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2 }}>{children}</Box>
}
