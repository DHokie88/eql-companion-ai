import { ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { SpellLibraryBridge, SpellLibraryStatus } from '../shared/spellLibrary'

const query = <T>(method: string, args: unknown): Promise<T> => ipcRenderer.invoke(IPC.spellLibraryQuery, method, args)
export const spellLibrary: SpellLibraryBridge = {
  rankings: (q) => query('rankings', q), byLevel: (q) => query('byLevel', q),
  modifierContext: () => ipcRenderer.invoke(IPC.spellLibraryModifierContext),
  updateModifiers: (update) => ipcRenderer.invoke(IPC.spellLibraryUpdateModifiers, update),
  focusOptions: (q) => query('focusOptions', q),
  onModifiersChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, revision: string): void => callback(revision)
    ipcRenderer.on(IPC.spellLibraryModifiersChanged, listener)
    return () => { ipcRenderer.removeListener(IPC.spellLibraryModifiersChanged, listener) }
  },
  status: () => ipcRenderer.invoke(IPC.spellLibraryStatus),
  check: () => ipcRenderer.invoke(IPC.spellLibraryCheck),
  search: (q) => query('search', q), detail: (q) => query('detail', q),
  compare: (q) => query('compare', q), rank: (q) => query('rank', q),
  history: (q = {}) => query('history', q), changes: (q) => query('changes', q),
  beforeAfter: (q) => query('beforeAfter', q), timeline: (q) => query('timeline', q),
  onStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: SpellLibraryStatus): void => callback(status)
    ipcRenderer.on(IPC.spellLibraryStatusChanged, listener)
    return () => { ipcRenderer.removeListener(IPC.spellLibraryStatusChanged, listener) }
  }
}
