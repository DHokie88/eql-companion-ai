// Schema-2 package loader; validation is factored into discordValidation.ts for EQO.
// Literal dynamic imports let Vite emit offline chunks. No dataset JSON is parsed
// at loader import time. A dataset is imported, validated and cached on first use.
// Consumers must await loadDataset/query functions. Validation errors reject access.
import type {
  DiscordDatasetName, DiscordEnvelope, DiscordManifest, DiscordRecordTypes,
  GuildEvent, Highlight, PatchUpdate, PriceQuote, ThreadNote,
} from '../shared/discordReference'

import { validateEnvelope, validateManifest } from './discordValidation'
export { validateEnvelope } from './discordValidation'

const readers: Record<DiscordDatasetName, () => Promise<unknown>> = {
  patchNotes: () => import('./data/discord/patchNotes.json').then(m => m.default),
  knownIssues: () => import('./data/discord/knownIssues.json').then(m => m.default),
  classNotes: () => import('./data/discord/classNotes.json').then(m => m.default),
  prices: () => import('./data/discord/prices.json').then(m => m.default),
  events: () => import('./data/discord/events.json').then(m => m.default),
  guides: () => import('./data/discord/guides.json').then(m => m.default),
  highlightsGuild: () => import('./data/discord/highlightsGuild.json').then(m => m.default),
  highlightsOfficial: () => import('./data/discord/highlightsOfficial.json').then(m => m.default),
  qaAndFacts: () => import('./data/discord/qaAndFacts.json').then(m => m.default),
}
export const datasetNames = Object.keys(readers) as DiscordDatasetName[]
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
/** Dependencies can be injected by offline tests. Each instance has independent caches. */
export function createDiscordLoader(
  sources: Record<DiscordDatasetName, () => Promise<unknown>> = readers,
  readManifest: () => Promise<unknown> = () => import('./data/discord/manifest.json').then(m => m.default),
) {
  const cache = new Map<DiscordDatasetName, Promise<unknown>>()
  let manifestCache: Promise<DiscordManifest> | undefined
  async function loadDataset<N extends DiscordDatasetName>(name: N): Promise<DiscordEnvelope<DiscordRecordTypes[N]>> {
    if (!Object.prototype.hasOwnProperty.call(sources, name)) throw new Error(`Unknown Discord dataset: ${name}`)
    let pending = cache.get(name)
    if (!pending) {
      pending = Promise.resolve().then(() => sources[name]()).then(value => {
        const problems = validateEnvelope(name, value)
        if (problems.length) throw new Error(`Invalid Discord dataset ${name}: ${problems.join('; ')}`)
        return freeze(value)
      }).catch((error: unknown) => { cache.delete(name); throw error })
      cache.set(name, pending)
    }
    return pending as Promise<DiscordEnvelope<DiscordRecordTypes[N]>>
  }
  async function loadManifest(): Promise<DiscordManifest> {
    manifestCache ??= Promise.resolve().then(readManifest).then(value => freeze(validateManifest(value, datasetNames)))
      .catch((error: unknown) => { manifestCache = undefined; throw error })
    return manifestCache
  }
  /** Loads every real packaged chunk and checks manifest counts; no string markers. */
  async function allProblems(): Promise<string[]> {
    const problems: string[] = []
    let manifest: DiscordManifest | undefined
    try { manifest = await loadManifest() } catch (error) { problems.push(String(error)) }
    await Promise.all(datasetNames.map(async name => {
      try {
        const envelope = await loadDataset(name)
        if (manifest && manifest.files[name].count !== envelope.count) problems.push(`${name}: manifest count does not match dataset`)
      } catch (error) { problems.push(String(error)) }
    }))
    return problems.sort()
  }
  return { loadDataset, loadManifest, allProblems, isHealthy: async () => (await allProblems()).length === 0 }
}
const defaultLoader = createDiscordLoader()
export const loadDataset = defaultLoader.loadDataset
export const loadManifest = defaultLoader.loadManifest
export const allProblems = defaultLoader.allProblems
export const isHealthy = defaultLoader.isHealthy
export async function expectedFiles(): Promise<string[]> {
  return Object.values((await loadManifest()).files).map(file => file.file)
}
export async function coverageGaps(name: DiscordDatasetName): Promise<string[]> {
  return (await loadManifest()).files[name].coverageGaps
}
export async function blockedChannels(): Promise<string[]> { return (await loadManifest()).blockedChannels }
export async function pricesFor(market: string, date: string): Promise<PriceQuote[]> {
  return Object.values((await loadDataset('prices')).records).filter(p => p.market === market && p.date === date)
}
export async function priceHistory(item: string): Promise<PriceQuote[]> {
  return Object.values((await loadDataset('prices')).records).filter(p => p.item === item).sort((a, b) => String(b.date).localeCompare(String(a.date)))
}
export async function patchNotesSince(date: string): Promise<PatchUpdate[]> {
  return Object.values((await loadDataset('patchNotes')).records).filter(p => p.date >= date).sort((a, b) => b.date.localeCompare(a.date))
}
/** Recent reports; no claim that a report remains open or a bug was confirmed. */
export async function recentKnownIssues(limit = 20): Promise<ThreadNote[]> {
  if (!Number.isInteger(limit) || limit < 0) throw new Error('limit must be a nonnegative integer')
  return Object.values((await loadDataset('knownIssues')).records).sort((a, b) => String(b.provenance.date).localeCompare(String(a.provenance.date))).slice(0, limit)
}
export async function eventsOn(date: string): Promise<GuildEvent[]> {
  return Object.values((await loadDataset('events')).records).filter(e => e.date === date)
}
export async function highlightsByTopic(topic: string, scope: 'guild' | 'official' = 'official'): Promise<Highlight[]> {
  const source = await loadDataset(scope === 'guild' ? 'highlightsGuild' : 'highlightsOfficial')
  return Object.values(source.records).filter(h => h.topic === topic).sort((a, b) => b.score - a.score)
}
