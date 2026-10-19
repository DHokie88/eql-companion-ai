import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SpellLibraryQueries } from '../src/main/spellLibrary/queries'
import { clientSpellType, compareSpellValues, minimumSpellLevel, sortSpellCalculations } from '../src/shared/clientSpellBrowse'
import { SPELL_BROWSE_SORTS, type SpellSearchQuery, type SpellSearchResult } from '../src/shared/spellLibrary'
import { spellRow, storageFixture, syntheticCatalog } from './spellLibrarySynthetic.mts'

function fixture(rows: string[][]) {
  const f = storageFixture()
  const published = f.storage.publish({ root: f.root, reason: 'startup', parserVersion: '1', ...syntheticCatalog(rows) })
  const queries = new SpellLibraryQueries(f.storage)
  return { ...f, search(query: SpellSearchQuery = {}) {
    return queries.handle('search', { installId: published.dataset.installId, query }) as SpellSearchResult
  } }
}
function ids(result: SpellSearchResult): number[] { return result.records.map((r) => r.id) }

test('Browse sorts the entire filtered catalog before pagination, with deterministic ID ties', () => {
  const f = fixture(Array.from({ length: 50 }, (_, index) => spellRow(index + 1, `Bolt ${50 - index}`, index + 1, (index + 1) * 10)))
  try {
    assert.deepEqual(ids(f.search({ sortBy: 'name', pageSize: 2 })), [50, 49])
    assert.deepEqual(ids(f.search({ sortBy: 'name', page: 2, pageSize: 2 })), [48, 47])
    assert.deepEqual(ids(f.search({ sortBy: 'mana', direction: 'desc', pageSize: 2 })), [50, 49])
    assert.deepEqual(ids(f.search({ sortBy: 'amount', direction: 'desc', level: 50, pageSize: 2 })), [50, 49])
    assert.deepEqual(ids(f.search({ sortBy: 'efficiency', direction: 'desc', level: 50, pageSize: 2 })), [1, 2])
    assert.deepEqual(ids(f.search({ sortBy: 'selected', direction: 'desc', selectedIds: [50, 41], pageSize: 3 })), [41, 50, 1])
    for (const sortBy of SPELL_BROWSE_SORTS) {
      const result = f.search({ sortBy, direction: 'asc', level: 50, pageSize: 3 })
      assert.equal(result.total, 50); assert.equal(result.records.length, 3)
    }
  } finally { f.close() }
})

test('level bounds use earliest eligible class level and remain independent of calculation level', () => {
  const dual = spellRow(1, 'Dual'); dual[37] = '1'; dual[47] = '15'
  const high = spellRow(2, 'High'); high[47] = '40'
  const npc = spellRow(3, 'Internal'); npc[47] = '255'
  const f = fixture([dual, high, npc])
  try {
    assert.deepEqual(ids(f.search()), [1, 2, 3], 'legacy unfiltered searches retain internal records')
    assert.deepEqual(ids(f.search({ classes: ['CLR', 'WIZ'], minLevel: 10, maxLevel: 40, level: 50 })), [2])
    assert.deepEqual(ids(f.search({ classes: ['WIZ'], minLevel: 10, maxLevel: 15, level: 50 })), [1])
    assert.equal(f.search({ classes: ['CLR', 'WIZ'], level: 50 }).records[0].learnedLevel, 1)
    assert.deepEqual(ids(f.search({ classes: ['WIZ'], level: 10, maxLevel: 40, allLevels: true })), [1, 2])
    assert.deepEqual(ids(f.search({ allSpells: true, minLevel: 1, maxLevel: 255 })), [1, 2])
    assert.deepEqual(ids(f.search({ level: 10, allSpells: true })), [1, 2, 3])
    assert.deepEqual(ids(f.search({ level: 10 })), [1], 'legacy caster-level ceiling remains supported')
    assert.equal(minimumSpellLevel([{ code: 'WIZ', level: 15 }], ['CLR']), null)
  } finally { f.close() }
})

test('Browse offers Leveling-style types plus combined category, subcategory, SPA, polarity and mana filters', () => {
  const dd = spellRow(1, 'Bolt', 10), dot = spellRow(2, 'Burn', 20), ae = spellRow(3, 'Blast', 30)
  const heal = spellRow(4, 'Heal', 0), hot = spellRow(5, 'Mend', 10), buff = spellRow(6, 'Ward', 5)
  dot[11] = '5'; ae[30] = '8'; heal[28] = '1'; heal[172] = '1|0|100|0|100|0'; hot[28] = '1'; hot[172] = '1|100|10|0|100|0'
  buff[28] = '1'; buff[172] = '1|1|10|0|100|0'; buff[86] = '0'; buff[87] = '0'
  const f = fixture([dd, dot, ae, heal, hot, buff])
  try {
    assert.deepEqual(ids(f.search({ type: 'dd' })), [1, 3])
    assert.deepEqual(ids(f.search({ type: 'dot' })), [2])
    assert.deepEqual(ids(f.search({ type: 'aoe' })), [3])
    assert.deepEqual(ids(f.search({ type: 'heal', polarity: 'beneficial', mana: 'free', category: 'Damage', subcategory: 'Direct', effect: 0 })), [4])
    assert.deepEqual(ids(f.search({ type: 'hot' })), [5])
    assert.deepEqual(ids(f.search({ type: 'other' })), [6])
    assert.deepEqual(ids(f.search({ polarity: 'detrimental', mana: 'cost' })), [1, 2, 3])
    assert.deepEqual(f.search().subcategories, ['Direct'])
    assert.deepEqual(f.search({ category: 'Missing' }).subcategories, [])
    const periodicArea = syntheticCatalog([dot]).records[0]; periodicArea.target = 8
    assert.equal(clientSpellType(periodicArea), 'dot')
  } finally { f.close() }
})

test('unknown levels and unsupported amounts sort last in both directions; zero mana stays outside efficiency', () => {
  const known = spellRow(1), unsupported = spellRow(2), internal = spellRow(3)
  unsupported[172] = '1|0|-100|0|999|0'; internal[47] = '255'
  const zero = spellRow(4, 'Free', 0)
  const f = fixture([known, unsupported, internal, zero])
  try {
    for (const direction of ['asc', 'desc'] as const) {
      assert.equal(f.search({ sortBy: 'level', direction }).records.at(-1)?.id, 3)
      assert.equal(f.search({ sortBy: 'amount', direction, level: 50, allSpells: true }).records.at(-1)?.id, 2)
      assert.deepEqual(ids(f.search({ sortBy: 'efficiency', direction, level: 50, allSpells: true })), [1, 3, 2, 4])
      assert.ok(compareSpellValues(null, 100, direction) > 0)
    }
    const calculations = f.search({ level: 50, allSpells: true, sortBy: 'amount' }).records.flatMap((r) => r.calculations ?? [])
    assert.deepEqual(sortSpellCalculations(calculations, 'total', 'desc').map((r) => r.id), [1, 3, 4, 2])
    assert.equal(calculations.at(-1)?.id, 2, 'presentation sorting does not mutate the supplied group')
  } finally { f.close() }
})

test('invalid filters and arbitrary sort keys are rejected before scanning', () => {
  const f = fixture([spellRow()])
  try {
    for (const query of [{ minLevel: 20, maxLevel: 10 }, { minLevel: 0 }, { maxLevel: 1.5 }, { allLevels: 'yes' },
      { type: 'sql' }, { polarity: 'all' }, { mana: 'negative' }, { sortBy: 'rawFields' }, { direction: 'sideways' },
      { selectedIds: [1, 2, 3, 4, 5] }, { selectedIds: [-1] }, { effect: -1 }]) {
      assert.throws(() => f.search(query as SpellSearchQuery), /Invalid|must not exceed/)
    }
  } finally { f.close() }
})


function areaRow(id: number, name: string, cap: number, repeats = false): string[] {
  const row = spellRow(id, name)
  row[30] = '8'; row[143] = String(cap); row[13] = repeats ? '7500' : '0'
  return row
}

test('Browse classifies snapshot-bound rains separately from ordinary area caps across the complete catalog', () => {
  const periodic = areaRow(7, 'Area Burn', 4); periodic[11] = '5'
  const f = fixture([areaRow(1, 'Frost Storm', 4, true), areaRow(2, 'Four Target Blast', 4),
    areaRow(3, 'Eight Target Blast', 8), areaRow(4, 'Unknown Cap Blast', 0),
    areaRow(5, 'Unverified Waves', 4, true), spellRow(6, 'Single Bolt'), periodic])
  try {
    assert.deepEqual(f.search().records.map((r) => r.spellType), ['rain', 'aoe4', 'aoe8', 'aoe', 'aoe', 'dd', 'dot'])
    assert.deepEqual(ids(f.search({ type: 'rain', pageSize: 1 })), [1])
    assert.deepEqual(ids(f.search({ type: 'aoe4', pageSize: 1 })), [2])
    assert.deepEqual(ids(f.search({ type: 'aoe8', pageSize: 1 })), [3])
    assert.deepEqual(ids(f.search({ type: 'dd' })), [1, 2, 3, 4, 5, 6], 'DD remains the broad instant-damage filter')
    assert.deepEqual(ids(f.search({ type: 'aoe' })), [1, 2, 3, 4, 5, 7], 'AOE includes periodic damage as well as all direct area types')
    const legacy = f.search({ type: 'rain', level: 50, sortBy: 'amount' }).records[0]
    assert.equal(legacy.calculations?.[0].analysis, undefined, 'classification does not opt legacy callers into wave calculations')
  } finally { f.close() }
})

test('rain filters never promote duplicate-compatible or incompatible researched records by name alone', () => {
  const incompatible = areaRow(3, 'Lava Storm', 4, true); incompatible[13] = '5000'
  const f = fixture([areaRow(1, 'Frost Storm', 4, true), areaRow(2, 'Frost Storm', 4, true), incompatible])
  try {
    assert.deepEqual(ids(f.search({ type: 'rain' })), [])
    assert.deepEqual(f.search().records.map((r) => r.spellType), ['aoe', 'aoe', 'aoe'])
    assert.deepEqual(ids(f.search({ type: 'aoe4' })), [], 'an unverified repeating hit budget is not an ordinary four-target cap')
    assert.deepEqual(ids(f.search({ type: 'dd' })), [1, 2, 3])
    assert.deepEqual(ids(f.search({ type: 'aoe' })), [1, 2, 3])
  } finally { f.close() }
})

test('subcategory sorting covers all matches before pagination and keeps unknown values last', () => {
  const unknown = spellRow(1, 'No subcategory'); unknown[87] = '0'
  const f = fixture([unknown, spellRow(2, 'Known first'), spellRow(3, 'Known second')])
  try {
    for (const direction of ['asc', 'desc'] as const) {
      assert.deepEqual(ids(f.search({ sortBy: 'subcategory', direction, pageSize: 1 })), [2])
      assert.deepEqual(ids(f.search({ sortBy: 'subcategory', direction, page: 2, pageSize: 1 })), [3])
      assert.deepEqual(ids(f.search({ sortBy: 'subcategory', direction, page: 3, pageSize: 1 })), [1])
    }
  } finally { f.close() }
})


test('unified Browse groups and highlights scan the full filtered catalog without losing utility or internal records', () => {
  const efficient = spellRow(1, 'Efficient', 10, 100), large = spellRow(2, 'Large', 100, 300)
  const free = spellRow(3, 'Free', 0, 1000), unsupported = spellRow(4, 'Unknown Formula')
  const utility = spellRow(5, 'Mesmerize'), healing = spellRow(6, 'Mend', 10, 60), internal = spellRow(7, 'Internal', 10, 50)
  for (const row of [efficient, large, free, unsupported, utility, healing, internal]) row[8] = '1000'
  efficient[8] = '2000'; internal[8] = '2000'; internal[47] = '255'
  unsupported[172] = '1|0|-100|0|999|0'; utility[172] = '1|31|1|0|100|0'
  healing[28] = '1'; healing[172] = '1|0|60|0|100|0'
  const f = fixture([efficient, large, free, unsupported, utility, healing, internal])
  const query = { level: 50, allSpells: true, analysis: { scope: 'single', targets: 4 }, includeHighlights: true } as const
  try {
    const all = f.search(query)
    assert.equal(all.total, 7); assert.deepEqual(ids(all), [1, 2, 3, 4, 5, 6, 7])
    assert.deepEqual(all.groupCounts, { ranked: 3, zeroMana: 1, excluded: 3 })
    assert.deepEqual(all.highlights?.map((h) => [h.kind, h.record?.id]), [['efficiency', 1], ['amount', 3], ['rate', 3]])
    assert.deepEqual(ids(f.search({ ...query, group: 'ranked', sortBy: 'efficiency', direction: 'desc', pageSize: 1 })), [1])
    assert.deepEqual(ids(f.search({ ...query, group: 'ranked', sortBy: 'efficiency', direction: 'desc', page: 2, pageSize: 1 })), [7])
    const zero = f.search({ ...query, group: 'zero-mana' })
    assert.deepEqual(ids(zero), [3]); assert.equal(zero.records[0].calculations?.[0].perMana, null)
    assert.deepEqual(ids(f.search({ ...query, group: 'excluded' })), [4, 5, 6])
    assert.deepEqual(ids(f.search({ ...query, metric: 'healing', group: 'ranked' })), [6])
    const healingView = f.search({ ...query, metric: 'healing' })
    assert.equal(healingView.highlights?.[0].record?.id, 6)
    assert.equal(healingView.records[0].calculations?.[0].metric, 'healing')
    assert.equal(healingView.records[0].calculations?.[0].total, null, 'off-metric damage does not outrank healing results')
    const legacy = f.search()
    assert.equal(legacy.groupCounts, undefined); assert.equal(legacy.highlights, undefined)
    assert.equal(legacy.records[0].calculations, undefined, 'old searches do not silently opt into analysis')
  } finally { f.close() }
})

test('unified Browse sorts modeled rate across pages with unknown values last and captured utility timing retained', () => {
  const rows = Array.from({ length: 45 }, (_, i) => {
    const row = spellRow(i + 1, `Rate ${i + 1}`, 10, 10 + i); row[8] = '1000'; return row
  })
  const utility = spellRow(90, 'Utility'); utility[172] = '1|31|1|0|100|0'; utility[8] = '3500'
  const unknown = spellRow(91, 'Zero timing')
  const f = fixture([...rows, utility, unknown])
  const query = { level: 50, analysis: { scope: 'single', targets: 4 }, sortBy: 'rate', direction: 'desc', pageSize: 40 } as const
  try {
    assert.deepEqual(ids(f.search(query)).slice(0, 3), [45, 44, 43])
    assert.deepEqual(ids(f.search({ ...query, page: 2 })), [5, 4, 3, 2, 1, 90, 91])
    assert.deepEqual(ids(f.search({ ...query, direction: 'asc', page: 2 })).slice(-2), [90, 91])
    const timed = f.search({ ...query, sortBy: 'cast', direction: 'desc', pageSize: 1 })
    assert.deepEqual(ids(timed), [90]); assert.equal(timed.records[0].castMs, 3500)
  } finally { f.close() }
})

test('arbitrary captured area caps include utility delivery labels without inventing caps or rain eligibility', () => {
  const damage = areaRow(1, 'Twenty Target Blast', 20), mez = areaRow(2, 'Thirty Target Mez', 30)
  const unknown = areaRow(3, 'Unknown Target Mez', 0), repeated = areaRow(4, 'Unverified Repeat', 30, true)
  mez[172] = '1|31|1|0|100|0'; unknown[172] = mez[172]
  const f = fixture([damage, mez, unknown, repeated])
  try {
    const all = f.search()
    assert.deepEqual(all.records.map((r) => [r.spellType, r.typeLabel]), [['aoe20', 'AOE20'], ['other', 'AOE30'], ['other', 'AOE ?'], ['aoe', 'AOE ?']])
    assert.deepEqual(ids(f.search({ type: 'aoe20' })), [1])
    assert.deepEqual(ids(f.search({ type: 'aoe30' })), [2], 'an unverified repeated hit budget is never presented as an ordinary target cap')
    assert.deepEqual(ids(f.search({ type: 'other' })), [2, 3], 'delivery labels preserve the Buffs / utility kind')
    assert.ok(all.typeOptions?.some((option) => option.value === 'aoe30' && option.label === 'AOE30'))
    assert.deepEqual(ids(f.search({ type: 'dd' })), [1, 4])
    for (const type of ['aoe0', 'aoe-4', 'aoe1.5', 'aoe004', 'aoe2147483648']) assert.throws(() => f.search({ type } as SpellSearchQuery), /Invalid/)
    for (const query of [{ group: 'random' }, { metric: 'buff' }, { includeHighlights: 'yes' }]) assert.throws(() => f.search(query as SpellSearchQuery), /Invalid/)
  } finally { f.close() }
})
