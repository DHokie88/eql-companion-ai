import { isMainThread, parentPort, workerData } from 'node:worker_threads'
import { CLIENT_SPELL_PARSER_VERSION, SPELL_SOURCE_FILES, type SpellSourceFile } from '../../shared/spellLibrary'
import { parseClientSpellBundle } from '../../shared/clientSpellParser'
import { captureClientSpellBundle, type CaptureOptions } from './capture'
import { SpellLibraryStorage, spellInstallId } from './storage'
import {
  errorMessage, integerArg, objectArgs, reasonArg, stringArg,
  type SpellWorkerData, type SpellWorkerProgress, type SpellWorkerRequest, type SpellWorkerResponse
} from './workerProtocol'

/** Serialization belongs here even if a caller accidentally sends concurrent checks. */
export class SpellLibraryWriter {
  readonly storage: SpellLibraryStorage
  constructor(options: SpellWorkerData, readonly captureOptions: CaptureOptions = {}) {
    this.storage = new SpellLibraryStorage(options)
  }
  private installId(args: Record<string, unknown>): string {
    if (args.root !== undefined) return spellInstallId(stringArg(args.root, 'installation root'))
    return stringArg(args.installId, 'installId')
  }
  async handle(method: string, input: unknown, progress?: (update: SpellWorkerProgress) => void): Promise<unknown> {
    const args = input === undefined ? {} : objectArgs(input)
    switch (method) {
      case 'init': return { ready: true }
      case 'status': return this.storage.status(this.installId(args))
      case 'active': return this.storage.active(this.installId(args))
      case 'check': return await this.check(args, progress)
      case 'restore':
      case 'materialize': return this.storage.materialize(this.installId(args), stringArg(args.snapshotId, 'snapshotId'))
      case 'recordFailure': return this.storage.recordFailure(stringArg(args.root, 'root'), reasonArg(args.reason), stringArg(args.message, 'message'))
      case 'cleanup': {
        if (!Array.isArray(args.retainDirectories) || args.retainDirectories.some((path) => typeof path !== 'string')) {
          throw new Error('Invalid retained directories')
        }
        return { removed: this.storage.cleanup(args.retainDirectories as string[]) }
      }
      default: throw new Error('Unknown spell writer method')
    }
  }
  private async check(args: Record<string, unknown>, progress?: (update: SpellWorkerProgress) => void): Promise<unknown> {
    const root = stringArg(args.root, 'installation root')
    const reason = reasonArg(args.reason)
    const parserVersion = stringArg(args.parserVersion ?? CLIENT_SPELL_PARSER_VERSION, 'parserVersion')
    try {
      progress?.({ type: 'progress', phase: 'checking', message: 'Verifying the complete client spell bundle' })
      const capture = await captureClientSpellBundle(root, this.captureOptions)
      progress?.({ type: 'progress', phase: 'importing', message: 'Reading client spell records and preserving source history' })
      const decoder = new TextDecoder('utf-8', { fatal: true })
      const sources = Object.fromEntries(SPELL_SOURCE_FILES.map((name) => [name, decoder.decode(capture.sources[name])])) as Record<SpellSourceFile, string>
      const records = parseClientSpellBundle(sources)
      return this.storage.publish({ root, reason, parserVersion, capture, records })
    } catch (error) {
      const message = this.safeMessage(error, root)
      this.storage.recordFailure(root, reason, message)
      throw new Error(message)
    }
  }
  private safeMessage(error: unknown, root: string): string {
    let message = errorMessage(error)
    for (const path of [root, this.storage.storageDir, this.storage.options.databasePath]) {
      if (path) message = message.split(path).join('[local path]')
    }
    return message.slice(0, 2000)
  }
  close(): void { this.storage.close() }
}

if (!isMainThread && parentPort) {
  const port = parentPort
  const options = objectArgs(workerData)
  const writer = new SpellLibraryWriter({ databasePath: stringArg(options.databasePath, 'databasePath'), storageDir: stringArg(options.storageDir, 'storageDir') })
  let queue = Promise.resolve()
  port.on('message', (input: unknown) => {
    queue = queue.then(async () => {
      let id = -1
      try {
        const request = objectArgs(input) as unknown as SpellWorkerRequest
        id = integerArg(request.id, 'request ID', 0, Number.MAX_SAFE_INTEGER)
        const method = stringArg(request.method, 'method')
        const result = await writer.handle(method, request.args, (update) => port.postMessage(update))
        port.postMessage({ id, result } satisfies SpellWorkerResponse)
      } catch (error) { port.postMessage({ id, error: errorMessage(error) } satisfies SpellWorkerResponse) }
    })
  })
  port.on('close', () => writer.close())
}
