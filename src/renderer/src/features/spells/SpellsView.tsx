import { type JSX, useMemo, useState } from 'react'
import { Alert, Box, Button, CircularProgress, FormControl, InputLabel, MenuItem, Select, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { SPELL_CLASSES, type SpellClass, type SpellLibraryStatus } from '@shared/spellLibrary'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import type { ProgressionSnap } from '@shared/types'
import type { AppRouting } from '../../appRouting'
import { useModule } from '../../lib/useModule'
import { useCurrentComboClasses } from '../leveling/useLevelUnlocks'
import { useStatedLevel } from '../leveling/useStatedLevel'
import { EMPTY_PROGRESSION } from '../leveling/progressionDelta'
import { useSpellLibraryStatus } from './libraryState'
import { SpellBrowse } from './SpellBrowse'
import { SpellCompare } from './SpellCompare'
import { SpellHistory } from './SpellHistory'
import { LibrarySpellDetail } from './LibrarySpellDetail'
import { useSpellModifiers } from './useSpellModifiers'
import { SpellModifierControls } from './SpellModifierControls'

export default function SpellsView({ routing }: { routing: AppRouting }): JSX.Element {
  const status = useSpellLibraryStatus()
  const combo = useCurrentComboClasses()
  const prog = useModule<ProgressionSnap>('progression') ?? EMPTY_PROGRESSION
  const stated = useStatedLevel(prog)
  const [mode, setMode] = useState<'character' | 'custom' | 'all'>('character')
  const [pickedClasses, setClasses] = useState<SpellClass[]>([])
  const [pickedLevel, setLevel] = useState<number | null>(null)
  const [tab, setTab] = useState('browse')
  const [selected, setSelected] = useState<number[]>([])
  const [timelineId, setTimelineId] = useState<number | null>(null)
  const modifiers = useSpellModifiers()
  const level = pickedLevel ?? stated.level ?? 50
  const following = mode === 'character' && combo.resolved.length > 0
  const classes = scopeClasses(mode, combo.resolved, pickedClasses)
  const classKey = classes.join(',')
  const contextRevision = modifiers.context?.revision
  const valueMode = modifiers.context?.preferences.mode
  const evaluation = useMemo<SpellEvaluationOptions | undefined>(() => contextRevision && valueMode ? {
    mode: valueMode, contextRevision, classes: classKey ? classKey.split(',') as SpellClass[] : []
  } : undefined, [contextRevision, valueMode, classKey])
  const toggle = (id: number): void => {
    setSelected((ids) => ids.includes(id) ? ids.filter((n) => n !== id) : ids.length < 4 ? [...ids, id] : ids)
  }
  const busy = ['checking', 'importing', 'activating'].includes(status.phase)
  return (
    <Stack spacing={2} data-testid="spells-view">
      <LibraryHeader status={status} busy={busy} />
      <ScopeControls mode={mode} setMode={setMode} following={following} classes={classes} pickedClasses={pickedClasses} setClasses={setClasses} comboClasses={combo.resolved} level={level} pickedLevel={pickedLevel} setLevel={setLevel} statedLevel={stated.level} />
      <SpellModifierControls state={modifiers} ids={[...new Set([...selected, ...(routing.librarySpellId === null ? [] : [routing.librarySpellId])])]} />
      <Tabs value={tab} onChange={(_e, value: string) => { setTab(value); routing.clearLibrarySpellFocus() }} aria-label="Spell library views">
        <Tab label="Browse" value="browse" data-testid="spells-tab-browse" /><Tab label={`Compare${selected.length ? ` (${selected.length}/4)` : ''}`} value="compare" data-testid="spells-tab-compare" /><Tab label="History" value="history" data-testid="spells-tab-history" />
      </Tabs>
      <LibraryContent routing={routing} tab={tab} timelineId={timelineId} loading={modifiers.loading} evaluation={evaluation} classes={classes} level={level} mode={mode} selected={selected} toggle={toggle} onHistory={(id) => { setTimelineId(id); routing.clearLibrarySpellFocus(); setTab('history') }} />
    </Stack>
  )
}

function LibraryContent({ routing, tab, timelineId, loading, evaluation, classes, level, mode, selected, toggle, onHistory }: {
  routing: AppRouting; tab: string; timelineId: number | null; loading: boolean; evaluation?: SpellEvaluationOptions
  classes: SpellClass[]; level: number; mode: 'character' | 'custom' | 'all'; selected: number[]
  toggle: (id: number) => void; onHistory: (id: number) => void
}): JSX.Element {
  if (tab === 'history' && routing.librarySpellId === null) return <SpellHistory focusId={timelineId} onOpen={routing.openLibrarySpell} />
  if (loading || !evaluation) return <CircularProgress size={22} aria-label="Loading calculation context" />
  if (routing.librarySpellId !== null) return <LibrarySpellDetail id={routing.librarySpellId} level={level} evaluation={evaluation} onBack={() => { routing.clearLibrarySpellFocus(); if (routing.nav.origin) routing.nav.back() }} onWiki={routing.openSpell} onHistory={onHistory} />
  return <>
    {tab === 'browse' && <SpellBrowse classes={classes} level={level} evaluation={evaluation} allSpells={mode === 'all'} enabled={mode === 'all' || classes.length > 0} selected={selected} onToggle={toggle} onOpen={routing.openLibrarySpell} />}
    {tab === 'compare' && <SpellCompare ids={selected} classes={classes} level={level} evaluation={evaluation} onRemove={toggle} onOpen={routing.openLibrarySpell} />}
  </>
}

function scopeClasses(mode: 'character' | 'custom' | 'all', resolved: SpellClass[], manual: SpellClass[]): SpellClass[] {
  if (mode === 'all') return []
  return mode === 'character' && resolved.length > 0 ? resolved : manual
}

function LibraryHeader({ status, busy }: { status: SpellLibraryStatus; busy: boolean }): JSX.Element {
  return <><Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Box><Typography variant="h5">Spells</Typography><Typography variant="body2" color="text.secondary">Your client spell catalog, comparisons, and captured history.</Typography></Box>
        <Button variant="outlined" disabled={busy} data-testid="spells-check" onClick={() => { void window.eq.spellLibrary.check() }}>{busy ? 'Checking…' : 'Check for updates'}</Button>
      </Stack>
      <Alert severity={status.phase === 'error' ? 'warning' : 'info'} data-testid="spells-status">
        {status.message}{status.error && <Box component="span"> {status.error}</Box>}
        {status.dataset && <Typography variant="caption" display="block">{status.dataset.recordCount.toLocaleString()} records · revision {status.dataset.contentId.slice(0, 14)} · first observed {new Date(status.dataset.firstObserved).toLocaleString()}</Typography>}
      </Alert>
</>
}
function ScopeControls({ mode, setMode, following, classes, pickedClasses, setClasses, comboClasses, level, pickedLevel, setLevel, statedLevel }: {
  mode: 'character' | 'custom' | 'all'; setMode: (mode: 'character' | 'custom' | 'all') => void
  following: boolean; classes: SpellClass[]; pickedClasses: SpellClass[]; setClasses: (classes: SpellClass[]) => void
  comboClasses: string[]; level: number; pickedLevel: number | null; setLevel: (level: number | null) => void; statedLevel: number | null
}): JSX.Element {
  return <>      <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
        <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel id="spells-scope-label">Browse scope</InputLabel>
          <Select labelId="spells-scope-label" label="Browse scope" value={mode} data-testid="spells-scope" onChange={(e) => setMode(e.target.value as typeof mode)}>
            <MenuItem value="character" disabled={comboClasses.length === 0}>Selected character{comboClasses.length ? ` (${comboClasses.join(' / ')})` : ' - classes unresolved'}</MenuItem>
            <MenuItem value="custom">Choose classes and level</MenuItem><MenuItem value="all">All spells, including internal records</MenuItem>
          </Select>
        </FormControl>
        {!following && mode !== 'all' && <ClassSelection value={pickedClasses} onChange={setClasses} />}
        <TextField label="Caster level" type="number" size="small" value={level} slotProps={{ htmlInput: { min: 1, max: 125, 'data-testid': 'spells-level' } }} sx={{ width: 110 }} onChange={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= 125) setLevel(n) }} />
        {statedLevel !== null && pickedLevel !== null && <Button size="small" onClick={() => setLevel(null)}>Follow level {statedLevel}</Button>}
      </Stack>
      {!following && mode !== 'all' && classes.length === 0 && <Typography color="text.secondary">Choose one or more classes, or select All spells. Character classes and level will be used when resolved.</Typography>}
      <Typography variant="caption" color="text.secondary">Class and level eligibility comes from the client. It does not confirm spell ownership, scroll availability, or server acquisition.</Typography>
</>
}

function ClassSelection({ value, onChange }: { value: SpellClass[]; onChange: (value: SpellClass[]) => void }): JSX.Element {
  return <FormControl size="small" sx={{ minWidth: 185 }}><InputLabel id="spells-classes-label">Classes</InputLabel>
          <Select multiple labelId="spells-classes-label" label="Classes" value={value} data-testid="spells-classes" onChange={(e) => onChange(typeof e.target.value === 'string' ? e.target.value.split(',') as SpellClass[] : e.target.value)}>
            {SPELL_CLASSES.map((code) => <MenuItem key={code} value={code}>{code}</MenuItem>)}
          </Select></FormControl>
}
