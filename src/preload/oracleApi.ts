import { ipcRenderer } from 'electron'
import { ORACLE_IPC, type CommunityFeed, type CommunityQuery, type OracleAnswer, type OracleConnection, type OracleQuestion, type OracleStatus } from '../shared/oracle'

export const oracleApi = {
  getCommunityFeed: (query: CommunityQuery = {}): Promise<CommunityFeed> => ipcRenderer.invoke(ORACLE_IPC.feed, query),
  askOracle: (question: OracleQuestion): Promise<OracleAnswer> => ipcRenderer.invoke(ORACLE_IPC.ask, question),
  cancelOracle: (id: string): Promise<void> => ipcRenderer.invoke(ORACLE_IPC.cancel, id),
  getOracleStatus: (): Promise<OracleStatus> => ipcRenderer.invoke(ORACLE_IPC.status),
  configureOracle: (connection: OracleConnection): Promise<OracleStatus> => ipcRenderer.invoke(ORACLE_IPC.configure, connection),
  testOracleConnection: (): Promise<OracleStatus> => ipcRenderer.invoke(ORACLE_IPC.test),
  openOracleSource: (url: string): Promise<void> => ipcRenderer.invoke(ORACLE_IPC.open, url)
}
