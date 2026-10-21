import type { JSX } from 'react'
import { Box, Button, Checkbox, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { activePriorityStats, DEFAULT_PRIORITIES, EXTRA_PRIORITY_STATS, PRIORITY_LEVELS, sanitizePriorityExtras, type PriorityKey, type GearPriorities as Priorities } from './gearPriorities'

export default function GearPriorityBar({ value, onChange, extras, onExtras }: { value: Priorities; onChange: (value: Priorities) => void; extras: PriorityKey[]; onExtras: (value: PriorityKey[]) => void }): JSX.Element {
  return (
    <Stack direction="row" spacing={1} alignItems="end" data-testid="gear-priorities" sx={{ overflowX: 'auto', flexShrink: 0, py: 0.5 }}>
      {activePriorityStats(extras).map(({ key, label }) => (
        <Box key={key} sx={{ flex: '0 0 82px', textAlign: 'center' }}>
          <Typography component="label" htmlFor={`gear-priority-${key}`} variant="caption" fontWeight={700}>{label}</Typography>
          <TextField
            id={`gear-priority-${key}`} select size="small" fullWidth value={value[key]}
            data-testid={`gear-priority-${key}`}
            slotProps={{ select: { inputProps: { 'aria-label': `${label} priority` } } }}
            onChange={(event) => onChange({ ...value, [key]: Number(event.target.value) })}
            sx={{ '& .MuiSelect-select': { py: 0.5, fontSize: '0.8rem' } }}
          >
            {PRIORITY_LEVELS.slice().reverse().map(({ level, label: option }) => <MenuItem key={level} value={level}>{option}</MenuItem>)}
          </TextField>
        </Box>
      ))}
      <TextField select size="small" value={extras} data-testid="gear-priority-extras"
        slotProps={{ select: { multiple: true, displayEmpty: true, renderValue: () => `More stats${extras.length ? ` (${extras.length})` : ''}`, inputProps: { 'aria-label': 'More priority stats' } } }}
        onChange={(event) => onExtras(sanitizePriorityExtras(typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value))}
        sx={{ minWidth: 130, flexShrink: 0, '& .MuiSelect-select': { py: 0.5, fontSize: '0.8rem' } }}>
        {EXTRA_PRIORITY_STATS.map(({ key, label }) => <MenuItem key={key} value={key}><Checkbox checked={extras.includes(key)} size="small" />{label}</MenuItem>)}
      </TextField>
      <Button size="small" onClick={() => onChange({ ...DEFAULT_PRIORITIES })} data-testid="gear-priorities-reset" sx={{ minWidth: 0 }}>Reset</Button>
    </Stack>
  )
}
