// Renderer bridge for Preferences > Wiki data. No arguments cross this line.

import { ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { WikiDatasetStatus } from '../shared/wikiDataset'

export const wikiDatasetBridge = {
  getWikiDatasetStatus: (): Promise<WikiDatasetStatus> => ipcRenderer.invoke(IPC.wikiDatasetStatus),
  refreshWikiDataset: (): Promise<WikiDatasetStatus> => ipcRenderer.invoke(IPC.wikiDatasetRefresh)
}
