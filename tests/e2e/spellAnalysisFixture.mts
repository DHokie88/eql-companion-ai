/** Hand-authored mechanics, never a copy or derivative of installed client files. */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SPELL_SOURCE_FILES } from '../../src/shared/spellLibrary'
import { spellBundle, spellFields } from '../fixtures/spell-library/synthetic'
import type { FixtureLog } from './logFixture.mjs'

function row(id: number, name: string, level = 12, damage = 40): string[] {
  const fields = spellFields(id, name)
  fields[38] = String(level); fields[47] = String(level)
  fields[14] = '10'; fields[172] = `1|79|-${damage}|0|100|${damage}`
  return fields
}
export function stageAnalysisSources(staged: FixtureLog): number {
  const rows = Array.from({ length: 45 }, (_, i) => row(101 + i, `Test Ranked ${i + 1}`, 12, 40 + i))
  rows.push(row(201, 'Test New Fifty', 50, 80), row(202, 'Test New Sibling', 50, 70), row(401, 'Test Upcoming', 51, 100), row(402, 'Test Later', 60, 120))
  const area = row(301, 'Test Area', 30, 25); area[30] = '8'; area[143] = '8'
  const rain = row(302, 'Lava Storm', 30, 20); rain[30] = '8'; rain[13] = '7500'; rain[143] = '4'
  const slow = row(738, 'Test Binding Song', 23); slow[11] = '5'; slow[12] = '2'; slow[4] = '150'; slow[29] = '1'; slow[172] = '1|3|-30|0|102|0$2|11|95|0|101|60'
  const free = row(501, 'Test Free', 12, 200); free[14] = '0'
  const unknown = row(502, 'Test Unknown Formula'); unknown[172] = '1|79|-40|0|999|0'
  const periodic = row(503, 'Test Periodic'); periodic[11] = '5'; periodic[12] = '2'; periodic[172] = '1|0|-10|0|100|0'
  const heal = row(504, 'Test Healing'); heal[28] = '1'; heal[172] = '1|79|40|0|100|0'
  rows.push(area, rain, slow, free, unknown, periodic, heal)
  const bundle = spellBundle(rows.map((fields) => fields.join('^')))
  for (const name of SPELL_SOURCE_FILES) writeFileSync(join(staged.installDir, name), bundle[name])
  return rows.length
}
