import { ipcRenderer } from 'electron'
import { ORACLE_IPC, type CommunityFeed, type CommunityQuery, type OracleAnswer, type OracleConnection, type OracleQuestion, type OracleStatus } from '../shared/oracle'
import { ORACLE_REFRESH_IPC, type OracleRefreshStatus } from '../shared/oracleRefresh'

export const oracleApi = {
  getOracleRefreshStatus: (): Promise<OracleRefreshStatus> => ipcRenderer.invoke(ORACLE_REFRESH_IPC.status),
  requestOracleRefresh: (): Promise<OracleRefreshStatus> => ipcRenderer.invoke(ORACLE_REFRESH_IPC.request),
  onOracleRefresh: (listener: (status: OracleRefreshStatus) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: OracleRefreshStatus): void => listener(status)
    ipcRenderer.on(ORACLE_REFRESH_IPC.changed, handler)
    return () => { ipcRenderer.removeListener(ORACLE_REFRESH_IPC.changed, handler) }
  },
  getCommunityFeed: (query: CommunityQuery = {}): Promise<CommunityFeed> => ipcRenderer.invoke(ORACLE_IPC.feed, query),
  askOracle: (question: OracleQuestion): Promise<OracleAnswer> => ipcRenderer.invoke(ORACLE_IPC.ask, question),
  cancelOracle: (id: string): Promise<void> => ipcRenderer.invoke(ORACLE_IPC.cancel, id),
  getOracleStatus: (): Promise<OracleStatus> => ipcRenderer.invoke(ORACLE_IPC.status),
  configureOracle: (connection: OracleConnection): Promise<OracleStatus> => ipcRenderer.invoke(ORACLE_IPC.configure, connection),
  testOracleConnection: (): Promise<OracleStatus> => ipcRenderer.invoke(ORACLE_IPC.test),
  openOracleSource: (url: string): Promise<void> => ipcRenderer.invoke(ORACLE_IPC.open, url)
}
