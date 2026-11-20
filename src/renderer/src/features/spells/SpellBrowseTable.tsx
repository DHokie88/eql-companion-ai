import { Fragment, type JSX } from 'react'
import { Box, Button, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { SpellBrowseSort, SpellMetric, SpellSummary } from '@shared/spellLibrary'
import { spellBrowseEffectText } from '@shared/spellBrowseEffects'
import { amount, efficiencyAmount, wholeAmount, EstimateAmount } from './SpellEstimate'
import { SpellNameButton, SpellSortHeader, type useSpellSort } from './SpellTableControls'
import { SpellRowRank } from './SpellRowRank'
import { SpellCastSummary } from './SpellCastSummary'
import { browseColumns, browseColumnWidth, browseTimingValue, DEFAULT_BROWSE_COLUMNS, type BrowseDisplayField, type CategoryDisplay } from './spellBrowseColumns'
import { useSpellWorkspaceState } from './spellWorkspace'

interface CellProps {
  record: SpellSummary; field: BrowseDisplayField; display: CategoryDisplay; selected: number[]; expanded: boolean
  toggleLine: () => void; onOpen: (id: number) => void; onToggle: (id: number) => void
}
const WRAPPING_COLUMNS = new Set<BrowseDisplayField>(['name', 'description', 'classes', 'category', 'subcategory', 'type', 'spa'])
function NameCell({ record, expanded, toggleLine, onOpen }: CellProps): JSX.Element {
  return <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap"><SpellNameButton id={record.id} onOpen={onOpen}>{record.name}</SpellNameButton>
      {record.line && <Tooltip title={`${record.line.alternatives.length} alternatives. ${record.line.reason}`}><IconButton size="small" aria-label={`Alternatives for ${record.name}`} aria-expanded={expanded} onClick={toggleLine} data-testid={`spells-expand-${record.id}`}><ExpandMoreIcon sx={{ transform: expanded ? 'rotate(180deg)' : undefined }} /></IconButton></Tooltip>}</Stack>
}
function CategoryCell({ record, display }: Pick<CellProps, 'record' | 'display'>): JSX.Element {
  return <>{display === 'subcategory' ? record.subcategory || '-' : record.category || 'Uncategorized'}{display === 'both' && record.subcategory && <Typography variant="caption" display="block" color="text.secondary">{record.subcategory}</Typography>}</>
}
function CalculationCell({ record, field }: Pick<CellProps, 'record' | 'field'>): JSX.Element {
  const calculation = record.calculations?.[0]
  if (field === 'efficiency') return <>{record.mana === 0 ? '-' : efficiencyAmount(calculation?.perMana ?? null)}</>
  return <>{calculation ? <><EstimateAmount calculation={calculation} compact /><SpellCastSummary calculation={calculation} compact /></> : '-'}</>
}
function CompareCell({ record, selected, onToggle }: CellProps): JSX.Element {
  const active = selected.includes(record.id)
  return <Button size="small" variant={active ? 'contained' : 'outlined'} disabled={!active && selected.length >= 4} onClick={() => onToggle(record.id)} data-testid={`spells-compare-${record.id}`}>{active ? 'Selected' : 'Add'}</Button>
}
function SpellCell(props: CellProps): JSX.Element {
  const { record, field } = props
  if (field === 'name') return <NameCell {...props} />
  if (field === 'rank') return <SpellRowRank id={record.id} name={record.name} browseRank={record.browseRank} readOnly />
  if (field === 'selected') return <CompareCell {...props} />
  return <SpellDataCell record={record} field={field} display={props.display} />
}
export function SpellDataCell({ record, field, display = 'both' }: Pick<CellProps, 'record' | 'field'> & { display?: CategoryDisplay }): JSX.Element {
  if (field === 'id') return <>{record.id}</>
  if (field === 'spa') return <SpaCell record={record} />
  if (field === 'category' || field === 'subcategory') return <CategoryCell record={record} display={display} />
  if (field === 'amount' || field === 'efficiency') return <CalculationCell record={record} field={field} />
  if (field === 'mana') return <>{record.calculations?.[0]?.mana ?? record.mana}</>
  return <TextCell record={record} field={field} />
}
function SpaCell({ record }: { record: SpellSummary }): JSX.Element {
  const slots = record.effects ?? []
  if (!slots.length) return <>-</>
  return <Stack gap={0.25} data-testid={`spell-spa-${record.id}`} sx={{ maxWidth: 240 }}>{slots.map((slot) => <Typography key={slot.slot} variant="caption" title={slot.formula ?? (slot.ticks === null ? undefined : `Duration: ${slot.ticks} ticks`)} sx={{ display: 'block', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.35 }}>{spellBrowseEffectText(slot)}</Typography>)}</Stack>
}
function TextCell({ record, field }: Pick<CellProps, 'record' | 'field'>): JSX.Element {
  if (field === 'classes') return <>{record.classes.length ? record.classes.map((c) => `${c.code} ${c.level}`).join(' · ') : 'Internal / NPC'}</>
  if (field === 'description') return <Typography variant="body2" sx={{ minWidth: 220, maxWidth: 420, whiteSpace: 'normal', lineHeight: 1.6 }}>{record.description ?? '-'}</Typography>
  if (field === 'type') return <>{record.typeLabel ?? record.spellType?.toUpperCase() ?? '-'}</>
  return <>{field === 'rate' ? wholeAmount(browseTimingValue(record, field)) : amount(browseTimingValue(record, field))}</>
}
export function SpellBrowseTable({ records, selected, sort, categoryDisplay = 'both', metric = 'damage', columns = DEFAULT_BROWSE_COLUMNS, uniformType = false, onOpen, onToggle }: {
  records: SpellSummary[]; selected: number[]; sort: ReturnType<typeof useSpellSort<SpellBrowseSort>>
  categoryDisplay?: CategoryDisplay; metric?: SpellMetric; columns?: BrowseDisplayField[]; uniformType?: boolean
  onOpen: (id: number) => void; onToggle: (id: number) => void
}): JSX.Element {
  const visible = browseColumns(metric, categoryDisplay, columns, { uniformType })
  const totalWidth = visible.reduce((sum, c) => sum + browseColumnWidth(c.field), 0)
  const [expanded, setExpanded] = useSpellWorkspaceState<string[]>('browse-expanded-lines', [])
  const row = (record: SpellSummary, alternative = false): JSX.Element => <TableRow key={record.id} hover data-testid="spells-record" data-spell-id={record.id} data-alternative={alternative || undefined} sx={alternative ? { bgcolor: 'background.paper' } : undefined}>
    {visible.map(({ field }) => <TableCell key={field} align={field === 'name' || field === 'description' ? 'left' : 'center'} sx={{ whiteSpace: WRAPPING_COLUMNS.has(field) ? 'normal' : 'nowrap', overflowWrap: 'anywhere', ...(field === 'name' ? { pl: alternative ? 3 : 1 } : {}) }}>
      <SpellCell record={record} field={field} display={categoryDisplay} selected={selected} expanded={!!record.line && expanded.includes(record.line.key)} toggleLine={() => {
        const key = record.line?.key
        if (key) setExpanded((current) => current.includes(key) ? current.filter((v) => v !== key) : [...current.slice(-99), key])
      }} onOpen={onOpen} onToggle={onToggle} />
    </TableCell>)}
  </TableRow>
  const plain = new Set<BrowseDisplayField>(['rank', 'spa'])
  const scroll = visible.some((column) => column.field === 'spa' || column.field === 'description')
  return <Box sx={{ overflowX: 'auto' }} data-testid="spells-table-scroll"><Table size="small" aria-label="Spell catalog" sx={{ tableLayout: 'fixed', width: '100%', minWidth: scroll ? totalWidth : '100%', '& .MuiTableCell-root': { px: 1, py: 1, fontVariantNumeric: 'tabular-nums' } }}><colgroup>{visible.map((column) => <col key={column.field} style={{ width: `${100 * browseColumnWidth(column.field) / totalWidth}%` }} />)}</colgroup><TableHead><TableRow>
    {visible.map((column) => plain.has(column.field)
      ? <TableCell key={column.field} align={column.field === 'spa' ? 'left' : 'center'}>{column.label}</TableCell>
      : <SpellSortHeader key={column.field} field={column.field as SpellBrowseSort} label={column.label} sort={sort} align={column.field === 'name' || column.field === 'description' ? 'left' : 'center'} />)}
  </TableRow></TableHead><TableBody>{records.map((record) => <Fragment key={record.id}>{row(record)}{record.line && expanded.includes(record.line.key) && record.line.alternatives.map((alternative) => row(alternative, true))}</Fragment>)}</TableBody></Table></Box>
}
