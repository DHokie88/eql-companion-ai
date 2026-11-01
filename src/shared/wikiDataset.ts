import type { ItemKnowledge } from './types'

export interface WikiDatasetEvidence {
  source: 'EQLWiki EOZ dataset'
  version: string
  generatedAt: string
  revisionId: number | null
  era: string
}

export interface WikiDatasetStatus {
  state: 'bundled' | 'ready' | 'refreshing' | 'error'
  version: string | null
  generatedAt: string | null
  checkedAt: string | null
  sha256: string | null
  items: number
  npcs: number
  zones: number
  error: string | null
  restartRequired?: boolean
  identityConflicts?: number
  quarantinedItems?: number
}

export interface WikiDatasetCache {
  schemaVersion: 1
  version: string
  generatedAt: string
  checkedAt: string
  sha256: string
  items: Record<string, Partial<Omit<ItemKnowledge, 'cached' | 'page'>> & { page: string }>
  sourceItemCount?: number
  identityConflicts?: { key: string; pages: string[] }[]
  quarantinedItems?: (Partial<Omit<ItemKnowledge, 'cached' | 'page'>> & { page: string })[]
  npcCount: number
  zoneCount: number
}
