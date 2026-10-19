import { Fragment, type JSX } from 'react'
import { Box, Button, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { SpellBrowseSort, SpellMetric, SpellSummary } from '@shared/spellLibrary'
import { amount, EstimateAmount } from './SpellEstimate'
import { SpellNameButton, SpellSortHeader, type useSpellSort } from './SpellTableControls'
import { SpellRowRank } from './SpellRowRank'
import { SpellCastSummary } from './SpellCastSummary'
import { browseColumns, browseTimingValue, DEFAULT_BROWSE_COLUMNS, type CategoryDisplay } from './spellBrowseColumns'
import { useSpellWorkspaceState } from './spellWorkspace'

interface CellProps {
  record: SpellSummary; field: SpellBrowseSort; display: CategoryDisplay; selected: number[]; expanded: boolean
  toggleLine: () => void; onOpen: (id: number) => void; onToggle: (id: number) => void
}
function NameCell({ record, expanded, toggleLine, onOpen }: CellProps): JSX.Element {
  return <><Stack direction="row" alignItems="center" gap={0.5}><SpellNameButton id={record.id} onOpen={onOpen}>{record.name}</SpellNameButton>
      {record.line && <Tooltip title={`${record.line.alternatives.length} alternatives. ${record.line.reason}`}><IconButton size="small" aria-label={`Alternatives for ${record.name}`} aria-expanded={expanded} onClick={toggleLine} data-testid={`spells-expand-${record.id}`}><ExpandMoreIcon sx={{ transform: expanded ? 'rotate(180deg)' : undefined }} /></IconButton></Tooltip>}</Stack>
      <SpellRowRank id={record.id} name={record.name} evidence={record.rankEvidence} /></>
}
function CategoryCell({ record, display }: CellProps): JSX.Element {
  return <>{display === 'subcategory' ? record.subcategory || '-' : record.category || 'Uncategorized'}{display === 'both' && record.subcategory && <Typography variant="caption" display="block" color="text.secondary">{record.subcategory}</Typography>}</>
}
function CalculationCell({ record, field }: CellProps): JSX.Element {
  const calculation = record.calculations?.[0]
  if (field === 'efficiency') return <>{record.mana === 0 ? '-' : amount(calculation?.perMana ?? null)}</>
  return <>{calculation ? <><EstimateAmount calculation={calculation} compact /><SpellCastSummary calculation={calculation} compact /></> : '-'}</>
}
function CompareCell({ record, selected, onToggle }: CellProps): JSX.Element {
  const active = selected.includes(record.id)
  return <Button size="small" variant={active ? 'contained' : 'outlined'} disabled={!active && selected.length >= 4} onClick={() => onToggle(record.id)} data-testid={`spells-compare-${record.id}`}>{active ? 'Selected' : 'Add'}</Button>
}
function SpellCell(props: CellProps): JSX.Element {
  const { record, field } = props
  switch (field) {
    case 'id': return <>{record.id}</>
    case 'name': return <NameCell {...props} />
    case 'category':
    case 'subcategory': return <CategoryCell {...props} />
    case 'amount':
    case 'efficiency': return <CalculationCell {...props} />
    case 'mana': return <>{record.mana}</>
    case 'selected': return <CompareCell {...props} />
    default: return <TextCell record={record} field={field} />
  }
}
function TextCell({ record, field }: Pick<CellProps, 'record' | 'field'>): JSX.Element {
  if (field === 'classes') return <>{record.classes.length ? record.classes.map((c) => `${c.code} ${c.level}`).join(' · ') : 'Internal / NPC'}</>
  if (field === 'description') return <Typography variant="body2" sx={{ minWidth: 220, maxWidth: 420, whiteSpace: 'normal', lineHeight: 1.6 }}>{record.description ?? '-'}</Typography>
  if (field === 'type') return <>{record.typeLabel ?? record.spellType?.toUpperCase() ?? '-'}</>
  return <>{amount(browseTimingValue(record, field))}</>
}
export function SpellBrowseTable({ records, selected, sort, filters, metric = 'damage', columns = DEFAULT_BROWSE_COLUMNS, uniformType = false, onOpen, onToggle }: {
  records: SpellSummary[]; selected: number[]; sort: ReturnType<typeof useSpellSort<SpellBrowseSort>>
  filters?: { category: string; subcategory: string }; metric?: SpellMetric; columns?: SpellBrowseSort[]; uniformType?: boolean
  onOpen: (id: number) => void; onToggle: (id: number) => void
}): JSX.Element {
  const categoryDisplay = !filters?.category ? 'both' : filters.subcategory ? 'none' : 'subcategory'
  const visible = browseColumns(metric, categoryDisplay, columns, uniformType)
  const [expanded, setExpanded] = useSpellWorkspaceState<string[]>('browse-expanded-lines', [])
  const row = (record: SpellSummary, alternative = false): JSX.Element => <TableRow key={record.id} hover data-testid="spells-record" data-spell-id={record.id} data-alternative={alternative || undefined} sx={alternative ? { bgcolor: 'background.paper' } : undefined}>
    {visible.map(({ field }) => <TableCell key={field} align={field === 'name' || field === 'description' ? 'left' : 'center'} sx={field === 'name' ? { minWidth: 190, maxWidth: 320, pl: alternative ? 3 : 1 } : field === 'classes' ? { minWidth: 120 } : undefined}>
      <SpellCell record={record} field={field} display={categoryDisplay} selected={selected} expanded={!!record.line && expanded.includes(record.line.key)} toggleLine={() => {
        const key = record.line?.key
        if (key) setExpanded((current) => current.includes(key) ? current.filter((v) => v !== key) : [...current.slice(-99), key])
      }} onOpen={onOpen} onToggle={onToggle} />
    </TableCell>)}
  </TableRow>
  return <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Spell catalog" sx={{ '& .MuiTableCell-root': { px: 1, py: 1.5 } }}><TableHead><TableRow>
    {visible.map((column) => <SpellSortHeader key={column.field} {...column} sort={sort} align={column.field === 'name' || column.field === 'description' ? 'left' : 'center'} />)}
  </TableRow></TableHead><TableBody>{records.map((record) => <Fragment key={record.id}>{row(record)}{record.line && expanded.includes(record.line.key) && record.line.alternatives.map((alternative) => row(alternative, true))}</Fragment>)}</TableBody></Table></Box>
}
