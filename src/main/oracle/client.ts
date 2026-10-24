import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import { effectiveEqRoot } from '../log/config'
import type { CommunityFeed, CommunityQuery, OracleCitation, OracleScope } from '../../shared/oracle'

/** Only this small broker lives on the log-tailing thread. JSON and ranking stay in the worker. */
let worker: Worker | undefined
let nextId = 0
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>()
function rejectAll(): void {
  for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Reference search stopped. Please try again.')) }
  pending.clear()
}
function start(): Worker {
  if (worker) return worker
  const current = new Worker(join(__dirname, 'oracleWorker.js'))
  worker = current
  current.on('message', (message: { id: number; result?: unknown; error?: string }) => {
    const p = pending.get(message.id)
    if (!p) return
    pending.delete(message.id)
    clearTimeout(p.timer)
    if (message.error) p.reject(new Error(message.error))
    else p.resolve(message.result)
    if (!pending.size) current.unref()
  })
  current.on('error', () => { if (worker === current) { worker = undefined; rejectAll() } })
  current.on('exit', () => { if (worker === current) { worker = undefined; rejectAll() } })
  return current
}
function call(method: 'search' | 'feed', args: unknown): Promise<unknown> {
  if (pending.size >= 16) return Promise.reject(new Error('Reference search is busy. Please try again.'))
  const current = start()
  current.ref()
  const id = ++nextId
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('Reference search timed out. Please try again.'))
      if (!pending.size) { void current.terminate(); if (worker === current) worker = undefined }
    }, 30_000)
    pending.set(id, { resolve, reject, timer })
    current.postMessage({ id, method, args, referenceRoot: join(effectiveEqRoot(), 'reference', 'discord') })
  })
}
export async function searchReferences(question: string, scope: OracleScope): Promise<OracleCitation[]> {
  return await call('search', { question, scope }) as OracleCitation[]
}
export async function communityFeed(query: CommunityQuery): Promise<CommunityFeed> {
  return await call('feed', query) as CommunityFeed
}
export function closeOracleWorker(): void { const current = worker; worker = undefined; rejectAll(); if (current) void current.terminate() }
