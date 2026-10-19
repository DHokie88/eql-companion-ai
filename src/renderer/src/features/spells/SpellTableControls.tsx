import { type JSX, type ReactNode } from 'react'
import { useSpellWorkspaceState } from './spellWorkspace'
import { Button, TableCell, TableSortLabel } from '@mui/material'
import type { SpellSortDirection } from '@shared/spellLibrary'

export function SpellNameButton({ id, children, onOpen }: { id: number; children: ReactNode; onOpen: (id: number) => void }): JSX.Element {
  return <Button size="small" onClick={() => onOpen(id)} data-testid={`spells-open-${id}`}
    sx={{ justifyContent: 'flex-start', textAlign: 'left', width: '100%', minWidth: 0, px: 0 }}>{children}</Button>
}

export function useSpellSort<T extends string>(initial: T, direction: SpellSortDirection = 'asc', key: string = initial) {
  const [sort, setSort] = useSpellWorkspaceState<{ field: T; direction: SpellSortDirection }>(`sort-${key}`, { field: initial, direction })
  const changeSort = (field: T): void => setSort((previous) => ({ field,
    direction: previous.field === field && previous.direction === 'asc' ? 'desc' : 'asc' }))
  const selectSort = (field: T, direction: SpellSortDirection): void => setSort({ field, direction })
  return { ...sort, changeSort, selectSort }
}

export function SpellSortHeader<T extends string>({ field, label, sort, numeric = false, align }: {
  field: T; label: string; numeric?: boolean; align?: 'left' | 'center' | 'right'; sort: { field: T; direction: SpellSortDirection; changeSort: (field: T) => void }
}): JSX.Element {
  const active = sort.field === field
  const alignment = align ?? (numeric ? 'right' : 'left')
  return <TableCell align={alignment} sortDirection={active ? sort.direction : false}>
    <TableSortLabel active={active} direction={active ? sort.direction : 'asc'} onClick={() => sort.changeSort(field)}
      data-testid={`spells-sort-${field}`} sx={{ whiteSpace: 'normal', ...(alignment === 'center' ? { '& .MuiTableSortLabel-icon': { position: 'absolute', right: -22, ml: 0 } } : {}) }}>{label}</TableSortLabel>
  </TableCell>
}
