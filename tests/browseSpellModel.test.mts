import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SpellModifierCatalog } from '../src/shared/clientSpellModifiers'
import { currentBrowseRank, resolveBrowseRank } from '../src/shared/browseSpellRank'
import { spellBrowseEffectSlots, spellBrowseEffectText } from '../src/shared/spellBrowseEffects'
import { definitiveSpellEra, spellEraAdmits } from '../src/shared/spellBrowseEra'
import { minimumSpellLevel } from '../src/shared/clientSpellBrowse'
import { matchesSpellSearch, spellSearchOptions } from '../src/main/spellLibrary/browseQuery'
import { spellEraLabel } from '../src/main/spellLibrary/spellBrowseEraTable'
import { SpellQueryCache } from '../src/main/spellLibrary/queryCache'
import { SpellLibraryQueries } from '../src/main/spellLibrary/queries'
import { validateModifierPreferences } from '../src/main/spellLibrary/modifierValidation'
import { defaultSpellModifierPreferences, withBrowsePreferences, type SpellModifierContext } from '../src/shared/spellModifiers'
import { selectSpellPreviewRank } from '../src/shared/spellPreviewControls'
import type { SpellComparisonResult, SpellDetailResult, SpellSearchResult } from '../src/shared/spellLibrary'
import { effect, modifierContext, modifierSpell } from './helpers/spellModifierFixtures.mts'
import { spellRow, storageFixture, syntheticCatalog } from './spellLibrarySynthetic.mts'

function context(changes: Partial<SpellModifierContext> = {}): SpellModifierContext {
  const base = modifierContext({ ranks: {
    'synthetic bolt': { name: 'Synthetic Bolt', rank: 9 },
    'synthetic ember': { name: 'Synthetic Ember', rank: 1 }
  } })
  base.preferences = {
    ...defaultSpellModifierPreferences(),
    mode: 'client',
    emulation: { rank: 0, ranks: { 1: { name: 'Synthetic Bolt', rank: 4 } }, focus: 'none', focusIds: [] },
    browse: { rank: 8, useMyRanks: true }
  }
  return { ...base, ...changes, preferences: changes.preferences ?? base.preferences, ranks: changes.ranks ?? base.ranks }
}

test('browse rank is override, then observed II–X, then global I–X, then baseline I', () => {
  const bolt = modifierSpell(), ember = modifierSpell({ id: 2, name: 'Synthetic Ember' }), other = modifierSpell({ id: 3, name: 'Synthetic Other' })
  const catalog = new SpellModifierCatalog([bolt, ember, other])
  const prefs = context()
  prefs.preferences = { ...prefs.preferences, emulation: { ...prefs.preferences.emulation, ranks: { [bolt.id]: { name: bolt.name, rank: 4 } } } }
  assert.deepEqual(resolveBrowseRank(bolt, prefs, catalog), { rank: 4, source: 'override', label: 'IV', owned: false })
  assert.equal(resolveBrowseRank(ember, prefs, catalog).source, 'global', 'observed I is not ownership')
  assert.equal(resolveBrowseRank(other, prefs, catalog).rank, 8)
  prefs.preferences.browse = { rank: 8, useMyRanks: false }
  assert.equal(resolveBrowseRank(ember, prefs, catalog).source, 'global')
  prefs.preferences.browse = { useMyRanks: false }
  prefs.preferences.emulation.ranks['2'] = { name: ember.name, rank: 0 }
  const baseline = resolveBrowseRank(ember, prefs, catalog)
  assert.equal(baseline.source, 'baseline')
  assert.equal(baseline.owned, false)
  assert.equal(baseline.rank, 1)
  const internal = modifierSpell({ id: 4, classes: [] })
  assert.equal(resolveBrowseRank(internal, prefs, catalog).source, 'baseline')
  const duplicate = modifierSpell({ id: 5 })
  const crowded = new SpellModifierCatalog([bolt, duplicate])
  assert.equal(resolveBrowseRank(bolt, { ...prefs, preferences: { ...prefs.preferences, emulation: { ...prefs.preferences.emulation, ranks: {} }, browse: { useMyRanks: true } } }, crowded).owned, false)
})

test('slider migration keeps overrides and does not treat rank 0 as a browse rank', () => {
  const old = defaultSpellModifierPreferences()
  assert.deepEqual(validateModifierPreferences(old), old)
  const positive = withBrowsePreferences({ ...old, mode: 'emulate', emulation: { ...old.emulation, rank: 6, ranks: { 9: { name: 'Keep', rank: 3 } } } })
  assert.equal(positive.browse?.rank, 6)
  assert.deepEqual(positive.emulation.ranks, { 9: { name: 'Keep', rank: 3 } })
  assert.equal(withBrowsePreferences({ ...old, emulation: { ...old.emulation, rank: 0 } }).browse, undefined)
  assert.equal(withBrowsePreferences({ ...old, mode: 'mine' }).browse?.useMyRanks, true)
  assert.throws(() => validateModifierPreferences({ ...old, browse: { rank: 0 } }))
  const saved = validateModifierPreferences({ ...positive, browse: { rank: 3, useMyRanks: false } })
  assert.equal(selectSpellPreviewRank(saved, 7).browse?.rank, 7)
  assert.deepEqual(selectSpellPreviewRank(saved, 7).emulation.ranks, positive.emulation.ranks)
  assert.equal(selectSpellPreviewRank(saved, 7).browse?.useMyRanks, false)
})

test('era filters keep unknown explicit and do not invent Classic from silence', () => {
  assert.equal(definitiveSpellEra('Classic'), 'classic')
  assert.equal(definitiveSpellEra('Kunark'), 'kunark')
  assert.equal(definitiveSpellEra('Epics'), 'kunark')
  assert.equal(definitiveSpellEra('Velious'), 'later')
  assert.equal(definitiveSpellEra('Unknown'), null)
  assert.equal(definitiveSpellEra('FearHateRevamp'), 'later')
  assert.equal(spellEraAdmits('classic', 'current'), true)
  assert.equal(spellEraAdmits('kunark', 'current'), false)
  assert.equal(spellEraAdmits('kunark', 'preview'), true)
  assert.equal(spellEraAdmits('later', 'preview'), false)
  assert.equal(spellEraAdmits('unknown', 'unknown'), true)
  assert.equal(spellEraAdmits('unknown', 'current'), true)
  assert.equal(spellEraAdmits('unknown', 'preview'), true)
  assert.equal(spellEraAdmits('later', 'current'), false)
  assert.equal(spellEraLabel('Leach'), 'classic')
  assert.equal(spellEraLabel('Boltran\'s Agacerie'), 'kunark')
  assert.equal(spellEraLabel('Synthetic Bolt'), 'unknown')
})

test('a learned level of 0 is only an explicit class row', () => {
  const record = modifierSpell()
  assert.equal(minimumSpellLevel([], []), null)
  assert.equal(minimumSpellLevel([{ code: 'WIZ', level: 0 }], []), 0)
  const options = spellSearchOptions({ minLevel: 0, maxLevel: 0 })
  assert.equal(matchesSpellSearch({ ...record, classes: [] }, options), false)
  assert.equal(matchesSpellSearch({ ...record, classes: [{ code: 'WIZ', level: 0 }] }, options), true)
  assert.equal(matchesSpellSearch(record, options), false)
  assert.throws(() => spellSearchOptions({ level: 0 }), /Invalid level/)
})

test('browse effects keep every slot and rank only supported HP amounts', () => {
  const record = modifierSpell({ effects: [effect(0, -100), { slot: 2, spa: 3, base: 5, limit: 0, calc: 999, max: 0 }] })
  const slots = spellBrowseEffectSlots(record, 50, 4)
  assert.deepEqual(slots.map((slot) => slot.slot), [1, 2])
  assert.equal(slots[0].name, 'Health change')
  assert.equal(slots[0].timing, 'instant')
  assert.equal(slots[0].amount, 124)
  assert.equal(slots[1].timing, 'raw')
  assert.equal(slots[1].amount, null)
  assert.match(spellBrowseEffectText(slots[0]), /SPA 0 · Health change: −124|SPA 0 · Health change: -124|−124|124/)
  assert.match(spellBrowseEffectText(slots[1]), /raw 5/)
  assert.match(slots[1].formula ?? '', /999/)
  assert.deepEqual(slots[1].raw, { base: 5, limit: 0, calc: 999, max: 0 })
})

test('search, compare, and detail share browse rank and the cache key hears rank, caster, and source', () => {
  const fixture = storageFixture()
  try {
    const rows = [spellRow(1, 'Synthetic Bolt'), spellRow(2, 'Synthetic Ember'), spellRow(3, 'Synthetic Other')]
    const published = fixture.storage.publish({ root: fixture.root, reason: 'startup', parserVersion: '1', ...syntheticCatalog(rows) })
    const queries = new SpellLibraryQueries(fixture.storage)
    const modifiers = context()
    const evaluation = { mode: 'client' as const, contextRevision: modifiers.revision, classes: ['WIZ' as const], rankOnly: true }
    const read = <T>(method: string, query: Record<string, unknown>, facts = modifiers): T => queries.handle(method, {
      installId: published.dataset.installId, query: { level: 50, browseRank: true, evaluation, ...query }, modifiers: facts
    }) as T
    const search = read<SpellSearchResult>('search', { allSpells: true, pageSize: 10 })
    const byName = Object.fromEntries(search.records.map((row) => [row.name, row]))
    assert.equal(byName['Synthetic Bolt'].calculations?.[0].total, 124)
    assert.equal(byName['Synthetic Bolt'].browseRank?.source, 'override')
    assert.equal(byName['Synthetic Bolt'].calculations?.[0].modifiers?.resolvedRank?.rank, 4)
    assert.equal(byName['Synthetic Ember'].calculations?.[0].total, 148)
    assert.equal(byName['Synthetic Ember'].browseRank?.owned, false)
    assert.equal(byName['Synthetic Other'].browseRank?.label, 'VIII')
  } finally { fixture.close() }
})

test('detail and compare use the same browse rank as search', () => {
  const fixture = storageFixture()
  try {
    const rows = [spellRow(1, 'Synthetic Bolt'), spellRow(2, 'Synthetic Ember'), spellRow(3, 'Synthetic Other')]
    const published = fixture.storage.publish({ root: fixture.root, reason: 'startup', parserVersion: '1', ...syntheticCatalog(rows) })
    const queries = new SpellLibraryQueries(fixture.storage)
    const modifiers = context()
    const evaluation = { mode: 'client' as const, contextRevision: modifiers.revision, classes: ['WIZ' as const], rankOnly: true }
    const read = <T>(method: string, query: Record<string, unknown>): T => queries.handle(method, {
      installId: published.dataset.installId, query: { level: 50, browseRank: true, evaluation, ...query }, modifiers
    }) as T
    const detail = read<SpellDetailResult>('detail', { id: 1 })
    const compare = read<SpellComparisonResult>('compare', { ids: [1, 2, 3], metric: 'damage' })
    assert.equal(detail.calculations?.[0].total, 124)
    assert.equal(detail.browseRank?.label, 'IV')
    assert.deepEqual(compare.results.map((row) => row.total), [124, 148, 148])
    assert.equal(compare.browseRank?.['2']?.source, 'global')
  } finally { fixture.close() }
})

function assertHonestEffectSlots(slots: NonNullable<SpellSearchResult['records'][number]['effects']>): void {
  assert.equal(slots[0].timing, 'instant')
  assert.equal(slots[0].amount, 124)
  const reference = slots.find((slot) => slot.spa === 85)
  const resist = slots.find((slot) => slot.spa === 46)
  const flag = slots.find((slot) => slot.spa === 12)
  assert.equal(reference?.timing, 'raw')
  assert.equal(reference?.amount, null)
  assert.match(reference?.formula ?? '', /reference/)
  assert.equal(reference ? spellBrowseEffectText(reference) : '', 'SPA 85 · Weapon Proc: raw 400')
  assert.equal(resist?.timing, 'instant')
  assert.equal(resist?.amount, 15)
  assert.equal(flag?.timing, 'raw')
  assert.equal(flag?.amount, null)
  assert.match(flag?.formula ?? '', /Flag/)
}

test('browse rank changes, era admission, and effect slots stay on the shared query path', () => {
  const fixture = storageFixture()
  try {
    const bolt = spellRow(1, 'Synthetic Bolt')
    bolt[172] = `${bolt[172]}$2|85|400|0|100|0$3|46|15|0|100|0$4|12|1|0|100|0`
    const rows = [bolt, spellRow(2, 'Synthetic Ember'), spellRow(3, 'Synthetic Other')]
    const published = fixture.storage.publish({ root: fixture.root, reason: 'startup', parserVersion: '1', ...syntheticCatalog(rows) })
    const queries = new SpellLibraryQueries(fixture.storage)
    const modifiers = context()
    const evaluation = { mode: 'client' as const, contextRevision: modifiers.revision, classes: ['WIZ' as const], rankOnly: true }
    const read = <T>(method: string, query: Record<string, unknown>, facts = modifiers): T => queries.handle(method, {
      installId: published.dataset.installId, query: { level: 50, browseRank: true, evaluation, ...query }, modifiers: facts
    }) as T
    const search = read<SpellSearchResult>('search', { allSpells: true, pageSize: 10 })
    const byName = Object.fromEntries(search.records.map((row) => [row.name, row]))
    const mineOff = context()
    mineOff.preferences = { ...mineOff.preferences, browse: { rank: 8, useMyRanks: false } }
    assert.equal(read<SpellDetailResult>('detail', { id: 1 }, mineOff).calculations?.[0].total, 124)
    const lower = context()
    lower.preferences = { ...lower.preferences, browse: { rank: 3, useMyRanks: false } }
    assert.notEqual(read<SpellSearchResult>('search', { text: 'Synthetic Other' }, lower).records[0].calculations?.[0].total, 148)
    const cache = new SpellQueryCache()
    const source = { character: { key: 'char' }, ranks: modifiers.ranks, preferences: modifiers.preferences }
    assert.notEqual(cache.key('search', { query: { level: 50 }, context: source }), cache.key('search', { query: { level: 51 }, context: source }))
    assert.notEqual(cache.key('search', { query: { level: 50 }, context: source }), cache.key('search', { query: { level: 50 }, context: { ...source, preferences: lower.preferences } }))
    assert.notEqual(cache.key('search', { query: { level: 50 }, context: source }), cache.key('search', { query: { level: 50 }, context: { ...source, character: { key: 'other' } } }))
    const guard = byName['Synthetic Other'].browseRank!
    assert.equal(currentBrowseRank(guard, { characterKey: guard.characterKey, revision: guard.contextRevision, snapshotId: guard.snapshotId }), true)
    assert.equal(currentBrowseRank(guard, { characterKey: 'other', revision: guard.contextRevision, snapshotId: guard.snapshotId }), false)
    const none = context({ character: null })
    const open = read<SpellSearchResult>('search', { text: 'Synthetic Other', pageSize: 1 }, none)
    const openRank = open.records[0].browseRank!
    assert.equal(openRank.characterKey, '')
    assert.equal(openRank.source, 'global')
    assert.equal(currentBrowseRank(openRank, { characterKey: '', revision: openRank.contextRevision, snapshotId: openRank.snapshotId }), true)
    assert.equal(currentBrowseRank(openRank, { characterKey: 'char', revision: openRank.contextRevision, snapshotId: openRank.snapshotId }), false)
    assert.equal(currentBrowseRank(guard, { characterKey: '', revision: guard.contextRevision, snapshotId: guard.snapshotId }), false)
    const before = JSON.stringify(modifiers.preferences)
    const filtered = read<SpellSearchResult>('search', { era: 'current', pageSize: 5 })
    assert.equal(filtered.total, 3)
    assert.ok(filtered.records.every((row) => row.era === 'unknown'))
    assert.ok((filtered.categories ?? []).length > 0)
    assert.equal(read<SpellSearchResult>('search', { era: 'unknown', allSpells: true, pageSize: 10 }).total, 3)
    assert.equal(JSON.stringify(modifiers.preferences), before)
    assert.throws(() => read<SpellSearchResult>('search', { includeEffects: true, level: 0 }), /Invalid level/)
    const effects = read<SpellSearchResult>('search', { text: 'Synthetic Bolt', includeEffects: true, pageSize: 1 })
    assertHonestEffectSlots(effects.records[0].effects ?? [])
    assert.throws(() => read<SpellSearchResult>('search', { sortBy: 'spa' }), /Invalid sort column/)
  } finally { fixture.close() }
})
