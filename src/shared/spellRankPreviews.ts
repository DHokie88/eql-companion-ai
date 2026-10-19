import type { SpellModifierPreferences, SpellRankEvidence } from './spellModifiers'

interface Identity { id: number; name: string }
/** Saved numeric-ID choices remain exact, including Base=0 and previews below observed ranks. */
export function spellMoteOverride(preferences: SpellModifierPreferences, spell: Identity): number | null {
  const entry = preferences.emulation.ranks[String(spell.id)]
  if (entry?.name.trim().toLowerCase() !== spell.name.trim().toLowerCase()) return null
  return Number.isInteger(entry.rank) && entry.rank >= 0 && entry.rank <= 10 ? entry.rank : null
}
export function previewSpellMote(preferences: SpellModifierPreferences, spell: Identity, rank: number | null): SpellModifierPreferences {
  const ranks = Object.fromEntries(Object.entries(preferences.emulation.ranks).filter(([id]) => id !== String(spell.id)))
  if (rank !== null) ranks[String(spell.id)] = { name: spell.name, rank }
  return { ...preferences, mode: 'emulate', emulation: { ...preferences.emulation, ranks } }
}
export function currentSpellRankEvidence(evidence: SpellRankEvidence | null | undefined, context: { characterKey: string | null; revision: string | null; snapshotId: string | null }): boolean {
  if (!evidence || !Number.isInteger(evidence.rank) || evidence.rank <= 1 || evidence.rank > 10) return false
  return evidence.characterKey === context.characterKey && evidence.contextRevision === context.revision && evidence.snapshotId === context.snapshotId
}
