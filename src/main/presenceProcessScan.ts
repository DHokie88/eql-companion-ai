import { EQ_CLIENT_EXES } from './presenceProtocol'
import type { EqClientProcess } from '../shared/eqClientProcess'

export function createProcessScanner(deps: {
  pids: () => number[] | null
  imagePath: (pid: number) => string
  creationTime: (pid: number, expectedPath: string) => string | null
}): (root: string) => { running: number; clients: EqClientProcess[] | null } {
  return (rootWithSep) => {
    const pids = deps.pids()
    if (!pids) return { running: -1, clients: null }
    const root = rootWithSep.toLowerCase()
    const clients: EqClientProcess[] = []
    let running = 0
    let complete = true
    for (const pid of pids) {
      const exePath = deps.imagePath(pid), path = exePath.toLowerCase()
      if (!path) continue
      const client = EQ_CLIENT_EXES.has(path.slice(path.lastIndexOf('\\') + 1))
      if (client || (root.length > 0 && path.startsWith(root))) running = 1
      if (!client) continue
      const creationTime = deps.creationTime(pid, exePath)
      if (creationTime === null) { complete = false; continue }
      clients.push({ pid, creationTime, exePath })
    }
    clients.sort((a, b) => a.pid - b.pid)
    return { running, clients: complete ? clients : null }
  }
}
