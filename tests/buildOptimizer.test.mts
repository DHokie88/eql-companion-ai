// THE BUILD TAB'S ARITHMETIC (EQ Zera, 2026-09-06): the profile weights say what they mean, the
// scorer adds what it says, the optimizer picks what the weights prefer, and the solo meter stays
// inside its range — all against small fixtures where the fact is the function's.

import test from 'node:test'
import assert from 'node:assert/strict'
import type { GearRow } from '../src/shared/planner/gear'
import {
  archetypeOf,
  itemScore,
  meterPercent,
  profileWeights,
  soloKit,
  soloReading
} from '../src/shared/build/profiles'
import { bestBuild, buildScore, candidatesForCell, rankUpgrades, upgradesFor, wearable } from '../src/shared/build/optimizer'
import { BUILD_CELLS, wornSet } from '../src/shared/build/wornSet'
import { defaultBuildStrategies, strategyScorer, strategyWeights } from '../src/shared/build/strategies'
import { estimatedMana, estimatedManaGain, gearManaScore } from '../src/shared/build/manaEstimate'

function row(name: string, slots: GearRow['slots'], stats: GearRow['stats'], classes: GearRow['classes'] = []): GearRow {
  return {
    key: name.toLowerCase(),
    name,
    searchKey: name.toLowerCase(),
    slots,
    classes,
    races: ['ALL'],
    flags: [],
    quest: false,
    playerCrafted: false,
    stats,
    effects: []
  }
}

const PLATE = row('Plate Chest', ['CHEST'], { AC: 30, HP: 20, STA: 5 })
const ROBE = row('Wise Robe', ['CHEST'], { AC: 6, WIS: 12, INT: 12, MP: 40 })
const SWORD = row('Fast Sword', ['PRIMARY', 'SECONDARY'], { DMG: 10, DELAY: 20, STR: 3 })
const CLUB = row('Slow Club', ['PRIMARY'], { DMG: 12, DELAY: 40 })
const RING_A = row('Ring A', ['FINGER'], { AC: 5, HP: 15 })
const RING_B = row('Ring B', ['FINGER'], { AC: 4, HP: 10 })
const CLERIC_ONLY = row('Holy Hat', ['HEAD'], { WIS: 20 }, ['CLR'])

test('illustrative mana selects the two largest class pools, including when they switch', () => {
  const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} should be ${expected}`)
  const intItem = row('Intelligence', ['HEAD'], { INT: 10 })
  const wisItem = row('Wisdom', ['HEAD'], { WIS: 10 })
  const pure = { classes: ['WIZ', 'ENC', 'MAG'] as const, intelligence: 200, wisdom: 200, manaWeight: 1 }
  near(estimatedMana(pure), 3760)
  near(estimatedManaGain(pure, null, intItem), 188)
  near(estimatedManaGain(pure, null, wisItem), 0)
  const mixed = { ...pure, classes: ['RNG', 'WIZ', 'SHM'] as const }
  near(estimatedManaGain(mixed, null, intItem), 94)
  near(estimatedManaGain(mixed, null, wisItem), 94)
  const bard = { ...pure, classes: ['BRD', 'WIZ', 'PAL'] as const, wisdom: 150 }
  near(estimatedManaGain(bard, null, intItem), 141)
  near(estimatedManaGain(bard, null, wisItem), 0)
  const paladin = { ...bard, wisdom: 300 }
  near(estimatedManaGain(paladin, null, intItem), 94)
  near(estimatedManaGain(paladin, null, wisItem), 47)
  near(estimatedManaGain({ ...bard, wisdom: 195 }, null, wisItem), 23.5)
})

test('upgrade ranking compares raw mana with estimated stat mana and applies the mana weight', () => {
  const intItem = row('Intelligence', ['HEAD'], { INT: 10 })
  const rawItem = row('Raw mana', ['HEAD'], { MP: 50 })
  const worn = new Map([['HEAD' as const, null]])
  const mana = { classes: ['WIZ', 'ENC'] as const, intelligence: 150, wisdom: 150, manaWeight: 2 }
  const ctx = { classes: mana.classes, weights: { MP: 2 }, mana, perCell: 50 }
  const ranked = rankUpgrades(upgradesFor([rawItem, intItem], worn, ['HEAD'], ctx))
  assert.equal(ranked[0].options[0].row.name, 'Intelligence')
  assert.ok(Math.abs(ranked[0].options[0].delta - 376) < 0.00001)
  assert.equal(ranked[1].options[0].delta, 100)
  assert.ok(Math.abs((ranked[0].options[0].mana?.derived ?? 0) - 188) < 0.00001)
  assert.ok(Math.abs(gearManaScore(mana, [], [intItem]) - ranked[0].options[0].delta) < 0.00001)
})

test('the archetype reads a loadout the way the weights need it', () => {
  assert.deepEqual(archetypeOf(['WAR']), { melee: true, intCaster: false, priest: false, manaStat: null, rogue: false })
  assert.equal(archetypeOf(['CLR']).manaStat, 'WIS')
  assert.equal(archetypeOf(['WIZ']).manaStat, 'INT')
  assert.equal(archetypeOf(['CLR', 'WIZ']).manaStat, 'WIS', 'a mixed loadout leans on WIS')
  assert.equal(archetypeOf(['ROG', 'CLR', 'MNK']).rogue, true)
})

test('a tank wants the plate, a healer wants the robe, and both say so in HP-equivalents', () => {
  const tank = profileWeights('tank', ['WAR'])
  const heal = profileWeights('heal', ['CLR'])
  assert.ok(itemScore(PLATE.stats, tank) > itemScore(ROBE.stats, tank))
  assert.ok(itemScore(ROBE.stats, heal) > itemScore(PLATE.stats, heal))
  // AC 30 × 12 + HP 20 + STA 5 × 10 = 430 HP-equivalents, nothing else on the item.
  assert.equal(itemScore(PLATE.stats, tank), 430)
})

test('melee DPS is the weapon ratio; caster DPS is the mana stat', () => {
  const melee = profileWeights('dps', ['WAR'])
  assert.ok(itemScore(SWORD.stats, melee) > itemScore(CLUB.stats, melee), 'a 0.5 ratio beats a 0.3 ratio')
  const caster = profileWeights('dps', ['WIZ'])
  assert.equal(caster.RATIO, undefined, 'a pure caster does not weigh weapon ratio')
  assert.ok((caster.INT ?? 0) > 0 && caster.WIS === undefined)
  const hybrid = profileWeights('dps', ['WAR', 'WIZ'])
  assert.ok((hybrid.RATIO ?? 0) > 0 && (hybrid.INT ?? 0) > 0, 'a mixed loadout weighs both halves')
})

test('wearable: a stated class list that names none of ours excludes the row; an unstated one never does', () => {
  assert.equal(wearable(CLERIC_ONLY, ['WAR']), false)
  assert.equal(wearable(CLERIC_ONLY, ['WAR', 'CLR']), true)
  assert.equal(wearable(PLATE, ['WAR']), true)
  assert.equal(wearable(CLERIC_ONLY, []), true, 'no loadout known: nothing is excluded')
})

test('candidates come slot-matched, class-matched, filtered, best first', () => {
  const rows = [PLATE, ROBE, SWORD, CLUB, RING_A, RING_B, CLERIC_ONLY]
  const ctx = { classes: ['WAR'] as const, weights: profileWeights('tank', ['WAR']) }
  assert.deepEqual(candidatesForCell(rows, 'CHEST', ctx).map((c) => c.row.name), ['Plate Chest', 'Wise Robe'])
  assert.deepEqual(candidatesForCell(rows, 'HEAD', ctx), [], 'the cleric hat is not a warrior candidate')
  const noPlate = { ...ctx, excluded: (r: GearRow) => r.name === 'Plate Chest' }
  assert.deepEqual(candidatesForCell(rows, 'CHEST', noPlate).map((c) => c.row.name), ['Wise Robe'])
  assert.deepEqual(candidatesForCell(rows, 'FINGER2', ctx).map((c) => c.row.name), ['Ring A', 'Ring B'], 'a second cell draws from its slot')
})

test('the best build takes the top row per cell and two DIFFERENT rings', () => {
  const rows = [PLATE, ROBE, SWORD, CLUB, RING_A, RING_B]
  const ctx = { classes: ['WAR'] as const, weights: profileWeights('tank', ['WAR']) }
  const best = bestBuild(rows, ['CHEST', 'FINGER', 'FINGER2', 'PRIMARY', 'HEAD'], ctx)
  assert.equal(best.get('CHEST')?.name, 'Plate Chest')
  assert.equal(best.get('FINGER')?.name, 'Ring A')
  assert.equal(best.get('FINGER2')?.name, 'Ring B')
  assert.equal(best.get('HEAD'), null, 'a cell nothing fits stays empty')
  assert.equal(buildScore(best, ctx.weights), itemScore(PLATE.stats, ctx.weights) + itemScore(RING_A.stats, ctx.weights) + itemScore(RING_B.stats, ctx.weights) + itemScore(SWORD.stats, ctx.weights))
})

test('upgrades list only what beats the worn item, skip what is already worn elsewhere, and cap per cell', () => {
  const rows = [PLATE, ROBE, RING_A, RING_B]
  const ctx = { classes: ['WAR'] as const, weights: profileWeights('tank', ['WAR']) }
  const set = new Map<'CHEST' | 'FINGER' | 'FINGER2', GearRow | null>([
    ['CHEST', ROBE],
    ['FINGER', RING_B],
    ['FINGER2', null]
  ])
  const ups = upgradesFor(rows, set, ['CHEST', 'FINGER', 'FINGER2'], { ...ctx, perCell: 5 })
  assert.deepEqual(ups[0].options.map((o) => o.row.name), ['Plate Chest'])
  assert.ok(ups[0].options[0].delta > 0)
  assert.deepEqual(ups[1].options.map((o) => o.row.name), ['Ring A'])
  assert.deepEqual(ups[2].options.map((o) => o.row.name), ['Ring A'], 'the empty second cell wants Ring A too; Ring B is worn, so it is not offered')
  assert.equal(upgradesFor(rows, set, ['CHEST'], { ...ctx, perCell: 0 })[0].options.length, 0)
})

test('meters and the solo reading stay in 0..100 and read the kit the way the table says', () => {
  assert.equal(meterPercent(50, 100), 50)
  assert.equal(meterPercent(120, 100), 100)
  assert.equal(meterPercent(10, 0), 0)
  const cleric = soloKit(['CLR'])
  assert.equal(cleric.heal, 1)
  const trio = soloKit(['WAR', 'CLR', 'NEC'])
  assert.equal(trio.heal, 1, 'the loadout has the cleric')
  assert.equal(trio.pet, 0.9, 'and the necromancer')
  const r = soloReading(trio, { tank: 60, dps: 40, heal: 80 })
  assert.ok(r.percent >= 0 && r.percent <= 100 && r.kitPercent >= 0 && r.gearPercent >= 0)
  const warrior = soloReading(soloKit(['WAR']), { tank: 60, dps: 40, heal: 80 })
  assert.ok(warrior.percent < r.percent, 'a warrior alone solos worse than a warrior with a cleric and a necromancer in the loadout')
})

test('both any slots count in the worn set, and the reference set does not duplicate an item', () => {
  assert.ok(BUILD_CELLS.includes('ANY1') && BUILD_CELLS.includes('ANY2'))
  const reading = wornSet([{ slot: 'ANY1', key: PLATE.key, name: PLATE.name }, { slot: 'ANY2', key: ROBE.key, name: ROBE.name }], new Map([[PLATE.key, PLATE], [ROBE.key, ROBE]]))
  assert.equal(reading.worn.get('ANY1')?.key, PLATE.key)
  assert.equal(reading.worn.get('ANY2')?.key, ROBE.key)
  const best = bestBuild([PLATE, ROBE], ['CHEST', 'ANY1', 'ANY2'], { classes: [], weights: { AC: 1 } })
  assert.equal(new Set([...best.values()].filter(Boolean).map((item) => item?.key)).size, 2)
  assert.equal([...best.values()].filter(Boolean).length, 2)
})

test('the reference assignment handles an item that fits multiple standard slots', () => {
  const flexible = row('Flexible', ['HEAD', 'CHEST'], { AC: 100 })
  const head = row('Head only', ['HEAD'], { AC: 90 })
  const chest = row('Chest only', ['CHEST'], { AC: 1 })
  const best = bestBuild([flexible, head, chest], ['HEAD', 'CHEST'], { classes: [], weights: { AC: 1 } })
  assert.equal(best.get('HEAD')?.key, head.key)
  assert.equal(best.get('CHEST')?.key, flexible.key)
})

test('upgrades compare both any slots, exclude all worn items and rank each item at its greatest gain', () => {
  const stronger = row('Better Hat', ['HEAD'], { AC: 50 })
  const current = new Map([['HEAD', CLERIC_ONLY], ['ANY1', PLATE], ['ANY2', ROBE]] as const)
  const upgrades = rankUpgrades(upgradesFor([stronger, PLATE, ROBE], current, ['HEAD', 'ANY1', 'ANY2'], { classes: [], weights: { AC: 1 }, perCell: 50 }))
  assert.equal(upgrades.length, 1)
  assert.equal(upgrades[0].options[0].row.key, stronger.key)
  assert.equal(upgrades[0].cell, 'HEAD')
  const twoAny = new Map([['HEAD', stronger], ['ANY1', PLATE], ['ANY2', ROBE]] as const)
  const onlyRing = row('New Ring', ['FINGER'], { AC: 40 })
  const choices = rankUpgrades(upgradesFor([onlyRing], twoAny, ['HEAD', 'ANY1', 'ANY2'], { classes: [], weights: { AC: 1 }, perCell: 50 }))
  assert.equal(choices[0].cell, 'ANY2', 'the better overall placement replaces the weaker any-slot item')
  assert.equal(rankUpgrades(upgradesFor([onlyRing], twoAny, ['ANY1'], { classes: [], weights: { AC: 1 }, wornKeys: new Set([onlyRing.key]) })).length, 0,
    'a piece worn live stays excluded while a different saved loadout is being planned')
})

test('only the strongest haste contributes and replacing its source considers the other worn haste', () => {
  const hasteA = row('Haste A', ['HEAD'], { HASTE: 40, AC: 5 })
  const hasteB = row('Haste B', ['CHEST'], { HASTE: 30, AC: 10 })
  const candidate = row('Candidate', ['HEAD'], { HASTE: 35, AC: 20 })
  const set = new Map([['HEAD', hasteA], ['CHEST', hasteB]] as const)
  const weights = { HASTE: 2, AC: 1 }
  assert.equal(buildScore(set, weights), 95)
  const upgrade = upgradesFor([candidate], set, ['HEAD'], { classes: [], weights })[0].options[0]
  assert.equal(upgrade.delta, 5, 'gain is 15 AC minus 5 haste times weight 2')
  const extra = row('Extra Haste', ['CHEST'], { HASTE: 20, AC: 11 })
  assert.equal(upgradesFor([extra], set, ['CHEST'], { classes: [], weights })[0].options[0].delta, 1)
})

test('overall upgrade ranking uses marginal haste rather than the item haste in isolation', () => {
  const haste = row('Current Haste', ['WAIST'], { HASTE: 50 })
  const old = row('Old Hat', ['HEAD'], { AC: 1 })
  const redundant = row('Redundant Haste', ['HEAD'], { HASTE: 40, AC: 2 })
  const useful = row('Useful Hat', ['HEAD'], { AC: 10 })
  const set = new Map([['WAIST', haste], ['HEAD', old]] as const)
  const ranked = rankUpgrades(upgradesFor([redundant, useful, haste], set, ['HEAD', 'ANY1'], { classes: [], weights: { AC: 1, HASTE: 10 }, perCell: 10, unknownCells: new Set(['ANY1']) }))
  assert.equal(ranked[0].options[0].row.key, useful.key)
  assert.equal(ranked[0].options[0].delta, 9)
  assert.equal(ranked[1].options[0].delta, 1)
})

test('configured haste weight and cap apply once to the set', () => {
  const strategy = { ...defaultBuildStrategies()[0], weights: { HASTE: 2 }, caps: { HASTE: 30 } }
  const scorer = strategyScorer(strategy, [])
  const one = row('One', ['HEAD'], { HASTE: 40 })
  const two = row('Two', ['CHEST'], { HASTE: 20 })
  const score = (r: GearRow): number => scorer(r.stats)
  const haste = (r: GearRow): number => scorer({ HASTE: r.stats.HASTE })
  assert.equal(buildScore(new Map([['HEAD', one], ['CHEST', two]]), strategyWeights(strategy, []), score, haste), 60)
})
