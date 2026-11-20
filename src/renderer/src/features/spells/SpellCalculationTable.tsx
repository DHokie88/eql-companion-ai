import type { JSX } from 'react'
import { Box, Button, IconButton, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import type { SpellBrowseSort, SpellCalculation, SpellMetric, SpellSummary } from '@shared/spellLibrary'
import { sortSpellCalculations, type SpellCalculationSort } from '@shared/clientSpellBrowse'
import { amount, efficiencyAmount, wholeAmount, EstimateAmount } from './SpellEstimate'
import { SpellCastSummary } from './SpellCastSummary'
import { SpellAnalysisBreakdown } from './SpellAnalysisBreakdown'
import { spellComparisonDifferences, type SpellDifference } from '@shared/spellAnalysisPresentation'
import { SpellNameButton, SpellSortHeader, useSpellSort } from './SpellTableControls'
import type { SpellBrowseRankMetadata } from '@shared/spellLibrary'
import type { SpellRankEvidence } from '@shared/spellModifiers'
import { SpellRowRank } from './SpellRowRank'
import { SpellDataCell } from './SpellBrowseTable'
import { selectableBrowseColumns, type BrowseDisplayField } from './spellBrowseColumns'

type CompareSort = SpellCalculationSort | SpellBrowseSort
interface CompareColumn { field: CompareSort | 'era' | 'spa'; label: string; numeric?: boolean; extra?: boolean }
export const DEFAULT_COMPARE_COLUMNS: BrowseDisplayField[] = ['amount', 'mana', 'efficiency', 'rate']
const coreFields = new Map<BrowseDisplayField, SpellCalculationSort>([['amount', 'total'], ['mana', 'mana'], ['efficiency', 'perMana'], ['rate', 'rate']])

export function compareColumns(chosen: BrowseDisplayField[], metric: SpellMetric): CompareColumn[] {
  return [
    { field: 'name', label: 'Spell' }, { field: 'instant', label: 'Instant', numeric: true }, { field: 'perTick', label: 'Per tick × ticks', numeric: true },
    ...selectableBrowseColumns(metric).filter(({ field }) => chosen.includes(field)).map(({ field, label }): CompareColumn => {
      const core = coreFields.get(field)
      return core ? { field: core, label, numeric: true } : { field: field as CompareColumn['field'], label, extra: true }
    }),
    { field: 'scope', label: 'Scope / exclusions' }
  ]
}
type ComparisonSummaries = Record<string, SpellSummary>
export function SpellCalculationTable({ rows, summaries = {}, columns, onOpen, onRemove, referenceId, rankEvidence, browseRank }: {
  rows: SpellCalculation[]; summaries?: ComparisonSummaries; columns: CompareColumn[]
  onOpen: (id: number) => void; onRemove?: (id: number) => void; referenceId?: number
  rankEvidence?: Record<string, SpellRankEvidence | null>; browseRank?: Record<string, SpellBrowseRankMetadata | null>
}): JSX.Element {
  const sort = useSpellSort<CompareSort>('total', 'desc')
  const sorted = sortSpellCalculations(rows, sort.field, sort.direction, summaries)
  const reference = rows.find((row) => row.id === referenceId)
  return <Box sx={{ overflowX: 'auto' }}><Table size="small" sx={{ '& .MuiTableCell-root': { px: 1 } }}><TableHead><TableRow>
    {columns.map(({ field, label, numeric }) => field === 'era' || field === 'spa' || field === 'selected' ? <TableCell key={field}>{label}</TableCell> : <SpellSortHeader key={field} field={field} label={label} numeric={numeric} sort={sort} />)}
  </TableRow></TableHead><TableBody>{sorted.map((row) => <CalculationRow key={row.id} row={row} summary={summaries[String(row.id)]} columns={columns} evidence={rankEvidence?.[String(row.id)]} browseRank={browseRank?.[String(row.id)]} onOpen={onOpen} onRemove={onRemove} reference={reference} />)}</TableBody></Table></Box>
}
interface CalculationRowProps {
  row: SpellCalculation; summary?: SpellSummary; columns: CompareColumn[]; onOpen: (id: number) => void; onRemove?: (id: number) => void
  reference?: SpellCalculation; evidence?: SpellRankEvidence | null; browseRank?: SpellBrowseRankMetadata | null
}
function CalculationRow({ row, summary, columns, onOpen, onRemove, reference, evidence, browseRank }: CalculationRowProps): JSX.Element {
  const differences = reference && row.id !== reference.id ? spellComparisonDifferences(row, reference) : null
  const separateRemove = columns.some(({ field }) => field === 'selected')
  return <TableRow data-testid="spells-calculation">{columns.map((column) => {
    const { field } = column
    if (field === 'name') return <SpellIdentityCell key={field} row={row} summary={summary} evidence={evidence} browseRank={browseRank} onOpen={onOpen} onRemove={separateRemove ? undefined : onRemove} />
    if (field === 'selected') return <TableCell key={field}>{onRemove && <Button size="small" aria-label={`Remove ${row.name} from comparison`} onClick={() => onRemove(row.id)} data-testid={`spells-remove-${row.id}`}>Remove</Button>}</TableCell>
    if (column.extra) return <TableCell key={field}>{summary ? <SpellDataCell field={field as BrowseDisplayField} record={{ ...summary, calculations: [row] }} /> : '-'}</TableCell>
    return <CalculationValueCell key={field} field={field} row={row} differences={differences} />
  })}
  </TableRow>
}
interface CalculationValueProps {
  field: CompareColumn['field']; row: SpellCalculation; differences: ReturnType<typeof spellComparisonDifferences> | null
}
function CalculationValueCell({ field, row, differences }: CalculationValueProps): JSX.Element {
  if (field === 'instant') return <TableCell align="right">{amount(row.instant)}</TableCell>
  if (field === 'perTick') return <PeriodicCell row={row} />
  if (field !== 'scope') return <ComparisonMetricCell field={field} row={row} differences={differences} />
  return <TableCell sx={{ minWidth: 180 }}><Typography variant="caption">{row.analysis?.scope ?? 'One target'}</Typography><SpellAnalysisBreakdown calculation={row} /></TableCell>
}
function ComparisonMetricCell({ field, row, differences }: CalculationValueProps): JSX.Element {
  if (field === 'total') return <TableCell align="right"><EstimateAmount calculation={row} compact /><SpellCastSummary calculation={row} compact />{differences && <Delta value={differences.amount} />}</TableCell>
  if (field === 'mana') return <TableCell align="right">{row.mana}{differences && <Delta value={differences.mana} />}</TableCell>
  if (field === 'perMana') return <TableCell align="right">{row.mana === 0 ? 'Zero mana' : efficiencyAmount(row.perMana)}{differences && <Delta value={differences.efficiency} />}</TableCell>
  return <TableCell align="right">{wholeAmount(row.analysis?.timing.rate ?? null)}{differences && <Delta value={differences.rate} />}</TableCell>
}
function SpellIdentityCell({ row, summary, onOpen, onRemove, evidence, browseRank }: Omit<CalculationRowProps, 'columns' | 'reference'>): JSX.Element {
  const rain = row.analysis?.deliveryKind === 'rain' ? row.analysis : null
  return <TableCell sx={{ minWidth: 190 }}><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    {onRemove && <Tooltip title="Remove from comparison"><IconButton size="small" aria-label={`Remove ${row.name} from comparison`} data-testid={`spells-remove-${row.id}`} onClick={() => onRemove(row.id)} sx={{ flexShrink: 0 }}><CloseIcon fontSize="small" /></IconButton></Tooltip>}
    <SpellNameButton id={row.id} onOpen={onOpen}>{row.name}</SpellNameButton>
  </Box><SpellRowRank id={row.id} name={row.name} evidence={evidence} browseRank={browseRank} />
    {summary && <Typography variant="caption" display="block" color="text.secondary"><SpellDataCell field="classes" record={summary} /></Typography>}
    {rain && <Typography variant="caption" display="block" color="text.secondary">Rain · {rain.waves} waves max · {rain.hitCap} hits max</Typography>}
    {row.effectSummary && <Typography variant="body2" data-testid={`compare-effects-${row.id}`} sx={{ whiteSpace: 'normal', maxWidth: 260 }}>Base: {row.effectSummary}</Typography>}
  </TableCell>
}
function PeriodicCell({ row }: { row: SpellCalculation }): JSX.Element {
  return <TableCell align="right">{row.perTick === null ? '-' : `${amount(row.perTick)} × ${row.ticks ?? '?'}`}</TableCell>
}
function Delta({ value }: { value: SpellDifference }): JSX.Element {
  const absolute = value.absolute === null ? 'Unavailable' : `${value.absolute >= 0 ? '+' : ''}${amount(value.absolute)}`
  const percent = value.percent === null ? 'percentage unavailable' : `${value.percent >= 0 ? '+' : ''}${amount(value.percent)}%`
  return <Typography variant="caption" display="block" color="text.secondary" data-testid="comparison-delta">{absolute} ({percent}) vs reference</Typography>
}
