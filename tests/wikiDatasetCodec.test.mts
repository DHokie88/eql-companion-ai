import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decodeWikiDataset, mergeWikiItems } from '../src/main/wikiDatasetCodec'
import type { ItemDbFile } from '../src/main/itemsDb'

const at = '2026-11-01T12:00:00Z'
const manifest = { version: 'test-v1', generatedAt: at, sha256: 'a'.repeat(64) }
const item = (overrides: Record<string, unknown> = {}) => ({
  name: 'Test Item', wikiTitle: 'Test Item', era: 'Classic', revisionId: 123,
  classes: ['PAL'], slots: ['CHEST'], iconId: 697,
  displayLines: ['MAGIC ITEM LORE ITEM', 'Slot: CHEST', 'AC: 12', 'HP: +40', 'Class: PAL'],
  ...overrides
})
const pack = (items: unknown[] = [item()]) => ({
  meta: { schemaVersion: 3, sample: false, generatedAt: at },
  zones: [{ name: 'Test Zone' }], npcs: [{ name: 'Test NPC' }], items
})

test('projects observed wiki stat lines with exact source/revision evidence', () => {
  const source = pack()
  const before = JSON.stringify(source)
  const got = decodeWikiDataset(source, manifest, at)
  const row = got.items['test item']
  assert.equal(row.stats?.ac, 12)
  assert.deepEqual(row.stats?.classes, ['PAL'])
  assert.equal(row.lore, true)
  assert.equal(row.iconId, 697)
  assert.equal(row.wikiDataset?.revisionId, 123)
  assert.equal(row.wikiDataset?.version, 'test-v1')
  assert.equal(got.npcCount, 1)
  assert.equal(JSON.stringify(source), before)
})

test('rejects sample, unsupported schemas, incomplete rows and unsafe item keys', () => {
  const invalid = [
    { ...pack(), meta: { schemaVersion: 3, sample: true, generatedAt: at } },
    { ...pack(), meta: { schemaVersion: 4, sample: false, generatedAt: at } },
    { ...pack(), meta: { schemaVersion: '3', sample: false, generatedAt: at } },
    pack([{ name: 'No page' }]),
    pack([item({ displayLines: 'HP: 1' })]),
    pack([item({ revisionId: -1 })]),
    pack([item({ classes: ['PAL', 5] })]),
    pack([item({ wikiTitle: '__proto__' })])
  ]
  for (const bad of invalid) assert.throws(() => decodeWikiDataset(bad, manifest, at))
  assert.throws(() => decodeWikiDataset(pack(), { ...manifest, sha256: 'broken' }, at))
  assert.throws(() => decodeWikiDataset(pack(), manifest, 'not-a-date'))
})

test('bounds row counts and stat-block input before creating a projection', () => {
  assert.throws(() => decodeWikiDataset(pack(Array(100_001).fill(null)), manifest, at))
  assert.throws(() => decodeWikiDataset(pack([item({ displayLines: Array(257).fill('HP: 1') })]), manifest, at))
})

test('does not turn an unknown era into Classic or filter later-era evidence', () => {
  const got = decodeWikiDataset(pack([
    item({ name: 'Unknown Item', wikiTitle: 'Unknown Item', era: undefined }),
    item({ name: 'Future Item', wikiTitle: 'Future Item', era: 'Velious' })
  ]), manifest, at)
  assert.equal(got.items['unknown item'].eraTag, 'Unknown')
  assert.equal(got.items['future item'].wikiDataset?.era, 'Velious')
})

test('exact page keys cannot be shadowed by an earlier row alias', () => {
  const got = decodeWikiDataset(pack([
    item({ name: 'Shared', wikiTitle: 'First Page' }),
    item({ name: 'Shared', wikiTitle: 'Shared', revisionId: 456 })
  ]), manifest, at)
  assert.equal(got.items.shared.page, 'Shared')
  assert.equal(got.items.shared.wikiDataset?.revisionId, 456)
  assert.equal(got.items['first page'].page, 'First Page')
})

test('fresh facts retain Oracle-only rows, aliases, recipes and quest associations', () => {
  const base: ItemDbFile = { scrapedAt: '2026-10-18', source: 'Oracle bundled', count: 2,
    items: {
      oldalias: { page: 'Test Item', quest: true, questUses: [{ quest: 'My Quest', page: 'My Quest', source: 'posky' }], recipesNote: 'Keep this recipe', eraTag: 'Velious', summary: 'Keep this summary', iconId: 99 },
      extra: { page: 'Oracle Only', eraTag: 'Unknown', summary: 'Not automatically certified as EQL' }
    }
  }
  const before = JSON.stringify(base)
  const merged = mergeWikiItems(base, decodeWikiDataset(pack(), manifest, at))
  assert.equal(merged.items.oldalias.stats?.ac, 12)
  assert.equal(merged.items['test item'].questUses?.[0]?.quest, 'My Quest')
  assert.equal(merged.items.oldalias.recipesNote, 'Keep this recipe')
  assert.equal(merged.items.oldalias.eraTag, 'Velious')
  assert.equal(merged.items.oldalias.summary, 'Keep this summary')
  assert.equal(merged.items.extra, base.items.extra)
  assert.equal(merged.items.oldalias.quest, true)
  assert.equal(merged.scrapedAt, base.scrapedAt, 'a merged corpus must not claim every old row was refreshed')
  assert.equal(JSON.stringify(base), before)
  assert.equal(mergeWikiItems(base, null), base)
})

test('a fresh name alias cannot overwrite an Oracle record for a different page', () => {
  const base: ItemDbFile = { scrapedAt: at, source: 'Oracle', count: 1,
    items: { 'test item': { page: 'Other Page', summary: 'Original identity' } }
  }
  const merged = mergeWikiItems(base, decodeWikiDataset(pack(), manifest, at))
  assert.equal(merged.items['test item'].page, 'Other Page')
  assert.equal(merged.items['other page'], undefined)
  // A conflicting lookup key stays owned by its original page; no identity guess is made.
  assert.equal(merged.items['test item'].summary, 'Original identity')
})


test('quarantines distinct wiki pages that collide under case-insensitive game lookup', () => {
  const got = decodeWikiDataset(pack([
    item({ name: 'Rune Casing', wikiTitle: 'Rune Casing', revisionId: 1 }),
    item({ name: 'Rune casing', wikiTitle: 'Rune casing', revisionId: 2 }),
    item()
  ]), manifest, at)
  assert.equal(got.items['rune casing'], undefined)
  assert.equal(got.quarantinedItems?.length, 2)
  assert.deepEqual(got.identityConflicts?.[0]?.pages, ['Rune Casing', 'Rune casing'])
  assert.equal(got.sourceItemCount, 3)
  const base: ItemDbFile = { scrapedAt: at, source: 'Oracle', count: 1,
    items: { 'rune casing': { page: 'Rune Casing', summary: 'Reviewed Oracle identity' } } }
  assert.equal(mergeWikiItems(base, got).items['rune casing'].summary, 'Reviewed Oracle identity')
})
