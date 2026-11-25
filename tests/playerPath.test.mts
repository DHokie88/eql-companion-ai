import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { parseClientSpellBundle } from '../src/shared/clientSpellParser'
import { mergeArchivedHits } from '../src/shared/fightArchive'
import { scaleStatBlock } from '../src/shared/itemUpgrade'
import { scaleGearStats } from '../src/shared/planner/gearScale'
import { readSealedFights } from '../src/main/logArchive/history'
import { captureClientSpellBundle } from '../src/main/spellLibrary/capture'
import { spellTableFile, spellTablePath } from '../src/main/spellLibrary/spellTableFile'
import { searchPickerFights } from '../src/renderer/src/features/combat/fightSearch'
import { entityOwnDps } from '../src/renderer/src/features/combat/petRows'
import { attachPointMounts } from '../src/renderer/src/features/character/figureMounts'
import { withSkill, type CraftVerdict } from '../src/renderer/src/features/crafting/craftPlan'
import { followTrail } from '../src/renderer/src/features/maps/loggedLoc'
import { questPlaceLabel } from '../src/renderer/src/features/quests/questStart'
import { spellBundle, spellFields } from './fixtures/spell-library/synthetic'
import type { CraftRecipe } from '../src/shared/craft'

test('a spells_de.txt install is the table the reader opens', async () => {
  const us = spellBundle([spellFields(101, 'German Beacon').join('^')])
  const dir = mkdtempSync(join(tmpdir(), 'eqo-spells-'))
  try {
    writeFileSync(join(dir, 'spells_de.txt'), us['spells_us.txt'])
    writeFileSync(join(dir, 'spells_de_str.txt'), us['spells_us_str.txt'])
    writeFileSync(join(dir, 'dbstr_de.txt'), us['dbstr_us.txt'])
    const captured = await captureClientSpellBundle(dir, { stableMs: 0, retryDelays: [], wait: async () => undefined })
    assert.equal(captured.sources['spells_us.txt'], undefined)
    assert.ok(captured.sources['spells_de.txt']?.length)
    const text = Object.fromEntries(Object.entries(captured.sources).map(([name, bytes]) => [name, bytes.toString('utf8')]))
    const [record] = parseClientSpellBundle(text)
    assert.equal(record?.name, 'German Beacon')
    assert.equal(await spellTableFile(dir), join(dir, 'spells_de.txt'))
    assert.equal(spellTablePath(dir, ['readme.txt', 'spells_de.txt']), join(dir, 'spells_de.txt'))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('listed Void and explicit Accuracy scale on the item and the gear vector', () => {
  const block = scaleStatBlock({
    flags: [],
    stats: [
      { key: 'ACCURACY', value: '10', accuracy: 'explicit' },
      { key: 'ACCURACY', value: '10', accuracy: 'generated' }
    ],
    saves: [{ key: 'SV VOID', value: '4' }],
    effects: [],
    exaltationSlots: [],
    extras: []
  }, { full: 2, fraction: 0 })
  assert.equal(block.saves[0]?.value, '6')
  assert.notEqual(block.stats[0]?.value, '10')
  assert.equal(block.stats[1]?.value, '10')
  const generated = scaleGearStats({ ACCURACY: 10, SV_VOID: 4 }, { full: 2, fraction: 0 }, false, 'generated')
  assert.equal(generated.ACCURACY, 10)
  assert.equal(generated.SV_VOID, 6)
  const explicit = scaleGearStats({ ACCURACY: 10 }, { full: 2, fraction: 0 }, false, 'explicit')
  assert.ok((explicit.ACCURACY ?? 0) > 10)
  const ranked = scaleGearStats({ AC: 20, STR: 20 }, { full: 2, fraction: 0 }, true)
  assert.equal(ranked.SV_VOID, 2)
})

test('the map route refuses a blocked cell that is not an endpoint or the midpoint', () => {
  const blocked = followTrail([{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }], (x) => x === 1)
  assert.equal(blocked.route, null)
  assert.equal(blocked.here?.x, 4)
  const open = followTrail([{ x: 0, y: 0, z: 1 }, { x: 3, y: 0, z: 1 }], () => false)
  assert.equal(open.route?.length, 2)
})

test('Luclin mounts hang on the point bones of the figure', () => {
  const added: string[] = []
  const mesh = { id: 'piece' }
  const bones = [
    { name: 'HUMHAIR_POINT_DAG', add: () => added.push('hair') },
    { name: 'HUMHEAD_POINT_DAG', add: () => added.push('head') },
    { name: 'HUMCHEST_POINT_DAG', add: () => added.push('chest') }
  ]
  const hung = attachPointMounts(bones, 'HUM_ACTORDEF', [
    { point: 'HAIR_POINT', mesh },
    { point: 'HEAD_POINT', mesh },
    { point: 'CHEST_POINT', mesh }
  ])
  assert.deepEqual(hung, ['HUMHAIR_POINT_DAG', 'HUMHEAD_POINT_DAG', 'HUMCHEST_POINT_DAG'])
  assert.deepEqual(added, ['hair', 'head', 'chest'])
})

test('fight search reads sealed history and keeps the live log name', async () => {
  const root = mkdtempSync(join(tmpdir(), 'eqo-archive-'))
  const logs = join(root, 'Logs')
  try {
    mkdirSync(join(logs, 'archive'), { recursive: true })
    writeFileSync(join(logs, 'eqlog_Zarzac_test.txt'), 'live\n')
    writeFileSync(join(logs, 'archive', 'old.json'), JSON.stringify({
      fights: [{ id: 'sealed-1', name: 'a bat', zone: 'qeynos', startTs: 50 }]
    }))
    const sealed = readSealedFights(logs)
    assert.equal(sealed.logName, 'eqlog_Zarzac_test.txt')
    const merged = await searchPickerFights('bat', 20, async () => ({ hits: [], corpus: 2 }), async () => sealed)
    assert.equal(merged.logName, 'eqlog_Zarzac_test.txt')
    assert.equal(merged.hits[0]?.summary.name, 'a bat')
    assert.equal(merged.corpus, 3)
    const blank = mergeArchivedHits({ hits: [], corpus: 2 }, sealed.fights, '   ', sealed.logName)
    assert.equal(blank.hits.length, 0)
    assert.equal(blank.logName, 'eqlog_Zarzac_test.txt')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('own-time damage uses the row seconds, and a stated skill gates a trivial', () => {
  assert.equal(entityOwnDps(10, 2), 5)
  assert.equal(entityOwnDps(10, 0), 10)
  const recipe: CraftRecipe = {
    id: 'bow#0', product: 'Bow', productKey: 'bow', skill: 'Blacksmithing', skillLabel: 'Blacksmithing',
    trivial: 50, ingredients: [], unstated: false
  }
  const verdict: CraftVerdict = { recipe, makeable: true, missing: [], heldKinds: 0, unstated: false }
  assert.equal(withSkill(verdict, { Blacksmithing: 10 }), false)
  assert.equal(withSkill(verdict, { Blacksmithing: 50 }), true)
  assert.equal(withSkill(verdict, undefined), true)
  assert.equal(questPlaceLabel({ giver: 'Guard', startsIn: 'East Freeport', startZone: 'Freeport' }), 'Guard · East Freeport')
})
