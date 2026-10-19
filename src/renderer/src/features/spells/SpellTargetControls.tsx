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
    <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 760 }}>Browse and AOE rankings use this pack size, limited by target caps or rain hit budgets. DD/DoT rankings show one target; healing stays per recipient. Mana is spent once.</Typography>
    <Typography variant="caption" color="text.secondary" sx={{ flexBasis: '100%' }} data-testid="spells-rain-guide">Rain example · 3 available waves, 4 hits per cast: 1 target → 3 hits; 2, 3 or 4 targets → up to 4 hits. Assumes targets stay in the area and no resists; hits need not split evenly.</Typography>
  </Stack>
}
