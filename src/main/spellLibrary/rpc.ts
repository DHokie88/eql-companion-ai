import { Worker } from 'node:worker_threads'

/** One bounded request map per dedicated worker. A dead worker fails every waiter. */
export class SpellWorkerRpc {
  private worker: Worker | null = null
  private nextId = 0
  private pending = new Map<number, { resolve: (result: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>()
  constructor(private readonly path: string, private readonly data: { databasePath: string; storageDir: string },
    private readonly progress: (message: { phase: 'checking' | 'importing'; message: string }) => void) {}

  private start(): Worker {
    if (this.worker) return this.worker
    const worker = new Worker(this.path, { workerData: this.data })
    this.worker = worker
    worker.on('message', (message: { id?: number; result?: unknown; error?: string; type?: string; phase: 'checking' | 'importing'; message: string }) => {
      if (this.worker !== worker) return
      if (message.type === 'progress') { this.progress(message); return }
      const waiter = message.id === undefined ? null : this.pending.get(message.id)
      if (!waiter || message.id === undefined) return
      this.pending.delete(message.id)
      clearTimeout(waiter.timer)
      if (message.error) waiter.reject(new Error(message.error))
      else waiter.resolve(message.result)
    })
    const fail = (error: Error): void => {
      if (this.worker !== worker) return
      this.worker = null
      for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(error) }
      this.pending.clear()
    }
    worker.on('error', fail)
    worker.on('exit', (code) => fail(new Error(`Spell worker stopped (${code})`)))
    return worker
  }

  call<T>(method: string, args: unknown = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const worker = this.start()
      const id = ++this.nextId
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('Spell catalog operation timed out. The previous catalog remains available.'))
      }, 300_000)
      this.pending.set(id, { resolve: (r) => resolve(r as T), reject, timer })
      worker.postMessage({ id, method, args })
    })
  }

  stop(): void {
    const worker = this.worker
    this.worker = null
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('Oracle is closing')) }
    this.pending.clear()
    if (worker) void worker.terminate()
  }
}
