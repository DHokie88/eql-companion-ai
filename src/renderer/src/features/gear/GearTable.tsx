// Gear's windowed table keeps one fixed-height row per item. Pixel widths and clipping preserve
// the virtualizer's row-height contract. The name and era chip share Item; preview and wish icons
// occupy Actions (owner feedback 2026-10-21). Other data columns are compact, centered and sortable.
// Native titles avoid poppers over toolbar controls; the noninteractive comparison card opens below.

import { type JSX, memo, useMemo } from 'react'
import { Box, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel } from '@mui/material'
import type { GearRow } from '@shared/planner/gear'
import type { WindowedRows } from '../../lib/useWindowedRows'
import { EraChip, DonorName } from '../planner/PlannerChips'
import { statText, type GearColumn } from './gearColumns'
// JOS-338 — the ONE door a card may reach these rows through (its header states the three
// guarantees that make it safe over this tab's dropdown toolbar).
import { GearRowCompare } from './GearCompareCard'
import type { GearCompareData } from './gearData'
import { sortValue, type GearSort, type GearSortKey } from './gearFilter'
import { ownedCellText, ownedCellTitle, ownershipFor, type GearOwnershipMap } from './gearOwnership'
// JOS-343 — the ONE wish control in the app, shared with the Exaltations donor row by owner ruling.
import StarBorderIcon from '@mui/icons-material/StarBorder'
import StarIcon from '@mui/icons-material/Star'
// EQ Zera — the THIRD per-row action: see it on your character. It is handed `row.slots`, so it
// answers "can the model wear this" out of the row already in hand rather than out of a lookup.
import PreviewButton from '../character/PreviewButton'
import GearColumnResize from './GearColumnResize'
import { useGearColumnWidths } from './useGearColumnWidths'
import { gearClassText } from './gearClassText'
import type { ClassAbbr } from '@shared/classCombo'

/** Dense row height (px), MUI `size="small"` — the number the windowing hook is handed. */
export const ROW_HEIGHT = 37

const FIXED_ROW = {
  height: ROW_HEIGHT,
  maxHeight: ROW_HEIGHT,
  '& td': {
    py: 0,
    px: 0.75,
    maxHeight: ROW_HEIGHT,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  }
} as const

/**
 * Compact padding leaves room for the label and arrow (~60px for `Ratio`). A label wider than
 * its sticky cell slides under the next header, which then intercepts clicks aimed at it.
 * gear.e2e.mts measured exactly that.
 * MUI's default 16px a side spends 32px of a ~60px cell on air; 8px keeps the header its own.
 */
const NUMERIC_PAD = { px: 0.75 } as const

/** Long class lists use two 10px lines inside the same fixed-height row. */
function ClassCell({ classes }: { classes: readonly ClassAbbr[] }): JSX.Element {
  const display = gearClassText(classes)
  return (
    <TableCell align="center" title={classes.join(' ')} data-testid="gear-cell-classes">
      <Box data-compact={display.compact ? 'true' : undefined} sx={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        height: ROW_HEIGHT - 2, maxHeight: ROW_HEIGHT - 2, overflow: 'hidden',
        fontSize: display.compact ? '8px' : 'inherit', lineHeight: display.compact ? '10px' : 'inherit'
      }}>
        {display.lines.map((line, index) => <Box key={index} component="span" sx={{ whiteSpace: 'nowrap' }}>{line}</Box>)}
      </Box>
    </TableCell>
  )
}

export interface GearTableProps {
  rows: readonly GearRow[]
  columns: readonly GearColumn[]
  win: WindowedRows
  sort: GearSort
  /**
   * The ownership join (JOS-285), keyed by `row.key` — `null` when this character has never
   * written a dump, which removes the column entirely rather than drawing a blank one
   * (gearColumns.ts states why).
   */
  ownership: GearOwnershipMap | null
  /** the Owned header's own explanation, including the uncounted-keyring note when there is one */
  ownedHint: string
  onSort: (key: GearSortKey) => void
  /**
   * Deep-link an item into the Loot tab's drill-down, where the ItemWindow draws its tier block.
   *
   * THE ONLY PER-ROW ACTION THIS TABLE HAS, since JOS-325. There was a second — `onAssign`, the `+`
   * that dropped a search row into the selected gear set (JOS-286) — and it went with the sets
   * surface the owner retired: no pane, no set to add to, nothing for the button to mean. The
   * argument it used to carry (absent beats disabled, because a button that does nothing is a worse
   * answer than no button) survives it as a general rule, and this prop is now the whole of its
   * application here: a host that has nowhere to send the click passes nothing, and `DonorName`
   * draws plain text rather than a link that goes nowhere.
   */
  onOpenLoot?: (item: string) => void
  /**
   * PUT THIS ROW ON THE WISH LIST, OR TAKE IT OFF (JOS-335, made a toggle by JOS-343) — the second
   * per-row action, and the one the general rule above was waiting for.
   *
   * IT TAKES THE STATE THE ROW WAS DRAWN IN, which is what keeps the handler STABLE: the host's
   * wished set is rebuilt on every edit, so a callback that read the set instead would change
   * identity on every click and defeat `GearLine`'s `memo` for the whole screenful.
   *
   * ABSENT, NEVER DISABLED, when the host has no wish list to write to. That is the same house rule
   * `onOpenLoot` applies one prop up, and here it covers exactly one case: the wish document has not
   * loaded yet, so `wished` would be a GUESS rather than a fact and an added state read off an empty
   * list would be a lie about what is already on it. A button that appears a beat late is honest; a
   * button that says "not wished" about an item that is, is not.
   */
  onToggleWish?: (row: GearRow, wished: boolean) => void
  /**
   * The item keys already on the wish list — the added state, and since JOS-343 the reason a second
   * click on the same row REMOVES rather than doing nothing. Keys are `itemKey(name)`, which IS
   * `row.key`: the corpus join key this whole table is built on, so the membership test is one
   * `Set.has` per rendered row.
   */
  wished: ReadonlySet<string>
  /**
   * SEE THIS ROW ON YOUR CHARACTER (EQ Zera) — App's `openCharacter`, which switches to the
   * Character tab with the item drawn on the model in its own slot. Absent ⇒ no control, the same
   * house rule the two props above state; and even when present, the control draws only for a row
   * whose slots the model has a cell for, so ammo rows keep a clean cell.
   */
  onPreview?: (item: string) => void
  /**
   * WHAT A HOVERED ROW IS COMPARED AGAINST (JOS-338) — the equipped-by-cell index, the corpus by
   * key, and when the dump was exported (`useGearCompare`).
   *
   * ABSENT MEANS NO CARD AT ALL, which is the same absent-not-disabled rule `onWish` states one
   * prop up: a host that cannot answer "what are you wearing" — a surface that draws this table
   * without the dump seam — should draw no card rather than one whose equipped half is a permanent
   * blank. Present-but-not-`ready` is a different thing and the CARD handles it: the reader is
   * hovering, so the card opens and simply says less until the first read lands.
   */
  compare?: GearCompareData
}

/** Gear uses an accessible icon toggle; other wish-list surfaces retain their own presentation. */
function WishButton({
  row,
  wished,
  onToggleWish
}: {
  row: GearRow
  wished: boolean
  onToggleWish: (row: GearRow, wished: boolean) => void
}): JSX.Element {
  return (
    <IconButton
      size="small" data-testid="gear-wish" data-wished={wished ? 'true' : undefined}
      color={wished ? 'success' : 'primary'} aria-pressed={wished}
      aria-label={wished ? `Remove ${row.name} from your wish list` : `Add ${row.name} to your wish list`}
      title={wished ? 'Remove from wish list' : 'Add to wish list'}
      onClick={(event) => { event.stopPropagation(); onToggleWish(row, wished) }}
    >
      {wished ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
    </IconButton>
  )
}

/** The spacer rows that reserve the full scroll height — see useWindowedRows. */
function PadRow({ height, colSpan }: { height: number; colSpan: number }): JSX.Element | null {
  if (height <= 0) return null
  return (
    <TableRow style={{ height }}>
      <TableCell colSpan={colSpan} sx={{ p: 0, border: 0 }} />
    </TableRow>
  )
}

/**
 * ONE CANDIDATE. Every number on it is the SCALED one — the row this component is handed has
 * already been through `scaleAll` at the table's plus-state, so nothing here knows the simulation
 * exists. `memo` because a slider drag re-renders the table and most visible rows are unchanged
 * objects when only the sort moved.
 */
const GearLine = memo(function GearLine({
  row,
  columns,
  ownership,
  wished,
  compare,
  on
}: {
  row: GearRow
  columns: readonly GearColumn[]
  ownership: GearOwnershipMap | null
  /** already on the wish list — a BOOLEAN and not the set, so `memo` can compare it (JOS-335) */
  wished: boolean
  /** the comparison seam (JOS-338); a STABLE object, or absent for a host with no dump seam */
  compare: GearCompareData | undefined
  on: {
    openLoot?: (item: string) => void
    wish?: (row: GearRow, wished: boolean) => void
    preview?: (item: string) => void
  }
}): JSX.Element {
  // ONE MAP LOOKUP PER RENDERED ROW, and only for the screenful the window mounted. `row.key` is
  // already the ownership key — phase 3's seam — so there is nothing to normalise here.
  const owned = ownership === null ? null : ownershipFor(ownership, row)
  const wish = on.wish
  const line = (
    <TableRow hover data-testid="gear-row" data-item-key={row.key} sx={FIXED_ROW}>
      <TableCell sx={{ px: 1.5 }}>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexWrap: 'nowrap', minWidth: 0 }}>
          <DonorName name={row.name} onOpen={on.openLoot} />
          <EraChip subject={row} />
        </Stack>
      </TableCell>
      <TableCell align="center" data-testid="gear-cell-actions">
        <Stack direction="row" justifyContent="center" alignItems="center" spacing={0}>
          <PreviewButton item={row.name} onPreview={on.preview} testId="gear-preview" slots={row.slots} />
          {wish !== undefined && <WishButton row={row} wished={wished} onToggleWish={wish} />}
        </Stack>
      </TableCell>
      <TableCell align="center" title={row.slots.join(' ')}>{row.slots.join(' ')}</TableCell>
      <ClassCell classes={row.classes} />
      {columns.map((c) => (
        <TableCell key={c.key} align="center" data-testid={`gear-cell-${c.key}`} sx={NUMERIC_PAD}>
          {statText(sortValue(row, c.key), c.key)}
        </TableCell>
      ))}
      {owned !== null && (
        <TableCell align="center" data-testid="gear-cell-owned" title={ownedCellTitle(owned)}>
          {ownedCellText(owned)}
        </TableCell>
      )}
    </TableRow>
  )
  // THE CARDS HANG OFF THE WHOLE ROW (JOS-338), which is what the owner asked for — you point at a
  // candidate, not at a particular cell of it. `GearRowCompare` adds no DOM (MUI's Tooltip renders
  // its child and portals the popper), so the FIXED_ROW contract at the top of this file is
  // untouched: same one `<tr>`, same `ROW_HEIGHT`, same windowing arithmetic.
  //
  // WHAT CHANGED UNDER THIS SEAM IN JOS-344, because it is the reason the row is STILL the anchor:
  // the pair opens from the row's bottom-LEFT corner now, not beside its right edge. The old
  // placement read the one edge of a full-width row that is off the screen, and drew the card 3px
  // inside a 1268px window — present in the DOM, invisible to a human. `GearCompareCard.tsx`'s
  // header carries the measurement and the new law; nothing here had to move for it.
  return compare === undefined ? line : (
    <GearRowCompare row={row} data={compare}>
      {line}
    </GearRowCompare>
  )
})

/** One sortable header cell — clicking it sorts by that column, clicking again flips direction. */
function SortHeader({
  column,
  sort,
  width,
  align = 'center',
  onSort,
  onResize,
  title,
  testId
}: {
  column: { key: GearSortKey; label: string }
  sort: GearSort
  width: number
  title?: string
  testId?: string
  align?: 'center'
  onSort: (key: GearSortKey) => void
  onResize: (key: string, width: number | null) => void
}): JSX.Element {
  const active = sort.key === column.key
  return (
    <TableCell align={align} sortDirection={active ? sort.dir : false} title={title} data-testid={testId} sx={{ px: 0.75, position: 'sticky', ...(align === 'center' ? NUMERIC_PAD : {}) }}>
      <TableSortLabel
        active={active}
        sx={{ width: '100%', maxWidth: '100%', display: 'flex', justifyContent: 'center', position: 'relative', overflow: 'hidden', whiteSpace: 'nowrap', mx: 0, '& .MuiTableSortLabel-icon': { position: 'absolute', right: 4, m: 0, fontSize: 12 } }}
        direction={active ? sort.dir : 'desc'}
        data-testid={`gear-sort-${column.key}`}
        onClick={() => onSort(column.key)}
      >
        {column.label}
      </TableSortLabel>
      <GearColumnResize column={column.key} label={column.label} width={width} onResize={onResize} />
    </TableCell>
  )
}

export default function GearTable({
  rows,
  columns,
  win,
  sort,
  ownership,
  ownedHint,
  onSort,
  onOpenLoot,
  onToggleWish,
  onPreview,
  wished,
  compare
}: GearTableProps): JSX.Element {
  const span = columns.length + (ownership === null ? 4 : 5)
  const { tableRef, widths, total, resize } = useGearColumnWidths(columns, ownership !== null)
  // ONE object for the row's callbacks, memoized on the callbacks themselves: `GearLine` is
  // `memo`'d and a fresh literal per render would defeat it on every keystroke. It held two until
  // JOS-325 retired the `+`, and holds two again since JOS-335 — which is exactly why it stayed an
  // object through the year it held one: the wrapper is what the memo depends on.
  const handlers = useMemo(
    () => ({ openLoot: onOpenLoot, wish: onToggleWish, preview: onPreview }),
    [onOpenLoot, onToggleWish, onPreview]
  )
  return (
    <Table
      size="small"
      stickyHeader
      data-testid="gear-table"
      data-layout="pixel"
      ref={tableRef}
      sx={{ tableLayout: 'fixed', width: total }}
    >
      <colgroup>
        {Object.entries(widths).map(([key, width]) => <col key={key} style={{ width }} />)}
      </colgroup>
      <TableHead>
        <TableRow>
          <SortHeader column={{ key: 'name', label: 'Item' }} sort={sort} width={widths.name} onSort={onSort} onResize={resize} />
          <TableCell align="center" sx={{ position: 'sticky', px: 0.75 }}>Actions<GearColumnResize column="actions" label="Actions" width={widths.actions} onResize={resize} /></TableCell>
          <SortHeader column={{ key: 'slot', label: 'Slot' }} sort={sort} width={widths.slot} align="center" onSort={onSort} onResize={resize} />
          <SortHeader column={{ key: 'classes', label: 'Classes' }} sort={sort} width={widths.classes} align="center" onSort={onSort} onResize={resize} />
          {columns.map((c) => (
            <SortHeader key={c.key} column={c} sort={sort} width={widths[c.key]} align="center" onSort={onSort} onResize={resize} />
          ))}
          {ownership !== null && (
            <SortHeader column={{ key: 'owned', label: 'Owned' }} sort={sort} width={widths.owned} align="center" onSort={onSort} onResize={resize} title={ownedHint} testId="gear-owned-header" />
          )}
        </TableRow>
      </TableHead>
      <TableBody>
        <PadRow height={win.topPad} colSpan={span} />
        {rows.slice(win.start, win.end).map((row) => (
          <GearLine
            key={row.key}
            row={row}
            columns={columns}
            ownership={ownership}
            wished={wished.has(row.key)}
            compare={compare}
            on={handlers}
          />
        ))}
        <PadRow height={win.bottomPad} colSpan={span} />
      </TableBody>
    </Table>
  )
}
