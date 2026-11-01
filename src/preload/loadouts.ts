import { ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { LoadoutChange, LoadoutId, LoadoutState } from '../shared/loadouts'
export const loadoutsApi = {
  loadoutsGet: (): Promise<LoadoutState> => ipcRenderer.invoke(IPC.loadoutsGet),
  loadoutsUpdate: (characterId: string, change: LoadoutChange): Promise<LoadoutState> => ipcRenderer.invoke(IPC.loadoutsUpdate, characterId, change),
  loadoutsCapture: (characterId: string, id: LoadoutId): Promise<LoadoutState> => ipcRenderer.invoke(IPC.loadoutsCapture, characterId, id)
}
