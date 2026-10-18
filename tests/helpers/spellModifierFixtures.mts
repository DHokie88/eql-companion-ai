import { parseClientSpellBundle } from '../../src/shared/clientSpellParser'
import { defaultSpellModifierPreferences } from '../../src/shared/spellModifiers'
import type { ClientSpellRecord } from '../../src/shared/spellLibrary'
import type { SpellModifierContext } from '../../src/shared/spellModifiers'
import { spellBundle } from '../fixtures/spell-library/synthetic'

export function effect(spa: number, base: number, limit = 0) {
  return { slot: 1, spa, base, limit, calc: 100, max: 0 }
}

export function modifierSpell(overrides: Partial<ClientSpellRecord> = {}): ClientSpellRecord {
  return { ...parseClientSpellBundle(spellBundle())[0], name: 'Synthetic Bolt', effects: [effect(0, -100)], ...overrides }
}

export function modifierFocus(limits = [], overrides: Partial<ClientSpellRecord> = {}): ClientSpellRecord {
  return modifierSpell({ id: 9001, name: 'Synthetic Focus II', effects: [effect(124, 1, 20), ...limits], classes: [], beneficial: true, ...overrides })
}

export function modifierContext(overrides: Partial<SpellModifierContext> = {}): SpellModifierContext {
  return {
    revision: 'context-a', modelVersion: '1', character: { key: 'char', name: 'Tester', server: 'fixture' },
    preferences: { ...defaultSpellModifierPreferences(), mode: 'mine' },
    ranks: { 'synthetic bolt': { name: 'Synthetic Bolt', rank: 1 } },
    inventory: { state: 'ready', exportedAt: '2026-10-18T00:00:00Z', candidates: [], warnings: [] }, warnings: [], ...overrides
  }
}
