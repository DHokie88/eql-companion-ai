import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc'
import { spellLibrary } from '../spellLibrary'

const QUERIES = new Set(['search', 'detail', 'compare', 'rank', 'history', 'changes', 'beforeAfter', 'timeline'])
export function registerSpellLibraryIpc(): void {
  ipcMain.handle(IPC.spellLibraryStatus, () => spellLibrary().status())
  ipcMain.handle(IPC.spellLibraryCheck, () => spellLibrary().check('manual'))
  ipcMain.handle(IPC.spellLibraryQuery, (_event, method: unknown, query: unknown) => {
    if (typeof method !== 'string' || !QUERIES.has(method)) throw new Error('Unknown spell library query')
    return spellLibrary().query(method, query)
  })
}
