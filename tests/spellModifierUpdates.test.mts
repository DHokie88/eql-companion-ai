import test from 'node:test'
import assert from 'node:assert/strict'
import { rebaseSpellModifierPreferences, sameSpellModifierCharacter, saveSpellModifierPreferences } from '../src/shared/spellModifierUpdates'
import { defaultSpellModifierPreferences } from '../src/shared/spellModifiers'
import { modifierContext } from './helpers/spellModifierFixtures.mts'
import { SpellModifierCoordinator } from '../src/main/spellLibrary/modifierContext'

const stale = (): Error => new Error('Error invoking remote method: Spell modifier context changed; refresh and try again')
const context = (revision = 'a', profileKey = 'install/server/character') => modifierContext({ revision, profileKey })

test('world rebuild notifications for the same character do not cancel a save', () => {
  const original = context()
  assert.equal(sameSpellModifierCharacter(original, { name: 'TESTER', server: 'FIXTURE' }), true)
  assert.equal(sameSpellModifierCharacter(original, { name: 'Other', server: 'fixture' }), false)
  assert.equal(sameSpellModifierCharacter(original, { name: 'Tester', server: 'other' }), false)
  assert.equal(sameSpellModifierCharacter(original, null), false)
  assert.equal(sameSpellModifierCharacter({ ...original, character: null }, null), true)
})

test('rebase applies changed leaves and per-ID removals while preserving unrelated newer preferences', () => {
  const original = defaultSpellModifierPreferences()
  original.emulation.ranks = { 1: { name: 'First', rank: 7 }, 2: { name: 'Second', rank: 4 } }
  const requested = structuredClone(original)
  requested.mode = 'emulate'; requested.emulation.rank = 1; requested.targets = 3
  requested.emulation.ranks = { 2: { name: 'Second', rank: 0 }, 4: { name: 'Fourth', rank: 1 } }
  const fresh = structuredClone(original)
  fresh.emulation.focus = 'selected'; fresh.emulation.focusIds = [9001]
  fresh.emulation.ranks['3'] = { name: 'Third', rank: 9 }
  const before = structuredClone([original, requested, fresh])
  const result = rebaseSpellModifierPreferences(original, requested, fresh)
  assert.equal(result.mode, 'emulate'); assert.equal(result.targets, 3); assert.equal(result.emulation.rank, 1)
  assert.equal(result.emulation.focus, 'selected'); assert.deepEqual(result.emulation.focusIds, [9001])
  assert.deepEqual(result.emulation.ranks, { 2: { name: 'Second', rank: 0 }, 3: { name: 'Third', rank: 9 }, 4: { name: 'Fourth', rank: 1 } })
  assert.deepEqual([original, requested, fresh], before)
})

test('focus and target reset intent stays separate from newer mode and rank changes', () => {
  const original = defaultSpellModifierPreferences(); original.targets = 8
  original.emulation.focus = 'selected'; original.emulation.focusIds = [9001]
  const requested = structuredClone(original)
  delete requested.targets; requested.emulation.focus = 'none'; requested.emulation.focusIds = []
  const fresh = structuredClone(original); fresh.mode = 'mine'; fresh.emulation.rank = 10
  const result = rebaseSpellModifierPreferences(original, requested, fresh)
  assert.equal(result.targets, undefined); assert.equal(result.mode, 'mine'); assert.equal(result.emulation.rank, 10)
  assert.equal(result.emulation.focus, 'none'); assert.deepEqual(result.emulation.focusIds, [])
})

test('stale same-profile save retries against fresh facts and unrelated newer preferences without bypassing CAS', async () => {
  let rank = 4
  const coordinator = new SpellModifierCoordinator({
    selection: () => ({ installation: 'C:/EQ', character: { name: 'Alpha', server: 'test' } }),
    read: async () => ({ ranks: { first: { name: 'First', rank } }, inventory: { state: 'ready', exportedAt: null, candidates: [], warnings: [] }, warnings: [] }),
    store: { load: async () => ({}), save: async () => undefined }, changed: () => undefined, log: () => undefined
  })
  try {
    const original = await coordinator.get()
    const requested = structuredClone(original.preferences); requested.emulation.rank = 1
    rank = 9; coordinator.inputsChanged()
    let fresh = await coordinator.get()
    const newer = structuredClone(fresh.preferences); newer.emulation.focus = 'none'; newer.targets = 8
    fresh = await coordinator.update({ expectedRevision: fresh.revision, preferences: newer })
    const revisions: string[] = []
    const result = await saveSpellModifierPreferences(original, requested, {
      read: () => coordinator.get(), isCurrent: () => true,
      write: (update) => { revisions.push(update.expectedRevision); return coordinator.update(update) }
    })
    assert.deepEqual(revisions, [original.revision, fresh.revision])
    assert.equal(result.ranks?.first.rank, 9)
    assert.equal(result.preferences.emulation.rank, 1)
    assert.equal(result.preferences.emulation.focus, 'none'); assert.equal(result.preferences.targets, 8)
  } finally { coordinator.stop() }
})

test('same-character engine or catalog revisions recover even when a notification arrives during the write', async () => {
  const original = context(), requested = structuredClone(original.preferences)
  requested.mode = 'emulate'; requested.emulation.rank = 1
  const fresh = context('engine/catalog-new'); fresh.ranks!['synthetic bolt'].rank = 10
  let displayedRevision = original.revision, attempts = 0
  const result = await saveSpellModifierPreferences(original, requested, {
    read: async () => fresh, isCurrent: () => true,
    write: async (update) => {
      attempts++
      if (attempts === 1) { displayedRevision = fresh.revision; throw stale() }
      assert.equal(update.expectedRevision, displayedRevision)
      displayedRevision = 'saved-context'
      return { ...fresh, revision: displayedRevision, preferences: update.preferences }
    }
  })
  assert.equal(attempts, 2); assert.equal(result.revision, displayedRevision)
  assert.equal(result.ranks?.['synthetic bolt'].rank, 10); assert.equal(result.preferences.emulation.rank, 1)
})

test('installation, server, character and characterless switches never receive a stale preview', async () => {
  for (const identity of ['another-install/same-server/same-character', 'same-install/another-server/same-character', 'same-install/same-server/another-character']) {
    const original = context(), fresh = context('new', identity)
    let writes = 0
    await assert.rejects(saveSpellModifierPreferences(original, original.preferences, {
      read: async () => fresh, isCurrent: () => true,
      write: async () => { writes++; throw stale() }
    }), /selection changed/)
    assert.equal(writes, 1)
  }
  const original = { ...context(), character: null }, fresh = { ...context('new', 'other-install/session'), character: null }
  let writes = 0
  await assert.rejects(saveSpellModifierPreferences(original, original.preferences, {
    read: async () => fresh, isCurrent: () => true, write: async () => { writes++; throw stale() }
  }), /selection changed/)
  assert.equal(writes, 1)
})

test('retry is bounded and validation failures are never replayed', async () => {
  const original = context(); let writes = 0, reads = 0
  await assert.rejects(saveSpellModifierPreferences(original, original.preferences, {
    read: async () => { reads++; return context(`refresh-${reads}`) }, isCurrent: () => true,
    write: async () => { writes++; throw stale() }
  }), /context changed/)
  assert.equal(writes, 3); assert.equal(reads, 2)
  writes = 0; reads = 0
  await assert.rejects(saveSpellModifierPreferences(original, original.preferences, {
    read: async () => { reads++; return original }, isCurrent: () => true,
    write: async () => { writes++; throw new Error('Invalid mote rank') }
  }), /Invalid mote rank/)
  assert.equal(writes, 1); assert.equal(reads, 0)
})

test('unmount or identity-change cancellation during refresh prevents a retry', async () => {
  const original = context(); let active = true, writes = 0
  await assert.rejects(saveSpellModifierPreferences(original, original.preferences, {
    read: async () => { active = false; return context('fresh') }, isCurrent: () => active,
    write: async () => { writes++; throw stale() }
  }), /selection changed/)
  assert.equal(writes, 1)
})
