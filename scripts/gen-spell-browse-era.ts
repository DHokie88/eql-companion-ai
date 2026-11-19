/**
 * Deterministic browse-era table from the committed spell wikitext cache.
 * A name is classic, kunark, or later only when every documented page agrees.
 * pageEra.spells `false` is not Classic. `true` without a banner is later.
 * Run: node --import tsx scripts/gen-spell-browse-era.ts
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parsePageEraTag } from '../src/main/itemLookupParse'
import { pageEraKey, type PageEraFile } from '../src/main/pageEraDb'
import { definitiveSpellEra, type SpellEraLabel } from '../src/shared/spellBrowseEra'

const root = resolve(import.meta.dirname, '..')
const cacheDir = resolve(root, 'scripts/sources/cache/spells')
const pageEra = JSON.parse(readFileSync(resolve(root, 'src/main/data/pageEra.json'), 'utf8')) as PageEraFile
const outOfEra = pageEra.spells ?? {}

function spellName(wikitext: string): string | null {
  const start = wikitext.search(/\{\{\s*Spellpage/i)
  if (start < 0) return null
  const match = /\|\s*spellname\s*=\s*([^\n]+)/i.exec(wikitext.slice(start, start + 5000))
  if (!match) return null
  const name = match[1]
    .replace(/\[\[[^\]|]*\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return name || null
}

interface Vote { tokens: Set<Exclude<SpellEraLabel, 'unknown'>>; silent: boolean; outOfEra: boolean }

const votes = new Map<string, Vote>()
for (const file of readdirSync(cacheDir).filter((name) => name.endsWith('.wikitext')).sort()) {
  const wikitext = readFileSync(resolve(cacheDir, file), 'utf8')
  const name = spellName(wikitext)
  if (!name) continue
  const key = pageEraKey(name)
  const vote: Vote = votes.get(key) ?? { tokens: new Set(), silent: false, outOfEra: false }
  const token = parsePageEraTag(wikitext)
  const era = token ? definitiveSpellEra(token) : null
  if (era) vote.tokens.add(era)
  else vote.silent = true
  if (outOfEra[key]) vote.outOfEra = true
  votes.set(key, vote)
}

const names: Record<string, Exclude<SpellEraLabel, 'unknown'>> = {}
for (const [key, vote] of [...votes.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  if (vote.tokens.size === 1 && !vote.silent) {
    const era = [...vote.tokens][0]
    if (era === 'classic' && vote.outOfEra) continue
    names[key] = era
    continue
  }
  if (vote.tokens.size === 0 && vote.outOfEra) names[key] = 'later'
}

const body = {
  source: 'Committed spell wikitext banners via parsePageEraTag and definitiveSpellEra. Exact spellname only. pageEra.spells true is out-of-era corroboration; false is ignored.',
  count: Object.keys(names).length,
  names
}
writeFileSync(resolve(root, 'src/main/data/spellBrowseEra.json'), `${JSON.stringify(body, null, 2)}\n`)
console.log(`spell browse era names: ${body.count}`)
