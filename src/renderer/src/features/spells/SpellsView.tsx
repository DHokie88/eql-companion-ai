import { type JSX, useMemo, type ReactNode } from 'react'
import { Alert, Box, Button, CircularProgress, Dialog, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material'
import { type SpellClass, type SpellLibraryStatus } from '@shared/spellLibrary'
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
import { SpellWorkspaceControls } from './SpellWorkspaceControls'
import { SpellByLevel } from './SpellByLevel'
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
  const { mode, pickedClasses, pickedLevel, tab, setTab, selected } = state
  const level = casterLevel(pickedLevel, stated.level)
  const classes = scopeClasses(mode, combo.resolved, pickedClasses)
  const classKey = classes.join(',')
  const context = modifiers.context
  // Provenance-only exports refresh visible evidence; the worker reuses cached arithmetic.
  const evaluation = useMemo<SpellEvaluationOptions | undefined>(() => context ? {
    mode: context.preferences.mode, contextRevision: context.revision, classes: classKey ? classKey.split(',') as SpellClass[] : []
  } : undefined, [context, classKey])
  const targets = state.browseTargets ?? modifiers.context?.preferences.targets ?? 4
  const analysis = useMemo(() => ({ scope: 'pack' as const, targets }), [targets])
  const busy = ['checking', 'importing', 'activating'].includes(status.phase)
  return (
    <Stack spacing={2} data-testid="spells-view">
      <LibraryHeader status={status} busy={busy} />
      {routing.nav.origin && <Box><Button size="small" onClick={() => routing.nav.back()}>Back to {routing.nav.origin.label}</Button></Box>}
      <Tabs value={tab} onChange={(_e, value: typeof tab) => { setTab(value); routing.clearLibrarySpellFocus() }} aria-label="Spell library views" variant="scrollable">
        <Tab label="Browse" value="browse" data-testid="spells-tab-browse" /><Tab label={`Compare${selected.length ? ` (${selected.length}/4)` : ''}`} value="compare" data-testid="spells-tab-compare" /><Tab label="Progression" value="by-level" data-testid="spells-tab-by-level" /><Tab label="History" value="history" data-testid="spells-tab-history" />
      </Tabs>
      <LibraryContent routing={routing} state={state} modifiers={modifiers} evaluation={evaluation} analysis={analysis} classes={classes} level={level} controls={<SpellWorkspaceControls state={state} classes={classes} combo={combo.resolved} level={level} statedLevel={stated.level} modifiers={modifiers} targets={targets} />} />
    </Stack>
  )
}

function casterLevel(picked: number | null, stated: number | null): number { return picked ?? stated ?? 50 }

function LibraryContent({ routing, state, modifiers, evaluation, analysis, classes, level, controls }: {
  routing: AppRouting; state: ReturnType<typeof useSpellViewState>; evaluation?: SpellEvaluationOptions
  modifiers: SpellModifiersState; controls: ReactNode
  analysis: import('@shared/spellAnalysis').SpellAnalysisOptions; classes: SpellClass[]; level: number
}): JSX.Element {
  const { tab, mode, selected, toggle } = state
  const onHistory = (id: number): void => { state.setTimelineId(id); routing.clearLibrarySpellFocus(); state.setTab('history') }
  if (tab === 'history' && routing.librarySpellId === null) return <SpellHistory focusId={state.timelineId} onOpen={routing.openLibrarySpell} />
  if (!evaluation) return <CircularProgress size={22} aria-label="Loading calculation context" />
  return <>
    {tab === 'browse' && <SpellBrowse bestInLine={state.bestInLine} classes={classes} level={level} evaluation={evaluation} analysis={analysis} allSpells={mode === 'all'} enabled={mode === 'all' || classes.length > 0} selected={selected} onToggle={toggle} onOpen={(id) => state.open(id, 'pack')} controls={controls} initialCategory={state.focusCategory} onFocusConsumed={() => state.setFocusCategory(undefined)} />}
    {tab === 'compare' && <SpellCompare ids={selected} classes={classes} level={level} evaluation={evaluation} targets={analysis.targets} initialScope={state.focusScope} onFocusConsumed={() => state.setFocusScope(undefined)} onRemove={toggle} onOpen={state.open} controls={controls} />}
    {tab === 'by-level' && <SpellByLevel classes={classes} level={level} evaluation={evaluation} selected={selected} onOpen={state.open} onPreview={state.preview} onToggle={toggle} controls={controls} enabled={mode === 'all' || classes.length > 0} />}
    <Dialog fullScreen open={routing.librarySpellId !== null} onClose={routing.clearLibrarySpellFocus} data-testid="library-spell-dialog" slotProps={{ paper: { sx: { bgcolor: 'background.default', backgroundImage: 'none' } } }}><Box sx={{ p: { xs: 2, md: 4 }, width: '100%', maxWidth: 1440, mx: 'auto', boxSizing: 'border-box' }}>
      {routing.librarySpellId !== null && <LibrarySpellDetail id={routing.librarySpellId} level={state.previewLevel ?? level} evaluation={evaluation} analysis={{ ...analysis, scope: state.previewScope }} controls={<SpellModifierControls state={modifiers} />} onBack={() => { routing.clearLibrarySpellFocus(); if (routing.nav.origin) routing.nav.back() }} onWiki={routing.openSpell} onHistory={onHistory} />}
    </Box></Dialog>
  </>
}

function scopeClasses(mode: 'character' | 'custom' | 'all', resolved: SpellClass[], manual: SpellClass[]): SpellClass[] {
  if (mode === 'all') return []
  return mode === 'character' && resolved.length > 0 ? resolved : manual
}

function LibraryHeader({ status, busy }: { status: SpellLibraryStatus; busy: boolean }): JSX.Element {
  return <><Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Box><Typography variant="h5">Spells</Typography><Typography variant="body2" color="text.secondary">Explore spells, plan upgrades, and track changes.</Typography></Box>
        <Button variant="outlined" disabled={busy} data-testid="spells-check" onClick={() => { void window.eq.spellLibrary.check() }}>{busy ? 'Checking…' : 'Check for updates'}</Button>
      </Stack>
      {status.phase === 'error' ? <Alert severity="warning" data-testid="spells-status">Refresh failed. {status.error ?? status.message}</Alert> : <Tooltip disableInteractive title={`${status.message} ${status.dataset ? `Revision ${status.dataset.contentId}. First observed ${new Date(status.dataset.firstObserved).toLocaleString()}.` : ''}`}><Typography variant="caption" color="text.secondary" data-testid="spells-status">{busy ? status.message : status.dataset ? `${status.dataset.recordCount.toLocaleString()} spells · History tracks changes from your first capture.` : 'Choose an EQ installation to load spells.'}</Typography></Tooltip>}
</>
}
