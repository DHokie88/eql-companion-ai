import { parentPort } from 'node:worker_threads'
import { catalogSources } from './catalog'
import { createRuntimeDiscord } from './runtimeDiscord'
import { OracleIndex } from './search'
import type { CommunityFeed, CommunityQuery, OracleScope } from '../../shared/oracle'
import { currentHighlight, highlightOrder } from './mustRead'

const readDiscord = createRuntimeDiscord()
let catalog: ReturnType<typeof catalogSources> | undefined
let indexedSources: unknown
let index: OracleIndex | undefined
async function corpus(root: string): Promise<{ index: OracleIndex; feed: CommunityFeed }> {
  catalog ??= catalogSources().catch((error: unknown) => { catalog = undefined; throw error })
  const [sources, discord] = await Promise.all([catalog, readDiscord(root)])
  if (!index || indexedSources !== discord.sources) {
    index = new OracleIndex([...sources, ...discord.sources])
    indexedSources = discord.sources
  }
  return { index, feed: { entries: discord.feed, snapshot: discord.snapshot, total: discord.feed.length } }
}
export function selectFeed(feed: CommunityFeed, query: CommunityQuery): CommunityFeed {
  const needle = (query.query ?? '').trim().toLowerCase().slice(0, 200)
  const entries = feed.entries.filter(e => currentHighlight(e) && (!query.scope || query.scope === 'all' || query.scope === e.origin)
    && (!query.category || query.category === 'all' || query.category === e.category)
    && (!needle || `${e.title} ${e.body} ${e.highlight?.whyItMatters ?? ''}`.toLowerCase().includes(needle)))
  if (query.category === 'highlights') entries.sort(highlightOrder)
  const offset = Math.max(0, Math.floor(query.offset ?? 0))
  const limit = Math.min(50, Math.max(1, Math.floor(query.limit ?? 25)))
  return { entries: entries.slice(offset, offset + limit).map(e => ({ ...e, body: e.body.slice(0, 16000),
    caveat: e.body.length > 16000 ? `${e.caveat} Preview shortened; open the original post for the full thread.` : e.caveat })), total: entries.length, snapshot: feed.snapshot }
}
type Request = { id: number; referenceRoot: string } & ({ method: 'search'; args: { question: string; scope: OracleScope } } | { method: 'feed'; args: CommunityQuery })
parentPort?.on('message', (request: Request) => {
  void corpus(request.referenceRoot).then(({ index, feed }) => {
    const result = request.method === 'search' ? index.search(request.args.question, request.args.scope) : selectFeed(feed, request.args)
    parentPort?.postMessage({ id: request.id, result })
  }).catch(() => parentPort?.postMessage({ id: request.id, error: 'Reference data could not be loaded. Check the imported package and restart EQ Oracle.' }))
})
