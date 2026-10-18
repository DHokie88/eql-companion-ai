import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseClientSpellBundle } from '../src/shared/clientSpellParser'
import { SPELL_SOURCE_FILES, type SpellSourceFile } from '../src/shared/spellLibrary'
import { bundleHashes } from '../src/main/spellLibrary/capture'
import { SpellLibraryStorage } from '../src/main/spellLibrary/storage'

export function spellRow(id = 1, name = 'Synthetic Bolt', mana = 10, damage = 100): string[] {
  const fields = Array<string>(173).fill('0')
  fields[0] = String(id); fields[1] = name
  fields[14] = String(mana); fields[30] = '5'
  for (let index = 36; index < 52; index++) fields[index] = '255'
  fields[47] = '1' // Wizard
  fields[85] = String(id); fields[86] = '10'; fields[87] = '11'
  fields[172] = `1|0|-${damage}|0|100|0`
  return fields
}
export function syntheticCatalog(rows: string[][] = [spellRow()], description = 'Synthetic description') {
  const strings: Record<SpellSourceFile, string> = {
    'spells_us.txt': rows.map((fields) => fields.join('^')).join('\r\n') + '\r\n',
    'spells_us_str.txt': rows.map((fields) => `${fields[0]}^You cast.^Other casts.^On you.^On other.^Fades.`).join('\r\n') + '\r\n',
    'dbstr_us.txt': `10^5^Damage\r\n11^5^Direct\r\n${rows.map((fields) => `${fields[0]}^6^${description}`).join('\r\n')}\r\n`
  }
  const sources = Object.fromEntries(SPELL_SOURCE_FILES.map((name) => [name, Buffer.from(strings[name])])) as Record<SpellSourceFile, Buffer>
  return { strings, capture: { sources, hashes: bundleHashes(sources) }, records: parseClientSpellBundle(strings) }
}
export function storageFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'oracle-spell-test-'))
  const options = { databasePath: join(directory, 'spells', 'library.sqlite'), storageDir: join(directory, 'spells') }
  const root = join(directory, 'game')
  mkdirSync(root)
  const storage = new SpellLibraryStorage(options)
  return { directory, options, root, storage, close() { storage.close(); rmSync(directory, { recursive: true, force: true }) } }
}
export function writeCatalog(root: string, catalog = syntheticCatalog()): void {
  mkdirSync(root, { recursive: true })
  for (const name of SPELL_SOURCE_FILES) writeFileSync(join(root, name), catalog.capture.sources[name])
}
