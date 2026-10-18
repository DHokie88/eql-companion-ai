/** Hand-authored client rows only. No installation files or production spell names. */
import type { SpellSourceFile } from '../../../src/shared/spellLibrary'

export function spellFields(id = 101, name = 'Test Beacon', layout: 173 | 174 = 173): string[] {
  const fields = new Array<string>(173).fill('0')
  fields[0] = String(id)
  fields[1] = name
  fields[3] = 'test_pet'
  fields[4] = '125.5'
  fields[5] = '15'
  fields[8] = '2500'
  fields[9] = '1500'
  fields[10] = '6000'
  fields[14] = '40'
  fields[15] = '400'
  fields[19] = '2'
  fields[23] = '500'
  fields[29] = '2'
  fields[30] = '5'
  fields[32] = '24'
  for (let i = 36; i < 52; i++) fields[i] = '255'
  fields[47] = '12' // WIZ
  fields[78] = '-15'
  fields[81] = '102'
  fields[85] = '900'
  fields[86] = '45'
  fields[87] = '46'
  fields[143] = '8'
  fields[165] = '901'
  fields[172] = '1|79|-40|5|100|40$2|254|0|0|100|0'
  if (layout === 174) fields.splice(74, 0, '6789')
  return fields
}

export function spellBundle(rows = [spellFields().join('^')]): Record<SpellSourceFile, string> {
  return {
    'spells_us.txt': rows.join('\r\n') + '\r\n',
    'spells_us_str.txt': '#SPELLINDEX^CASTERMETXT^CASTEROTHERTXT^CASTEDMETXT^CASTEDOTHERTXT^SPELLGONE^\r\n101^You test.^Someone tests.^It lands.^It lands nearby.^It fades.^\r\n',
    'dbstr_us.txt': '45^5^Test category^0^\r\n46^5^Test subcategory^0^\r\n900^6^Deal #1 points, $1 targets, max @1.<BR>Lasts %z; unknown #12. &nbsp;&#39;test&#39;^0^\r\n901^27^Display Beacon^0^\r\n0^10^Unrelated text^0^\r\n'
  }
}
