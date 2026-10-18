/** Kernel creation time disambiguates PID reuse; it is an opaque FILETIME value. */
export interface EqClientProcess { pid: number; creationTime: string; exePath: string }

export function isEqClientProcess(value: unknown): value is EqClientProcess {
  if (!value || typeof value !== 'object') return false
  const p = value as Partial<EqClientProcess>
  return Number.isSafeInteger(p.pid) && (p.pid ?? 0) > 0 &&
    typeof p.creationTime === 'string' && /^\d{1,20}$/.test(p.creationTime) &&
    typeof p.exePath === 'string' && p.exePath.length > 0 && p.exePath.length < 32768
}

/** Kept outside the worker so a worker restart does not manufacture launches. */
export class EqClientLaunches {
  private previous = new Set<string>()
  observe(clients: EqClientProcess[]): EqClientProcess[] {
    const next = new Set(clients.map((p) => `${p.pid}:${p.creationTime}`))
    const added = clients.filter((p) => !this.previous.has(`${p.pid}:${p.creationTime}`))
    this.previous = next
    return added
  }
}
