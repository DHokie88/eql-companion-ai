import { type JSX, useCallback, useState } from 'react'
import { Alert, Box, Button, CircularProgress, FormControl, InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import type { SpellCalculation, SpellClass, SpellMetric } from '@shared/spellLibrary'
import type { SpellEvaluationOptions } from '@shared/spellModifiers'
import { useLibraryQuery } from './useLibraryQuery'
import { amount, EstimateAmount, EstimateExplanation } from './SpellEstimate'

function CalculationRows({ rows, onOpen, onRemove }: { rows: SpellCalculation[]; onOpen: (id: number) => void; onRemove?: (id: number) => void }): JSX.Element {
  return <Box sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>Spell</TableCell><TableCell align="right">Instant</TableCell><TableCell align="right">Per tick × ticks</TableCell><TableCell align="right">Full amount / target</TableCell><TableCell align="right">Client mana</TableCell><TableCell align="right">Amount / client mana</TableCell><TableCell>Scope / exclusions</TableCell>{onRemove && <TableCell />}</TableRow></TableHead><TableBody>{rows.map((r) => <TableRow key={r.id} data-testid="spells-calculation">
    <TableCell><Button size="small" onClick={() => onOpen(r.id)}>{r.name}</Button><Typography variant="caption" display="block">ID {r.id} · target {r.target}</Typography></TableCell><TableCell align="right">{amount(r.instant)}</TableCell><TableCell align="right">{r.perTick === null ? '-' : `${amount(r.perTick)} × ${r.ticks ?? '?'}`}</TableCell><TableCell align="right"><EstimateAmount calculation={r} /></TableCell><TableCell align="right">{r.mana}</TableCell><TableCell align="right">{r.mana === 0 ? 'Zero mana' : amount(r.perMana)}</TableCell><TableCell sx={{ minWidth: 180 }}><EstimateExplanation calculation={r} /></TableCell>{onRemove && <TableCell><Button size="small" onClick={() => onRemove(r.id)}>Remove</Button></TableCell>}
  </TableRow>)}</TableBody></Table></Box>
}

export function SpellCompare({ ids, classes, level, evaluation, onRemove, onOpen }: { ids: number[]; classes: SpellClass[]; level: number; evaluation: SpellEvaluationOptions; onRemove: (id: number) => void; onOpen: (id: number) => void }): JSX.Element {
  const [metric, setMetric] = useState<SpellMetric>('damage')
  const [ranking, setRanking] = useState<'amount' | 'efficiency'>('amount')
  const idsKey = ids.join(',')
  const classKey = classes.join(',')
  const compare = useCallback(() => window.eq.spellLibrary.compare({ ids: idsKey ? idsKey.split(',').map(Number) : [], level, metric, evaluation }), [idsKey, level, metric, evaluation])
  const rank = useCallback(() => window.eq.spellLibrary.rank({ classes: classKey ? classKey.split(',') as SpellClass[] : [], level, metric, ranking, limit: 20, evaluation }), [classKey, level, metric, ranking, evaluation])
  const compared = useLibraryQuery(compare)
  const ranked = useLibraryQuery(rank)
  return <Stack spacing={2} data-testid="spells-compare">
    <CalculationScope evaluation={evaluation} />
    <Stack direction="row" gap={1} flexWrap="wrap"><FormControl size="small" sx={{ minWidth: 150 }}><InputLabel id="spell-metric-label">Metric</InputLabel><Select labelId="spell-metric-label" label="Metric" value={metric} data-testid="spells-metric" onChange={(e) => setMetric(e.target.value as SpellMetric)}><MenuItem value="damage">Damage</MenuItem><MenuItem value="healing">Healing</MenuItem></Select></FormControl><FormControl size="small" sx={{ minWidth: 190 }}><InputLabel id="spell-ranking-label">Rank by</InputLabel><Select labelId="spell-ranking-label" label="Rank by" value={ranking} data-testid="spells-ranking" onChange={(e) => setRanking(e.target.value as typeof ranking)}><MenuItem value="amount">Full amount per target</MenuItem><MenuItem value="efficiency">Amount per mana</MenuItem></Select></FormControl></Stack>
    <Typography variant="h6">Selected spells · level {level}</Typography>
    {ids.length === 0 && <Typography color="text.secondary">Add up to four spells from Browse to compare their numeric records side by side.</Typography>}
    {compared.error && <Alert severity="error">{compared.error}</Alert>}{compared.loading && <CircularProgress size={22} />}
    {compared.data && <><CalculationRows rows={compared.data.results} onOpen={onOpen} onRemove={onRemove} /><Typography variant="caption" color="text.secondary">{compared.data.scope}</Typography></>}
    <Typography variant="h6">Full catalog rankings</Typography>
    <Typography variant="body2" color="text.secondary">{classes.length ? classes.join(' / ') : 'All classes'} · eligible through level {level}. Rankings scan the entire captured catalog.</Typography>
    {ranked.error && <Alert severity="error">{ranked.error}</Alert>}{ranked.loading && <CircularProgress size={22} />}
    {ranked.data && <>
      <Typography variant="caption" data-testid="spells-ranked-count">Scanned {ranked.data.scanned.toLocaleString()} client records; {ranked.data.eligible.toLocaleString()} eligible · revision {ranked.data.dataset?.contentId.slice(0, 14)}</Typography>
      <Typography variant="subtitle1">Direct {metric}</Typography><CalculationRows rows={ranked.data.direct} onOpen={onOpen} />
      <Typography variant="subtitle1">Full-duration periodic {metric}</Typography><CalculationRows rows={ranked.data.periodic} onOpen={onOpen} />
      {ranked.data.zeroMana.length > 0 && <><Typography variant="subtitle1">Zero mana · separate from efficiency rankings</Typography><CalculationRows rows={ranked.data.zeroMana} onOpen={onOpen} /></>}
      {ranked.data.excludedCount > 0 && <><Typography variant="subtitle1">Excluded calculations ({ranked.data.excludedCount})</Typography><CalculationRows rows={ranked.data.excluded} onOpen={onOpen} /><Typography variant="caption">Showing up to 20 excluded examples. Unsupported formulas are never treated as zero.</Typography></>}
    </>}
  </Stack>
}

function CalculationScope({ evaluation }: { evaluation: SpellEvaluationOptions }): JSX.Element {
  return <Alert severity="info">{evaluation.mode === 'client' ? 'Unmodified client values. Motes and focus are excluded.' : 'Character estimates use modeled mote ranks and qualifying focus; partial results are labeled. Rankings reflect those modeled inputs.'} One target, full duration, client mana cost. AA, instruments, critical hits, resists, chained recourse, and unsupported repeated waves are excluded. These values are not combat ceilings.</Alert>
}
