import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
import { followTrail, locBlocked, stepTrail } from '../src/renderer/src/features/maps/loggedLoc'
import { mountPieces, pointForPiece } from '../src/main/eqassets/pointMounts'
import { fightsInLogText } from '../src/main/logArchive/sealedLog'
import { parseStatsBlock } from '../src/shared/itemStats'
import { readGearStats } from '../src/main/planner/gearIndex'
import { noteGaps } from '../src/renderer/src/features/community/coverageDraft'
import { loadLootSignedIn, saveLootSignedIn, type LootSignStore } from '../src/renderer/src/features/loot/lootSession'
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

test('the model loader hangs hair and a helm on point bones and leaves the body skinned', () => {
  const bones = [
    { name: 'HUMHAIR_POINT_DAG' },
    { name: 'HUMHEAD_POINT_DAG' },
    { name: 'HUMCHEST_POINT_DAG' }
  ]
  const mesh = (name: string) => ({
    name, positions: [], normals: [], uvs: [], indices: [], groups: [], materials: [], skinIndices: []
  })
  assert.equal(pointForPiece('HUM_ACTORDEF', 'HUM_DMSPRITEDEF', bones), null)
  assert.equal(pointForPiece('HUM_ACTORDEF', 'HUMHE00_DMSPRITEDEF', bones), null)
  assert.equal(pointForPiece('HUM_ACTORDEF', 'HUMHAIR_DMSPRITEDEF', bones), 'HAIR_POINT')
  assert.equal(pointForPiece('HUM_ACTORDEF', 'HUMHE01_DMSPRITEDEF', [{ name: 'HUMR_POINT_DAG' }]), null)
  const hung = mountPieces({
    actor: 'HUM_ACTORDEF',
    bones,
    meshes: [mesh('HUM_DMSPRITEDEF'), mesh('HUMHE00_DMSPRITEDEF'), mesh('HUMHE01_DMSPRITEDEF')],
    extras: [mesh('HUMHAIR_DMSPRITEDEF'), mesh('HUMCHEST_DMSPRITEDEF')]
  })
  assert.deepEqual(hung.skinned.map((row) => row.name), ['HUM_DMSPRITEDEF', 'HUMHE00_DMSPRITEDEF'])
  assert.deepEqual(hung.mounts.map((row) => row.point), ['HEAD_POINT', 'HAIR_POINT', 'CHEST_POINT'])
})

test('a blocked map line refuses the marker and a cleared mob is marked', () => {
  const wall = locBlocked(new Float32Array([-1, -1, 0, -1, 1, 0]), 1)
  assert.equal(wall(1, 0), true)
  assert.equal(wall(0, 0), false)
  const samples: { x: number; y: number; z: number }[] = []
  const first = stepTrail({ samples, loc: { x: 0, y: 0, z: 0 }, blocked: wall, names: ['a bat'], killed: [] })
  assert.equal(first.place, true)
  assert.equal(first.crawl[0]?.cleared, false)
  const blocked = stepTrail({ samples, loc: { x: 4, y: 0, z: 0 }, blocked: wall, names: ['a bat'], killed: ['A bat'] })
  assert.equal(blocked.place, false)
  assert.equal(samples.length, 1)
  assert.equal(samples[0]?.x, 0)
  assert.equal(blocked.crawl[0]?.cleared, true)
})

test('sealed log copies add fights and the live file is not opened', () => {
  const text = [
    '[Sat Aug 01 13:00:28 2026] You have entered East Freeport.',
    '[Sat Aug 01 13:00:40 2026] You have slain a bat!'
  ].join('\n')
  const fights = fightsInLogText(text, 'old.txt')
  assert.equal(fights[0]?.name, 'a bat')
  assert.equal(fights[0]?.zone, 'East Freeport')
  assert.ok((fights[0]?.startTs ?? 0) > 0)
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
    writeFileSync(join(logs, 'archive', 'sealed.txt'), [
      '[Sat Aug 01 12:00:00 2026] You have entered Qeynos.',
      '[Sat Aug 01 12:00:10 2026] You have slain a snake!'
    ].join('\n'))
    writeFileSync(join(logs, 'eqlog_Other_test.txt'), '[Sat Aug 01 11:00:00 2026] You have slain a wolf!\n')
    writeFileSync(join(logs, 'eqlog_Zarzac_test.txt'), 'live\n')
    writeFileSync(join(logs, 'archive', 'old.json'), JSON.stringify({
      fights: [{ id: 'sealed-1', name: 'a bat', zone: 'qeynos', startTs: 50 }]
    }))
    const sealed = readSealedFights(logs)
    assert.equal(sealed.logName, 'eqlog_Zarzac_test.txt')
    const merged = await searchPickerFights('bat', 20, async () => ({ hits: [], corpus: 2 }), async () => sealed)
    assert.equal(merged.logName, 'eqlog_Zarzac_test.txt')
    assert.equal(merged.hits[0]?.summary.name, 'a bat')
    assert.equal(merged.hits.length, 1)
    assert.equal(merged.corpus, 5)
    const snake = await searchPickerFights('snake', 20, async () => ({ hits: [], corpus: 2 }), async () => sealed)
    assert.equal(snake.hits[0]?.summary.name, 'a snake')
    assert.equal(snake.hits[0]?.summary.zone, 'Qeynos')
    const wolf = await searchPickerFights('wolf', 20, async () => ({ hits: [], corpus: 2 }), async () => sealed)
    assert.equal(wolf.hits[0]?.summary.name, 'a wolf')
    assert.equal(readFileSync(join(logs, 'eqlog_Zarzac_test.txt'), 'utf8'), 'live\n')
    const blank = mergeArchivedHits({ hits: [], corpus: 2 }, sealed.fights, '   ', sealed.logName)
    assert.equal(blank.hits.length, 0)
    assert.equal(blank.logName, 'eqlog_Zarzac_test.txt')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('a generated Accuracy line does not scale, and an explicit line does', () => {
  const generated = parseStatsBlock('Accuracy: 10 (generated)')
  const explicit = parseStatsBlock('Accuracy: 10')
  assert.equal(generated.stats[0]?.accuracy, 'generated')
  assert.equal(generated.stats[0]?.value, '10')
  assert.equal(explicit.stats[0]?.accuracy, 'explicit')
  const generatedBlock = scaleStatBlock(generated, { full: 2, fraction: 0 })
  const explicitBlock = scaleStatBlock(explicit, { full: 2, fraction: 0 })
  assert.equal(generatedBlock.stats[0]?.value, '10')
  assert.notEqual(explicitBlock.stats[0]?.value, '10')
  const generatedGear = readGearStats(generated)
  const explicitGear = readGearStats(explicit)
  assert.equal(generatedGear.accuracySource, 'generated')
  assert.equal(explicitGear.accuracySource, 'explicit')
  assert.equal(scaleGearStats(generatedGear.stats, { full: 2, fraction: 0 }, false, generatedGear.accuracySource ?? 'explicit').ACCURACY, 10)
  assert.ok((scaleGearStats(explicitGear.stats, { full: 2, fraction: 0 }, false, explicitGear.accuracySource ?? 'explicit').ACCURACY ?? 0) > 10)
})

function memoryStore(): LootSignStore {
  const bag = new Map<string, string>()
  return {
    getItem: (key) => bag.get(key) ?? null,
    setItem: (key, value) => { bag.set(key, value) },
    removeItem: (key) => { bag.delete(key) }
  }
}

test('coverage gaps are the known categories the notes miss, and loot send follows sign-in', () => {
  assert.deepEqual(noteGaps([]), ['Historical channel access', 'Image-only prices', 'Poll results'])
  assert.deepEqual(noteGaps(['Historical channel access', 'Other coverage note']), ['Image-only prices', 'Poll results'])
  const store = memoryStore()
  assert.equal(loadLootSignedIn(store), false)
  assert.equal(saveLootSignedIn(true, store), true)
  assert.equal(loadLootSignedIn(store), true)
  assert.equal(saveLootSignedIn(false, store), false)
  assert.equal(loadLootSignedIn(store), false)
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
