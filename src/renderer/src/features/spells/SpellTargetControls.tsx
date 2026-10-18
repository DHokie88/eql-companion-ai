import type { JSX } from 'react'
import { FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material'
import type { SpellTargetCount } from '@shared/spellAnalysis'
export function SpellTargetControls({ targets, onChange, disabled = false }: { targets: SpellTargetCount; onChange: (targets: SpellTargetCount) => void; disabled?: boolean }): JSX.Element {
  return <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
    <FormControl size="small" sx={{ minWidth: 160 }}><InputLabel id="spell-target-count-label">AOE pack size</InputLabel>
      <Select labelId="spell-target-count-label" label="AOE pack size" value={targets} disabled={disabled} data-testid="spells-target-count" onChange={(e) => onChange(e.target.value === 'maximum' ? 'maximum' : Number(e.target.value))}>
        {Array.from({ length: 100 }, (_, n) => <MenuItem key={n + 1} value={n + 1}>{n + 1} target{n ? 's' : ''}</MenuItem>)}
        <MenuItem value="maximum">Spell maximum</MenuItem>
      </Select></FormControl>
    <Typography variant="caption" color="text.secondary">AOE uses the same requested pack size for every spell. Captured caps and rain hit budgets still apply. Healing remains per recipient.</Typography>
  </Stack>
}
