import { buildStrategiesSection } from '../preferences/BuildStrategiesSetting'
// THE BUILD TAB (EQ Zera, 2026-09-06) — the character builder, in the gear area beside Gear.
//
// WHAT IT ANSWERS. "What am I wearing, what is it worth, and what should I swap in to be tankier,
// hit harder or heal better?" — plus a solo-capability reading. It is Magelo's profile page with
// an optimizer under it: the worn set comes off the `/outputfile inventory` dump the Character
// tab already reads, the candidates come off the gear index the Gear tab already searches, and
// the profiles (shared/build/profiles.ts) turn both into one number per role.
//
// THE METERS ARE RELATIVE, AND SAY SO. 100% is "the best set the same rows and the same filters
// could reach", not a game value — the app cannot know your AC, only what your items say (the
// character sheet's standing rule). Toggling in-era or owned-only moves the ceiling, so it moves
// the number; that is the point of the toggles.
//
// AND WHERE TO FARM (the upgrade finder) IS THE THIRD PANEL: the zones that drop the upgrades this
// tab just found, ranked by the gain each holds, with the mobs that drop them. It states no rarity
// and no drop rate because the catalog states neither; summed gain is the only ordering there is
// evidence for. Its own fixed height and its own scrollbar, per the app's growing-list law.
//
// SWAPS ARE A SANDBOX. "Swap in" replaces a cell in the set the meters read; nothing is written
// anywhere, and Reset puts the dump back. Every item name links out to the Loot drill-down.

import { useState, type JSX } from 'react'
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Paper, Stack, Switch, TextField, Typography } from '@mui/material'
import { LoadoutBar } from '../loadouts/LoadoutBar'
import { BuildMeters } from './BuildMeters'
import { BuildSetPanel, BuildUpgradesPanel } from './BuildPanels'
import { FarmPanel } from './FarmPanel'
import { useBuild, type BuildState } from './useBuild'
import { outputAgeLabel } from '../../lib/outputFreshness'

/** The Mobs-tab opener, threaded from App. Optional with a no-op default so a caller that has not
 *  wired it yet still compiles; the panel's mob names simply do nothing until it is. */
const NO_MOB = (): void => {
  /* no opener wired */
}

function Toolbar({ build }: { build: BuildState }): JSX.Element {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap data-testid="build-toolbar">
      <Chip size="small" variant="outlined" label={build.classes.length > 0 ? `Loadout · ${build.classes.join(' / ')}` : 'Loadout unknown - every item counts'} />
      <FormControlLabel
        control={<Switch size="small" checked={build.eraOnly} onChange={(e) => build.setEraOnly(e.target.checked)} />}
        label={<Typography variant="caption">In-era items only</Typography>}
      />
      <FormControlLabel
        control={<Switch size="small" checked={build.ownedOnly} onChange={(e) => build.setOwnedOnly(e.target.checked)} />}
        label={<Typography variant="caption">Owned or looted only</Typography>}
      />
      <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto' }}>
        {build.usingLiveInventory ? 'current inventory' : 'loadout equipment'} · {outputAgeLabel(build.exportedAt)}
      </Typography>
    </Stack>
  )
}

function NoDump({ build }: { build: BuildState }): JSX.Element {
  return (
    <Paper variant="outlined" sx={{ p: 2 }} data-testid="build-no-dump">
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        {build.hasLiveInventory ? 'No saved equipment for this loadout' : 'No inventory dump yet'}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {build.hasLiveInventory ? 'The current inventory is available. Follow live to use it, or save equipment for this loadout from the Character tab.' : <>In game, type <code>/outputfile inventory</code>. The app reads the file it writes and updates this tab when you export again.</>}
      </Typography>
      {build.hasLiveInventory && <Button onClick={build.followLive}>Follow live inventory</Button>}
    </Paper>
  )
}

function ManaEstimateControls({ build }: { build: BuildState }): JSX.Element {
  const change = (value: string, set: (next: number | null) => void): void => {
    if (value === '') { set(null); return }
    const n = Number(value)
    if (Number.isFinite(n) && n >= 0 && n <= 1000) set(n)
  }
  return <Stack spacing={0.5} data-testid="build-mana-estimate">
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
      <Typography variant="caption">Mana estimate · in-game totals</Typography>
      <TextField label="INT" type="number" size="small" value={build.manaInt ?? ''} placeholder="150 assumed"
        onChange={(event) => change(event.target.value, build.setManaInt)} slotProps={{ htmlInput: { min: 0, max: 1000, 'aria-label': 'Mana estimate INT' } }} sx={{ width: 130 }} />
      <TextField label="WIS" type="number" size="small" value={build.manaWis ?? ''} placeholder="150 assumed"
        onChange={(event) => change(event.target.value, build.setManaWis)} slotProps={{ htmlInput: { min: 0, max: 1000, 'aria-label': 'Mana estimate WIS' } }} sx={{ width: 130 }} />
    </Stack>
    <Typography variant="caption" color="text.secondary">Illustrative level 50 estimate: 9.4 mana per INT/WIS for full casters, 4.7 for hybrids; the two largest class pools count. These rates are unverified and omit stat breakpoints. Empty totals assume 150; enter your in-game totals for the displayed equipment. The mana weight values raw and estimated mana; INT/WIS weights are extra priorities.</Typography>
  </Stack>
}

export default function BuildView({
  onOpenLoot,
  onOpenMob = NO_MOB
}: {
  onOpenLoot: (item?: string) => void
  onOpenMob?: (t: { mob: string }) => void
}): JSX.Element {
  const build = useBuild()
  const [editingStrategies, setEditingStrategies] = useState(false)
  if (!build.ready) {
    return (
      <Typography variant="caption" color="text.disabled">
        Reading the item index and your inventory dump...
      </Typography>
    )
  }
  return (
    <Stack spacing={1.5} sx={{ height: '100%', minHeight: 0 }} data-testid="build-view">
      <LoadoutBar />
      <Stack direction="row" spacing={1} alignItems="center" data-testid="build-best-slot" title={build.leaders.primary ? `Best ${build.leaders.primary}${build.leaders.valetPrimary ? `, valet ${build.leaders.valetPrimary}` : ''}${build.leaders.spare.length > 0 ? `, ${String(build.leaders.spare.length)} spare` : ''}` : undefined}><Toolbar build={build} /><Button onClick={() => setEditingStrategies(true)} data-testid="build-edit-strategies">Edit strategies</Button></Stack>
      <ManaEstimateControls build={build} />
      <Dialog open={editingStrategies} onClose={() => setEditingStrategies(false)} maxWidth="md" fullWidth>
        <DialogTitle>Build strategies</DialogTitle><DialogContent>{buildStrategiesSection().items[0].content}</DialogContent>
        <DialogActions><Button onClick={() => setEditingStrategies(false)}>Close</Button></DialogActions>
      </Dialog>
      {!build.hasDump && <NoDump build={build} />}
      <BuildMeters build={build} />
      <Stack direction="row" spacing={1.5} sx={{ flexGrow: 1, minHeight: 0 }}>
        <Stack sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <BuildSetPanel build={build} onOpenLoot={onOpenLoot} />
        </Stack>
        <Stack sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <BuildUpgradesPanel build={build} onOpenLoot={onOpenLoot} />
        </Stack>
      </Stack>
      {/* A growing list in a FIXED-height scroll box (AGENTS.md): its own maxHeight and its own
          overflow, so it can never squeeze the two panels above it to nothing. */}
      <FarmPanel build={build} handlers={{ onOpenLoot, onOpenMob }} />
    </Stack>
  )
}

/** The App.tsx mount, a sibling of the other view branches (PlainView is at its complexity ceiling). */
export function BuildBranch({
  view,
  viewKey,
  onOpenLoot,
  onOpenMob
}: {
  view: string
  viewKey: string
  onOpenLoot: (item?: string) => void
  /** `routing.openMob` — optional so App compiles before the integrator threads it through. */
  onOpenMob?: (t: { mob: string }) => void
}): JSX.Element | null {
  return view === 'build' ? <BuildView key={viewKey} onOpenLoot={onOpenLoot} onOpenMob={onOpenMob} /> : null
}
