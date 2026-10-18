import { isMainThread, parentPort, workerData } from 'node:worker_threads'
import { SpellLibraryStorage } from './storage'
import { SpellLibraryQueries } from './queries'
import { errorMessage, integerArg, objectArgs, stringArg, type SpellWorkerResponse } from './workerProtocol'

if (!isMainThread && parentPort) {
  const port = parentPort
  const options = objectArgs(workerData)
  const storage = new SpellLibraryStorage({ databasePath: stringArg(options.databasePath, 'databasePath'), storageDir: stringArg(options.storageDir, 'storageDir') }, true)
  const queries = new SpellLibraryQueries(storage)
  port.on('message', (input: unknown) => {
    let id = -1
    try {
      const request = objectArgs(input)
      id = integerArg(request.id, 'request ID', 0, Number.MAX_SAFE_INTEGER)
      const result = queries.handle(stringArg(request.method, 'method'), request.args)
      port.postMessage({ id, result } satisfies SpellWorkerResponse)
    } catch (error) { port.postMessage({ id, error: errorMessage(error) } satisfies SpellWorkerResponse) }
  })
  port.on('close', () => storage.close())
}
