import test from 'node:test'
import assert from 'node:assert/strict'
import type { GearRow } from '../src/shared/planner/gear'
import { estimatedPlan } from '../src/shared/build/planSet'
import { itemScore } from '../src/shared/build/profiles'
import { loadBuildCandidates } from '../src/renderer/src/features/build/loadBuildCandidates'
import type { GearOwnershipMap } from '../src/renderer/src/features/gear/gearOwnership'
import { applyLoadoutChange, EMPTY_PLAN_ITEM, emptyLoadoutBook } from '../src/shared/loadouts'

function row(name: string, slots: GearRow['slots'], stats: GearRow['stats'], extra: Partial<GearRow> = {}): GearRow {
  return { key: name.toLowerCase(), name, searchKey: name.toLowerCase(), slots, classes: [], races: ['ALL'], flags: [],
    quest: false, playerCrafted: false, stats, effects: [], ...extra }
}
const mana = { classes: [] as const, intelligence: 150, wisdom: 150, manaWeight: 0 }
const weights = { AC: 1 }
const ctx = { classes: [] as const, weights, score: (item: GearRow) => itemScore(item.stats, weights) }
const ownership = (facts: { place: 'equipped' | 'keyring'; tier: number; count: number }[]): GearOwnershipMap =>
  new Map([['owned', { facts, exaltations: 0, owned: true, looted: false, lootedNotInDump: false }]])

test('optimal compares everything at +5 while owned preserves a better +8 copy', () => {
  const owned = row('Owned', ['HEAD'], { AC: 20 })
  const bis = row('Best', ['HEAD'], { AC: 22 })
  const map: GearOwnershipMap = new Map([...ownership([{ place: 'equipped', tier: 8, count: 1 }]),
    ['best', { facts: [{ place: 'keyring', tier: 0, count: 1 }], exaltations: 0, owned: true, looted: false, lootedNotInDump: false }]])
  const optimal = loadBuildCandidates([owned, bis], map, 'optimal', () => true)
  const current = loadBuildCandidates([owned, bis], map, 'owned', () => true)
  assert.deepEqual(optimal.map((item) => item.tier), [5, 5])
  const worn = new Map([['HEAD' as const, null]])
  assert.equal(estimatedPlan({ candidates: optimal, cells: ['HEAD'], worn, locked: new Set(), ctx, mana }).get('HEAD')?.row.name, 'Best')
  const picked = estimatedPlan({ candidates: current, cells: ['HEAD'], worn, locked: new Set(), ctx, mana }).get('HEAD')
  assert.equal(picked?.row.name, 'Owned')
  assert.equal(picked?.tier, 8)
})

test('best owned chooses the higher strategy score, not simply the higher tier', () => {
  const highTier = row('Owned', ['HEAD'], { AC: 20 })
  const strongerBase = row('Stronger', ['HEAD'], { AC: 30 })
  const high = ownership([{ place: 'keyring', tier: 8, count: 1 }])
  const both: GearOwnershipMap = new Map([...high, ['stronger', { facts: [{ place: 'keyring', tier: 1, count: 1 }],
    exaltations: 0, owned: true, looted: false, lootedNotInDump: false }]])
  const options = loadBuildCandidates([highTier, strongerBase], both, 'owned', () => true)
  const picked = estimatedPlan({ candidates: options, cells: ['HEAD'], worn: new Map(), locked: new Set(), ctx, mana }).get('HEAD')
  assert.equal(picked?.row.name, 'Stronger')
  assert.equal(picked?.tier, 5)
})

test('a plan uses no more owned copies than exist and preserves their separate tiers', () => {
  const ring = row('Owned', ['FINGER'], { AC: 10 })
  const map = ownership([{ place: 'equipped', tier: 8, count: 1 }, { place: 'keyring', tier: 3, count: 1 }])
  const candidates = loadBuildCandidates([ring], map, 'owned', () => true)
  const picked = estimatedPlan({ candidates, cells: ['FINGER', 'FINGER2', 'ANY1'], worn: new Map(), locked: new Set(), ctx, mana })
  const items = [...picked.values()].filter((item) => item !== null)
  assert.equal(items.length, 2)
  assert.deepEqual(items.map((item) => item?.tier).sort(), [5, 8])
  assert.equal(items.every((item) => item?.row.key === ring.key), true)
})

test('lore equipment is not duplicated even in a theoretical optimal set', () => {
  const ring = row('Lore Ring', ['FINGER'], { AC: 10 }, { flags: ['Lore Equipped'] })
  const candidates = loadBuildCandidates([ring], null, 'optimal', () => true)
  const result = estimatedPlan({ candidates, cells: ['FINGER', 'FINGER2'], worn: new Map(), locked: new Set(), ctx, mana })
  assert.equal([...result.values()].filter(Boolean).length, 1)
})

test('when lore copies differ, selection keeps the higher score rather than assuming a higher tier wins', () => {
  const lowerScore = row('Lore Ring', ['FINGER'], { AC: 5 }, { flags: ['Lore Equipped'] })
  const higherScore = row('Lore Ring', ['FINGER'], { AC: 15 }, { flags: ['Lore Equipped'] })
  const result = estimatedPlan({ candidates: [{ row: lowerScore, tier: 8, count: 1 }, { row: higherScore, tier: 5, count: 1 }],
    cells: ['FINGER', 'FINGER2'], worn: new Map(), locked: new Set(), ctx, mana })
  const items = [...result.values()].filter(Boolean)
  assert.equal(items.length, 1)
  assert.equal(items[0]?.tier, 5)
})

test('a two-handed primary cannot be paired with a secondary item', () => {
  const twoHand = row('Two hand', ['PRIMARY'], { AC: 100 }, { skill: '2H Slashing' })
  const oneHand = row('One hand', ['PRIMARY'], { AC: 20 }, { skill: '1H Slashing' })
  const shield = row('Shield', ['SECONDARY'], { AC: 10 })
  const candidates = [twoHand, oneHand, shield].map((item) => ({ row: item, tier: 5, count: 1 }))
  const result = estimatedPlan({ candidates, cells: ['PRIMARY', 'SECONDARY'], worn: new Map(), locked: new Set(), ctx, mana })
  assert.equal(result.get('PRIMARY')?.row.name, 'Two hand')
  assert.equal(result.get('SECONDARY'), null)
})

test('unknown worn cells stay untouched and deliberate empty cells survive loadout storage', () => {
  const result = estimatedPlan({ candidates: [{ row: row('Hat', ['HEAD'], { AC: 20 }), tier: 5, count: 1 }], cells: ['HEAD'], worn: new Map(), locked: new Set(['HEAD']), ctx, mana })
  assert.equal(result.has('HEAD'), false)
  const book = applyLoadoutChange(emptyLoadoutBook(), { kind: 'plan', id: 'lo1', plan: { SECONDARY: { key: EMPTY_PLAN_ITEM, tier: 0 } } })
  assert.equal(book.loadouts[0].plan.SECONDARY?.key, EMPTY_PLAN_ITEM)
})

test('estimated mana is considered when choosing an item', () => {
  const intelligent = row('Intelligence', ['HEAD'], { INT: 10 })
  const raw = row('Mana', ['HEAD'], { MP: 50 })
  const mpWeights = { MP: 1 }
  const plan = estimatedPlan({ candidates: [intelligent, raw].map((item) => ({ row: item, tier: 5, count: 1 })), cells: ['HEAD'], worn: new Map(), locked: new Set(),
    ctx: { classes: ['WIZ', 'ENC'], weights: mpWeights, score: (item) => itemScore(item.stats, mpWeights) },
    mana: { classes: ['WIZ', 'ENC'], intelligence: 150, wisdom: 150, manaWeight: 1 } })
  assert.equal(plan.get('HEAD')?.row.name, 'Intelligence')
})

test('the plan also honors strategy weights without a custom scorer', () => {
  const weak = row('Weak', ['HEAD'], { AC: 1 })
  const strong = row('Strong', ['HEAD'], { AC: 10 })
  const plan = estimatedPlan({ candidates: [weak, strong].map((item) => ({ row: item, tier: 5, count: 1 })),
    cells: ['HEAD'], worn: new Map(), locked: new Set(), ctx: { classes: [], weights }, mana })
  assert.equal(plan.get('HEAD')?.row.name, 'Strong')
})
