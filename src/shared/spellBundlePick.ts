import { companionSpellFile, pickSpellTable } from './worth'

function spellSourceMap(sources: object): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [key, value] of Object.entries(sources)) {
    if (typeof value === 'string') map[key] = value
  }
  return map
}

function textNamed(map: Record<string, string>, name: string): string {
  if (Object.prototype.hasOwnProperty.call(map, name)) return map[name]
  const found = Object.keys(map).find((key) => key.toLowerCase() === name.toLowerCase())
  if (found === undefined) throw new Error(`Missing ${name}`)
  return map[found]
}

/** `spells_us.txt` when that file is in the bundle, otherwise the first other `spells_<suffix>.txt`. */
export function chosenSpellTexts(sources: object): { table: string; rows: string; messages: string; strings: string } {
  const map = spellSourceMap(sources)
  const table = pickSpellTable(Object.keys(map))
  if (!table) throw new Error('No spells_<suffix>.txt table')
  return {
    table,
    rows: textNamed(map, table),
    messages: textNamed(map, companionSpellFile(table, 'str')),
    strings: textNamed(map, companionSpellFile(table, 'dbstr'))
  }
}
