// Session owner for the wiki dataset. The active cache is loaded at most once and then
// stays immutable so item lookup and the planner cannot disagree mid-session. A refresh
// writes the next cache to disk and does not replace the one this launch already bound.
// The cache directory is always userData/wiki-dataset. Renderer paths and URLs are ignored.

import { app } from 'electron'
import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { WikiDatasetClient } from './wikiDatasetClient'
import type { WikiDatasetCache, WikiDatasetStatus } from '../shared/wikiDataset'
import {
  WIKI_CACHE_DIR_NAME,
  publicError,
  singleFlight,
  summarize,
  type WikiDatasetSummary
} from './wikiDatasetTransfer'

const WORKER_PATH = join(__dirname, 'wikiDatasetWorker.js')
const CALL_TIMEOUT_MS = 180_000

const client = new WikiDatasetClient(() => new Worker(WORKER_PATH), CALL_TIMEOUT_MS)

let stopping = false
let refreshing = false
let restartRequired = false
let lastError: string | null = null
let active: WikiDatasetCache | null | undefined
let downloaded: WikiDatasetSummary | null = null
const loadSlot: { current: Promise<WikiDatasetCache | null> | null } = { current: null }
const refreshSlot: { current: Promise<WikiDatasetStatus> | null } = { current: null }

export function wikiDatasetCacheDir(userData = app.getPath('userData')): string {
  return join(userData, WIKI_CACHE_DIR_NAME)
}

export function activeWikiCache(): WikiDatasetCache | null {
  return active ?? null
}

export function ensureWikiDatasetLoaded(): Promise<WikiDatasetCache | null> {
  if (active !== undefined) return Promise.resolve(active)
  return singleFlight(loadSlot, loadFromWorker)
}

export function getWikiDatasetStatus(): Promise<WikiDatasetStatus> {
  return ensureWikiDatasetLoaded().then(() => snapshotStatus())
}

export function refreshWikiDataset(): Promise<WikiDatasetStatus> {
  return singleFlight(refreshSlot, doRefresh)
}

export function shutdownWikiDataset(): void {
  if (stopping) return
  stopping = true
  refreshing = false
  client.stop()
}

async function loadFromWorker(): Promise<WikiDatasetCache | null> {
  if (stopping) {
    active = null
    return null
  }
  try {
    const response = await client.call({ type: 'load', cacheDir: wikiDatasetCacheDir() })
    if (!response.ok || response.kind !== 'load') {
      throw new Error(!response.ok ? response.error : 'Wiki dataset worker failed.')
    }
    active = response.cache
    return active
  } catch (err) {
    active = null
    lastError = publicError(err)
    return null
  }
}

async function doRefresh(): Promise<WikiDatasetStatus> {
  if (process.env.EQ_E2E === '1') {
    await ensureWikiDatasetLoaded()
    lastError = 'Wiki dataset downloads are disabled during isolated tests.'
    return snapshotStatus()
  }
  if (stopping) {
    lastError = 'Wiki dataset refresh stopped because Oracle is quitting.'
    refreshing = false
    return snapshotStatus()
  }
  refreshing = true
  try {
    await ensureWikiDatasetLoaded()
    const checkedAt = new Date().toISOString()
    const response = await client.call({ type: 'refresh', cacheDir: wikiDatasetCacheDir(), checkedAt })
    if (!response.ok || response.kind !== 'refresh') {
      throw new Error(!response.ok ? response.error : 'Wiki dataset worker failed.')
    }
    if (!response.refresh.ok) {
      lastError = response.refresh.error
    } else {
      lastError = null
      downloaded = response.refresh.summary
      restartRequired = response.refresh.summary.sha256 !== (active?.sha256 ?? null)
    }
  } catch (err) {
    lastError = publicError(err)
  } finally {
    refreshing = false
  }
  return snapshotStatus()
}

function snapshotStatus(): WikiDatasetStatus {
  const saved = downloaded ?? (active ? summarize(active) : null)
  const summary = saved ?? { version: null, generatedAt: null, checkedAt: null, sha256: null, items: 0, npcs: 0, zones: 0, identityConflicts: 0, quarantinedItems: 0 }
  let state: WikiDatasetStatus['state']
  if (refreshing) state = 'refreshing'
  else if (lastError) state = 'error'
  else if (saved) state = 'ready'
  else state = 'bundled'
  return {
    state,
    version: summary.version,
    generatedAt: summary.generatedAt,
    checkedAt: summary.checkedAt,
    sha256: summary.sha256,
    items: summary.items,
    npcs: summary.npcs,
    zones: summary.zones,
    error: lastError,
    restartRequired,
    identityConflicts: summary.identityConflicts,
    quarantinedItems: summary.quarantinedItems
  }
}
