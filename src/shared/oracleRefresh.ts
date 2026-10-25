export const ORACLE_REFRESH_IPC = {
  status: 'oracle:refresh-status', request: 'oracle:refresh-request', changed: 'oracle:refresh-changed'
} as const
export const ORACLE_REFRESH_COMPLETE_EVENT = 'oracle-refresh-complete'
export interface OracleRefreshStatus {
  state: 'idle' | 'queued' | 'running' | 'complete' | 'failed'
  lastCheckedAt: string | null
  message: string
  startedAt?: string
  completedAt?: string
}
export function oracleRefreshStatus(input: unknown): OracleRefreshStatus {
  if (!input || typeof input !== 'object') throw new Error('The Discord check returned an unreadable status.')
  const value = input as Record<string, unknown>
  if (!['idle', 'queued', 'running', 'complete', 'failed'].includes(String(value.state))) throw new Error('Unknown Discord check status.')
  if (typeof value.message !== 'string' || value.message.length > 1000) throw new Error('Invalid Discord check message.')
  if (!validCheckTime(value.lastCheckedAt)) throw new Error('Invalid Discord check time.')
  for (const key of ['startedAt', 'completedAt']) if (value[key] !== undefined && !validTime(value[key])) throw new Error('Invalid Discord check time.')
  return { state: value.state as OracleRefreshStatus['state'], message: value.message, lastCheckedAt: value.lastCheckedAt,
    ...(value.startedAt ? { startedAt: value.startedAt as string } : {}), ...(value.completedAt ? { completedAt: value.completedAt as string } : {}) }
}
function validTime(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)) }
function validCheckTime(value: unknown): value is string | null { return value === null || validTime(value) }
