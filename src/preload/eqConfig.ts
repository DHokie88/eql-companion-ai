import { ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { EqConfig, EqConfigResult } from '../shared/types'

/** EQ install discovery and override live together on the preload bridge. */
export const eqConfigBridge = {
  // ---- EQ install-dir discovery + override (Settings gear) ----
  /** Read the effective EQ config: install root, how it resolved, log count. */
  getEqConfig: (): Promise<EqConfig> => ipcRenderer.invoke(IPC.getEqConfig),
  /** Open the OS folder-picker; on a pick, persist the override + re-scan. */
  pickEqDir: (): Promise<EqConfigResult> => ipcRenderer.invoke(IPC.pickEqDir),
  /**
   * Open the OS FILE-picker on the logs dir; on a pick, persist + re-scan (JOS-82).
   * Windows' folder dialog shows no files, so this is the only way to point at the
   * `eqlog_*.txt` the user can see in Explorer.
   */
  pickEqLogFile: (): Promise<EqConfigResult> => ipcRenderer.invoke(IPC.pickEqLogFile),
  /** Set the override to an explicit dir (undefined/'' reverts to auto-detect). */
  setEqDir: (dir: string | undefined): Promise<EqConfig> =>
    ipcRenderer.invoke(IPC.setEqDir, dir),
  /** Clear the override → revert to auto-discovery. Returns the re-resolved config. */
  resetEqDir: (): Promise<EqConfig> => ipcRenderer.invoke(IPC.resetEqDir),
  /** Subscribe to "effective EQ config changed" pushes (override applied/cleared). */
  onEqConfigChanged: (cb: (c: EqConfig) => void): (() => void) => {
    const listener = (_e: unknown, c: EqConfig): void => cb(c)
    ipcRenderer.on(IPC.onEqConfigChanged, listener)
    return () => ipcRenderer.removeListener(IPC.onEqConfigChanged, listener)
  },
}
