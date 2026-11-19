import type { SpellBrowsePreferences, SpellModifierPreferences } from './spellModifiers'

/** Global preview only. Per-spell overrides, focus, and observed ranks stay where they are. */
export function selectSpellPreviewRank(preferences: SpellModifierPreferences, rank: number): SpellModifierPreferences {
  if (!Number.isInteger(rank) || rank < 0 || rank > 10) throw new Error('Mote rank must be 0 through X')
  const browse: SpellBrowsePreferences = { ...preferences.browse }
  if (rank >= 1) browse.rank = rank
  else delete browse.rank
  return {
    ...preferences,
    mode: rank === 0 ? 'client' : 'emulate',
    emulation: { ...preferences.emulation, rank: rank === 0 ? 0 : rank },
    ...(Object.keys(browse).length > 0 ? { browse } : {})
  }
}
export function toggleShowMine(preferences: SpellModifierPreferences, checked: boolean): SpellModifierPreferences {
  const hasPreview = (preferences.emulation.rank ?? 0) !== 0 || (preferences.browse?.rank ?? 0) >= 1 || Object.keys(preferences.emulation.ranks).length > 0
  return {
    ...preferences,
    mode: checked ? 'mine' : hasPreview ? 'emulate' : 'client',
    browse: { ...preferences.browse, useMyRanks: checked }
  }
}
