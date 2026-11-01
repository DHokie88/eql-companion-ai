// worker_threads entry for wiki dataset IO. electron-vite emits this beside index.js.
// Messages carry a cache directory only. URLs, filenames, and redirect policy are not accepted.

import { parentPort } from 'node:worker_threads'
import { decodeWikiDataset } from './wikiDatasetCodec'
import {
  loadWikiDatasetFromDisk,
  publicError,
  refreshWikiDatasetOnDisk,
  replyOnce,
  type WikiWorkerResponse
} from './wikiDatasetTransfer'

const port = parentPort
const replies = new Map<number, { sent: boolean }>()

function reply(message: WikiWorkerResponse): void {
  if (!port) return
  let gate = replies.get(message.id)
  if (!gate) {
    gate = { sent: false }
    replies.set(message.id, gate)
  }
  replyOnce(gate, (body) => port.postMessage(body), message)
}

function kindOf(message: Record<string, unknown>): 'load' | 'refresh' | null {
  if (message.type === 'load' && typeof message.cacheDir === 'string') return 'load'
  if (message.type === 'refresh' && typeof message.cacheDir === 'string' && typeof message.checkedAt === 'string') {
    return 'refresh'
  }
  return null
}

export async function handleWikiDatasetMessage(message: unknown): Promise<void> {
  if (!message || typeof message !== 'object') return
  const body = message as Record<string, unknown>
  const kind = kindOf(body)
  if (typeof body.id !== 'number' || !Number.isSafeInteger(body.id) || kind === null) return
  try {
    if (kind === 'load') {
      const cache = await loadWikiDatasetFromDisk(body.cacheDir as string)
      reply({ id: body.id, ok: true, kind: 'load', cache })
      return
    }
    const refresh = await refreshWikiDatasetOnDisk(body.cacheDir as string, body.checkedAt as string, {
      decode: (value, manifest, checkedAt) =>
        decodeWikiDataset(value, manifest, checkedAt)
    })
    reply({ id: body.id, ok: true, kind: 'refresh', refresh })
  } catch (err) {
    reply({ id: body.id, ok: false, kind, error: publicError(err) })
  }
}

if (port) {
  port.on('message', (message: unknown) => {
    void handleWikiDatasetMessage(message)
  })
}
