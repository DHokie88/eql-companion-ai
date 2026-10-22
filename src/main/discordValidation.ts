import type { DiscordDatasetName, DiscordManifest } from '../shared/discordReference'
type ObjectValue = Record<string, unknown>
export const object = (value: unknown): value is ObjectValue => value !== null && typeof value === 'object' && !Array.isArray(value)
export const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(x => typeof x === 'string')
const urlPattern = /^https?:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/channels\/[0-9]+\/[0-9]+(?:\/[0-9]+)?\/?$/
function validDate(value: unknown): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
function timestamp(value: unknown): boolean { return typeof value === 'string' && !Number.isNaN(Date.parse(value)) }
function check(problems: string[], path: string, valid: boolean, message: string): void { if (!valid) problems.push(`${path}: ${message}`) }
function optionalString(value: unknown): boolean { return value == null || typeof value === 'string' }
function optionalCount(value: unknown): boolean { return value == null || (typeof value === 'number' && Number.isInteger(value) && value >= 0) }
function provenanceFields(value: ObjectValue, path: string, problems: string[]): void {
  const missing = value.missing
  check(problems, path, stringArray(missing) && missing.every(f => ['url', 'author', 'date'].includes(f)), 'invalid missing provenance fields')
  for (const field of ['url', 'author', 'date']) {
    const absent = Array.isArray(missing) && missing.includes(field)
    check(problems, path, text(value[field]) !== absent, `provenance.${field} must match its missing marker`)
    check(problems, path, optionalString(value[field]), `invalid provenance.${field}`)
  }
}
function provenance(value: unknown, path: string, problems: string[]): void {
  if (!object(value)) { problems.push(`${path}: no provenance object`); return }
  provenanceFields(value, path, problems)
  if (value.url) check(problems, path, typeof value.url === 'string' && urlPattern.test(value.url), 'invalid Discord permalink')
  if (value.date) check(problems, path, validDate(value.date), 'invalid message date')
  for (const field of ['messageId', 'channelId', 'threadId', 'guildId']) {
    const v = value[field]
    check(problems, path, v == null || (typeof v === 'string' && /^[0-9]+$/.test(v)), `invalid ${field}`)
  }
  for (const field of ['origin', 'authority']) check(problems, path, value[field] == null || value[field] === 'official' || value[field] === 'guild', `invalid ${field}`)
  check(problems, path, value.messageTimestamp == null || timestamp(value.messageTimestamp), 'invalid messageTimestamp')
}
function relation(value: unknown, path: string, problems: string[]): void {
  if (!object(value)) { problems.push(`${path}: invalid relationship evidence`); return }
  check(problems, path, typeof value.kind === 'string' && ['reply-reference', 'same-conversation', 'explicit-message-link', 'explicit-thread-link'].includes(value.kind), 'invalid relationship kind')
  for (const field of ['sourceUrl', 'targetUrl']) check(problems, path, typeof value[field] === 'string' && urlPattern.test(value[field]), `invalid relationship ${field}`)
  if (typeof value.kind === 'string' && value.kind.startsWith('explicit-')) {
    check(problems, path, typeof value.linkUrl === 'string' && urlPattern.test(value.linkUrl), 'explicit link requires linkUrl')
    check(problems, path, value.direction === 'question-to-evidence' || value.direction === 'evidence-to-question', 'invalid link direction')
  }
  check(problems, path, value.verified == null || value.verified === false, 'relationship cannot verify a claim')
}
function reply(value: unknown, path: string, problems: string[], requireRelation: boolean): void {
  if (!object(value)) { problems.push(`${path}: reply is not an object`); return }
  check(problems, path, typeof value.text === 'string', 'reply text must be a string')
  check(problems, path, value.timestamp == null || timestamp(value.timestamp), 'invalid reply timestamp')
  check(problems, path, optionalString(value.author), 'invalid reply author')
  provenance(value.provenance, path, problems)
  if (requireRelation || value.relation !== undefined) relation(value.relation, path, problems)
  check(problems, path, value.verification === 'unverified', 'reply must retain unverified claim status')
}
const kinds: Record<DiscordDatasetName, string[]> = { patchNotes: ['patch-update'], knownIssues: ['thread'], classNotes: ['thread'], prices: ['price'], events: ['guild-event'], guides: ['guide'], highlightsGuild: ['highlight'], highlightsOfficial: ['highlight'], qaAndFacts: ['fact', 'qa'] }
const strings: Record<string, string[]> = { 'patch-update': ['id', 'date', 'headline'], thread: ['id', 'title', 'report'], price: ['id', 'item', 'market', 'currency'], 'guild-event': ['id', 'headline', 'body', 'date'], guide: ['id', 'title', 'body'], highlight: ['id', 'summary', 'sourceText', 'topic'], fact: ['id', 'text'], qa: ['id', 'question'] }
const arrays: Record<string, string[]> = { 'patch-update': ['downtime', 'notes', 'items', 'sectionNames'], 'guild-event': ['datesMentioned'], highlight: ['reasons'] }
function recordFields(record: ObjectValue, kind: string, path: string, problems: string[]): void {
  for (const field of strings[kind] ?? []) check(problems, path, typeof record[field] === 'string' && (field === 'report' || text(record[field])), `invalid ${field}`)
  for (const field of arrays[kind] ?? []) check(problems, path, stringArray(record[field]), `${field} must be a string array`)
  for (const field of ['channel', 'author', 'thread', 'title', 'dateAsWritten', 'preamble', 'messageId', 'per', 'category', 'note', 'updated', 'highlightKind']) check(problems, path, optionalString(record[field]), `invalid ${field}`)
  for (const field of ['replyCount', 'length']) check(problems, path, optionalCount(record[field]), `invalid ${field}`)
  check(problems, path, record.verification === 'unverified', 'record must retain unverified claim status')
  provenance(record.provenance, path, problems)
}
function replies(record: ObjectValue, field: string, path: string, problems: string[]): void {
  const values = record[field]
  if (!Array.isArray(values)) { problems.push(`${path}: ${field} must be an array`); return }
  values.forEach((value: unknown, i) => reply(value, `${path}.${field}[${i}]`, problems, record.kind === 'qa'))
}
function patch(record: ObjectValue, path: string, problems: string[]): void {
  check(problems, path, validDate(record.date), 'invalid patch date')
  check(problems, path, Array.isArray(record.sections) && record.sections.every((s: unknown) => object(s) && stringArray(s.items) && optionalString(s.name)), 'invalid patch sections')
}
function eventRecord(record: ObjectValue, path: string, problems: string[]): void {
  check(problems, path, validDate(record.date), 'invalid event date')
  check(problems, path, Array.isArray(record.winners) && record.winners.every((w: unknown) => object(w) && typeof w.who === 'string' && typeof w.prize === 'string' && optionalString(w.place)), 'invalid winners')
}
function price(record: ObjectValue, path: string, problems: string[]): void {
  check(problems, path, typeof record.amount === 'number' && Number.isFinite(record.amount) && record.amount >= 0, 'invalid price amount')
  check(problems, path, record.observation === 'discord-guild-post', 'invalid price observation')
  check(problems, path, record.date == null || validDate(record.date), 'invalid price date')
}
function recordShape(record: ObjectValue, kind: string, path: string, problems: string[]): void {
  switch (kind) {
    case 'price': price(record, path, problems); break
    case 'patch-update': patch(record, path, problems); break
    case 'guild-event': eventRecord(record, path, problems); break
    case 'highlight': check(problems, path, typeof record.score === 'number' && Number.isFinite(record.score), 'invalid highlight score'); break
    case 'thread': check(problems, path, typeof record.openerMissing === 'boolean', 'invalid openerMissing'); replies(record, 'replies', path, problems); break
    case 'qa': replies(record, 'answers', path, problems); replies(record, 'supportingEvidence', path, problems); break
  }
}
export function validateEnvelope(name: DiscordDatasetName, value: unknown): string[] {
  const problems: string[] = []
  if (!object(value) || !object(value.records)) return [`${name}: envelope requires records object`]
  check(problems, name, value.schemaVersion === 2, 'unsupported schemaVersion')
  check(problems, name, value.kind === name, 'kind does not match dataset')
  check(problems, name, text(value.source) && timestamp(value.scrapedAt), 'invalid source or scrapedAt')
  check(problems, name, Number.isInteger(value.count) && value.count === Object.keys(value.records).length, 'count does not match records')
  for (const [key, record] of Object.entries(value.records)) {
    const path = `${name}:${key}`
    if (!object(record)) { problems.push(`${path}: record is not an object`); continue }
    if (typeof record.kind !== 'string' || !kinds[name].includes(record.kind)) { problems.push(`${path}: wrong record kind`); continue }
    recordFields(record, record.kind, path, problems)
    recordShape(record, record.kind, path, problems)
  }
  return problems
}
export function validateManifest(value: unknown, names: DiscordDatasetName[]): DiscordManifest {
  if (!object(value) || value.schemaVersion !== 2 || value.recordKey !== 'records' || !object(value.files)) throw new Error('Invalid Discord manifest')
  if (!stringArray(value.blockedChannels) || !text(value.note) || !text(value.format)) throw new Error('Invalid Discord manifest metadata')
  for (const name of names) {
    const file = value.files[name]
    if (!object(file)) throw new Error(`Invalid Discord manifest entry: ${name}`)
    manifestEntry(file, name)
  }
  return value as unknown as DiscordManifest
}
function manifestEntry(file: ObjectValue, name: DiscordDatasetName): void {
  const valid = file.file === `${name}.json` && optionalCount(file.count) && file.count != null && text(file.source) && stringArray(file.coverageGaps)
  if (!valid) throw new Error(`Invalid Discord manifest entry: ${name}`)
}
