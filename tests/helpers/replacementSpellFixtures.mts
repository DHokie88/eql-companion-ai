import { SPELL_CLASSES, type SpellClass } from '../../src/shared/spellLibrary'
import { spellRow } from '../spellLibrarySynthetic.mts'

/** Hand-authored mechanics with existing companion replacement names. */
export function replacementRow(id: number, name: string, level: number, options: { code?: SpellClass; damage?: number } = {}): string[] {
  const row = spellRow(id, name, 20, options.damage ?? 100)
  for (let index = 36; index < 52; index++) row[index] = '255'
  row[36 + SPELL_CLASSES.indexOf(options.code ?? 'WIZ')] = String(level)
  row[30] = '8'; row[143] = '4'; row[13] = '5'
  row[8] = '1000'; row[9] = '0'; row[10] = '1000'
  return row
}
export function screenshotReplacementRows(): string[][] {
  const rows = [
    replacementRow(467, 'Lightning Storm', 23, { damage: 400 }),
    replacementRow(85, 'Firestorm', 12, { damage: 300 }),
    replacementRow(386, 'Pillar of Fire', 15, { damage: 200 }),
    replacementRow(380, 'Column of Frost', 8),
    replacementRow(385, 'Project Lightning', 14, { damage: 70 }),
    replacementRow(405, 'Tremor', 19, { code: 'DRU', damage: 80 }),
    replacementRow(27, 'Pogonip', 22, { code: 'DRU', damage: 180 }),
    replacementRow(458, 'Fire Spiral of Al`Kabor', 18, { damage: 160 }),
    replacementRow(382, 'Frost Spiral of Al\u2019Kabor', 12, { damage: 90 }),
    replacementRow(262, 'Cascade of Hail', 12, { code: 'DRU', damage: 120 })
  ]
  for (const row of rows) {
    if ([467, 85, 27, 262].includes(Number(row[0]))) { row[13] = '7500'; row[97] = [467, 85].includes(Number(row[0])) ? '6' : '7' }
    if ([385, 405].includes(Number(row[0]))) { row[30] = '4'; row[143] = '8'; row[13] = '0' }
  }
  return rows
}
