export type CoverageSummary = {
  id: string
  title: string
  detail: string
}

const HISTORICAL: CoverageSummary = {
  id: 'historical-channel-access',
  title: 'Historical channel access',
  detail: 'An earlier capture reported restricted channels. This does not confirm their current access.',
}

const PRICES: CoverageSummary = {
  id: 'image-only-prices',
  title: 'Image-only prices',
  detail: 'Numbers inside guild price-list images have not been extracted. Prices posted as text are included.',
}

const POLLS: CoverageSummary = {
  id: 'poll-results',
  title: 'Poll results',
  detail: 'Poll results are not included in the saved data.',
}

const PERMISSION_PATTERNS = [/permission/, /http\s*403/, /restricted channels/, /private\/staff/]
const HISTORICAL_PATTERNS = [/stored[-\s]harvest/, /earlier[-\s]capture/, /\boffline\b/, /not[-\s]rechecked/]
const PRICE_PATTERNS = [/\bprices?\b/, /price-list/, /price list/, /wts\/wtb/]
const IMAGE_PATTERNS = [/\bpng\b/, /\bimages?\b/]
const UNEXTRACTED_PATTERNS = [/not extracted/]
const POLL_PATTERNS = [/poll results/, /poll payload/, /poll-based decisions/]
const POLL_GAP_PATTERNS = [/absent/, /not captured/, /unavailable/, /not returned/, /not included/]

function hasAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(text))
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

function readable(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

function isHistoricalPermission(text: string): boolean {
  return hasAny(text, PERMISSION_PATTERNS) && hasAny(text, HISTORICAL_PATTERNS)
}

function isImageOnlyPrices(text: string): boolean {
  return hasAny(text, PRICE_PATTERNS) && hasAny(text, IMAGE_PATTERNS) && hasAny(text, UNEXTRACTED_PATTERNS)
}

function isPollGap(text: string): boolean {
  return hasAny(text, POLL_PATTERNS) && hasAny(text, POLL_GAP_PATTERNS)
}

function groupsFor(text: string): CoverageSummary[] {
  const groups: CoverageSummary[] = []
  if (isHistoricalPermission(text)) groups.push(HISTORICAL)
  if (isImageOnlyPrices(text)) groups.push(PRICES)
  if (isPollGap(text)) groups.push(POLLS)
  return groups
}

function unknownId(text: string): string {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `note-${slug || 'text'}`
}

function unknownNote(text: string): CoverageSummary {
  return { id: unknownId(text), title: text, detail: text }
}

function append(rows: CoverageSummary[], seen: Set<string>, row: CoverageSummary): void {
  if (seen.has(row.id)) return
  seen.add(row.id)
  rows.push({ id: row.id, title: row.title, detail: row.detail })
}

function addNote(rows: CoverageSummary[], seen: Set<string>, note: string): void {
  const text = readable(note)
  if (!text) return
  const groups = groupsFor(normalize(note))
  if (groups.length > 0) {
    for (const group of groups) append(rows, seen, group)
    return
  }
  append(rows, seen, unknownNote(text))
}

export function coverageSummary(notes: string[]): CoverageSummary[] {
  const rows: CoverageSummary[] = []
  const seen = new Set<string>()
  for (const note of notes) addNote(rows, seen, note)
  return rows
}
