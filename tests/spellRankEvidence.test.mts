import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SpellLibraryQueries } from '../src/main/spellLibrary/queries'
import { defaultSpellModifierPreferences, type SpellModifierContext } from '../src/shared/spellModifiers'
import type { SpellComparisonResult, SpellDetailResult, SpellSearchResult } from '../src/shared/spellLibrary'
import type { SpellByLevelResult, SpellRankingsResult } from '../src/shared/spellAnalysis'
import { currentSpellRankEvidence, previewSpellMote, spellMoteOverride } from '../src/shared/spellRankPreviews'
import { spellRow, storageFixture, syntheticCatalog } from './spellLibrarySynthetic.mts'

function setup() {
  const storage = storageFixture()
  const rows = ['Synthetic Ember', 'Synthetic Unknown', 'Synthetic Duplicate', 'Synthetic Duplicate', 'Synthetic Classic II'].map((name, i) => spellRow(i + 1, name))
  rows[3][47] = '255'
  const published = storage.storage.publish({ root: storage.root, reason: 'startup', parserVersion: '1', ...syntheticCatalog(rows) })
  const queries = new SpellLibraryQueries(storage.storage)
  const context: SpellModifierContext = { revision: 'character-a-ranks', modelVersion: '3', character: { key: 'character-a', name: 'A', server: 'test' },
    preferences: { ...defaultSpellModifierPreferences(), mode: 'emulate', emulation: { rank: 10, ranks: { 1: { name: 'Synthetic Ember', rank: 5 } }, focus: 'none', focusIds: [] } },
    ranks: { 'synthetic ember': { name: 'Synthetic Ember', rank: 7 }, 'synthetic duplicate': { name: 'Synthetic Duplicate', rank: 9 }, 'synthetic classic': { name: 'Synthetic Classic', rank: 2 } },
    inventory: { state: 'ready', exportedAt: null, candidates: [], warnings: [] }, warnings: [] }
  return { ...storage, context, dataset: published.dataset, read<T>(method: string, input = {}, facts = context): T {
    const query = { level: 50, evaluation: { mode: facts.preferences.mode, contextRevision: facts.revision, classes: ['WIZ'] }, ...input }
    return queries.handle(method, { installId: published.dataset.installId, query, modifiers: facts }) as T
  } }
}

test('all library views carry observed evidence independently of simulated group and exact ranks', () => {
  const f = setup()
  try {
    const search = f.read<SpellSearchResult>('search', { allSpells: true })
    const known = search.records.find((r) => r.id === 1)!
    assert.equal(known.rankEvidence?.rank, 7)
    assert.equal(known.calculations?.[0].modifiers?.rank, 5)
    for (const id of [2, 3, 4, 5]) assert.equal(search.records.find((r) => r.id === id)?.rankEvidence, null)
    const detail = f.read<SpellDetailResult>('detail', { id: 1 })
    const compare = f.read<SpellComparisonResult>('compare', { ids: [1, 2], metric: 'damage' })
    const rankings = f.read<SpellRankingsResult>('rankings', { classes: ['WIZ'], categoryTab: 'dd', analysis: { scope: 'single', targets: 4 } })
    const levels = f.read<SpellByLevelResult>('byLevel', { level: 1, view: 'at', classes: ['WIZ'] })
    assert.deepEqual(detail.rankEvidence, known.rankEvidence)
    assert.deepEqual(compare.rankEvidence?.['1'], known.rankEvidence)
    assert.deepEqual(rankings.records.find((r) => r.id === 1)?.rankEvidence, known.rankEvidence)
    assert.deepEqual(levels.records.find((r) => r.id === 1)?.rankEvidence, known.rankEvidence)
    assert.equal(known.rankEvidence?.snapshotId, f.dataset.snapshotId)
    assert.equal(f.storage.observations(f.dataset.installId).total, 1)
  } finally { f.close() }
})

test('client mode retains observed badges, missing inputs and characterless sessions cannot claim evidence', () => {
  const f = setup()
  try {
    f.context.preferences.mode = 'client'
    assert.equal(f.read<SpellDetailResult>('detail', { id: 1 }).rankEvidence?.rank, 7)
    for (const facts of [{ ...f.context, ranks: null }, { ...f.context, character: null }]) {
      assert.equal(f.read<SpellDetailResult>('detail', { id: 1 }, facts).rankEvidence, null)
    }
    const switched = { ...f.context, revision: 'character-b', character: { key: 'b', name: 'B', server: 'other' }, ranks: {} }
    assert.equal(f.read<SpellDetailResult>('detail', { id: 1 }, switched).rankEvidence, null)
  } finally { f.close() }
})

test('badge guards reject retained character, context and snapshot replies and avoid invented Base/I ownership', () => {
  const evidence = { rank: 7, characterKey: 'a', contextRevision: 'r', snapshotId: 's' }
  const current = { characterKey: 'a', revision: 'r', snapshotId: 's' }
  assert.equal(currentSpellRankEvidence(evidence, current), true)
  for (const changed of [{ ...current, characterKey: 'b' }, { ...current, revision: 'later' }, { ...current, snapshotId: 'new' }]) {
    assert.equal(currentSpellRankEvidence(evidence, changed), false)
  }
  for (const rank of [0, 1, 11, 2.5]) assert.equal(currentSpellRankEvidence({ ...evidence, rank }, current), false)
  assert.equal(currentSpellRankEvidence(null, current), false)
})

test('exact mote previews retain lower ranks and zero, isolate records, and reject stale names', () => {
  const defaults = defaultSpellModifierPreferences(), spell = { id: 1, name: 'Synthetic Ember' }
  const before = JSON.stringify(defaults)
  const zero = previewSpellMote(defaults, spell, 0)
  assert.equal(spellMoteOverride(zero, spell), 0)
  const lower = previewSpellMote({ ...zero, emulation: { ...zero.emulation, rank: 10 } }, spell, 5)
  assert.equal(lower.mode, 'emulate'); assert.equal(lower.emulation.rank, 10)
  assert.equal(spellMoteOverride(lower, spell), 5)
  assert.equal(spellMoteOverride(lower, { ...spell, name: 'Changed name' }), null)
  assert.equal(spellMoteOverride(lower, { ...spell, id: 2 }), null)
  assert.equal(spellMoteOverride(previewSpellMote(lower, spell, null), spell), null)
  assert.equal(JSON.stringify(defaults), before)
})
