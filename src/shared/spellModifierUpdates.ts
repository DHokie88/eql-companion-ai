import type { SpellModifierContext, SpellModifierPreferences, SpellModifierUpdate } from './spellModifiers'

/** Keep unrelated newer preferences when only part of a stale form was edited. */
export function rebaseSpellModifierPreferences(original: SpellModifierPreferences, requested: SpellModifierPreferences, fresh: SpellModifierPreferences): SpellModifierPreferences {
  let result = structuredClone(fresh)
  if (original.mode !== requested.mode) result.mode = requested.mode
  if ((original.targets ?? 4) !== (requested.targets ?? 4)) {
    const { targets: _targets, ...withoutTargets } = result
    result = { ...withoutTargets, ...(requested.targets === undefined ? {} : { targets: requested.targets }) }
  }
  for (const field of ['rank', 'focus', 'focusIds'] as const) {
    if (JSON.stringify(original.emulation[field]) !== JSON.stringify(requested.emulation[field])) {
      Object.assign(result.emulation, { [field]: structuredClone(requested.emulation[field]) })
    }
  }
  result.emulation.ranks = rebaseRanks(original.emulation.ranks, requested.emulation.ranks, fresh.emulation.ranks)
  return result
}

function rebaseRanks(original: SpellModifierPreferences['emulation']['ranks'], requested: SpellModifierPreferences['emulation']['ranks'], fresh: SpellModifierPreferences['emulation']['ranks']) {
  const result = new Map(Object.entries(structuredClone(fresh)))
  for (const id of new Set([...Object.keys(original), ...Object.keys(requested)])) {
    if (JSON.stringify(original[id]) === JSON.stringify(requested[id])) continue
    if (requested[id] === undefined) result.delete(id)
    else result.set(id, structuredClone(requested[id]))
  }
  return Object.fromEntries(result)
}

export function spellModifierProfileKey(context: SpellModifierContext): string | null {
  return context.profileKey ?? context.character?.key ?? null
}

export function sameSpellModifierCharacter(context: SpellModifierContext | null, character: { name: string; server: string } | null): boolean {
  const previous = context?.character ?? null
  if (previous === null || character === null) return previous === character
  return previous.name.toLowerCase() === character.name.toLowerCase() && previous.server.toLowerCase() === character.server.toLowerCase()
}

interface ModifierUpdateIO {
  read(): Promise<SpellModifierContext>
  write(update: SpellModifierUpdate): Promise<SpellModifierContext>
  isCurrent(): boolean
}

function assertSelection(original: SpellModifierContext, next: SpellModifierContext, io: ModifierUpdateIO): void {
  const identity = spellModifierProfileKey(original)
  if (!io.isCurrent() || identity === null || identity !== spellModifierProfileKey(next)) {
    throw new Error('Spell modifier selection changed; your preview was not applied to the new selection. Please try again.')
  }
}
function staleRevision(cause: unknown): boolean {
  return (cause instanceof Error ? cause.message : String(cause)).includes('Spell modifier context changed; refresh and try again')
}

/** Main still checks every revision atomically. Only the user's original changes
 * are replayed, at most twice, against fresh facts for the same profile identity.
 */
export async function saveSpellModifierPreferences(original: SpellModifierContext, requested: SpellModifierPreferences, io: ModifierUpdateIO): Promise<SpellModifierContext> {
  let expected = original
  for (let attempt = 0; attempt < 3; attempt++) {
    assertSelection(original, expected, io)
    const preferences = rebaseSpellModifierPreferences(original.preferences, requested, expected.preferences)
    try {
      const next = await io.write({ expectedRevision: expected.revision, preferences })
      assertSelection(original, next, io)
      return next
    } catch (cause) {
      if (!staleRevision(cause) || attempt === 2) throw cause
      expected = await io.read()
    }
  }
  throw new Error('Spell modifier settings could not be saved. Please try again.')
}
