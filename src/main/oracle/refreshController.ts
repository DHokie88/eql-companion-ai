import type { OracleRefreshStatus } from '../../shared/oracleRefresh'

interface RefreshDependencies {
  remote: (command: 'request' | 'status', force: boolean, signal: AbortSignal) => Promise<OracleRefreshStatus>
  publish: (status: OracleRefreshStatus) => void
  verify: (status: OracleRefreshStatus) => Promise<void>
  completed: () => void
  delayMs?: number
  pollMs?: number
  timeoutMs?: number
}
/** One app-wide check; never put harvest work on the application startup path. */
export function createOracleRefreshController(deps: RefreshDependencies) {
  let status: OracleRefreshStatus = { state: 'idle', lastCheckedAt: null, message: 'Discord checks run in the background.' }
  let started = false
  let stopped = false
  let timer: NodeJS.Timeout | undefined
  let pending: Promise<OracleRefreshStatus> | undefined
  let attempt: AbortController | undefined
  let deadline = 0
  const emit = (next: OracleRefreshStatus): void => { status = next; deps.publish(next) }
  const fail = (error: unknown): void => emit({ ...status, state: 'failed', message: error instanceof Error ? error.message : 'The Discord check failed. Saved updates remain available.' })
  function schedule(fn: () => void, delay: number): void {
    clearTimeout(timer)
    timer = setTimeout(fn, delay)
    timer.unref()
  }
  async function read(command: 'request' | 'status', force: boolean): Promise<OracleRefreshStatus> {
    if (stopped) return status
    if (Date.now() >= deadline) { fail(new Error('The Discord check is taking too long. Saved updates remain available; try Check now later.')); return status }
    attempt = new AbortController()
    try {
      const next = await deps.remote(command, force, attempt.signal)
      if (stopped) return status
      if (next.state === 'complete') {
        await deps.verify(next)
        if (stopped) return status
        emit(next)
        deps.completed()
      } else {
        emit(next)
        if (next.state === 'queued' || next.state === 'running') schedule(() => { void poll() }, deps.pollMs ?? 15_000)
      }
    } catch (error) { if (!stopped) fail(error) }
    return status
  }
  function poll(): Promise<OracleRefreshStatus> {
    pending = read('status', false).finally(() => { pending = undefined })
    return pending
  }
  function request(force = true): Promise<OracleRefreshStatus> {
    if (pending) return pending
    if (stopped || status.state === 'queued' || status.state === 'running') return Promise.resolve(status)
    clearTimeout(timer)
    deadline = Date.now() + (deps.timeoutMs ?? 5 * 60 * 60_000 + 5 * 60_000)
    emit({ ...status, state: 'queued', message: 'Checking Discord in the background. You can keep using EQ Oracle.' })
    pending = read('request', force).finally(() => { pending = undefined })
    return pending
  }
  return {
    status: (): OracleRefreshStatus => status,
    start: (): void => {
      if (started || stopped) return
      started = true
      schedule(() => { void request(false) }, deps.delayMs ?? 15_000)
    },
    request,
    stop: (): void => { stopped = true; clearTimeout(timer); attempt?.abort() }
  }
}
