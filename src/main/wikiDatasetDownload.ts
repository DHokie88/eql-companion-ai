import { WikiDatasetError } from './wikiDatasetCache'
import type { WikiGunzip } from './wikiDatasetTransfer'
export async function fetchBytes(
  fetchImpl: typeof fetch,
  url: string,
  limits: { maxBytes: number; declaredBytes?: number },
  signal: AbortSignal
): Promise<Buffer> {
  const { maxBytes, declaredBytes } = limits
  let response: Response
  try {
    response = await fetchImpl(url, {
      signal,
      redirect: 'error',
      cache: 'no-store',
      credentials: 'omit',
      headers: {
        'User-Agent': 'EQOracle-wiki-dataset',
        'Cache-Control': 'no-cache',
        Accept: 'application/json, application/gzip, application/octet-stream, */*'
      }
    })
  } catch (err) {
    throw wrapNet(err)
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => { /* Cleanup cannot replace the original result. */ })
    throw new WikiDatasetError(`Wiki dataset HTTP ${response.status}`)
  }
  const advertised = contentLength(response)
  if (advertised !== null && advertised > maxBytes) {
    await response.body?.cancel().catch(() => { /* Cleanup cannot replace the original result. */ })
    throw new WikiDatasetError('Wiki dataset download exceeded the size limit.')
  }
  if (declaredBytes !== undefined && advertised !== null && advertised !== declaredBytes) {
    await response.body?.cancel().catch(() => { /* Cleanup cannot replace the original result. */ })
    throw new WikiDatasetError('Wiki dataset manifest declared byte count does not match the download.')
  }
  return readBody(response, maxBytes)
}

function contentLength(response: Response): number | null {
  const raw = response.headers.get('content-length')
  if (raw === null || raw === '') return null
  if (!/^\d+$/.test(raw)) throw new WikiDatasetError('Wiki dataset download exceeded the size limit.')
  const value = Number(raw)
  if (!Number.isSafeInteger(value)) throw new WikiDatasetError('Wiki dataset download exceeded the size limit.')
  return value
}

async function readBody(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0)
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let size = 0
  try {
    while (true) {
      const step = await reader.read()
      if (step.done) break
      if (!step.value) continue
      size += step.value.byteLength
      if (size > maxBytes) {
        await reader.cancel().catch(() => { /* Cleanup cannot replace the original result. */ })
        throw new WikiDatasetError('Wiki dataset download exceeded the size limit.')
      }
      chunks.push(Buffer.from(step.value))
    }
  } catch (err) {
    throw wrapNet(err)
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks, size)
}

export async function withDeadline(ms: number, run: (signal: AbortSignal) => Promise<Buffer>): Promise<Buffer> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await run(controller.signal)
  } catch (err) {
    throw wrapNet(err)
  } finally {
    clearTimeout(timer)
  }
}

export function inflate(buffer: Buffer, maxOutputLength: number, gunzip: WikiGunzip): Buffer {
  try {
    return gunzip(buffer, maxOutputLength)
  } catch (err) {
    if (err instanceof WikiDatasetError) throw err
    if (err instanceof RangeError) {
      throw new WikiDatasetError('Wiki dataset decompressed payload exceeded the size limit.')
    }
    throw new WikiDatasetError('Wiki dataset payload could not be decompressed.')
  }
}

function wrapNet(err: unknown): Error {
  if (err instanceof WikiDatasetError) return err
  if (isAbort(err)) return new WikiDatasetError('Wiki dataset response exceeded the deadline.')
  if (err instanceof TypeError && /redirect/i.test(err.message)) {
    return new WikiDatasetError('Wiki dataset redirect was refused.')
  }
  if (err instanceof Error && err.message.startsWith('Wiki dataset')) return err
  return new WikiDatasetError('Wiki dataset request failed.')
}

function isAbort(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err ? String(err.name) : ''
  return name === 'AbortError' || name === 'TimeoutError'
}
