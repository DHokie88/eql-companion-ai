import { type JSX, useMemo } from 'react'
import { Alert, Box, Button, CircularProgress, Dialog, FormControl, InputLabel, MenuItem, Select, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
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
import { SpellWorkspace } from './spellWorkspace'
import { useSpellViewState } from './useSpellViewState'
import { SpellRankings } from './SpellRankings'
import { SpellByLevel } from './SpellByLevel'
import { SpellTargetControls } from './SpellTargetControls'
import type { SpellModifiersState } from './useSpellModifiers'
import { SpellRankProvider } from './spellRankState'

export default function SpellsView({ routing }: { routing: AppRouting }): JSX.Element {
  const status = useSpellLibraryStatus()
  const modifiers = useSpellModifiers()
  const identity = `${status.dataset?.installId ?? status.installation ?? 'unknown'}:${modifiers.context?.character?.key ?? 'session'}`
  return <SpellWorkspace identity={identity}><SpellRankProvider state={modifiers} snapshotId={status.dataset?.snapshotId ?? null}><SpellsWorkspace routing={routing} status={status} modifiers={modifiers} /></SpellRankProvider></SpellWorkspace>
}

function SpellsWorkspace({ routing, status, modifiers }: { routing: AppRouting; status: SpellLibraryStatus; modifiers: SpellModifiersState }): JSX.Element {
  const combo = useCurrentComboClasses()
  const prog = useModule<ProgressionSnap>('progression') ?? EMPTY_PROGRESSION
  const stated = useStatedLevel(prog)
  const state = useSpellViewState(routing, !!modifiers.context)
  const { mode, setMode, pickedClasses, setClasses, pickedLevel, setLevel, tab, setTab, selected } = state
  const level = casterLevel(pickedLevel, stated.level)
  const following = mode === 'character' && combo.resolved.length > 0
  const classes = scopeClasses(mode, combo.resolved, pickedClasses)
  const classKey = classes.join(',')
  const context = modifiers.context
  // Provenance-only exports refresh visible evidence; the worker reuses cached arithmetic.
  const evaluation = useMemo<SpellEvaluationOptions | undefined>(() => context ? {
    mode: context.preferences.mode, contextRevision: context.revision, classes: classKey ? classKey.split(',') as SpellClass[] : []
  } : undefined, [context, classKey])
  const targets = modifiers.context?.preferences.targets ?? 4
  const analysis = useMemo(() => ({ scope: 'pack' as const, targets }), [targets])
  const busy = ['checking', 'importing', 'activating'].includes(status.phase)
  return (
    <Stack spacing={2} data-testid="spells-view">
      <LibraryHeader status={status} busy={busy} />
      {routing.nav.origin && <Box><Button size="small" onClick={() => routing.nav.back()}>Back to {routing.nav.origin.label}</Button></Box>}
      <ScopeControls mode={mode} setMode={setMode} following={following} classes={classes} pickedClasses={pickedClasses} setClasses={setClasses} comboClasses={combo.resolved} level={level} pickedLevel={pickedLevel} setLevel={setLevel} statedLevel={stated.level} />
      {routing.librarySpellId === null && <SpellModifierControls state={modifiers} ids={selected} />}
      <SpellTargetControls targets={targets} disabled={!modifiers.context || modifiers.saving} onChange={(value) => { if (modifiers.context) modifiers.update({ ...modifiers.context.preferences, targets: value }) }} />
      <Tabs value={tab} onChange={(_e, value: typeof tab) => { setTab(value); routing.clearLibrarySpellFocus() }} aria-label="Spell library views" variant="scrollable">
        <Tab label="Browse" value="browse" data-testid="spells-tab-browse" /><Tab label="Rankings" value="rankings" data-testid="spells-tab-rankings" /><Tab label={`Compare${selected.length ? ` (${selected.length}/4)` : ''}`} value="compare" data-testid="spells-tab-compare" /><Tab label="By level" value="by-level" data-testid="spells-tab-by-level" /><Tab label="History" value="history" data-testid="spells-tab-history" />
      </Tabs>
      <LibraryContent routing={routing} state={state} modifiers={modifiers} evaluation={evaluation} analysis={analysis} classes={classes} level={level} />
    </Stack>
  )
}

function casterLevel(picked: number | null, stated: number | null): number { return picked ?? stated ?? 50 }

function LibraryContent({ routing, state, modifiers, evaluation, analysis, classes, level }: {
  routing: AppRouting; state: ReturnType<typeof useSpellViewState>; evaluation?: SpellEvaluationOptions
  modifiers: SpellModifiersState
  analysis: import('@shared/spellAnalysis').SpellAnalysisOptions; classes: SpellClass[]; level: number
}): JSX.Element {
  const { tab, mode, selected, toggle } = state
  const onHistory = (id: number): void => { state.setTimelineId(id); routing.clearLibrarySpellFocus(); state.setTab('history') }
  if (tab === 'history' && routing.librarySpellId === null) return <SpellHistory focusId={state.timelineId} onOpen={routing.openLibrarySpell} />
  if (!evaluation) return <CircularProgress size={22} aria-label="Loading calculation context" />
  return <>
    {tab === 'browse' && <SpellBrowse classes={classes} level={level} evaluation={evaluation} analysis={analysis} allSpells={mode === 'all'} enabled={mode === 'all' || classes.length > 0} selected={selected} onToggle={toggle} onOpen={(id) => state.open(id, 'pack')} />}
    {tab === 'rankings' && <SpellRankings classes={classes} level={level} evaluation={evaluation} targets={analysis.targets} selected={selected} initialCategory={state.focusCategory} onFocusConsumed={() => state.setFocusCategory(undefined)} onToggle={toggle} onOpen={state.open} />}
    {tab === 'compare' && <SpellCompare ids={selected} classes={classes} level={level} evaluation={evaluation} targets={analysis.targets} initialScope={state.focusScope} onFocusConsumed={() => state.setFocusScope(undefined)} onRemove={toggle} onOpen={state.open} />}
    {tab === 'by-level' && <SpellByLevel classes={classes} level={level} evaluation={evaluation} selected={selected} onOpen={state.open} onPreview={state.preview} onToggle={toggle} />}
    <Dialog fullScreen open={routing.librarySpellId !== null} onClose={routing.clearLibrarySpellFocus} data-testid="library-spell-dialog" slotProps={{ paper: { sx: { bgcolor: 'background.default', backgroundImage: 'none' } } }}><Box sx={{ p: { xs: 2, md: 4 }, width: '100%', maxWidth: 1440, mx: 'auto', boxSizing: 'border-box' }}>
      {routing.librarySpellId !== null && <LibrarySpellDetail id={routing.librarySpellId} level={state.previewLevel ?? level} evaluation={evaluation} analysis={{ ...analysis, scope: state.previewScope }} controls={<SpellModifierControls state={modifiers} ids={[routing.librarySpellId]} />} onBack={() => { routing.clearLibrarySpellFocus(); if (routing.nav.origin) routing.nav.back() }} onWiki={routing.openSpell} onHistory={onHistory} />}
    </Box></Dialog>
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
