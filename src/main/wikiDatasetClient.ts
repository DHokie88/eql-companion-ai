// Worker lifecycle is independent of Electron so retirement and deadline races are testable.
import type { WikiWorkerResponse } from './wikiDatasetTransfer'
export type WikiWorkerRequest = { type: 'load'; cacheDir: string } |
  { type: 'refresh'; cacheDir: string; checkedAt: string }
export interface WikiWorkerPort {
  on(event: 'message', listener: (message: unknown) => void): unknown
  once(event: 'error' | 'exit', listener: () => void): unknown
  postMessage(message: unknown): void
  terminate(): Promise<number>
}
interface Pending {
  child: WikiWorkerPort
  resolve: (value: WikiWorkerResponse) => void
  reject: (err: Error) => void
}
export class WikiDatasetClient {
  private child: WikiWorkerPort | null = null
  private nextId = 1
  private stopped = false
  private pending = new Map<number, Pending>()
  constructor(private readonly create: () => WikiWorkerPort, private readonly timeoutMs = 180_000) {}

  call(request: WikiWorkerRequest): Promise<WikiWorkerResponse> {
    if (this.stopped) return Promise.reject(new Error('Wiki dataset worker stopped.'))
    const child = this.ensureWorker()
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (run: () => void): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        this.pending.delete(id)
        run()
      }
      const timer = setTimeout(() => {
        this.retire(child, new Error('Wiki dataset worker timed out.'))
        void child.terminate().catch(() => { /* Cleanup cannot replace the original result. */ })
      }, this.timeoutMs)
      this.pending.set(id, { child,
        resolve: (value) => finish(() => resolve(value)),
        reject: (err) => finish(() => reject(err)) })
      try { child.postMessage({ ...request, id }) }
      catch (err) {
        finish(() => reject(err instanceof Error ? err : new Error('Wiki dataset worker failed.')))
      }
    })
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true
    const child = this.child
    if (!child) return
    this.retire(child, new Error('Wiki dataset worker stopped.'))
    void child.terminate().catch(() => { /* Cleanup cannot replace the original result. */ })
  }

  private ensureWorker(): WikiWorkerPort {
    if (this.child) return this.child
    const child = this.create()
    this.child = child
    child.on('message', (message: unknown) => {
      if (!message || typeof message !== 'object' || !('id' in message)) return
      const id = (message as { id?: unknown }).id
      if (typeof id !== 'number') return
      const slot = this.pending.get(id)
      if (slot?.child !== child) return
      const body = message as WikiWorkerResponse
      if (body.ok) slot.resolve(body)
      else slot.reject(new Error(body.error || 'Wiki dataset worker failed.'))
    })
    const drop = (): void => this.retire(child, new Error('Wiki dataset worker exited.'))
    child.once('exit', drop)
    child.once('error', drop)
    return child
  }

  private retire(child: WikiWorkerPort, err: Error): void {
    if (this.child === child) this.child = null
    for (const slot of [...this.pending.values()]) {
      if (slot.child === child) slot.reject(err)
    }
  }
}
