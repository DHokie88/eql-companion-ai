import { type JSX, type ReactNode, useState } from 'react'
import { Button, TableCell, TableSortLabel } from '@mui/material'
import type { SpellSortDirection } from '@shared/spellLibrary'

export function SpellNameButton({ id, children, onOpen }: { id: number; children: ReactNode; onOpen: (id: number) => void }): JSX.Element {
  return <Button size="small" onClick={() => onOpen(id)} data-testid={`spells-open-${id}`}
    sx={{ justifyContent: 'flex-start', textAlign: 'left', width: '100%', minWidth: 0, px: 0 }}>{children}</Button>
}

export function useSpellSort<T extends string>(initial: T, direction: SpellSortDirection = 'asc') {
  const [sort, setSort] = useState<{ field: T; direction: SpellSortDirection }>({ field: initial, direction })
  const changeSort = (field: T): void => setSort((previous) => ({ field,
    direction: previous.field === field && previous.direction === 'asc' ? 'desc' : 'asc' }))
  return { ...sort, changeSort }
}

export function SpellSortHeader<T extends string>({ field, label, sort, numeric = false }: {
  field: T; label: string; numeric?: boolean; sort: { field: T; direction: SpellSortDirection; changeSort: (field: T) => void }
}): JSX.Element {
  const active = sort.field === field
  return <TableCell align={numeric ? 'right' : 'left'} sortDirection={active ? sort.direction : false}>
    <TableSortLabel active={active} direction={active ? sort.direction : 'asc'} onClick={() => sort.changeSort(field)}
      data-testid={`spells-sort-${field}`} sx={{ whiteSpace: 'normal' }}>{label}</TableSortLabel>
  </TableCell>
}
