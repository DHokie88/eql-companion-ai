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

export function SpellSortHeader<T extends string>({ field, label, sort, numeric = false, align }: {
  field: T; label: string; numeric?: boolean; align?: 'left' | 'center' | 'right'; sort: { field: T; direction: SpellSortDirection; changeSort: (field: T) => void }
}): JSX.Element {
  const active = sort.field === field
  const alignment = align ?? (numeric ? 'right' : 'left')
  const Icon = sort.direction === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon
  return <TableCell align={alignment} sortDirection={active ? sort.direction : false} sx={{ bgcolor: active ? 'action.selected' : undefined, borderBottomColor: active ? 'primary.main' : undefined }}>
    <ButtonBase onClick={() => sort.changeSort(field)} data-testid={`spells-sort-${field}`} aria-label={`Sort by ${label}`}
      sx={{ width: '100%', minHeight: 44, flexDirection: 'column', alignItems: alignment === 'left' ? 'flex-start' : 'center', gap: 0.25, textAlign: alignment, color: active ? 'primary.main' : 'inherit', fontWeight: 600 }}>
      <Box component="span" sx={{ display: 'flex', justifyContent: 'center', width: '100%', height: 18 }}><Icon aria-hidden sx={{ fontSize: 18, visibility: active ? 'visible' : 'hidden' }} /></Box>
      <Box component="span" sx={{ whiteSpace: 'pre-line' }}>{label.includes('/Mana') ? label.replace('/Mana', '/\nMana') : label}</Box>
    </ButtonBase>
  </TableCell>
}
