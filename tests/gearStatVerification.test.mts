import assert from 'node:assert/strict'
import { test } from 'node:test'
import { knowledgeFromDb, type ItemDbEntry, type ItemDbFile } from '../src/main/itemsDb'
import { buildGearIndex } from '../src/main/planner/gearIndex'
import { gearStatEvidence } from '../src/renderer/src/features/gear/gearStatEvidence'
import { ITEM_UPGRADE_BASE } from '../src/shared/itemUpgrade'
import { parseStatsBlock } from '../src/shared/itemStats'
import { scaleGearRow } from '../src/shared/planner/gearScale'

const NAME = 'Lustrous Russet Vambraces'
const KEY = NAME.toLowerCase()

function record(ac: number, page = NAME): ItemDbEntry {
  const statsBlock = `Slot: ARMS\nAC: ${ac}\nSTR: +9 DEX: +5\nWT: 4.9\nClass: ALL`
  return { page, name: NAME, statsBlock, stats: parseStatsBlock(statsBlock) }
}

function gearRow(entry: ItemDbEntry) {
  const items: ItemDbFile = { scrapedAt: '', source: '', count: 1, items: { [KEY]: entry } }
  return buildGearIndex(items).rows[0]
}

test('the reviewed stale AC is corrected in item lookup and before Gear scaling', () => {
  const wiki = record(15)
  assert.equal(knowledgeFromDb(wiki).stats?.ac, 13)
  assert.equal(wiki.stats?.ac, 15)
  const row = gearRow(wiki)
  assert.equal(row.stats.AC, 13)
  assert.deepEqual(row.verifiedBaseStats, ['AC', 'STR', 'DEX', 'WEIGHT'])
  assert.equal(gearStatEvidence(row, 'AC', ITEM_UPGRADE_BASE), 'verified')
  const tier = { full: 3, fraction: 0 }
  const scaled = scaleGearRow(row, tier)
  assert.equal(scaled.stats.AC, 16)
  assert.equal(gearStatEvidence(scaled, 'AC', tier), 'estimated')
  assert.equal(gearStatEvidence(scaled, 'SV_VOID', tier), 'estimated')
})

test('an updated AC is kept and only matching reviewed numbers are marked', () => {
  assert.equal(gearRow(record(13)).stats.AC, 13)
  const updated = gearRow(record(17))
  assert.equal(updated.stats.AC, 17)
  assert.equal(gearStatEvidence(updated, 'AC', ITEM_UPGRADE_BASE), 'wiki')
  assert.equal(gearStatEvidence(updated, 'STR', ITEM_UPGRADE_BASE), 'verified')
  assert.equal(gearRow(record(15, 'An unrelated wiki page')).stats.AC, 15)
})

test('verified weapon delay remains verified at a simulated tier', () => {
  const page = 'Efreeti Magi Staff'
  const stats = parseStatsBlock('Slot: PRIMARY\nSkill: 2H Blunt Atk Delay: 36\nDMG: 12\nClass: ALL')
  const tier = { full: 6, fraction: 0 }
  const row = scaleGearRow(gearRow({ name: page, page, stats }), tier)
  assert.equal(row.stats.DELAY, 36)
  assert.equal(gearStatEvidence(row, 'DELAY', tier), 'verified')
  assert.equal(gearStatEvidence(row, 'DMG', tier), 'estimated')
})
