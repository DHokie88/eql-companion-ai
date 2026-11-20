import { type JSX, type ReactNode, useCallback } from 'react'
import { useSpellWorkspaceState } from './spellWorkspace'
import { Box, Button, ButtonBase, TableCell } from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import type { SpellSortDirection } from '@shared/spellLibrary'

export function SpellNameButton({ id, children, onOpen }: { id: number; children: ReactNode; onOpen: (id: number) => void }): JSX.Element {
  return <Button size="small" onClick={() => onOpen(id)} data-testid={`spells-open-${id}`}
    sx={{ justifyContent: 'flex-start', textAlign: 'left', width: '100%', minWidth: 0, px: 0 }}>{children}</Button>
}

export function useSpellSort<T extends string>(initial: T, direction: SpellSortDirection = 'asc', key: string = initial) {
  const [sort, setSort] = useSpellWorkspaceState<{ field: T; direction: SpellSortDirection }>(`sort-${key}`, { field: initial, direction })
  const changeSort = useCallback((field: T): void => setSort((previous) => ({ field,
    direction: previous.field === field && previous.direction === 'asc' ? 'desc' : 'asc' })), [setSort])
  const selectSort = useCallback((field: T, direction: SpellSortDirection): void => setSort({ field, direction }), [setSort])
  return { ...sort, changeSort, selectSort }
}

export function visibleSpellSort<T extends string>(sort: ReturnType<typeof useSpellSort<T>>, columns: readonly { field: string }[], fallback: T): ReturnType<typeof useSpellSort<T>> {
  if (columns.some(({ field }) => field === sort.field)) return sort
  return { ...sort, field: fallback, direction: 'asc', changeSort: (field) => sort.selectSort(field, field === fallback ? 'desc' : 'asc') }
}

const COLUMN_HELP: Partial<Record<string, string>> = {
  description: 'Client spell text. Damage and healing here are base values, before rank or modeled targets.',
  amount: 'Modeled amount per full cast at the evaluated level and rank, including ticks and hits for the selected target scenario.',
  total: 'Modeled amount per full cast at the evaluated level and rank, including ticks and hits for the selected target scenario.',
  rate: 'Steady rate for repeating the same spell. Full-cast amount divided by cast time plus the longest of spell recast, global recovery and effect delivery.',
  recast: 'Spell-specific reuse delay.',
  recovery: 'Shared recovery delay after casting a spell.'
}

export function SpellSortHeader<T extends string>({ field, label, sort, numeric = false, align }: {
  field: T; label: string; numeric?: boolean; align?: 'left' | 'center' | 'right'; sort: { field: T; direction: SpellSortDirection; changeSort: (field: T) => void }
}): JSX.Element {
  const active = sort.field === field
  const alignment = align ?? (numeric ? 'right' : 'left')
  const Icon = sort.direction === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon
  const help = COLUMN_HELP[field]
  return <TableCell align={alignment} sortDirection={active ? sort.direction : false} sx={{ bgcolor: active ? 'action.selected' : undefined, borderBottomColor: active ? 'primary.main' : undefined }}>
    <ButtonBase onClick={() => sort.changeSort(field)} data-testid={`spells-sort-${field}`} aria-label={`Sort by ${label}`} title={help} aria-description={help}
      sx={{ width: '100%', minHeight: 44, flexDirection: 'column', alignItems: alignment === 'left' ? 'flex-start' : 'center', gap: 0.25, textAlign: alignment, color: active ? 'primary.main' : 'inherit', fontWeight: 600 }}>
      <Box component="span" sx={{ display: 'flex', justifyContent: 'center', width: '100%', height: 18 }}><Icon aria-hidden sx={{ fontSize: 18, visibility: active ? 'visible' : 'hidden' }} /></Box>
      <Box component="span" sx={{ whiteSpace: 'pre-line' }}>{label.replace('/Mana', '/\nMana')}</Box>
      {field === 'description' && <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.7rem', fontWeight: 400 }}>Base client text</Box>}
    </ButtonBase>
  </TableCell>
}
