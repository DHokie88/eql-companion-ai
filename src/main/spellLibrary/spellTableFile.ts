import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pickSpellTable } from '../../shared/worth'

/** `spells_us.txt` when that name is present, otherwise the first other suffix, otherwise the US name. */
export function spellTablePath(root: string, names: readonly string[]): string {
  return join(root, pickSpellTable(names) ?? 'spells_us.txt')
}

/** The spell table inside a captured bundle. A directory that cannot be listed keeps the US name. */
export async function spellTableFile(directory: string): Promise<string> {
  let names: string[] = []
  try { names = await readdir(directory) } catch { names = [] }
  return spellTablePath(directory, names)
}
