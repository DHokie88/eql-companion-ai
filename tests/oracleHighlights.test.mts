import test from 'node:test'
import assert from 'node:assert/strict'
import { mustReadEntries, currentHighlight } from '../src/main/oracle/mustRead.ts'
import { oracleSourceUrl, type OracleSource } from '../src/shared/oracle.ts'
import { discordIndex } from '../src/main/oracle/discord.ts'
import { selectFeed } from '../src/main/oracle/worker.ts'

const source: OracleSource = { id: 'discord:1', kind: 'discord', title: 'Test quest announcement', text: 'Source text https://www.youtube.com/watch?v=abcdefghijk',
  url: 'https://discord.com/channels/1/2/3', date: '2026-10-25T12:00:00Z', attribution: 'Official server; staff; unverified Discord claim.' }
const highlight = { id: 'halloween', title: 'Halloween quest — claim a limited-time pet illusion',
  summary: 'Complete the seasonal quest for a free pet illusion before the event ends.',
  whyItMatters: 'A limited-time reward is available to collect.', kind: 'limited-reward', confidence: 'announcement',
  date: '2026-10-25T12:00:00Z', expiresAt: '2026-11-01T04:00:00Z',
  sources: [{ url: source.url, label: 'Quest announcement' }],
  relatedLinks: [{ url: 'https://www.youtube.com/watch?v=abcdefghijk', label: 'Quest walkthrough' }] }
const digest = (entries: unknown[]) => ({ schemaVersion: 1, generatedAt: '2026-10-25T12:00:00Z', entries })

test('curated highlights explain the opportunity, preserve evidence and expire without republishing', () => {
  const [entry] = mustReadEntries(digest([highlight]), [source])
  assert.equal(entry.title, highlight.title)
  assert.equal(entry.body, highlight.summary)
  assert.notEqual(entry.body, source.text)
  assert.equal(entry.highlight?.whyItMatters, highlight.whyItMatters)
  assert.equal(entry.origin, 'official')
  assert.equal(entry.highlight?.sources[0].url, source.url)
  assert.equal(currentHighlight(entry, Date.parse('2026-10-31T00:00:00Z')), true)
  assert.equal(currentHighlight(entry, Date.parse('2026-11-01T04:00:00Z')), false)
  const undated = { ...entry, highlight: { ...entry.highlight!, expiresAt: null } }
  assert.equal(currentHighlight(undated, Date.parse('2026-11-09T00:00:00Z')), false, 'unknown event deadlines cannot keep old opportunities alive forever')
})

test('feed filters expired items at request time and searches the reason to care', () => {
  const [expired] = mustReadEntries(digest([{ ...highlight, expiresAt: '2000-01-01T00:00:00Z' }]), [source])
  const [active] = mustReadEntries(digest([{ ...highlight, id: 'active', expiresAt: '2099-01-01T00:00:00Z' }]), [source])
  const feed = { entries: [expired, active], total: 2, snapshot: { recordCount: 1, exportedAt: '', latestMessageDate: null, coverageGaps: [] } }
  const selected = selectFeed(feed, { category: 'highlights', query: 'available to collect' })
  assert.equal(selected.total, 1)
  assert.equal(selected.entries[0].id, 'must-read:active')
})

test('invented sources, unknown links, malformed dates and duplicate IDs reject the digest', () => {
  assert.throws(() => mustReadEntries(digest([highlight]), []), /outside this snapshot/)
  assert.throws(() => mustReadEntries(digest([highlight, highlight]), [source]), /Duplicate/)
  assert.throws(() => mustReadEntries(digest([highlight]), [{ ...source, text: 'No link supplied' }]), /not present/)
  for (const changed of [
    { summary: '' }, { kind: 'routine-question' }, { expiresAt: 'someday' }, { sources: [] },
    { relatedLinks: [{ url: 'https://example.com/quest', label: 'Guide' }] },
    { sources: [{ url: 'https://discord.com/channels/1/2/999', label: 'Invented' }] }
  ]) assert.throws(() => mustReadEntries(digest([{ ...highlight, ...changed }]), [source]))
})

test('captured reply evidence can back a highlight without increasing source record counts', () => {
  const reply = 'https://discord.com/channels/1/2/4'
  const entries = mustReadEntries(digest([{ ...highlight, sources: [{ url: reply, label: 'Reply evidence' }] }]), [{ ...source, evidenceUrls: [reply] }])
  assert.equal(entries[0].url, reply)
  assert.equal(mustReadEntries(digest([highlight]), [source, { ...source, text: 'Short QA excerpt' }]).length, 1,
    'another record using the same URL cannot erase the full thread evidence')
})

test('only exact supported video URLs pass the source-link boundary', () => {
  for (const url of ['https://youtu.be/abcdefghijk', 'https://youtube.com/watch?v=abcdefghijk&t=90']) assert.equal(oracleSourceUrl(url), url)
  for (const url of ['https://youtube.com/redirect?q=https://evil.example', 'https://youtu.be.evil.test/abcdefghijk',
    'https://youtube.com/watch?v=abcdefghijk&redirect=https://evil.example', 'https://youtu.be/invalid',
    'https://user@youtube.com/watch?v=abcdefghijk']) assert.equal(oracleSourceUrl(url), null)
})

test('legacy questions and off-topic scored highlights remain searchable but cannot fill Highlights', async () => {
  const index = await discordIndex(undefined, digest([]))
  assert.equal(index.feed.filter(entry => entry.category === 'highlights').length, 0)
  assert.ok(index.sources.some(entry => entry.id.startsWith('discord:highlights')))
  assert.ok(index.sources.some(entry => /paint job|Great Wolf|undead side/i.test(`${entry.title} ${entry.text}`)))
})
