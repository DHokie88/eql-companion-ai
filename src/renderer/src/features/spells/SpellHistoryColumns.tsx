import { type JSX, useId } from 'react'
import { Checkbox, FormControl, InputLabel, ListItemText, MenuItem, Select } from '@mui/material'
import { useSpellWorkspaceState } from './spellWorkspace'

export const HISTORY_COLUMN_LABELS = {
  id: 'ID', classes: 'Class/Level', change: 'Change', fields: 'Fields', current: 'Current record'
} as const

export type HistoryDisplayColumn = keyof typeof HISTORY_COLUMN_LABELS

const UPDATE_COLUMNS: HistoryDisplayColumn[] = ['id', 'classes', 'change', 'fields']
const SNAPSHOT_COLUMNS: HistoryDisplayColumn[] = ['id', 'change', 'fields', 'current']

export function useHistoryColumns(view: 'update' | 'snapshot') {
  const choices = view === 'update' ? UPDATE_COLUMNS : SNAPSHOT_COLUMNS
  const [columns, setColumns] = useSpellWorkspaceState<HistoryDisplayColumn[]>(`history-${view}-columns`, choices)
  const visible = Array.isArray(columns) ? choices.filter((column) => columns.includes(column)) : choices
  return { choices, columns: visible, setColumns }
}

export function HistoryColumnPicker({ choices, columns, setColumns }: ReturnType<typeof useHistoryColumns>): JSX.Element {
  const labelId = useId()
  return <FormControl size="small" sx={{ minWidth: 145 }}>
    <InputLabel id={labelId} shrink>Columns</InputLabel>
    <Select<HistoryDisplayColumn[]> multiple displayEmpty labelId={labelId} label="Columns" value={columns}
      renderValue={(chosen) => `${chosen.length + 1} shown`}
      onChange={(event) => {
        const value = event.target.value
        const selected = typeof value === 'string' ? value.split(',') : value
        setColumns(choices.filter((column) => selected.includes(column)))
      }}
      data-testid="spells-history-columns">
      {choices.map((column) => <MenuItem key={column} value={column}>
        <Checkbox checked={columns.includes(column)} tabIndex={-1} size="small" />
        <ListItemText primary={HISTORY_COLUMN_LABELS[column]} />
      </MenuItem>)}
    </Select>
  </FormControl>
}
