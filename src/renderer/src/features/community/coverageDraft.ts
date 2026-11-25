import { wikiContribution, wikiGaps } from '../../../../shared/worth'

/** A coverage note stays a draft until somebody confirms it. */
export function noteDraft(title: string, fact: string, confirmed: boolean): { status: 'draft' | 'ready'; body: string } {
  return wikiContribution({ title, fact, confirmed })
}

/** Titles in the notes that the known set does not already have. */
export function coverageGaps(seen: readonly string[], known: readonly string[]): string[] {
  return wikiGaps(seen, known)
}
