// gear/GearFilterBar.tsx — the Gear tab's two toolbar rows.
//
// Search and identity controls sit on the first row; simulation and ownership controls share the
// second row and may wrap in a narrow window. Hidden controls remain inert.
//
// NO POPPER ON ANY OF IT (JOS-143). The hints are native `title`s: these controls sit directly
// above a dense windowed table, and an interactive MUI Tooltip opened from a chip up here lands on
// the header row and eats the sort click aimed at it.
//
// THREE OF THE FIRST ROW'S CONTROLS ARE THE SAME CONTROL (JOS-302). Slots, weapon types and classes
// are all "pick several from a closed list, and the picks UNION" — so all three are
// `components/ChipMultiSelect`, with the same keyboard behaviour and the same chips-in-the-field
// shape. The slot control used to be a single-pick select and the owner asked for the classes
// control's behaviour instead; giving it literally that control is the cheapest way to keep the
// promise.
//
// THE CLASS FILTER NARROWS THE CORPUS HERE (owner ruling 2026-08-13, JOS-302) — it is no longer the
// "filter and never a rule" the V2 law describes, and there is no "Usable by these" toggle and no
// off-filter chip on a search row any more. It still shows what the app currently infers you are
// running; touching it PINS your choice, and detection may then only OFFER — the "detected: …"
// chip, one click and reversible. The V2 law is untouched where it was written for: a donor already
// PLACED in a build still gets `MismatchChip` (PlanCell, FarmList), because there the row is a
// decision you made and removing it would be deleting it. `gearFilter.ts GearFilters.classes` holds
// the full argument.
//
// AND SINCE JOS-297 THE BAR IS CONFIGURABLE (owner feedback: *we should be able to customize which
// filters we see*). `visible` is the set of controls to draw — the whole vocabulary while the user
// has not said otherwise, so the shipped bar is what an untouched install still gets. Two rules
// hold it honest. A hidden filter does not filter (`gearPrefs.inertFilters`), and a hidden slider
// also disables the owned-stats mode.


import type { JSX } from 'react'
import { Chip, IconButton, MenuItem, Stack, TextField } from '@mui/material'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type { ItemUpgradeState } from '@shared/itemUpgrade'
import { EQUIP_SLOTS } from '@shared/planner/types'
import { WEAPON_PICKS, WEAPON_PICK_LABEL } from '@shared/planner/weaponType'
import { CLASS_ABBRS_BY_DISPLAY_NAME, classDisplayName } from '@shared/spellLevels'
import ChipMultiSelect from '../../components/ChipMultiSelect'
import { CURRENT_ERA_LABEL } from '../planner/plannerData'
import { SOCKET_LABEL } from '../planner/plannerGroups'
import GearPriorityBar from './GearPriorityBar'
import type { GearPriorities as Priorities, PriorityKey } from './gearPriorities'
import UpgradeSlider from './UpgradeSlider'
import type { EffectFilter, GearFilters } from './gearFilter'
import type { GearControl } from './gearPrefs'
import type { GearClasses } from './gearData'

/** The effect select's options, in the donor vocabulary plus the two a socket cannot express. */
const EFFECT_OPTIONS: { value: EffectFilter; label: string }[] = [
  { value: 'any', label: 'Any effect' },
  { value: 'has', label: 'Has an effect' },
  { value: 'proc', label: SOCKET_LABEL.proc },
  { value: 'worn', label: SOCKET_LABEL.worn },
  { value: 'focus', label: SOCKET_LABEL.focus },
  { value: 'click', label: SOCKET_LABEL.click }
]

/** The bar's ON/OFF idiom, lifted verbatim from EffectFilterBar: one chip, lit when the filter is on. */
function ToggleChip({
  label,
  hint,
  on,
  testId,
  onToggle
}: {
  label: string
  hint: string
  on: boolean
  testId: string
  onToggle: () => void
}): JSX.Element {
  return (
    <Chip
      size="small"
      label={label}
      data-testid={testId}
      title={hint}
      color={on ? 'primary' : 'default'}
      variant={on ? 'filled' : 'outlined'}
      onClick={onToggle}
      sx={{ flexShrink: 0 }}
    />
  )
}

export interface GearFilterBarProps {
  extras: PriorityKey[]
  onExtras: (value: PriorityKey[]) => void
  priorities: Priorities
  onPriorities: (value: Priorities) => void
  filters: GearFilters
  setFilters: (f: GearFilters) => void
  /** the RAW search text (the view defers it before filtering — the standing search law) */
  text: string
  setText: (v: string) => void
  classes: GearClasses
  upgrade: { state: ItemUpgradeState; set: (s: ItemUpgradeState) => void }
  showOwnedStats: boolean
  setShowOwnedStats: (v: boolean) => void
  /** which controls to draw (JOS-297) — `gearPrefs.controlsVisible`, the whole set by default */
  visible: ReadonlySet<GearControl>
}

/** Alphabetize only this picker; other surfaces keep the equipment's physical order. */
const SLOT_OPTIONS = [...EQUIP_SLOTS].sort()

/** Walk the dropdown order, starting after the most recently selected slot. */
function SlotPicker({ filters, setFilters }: Pick<GearFilterBarProps, 'filters' | 'setFilters'>): JSX.Element {
  const selected = filters.slots[filters.slots.length - 1]
  const current = selected === undefined ? -1 : SLOT_OPTIONS.indexOf(selected)
  const next = SLOT_OPTIONS[(current + 1) % SLOT_OPTIONS.length]

  return (
    <Stack direction="row" alignItems="center" spacing={0.25}>
      <ChipMultiSelect
        options={SLOT_OPTIONS}
        value={filters.slots}
        onChange={(slots) => setFilters({ ...filters, slots })}
        label="Slots"
        placeholder="every slot"
        minWidth={190}
        testId="gear-slot"
      />
      <IconButton
        type="button"
        size="small"
        aria-label="Next slot"
        title={`Next slot: ${next}`}
        data-testid="gear-next-slot"
        onClick={() => setFilters({ ...filters, slots: [next] })}
      >
        <ChevronRightIcon fontSize="small" />
      </IconButton>
    </Stack>
  )
}

/** The three closed-list narrowings of WHO a row is: its slots, its weapon kind, its effect kind. */
function SelectRow({ filters, setFilters, visible }: Pick<GearFilterBarProps, 'filters' | 'setFilters' | 'visible'>): JSX.Element {
  return (
    <>
      {visible.has('slot') && <SlotPicker filters={filters} setFilters={setFilters} />}

      {/* JOS-302's third ask. The options are the CATEGORIES first and then the nine types
          (`WEAPON_PICKS`), because "the two-handers" is the common question and a category is only
          ever a union of its members — shared/planner/weaponType.ts states the whole vocabulary and
          the corpus census it was measured from. */}
      {visible.has('weapon') && (
        <ChipMultiSelect
          options={WEAPON_PICKS}
          value={filters.weaponTypes}
          onChange={(weaponTypes) => setFilters({ ...filters, weaponTypes })}
          label="Weapon type"
          placeholder="every kind"
          minWidth={190}
          optionLabel={(pick) => WEAPON_PICK_LABEL[pick]}
          testId="gear-weapon"
        />
      )}

      {visible.has('effect') && (
        <TextField
          select
          size="small"
          label="Effect"
          value={filters.effect}
          data-testid="gear-effect"
          onChange={(e) => setFilters({ ...filters, effect: e.target.value as EffectFilter })}
          sx={{ minWidth: 130, flexShrink: 0 }}
        >
          {EFFECT_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      )}
    </>
  )
}

/** WHICH ITEMS: name, slot, classes, effect kind, era. Search is always drawn — see the header. */
function IdentityRow({ filters, setFilters, text, setText, classes, visible }: Omit<GearFilterBarProps, 'upgrade' | 'priorities' | 'onPriorities' | 'extras' | 'onExtras' | 'showOwnedStats' | 'setShowOwnedStats'>): JSX.Element {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'nowrap' }}>
      <TextField
        size="small"
        label="Search gear"
        value={text}
        data-testid="gear-search"
        onChange={(e) => setText(e.target.value)}
        sx={{ minWidth: 150, flexShrink: 1 }}
      />

      <SelectRow filters={filters} setFilters={setFilters} visible={visible} />

      {/* The app's one "pick several from a closed list" control (components/ChipMultiSelect) —
          the same one the Sky tracker and the exaltation board use for exactly this question.
          SINCE JOS-302 IT NARROWS (see the header): no companion toggle, no chip on the rows it
          removes. The placeholder is what says an empty pick is no filter at all. */}
      {visible.has('classes') && (
        <ChipMultiSelect
          options={CLASS_ABBRS_BY_DISPLAY_NAME}
          value={classes.classes}
          onChange={classes.set}
          label="Classes"
          placeholder="every class"
          optionLabel={classDisplayName}
          minWidth={190}
          testId="gear-classes"
        />
      )}

      {visible.has('classes') && classes.offer !== null && (
        <Chip
          size="small"
          color="warning"
          variant="outlined"
          label={`detected: ${classes.offer.map(classDisplayName).join(', ')}`}
          data-testid="gear-class-offer"
          title="What the app currently infers you are running. Click to read the table for it."
          onClick={classes.adopt}
          sx={{ flexShrink: 0 }}
        />
      )}
    </Stack>
  )
}

/** The simulation and related display and filter controls. */
function NumbersRow({ upgrade, filters, setFilters, visible, showOwnedStats, setShowOwnedStats }: Pick<GearFilterBarProps, 'upgrade' | 'filters' | 'setFilters' | 'visible' | 'showOwnedStats' | 'setShowOwnedStats'>): JSX.Element {
  return (
    <Stack direction="row" spacing={1} useFlexGap alignItems="center" sx={{ flexWrap: 'wrap', minWidth: 0 }}>
      {visible.has('upgrade') && <UpgradeSlider state={upgrade.state} onChange={upgrade.set} />}
      {visible.has('era') && <ToggleChip label="Current era" testId="gear-era-toggle" on={filters.eraOnly} onToggle={() => setFilters({ ...filters, eraOnly: !filters.eraOnly })} hint={`Hide items from outside ${CURRENT_ERA_LABEL}`} />}
      {visible.has('owned') && <ToggleChip label="Owned" testId="gear-owned-toggle" on={filters.ownedOnly} onToggle={() => setFilters({ ...filters, ownedOnly: !filters.ownedOnly })} hint="Keep only wearable copies in your newest /outputfile inventory dump. Some key rings are not counted; see the Owned column." />}
      {visible.has('upgrade') && <ToggleChip label="Use owned stats" testId="gear-owned-stats-toggle" on={showOwnedStats} onToggle={() => setShowOwnedStats(!showOwnedStats)} hint="Use the highest owned copy's tier from your latest inventory dump; other items use the simulation. The dump omits partial tier progress, so these are tier-floor estimates." />}
    </Stack>
  )
}

export default function GearFilterBar(props: GearFilterBarProps): JSX.Element {
  const { filters, setFilters, text, setText, classes, upgrade, visible, priorities, onPriorities, extras, onExtras, showOwnedStats, setShowOwnedStats } = props
  return (
    <Stack spacing={1} sx={{ mb: 1, flexShrink: 0 }}>
      <IdentityRow
        filters={filters}
        setFilters={setFilters}
        text={text}
        setText={setText}
        classes={classes}
        visible={visible}
      />
      <GearPriorityBar value={priorities} onChange={onPriorities} extras={extras} onExtras={onExtras} />
      {(['upgrade', 'era', 'owned'] as const).some((c) => visible.has(c)) && <NumbersRow upgrade={upgrade} filters={filters} setFilters={setFilters} visible={visible} showOwnedStats={showOwnedStats} setShowOwnedStats={setShowOwnedStats} />}
    </Stack>
  )
}
