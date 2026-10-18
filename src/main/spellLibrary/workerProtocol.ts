import type {
  SpellCheckReason, SpellDataset, SpellObservation
} from '../../shared/spellLibrary'

/** Worker paths are supplied by main, never by renderer requests. */
export interface SpellWorkerData { databasePath: string; storageDir: string }
export interface SpellWorkerRequest { id: number; method: string; args?: unknown }
export type SpellWorkerResponse = { id: number; result: unknown } | { id: number; error: string }
export interface SpellWorkerProgress {
  type: 'progress'
  phase: 'checking' | 'importing'
  message: string
}
export interface SpellCheckArgs { root: string; reason: SpellCheckReason; parserVersion?: string }
export interface SpellCheckResult {
  dataset: SpellDataset
  observation: SpellObservation
  materializedDir: string
}
export interface SpellStorageStatus {
  installId: string
  dataset: SpellDataset | null
  checkedAt: string | null
  storageBytes: number
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
export function objectArgs(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected an object')
  return input as Record<string, unknown>
}
export function stringArg(input: unknown, name: string): string {
  if (typeof input !== 'string' || !input.trim() || input.length > 32768) {
    throw new Error(`Invalid ${name}`)
  }
  return input
}
export function integerArg(input: unknown, name: string, min: number, max: number): number {
  if (!Number.isSafeInteger(input) || Number(input) < min || Number(input) > max) {
    throw new Error(`Invalid ${name}`)
  }
  return Number(input)
}
export function reasonArg(input: unknown): SpellCheckReason {
  if (!['startup', 'game-launch', 'installation-change', 'manual'].includes(String(input))) {
    throw new Error('Invalid check reason')
  }
  return input as SpellCheckReason
}
