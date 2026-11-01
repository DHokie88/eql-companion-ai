// Preferences > Wiki data. The renderer sends no path and no URL. Both handlers
// settle with a status object, including when the worker is stopped on quit.

import { app, ipcMain } from 'electron'
import { IPC } from '../../shared/ipc'
import { getWikiDatasetStatus, refreshWikiDataset, shutdownWikiDataset } from '../wikiDataset'

let shutdownInstalled = false

export function registerWikiDatasetIpc(): void {
  if (!shutdownInstalled) {
    shutdownInstalled = true
    app.once('will-quit', () => {
      shutdownWikiDataset()
    })
  }
  ipcMain.handle(IPC.wikiDatasetStatus, () => getWikiDatasetStatus())
  ipcMain.handle(IPC.wikiDatasetRefresh, () => refreshWikiDataset())
}
