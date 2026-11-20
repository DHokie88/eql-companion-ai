import type { JSX } from 'react'
import { Box, IconButton, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import type { SpellBrowseSort, SpellCalculation, SpellComparisonSummary } from '@shared/spellLibrary'
import { sortSpellCalculations, type SpellCalculationSort } from '@shared/clientSpellBrowse'
import { amount, efficiencyAmount, EstimateAmount, ModeledRate } from './SpellEstimate'
import { SpellCastSummary } from './SpellCastSummary'
import { SpellAnalysisBreakdown } from './SpellAnalysisBreakdown'
import { spellComparisonDifferences, type SpellDifference } from '@shared/spellAnalysisPresentation'
import { SpellNameButton, SpellSortHeader, useSpellSort, visibleSpellSort } from './SpellTableControls'
import type { SpellBrowseRankMetadata } from '@shared/spellLibrary'
import type { SpellRankEvidence } from '@shared/spellModifiers'
import { SpellRowRank } from './SpellRowRank'
import { SpellDataCell } from './SpellBrowseTable'
import { selectableBrowseColumns, type BrowseDisplayField } from './spellBrowseColumns'
import { hitPointMetric, type SpellCompareMetric } from '@shared/spellCompareMetric'

type CompareSort = SpellCalculationSort | SpellBrowseSort
interface CompareColumn {
  field: CompareSort | 'rank' | 'remove' | 'spa' | 'effect-duration' | 'effects'
  label: string; numeric?: boolean; extra?: boolean
}
export const DEFAULT_COMPARE_COLUMNS: BrowseDisplayField[] = [
  'rank', 'classes', 'remove', 'instant', 'perTick', 'amount', 'mana', 'efficiency', 'rate', 'recast', 'scope', 'effects'
]
const coreFields = new Map<BrowseDisplayField, SpellCalculationSort>([
  ['amount', 'total'], ['mana', 'mana'], ['efficiency', 'perMana'], ['rate', 'rate'], ['instant', 'instant'], ['perTick', 'perTick']
])
const specialFields = new Set<BrowseDisplayField>(['rank', 'remove', 'scope', 'effects', 'effect-duration'])

export function compareColumns(chosen: BrowseDisplayField[], metric: SpellCompareMetric): CompareColumn[] {
  const hp = hitPointMetric(metric)
  const available = selectableBrowseColumns(hp ?? 'damage', hp ? 'compare-hp' : 'compare-effects').filter(({ field }) => chosen.includes(field))
  return [
    ...available.filter(({ field }) => field === 'remove').map(asCompareColumn),
    { field: 'name', label: 'Spell' },
    ...available.filter(({ field }) => field !== 'remove').map(asCompareColumn)
  ]
}
function asCompareColumn({ field, label }: { field: BrowseDisplayField; label: string }): CompareColumn {
  const core = coreFields.get(field)
  return core ? { field: core, label, numeric: true } : { field: field as CompareColumn['field'], label, extra: !specialFields.has(field) }
}
type ComparisonSummaries = Record<string, SpellComparisonSummary>
function isSortColumn(field: CompareColumn['field']): field is CompareSort {
  return field !== 'rank' && field !== 'remove' && field !== 'spa' && field !== 'effects' && field !== 'effect-duration'
}
export function SpellCalculationTable({ rows, summaries = {}, columns, onOpen, onRemove, referenceId, rankEvidence, browseRank }: {
  rows: SpellCalculation[]; summaries?: ComparisonSummaries; columns: CompareColumn[]
  onOpen: (id: number) => void; onRemove?: (id: number) => void; referenceId?: number
  rankEvidence?: Record<string, SpellRankEvidence | null>; browseRank?: Record<string, SpellBrowseRankMetadata | null>
}): JSX.Element {
  const sort = visibleSpellSort(useSpellSort<CompareSort>('total', 'desc'), columns, 'name')
  const sorted = sortSpellCalculations(rows, sort.field, sort.direction, summaries)
  const reference = rows.find((row) => row.id === referenceId)
  return <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Selected spell comparison" sx={{ '& .MuiTableCell-root': { px: 1 } }}><TableHead><TableRow>
    {columns.map(({ field, label, numeric }) => isSortColumn(field) ? <SpellSortHeader key={field} field={field} label={label} numeric={numeric} sort={sort} /> : <TableCell key={field}>{label}</TableCell>)}
  </TableRow></TableHead><TableBody>{sorted.map((row) => <CalculationRow key={row.id} row={row} summary={summaries[String(row.id)]} columns={columns} evidence={rankEvidence?.[String(row.id)]} browseRank={browseRank?.[String(row.id)]} onOpen={onOpen} onRemove={onRemove} reference={reference} />)}</TableBody></Table></Box>
}
interface CalculationRowProps {
  row: SpellCalculation; summary?: SpellComparisonSummary; columns: CompareColumn[]; onOpen: (id: number) => void; onRemove?: (id: number) => void
  reference?: SpellCalculation; evidence?: SpellRankEvidence | null; browseRank?: SpellBrowseRankMetadata | null
}
function CalculationRow({ row, summary, columns, onOpen, onRemove, reference, evidence, browseRank }: CalculationRowProps): JSX.Element {
  const differences = reference && row.id !== reference.id ? spellComparisonDifferences(row, reference) : null
  return <TableRow data-testid="spells-calculation">{columns.map((column) => {
    const { field } = column
    switch (field) {
      case 'name': return <TableCell key={field} sx={{ minWidth: 190 }}><SpellNameButton id={row.id} onOpen={onOpen}>{row.name}</SpellNameButton></TableCell>
      case 'rank': return <TableCell key={field}><SpellRowRank id={row.id} name={row.name} evidence={evidence} browseRank={browseRank} /></TableCell>
      case 'remove': return <TableCell key={field}><RemoveSpell row={row} onRemove={onRemove} /></TableCell>
      case 'effect-duration': return <TableCell key={field}>{summary?.presentation?.duration ?? '-'}</TableCell>
      case 'effects': return <EffectComparisonCell key={field} row={row} summary={summary} />
    }
    if (column.extra) return <TableCell key={field}>{summary ? <SpellDataCell field={field as BrowseDisplayField} record={{ ...summary, calculations: [row] }} /> : '-'}</TableCell>
    return <CalculationValueCell key={field} field={field} row={row} differences={differences} />
  })}
  </TableRow>
}
function EffectComparisonCell({ row, summary }: { row: SpellCalculation; summary?: SpellComparisonSummary }): JSX.Element {
  const effects = summary?.presentation?.effects ?? []
  return <TableCell data-testid={`compare-effect-list-${summary?.id ?? 'unknown'}`} sx={{ minWidth: 200 }}>
    {effects.length ? effects.map(({ slot, text }) => <Typography key={slot} variant="body2">{text}</Typography>)
      : row.effectSummary ? <Typography variant="body2" data-testid={`compare-effects-${row.id}`}>Base: {row.effectSummary}</Typography> : '-'}
  </TableCell>
}
interface CalculationValueProps {
  field: CompareColumn['field']; row: SpellCalculation; differences: ReturnType<typeof spellComparisonDifferences> | null
}
function CalculationValueCell({ field, row, differences }: CalculationValueProps): JSX.Element {
  if (field === 'instant') return <TableCell align="right">{amount(row.instant)}</TableCell>
  if (field === 'perTick') return <PeriodicCell row={row} />
  if (field !== 'scope') return <ComparisonMetricCell field={field} row={row} differences={differences} />
  const rain = row.analysis?.deliveryKind === 'rain' ? row.analysis : null
  return <TableCell sx={{ minWidth: 180 }}><Typography variant="caption">{row.analysis?.scope ?? 'One target'}</Typography>
    {rain && <Typography variant="caption" display="block" color="text.secondary">Rain · {rain.waves} waves max · {rain.hitCap} hits max</Typography>}
    <SpellAnalysisBreakdown calculation={row} />
  </TableCell>
}
function ComparisonMetricCell({ field, row, differences }: CalculationValueProps): JSX.Element {
  if (field === 'total') return <TableCell align="right"><EstimateAmount calculation={row} compact /><SpellCastSummary calculation={row} compact />{differences && <Delta value={differences.amount} />}</TableCell>
  if (field === 'mana') return <TableCell align="right">{row.mana}{differences && <Delta value={differences.mana} />}</TableCell>
  if (field === 'perMana') return <TableCell align="right">{row.mana === 0 ? 'Zero mana' : efficiencyAmount(row.perMana)}{differences && <Delta value={differences.efficiency} />}</TableCell>
  return <TableCell align="right"><ModeledRate calculation={row} />{differences && <Delta value={differences.rate} />}</TableCell>
}
function RemoveSpell({ row, onRemove }: Pick<CalculationRowProps, 'row' | 'onRemove'>): JSX.Element | null {
  if (!onRemove) return null
  return <Tooltip title="Remove from comparison"><IconButton size="small" aria-label={`Remove ${row.name} from comparison`}
    data-testid={`spells-remove-${row.id}`} onClick={() => onRemove(row.id)}><CloseIcon fontSize="small" /></IconButton></Tooltip>
}
function PeriodicCell({ row }: { row: SpellCalculation }): JSX.Element {
  return <TableCell align="right">{row.perTick === null ? '-' : `${amount(row.perTick)} × ${row.ticks ?? '?'}`}</TableCell>
}
function Delta({ value }: { value: SpellDifference }): JSX.Element {
  const absolute = value.absolute === null ? 'Unavailable' : `${value.absolute >= 0 ? '+' : ''}${amount(value.absolute)}`
  const percent = value.percent === null ? 'percentage unavailable' : `${value.percent >= 0 ? '+' : ''}${amount(value.percent)}%`
  return <Typography variant="caption" display="block" color="text.secondary" data-testid="comparison-delta">{absolute} ({percent}) vs reference</Typography>
}
