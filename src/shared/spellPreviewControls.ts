import { defaultSpellModifierPreferences, type SpellModifierPreferences } from './spellModifiers'

/** A group choice replaces all exact-ID choices. Never changes observed ranks. */
export function selectSpellPreviewRank(preferences: SpellModifierPreferences, rank: number): SpellModifierPreferences {
  if (!Number.isInteger(rank) || rank < 0 || rank > 10) throw new Error('Mote rank must be 0 through X')
  return { ...preferences, mode: rank === 0 ? 'client' : 'emulate',
    emulation: { ...defaultSpellModifierPreferences().emulation, rank } }
}
export function toggleShowMine(preferences: SpellModifierPreferences, checked: boolean): SpellModifierPreferences {
  const hasPreview = (preferences.emulation.rank ?? 0) !== 0 || Object.keys(preferences.emulation.ranks).length > 0
  return { ...preferences, mode: checked ? 'mine' : hasPreview ? 'emulate' : 'client' }
}
