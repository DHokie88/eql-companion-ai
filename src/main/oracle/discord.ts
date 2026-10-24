import { loadDataset, loadManifest } from '../discordReferenceLoader'
import type { CommunityEntry, CommunityFeed, OracleSource } from '../../shared/oracle'
import type { DiscordDatasetName, DiscordRecord, DiscordReply } from '../../shared/discordReference'

const names: DiscordDatasetName[] = ['patchNotes', 'knownIssues', 'classNotes', 'prices', 'events', 'guides', 'highlightsGuild', 'highlightsOfficial', 'qaAndFacts']
export interface DiscordIndex { sources: OracleSource[]; feed: CommunityEntry[]; snapshot: CommunityFeed['snapshot'] }
function replyText(reply: DiscordReply): string {
  return `[Unverified ${reply.relation?.kind ?? 'reply'} by ${reply.author ?? 'unknown author'}, ${reply.timestamp ?? 'date missing'}] ${reply.text}`
}
function highlightTitle(title: string | null, summary: string): string { return title ?? summary.slice(0, 110) }
function threadText(r: import('../../shared/discordReference').ThreadNote): string {
  return [r.openerMissing ? '[Thread opener missing]' : r.report, ...r.replies.map(replyText)].join('\n\n')
}
function sourceOrigin(p: import('../../shared/discordReference').DiscordProvenance): 'official' | 'guild' { return p.origin ?? p.authority ?? 'guild' }
function attribution(origin: string, p: import('../../shared/discordReference').DiscordProvenance, caveat?: string): string {
  return `${origin === 'official' ? 'Official server' : 'Guild server'}; ${p.author ?? 'author missing'}; unverified Discord claim. ${caveat ?? ''}`
}
export async function discordIndex(loader = { loadManifest, loadDataset }): Promise<DiscordIndex> {
  const manifest = await loader.loadManifest()
  const result: DiscordIndex = { sources: [], feed: [], snapshot: { recordCount: 0, exportedAt: '', latestMessageDate: null, coverageGaps: [] } }
  for (const name of names) {
    const envelope = await loader.loadDataset(name)
    if (envelope.count !== manifest.files[name].count) throw new Error(`Discord manifest count mismatch: ${name}`)
    result.snapshot.recordCount += envelope.count
    if (envelope.scrapedAt > result.snapshot.exportedAt) result.snapshot.exportedAt = envelope.scrapedAt
    for (const gap of manifest.files[name].coverageGaps) result.snapshot.coverageGaps.push(gap)
    for (const [key, record] of Object.entries(envelope.records)) addRecord(result, { record, key, dataset: name })
  }
  result.snapshot.coverageGaps = [...new Set(result.snapshot.coverageGaps)]
  result.feed.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.id.localeCompare(b.id))
  return result
}
function describe(record: DiscordRecord): { title: string; text: string; category?: CommunityEntry['category']; date?: string; caveat?: string } {
  // The loader validates the discriminated records before this adapter reads them.
  const r = record as import('../../shared/discordReference').DiscordRecordTypes[DiscordDatasetName]
  switch (r.kind) {
    case 'patch-update': return { title: r.headline, text: [...r.notes, ...r.sections.flatMap(s => [s.name ?? '', ...s.items])].join('\n'), category: 'patches', date: r.date, caveat: `Update date ${r.date}; message date ${r.provenance.date ?? 'missing'}.` }
    case 'thread': return { title: r.title, text: threadText(r), category: 'issues', caveat: 'Community report and unverified replies; the text marks missing openers.' }
    case 'highlight': return { title: highlightTitle(r.title, r.summary), text: r.sourceText, category: 'highlights' }
    case 'guide': return { title: r.title, text: r.body, category: 'guides' }
    case 'guild-event': return { title: r.headline, text: r.body, category: 'events' }
    case 'price': return { title: r.item, text: `${r.amount} ${r.currency}${r.per ? ` per ${r.per}` : ''}. Market: ${r.market}. ${r.note ?? ''}. Historical guild post, NOT a current Bazaar price.` }
    case 'fact': return { title: r.text.slice(0, 110), text: r.text }
    case 'qa': return { title: r.question.slice(0, 150), text: [`Question: ${r.question}`, ...r.answers.map(replyText), ...r.supportingEvidence.map(e => `Linked context (not an answer): ${replyText(e)}`)].join('\n\n') }
  }
}
function addRecord(result: DiscordIndex, entry: { record: DiscordRecord; key: string; dataset: DiscordDatasetName }): void {
  const { record, key, dataset } = entry
  const p = record.provenance
  const origin = sourceOrigin(p)
  const d = describe(record)
  const date = p.messageTimestamp ?? p.date
  if (date && date > (result.snapshot.latestMessageDate ?? '')) result.snapshot.latestMessageDate = date
  result.sources.push({ id: `discord:${dataset}:${key}`, kind: 'discord', title: d.title, text: d.text, url: p.url, date,
    attribution: attribution(origin, p, d.caveat) })
  if (!d.category) return
  result.feed.push({ id: `${dataset}:${key}`, title: d.title, body: d.text, date: d.date ?? date,
    url: p.url, author: p.author, origin, category: dataset === 'classNotes' ? 'classes' : d.category,
    caveat: d.caveat ?? 'Community post. Server origin does not verify the claim.' })
}
