/** One application-wide assistant. Source adapters may grow without adding AI connections. */
export const ORACLE_IPC = {
  feed: 'oracle:feed', ask: 'oracle:ask', cancel: 'oracle:cancel',
  status: 'oracle:status', configure: 'oracle:configure', test: 'oracle:test', open: 'oracle:open'
} as const

export const ORACLE_KINDS = ['all', 'discord', 'items', 'spells', 'quests', 'mobs', 'classes', 'help'] as const
export type OracleScope = typeof ORACLE_KINDS[number]
export type OracleKind = Exclude<OracleScope, 'all'>
export interface OracleSource {
  id: string
  kind: OracleKind
  title: string
  text: string
  url: string | null
  date: string | null
  attribution: string
}
export interface OracleCitation extends OracleSource { number: number }
export interface OracleQuestion {
  id: string
  question: string
  scope?: OracleScope
}
export interface OracleAnswer {
  answer: string
  citations: OracleCitation[]
  mode: 'ai' | 'sources'
  model?: string
  notice?: string
}
export interface OracleConnection {
  host: string
  /** Optional address override, retaining the host alias's SSH identity and key. */
  address: string
  model: string
}
export const DEFAULT_ORACLE_CONNECTION: OracleConnection = { host: 'aw', address: '', model: 'qwen38' }
export interface OracleStatus {
  connection: OracleConnection
  message: string
  available?: boolean
}
export type CommunityCategory = 'all' | 'patches' | 'highlights' | 'issues' | 'classes' | 'guides' | 'events'
export interface CommunityQuery {
  scope?: 'all' | 'official' | 'guild'
  category?: CommunityCategory
  query?: string
  offset?: number
  limit?: number
}
export interface CommunityEntry {
  id: string
  title: string
  body: string
  date: string | null
  url: string | null
  author: string | null
  origin: 'official' | 'guild'
  category: Exclude<CommunityCategory, 'all'>
  caveat: string
}
export interface CommunityFeed {
  entries: CommunityEntry[]
  total: number
  snapshot: { recordCount: number; exportedAt: string; latestMessageDate: string | null; coverageGaps: string[]; lastCheckedAt?: string | null; refreshWarning?: string }
}

export function oracleConnection(input: unknown): OracleConnection {
  if (!input || typeof input !== 'object') throw new Error('Invalid connection settings')
  const c = input as Record<string, unknown>
  if (typeof c.host !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(c.host)) throw new Error('Use an SSH host alias')
  if (typeof c.address !== 'string' || !/^[a-zA-Z0-9.:-]{0,120}$/.test(c.address)) throw new Error('Use a host name or IP address')
  if (typeof c.model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9/._:-]{0,119}$/.test(c.model)) throw new Error('Invalid model name')
  return { host: c.host, address: c.address, model: c.model }
}
export function oracleQuestion(input: unknown): Required<OracleQuestion> {
  if (!input || typeof input !== 'object') throw new Error('Enter a question')
  const q = input as Record<string, unknown>
  if (typeof q.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(q.id)) throw new Error('Invalid question ID')
  if (typeof q.question !== 'string' || !q.question.trim() || q.question.length > 2000) throw new Error('Enter a question of up to 2,000 characters')
  const scope = q.scope ?? 'all'
  if (!ORACLE_KINDS.includes(scope as OracleScope)) throw new Error('Unknown reference source')
  return { id: q.id, question: q.question.trim(), scope: scope as OracleScope }
}
/** The renderer can only open source links, never arbitrary protocols or local files. */
export function oracleSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    if (url.hostname === 'discord.com' && /^\/channels\/\d+\/\d+(?:\/\d+)?\/?$/.test(url.pathname)) return url.href
    if (url.hostname === 'eqlwiki.com' && url.pathname.startsWith('/wiki/')) return url.href
  } catch { return null }
  return null
}
