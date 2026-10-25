import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { ORACLE_REFRESH_IPC } from '../../shared/oracleRefresh'
import type { OracleConnection } from '../../shared/oracle'
import { communityFeed } from './client'
import { createOracleRefreshController } from './refreshController'
import { requestDiscordRefresh } from './refreshTransport'
import { E2E } from '../e2e'

export function registerOracleRefresh(connection: () => OracleConnection): void {
  const recipients = new Set<number>()
  const controller = createOracleRefreshController({
    remote: (command, force, signal) => requestDiscordRefresh(connection(), command, force, signal),
    publish: status => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (recipients.has(window.webContents.id)) window.webContents.send(ORACLE_REFRESH_IPC.changed, status)
      }
    },
    verify: async status => {
      const feed = await communityFeed({ limit: 1 })
      if (!status.lastCheckedAt || feed.snapshot.refreshWarning || !feed.snapshot.lastCheckedAt
          || Date.parse(feed.snapshot.lastCheckedAt) < Date.parse(status.lastCheckedAt)) {
        throw new Error('Discord was checked, but its refreshed snapshot is not available here yet. Showing saved updates; try Check now later.')
      }
    },
    completed: () => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (recipients.has(window.webContents.id) && !window.isFocused()) {
          window.flashFrame(true)
          window.once('focus', () => { if (!window.isDestroyed()) window.flashFrame(false) })
        }
      }
    }
  })
  const authorize = (event: IpcMainInvokeEvent): void => {
    if (event.senderFrame !== event.sender.mainFrame) throw new Error('Discord checks must come from the main window')
    if (!recipients.has(event.sender.id)) {
      recipients.add(event.sender.id)
      event.sender.once('destroyed', () => recipients.delete(event.sender.id))
    }
  }
  ipcMain.handle(ORACLE_REFRESH_IPC.status, event => { authorize(event); if (!E2E) controller.start(); return controller.status() })
  ipcMain.handle(ORACLE_REFRESH_IPC.request, event => { authorize(event); return E2E ? controller.status() : controller.request() })
  app.once('will-quit', () => controller.stop())
}
