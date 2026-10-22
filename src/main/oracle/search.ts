import type { OracleCitation, OracleScope, OracleSource } from '../../shared/oracle'

const stop = new Set('a an the is are was were do does did can could would should i me my you your it its this that there to of in on at for from with and or but be have has how what which who where when why please tell about eql eq everquest legends'.split(' '))
export function terms(text: string): string[] {
  return [...new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(t => t.length > 1 && !stop.has(t)))]
}
interface Indexed { source: OracleSource; words: Set<string>; title: Set<string> }
/** Built in a worker, once. Rarer terms and named entities outrank incidental chat matches. */
export class OracleIndex {
  private rows: Indexed[]
  private frequency = new Map<string, number>()
  constructor(sources: OracleSource[]) {
    this.rows = sources.map(source => ({ source, words: new Set(terms(`${source.title} ${source.text}`)), title: new Set(terms(source.title)) }))
    for (const row of this.rows) for (const word of row.words) this.frequency.set(word, (this.frequency.get(word) ?? 0) + 1)
  }
  search(question: string, scope: OracleScope = 'all', limit = 8): OracleCitation[] {
    const query = terms(question)
    if (!query.length) return []
    const ranked = this.rows.filter(r => scope === 'all' || r.source.kind === scope).map(row => ({ row, score: this.score(row, query) }))
      .filter(r => r.score > 0).sort((a, b) => b.score - a.score || (b.row.source.date ?? '').localeCompare(a.row.source.date ?? ''))
    const selected: OracleCitation[] = []
    const seen = new Set<string>()
    for (const { row } of ranked) {
      const key = row.source.url ?? row.source.id
      if (seen.has(key)) continue
      seen.add(key)
      selected.push({ ...row.source, text: excerpt(row.source.text, query), number: selected.length + 1 })
      if (selected.length >= limit) break
    }
    return selected
  }
  private score(row: Indexed, query: string[]): number {
    let score = 0
    let matches = 0
    for (const word of query) {
      if (!row.words.has(word)) continue
      matches++
      const weight = Math.log(1 + this.rows.length / (1 + (this.frequency.get(word) ?? 0)))
      score += weight * (row.title.has(word) ? 4 : 1)
    }
    // One generic word in a multi-word question is not enough evidence.
    if (matches < Math.min(2, query.length)) return 0
    return score * matches / query.length
  }
}
function excerpt(text: string, query: string[]): string {
  if (text.length <= 2400) return text
  const lower = text.toLowerCase()
  const positions = query.map(word => lower.indexOf(word)).filter(p => p >= 0)
  const start = Math.max(0, Math.min(...positions, 0) - 350)
  // Preserve the opening attribution/context, then a match window when needed.
  const match = Math.max(0, (positions[0] ?? 0) - 350)
  return match > 500 ? `${text.slice(start, 450)}\n[…]\n${text.slice(match, match + 1900)}` : text.slice(0, 2400)
}
