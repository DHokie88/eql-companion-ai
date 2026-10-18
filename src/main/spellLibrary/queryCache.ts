import { createHash } from 'node:crypto'
import { SPELL_ANALYSIS_MODEL_VERSION } from '../../shared/spellAnalysis'

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]))
}

/** Bounded request results only. Dataset and normalized context are immutable for a request. */
export class SpellQueryCache {
  private values = new Map<string, unknown>()
  constructor(private readonly limit = 32) {}
  key(method: string, args: unknown): string {
    return createHash('sha256').update(JSON.stringify(canonical({ method, args, model: SPELL_ANALYSIS_MODEL_VERSION }))).digest('hex')
  }
  get(key: string): unknown {
    if (!this.values.has(key)) return undefined
    const value = this.values.get(key)
    this.values.delete(key); this.values.set(key, value)
    return structuredClone(value)
  }
  set(key: string, value: unknown): void {
    this.values.delete(key); this.values.set(key, structuredClone(value))
    while (this.values.size > this.limit) {
      const oldest = this.values.keys().next().value
      if (oldest === undefined) return
      this.values.delete(oldest)
    }
  }
}
