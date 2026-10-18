import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { SpellModifierPreferences } from '../../shared/spellModifiers'
import { validateModifierPreferences } from './modifierValidation'

export type ModifierProfiles = Record<string, SpellModifierPreferences>
export interface ModifierProfileStore {
  load(): Promise<ModifierProfiles>
  save(profiles: ModifierProfiles): Promise<void>
}

function decodeProfiles(text: string): ModifierProfiles {
  const document: unknown = JSON.parse(text)
  if (document === null || typeof document !== 'object') throw new Error('Invalid spell modifier profile document')
  const saved = document as { version?: unknown; profiles?: unknown }
  if (saved.version !== 1 || saved.profiles === null || typeof saved.profiles !== 'object' || Array.isArray(saved.profiles)) {
    throw new Error('Unsupported spell modifier profile document')
  }
  const profiles: ModifierProfiles = {}
  for (const [key, value] of Object.entries(saved.profiles)) {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid spell modifier profile key')
    profiles[key] = validateModifierPreferences(value)
  }
  return profiles
}

/** Settings only: neither observed ranks nor equipment nor catalog records are persisted here. */
export function modifierProfileFile(path: string): ModifierProfileStore {
  return {
    async load() {
      try { return decodeProfiles(await readFile(path, 'utf8')) } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
        throw error
      }
    },
    async save(profiles) {
      await mkdir(dirname(path), { recursive: true })
      const temporary = `${path}.${randomUUID()}.tmp`
      try {
        await writeFile(temporary, `${JSON.stringify({ version: 1, profiles }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
        await rename(temporary, path)
      } finally {
        await unlink(temporary).catch((error: unknown) => {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        })
      }
    }
  }
}
