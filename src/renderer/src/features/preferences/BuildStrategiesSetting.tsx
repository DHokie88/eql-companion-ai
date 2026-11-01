import { useState, type JSX } from 'react'
import { Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material'
import TuneIcon from '@mui/icons-material/Tune'
import { defaultBuildStrategies, STRATEGY_KEYS, strategyWeights, type BuildStrategy, type StrategyStat } from '@shared/build/strategies'
import type { BuildWeights } from '@shared/build/profiles'
import type { PrefSection } from './PreferencesView'
import { useLoadouts } from '../loadouts/useLoadouts'
function label(key: StrategyStat): string { return key === 'MP' ? 'Mana' : key.replace(/_/g, ' ') }
function NumberCell({ value, fallback, max, onChange, name }: { value?: number; fallback?: number; max: number; onChange: (v: number | undefined) => void; name: string }): JSX.Element {
  return <TextField type="number" size="small" value={value ?? ''} placeholder={fallback === undefined ? 'None' : String(Math.round(fallback * 100) / 100)}
    slotProps={{ htmlInput: { min: 0, max, step: 'any', 'aria-label': name } }} sx={{ width: 112 }}
    onChange={(e) => { const v = e.target.value; if (v === '') onChange(undefined); else if (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= max) onChange(Number(v)) }} />
}
function StrategyEditor({ value }: { value: BuildStrategy }): JSX.Element {
  const api = useLoadouts()
  const weights = strategyWeights(value, api.classes)
  const change = (next: BuildStrategy): void => { void api.update({ kind: 'strategy', strategy: next }).catch(() => { /* Shared loadout error. */ }) }
  const number = (field: 'weights' | 'minimums' | 'caps', key: StrategyStat, next: number | undefined): void => {
    const values: BuildWeights = { ...value[field] }
    if (next === undefined) Reflect.deleteProperty(values, key)
    else values[key] = next
    change({ ...value, [field]: values })
  }
  return <Stack spacing={1}>
    <TextField label="Strategy name" size="small" value={value.name} slotProps={{ htmlInput: { maxLength: 60 } }} onChange={(e) => change({ ...value, name: e.target.value })} data-testid="strategy-name" />
    <Typography variant="caption">Weights describe your preferences, not measured damage or healing. Blank weights use this strategy’s starter values. Zero ignores a stat. Minimums and caps apply to each candidate item; a required unknown stat fails its minimum.</Typography>
    <Box sx={{ maxHeight: 340, overflow: 'auto' }}>
      <Stack direction="row" spacing={1} sx={{ position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1, py: 0.5 }}><Typography sx={{ width: 124 }}>Stat</Typography><Typography sx={{ width: 112 }}>Weight</Typography><Typography sx={{ width: 112 }}>Minimum</Typography><Typography sx={{ width: 112 }}>Score cap</Typography></Stack>
      {STRATEGY_KEYS.map((key) => <Stack key={key} direction="row" spacing={1} alignItems="center" sx={{ py: 0.4 }}>
        <Typography variant="caption" sx={{ width: 124, flexShrink: 0 }}>{label(key)}</Typography>
        <NumberCell value={value.weights[key]} fallback={weights[key]} max={1000} name={`${key} weight`} onChange={(v) => number('weights', key, v)} />
        <NumberCell value={value.minimums[key]} max={1000000} name={`${key} minimum`} onChange={(v) => number('minimums', key, v)} />
        <NumberCell value={value.caps[key]} max={1000000} name={`${key} cap`} onChange={(v) => number('caps', key, v)} />
      </Stack>)}
    </Box>
    <Button onClick={() => { const original = defaultBuildStrategies().find((v) => v.id === value.id); if (original) change(original) }} data-testid="strategy-reset">Restore this strategy’s defaults</Button>
  </Stack>
}
function BuildStrategiesSetting(): JSX.Element {
  const api = useLoadouts()
  const [id, setId] = useState('s1')
  const strategies = api.state?.book.strategies ?? []
  const value = strategies.find((s) => s.id === id)
  return <Stack spacing={1.5} data-testid="build-strategies-setting">
    <Typography variant="body2">Five strategies shared by this character’s loadouts. Each loadout remembers its selected strategy. Editing a strategy affects every loadout using it.</Typography>
    <TextField select label="Strategy" value={id} size="small" onChange={(e) => setId(e.target.value)} data-testid="strategy-select">
      {strategies.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
    </TextField>
    {value ? <StrategyEditor value={value} /> : <Typography>Select a character to configure strategies.</Typography>}
    {api.error && <Typography color="error">{api.error}</Typography>}
  </Stack>
}
export function buildStrategiesSection(): PrefSection {
  return { id: 'build-strategies', label: 'Build strategies', icon: <TuneIcon fontSize="small" />, items: [{ id: 'build-strategies', label: 'Build strategies', keywords: 'loadout gear weights stat scoring tank healer solo criteria', content: <BuildStrategiesSetting /> }] }
}
