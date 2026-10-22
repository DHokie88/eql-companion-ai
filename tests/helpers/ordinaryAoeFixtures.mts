import { spellRow } from '../spellLibrarySynthetic.mts'

/** Minimal hand-authored rows retaining the reported client mechanics. No raw
 * installation files are copied; omitted fields use the synthetic row defaults.
 */
export function ordinaryAoeRows(): string[][] {
  const pillar = spellRow(386, 'Pillar of Fire', 84)
  pillar[30] = '8'; pillar[13] = '5'; pillar[143] = '4'; pillar[47] = '15'
  pillar[172] = '1|0|-36|0|103|76'
  const arc = spellRow(122, 'Flame Arc', 199)
  arc[30] = '4'; arc[143] = '8'; arc[47] = '255'; arc[48] = '39'
  arc[172] = '1|0|-93|0|103|181'
  const cloud = spellRow(365, 'Infectious Cloud', 78)
  cloud[30] = '8'; cloud[13] = '5'; cloud[143] = '4'; cloud[11] = '10'; cloud[12] = '21'
  cloud[172] = '1|35|1|0|100|0$2|0|-5|0|100|5$3|79|-20|0|100|0'
  const fire = spellRow(433, 'Fire', 260)
  fire[30] = '8'; fire[13] = '10'; fire[143] = '4'; fire[11] = '5'; fire[12] = '2'
  fire[47] = '255'; fire[41] = '48'
  fire[172] = '1|79|-392|0|100|392$2|47|-50|0|100|0'
  return [pillar, arc, cloud, fire]
}
