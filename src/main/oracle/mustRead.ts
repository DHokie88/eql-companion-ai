import { oracleSourceUrl, type CommunityEntry, type OracleSource } from '../../shared/oracle'

type Highlight = NonNullable<CommunityEntry['highlight']>
const kinds = ['limited-reward', 'release', 'bonus', 'farming', 'sale', 'event', 'server', 'issue']
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid highlight object')
  return value as Record<string, unknown>
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Invalid highlight text')
  return value.trim()
}
function date(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)
    || !Number.isFinite(Date.parse(value))) throw new Error('Invalid highlight date')
  return value
}
function links(value: unknown, sources: boolean): Highlight['sources'] {
  if (!Array.isArray(value) || value.length > 3 || (sources && !value.length)) throw new Error('Invalid highlight links')
  return value.map((input: unknown) => {
    const item = object(input)
    const url = oracleSourceUrl(item.url)
    if (!url) throw new Error('Invalid highlight source link')
    if (sources !== url.startsWith('https://discord.com/channels/')) throw new Error('Invalid highlight source link')
    return { url, label: text(item.label, 100) }
  })
}
function metadata(item: Record<string, unknown>): Highlight {
  if (typeof item.kind !== 'string' || !kinds.includes(item.kind)) throw new Error('Invalid highlight kind')
  if (item.confidence !== 'announcement' && item.confidence !== 'community-report') throw new Error('Invalid highlight confidence')
  return { kind: item.kind as Highlight['kind'], confidence: item.confidence,
    whyItMatters: text(item.whyItMatters, 600), expiresAt: item.expiresAt === null ? null : date(item.expiresAt),
    sources: links(item.sources, true), relatedLinks: links(item.relatedLinks, false) }
}
function entry(input: unknown, sources: Map<string, OracleSource[]>): CommunityEntry {
  const item = object(input)
  const id = text(item.id, 160)
  if (!/^[a-zA-Z0-9._:-]+$/.test(id)) throw new Error('Invalid highlight ID')
  const highlight = metadata(item)
  for (const link of highlight.sources) if (!sources.has(link.url)) throw new Error('Highlight cites a post outside this snapshot')
  const evidence = highlight.sources.flatMap(link => sources.get(link.url) ?? []).map(source => source.text).join('\n')
  for (const link of highlight.relatedLinks) if (!evidence.includes(link.url)) throw new Error('Highlight guide link is not present in its sources')
  const first = sources.get(highlight.sources[0].url)?.[0]
  return { id: `must-read:${id}`, title: text(item.title, 180), body: text(item.summary, 1000), date: date(item.date),
    url: highlight.sources[0].url, author: null, origin: first?.attribution.startsWith('Official server') ? 'official' : 'guild',
    category: 'highlights', highlight, caveat: highlight.confidence === 'community-report'
      ? 'Player reports, not independently verified. Read the linked evidence before relying on the claim.'
      : 'Announcement summary. Check the original post for dates, eligibility and any later changes.' }
}
/** Curated copy is separate from the complete searchable Discord capture. Legacy scores are never a fallback. */
export function mustReadEntries(value: unknown, sources: OracleSource[]): CommunityEntry[] {
  const data = object(value)
  if (data.schemaVersion !== 1 || !Array.isArray(data.entries) || data.entries.length > 100) throw new Error('Invalid highlight digest')
  date(data.generatedAt)
  const byUrl = new Map<string, OracleSource[]>()
  for (const source of sources) for (const url of new Set([source.url, ...(source.evidenceUrls ?? [])])) {
    if (url) byUrl.set(url, [...(byUrl.get(url) ?? []), source])
  }
  const entries = data.entries.map((item: unknown) => entry(item, byUrl))
  if (new Set(entries.map(item => item.id)).size !== entries.length) throw new Error('Duplicate highlight ID')
  return entries
}

export function currentHighlight(entry: CommunityEntry, now = Date.now()): boolean {
  if (!entry.highlight) return true
  if (entry.highlight.expiresAt) return Date.parse(entry.highlight.expiresAt) > now
  return entry.date !== null && Date.parse(entry.date) + 14 * 86400_000 > now
}

/** Time-sensitive opportunities lead the digest, then the latest material updates. */
export function highlightOrder(a: CommunityEntry, b: CommunityEntry): number {
  const aDeadline = a.highlight?.expiresAt ? Date.parse(a.highlight.expiresAt) : Infinity
  const bDeadline = b.highlight?.expiresAt ? Date.parse(b.highlight.expiresAt) : Infinity
  return (aDeadline === bDeadline ? 0 : aDeadline - bDeadline)
    || (b.date ?? '').localeCompare(a.date ?? '') || a.id.localeCompare(b.id)
}
